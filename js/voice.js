/* =====================================================
   JARVIS PRO - ULTIMATE VOICE SYSTEM (COMPLETE voice.js)
   ===================================================== */
console.log("Jarvis Voice System Loading...");

// --- GLOBAL VARIABLES ---
var recognizer = null, isListening = false;
var voiceChatRecognizer = null, voiceChatActive = false, voiceChatListening = false;
var interruptWatcher = null, speakingNow = false, streamDone = false;
var sentenceQueue = [];
var fullReplyText = '', currentBuffer = '';

// --- SAFE HELPERS (Agar dusri files mein na hon toh error nahi aayega) ---
if (typeof showToast !== 'function') window.showToast = function(m) { console.log("Toast:", m); };

/* =====================================================
   1. MAIN CHAT VOICE INPUT
   ===================================================== */
function startVoiceInput() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Voice input not supported'); return; }
    if (isListening) { if (recognizer) recognizer.stop(); return; }
    
    recognizer = new SR();
    recognizer.lang = 'en-IN';
    recognizer.interimResults = false;
    isListening = true;
    
    if(document.getElementById('micBtn')) document.getElementById('micBtn').classList.add('mic-active');
    showToast('Listening...');
    
    recognizer.onresult = function(e) {
        var text = e.results[0][0].transcript;
        if(document.getElementById('appInputBox')) document.getElementById('appInputBox').value = text;
    };
    recognizer.onend = function() { 
        isListening = false; 
        if(document.getElementById('micBtn')) document.getElementById('micBtn').classList.remove('mic-active'); 
    };
    recognizer.start();
}

/* =====================================================
   2. LIVE VOICE CHAT MODE (CHATGPT STYLE)
   ===================================================== */
function openVoiceChat() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Voice chat needs speech recognition'); return; }
    
    voiceChatActive = true;
    document.getElementById('voiceOverlay').classList.add('show');
    document.getElementById('voiceStatus').innerText = 'Jarvis is ready. Start talking...';
    document.getElementById('voiceTranscript').innerText = '';
    document.getElementById('voiceOrb').className = 'voice-orb-big';
    
    voiceChatListenOnce();
}

function closeVoiceChat() {
    voiceChatActive = false;
    window.speechSynthesis.cancel();
    stopInterruptWatcher();
    if (voiceChatRecognizer) { try { voiceChatRecognizer.stop(); } catch (e) { } }
    voiceChatListening = false;
    document.getElementById('voiceOverlay').classList.remove('show');
}

function voiceChatToggleListen() {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        speakingNow = false;
        sentenceQueue = [];
        voiceChatListenOnce();
        return;
    }
    if (voiceChatListening) {
        if (voiceChatRecognizer) voiceChatRecognizer.stop();
        return;
    }
    voiceChatListenOnce();
}

function voiceChatListenOnce() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !voiceChatActive) return;
    
    window.speechSynthesis.cancel();
    voiceChatListening = true;
    voiceChatRecognizer = new SR();
    voiceChatRecognizer.lang = 'en-IN';
    voiceChatRecognizer.interimResults = false;
    
    document.getElementById('voiceOrb').className = 'voice-orb-big listening';
    document.getElementById('voiceStatus').innerText = 'Listening...';
    if (document.getElementById('voiceMicIcon')) document.getElementById('voiceMicIcon').className = 'fa-solid fa-stop';

    voiceChatRecognizer.onresult = function(e) {
        var text = e.results[0][0].transcript;
        document.getElementById('voiceTranscript').innerText = 'You: ' + text;
        voiceChatSendAndSpeak(text);
    };
    
    voiceChatRecognizer.onend = function() {
        voiceChatListening = false;
        if (document.getElementById('voiceMicIcon')) document.getElementById('voiceMicIcon').className = 'fa-solid fa-microphone';
        if (voiceChatActive && !speakingNow) document.getElementById('voiceOrb').className = 'voice-orb-big';
    };
    
    voiceChatRecognizer.start();
}

async function voiceChatSendAndSpeak(text) {
    if (!voiceChatActive) return;
    
    // Reset state
    fullReplyText = ''; currentBuffer = '';
    sentenceQueue = []; speakingNow = false; streamDone = false;
    
    document.getElementById('voiceStatus').innerText = 'Thinking...';
    document.getElementById('voiceOrb').className = 'voice-orb-big';

    // 1. Image Check
    if (typeof detectImagePrompt === 'function') {
        var imagePrompt = detectImagePrompt(text);
        if (imagePrompt) {
            var id = 'ai-voice-' + Date.now();
            if(typeof appendAiPlaceholder === 'function') appendAiPlaceholder(id);
            if(typeof handleImageGeneration === 'function') handleImageGeneration(imagePrompt, id);
            speakSimpleText("I am creating that image for you.");
            return;
        }
    }

    // 2. Normal Chat
    if(typeof saveAndAppendMessage === 'function') saveAndAppendMessage('user', text);
    var aiMsgId = 'ai-voice-' + Date.now();
    if(typeof appendAiPlaceholder === 'function') appendAiPlaceholder(aiMsgId);

    var payload = buildVoicePayload(text);
    
    try {
        const res = await fetch(GROQ_PROXY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: targetAiModel, messages: payload, max_tokens: 500, stream: true })
        });

        if (!res.body || !res.ok) throw new Error('Stream failed');
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
                            let m = currentBuffer.match(/^(.*?[.!?।\n,])\s+/);
                            if (m) {
                                enqueueSentence(m[1]);
                                currentBuffer = currentBuffer.slice(m[0].length);
                            }
                        }
                    } catch (e) { }
                }
            }
        }
        
        // Final UI Update
        var el = document.getElementById(aiMsgId);
        if (el && typeof renderMarkdown === 'function') {
            el.querySelector('.msg-body').innerHTML = renderMarkdown(fullReplyText);
        }
    } catch (err) {
        console.error(err);
        speakSimpleText("Sorry, I'm having trouble connecting.");
    }
}

function speakSimpleText(text) {
    if (!voiceChatActive) return;
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(text);
    utter.onend = function() { if (voiceChatActive) voiceChatListenOnce(); };
    window.speechSynthesis.speak(utter);
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
        if (streamDone) setTimeout(function() { if (voiceChatActive) voiceChatListenOnce(); }, 250);
        return;
    }
    
    speakingNow = true;
    var chunk = sentenceQueue.shift();
    document.getElementById('voiceTranscript').innerText = 'Jarvis: ' + chunk;
    document.getElementById('voiceStatus').innerText = 'Speaking...';
    document.getElementById('voiceOrb').className = 'voice-orb-big speaking';
    
    var utter = new SpeechSynthesisUtterance(cleanForSpeech(chunk));
    utter.rate = 1.0;
    utter.lang = (typeof detectSpeechLang === 'function') ? detectSpeechLang(chunk) : 'en-IN';
    
    if (typeof pickVoiceForGender === 'function') {
        var vch = pickVoiceForGender(utter.lang);
        if (vch) utter.voice = vch;
    }

    utter.onstart = function() { startInterruptWatcher(); };
    utter.onend = function() {
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
        interruptWatcher.lang = 'en-IN';
        interruptWatcher.continuous = true;
        interruptWatcher.interimResults = true;
        interruptWatcher.onresult = function(e) {
            var heard = e.results[e.results.length - 1][0].transcript.trim();
            if (heard.split(/\s+/).length >= 2) { 
                window.speechSynthesis.cancel();
                sentenceQueue = [];
                speakingNow = false;
                stopInterruptWatcher();
                voiceChatListenOnce();
            }
        };
        interruptWatcher.start();
    } catch (e) { }
}

function stopInterruptWatcher() {
    if (interruptWatcher) { try { interruptWatcher.stop(); } catch (e) { } interruptWatcher = null; }
}

function cleanForSpeech(text) {
    return text
        .replace(/\*\*\*(.*?)\*\*\*/g, '$1').replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1').replace(/__(.*?)__/g, '$1')
        .replace(/_(.*?)_/g, '$1').replace(/`{1,3}[^`]*`{1,3}/g, function(m) { return m.replace(/`/g, ''); })
        .replace(/^#{1,6}\s+/gm, '').replace(/^[-*•]\s+/gm, '').replace(/^\d+\.\s+/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ')
        .replace(/\s{2,}/g, ' ').trim();
}

function buildVoicePayload(latestUserText) {
    var base = (typeof buildConversationPayload === 'function') ? buildConversationPayload(latestUserText) : [{ role: 'user', content: latestUserText }];
    var sys = "This is a spoken voice conversation. Answer in natural sentences only. No markdown. Be brief.";
    if (base[0].role === 'system') base[0].content += " " + sys;
    else base.unshift({ role: 'system', content: sys });
    return base;
                                  }
                 
