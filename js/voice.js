/* =====================================================
   JARVIS PRO - ULTIMATE VOICE SYSTEM (GLOBAL VERSION)
   ===================================================== */
window.voiceChatActive = false;
window.voiceChatListening = false;
window.speakingNow = false;
window.streamDone = false;
window.sentenceQueue = [];
window.fullReplyText = '';
window.currentBuffer = '';

// --- FUNCTIONS KO GLOBAL BANA RAHE HAIN ---

window.openVoiceChat = function() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice chat not supported'); return; }
    window.voiceChatActive = true;
    document.getElementById('voiceOverlay').classList.add('show');
    document.getElementById('voiceStatus').innerText = 'Jarvis is ready...';
    window.voiceChatListenOnce();
};

window.closeVoiceChat = function() {
    window.voiceChatActive = false;
    window.speechSynthesis.cancel();
    if (window.voiceChatRecognizer) { try { window.voiceChatRecognizer.stop(); } catch (e) { } }
    window.voiceChatListening = false;
    document.getElementById('voiceOverlay').classList.remove('show');
};

window.voiceChatToggleListen = function() {
    console.log("Toggle Listen Called");
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        window.speakingNow = false;
        window.sentenceQueue = [];
        window.voiceChatListenOnce();
        return;
    }
    if (window.voiceChatListening) {
        if (window.voiceChatRecognizer) window.voiceChatRecognizer.stop();
        return;
    }
    window.voiceChatListenOnce();
};

window.voiceChatListenOnce = function() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !window.voiceChatActive) return;
    
    window.speechSynthesis.cancel();
    window.voiceChatListening = true;
    window.voiceChatRecognizer = new SR();
    window.voiceChatRecognizer.lang = 'en-IN';
    
    document.getElementById('voiceOrb').className = 'voice-orb-big listening';
    document.getElementById('voiceStatus').innerText = 'Listening...';

    window.voiceChatRecognizer.onresult = function(e) {
        var text = e.results[0][0].transcript;
        document.getElementById('voiceTranscript').innerText = 'You: ' + text;
        window.voiceChatSendAndSpeak(text);
    };

    window.voiceChatRecognizer.onend = function() {
        window.voiceChatListening = false;
        if (window.voiceChatActive && !window.speakingNow) {
            document.getElementById('voiceOrb').className = 'voice-orb-big';
        }
    };
    window.voiceChatRecognizer.start();
};

window.voiceChatSendAndSpeak = async function(text) {
    if (!window.voiceChatActive) return;
    
    window.fullReplyText = ''; window.currentBuffer = '';
    window.sentenceQueue = []; window.speakingNow = false; window.streamDone = false;
    
    document.getElementById('voiceStatus').innerText = 'Thinking...';
    document.getElementById('voiceOrb').className = 'voice-orb-big';

    if (typeof saveAndAppendMessage === 'function') saveAndAppendMessage('user', text);
    var aiMsgId = 'ai-voice-' + Date.now();
    if (typeof appendAiPlaceholder === 'function') appendAiPlaceholder(aiMsgId);

    var payload = window.buildVoicePayload(text);
    
    try {
        const res = await fetch(GROQ_PROXY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: targetAiModel, messages: payload, max_tokens: 500, stream: true })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                window.streamDone = true;
                if (window.currentBuffer.trim()) window.enqueueSentence(window.currentBuffer);
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
                            window.fullReplyText += piece;
                            window.currentBuffer += piece;
                            let m = window.currentBuffer.match(/^(.*?[.!?।\n,])\s+/);
                            if (m) {
                                window.enqueueSentence(m[1]);
                                window.currentBuffer = window.currentBuffer.slice(m[0].length);
                            }
                        }
                    } catch (e) { }
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
};

window.enqueueSentence = function(s) {
    s = s.trim();
    if (!s || s.length < 2) return;
    window.sentenceQueue.push(s);
    if (!window.speakingNow) window.speakNextFromQueue();
};

window.speakNextFromQueue = function() {
    if (window.sentenceQueue.length === 0 || !window.voiceChatActive) {
        window.speakingNow = false;
        if (window.streamDone) setTimeout(() => { if(window.voiceChatActive) window.voiceChatListenOnce(); }, 250);
        return;
    }
    
    window.speakingNow = true;
    var chunk = window.sentenceQueue.shift();
    document.getElementById('voiceTranscript').innerText = 'Jarvis: ' + chunk;
    document.getElementById('voiceStatus').innerText = 'Speaking...';
    document.getElementById('voiceOrb').className = 'voice-orb-big speaking';
    
    var utter = new SpeechSynthesisUtterance(window.cleanForSpeech(chunk));
    utter.rate = 1.0;
    utter.lang = 'en-IN';
    
    utter.onend = () => {
        window.speakNextFromQueue();
    };
    window.speechSynthesis.speak(utter);
};

window.cleanForSpeech = function(text) {
    return text.replace(/[*#`_]/g, '').trim();
};

window.buildVoicePayload = function(text) {
    var sys = "This is a spoken voice conversation. Answer in natural sentences only. Be brief.";
    return [{ role: 'system', content: sys }, { role: 'user', content: text }];
};

console.log("Jarvis Global Voice System Loaded!");
   
