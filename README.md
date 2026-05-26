# 🧠 Aegis Research — Multi-Agent Workflow Engine
> A state-of-the-art, fully autonomous AI Research Assistant built using a decoupled Multi-Agent coordination architecture and a premium glassmorphic dark-mode web console.

This system is built from scratch as part of a technical assignment for the **AI Researcher / AI Innovation Engineer** position. It demonstrates deep practical AI understanding, advanced architectural thinking, and high prototyping quality—all while operating **100% on free-tier services and local open-weight models** (zero paid API keys required).

---

## 🚀 Key Innovation Highlights

1.  **Autonomous Multi-Agent Architecture**:
    *   `PlannerAgent`: Deconstructs complex queries into distinct optimized search queries and research sub-goals.
    *   `WebSearchAgent`: Harvesting web data asynchronously using a free, key-less DuckDuckGo integration.
    *   `SynthesisAgent`: Consolidates multi-source web scraping and local file context into a comprehensive Markdown report.
    *   `RefinementAgent` (Critic): Critiques raw drafts, verifies citations, structures presentation layouts, and appends a clean, formatted References table.
2.  **Adaptive Embedding & Retrieval Engine (RAG)**:
    *   Fully functional local vector indexing with a **triple fallback search strategy**:
        *   **Primary**: Google Gemini Free Embeddings (`text-embedding-004`) if a Gemini key is active.
        *   **Secondary**: Local Ollama Embeddings if Ollama localhost is selected.
        *   **Fallback**: A robust, zero-dependency, local **TF-IDF & Term Frequency Cosine Similarity** search engine that operates offline with 100% reliability.
3.  **Unified Cloud/Local Inference Gate**:
    *   Seamless integration with **Google Gemini Free API** (1.5 Flash / 2.0 Flash) and **local Ollama models** (Llama 3, Phi-3, Mistral), providing absolute data privacy and cost control.
4.  **Real-Time Agent Telemetry**:
    *   Utilizes a Server-Sent Events (SSE) streaming engine to stream active logs, transitions, and progress percentages directly from the Python backend agents to the UI.
5.  **Stunning Glassmorphic Console**:
    *   Custom vanilla HSL CSS design system incorporating modern design guidelines: glowing absolute background orbs, responsive sidebars, custom file drag-and-drop zones, scrolling terminal logs, and a markdown publication previewer with export and copy controls.

---

## 📁 System Architecture & Directory Layout

```
d:\AI-Research-Assistant\
│
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application, CORS configs, Static Mounting, RAG upload API, SSE Stream
│   ├── agents.py        # Multi-Agent classes (Planner, Searcher, Synthesizer, Refiner), Unified LLM HTTP client
│   ├── search.py        # duckduckgo_search helper & beautifulsoup4 async web scraper
│   └── rag.py           # Multi-tier RAG document indexing, Gemini/Ollama Embeddings, TF-IDF cosine similarity fallbacks
│
├── frontend/
│   ├── index.html       # Web dashboard structure, Configuration forms, Live agent console, Suggested queries
│   ├── style.css        # Rich Glassmorphic CSS design system, dark-mode styling, animated glows, responsive layout
│   └── app.js           # JS controller, File upload drag & drop, SSE stream reader, Custom regex Markdown parser
│
├── COMPARISON_REPORT.md      # Part 1: Deep analysis comparing Gemini, Ollama, and Hugging Face Inference
├── RECOMMENDATION_REPORT.md  # Part 3: Production-grade cloud architecture, cost estimates, scaling & risk mitigation
├── requirements.txt         # Backend Python dependencies
└── README.md                # General setup, installation, and walkthrough guide (this file)
```

---

## ⚙️ Quick-Start Installation

Follow these steps to run the complete working prototype locally under a single unified process.

### Prerequisite Checklist
*   Python 3.8+ (Tested on **Python 3.11.9**)
*   Internet connection (for web searching and Gemini calls)
*   *(Optional)* Ollama installed and running on localhost if you wish to run 100% local.

### 1. Clone & Initialize Environment
Open PowerShell or your preferred shell and navigate to the project directory:
```bash
# Verify your workspace location
cd d:\AI-Research-Assistant

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux / macOS:
source venv/bin/activate
```

### 2. Install Dependencies
Install all required python libraries:
```bash
pip install -r requirements.txt
```
*(Optional)* If you plan to test PDF file uploads via the RAG system, install the lightweight pdf text extractor:
```bash
pip install pypdf
```

### 3. Launch the Unified Service
Run the FastAPI application server using Uvicorn:
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Once running, open your web browser and navigate to:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

The beautiful dark-mode **Aegis Research Console** will load instantly!

---

## 💡 Step-by-Step Walkthrough & Testing Guide

To experience the full power of the AI Research Assistant, perform the following verification workflow:

### Option A: Testing with Google Gemini (Cloud Free-Tier)
1.  Obtain a **completely free Gemini API Key** from [Google AI Studio](https://aistudio.google.com/) in less than 30 seconds.
2.  In the Aegis Console left panel, select **Google Gemini (Free Tier)** as the Inference Provider.
3.  Paste your free API Key into the password field (you can click 👁️ to verify typing).
4.  In the search bar at the top, enter a topic like: `Breakthroughs in Solid-State Battery technology 2026`.
5.  Click the glowing **Harvest Research** button.
6.  **Watch the Magic**: 
    *   The "Agent Co-Working Workspace" console opens.
    *   `Planner Agent` splits the topic and plans queries.
    *   `Searcher Agent` searches DuckDuckGo and harvests content.
    *   `Synthesizer Agent` compiles raw insights into a detailed draft.
    *   `Critic Agent` polishes, adds citations, and formats the report.
7.  The final formatted Markdown report appears inside the "Research Publication Workspace", complete with structured tables, blockquotes, bold features, and a list of clickable, verified citation links!

### Option B: Testing with Retrieval-Augmented Generation (RAG)
1.  Before clicking **Harvest Research**, drag and drop any local `.txt` or `.md` files (or a `.pdf` if `pypdf` is installed) into the index drop zone on the sidebar.
2.  You will see an immediate log in the agent console confirming: `Indexed document context successfully (X vector chunks generated)`.
3.  Perform your research query (e.g., search for a term mentioned inside your uploaded files).
4.  The `Searcher Agent` will automatically retrieve matching text chunks from your private files using our semantic/TF-IDF vector index, merge them with live web search results, and feed them into the synthesizer.
5.  Your final report will have a dedicated section discussing details retrieved directly from your uploaded documents!

### Option C: Testing completely Locally (Ollama)
1.  Start your local Ollama server (ensure a model like `llama3` or `phi3` is pulled: `ollama pull llama3`).
2.  Select **Ollama (Local LLM)** in the provider dropdown.
3.  Set your Ollama API endpoint (`http://localhost:11434`) and model name (`llama3`).
4.  Click **Harvest Research** to run the complete agent pipeline locally on your CPU/GPU with 100% data privacy!
