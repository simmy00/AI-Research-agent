import json
import logging
import asyncio
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from app.rag import RAGIndex
from app.agents import run_research_pipeline

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Research Assistant - API Service",
    description="Multi-agent query deconstruction, web harvesting, and local document synthesis engine.",
    version="1.0.0"
)

# Enable CORS for local development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core RAG index state
rag_index = RAGIndex()

class ResearchRequest(BaseModel):
    topic: str
    provider: str  # "gemini" or "ollama"
    apiKey: Optional[str] = None
    ollamaUrl: Optional[str] = "http://localhost:11434"
    modelName: Optional[str] = None

@app.get("/api/status")
async def get_status():
    """
    Check API server operational status and active RAG index document count.
    """
    return {
        "status": "online",
        "active_documents": rag_index.documents,
        "indexed_chunks": len(rag_index.chunks)
    }

@app.post("/api/clear-rag")
async def clear_rag():
    """
    Clear all documents and chunks from the local RAG store.
    """
    rag_index.clear()
    logger.info("Cleared RAG Index")
    return {"message": "RAG Index cleared successfully."}

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Accepts text, markdown, or PDF files, reads content, and partitions into vector chunks.
    """
    filename = file.filename
    content = ""
    
    try:
        if filename.endswith(".txt") or filename.endswith(".md"):
            content_bytes = await file.read()
            content = content_bytes.decode("utf-8", errors="ignore")
        elif filename.endswith(".pdf"):
            # Try parsing PDF. If pypdf is missing, log a warning and throw HTTP error
            try:
                import pypdf
                content_bytes = await file.read()
                from io import BytesIO
                pdf_reader = pypdf.PdfReader(BytesIO(content_bytes))
                text_runs = []
                for page in pdf_reader.pages:
                    text_runs.append(page.extract_text() or "")
                content = "\n".join(text_runs)
            except ImportError:
                raise HTTPException(
                    status_code=400,
                    detail="PDF parsing requires the 'pypdf' package. Please install it with 'pip install pypdf' or upload .txt/.md files."
                )
        else:
            raise HTTPException(
                status_code=400, 
                detail="Unsupported file format. Please upload .txt, .md, or .pdf files."
            )
            
        if not content.strip():
            raise HTTPException(status_code=400, detail="The uploaded file appears to be empty.")
            
        rag_index.add_document(filename, content)
        return {
            "message": f"Successfully indexed {filename}",
            "chunks_created": len([c for c in rag_index.chunks if c["document"] == filename])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing file upload {filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal file processor failure: {str(e)}")

@app.post("/api/research")
async def research_topic(request: ResearchRequest):
    """
    Initiates the multi-agent research pipeline and streams execution progress to the client via SSE.
    """
    if not request.topic.strip():
        raise HTTPException(status_code=400, detail="Research topic cannot be empty.")
        
    if request.provider == "gemini" and not request.apiKey:
        raise HTTPException(status_code=400, detail="Google AI Studio Gemini API Key is required for the Gemini provider.")
        
    # Configure the executor credentials
    config = {
        "provider": request.provider,
        "api_key": request.apiKey,
        "ollama_url": request.ollamaUrl,
        "model": request.modelName
    }
    
    async def event_generator():
        queue = asyncio.Queue()
        
        # Async progress callback that feeds our SSE stream
        async def progress_callback(step: str, message: str):
            await queue.put({"step": step, "message": message})
            
        # Run agent loop in a separate task
        async def run_pipeline():
            try:
                results = await run_research_pipeline(
                    topic=request.topic,
                    rag_index=rag_index,
                    config=config,
                    progress_callback=progress_callback
                )
                await queue.put({"step": "complete", "message": "Done", "result": results})
            except Exception as e:
                logger.error(f"Error in running pipeline task: {e}")
                # Error event is sent by progress_callback inside run_research_pipeline, but if it crashes before that:
                await queue.put({"step": "error", "message": f"Pipeline failure: {str(e)}"})
            finally:
                # Add sentinel to terminate generator loop
                await queue.put(None)
                
        # Start running in background
        task = asyncio.create_task(run_pipeline())
        
        # Consume queue items and yield them as SSE events
        while True:
            item = await queue.get()
            if item is None:
                break
            # Standard SSE format: "data: <json>\n\n"
            yield f"data: {json.dumps(item)}\n\n"
            queue.task_done()
            
        await task # wait for task completion
        
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# Mount Static Files to serve the beautiful Web Dashboard
# This must be mounted last so that it does not intercept /api paths
try:
    app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
except RuntimeError:
    logger.warning("Frontend directory not created yet. Make sure to implement Step 7.")
