import json
import logging
from typing import List, Dict, Callable, Awaitable, Optional
import httpx
from app.search import search_ddg, scrape_url
from app.rag import RAGIndex

logger = logging.getLogger(__name__)

# Standard Unified Client to call LLMs (Gemini / Ollama) via async HTTP REST
async def call_llm(
    system_prompt: str,
    user_prompt: str,
    config: Dict
) -> str:
    provider = config.get("provider", "gemini").lower()
    model = config.get("model", "")
    
    # Setup default models if not provided
    if provider == "gemini":
        model = model or "gemini-1.5-flash"
        api_key = config.get("api_key", "")
        if not api_key:
            raise ValueError("Gemini API key is required but missing.")
        
        # Use v1beta REST API endpoint
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [{"text": user_prompt}]
                }
            ],
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 8192
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, headers=headers, timeout=60.0)
                if res.status_code != 200:
                    error_msg = res.json().get("error", {}).get("message", "Unknown Gemini Error")
                    raise RuntimeError(f"Gemini API Error: {error_msg} (Status: {res.status_code})")
                
                response_json = res.json()
                text = response_json["candidates"][0]["content"]["parts"][0]["text"]
                return text
        except Exception as e:
            logger.error(f"Error calling Gemini: {e}")
            raise

    elif provider == "ollama":
        model = model or "qwen2.5:0.5b"
        ollama_url = config.get("ollama_url", "http://localhost:11434").rstrip("/")
        url = f"{ollama_url}/api/generate"
        headers = {"Content-Type": "application/json"}
        payload = {
            "model": model,
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 2048
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, headers=headers, timeout=600.0)
                if res.status_code != 200:
                    error_body = res.text
                    raise RuntimeError(f"Ollama API Error (Status {res.status_code}): {error_body}")
                
                response_json = res.json()
                return response_json.get("response", "")
        except httpx.TimeoutException:
            raise RuntimeError(
                f"Ollama request timed out ({model}). The model may be loading for the first time, "
                "or your CPU is taking too long to generate. To fix this, run `ollama pull qwen2.5:0.5b` "
                "or `ollama pull qwen2.5:1.5b` in your terminal and use that model identifier for a much faster execution."
            )
        except Exception as e:
            logger.error(f"Error calling Ollama: {e}")
            raise
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")


class PlannerAgent:
    """
    Deconstructs a user research topic into search strategies and specific query strings.
    """
    SYSTEM_PROMPT = """You are an Expert Research Planner. 
Your job is to deconstruct a user's complex research topic into exactly 3 highly targeted search queries and list 3-4 specific research sub-goals.
Output your response ONLY in the following JSON format. Do not add any backticks or extra text, just raw JSON:
{
  "queries": ["query 1", "query 2", "query 3"],
  "subgoals": ["subgoal 1", "subgoal 2", "subgoal 3"]
}
Keep queries distinct and optimized for web search engines. Make them specific, omitting fluff words like 'and', 'or', 'for' where possible, and focusing on key terms."""

    async def execute(self, topic: str, config: Dict) -> Dict:
        user_prompt = f"Deconstruct this research topic: {topic}"
        raw_response = await call_llm(self.SYSTEM_PROMPT, user_prompt, config)
        
        # Clean response if markdown blocks exist
        clean_text = raw_response.strip().replace("```json", "").replace("```", "").strip()
        try:
            return json.loads(clean_text)
        except Exception as e:
            logger.warning(f"Failed to parse Planner response as JSON: {raw_response}. Error: {e}")
            # Dynamic fallback
            return {
                "queries": [topic, f"{topic} overview", f"latest research {topic}"],
                "subgoals": ["Understand general framework", "Analyze key technical papers", "Examine future applications"]
            }


class WebSearchAgent:
    """
    Executes search queries, retrieves web contents, and pulls semantic context from RAGIndex.
    """
    async def execute(
        self,
        queries: List[str],
        rag_index: RAGIndex,
        user_query: str,
        config: Dict,
        progress_callback: Callable[[str, str], Awaitable[None]]
    ) -> Dict:
        all_sources = []
        scraped_texts = []
        
        # 1. Query local RAG documents if any exist
        if rag_index.chunks:
            await progress_callback("searcher", "📁 Querying uploaded local files (RAG Index)...")
            # Get api key or ollama url for embeddings if configured
            gemini_key = config.get("api_key") if config.get("provider") == "gemini" else None
            ollama_url = config.get("ollama_url") if config.get("provider") == "ollama" else None
            
            rag_results = await rag_index.search(
                query=user_query,
                top_k=4,
                gemini_key=gemini_key,
                ollama_url=ollama_url
            )
            
            if rag_results:
                await progress_callback("searcher", f"📁 Found {len(rag_results)} relevant document fragments.")
                for chunk in rag_results:
                    scraped_texts.append(f"[Local Document: {chunk['document']}]\n{chunk['text']}")
                    all_sources.append({
                        "title": f"Local Document: {chunk['document']}",
                        "url": "local_upload",
                        "snippet": chunk['text'][:200] + "..."
                    })

        # 2. Query DuckDuckGo for each query
        for q in queries:
            await progress_callback("searcher", f"🔍 Searching DuckDuckGo for: '{q}'...")
            search_results = await search_ddg(q, max_results=3)
            
            if not search_results:
                await progress_callback("searcher", f"⚠️ No results returned for query: '{q}'")
                continue
                
            # Log sources
            for res in search_results:
                all_sources.append(res)
                
            # Pick the top result to scrape for in-depth content
            top_res = search_results[0]
            await progress_callback("searcher", f"🌐 Scraping primary source: {top_res['title']} ({top_res['url']})")
            full_text = await scrape_url(top_res["url"])
            if full_text:
                scraped_texts.append(f"[Source: {top_res['title']} | URL: {top_res['url']}]\n{full_text}")
            else:
                # Fallback to snippet if scrape failed
                scraped_texts.append(f"[Source: {top_res['title']} | URL: {top_res['url']}]\nSnippet: {top_res['snippet']}")
                
        return {
            "sources": all_sources,
            "raw_context": "\n\n=== SOURCE SEPARATOR ===\n\n".join(scraped_texts)
        }


class SynthesisAgent:
    """
    Synthesizes scraped raw context and RAG outputs into a cohesive, highly structured research draft.
    """
    SYSTEM_PROMPT = """You are a Principal AI Synthesizer. 
Your objective is to craft an incredibly thorough, professional, and detailed research draft in Markdown, synthesized from the provided sources and context.

Your research draft MUST include:
1. Executive Summary: High-level overview of findings.
2. Comprehensive Analysis: Break down by core subtopics. Use statistics, key technical mechanisms, and theories from context.
3. Market/Research Landscape: Key players, active projects, or technical approaches.
4. Synthesized Context & Quotes: Reference specific documents or websites by name in the text.
5. In-depth RAG & Document Insights: A dedicated section discussing insights pulled directly from uploaded local documents (if any exist in the context).

Ensure the report is highly professional, clean, academic yet industry-ready, and has NO placeholders."""

    async def execute(self, topic: str, context: str, subgoals: List[str], config: Dict) -> str:
        user_prompt = f"""Research Topic: {topic}
Sub-goals: {", ".join(subgoals)}

Here is the raw scraped text, search results, and local file RAG contexts to synthesize:
---
{context}
---

Write a comprehensive, professional, and publication-ready research report in Markdown. Include citations referencing the sources provided above in brackets (e.g. [Source Name])."""
        
        return await call_llm(self.SYSTEM_PROMPT, user_prompt, config)


class RefinementAgent:
    """
    Critiques the synthesized draft, fixes alignment, ensures formatting is visually premium, and maps clean citations.
    """
    SYSTEM_PROMPT = """You are an Expert Research Critic and Editor.
Your job is to read a synthesized draft, critique it, polish the English, inject clean structural Markdown formatting (such as bullet lists, highlighting, bold terms, blockquotes, and tables where applicable), verify all inline citations match the source files, and append a beautifully structured 'References & Sources' section at the absolute bottom.

Ensure the styling is immaculate and ready for a premium web display.
Your output must be the POLISHED MARKDOWN ONLY. Do not wrap in extra commentary or text outside of the report."""

    async def execute(self, draft: str, sources: List[Dict], config: Dict) -> str:
        # Format list of sources to let the agent create a beautiful citation table
        sources_list_str = ""
        for i, s in enumerate(sources, 1):
            sources_list_str += f"[{i}] {s['title']} - URL: {s['url']}\nSnippet: {s['snippet']}\n\n"
            
        user_prompt = f"""Here is the raw research draft:
---
{draft}
---

Here are all the original available sources:
---
{sources_list_str}
---

Please perform your critique, formatting alignment, and styling polish. Include a detailed, organized 'References & Sources' section mapping each [Source Name] to their index numbers and actual URLs. Provide only the final polished markdown."""
        
        return await call_llm(self.SYSTEM_PROMPT, user_prompt, config)


# Main Coordinator Function
async def run_research_pipeline(
    topic: str,
    rag_index: RAGIndex,
    config: Dict,
    progress_callback: Callable[[str, str], Awaitable[None]]
) -> Dict:
    """
    Coordinative agent loop running Planner, Searcher, Synthesizer, and Refiner.
    """
    try:
        # Step 1: Planning
        await progress_callback("planner", "🧠 Planner Agent: Deconstructing research query...")
        planner = PlannerAgent()
        plan = await planner.execute(topic, config)
        
        queries = plan.get("queries", [topic])
        subgoals = plan.get("subgoals", [])
        
        subqueries_str = ', '.join([f'"{q}"' for q in queries])
        await progress_callback("planner", f"🧠 Planned subqueries: {subqueries_str}")
        
        # Step 2: Information Gathering (Web Search + RAG)
        await progress_callback("searcher", "🔍 Searcher Agent: Gathering live data and RAG fragments...")
        searcher = WebSearchAgent()
        gathering = await searcher.execute(queries, rag_index, topic, config, progress_callback)
        
        sources = gathering.get("sources", [])
        context = gathering.get("raw_context", "")
        
        if not context:
            context = "No detailed online scraper data retrieved. Operating on search metadata snippets only."
            
        # Step 3: Synthesis
        await progress_callback("synthesizer", "✍️ Synthesizer Agent: Consolidated context and drafting deep report...")
        synthesizer = SynthesisAgent()
        draft = await synthesizer.execute(topic, context, subgoals, config)
        
        # Step 4: Critique & Refinement
        await progress_callback("critic", "🔬 Critic Agent: Reviewing data points, building references table, and styling formatting...")
        refiner = RefinementAgent()
        final_markdown = await refiner.execute(draft, sources, config)
        
        await progress_callback("complete", "🎉 Multi-Agent Research Workflow Completed successfully!")
        
        return {
            "markdown": final_markdown,
            "sources": sources,
            "plan": plan
        }
    except Exception as e:
        logger.error(f"Error in multi-agent pipeline: {e}")
        await progress_callback("error", f"❌ Execution failed: {str(e)}")
        raise
