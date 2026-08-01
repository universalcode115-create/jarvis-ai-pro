/* =====================================================
   GLOBAL STATE - Using window object for absolute scope
   ===================================================== */
window.recognizer = window.recognizer || null;
window.isListening = window.isListening || false;
window.voiceChatRecognizer = window.voiceChatRecognizer || null;
window.voiceChatActive = window.voiceChatActive || false;
window.voiceChatListening = window.voiceChatListening || false;

var speakingNow = false;
var sentenceQueue = [];
var fullReplyText = '';
var streamDone = false;
var silenceTimer = null;

/* =====================================================
   HELPERS: VOICE & TEXT
   ===================================================== */

// सही हिंदी आवाज़ ढूँढने के लिए
function getHindiVoice() {
    var voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang === 'hi-IN') || voices.find(v => v.lang.includes('hi'));
}

// Markdown हटाना ताकि AI साफ़ बोले
function cleanForSpeech(text) {
    return text.replace(/[*#`_]/g, '').replace(/\n/g, ' ').trim();
}

/* =====================================================
   VOICE INPUT (Main Chat Mic)
   ===================================================== */
function startVoiceInput() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { if (typeof showToast === 'function') showToast('Mic not supported'); return; }

    if (window.isListening) {
        if (window.recognizer) { try { window.recognizer.abort(); } catch (e) { } }
        window.isListening = false;
        return;
    }

    window.recognizer = new SR();
    window.recognizer.lang = 'en-IN';
    window.recognizer.interimResults = true;
    window.isListening = true;

    var micBtn = document.getElementById('micBtn');
    if (micBtn) micBtn.classList.add('mic-active');

    window.recognizer.onresult = function (e) {
        var text = e.results[0][0].transcript;
        var input = document.getElementById('appInputBox');
        if (input) input.value = text;
    };

    window.recognizer.onend = function () {
        window.isListening = false;
        if (micBtn) micBtn.classList.remove('mic-active');
    };

    try { window.recognizer.start(); } catch (e) { window.isListening = false; }
}

/* =====================================================
   VOICE CHAT MODE
   ===================================================== */
function openVoiceChat() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { if (typeof showToast === 'function') showToast('Speech not supported'); return; }

    window.voiceChatActive = true;
    document.getElementById('voiceOverlay').classList.add('show');
    document.getElementById('voiceStatus').innerText = 'Say something...';
    document.getElementById('voiceTranscript').innerText = '';
    document.getElementById('voiceOrb').className = 'voice-orb-big';

    voiceChatListenOnce();
}

function closeVoiceChat() {
    window.voiceChatActive = false;
    window.speechSynthesis.cancel();
    if (window.voiceChatRecognizer) {
        try { window.voiceChatRecognizer.abort(); } catch (e) { }
        window.voiceChatRecognizer = null;
    }
    window.voiceChatListening = false;
    document.getElementById('voiceOverlay').classList.remove('show');
}

function voiceChatListenOnce() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !window.voiceChatActive) return;

    if (window.voiceChatRecognizer) { try { window.voiceChatRecognizer.abort(); } catch (e) { } }
    window.speechSynthesis.cancel();

    window.voiceChatRecognizer = new SR();
    window.voiceChatRecognizer.lang = 'hi-IN'; // Default to Hindi listening
    window.voiceChatRecognizer.interimResults = true;
    window.voiceChatListening = true;

    var orb = document.getElementById('voiceOrb');
    var status = document.getElementById('voiceStatus');
    var transcript = document.getElementById('voiceTranscript');

    if (orb) orb.className = 'voice-orb-big listening';
    if (status) status.innerText = 'Listening...';

    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(function () {
        if (window.voiceChatListening && !speakingNow) {
            if (window.voiceChatRecognizer) window.voiceChatRecognizer.abort();
            if (status) status.innerText = 'Tap to try again';
        }
    }, 8000);

    window.recognizer.onresult = function(e){
        var text = e.results[0][0].transcript;
        var input = document.getElementById('appInputBox');
        if(input) input.value = text;
    };
    
    window.voiceChatRecognizer.onresult = function (e) {
        var result = e.results[e.results.length - 1];
        var text = result[0].transcript;
        if (transcript) transcript.innerText = 'You: ' + text;

        if (result.isFinal) {
            clearTimeout(silenceTimer);
            voiceChatSendAndSpeak(text);
        }
    };

    window.voiceChatRecognizer.onend = function () {
        window.voiceChatListening = false;
        if (window.voiceChatActive && !speakingNow && orb) {
            orb.className = 'voice-orb-big';
        }
    };

    try { window.voiceChatRecognizer.start(); } catch (e) { console.error(e); }
}

/* =====================================================
   MAIN AI LOGIC (Streaming + Hindi TTS + UI Update)
   ===================================================== */
function voiceChatSendAndSpeak(text) {
    if (!window.voiceChatActive) return;
    var status = document.getElementById('voiceStatus');
    var orb = document.getElementById('voiceOrb');
    var transcript = document.getElementById('voiceTranscript');

    if (status) status.innerText = 'Thinking...';
    if (orb) orb.className = 'voice-orb-big';

    if (typeof saveAndAppendMessage === 'function') saveAndAppendMessage('user', text);
    var id = 'ai-voice-' + Date.now();
    if (typeof appendAiPlaceholder === 'function') appendAiPlaceholder(id);

    // Reset Stream State
    sentenceQueue = [];
    speakingNow = false;
    fullReplyText = '';
    streamDone = false;

    var proxyUrl = (typeof GROQ_PROXY_URL !== 'undefined') ? GROQ_PROXY_URL : '';
    
    fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: (typeof targetAiModel !== 'undefined' ? targetAiModel : "llama-3.3-70b-versatile"),
            messages: buildConversationPayload(text),
            stream: true
        })
    })
    .then(function (res) {
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        function enqueueSentence(s) {
            s = s.trim(); if (!s) return;
            sentenceQueue.push(s);
            if (!speakingNow) trySpeakNextChunk();
        }

        function trySpeakNextChunk() {
            if (speakingNow || sentenceQueue.length === 0 || !window.voiceChatActive) return;
            
            var chunk = sentenceQueue.shift();
            
            // UI Update: AI Bubble में टेक्स्ट दिखाएँ
            var el = document.getElementById(id);
            if(el && typeof renderMarkdown === 'function'){
                el.querySelector('.msg-body').innerHTML = renderMarkdown(fullReplyText);
            }

            var utter = new SpeechSynthesisUtterance(cleanForSpeech(chunk));
            
            // HINDI VOICE LOGIC
            var hVoice = getHindiVoice();
            if(hVoice) {
                utter.voice = hVoice;
                utter.lang = 'hi-IN';
            } else {
                utter.lang = 'hi-IN';
            }
            
            utter.rate = 1.05;

            utter.onstart = function() {
                speakingNow = true;
                if (orb) orb.className = 'voice-orb-big speaking';
                if (status) status.innerText = 'Speaking...';
                if (transcript) transcript.innerText = 'AI: ' + chunk;
            };

            utter.onend = function () {
                speakingNow = false;
                if (sentenceQueue.length > 0) {
                    trySpeakNextChunk();
                } else if (streamDone) {
                    if (status) status.innerText = 'Listening...';
                    if (orb) orb.className = 'voice-orb-big';
                    setTimeout(function () { if (window.voiceChatActive) voiceChatListenOnce(); }, 400);
                }
            };

            window.speechSynthesis.speak(utter);
        }

        function pump() {
            return reader.read().then(function (result) {
                if (result.done) {
                    streamDone = true;
                    if (buffer.trim()) enqueueSentence(buffer);
                    return;
                }
                var chunk = decoder.decode(result.value, { stream: true });
                var lines = chunk.split('\n');
                lines.forEach(function (line) {
                    line = line.trim();
                    if (!line || !line.startsWith('data:')) return;
                    var jsonStr = line.replace(/^data:\s*/, '');
                    if (jsonStr === '[DONE]') return;

                    try {
                        var data = JSON.parse(jsonStr);
                        // Groq/OpenAI Format: choices[0].delta.content
                        var piece = data.choices[0].delta.content || "";
                        if (piece) {
                            fullReplyText += piece;
                            buffer += piece;
                            // . ! ? या हिंदी पूर्ण विराम । पर वाक्य तोड़ें
                            var m = buffer.match(/^(.*?[.!?।\n])\s+/);
                            if (m) {
                                enqueueSentence(m[1]);
                                buffer = buffer.slice(m[0].length);
                            }
                        }
                    } catch (e) { }
                });
                return pump();
            });
        }
        return pump();
    })
    .catch(function () { 
        if (status) status.innerText = "Connection Error"; 
    });
           }
