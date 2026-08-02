/* =====================================================
   JARVIS AI - COMPLETE VOICE SYSTEM (voice.js)
   Features: Smart TTS, Live Text Stream, Hindi/English Auto-detect
   ===================================================== */

// API Endpoint (Agar aap direct Groq use kar rahe hain toh yahan URL set karein)
var CHAT_PROXY_URL = (typeof GROQ_PROXY_URL !== 'undefined') ? GROQ_PROXY_URL : 'https://api.groq.com/openai/v1/chat/completions';
// Note: Direct Groq API use karne ke liye aapko headers me Authorization: 'Bearer YOUR_API_KEY' dena padta hai. 
// Agar aapka apna backend proxy hai, toh wahi URL rehne dein.

/* -----------------------------------------------------
   GLOBAL STATE
   ----------------------------------------------------- */
window.recognizer = window.recognizer || null;
window.isListening = window.isListening || false;

window.voiceChatRecognizer = window.voiceChatRecognizer || null;
window.voiceChatActive = window.voiceChatActive || false;
window.voiceChatListening = window.voiceChatListening || false;

// Variables for Smart TTS & Streaming
window.utterances = window.utterances || []; // Chrome Bug Fix (Voice rukne se rokne ke liye)
var sentenceQueue = [];
var isSpeaking = false;
var streamDone = false;
var fullReplyText = '';
var silenceTimer = null;
var pendingRender = false;
var availableVoices = [];

/* -----------------------------------------------------
   SMART VOICE SELECTION (Natural Voice)
   ----------------------------------------------------- */
function loadVoices() {
  availableVoices = window.speechSynthesis.getVoices();
  if (availableVoices.length === 0) {
    window.speechSynthesis.onvoiceschanged = function() {
      availableVoices = window.speechSynthesis.getVoices();
    };
  }
}
loadVoices(); // Call on start

function getBestVoice(lang) {
  if (!availableVoices || availableVoices.length === 0) {
    availableVoices = window.speechSynthesis.getVoices();
  }
  
  var voices = availableVoices;
  var preferred = [];
  
  if (lang === 'hi-IN') {
    preferred = ['Google हिन्दी', 'Microsoft Swara', 'Microsoft Hemant', 'Lekha', 'Google Hindi', 'hi-IN'];
  } else {
    preferred = ['Google US English', 'Google UK English Male', 'Microsoft David', 'Microsoft Zira', 'Samantha', 'en-US', 'en-IN'];
  }
  
  for (var i = 0; i < preferred.length; i++) {
    for (var j = 0; j < voices.length; j++) {
      if (voices[j].name.indexOf(preferred[i]) !== -1 || voices[j].lang.indexOf(preferred[i]) !== -1) {
        return voices[j];
      }
    }
  }
  
  var fallback = voices.find(function(v) { return v.lang && v.lang.indexOf(lang.split('-')[0]) !== -1; });
  return fallback || voices[0];
}

function hasHindiText(text) {
  return /[\u0900-\u097F]/.test(text); // Checks if text contains Devanagari
}

function cleanForSpeech(text) {
  return text.replace(/[*#`_\[\]\(\)]/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/* =====================================================
   VOICE INPUT (Main Chat Mic)
   ===================================================== */
function startVoiceInput() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { if (typeof showToast === 'function') showToast('Mic not supported'); return; }

  if (window.isListening) {
    if (window.recognizer) { try { window.recognizer.abort(); } catch(e) {} }
    window.isListening = false;
    return;
  }
  
  window.recognizer = new SR();
  window.recognizer.lang = 'hi-IN'; // Better for Hinglish/Hindi
  window.recognizer.interimResults = true;
  window.isListening = true;
  
  var micBtn = document.getElementById('micBtn');
  if (micBtn) micBtn.classList.add('mic-active');
  
  window.recognizer.onresult = function(e) {
    var text = e.results[0][0].transcript;
    var input = document.getElementById('appInputBox');
    if (input) input.value = text;
  };
  
  window.recognizer.onerror = function(e) { window.isListening = false; if (micBtn) micBtn.classList.remove('mic-active'); };
  window.recognizer.onend = function() { window.isListening = false; if (micBtn) micBtn.classList.remove('mic-active'); };
  
  try { window.recognizer.start(); } catch(e) { window.isListening = false; }
}

/* =====================================================
   VOICE CHAT MODE (Jarvis Interface)
   ===================================================== */
function openVoiceChat() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { if (typeof showToast === 'function') showToast('Speech not supported'); return; }
  
  window.voiceChatActive = true;
  document.getElementById('voiceOverlay').classList.add('show');
  document.getElementById('voiceStatus').innerText = 'Jarvis is listening...';
  document.getElementById('voiceTranscript').innerText = '';
  
  var orb = document.getElementById('voiceOrb');
  if (orb) orb.className = 'voice-orb-big';
  
  voiceChatListenOnce();
}

function closeVoiceChat() {
  clearTimeout(silenceTimer);
  window.voiceChatActive = false;
  window.speechSynthesis.cancel();
  
  if (window.voiceChatRecognizer) {
    try { window.voiceChatRecognizer.abort(); } catch(e) {}
    window.voiceChatRecognizer = null;
  }
  window.voiceChatListening = false;
  isSpeaking = false;
  sentenceQueue = [];
  
  document.getElementById('voiceOverlay').classList.remove('show');
}

function voiceChatToggleListen() {
  if (window.speechSynthesis.speaking || isSpeaking) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    sentenceQueue = [];
    voiceChatListenOnce();
    return;
  }
  voiceChatListenOnce();
}

function voiceChatListenOnce() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || !window.voiceChatActive) return;
  
  clearTimeout(silenceTimer);
  if (window.voiceChatRecognizer) { try { window.voiceChatRecognizer.abort(); } catch(e) {} }
  window.speechSynthesis.cancel();
  isSpeaking = false;
  
  window.voiceChatRecognizer = new SR();
  window.voiceChatRecognizer.lang = 'hi-IN';
  window.voiceChatRecognizer.interimResults = true;
  window.voiceChatListening = true;
  
  var orb = document.getElementById('voiceOrb');
  var status = document.getElementById('voiceStatus');
  var transcript = document.getElementById('voiceTranscript');
  
  if (orb) orb.className = 'voice-orb-big listening';
  if (status) status.innerText = 'Listening...';
  
  silenceTimer = setTimeout(function() {
    if (window.voiceChatListening && !isSpeaking) {
      if (window.voiceChatRecognizer) window.voiceChatRecognizer.abort();
      if (status) status.innerText = 'Tap to try again';
    }
  }, 8000);
  
  window.voiceChatRecognizer.onresult = function(e) {
    var result = e.results[e.results.length - 1];
    var text = result[0].transcript;
    if (transcript) transcript.innerText = 'You: ' + text;
    
    if (result.isFinal) {
      clearTimeout(silenceTimer);
      voiceChatSendAndSpeak(text);
    }
  };
  
  window.voiceChatRecognizer.onerror = function(e) {
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
       if (status) status.innerText = 'Error: ' + e.error;
    }
  };
  
  window.voiceChatRecognizer.onend = function() {
    window.voiceChatListening = false;
    if (window.voiceChatActive && !isSpeaking && orb) {
      orb.className = 'voice-orb-big';
    }
  };
  
  try { window.voiceChatRecognizer.start(); } catch(e) {}
}

/* =====================================================
   NATURAL TEXT TO SPEECH ENGINE (Jarvis Voice)
   ===================================================== */
function speakChunk(text) {
  if (!text || !window.voiceChatActive) return;
  
  var cleanText = cleanForSpeech(text);
  if (!cleanText) {
     if (sentenceQueue.length > 0) speakChunk(sentenceQueue.shift());
     return;
  }
  
  var lang = hasHindiText(cleanText) ? 'hi-IN' : 'en-IN';
  var utter = new SpeechSynthesisUtterance(cleanText);
  utter.voice = getBestVoice(lang);
  utter.lang = lang;
  utter.rate = 1.0; 
  utter.pitch = 1.0;

  window.utterances.push(utter); // Chrome Garbage Collection Bug Fix
  
  var status = document.getElementById('voiceStatus');
  var orb = document.getElementById('voiceOrb');
  
  utter.onstart = function() {
    isSpeaking = true;
    if (status) status.innerText = 'Speaking...';
    if (orb) orb.className = 'voice-orb-big speaking';
  };
  
  utter.onend = function() {
    isSpeaking = false;
    window.utterances = window.utterances.filter(function(u) { return u !== utter; }); // Memory Cleanup

    if (sentenceQueue.length > 0) {
      speakChunk(sentenceQueue.shift());
    } else if (streamDone) {
      if (orb) orb.className = 'voice-orb-big';
      if (status) status.innerText = 'Listening...';
      setTimeout(function() { if (window.voiceChatActive) voiceChatListenOnce(); }, 400);
    }
  };
  
  utter.onerror = function(e) {
    isSpeaking = false;
    if (sentenceQueue.length > 0) speakChunk(sentenceQueue.shift());
  };
  
  window.speechSynthesis.speak(utter);
}

function enqueueSentence(text) {
  text = text.trim();
  if (!text) return;
  if (!isSpeaking) speakChunk(text);
  else sentenceQueue.push(text);
}

/* =====================================================
   MAIN: SEND TO API -> STREAM TEXT -> SPEAK LIVE
   ===================================================== */
function voiceChatSendAndSpeak(text) {
  if (!window.voiceChatActive) return;
  
  var status = document.getElementById('voiceStatus');
  var orb = document.getElementById('voiceOrb');
  if (status) status.innerText = 'Thinking...';
  if (orb) orb.className = 'voice-orb-big';
  
  if (typeof saveAndAppendMessage === 'function') saveAndAppendMessage('user', text);
  var id = 'ai-voice-' + Date.now();
  if (typeof appendAiPlaceholder === 'function') appendAiPlaceholder(id);
  
  sentenceQueue = [];
  isSpeaking = false;
  streamDone = false;
  fullReplyText = '';
  
  // NOTE: Adjust headers if using direct Groq vs Custom Proxy
  var fetchHeaders = { "Content-Type": "application/json" };
  if (typeof GROQ_API_KEY !== 'undefined') {
      fetchHeaders["Authorization"] = "Bearer " + GROQ_API_KEY; 
  }

  fetch(CHAT_PROXY_URL, {
    method: "POST",
    headers: fetchHeaders,
    body: JSON.stringify({
      model: (typeof targetAiModel !== 'undefined' ? targetAiModel : "llama-3.3-70b-versatile"),
      messages: typeof buildConversationPayload === 'function' ? buildConversationPayload(text) : [{role: "user", content: text}],
      stream: true
    })
  })
  .then(function(res) {
    if (!res.ok) throw new Error('API ' + res.status);
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    
    function pump() {
      return reader.read().then(function(result) {
        if (result.done) {
          streamDone = true;
          if (buffer.trim()) enqueueSentence(buffer);
          return;
        }
        
        var chunk = decoder.decode(result.value, { stream: true });
        var lines = chunk.split('\n');
        
        lines.forEach(function(line) {
          var trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data:')) return;
          
          var dataStr = trimmedLine.slice(5).trim();
          if (dataStr === '[DONE]') { streamDone = true; return; }
          
          try {
            var data = JSON.parse(dataStr);
            var piece = '';
            
            // Handles both OpenAI format (choices[0].delta) and Gemini format (candidates[0])
            if (data.choices && data.choices[0].delta) piece = data.choices[0].delta.content || '';
            else if (data.candidates && data.candidates[0].content) piece = data.candidates[0].content.parts[0].text || '';
            
            if (piece) {
              fullReplyText += piece;
              buffer += piece;
              
              // LIVE UI UPDATE FIX - Screen pe live type hoga
              if (!pendingRender) {
                pendingRender = true;
                requestAnimationFrame(function() {
                  var aiEl = document.getElementById(id);
                  if (aiEl && typeof renderMarkdown === 'function') {
                    aiEl.querySelector('.msg-body').innerHTML = renderMarkdown(fullReplyText);
                  }
                  pendingRender = false;
                });
              }
              
              // Smart Sentence Break
              var m = buffer.match(/^(.*?[.!?।\n])\s+/);
              if (m) {
                enqueueSentence(m[1]);
                buffer = buffer.slice(m[0].length);
              }
            }
          } catch(e) {} // Ignore parse errors for partial JSON chunks
        });
        
        return pump();
      });
    }
    return pump();
  })
  .catch(function(err) {
    console.error('Chat error:', err);
    if (status) status.innerText = 'Network error. Try again.';
    var errUtter = new SpeechSynthesisUtterance("Connection lost. Please try again.");
    errUtter.lang = 'en-IN';
    window.speechSynthesis.speak(errUtter);
  });
}
