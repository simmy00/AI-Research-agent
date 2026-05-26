document.addEventListener("DOMContentLoaded", () => {
    // --- State Elements ---
    const providerSelect = document.getElementById("provider-select");
    const geminiConfig = document.getElementById("gemini-config-group");
    const ollamaConfig = document.getElementById("ollama-config-group");
    const apiKeyInput = document.getElementById("api-key-input");
    const toggleKeyVisibilityBtn = document.getElementById("toggle-key-visibility");
    const geminiModelSelect = document.getElementById("gemini-model-select");
    const ollamaUrlInput = document.getElementById("ollama-url-input");
    const ollamaModelInput = document.getElementById("ollama-model-input");
    
    const dropZone = document.getElementById("drop-zone");
    const fileUploader = document.getElementById("file-uploader");
    const fileListContainer = document.getElementById("file-list-container");
    const uploadedFilesUl = document.getElementById("uploaded-files-ul");
    const clearRagBtn = document.getElementById("clear-rag-btn");
    
    const serverStatusDot = document.getElementById("server-status-dot");
    const serverStatusText = document.getElementById("server-status-text");
    
    const topicQueryInput = document.getElementById("topic-query");
    const runResearchBtn = document.getElementById("run-research-btn");
    const agentMonitor = document.getElementById("agent-monitor");
    const progressBarFill = document.getElementById("progress-bar-fill");
    const terminalBody = document.getElementById("terminal-body");
    
    const reportPanel = document.getElementById("report-panel");
    const reportBody = document.getElementById("report-body");
    const reportActions = document.getElementById("report-actions");
    const copyMarkdownBtn = document.getElementById("copy-markdown-btn");
    const downloadReportBtn = document.getElementById("download-report-btn");
    
    const citationsBody = document.getElementById("citations-body");
    const suggestedBtns = document.querySelectorAll(".suggested-btn");

    let activeResearchMarkdown = "";
    let activeResearchTopic = "";

    // --- Provider UI Toggles ---
    providerSelect.addEventListener("change", () => {
        const val = providerSelect.value;
        if (val === "gemini") {
            geminiConfig.classList.add("active");
            ollamaConfig.classList.remove("active");
        } else {
            geminiConfig.classList.remove("active");
            ollamaConfig.classList.add("active");
        }
    });

    toggleKeyVisibilityBtn.addEventListener("click", () => {
        if (apiKeyInput.type === "password") {
            apiKeyInput.type = "text";
            toggleKeyVisibilityBtn.textContent = "🙈";
        } else {
            apiKeyInput.type = "password";
            toggleKeyVisibilityBtn.textContent = "👁️";
        }
    });

    // --- Suggested Queries ---
    suggestedBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            topicQueryInput.value = btn.textContent;
            topicQueryInput.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    });

    // --- Server Status & Initial Fetch ---
    async function checkServerStatus() {
        try {
            const res = await fetch("/api/status");
            if (res.status === 200) {
                const data = await res.json();
                serverStatusDot.classList.add("active");
                serverStatusText.textContent = "Server Online";
                updateFileList(data.active_documents);
            } else {
                throw new Error("Server response error");
            }
        } catch (e) {
            serverStatusDot.classList.remove("active");
            serverStatusText.textContent = "Offline / Reconnecting";
        }
    }
    
    // Poll server status on load and periodically
    checkServerStatus();
    setInterval(checkServerStatus, 15000);

    // --- RAG Document Management ---
    
    // Browse Files Link trigger
    dropZone.addEventListener("click", (e) => {
        if (!e.target.classList.contains("browse-link")) return;
        fileUploader.click();
    });

    // Browse change trigger
    fileUploader.addEventListener("change", () => {
        if (fileUploader.files.length > 0) {
            uploadFiles(fileUploader.files);
        }
    });

    // Drag-over styling
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            uploadFiles(e.dataTransfer.files);
        }
    });

    async function uploadFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append("file", file);
            
            logTerminal("system", `[SYSTEM] Preparing to upload document context: ${file.name}...`);
            
            try {
                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData
                });
                
                if (res.status === 200) {
                    const data = await res.json();
                    logTerminal("success", `[SYSTEM] Indexed successfully: ${data.message} (${data.chunks_created} vector chunks generated).`);
                } else {
                    const err = await res.json();
                    logTerminal("error", `[SYSTEM] Upload failed for ${file.name}: ${err.detail}`);
                }
            } catch (e) {
                logTerminal("error", `[SYSTEM] Connection error uploading file ${file.name}: ${e.message}`);
            }
        }
        // Refresh index file list
        checkServerStatus();
    }

    function updateFileList(filesList) {
        if (!filesList || filesList.length === 0) {
            fileListContainer.style.display = "none";
            uploadedFilesUl.innerHTML = "";
            return;
        }
        
        fileListContainer.style.display = "block";
        uploadedFilesUl.innerHTML = "";
        
        filesList.forEach(filename => {
            const li = document.createElement("li");
            
            const nameSpan = document.createElement("span");
            nameSpan.textContent = filename;
            nameSpan.title = filename;
            
            const badgeSpan = document.createElement("span");
            badgeSpan.textContent = "indexed";
            badgeSpan.style.color = "var(--accent-teal)";
            badgeSpan.style.fontSize = "0.65rem";
            badgeSpan.style.fontWeight = "600";
            
            li.appendChild(nameSpan);
            li.appendChild(badgeSpan);
            uploadedFilesUl.appendChild(li);
        });
    }

    clearRagBtn.addEventListener("click", async () => {
        logTerminal("system", "[SYSTEM] Requesting complete index wipe...");
        try {
            const res = await fetch("/api/clear-rag", { method: "POST" });
            if (res.status === 200) {
                logTerminal("success", "[SYSTEM] RAG Index vector store completely purged.");
                checkServerStatus();
            }
        } catch (e) {
            logTerminal("error", `[SYSTEM] Purple-alert failed to clear index: ${e.message}`);
        }
    });

    // --- Terminal Helper ---
    function logTerminal(step, message) {
        const p = document.createElement("p");
        p.className = `term-log ${step}-log`;
        p.textContent = message;
        terminalBody.appendChild(p);
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    function updateProgress(step) {
        let percent = 0;
        switch (step) {
            case "planner": percent = 20; break;
            case "searcher": percent = 50; break;
            case "synthesizer": percent = 80; break;
            case "critic": percent = 95; break;
            case "complete": percent = 100; break;
            case "error": percent = 0; break;
        }
        progressBarFill.style.width = `${percent}%`;
    }

    // --- Execute Agent Research Pipeline ---
    runResearchBtn.addEventListener("click", async () => {
        const topic = topicQueryInput.value.trim();
        if (!topic) return;
        
        const provider = providerSelect.value;
        const apiKey = apiKeyInput.value.trim();
        const ollamaUrl = ollamaUrlInput.value.trim();
        const ollamaModel = ollamaModelInput.value.trim();
        const geminiModel = geminiModelSelect.value;
        
        if (provider === "gemini" && !apiKey) {
            alert("Please enter a free Gemini API Key in the settings sidebar.");
            return;
        }

        // Toggle UI states
        runResearchBtn.disabled = true;
        runResearchBtn.style.opacity = "0.7";
        runResearchBtn.querySelector("span").textContent = "Harvesting...";
        
        agentMonitor.style.display = "flex";
        terminalBody.innerHTML = "";
        
        // Reset report body to show loading state
        reportActions.style.display = "none";
        reportBody.innerHTML = `
            <div class="empty-state-content" style="padding: 40px 0;">
                <div class="pulse-loader" style="width: 40px; height: 40px; margin-bottom: 20px;"></div>
                <h3>Agents Researching Topic...</h3>
                <p>The Multi-agent planning network is analyzing your query. Live logs are displaying in the agent terminal above.</p>
            </div>
        `;
        
        citationsBody.innerHTML = `
            <div class="empty-citations">
                <p>Retrieval agents are running. Sources will appear here...</p>
            </div>
        `;

        logTerminal("system", `[SYSTEM] Connecting to multi-agent workflow manager via provider: ${provider.toUpperCase()}...`);
        updateProgress("planner");

        const requestBody = {
            topic: topic,
            provider: provider,
            apiKey: provider === "gemini" ? apiKey : null,
            ollamaUrl: provider === "ollama" ? ollamaUrl : null,
            modelName: provider === "gemini" ? geminiModel : ollamaModel
        };

        try {
            const response = await fetch("/api/research", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (response.status !== 200) {
                const err = await response.json();
                throw new Error(err.detail || "Server pipeline error");
            }

            // Read SSE dynamic response stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                // The last line might be incomplete, retain it in the buffer
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.trim().startsWith("data: ")) {
                        const rawData = line.trim().slice(6);
                        try {
                            const data = JSON.parse(rawData);
                            processAgentEvent(data);
                        } catch (e) {
                            console.error("Error parsing SSE JSON data:", e, rawData);
                        }
                    }
                }
            }

        } catch (e) {
            logTerminal("error", `[ERROR] Pipeline aborted: ${e.message}`);
            updateProgress("error");
            
            reportBody.innerHTML = `
                <div class="empty-state-content" style="color: #e74c3c;">
                    <span class="empty-icon">⚠️</span>
                    <h3>Workflow Execution Halted</h3>
                    <p>${e.message}</p>
                    <p style="font-size: 0.8rem; margin-top: 10px; color: var(--text-muted);">Ensure that your Gemini API Key is valid or that local Ollama is running and accessible.</p>
                </div>
            `;
        } finally {
            runResearchBtn.disabled = false;
            runResearchBtn.style.opacity = "1";
            runResearchBtn.querySelector("span").textContent = "Harvest Research";
        }
    });

    function processAgentEvent(event) {
        const step = event.step;
        const msg = event.message;
        
        // Log message to terminal console
        logTerminal(step, msg);
        updateProgress(step);
        
        // Handle completed pipeline state
        if (step === "complete" && event.result) {
            const finalResult = event.result;
            activeResearchMarkdown = finalResult.markdown;
            activeResearchTopic = topicQueryInput.value.trim();
            
            // Show action utility buttons
            reportActions.style.display = "flex";
            
            // Render Report
            reportBody.innerHTML = `<div class="report-content">${renderMarkdown(activeResearchMarkdown)}</div>`;
            
            // Render Sources sidebar
            renderSources(finalResult.sources);
        } else if (step === "error") {
            updateProgress("error");
            reportBody.innerHTML = `
                <div class="empty-state-content" style="color: #e74c3c;">
                    <span class="empty-icon">⚠️</span>
                    <h3>Agent Network Fault</h3>
                    <p>${msg}</p>
                </div>
            `;
        }
    }

    // --- Verified Citations Side panel builder ---
    function renderSources(sources) {
        if (!sources || sources.length === 0) {
            citationsBody.innerHTML = `
                <div class="empty-citations">
                    <p>Research operated entirely on indexed local vector context fragments.</p>
                </div>
            `;
            return;
        }

        citationsBody.innerHTML = "";
        
        // Unique sources check
        const seenUrls = new Set();
        let counter = 1;
        
        sources.forEach(s => {
            if (seenUrls.has(s.url)) return;
            seenUrls.add(s.url);
            
            const card = document.createElement("div");
            card.className = "citation-card";
            
            const title = document.createElement("div");
            title.className = "citation-title";
            title.textContent = `[${counter}] ${s.title}`;
            
            const snippet = document.createElement("div");
            snippet.className = "citation-snippet";
            snippet.textContent = s.snippet || "Scraped document context snippet.";
            
            const link = document.createElement("a");
            link.className = "citation-link";
            link.target = "_blank";
            
            if (s.url === "local_upload") {
                link.href = "#";
                link.textContent = "📁 Local Document RAG Chunk";
                link.addEventListener("click", (e) => e.preventDefault());
            } else {
                link.href = s.url;
                link.textContent = "🔗 Visit Source Website";
            }
            
            card.appendChild(title);
            card.appendChild(snippet);
            card.appendChild(link);
            
            citationsBody.appendChild(card);
            counter++;
        });
    }

    // --- Native Markdown to HTML Custom Parser Engine ---
    function renderMarkdown(md) {
        if (!md) return "";
        let html = md;

        // Escape HTML tags to protect rendering flow
        html = html.replace(/&/g, "&amp;")
                   .replace(/</g, "&lt;")
                   .replace(/>/g, "&gt;");

        // Code block renderer
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code renderer
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

        // Bold and Italic renders
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

        // Blockquotes render
        html = html.replace(/^\s*>\s+(.+)$/gm, "<blockquote>$1</blockquote>");

        // Tables renderer
        // Handles standard Markdown tabular grids cleanly
        html = html.replace(/^\s*\|(.+)\|$/gm, (match, rowContent) => {
            const cells = rowContent.split("|").map(c => c.trim());
            // Skip separators
            if (cells.every(c => /^:-*:$/.test(c) || /^-+$/.test(c) || c === "")) {
                return "";
            }
            const isHeader = cells.every(c => c !== "") && match.includes("th") || html.split("\n").indexOf(match) === 0; // simple header heuristic
            const cellTag = "td"; // standard layout
            
            const cellHtml = cells.map(c => `<${cellTag}>${c}</${cellTag}>`).join("");
            return `<tr>${cellHtml}</tr>`;
        });
        
        // Wrap adjacent table rows in <table> elements
        html = html.replace(/(<tr>[\s\S]*?<\/tr>)+/g, (match) => {
            // Check if first row looks like a header (or can be treated as one)
            let rows = match.trim();
            // Optional: convert first row elements to th tags for design structure
            rows = rows.replace(/^<tr>(<td>(.*?)<\/td>)+<\/tr>/, (headerRow) => {
                return headerRow.replace(/<td>/g, "<th>").replace(/<\/td>/g, "</th>");
            });
            return `<table>${rows}</table>`;
        });

        // Headers renders
        html = html.replace(/^\s*###\s+(.+)$/gm, "<h3>$1</h3>");
        html = html.replace(/^\s*##\s+(.+)$/gm, "<h2>$1</h2>");
        html = html.replace(/^\s*#\s+(.+)$/gm, "<h1>$1</h1>");

        // Unordered lists renderer
        html = html.replace(/^\s*[\-\*]\s+(.+)$/gm, "<li>$1</li>");
        html = html.replace(/(<li>.*<\/li>)+/g, "<ul>$&</ul>");

        // Clean double nested lists wrapping errors
        html = html.replace(/<\/ul>\s*<ul>/g, "");

        // Convert leftover single newlines to paragraphs
        html = html.replace(/^\s*(?!<[a-z/]).+$/gm, "<p>$&</p>");

        return html;
    }

    // --- Export Utilities ---
    copyMarkdownBtn.addEventListener("click", () => {
        if (!activeResearchMarkdown) return;
        navigator.clipboard.writeText(activeResearchMarkdown).then(() => {
            const originalIcon = copyMarkdownBtn.textContent;
            copyMarkdownBtn.textContent = "✅";
            setTimeout(() => {
                copyMarkdownBtn.textContent = originalIcon;
            }, 2000);
        }).catch(err => {
            alert("Failed to copy report: " + err);
        });
    });

    downloadReportBtn.addEventListener("click", () => {
        if (!activeResearchMarkdown) return;
        
        // Create clean document filename from topic
        const cleanName = activeResearchTopic
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "") || "research_report";
            
        const blob = new Blob([activeResearchMarkdown], { type: "text/markdown;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cleanName}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
