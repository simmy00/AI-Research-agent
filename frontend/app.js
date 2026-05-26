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

    // --- Toast Notification Helper ---
    function showToast(title, message, type = "success") {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.style.position = "fixed";
            container.style.bottom = "24px";
            container.style.right = "24px";
            container.style.zIndex = "9999";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.gap = "12px";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        // Premium Glassmorphic Styles
        toast.style.background = "rgba(18, 18, 18, 0.85)";
        toast.style.backdropFilter = "blur(12px)";
        toast.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        toast.style.borderRadius = "12px";
        toast.style.padding = "16px 20px";
        toast.style.minWidth = "300px";
        toast.style.maxWidth = "400px";
        toast.style.boxShadow = "0 8px 32px 0 rgba(0, 0, 0, 0.37)";
        toast.style.color = "#ffffff";
        toast.style.fontFamily = "var(--font-outfit), sans-serif";
        toast.style.transform = "translateX(120%)";
        toast.style.transition = "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        
        let borderGlow = "rgba(46, 204, 113, 0.6)"; // success green
        let icon = "✅";
        if (type === "error") {
            borderGlow = "rgba(231, 76, 60, 0.6)";
            icon = "❌";
        } else if (type === "info") {
            borderGlow = "rgba(52, 152, 219, 0.6)";
            icon = "ℹ️";
        }
        toast.style.borderLeft = `4px solid ${borderGlow}`;

        toast.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 1.2rem;">${icon}</span>
                <div style="flex-grow: 1;">
                    <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 4px;">${title}</div>
                    <div style="font-size: 0.75rem; color: #d0d0d0; line-height: 1.4; white-space: pre-line;">${message}</div>
                </div>
                <button class="toast-close" style="background: none; border: none; color: #888; cursor: pointer; font-size: 0.8rem; padding: 0;">✕</button>
            </div>
        `;

        container.appendChild(toast);

        // Slide in
        setTimeout(() => {
            toast.style.transform = "translateX(0)";
        }, 50);

        // Close button handler
        toast.querySelector(".toast-close").addEventListener("click", () => {
            toast.style.transform = "translateX(120%)";
            setTimeout(() => {
                toast.remove();
            }, 400);
        });

        // Auto remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.transform = "translateX(120%)";
                setTimeout(() => {
                    toast.remove();
                }, 400);
            }
        }, 6000);
    }

    async function uploadFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append("file", file);
            
            logTerminal("system", `[SYSTEM] Preparing to upload document context: ${file.name}...`);
            showToast("Indexing Document", `📄 File: ${file.name}\n⚡ Processing text layers...`, "info");
            
            try {
                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData
                });
                
                if (res.status === 200) {
                    const data = await res.json();
                    logTerminal("success", `[SYSTEM] Indexed successfully: ${data.message} (${data.chunks_created} vector chunks generated).`);
                    showToast(
                        "Document Indexed Successfully", 
                        `📄 File: ${file.name}\n🧩 Chunks created: ${data.chunks_created}\n⚡ Embedding completed`, 
                        "success"
                    );
                } else {
                    const err = await res.json();
                    logTerminal("error", `[SYSTEM] Upload failed for ${file.name}: ${err.detail}`);
                    showToast("Upload Failed", `📄 File: ${file.name}\n❌ Error: ${err.detail}`, "error");
                }
            } catch (e) {
                logTerminal("error", `[SYSTEM] Connection error uploading file ${file.name}: ${e.message}`);
                showToast("Connection Error", `📄 File: ${file.name}\n❌ Connection failed.`, "error");
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
        
        filesList.forEach(fileInfo => {
            const li = document.createElement("li");
            li.style.display = "flex";
            li.style.flexDirection = "column";
            li.style.alignItems = "flex-start";
            li.style.gap = "4px";
            li.style.padding = "8px 12px";
            li.style.borderRadius = "8px";
            li.style.background = "rgba(255, 255, 255, 0.03)";
            li.style.border = "1px solid rgba(255, 255, 255, 0.05)";
            li.style.marginBottom = "8px";
            
            const headerDiv = document.createElement("div");
            headerDiv.style.display = "flex";
            headerDiv.style.justifyContent = "space-between";
            headerDiv.style.width = "100%";
            headerDiv.style.alignItems = "center";
            
            const nameSpan = document.createElement("span");
            nameSpan.textContent = fileInfo.filename;
            nameSpan.title = fileInfo.filename;
            nameSpan.style.fontWeight = "500";
            nameSpan.style.fontSize = "0.78rem";
            nameSpan.style.overflow = "hidden";
            nameSpan.style.textOverflow = "ellipsis";
            nameSpan.style.whiteSpace = "nowrap";
            nameSpan.style.maxWidth = "75%";
            
            const badgeSpan = document.createElement("span");
            badgeSpan.textContent = "Indexed";
            badgeSpan.style.color = "var(--accent-teal)";
            badgeSpan.style.fontSize = "0.6rem";
            badgeSpan.style.fontWeight = "700";
            badgeSpan.style.textTransform = "uppercase";
            
            headerDiv.appendChild(nameSpan);
            headerDiv.appendChild(badgeSpan);
            
            const detailsDiv = document.createElement("div");
            detailsDiv.style.display = "flex";
            detailsDiv.style.justifyContent = "space-between";
            detailsDiv.style.width = "100%";
            detailsDiv.style.fontSize = "0.68rem";
            detailsDiv.style.color = "rgba(255, 255, 255, 0.5)";
            
            const chunksSpan = document.createElement("span");
            chunksSpan.textContent = `🧩 Chunks: ${fileInfo.chunks_count}`;
            
            const embSpan = document.createElement("span");
            embSpan.textContent = `⚡ Embedding: Ready`;
            embSpan.style.color = "#3498db";
            
            detailsDiv.appendChild(chunksSpan);
            detailsDiv.appendChild(embSpan);
            
            li.appendChild(headerDiv);
            li.appendChild(detailsDiv);
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

        // Step 1: Extract and protect code blocks before any processing
        const codeBlocks = [];
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `%%CODEBLOCK_${codeBlocks.length}%%`;
            // Escape HTML inside code blocks so they display literally
            const escaped = code.trim()
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            codeBlocks.push(`<pre><code class="language-${lang}">${escaped}</code></pre>`);
            return placeholder;
        });

        // Step 2: Escape inline code and protect it
        const inlineCodes = [];
        html = html.replace(/`([^`]+)`/g, (match, code) => {
            const placeholder = `%%INLINECODE_${inlineCodes.length}%%`;
            const escaped = code
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            inlineCodes.push(`<code>${escaped}</code>`);
            return placeholder;
        });

        // Step 3: Now escape remaining HTML in the document body
        html = html.replace(/&/g, "&amp;")
                   .replace(/</g, "&lt;")
                   .replace(/>/g, "&gt;");

        // Step 4: Markdown transforms (order matters)

        // Bold and Italic
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

        // Blockquotes (now matching &gt; since we escaped >)
        html = html.replace(/^\s*&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>");
        // Merge adjacent blockquotes
        html = html.replace(/<\/blockquote>\n<blockquote>/g, "<br>");

        // Horizontal rules
        html = html.replace(/^\s*[-*_]{3,}\s*$/gm, "<hr>");

        // Headers (must come before paragraph wrapping)
        html = html.replace(/^\s*####\s+(.+)$/gm, "<h4>$1</h4>");
        html = html.replace(/^\s*###\s+(.+)$/gm, "<h3>$1</h3>");
        html = html.replace(/^\s*##\s+(.+)$/gm, "<h2>$1</h2>");
        html = html.replace(/^\s*#\s+(.+)$/gm, "<h1>$1</h1>");

        // Tables: detect pipe-delimited rows
        html = html.replace(/((?:^\s*\|.+\|[ \t]*$\n?)+)/gm, (tableBlock) => {
            const rows = tableBlock.trim().split("\n").filter(r => r.trim());
            if (rows.length < 2) return tableBlock;

            let tableHtml = "<table>";
            let isFirstDataRow = true;

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i].trim();
                // Extract cells between pipes
                const cells = row.replace(/^\||\|$/g, "").split("|").map(c => c.trim());

                // Skip separator rows (e.g., |---|---|)
                if (cells.every(c => /^:?-+:?$/.test(c))) {
                    continue;
                }

                const tag = isFirstDataRow ? "th" : "td";
                tableHtml += "<tr>" + cells.map(c => `<${tag}>${c}</${tag}>`).join("") + "</tr>";
                isFirstDataRow = false;
            }
            tableHtml += "</table>";
            return tableHtml;
        });

        // Ordered lists
        html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, "$1<li>$2</li>");

        // Unordered lists
        html = html.replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>");

        // Wrap adjacent <li> in <ul>
        html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, "<ul>$1</ul>");
        // Clean double-nested list wrappers
        html = html.replace(/<\/ul>\s*<ul>/g, "");

        // Links: [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Paragraphs: wrap lines that aren't already HTML elements
        html = html.replace(/^(?!<[a-z/!]|%%)([ \t]*\S.+)$/gm, "<p>$1</p>");

        // Step 5: Restore protected code blocks and inline codes
        codeBlocks.forEach((block, i) => {
            html = html.replace(`%%CODEBLOCK_${i}%%`, block);
        });
        inlineCodes.forEach((code, i) => {
            html = html.replace(`%%INLINECODE_${i}%%`, code);
        });

        // Clean up excessive empty paragraphs and whitespace
        html = html.replace(/<p>\s*<\/p>/g, "");

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
