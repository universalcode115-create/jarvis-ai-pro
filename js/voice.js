/* =====================================================
   ADVANCED VOICE CHAT (CHATGPT STYLE)
   ===================================================== */
var voiceChatRecognizer = null, voiceChatActive = false, voiceChatListening = false;
var interruptWatcher = null, speakingNow = false, streamDone = false;
var sentenceQueue = [];
var fullReplyText = '', currentBuffer = '';

function openVoiceChat() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Voice chat not supported in this browser'); return; }
    voiceChatActive = true;
    document.getElementById('voiceOverlay').classList.add('show');
    document.getElementById('voiceStatus').innerText = 'Jarvis is ready. Start talking...';
    document.getElementById('voiceOrb').className = 'voice-orb-big';
    voiceChatListenOnce(); // Start listening automatically
}

function closeVoiceChat() {
    voiceChatActive = false;
    window.speechSynthesis.cancel();
    stopInterruptWatcher();
    if (voiceChatRecognizer) { try { voiceChatRecognizer.stop(); } catch (e) { } }
    voiceChatListening = false;
    document.getElementById('voiceOverlay').classList.remove('show');
}

function voiceChatListenOnce() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !voiceChatActive) return;
    window.speechSynthesis.cancel();
    voiceChatListening = true;
    voiceChatRecognizer = new SR();
    voiceChatRecognizer.lang = 'en-IN'; // Aap ise 'hi-IN' bhi kar sakte hain Hindi ke liye
    voiceChatRecognizer.interimResults = false;
    
    document.getElementById('voiceOrb').className = 'voice-orb-big listening';
    document.getElementById('voiceStatus').innerText = 'Listening...';

    voiceChatRecognizer.onresult = function(e) {
        var text = e.results[0][0].transcript;
        document.getElementById('voiceTranscript').innerText = 'You: ' + text;
        voiceChatSendAndSpeak(text);
    };

    voiceChatRecognizer.onerror = function() {
        if(voiceChatActive) document.getElementById('voiceStatus').innerText = 'Tap to speak...';
    };

    voiceChatRecognizer.onend = function() {
        voiceChatListening = false;
        if(voiceChatActive && !speakingNow) document.getElementById('voiceOrb').className = 'voice-orb-big';
    };
    voiceChatRecognizer.start();
}

function voiceChatSendAndSpeak(text) {
    if (!voiceChatActive) return;
    document.getElementById('voiceStatus').innerText = 'Thinking...';
    document.getElementById('voiceOrb').className = 'voice-orb-big';
    
    saveAndAppendMessage('user', text);
    var id = 'ai-voice-' + Date.now();
    appendAiPlaceholder(id);

    fullReplyText = ''; currentBuffer = '';
    sentenceQueue = []; speakingNow = false; streamDone = false;

    var payload = buildVoicePayload(text);
    
    fetch(GROQ_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: targetAiModel, messages: payload, max_tokens: 500, stream: true })
    })
    .then(async (res) => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                streamDone = true;
                if (currentBuffer.trim()) enqueueSentence(currentBuffer);
                break;
            }
            
            let chunk = decoder.decode(value, { stream: true });
            let lines = chunk.split('\n');
            for (let line of lines) {
                if (line.startsWith('data: ')) {
                    let jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') continue;
                    try {
                        let obj = JSON.parse(jsonStr);
                        let piece = obj.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (piece) {
                            fullReplyText += piece;
                            currentBuffer += piece;
                            // Faster splitting: Detect end of thought
                            let match = currentBuffer.match(/^(.*?[.!?।\n,])\s+/);
                            if (match) {
                                enqueueSentence(match[1]);
                                currentBuffer = currentBuffer.slice(match[0].length);
                            }
                        }
                    } catch (e) { }
                }
            }
        }
        // Update chat UI at the end
        var el = document.getElementById(id);
        if(el) el.querySelector('.msg-body').innerHTML = renderMarkdown(fullReplyText);
    })
    .catch(err => {
        console.error(err);
        speakText("I'm having trouble connecting right now.");
    });
}

function enqueueSentence(s) {
    s = s.trim();
    if (!s || s.length < 2) return;
    sentenceQueue.push(s);
    if (!speakingNow) speakNextFromQueue();
}

function speakNextFromQueue() {
    if (sentenceQueue.length === 0 || !voiceChatActive) {
        speakingNow = false;
        if (streamDone) setTimeout(() => { if(voiceChatActive) voiceChatListenOnce(); }, 200);
        return;
    }

    speakingNow = true;
    let textToSpeak = sentenceQueue.shift();
    let cleanText = cleanForSpeech(textToSpeak);
    
    document.getElementById('voiceStatus').innerText = 'Jarvis is speaking...';
    document.getElementById('voiceOrb').className = 'voice-orb-big speaking';

    let utter = new SpeechSynthesisUtterance(cleanText);
    utter.rate = 1.0; 
    utter.pitch = 1.0;
    utter.lang = detectSpeechLang(cleanText);
    
    utter.onstart = () => { startInterruptWatcher(); };
    utter.onend = () => {
        stopInterruptWatcher();
        speakNextFromQueue();
    };

    window.speechSynthesis.speak(utter);
}

function startInterruptWatcher() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
        interruptWatcher = new SR();
        interruptWatcher.continuous = true;
        interruptWatcher.interimResults = true;
        interruptWatcher.onresult = function(e) {
            let heard = e.results[e.results.length - 1][0].transcript.trim();
            if (heard.split(' ').length >= 2) { // User spoke at least 2 words
                window.speechSynthesis.cancel();
                sentenceQueue = [];
                speakingNow = false;
                stopInterruptWatcher();
                voiceChatListenOnce(); // Start listening to user again
            }
        };
        interruptWatcher.start();
    } catch (e) { }
}

function stopInterruptWatcher() {
    if (interruptWatcher) { try { interruptWatcher.stop(); } catch (e) { } interruptWatcher = null; }
       }
function voiceChatToggleListen() {
    // Agar Jarvis bol raha hai, toh use chup karao aur sunna shuru karo
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        speakingNow = false;
        sentenceQueue = [];
        voiceChatListenOnce();
        return;
    }
    // Agar pehle se sun raha hai, toh stop karo
    if (voiceChatListening) {
        if (voiceChatRecognizer) voiceChatRecognizer.stop();
        return;
    }
    // Varna sunna shuru karo
    voiceChatListenOnce();
}
