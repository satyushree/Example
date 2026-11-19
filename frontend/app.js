// WebSocket & App state variables
let socket = null;
let reconnectTimer = null;
let currentPendingActionId = null;
let recognition = null;
let isRecording = false;
let isHandsFreeMode = true;
let isAgentListening = true;
let isAgentSpeaking = false;
let isAgentThinking = false;
let wakeWord = "Krishna";
let sleepCommand = "stop listening";
let lastSpokenText = "";
let lastSpeechEndTime = 0;

// Pre-load voices for speech synthesis
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

// DOM Elements
const clockEl = document.getElementById("clock");
const modelIndicatorEl = document.getElementById("active-model");
const listeningStateEl = document.getElementById("listening-state");
const cpuPercentEl = document.getElementById("cpu-percent");
const cpuBarEl = document.getElementById("cpu-bar");
const ramUsageEl = document.getElementById("ram-usage");
const ramBarEl = document.getElementById("ram-bar");
const batteryPercentEl = document.getElementById("battery-percent");
const batteryBarEl = document.getElementById("battery-bar");
const powerSourceEl = document.getElementById("power-source");
const chatViewportEl = document.getElementById("chat-viewport");
const textInputEl = document.getElementById("text-input");
const sendBtnEl = document.getElementById("send-btn");
const voiceBtnEl = document.getElementById("voice-btn");
const terminalBodyEl = document.getElementById("terminal-body");
const krishnaAvatarEl = document.getElementById("krishna-avatar");
const handsfreeSwitchEl = document.getElementById("handsfree-switch");
const voiceWaveBarsEl = document.getElementById("voice-wave-bars");

// Confirmation Modal Elements
const confirmModalEl = document.getElementById("confirmation-modal");
const modalActionNameEl = document.getElementById("modal-action-name");
const modalPermissionLevelEl = document.getElementById("modal-permission-level");
const modalActionParamsEl = document.getElementById("modal-action-params");
const modalApproveEl = document.getElementById("modal-approve");
const modalDenyEl = document.getElementById("modal-deny");

// 1. Initialize clock updates
function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toTimeString().split(' ')[0];
}
setInterval(updateClock, 1000);
updateClock();

// 2. Initialize WebSocket Connection
function connectWebSocket() {
    logTerminal("SYS", "Establishing WebSocket connection to core database...");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host || "127.0.0.1:8000";
    const wsUrl = `${protocol}//${host}/ws`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        logTerminal("SYS", "WebSocket protocol connection established successfully.");
        document.getElementById("feed-status").textContent = "ONLINE";
        document.getElementById("feed-status").className = "cyan-glow";
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (isHandsFreeMode) {
            startContinuousListening();
        }
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleIncomingPacket(data);
        } catch (e) {
            console.error("Error decoding message packet: ", e);
        }
    };

    socket.onclose = () => {
        logTerminal("SYS", "Connection to backend core severed. Attempting retry in 3 seconds...");
        document.getElementById("feed-status").textContent = "OFFLINE";
        document.getElementById("feed-status").className = "text-red";
        
        // Remove typing indicator if any
        removeTypingIndicator();
        
        // Auto-reconnect
        if (!reconnectTimer) {
            reconnectTimer = setTimeout(connectWebSocket, 3000);
        }
    };

    socket.onerror = (err) => {
        console.error("WebSocket connection failure: ", err);
    };
}

// 3. Handle Incoming Server Packets
function handleIncomingPacket(packet) {
    const { type, data } = packet;

    if (type === "stats") {
        // System telemetry update
        updateSystemMetrics(data);
    } 
    else if (type === "greeting") {
        // Startup briefing greeting
        addChatMessage("ai", data.response);
        if (data.wake_word) wakeWord = data.wake_word;
        if (data.sleep_command) sleepCommand = data.sleep_command;
        updateModelAndListening(data.provider, data.listening);
    } 
    else if (type === "response") {
        isAgentThinking = false;
        removeTypingIndicator();
        // Standard conversational/command response
        addChatMessage("ai", data.response);
        updateModelAndListening(data.provider, data.listening);
        
        // Handle visual emotional reactive change
        setAvatarEmotion(data.emotion);
        
        // Check if action was gated and requires permission validation
        if (data.action_status === "pending" && data.pending_id) {
            triggerActionConfirmation(data.pending_id, data.action, data.response);
        }
        
        logTerminal("AGENT", `Response processed via ${data.provider}. Active action: ${data.action || 'none'}`);
        
        // If in hands-free mode, resume listening after typing completes
        if (isHandsFreeMode && !isAgentSpeaking) {
            startContinuousListening();
        }
    }
    else if (type === "typing") {
        showTypingIndicator();
    }
    else if (type === "alert") {
        logTerminal("WARN", `ALERT: ${data.message}`);
        addChatMessage("system", `ALERT: ${data.message}`);
    }
    else if (type === "speak") {
        speakText(data.text);
    }
}

// 4. Update UI Components
function updateSystemMetrics(metrics) {
    const cpu = Math.round(metrics.cpu_percent);
    const ram = Math.round(metrics.ram_percent);
    
    cpuPercentEl.textContent = `${cpu}%`;
    cpuBarEl.style.width = `${cpu}%`;
    
    ramUsageEl.textContent = `${metrics.ram_used_gb} GB / ${metrics.ram_total_gb} GB`;
    ramBarEl.style.width = `${ram}%`;
    
    if (metrics.battery) {
        const batt = metrics.battery.percent;
        const plugged = metrics.battery.power_plugged;
        
        batteryPercentEl.textContent = `${batt}%`;
        batteryBarEl.style.width = `${batt}%`;
        powerSourceEl.textContent = plugged ? "AC Power Connected (Charging)" : "Discharging (Battery Mode)";
        
        if (batt <= 20 && !plugged) {
            batteryBarEl.className = "progress-bar-fill fill-red";
        } else {
            batteryBarEl.className = "progress-bar-fill fill-green";
        }
    } else {
        batteryPercentEl.textContent = "N/A";
        batteryBarEl.style.width = "100%";
        powerSourceEl.textContent = "Desktop Station Connected";
    }
}

function updateModelAndListening(provider, listening) {
    if (provider) {
        modelIndicatorEl.textContent = provider;
    }
    
    isAgentListening = listening;
    
    if (listening) {
        listeningStateEl.textContent = "Krishna (Active)";
        listeningStateEl.className = "value glow-green";
    } else {
        listeningStateEl.textContent = "stop listening (Sleeping)";
        listeningStateEl.className = "value text-red";
    }
}

function setAvatarEmotion(emotion) {
    // Reset classes
    krishnaAvatarEl.style.borderColor = "var(--neon-cyan)";
    krishnaAvatarEl.style.boxShadow = "0 0 25px rgba(0, 243, 255, 0.4)";
    
    if (emotion === "happy") {
        krishnaAvatarEl.style.borderColor = "var(--neon-green)";
        krishnaAvatarEl.style.boxShadow = "0 0 35px rgba(16, 185, 129, 0.6)";
    } else if (emotion === "alert") {
        krishnaAvatarEl.style.borderColor = "var(--neon-red)";
        krishnaAvatarEl.style.boxShadow = "0 0 35px rgba(239, 68, 68, 0.6)";
    } else if (emotion === "excited") {
        krishnaAvatarEl.style.borderColor = "var(--neon-purple)";
        krishnaAvatarEl.style.boxShadow = "0 0 35px rgba(168, 85, 247, 0.6)";
    }
}

// 5. Send Prompt Commands
function sendPrompt() {
    const text = textInputEl.value.trim();
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;

    // Add user message to UI chat log
    addChatMessage("user", text);
    logTerminal("USER", `Dispatched prompt request: "${text}"`);

    isAgentThinking = true;
    if (recognition) {
        recognition.stop();
    }

    // Pitch evaluation simulation for Voice Authentication
    const voice_metrics = {
        pitch: 125.0,  // Simulation within owner threshold (90-160Hz)
        confidence: 0.96
    };

    socket.send(JSON.stringify({
        type: "prompt",
        data: text,
        voice_metrics: voice_metrics
    }));

    textInputEl.value = "";
}

// 6. Action Confirmation Logic
function triggerActionConfirmation(actionId, actionName, explanationText) {
    currentPendingActionId = actionId;
    modalActionNameEl.textContent = actionName;
    
    // Classify danger tier
    let tier = "Admin";
    modalPermissionLevelEl.className = "m-val text-cyan";
    if (["shutdown_pc", "restart_pc", "delete_file"].includes(actionName)) {
        tier = "Critical";
        modalPermissionLevelEl.className = "m-val text-red";
    }
    
    modalPermissionLevelEl.textContent = tier;
    
    // Populate parameters simulation
    let params = {};
    if (actionName === "shutdown_pc") params = { delay_seconds: 10 };
    else if (actionName === "whatsapp_plugin") params = { contact: "Rahul", message: "Hello sir" };
    else if (actionName === "file_operation") params = { op: "delete", src: "d:/Krishna/temp.txt" };
    else params = { details: "Automation action triggered" };
    
    modalActionParamsEl.textContent = JSON.stringify(params, null, 2);
    confirmModalEl.classList.add("active");
}

function resolveConfirmation(approved) {
    if (!currentPendingActionId || !socket || socket.readyState !== WebSocket.OPEN) return;
    
    confirmModalEl.classList.remove("active");
    logTerminal("SYS", `Dispatched permission confirmation response. Approve status: ${approved}`);
    
    socket.send(JSON.stringify({
        type: "confirmation",
        action_id: currentPendingActionId,
        approved: approved
    }));
    
    currentPendingActionId = null;
}

// 7. Interactive Logging & Chat Viewport
function addChatMessage(sender, text) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${sender}-msg`;
    
    if (sender === "user") {
        msgDiv.innerHTML = `<span class="prefix">SIR:</span> ${text}`;
    } else if (sender === "ai") {
        // Strip emotion tags for UI display cleanliness
        const cleanText = text.replace(/\[EMOTION:\s*\w+\]/gi, '').trim();
        msgDiv.innerHTML = `<span class="prefix">KRISHNA:</span> ${cleanText}`;
    } else {
        msgDiv.textContent = text;
    }
    
    chatViewportEl.appendChild(msgDiv);
    chatViewportEl.scrollTop = chatViewportEl.scrollHeight;
}

function showTypingIndicator() {
    removeTypingIndicator(); // remove duplicate
    const indicator = document.createElement("div");
    indicator.id = "typing-indicator";
    indicator.className = "message ai-msg";
    indicator.innerHTML = `<span class="prefix">KRISHNA:</span> <span class="pulse-dot"></span> Thinking...`;
    chatViewportEl.appendChild(indicator);
    chatViewportEl.scrollTop = chatViewportEl.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById("typing-indicator");
    if (indicator) indicator.remove();
}

function logTerminal(source, message) {
    const time = new Date().toISOString().split('T')[1].substring(0, 8);
    const line = document.createElement("p");
    line.className = "log-line";
    
    let colorClass = "text-dim";
    if (source === "SYS") colorClass = "cyan-glow";
    else if (source === "WARN") colorClass = "text-red";
    else if (source === "USER") colorClass = "text-main";
    
    line.innerHTML = `[${time}] [<span class="${colorClass}">${source}</span>] ${message}`;
    terminalBodyEl.appendChild(line);
    terminalBodyEl.scrollTop = terminalBodyEl.scrollHeight;
}

// Synthesize electronic high-tech chimes using Web Audio API
function playChime(type) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === "wake") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } else if (type === "sleep") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
            osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.15); // C5
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } else if (type === "listening") {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.04, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        } else if (type === "success") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        }
    } catch (e) {
        console.warn("Web Audio API not allowed or blocked: ", e);
    }
}

// Speak response utilizing Browser-native Speech Synthesis (with feedback loop avoidance)
function speakText(text) {
    if (!('speechSynthesis' in window)) {
        logTerminal("SYS", "SpeechSynthesis not supported on this browser.");
        return;
    }
    
    // Stop ongoing speech
    window.speechSynthesis.cancel();
    
    const cleanText = text.replace(/\[EMOTION:\s*\w+\]/gi, '').trim();
    if (!cleanText) return;
    
    lastSpokenText = cleanText.toLowerCase();
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-IN"; // Accent matching out-of-the-box
    
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural")));
    if (voice) {
        utterance.voice = voice;
    }
    
    utterance.onstart = () => {
        isAgentSpeaking = true;
        if (voiceWaveBarsEl) {
            voiceWaveBarsEl.classList.remove("active");
            voiceWaveBarsEl.classList.add("speaking");
        }
    };
    
    utterance.onend = () => {
        isAgentSpeaking = false;
        lastSpeechEndTime = Date.now();
        if (voiceWaveBarsEl) {
            voiceWaveBarsEl.classList.remove("speaking");
        }
        if (isHandsFreeMode && !isAgentThinking) {
            if (recognition) {
                recognition.abort();
            } else {
                startContinuousListening();
            }
        }
    };
    
    utterance.onerror = (e) => {
        console.error("Speech Synthesis error: ", e);
        isAgentSpeaking = false;
        lastSpeechEndTime = Date.now();
        if (voiceWaveBarsEl) {
            voiceWaveBarsEl.classList.remove("speaking");
        }
        if (isHandsFreeMode && !isAgentThinking) {
            if (recognition) {
                recognition.abort();
            } else {
                startContinuousListening();
            }
        }
    };
    
    window.speechSynthesis.speak(utterance);
}

function startContinuousListening() {
    if (!recognition) {
        setupSpeechRecognition();
    }
    if (!recognition) return;
    
    if (isAgentThinking) return;
    
    try {
        recognition.start();
    } catch (e) {
        // Recognition already active
    }
}

function stopContinuousListening() {
    if (recognition) {
        recognition.stop();
    }
}

// 8. Local Voice Input (Speech Recognition)
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        logTerminal("SYS", "Browser SpeechRecognition API not supported. Use typed input.");
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = false; // restarts robustly via onend for segments
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    
    recognition.onstart = () => {
        isRecording = true;
        voiceBtnEl.classList.add("active-record");
        textInputEl.placeholder = isHandsFreeMode ? "Continuous Listening..." : "Listening...";
        if (voiceWaveBarsEl) {
            voiceWaveBarsEl.classList.add("active");
        }
        playChime("listening");
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        const transcriptLower = transcript.toLowerCase();
        logTerminal("SYS", `Voice Command Captured: "${transcript}"`);
        
        // Anti-Acoustic Feedback Loop: Filter out microphone echo of synthesized speaker voice
        const timeSinceSpeech = Date.now() - lastSpeechEndTime;
        if (lastSpokenText && timeSinceSpeech < 2500) {
            const words = transcriptLower.split(/\s+/).filter(w => w.length > 2);
            if (words.length > 0) {
                const matchedWords = words.filter(word => lastSpokenText.includes(word));
                const matchRatio = matchedWords.length / words.length;
                if (matchRatio >= 0.6) {
                    logTerminal("SYS", `Acoustic feedback loop detected and blocked (overlap: ${Math.round(matchRatio * 100)}%).`);
                    return;
                }
            }
        }
        
        // A. Handle voice interruption when agent is speaking
        if (isAgentSpeaking) {
            const interruptKeywords = ["stop", "quiet", "hush", "shut up", "hold on", "wait", "krishna"];
            let matchedInterrupt = interruptKeywords.some(kw => transcriptLower.includes(kw));
            if (matchedInterrupt) {
                window.speechSynthesis.cancel();
                isAgentSpeaking = false;
                logTerminal("SYS", `Speaking interrupted by voice command: "${transcript}"`);
                playChime("sleep");
                
                // Extract subsequent command if any
                let cleanedText = transcript;
                interruptKeywords.forEach(kw => {
                    cleanedText = cleanedText.replace(new RegExp("\\b" + kw + "\\b", "gi"), "");
                });
                cleanedText = cleanedText.replace(/^[,\s.?!]+|[,\s.?!]+$/g, "").trim();
                
                if (cleanedText) {
                    textInputEl.value = cleanedText;
                    sendPrompt();
                } else {
                    startContinuousListening();
                }
                return;
            } else {
                // Ignore agent speech feedback loop
                logTerminal("SYS", `Ignored voice input during active speaking: "${transcript}"`);
                return;
            }
        }
        
        // B. Handle voice confirmation modal
        if (currentPendingActionId !== null) {
            const approveKeywords = ["yes", "approve", "confirm", "go ahead", "do it", "ok", "okay"];
            const denyKeywords = ["no", "cancel", "deny", "abort", "stop", "reject"];
            
            let matchedApprove = approveKeywords.some(kw => transcriptLower.includes(kw));
            let matchedDeny = denyKeywords.some(kw => transcriptLower.includes(kw));
            
            if (matchedApprove) {
                logTerminal("USER", "Action APPROVED via Voice Command.");
                playChime("success");
                resolveConfirmation(true);
                return;
            } else if (matchedDeny) {
                logTerminal("USER", "Action APPROVED/DENIED as Cancelled via Voice Command.");
                playChime("sleep");
                resolveConfirmation(false);
                return;
            }
        }
        
        // C. Handle wake/sleep logic if Voice Control Mode is active
        if (isHandsFreeMode) {
            if (transcriptLower.includes(sleepCommand.toLowerCase())) {
                playChime("sleep");
                textInputEl.value = transcript;
                sendPrompt();
                return;
            }
            
            if (!isAgentListening) {
                if (transcriptLower.includes(wakeWord.toLowerCase())) {
                    playChime("wake");
                    textInputEl.value = transcript;
                    sendPrompt();
                } else {
                    logTerminal("SYS", `Ignoring input. Agent is asleep. Say "${wakeWord}" to activate.`);
                }
                return;
            }
        }
        
        // D. Standard path
        textInputEl.value = transcript;
        sendPrompt();
    };
    
    recognition.onerror = (e) => {
        if (e.error !== "no-speech") {
            console.error("Speech recognition error: ", e);
            logTerminal("WARN", `Speech recognition error: ${e.error}`);
        }
        stopRecording();
    };
    
    recognition.onend = () => {
        stopRecording();
        if (isHandsFreeMode && !isAgentThinking) {
            setTimeout(() => {
                if (isHandsFreeMode && !isAgentThinking) {
                    startContinuousListening();
                }
            }, 300);
        }
    };
}

function toggleRecording() {
    // Voice control mode is always on, so clicking the mic button ensures continuous listening is active
    if (isHandsFreeMode) {
        startContinuousListening();
    }
}

function stopRecording() {
    isRecording = false;
    voiceBtnEl.classList.remove("active-record");
    textInputEl.placeholder = isHandsFreeMode ? "Voice Control Active..." : "Type a command or say 'Krishna'...";
    if (voiceWaveBarsEl) {
        voiceWaveBarsEl.classList.remove("active");
    }
}

// 9. Attach Event Listeners
sendBtnEl.addEventListener("click", sendPrompt);
textInputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendPrompt();
});
voiceBtnEl.addEventListener("click", toggleRecording);

modalApproveEl.addEventListener("click", () => resolveConfirmation(true));
modalDenyEl.addEventListener("click", () => resolveConfirmation(false));

// Interruption listeners (Click visual core or Esc key)
if (krishnaAvatarEl) {
    krishnaAvatarEl.addEventListener("click", () => {
        if (isAgentSpeaking) {
            window.speechSynthesis.cancel();
            isAgentSpeaking = false;
            lastSpeechEndTime = Date.now();
            logTerminal("SYS", "Speaking interrupted by user click on visual core.");
            playChime("sleep");
            if (recognition) {
                recognition.abort();
            } else {
                startContinuousListening();
            }
        }
    });
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (isAgentSpeaking) {
            window.speechSynthesis.cancel();
            isAgentSpeaking = false;
            lastSpeechEndTime = Date.now();
            logTerminal("SYS", "Speaking interrupted by Escape keypress.");
            playChime("sleep");
            if (recognition) {
                recognition.abort();
            } else {
                startContinuousListening();
            }
        }
    }
});

if (handsfreeSwitchEl) {
    // Enforce voice control mode is always true
    handsfreeSwitchEl.checked = true;
    handsfreeSwitchEl.disabled = true;
    handsfreeSwitchEl.addEventListener("change", (e) => {
        handsfreeSwitchEl.checked = true;
        isHandsFreeMode = true;
        startContinuousListening();
    });
}

// Quick Add task integration
const newTaskInput = document.getElementById("new-task-input");
const addTaskBtn = document.getElementById("add-task-btn");
const taskListEl = document.getElementById("task-list");

addTaskBtn.addEventListener("click", () => {
    const taskText = newTaskInput.value.trim();
    if (!taskText) return;
    
    const taskDiv = document.createElement("div");
    taskDiv.className = "task-item";
    const rndId = "task-" + Math.floor(Math.random() * 10000);
    taskDiv.innerHTML = `
        <input type="checkbox" id="${rndId}">
        <label for="${rndId}">${taskText}</label>
    `;
    taskListEl.appendChild(taskDiv);
    
    // Attempt to log tasks in memory
    logTerminal("SYS", `Added schedule item: ${taskText}`);
    newTaskInput.value = "";
});

// Boot connections
connectWebSocket();

// Enforce default hands-free check state and start listening on page load
if (handsfreeSwitchEl) {
    handsfreeSwitchEl.checked = true;
    handsfreeSwitchEl.disabled = true;
}
isHandsFreeMode = true;
setTimeout(() => {
    startContinuousListening();
}, 500);
