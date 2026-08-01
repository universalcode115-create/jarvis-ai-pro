/* =====================================================
   GLOBAL STATE - Using window object for absolute scope
   ===================================================== */
window.recognizer = window.recognizer || null;
window.isListening = window.isListening || false;
window.voiceChatRecognizer = window.voiceChatRecognizer || null;
window.voiceChatActive = window.voiceChatActive || false;
window.voiceChatListening = window.voiceChatListening || false;

// [BUG FIX 3] Chrome TTS Garbage Collection Bug Fix
// Isse lambe text me aawaz achanak rukne ki problem solve hogi
window.utterances = window.utterances || []; 

var speakingNow = false;
var sentenceQueue = [];
var fullReplyText = '';
var streamDone = false;
var silenceTimer = null;

/* =====================================================
   VOICE INPUT (Main Chat Mic)
   ===================================================== */
function startVoiceInput(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ if(typeof showToast === 'function') showToast('Mic not supported'); return; }

  if(window.isListening){ 
    if(window.recognizer) { try { window.recognizer.abort(); } catch(e) {} }
    window.isListening = false;
    return; 
  }
  
  window.recognizer = new SR();
  // [HINDI FIX] Mic language ko 'hi-IN' kiya taaki wo Hindi/Hinglish dono samajh sake
  window.recognizer.lang = 'hi-IN';
  window.recognizer.interimResults = true; 
  window.isListening = true;
  
  var micBtn = document.getElementById('micBtn');
  if(micBtn) micBtn.classList.add('mic-active');

  window.recognizer.onresult = function(e){
    var text = e.results[0][0].transcript;
    var input = document.getElementById('appInputBox');
    if(input) input.value = text;
  };

  window.recognizer.onerror = function(e){
    console.error("Mic Error:", e.error);
    window.isListening = false;
    if(micBtn) micBtn.classList.remove('mic-active');
  };

  window.recognizer.onend = function(){ 
    window.isListening = false; 
    if(micBtn) micBtn.classList.remove('mic-active'); 
  };
  
  try { window.recognizer.start(); } catch(e) { window.isListening = false; }
}

/* =====================================================
   VOICE CHAT MODE
   ===================================================== */
function openVoiceChat(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ if(typeof showToast === 'function') showToast('Speech not supported'); return; }
  
  window.voiceChatActive = true;
  document.getElementById('voiceOverlay').classList.add('show');
  document.getElementById('voiceStatus').innerText = 'Say something...';
  document.getElementById('voiceTranscript').innerText = '';
  var orb = document.getElementById('voiceOrb');
  if(orb) orb.className = 'voice-orb-big';
  
  // Start listening
  voiceChatListenOnce();
}

function closeVoiceChat(){
  window.voiceChatActive = false;
  window.speechSynthesis.cancel();
  if(window.voiceChatRecognizer){ 
    try{ window.voiceChatRecognizer.abort(); }catch(e){} 
    window.voiceChatRecognizer = null;
  }
  window.voiceChatListening = false;
  document.getElementById('voiceOverlay').classList.remove('show');
}

function voiceChatToggleListen(){
  if(window.speechSynthesis && window.speechSynthesis.speaking){
    window.speechSynthesis.cancel();
    voiceChatListenOnce();
    return;
  }
  voiceChatListenOnce();
}

function voiceChatListenOnce(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR || !window.voiceChatActive) return;

  // Cleanup previous
  if(window.voiceChatRecognizer) { try { window.voiceChatRecognizer.abort(); } catch(e) {} }
  window.speechSynthesis.cancel();

  window.voiceChatRecognizer = new SR();
  // [HINDI FIX] Voice chat mic ko bhi 'hi-IN' par set kiya
  window.voiceChatRecognizer.lang = 'hi-IN';
  window.voiceChatRecognizer.interimResults = true; 
  window.voiceChatListening = true;
  
  var orb = document.getElementById('voiceOrb');
  var status = document.getElementById('voiceStatus');
  var transcript = document.getElementById('voiceTranscript');
  
  if(orb) orb.className = 'voice-orb-big listening';
  if(status) status.innerText = 'Listening...';
  
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(function(){
    if(window.voiceChatListening && !speakingNow) {
      if(window.voiceChatRecognizer) window.voiceChatRecognizer.abort();
      if(status) status.innerText = 'Tap to try again';
    }
  }, 8000);

  window.voiceChatRecognizer.onresult = function(e){
    var result = e.results[e.results.length - 1];
    var text = result[0].transcript;
    if(transcript) transcript.innerText = 'You: ' + text;
    
    if(result.isFinal) {
      clearTimeout(silenceTimer);
      voiceChatSendAndSpeak(text);
    }
  };

  window.voiceChatRecognizer.onerror = function(e){
    console.error("VoiceChat Error:", e.error);
    if(e.error !== 'no-speech') {
       if(status) status.innerText = 'Error: ' + e.error;
    }
  };

  window.voiceChatRecognizer.onend = function(){
    window.voiceChatListening = false;
    if(window.voiceChatActive && !speakingNow && orb){
      orb.className = 'voice-orb-big';
    }
  };

  try { window.voiceChatRecognizer.start(); } catch(e) { console.error(e); }
}

function cleanForSpeech(text){
  return text.replace(/[*#`_]/g, '').replace(/\n/g, ' ').trim();
}

function voiceChatSendAndSpeak(text){
  if(!window.voiceChatActive) return;
  var status = document.getElementById('voiceStatus');
  var orb = document.getElementById('voiceOrb');
  
  if(status) status.innerText = 'Thinking...';
  if(orb) orb.className = 'voice-orb-big';

  if(typeof saveAndAppendMessage === 'function') saveAndAppendMessage('user', text);
  var id = 'ai-voice-' + Date.now();
  if(typeof appendAiPlaceholder === 'function') appendAiPlaceholder(id);

  // Stream logic
  sentenceQueue = [];
  speakingNow = false;
  fullReplyText = '';
  streamDone = false;

  var proxyUrl = (typeof GROQ_PROXY_URL !== 'undefined') ? GROQ_PROXY_URL : '';
  fetch(proxyUrl, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ 
      model: (typeof targetAiModel !== 'undefined' ? targetAiModel : "llama-3.3-70b-versatile"), 
      messages: buildConversationPayload(text), 
      stream:true 
    })
  })
  .then(function(res){
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    
    function enqueueSentence(s){
      s = s.trim(); if(!s) return;
      sentenceQueue.push(s);
      if(!speakingNow) trySpeakNextChunk();
    }

    function trySpeakNextChunk(){
      if(speakingNow || sentenceQueue.length === 0 || !window.voiceChatActive) return;
      var chunk = sentenceQueue.shift();
      var cleanText = cleanForSpeech(chunk);
      if(!cleanText) {
         if(sentenceQueue.length > 0) trySpeakNextChunk();
         return;
      }
      
      var utter = new SpeechSynthesisUtterance(cleanText);
      
      // [HINDI FIX] Text language detection logic
      // Agar text me Hindi (Devanagari) ka ek bhi word hai, to Hindi Voice use karega
      // Isse angrejo ki tarah Hindi bolne wali problem theek ho jayegi
      var hasHindi = /[\u0900-\u097F]/.test(cleanText);
      utter.lang = hasHindi ? 'hi-IN' : 'en-IN';
      
      utter.rate = 1.0;
      utter.pitch = 1.0;

      // Chrome garbage collection issue bypass
      window.utterances.push(utter); 

      utter.onstart = function() {
        if(status) status.innerText = 'Speaking...';
        if(orb) orb.className = 'voice-orb-big speaking';
      };

      utter.onend = function(){
        speakingNow = false;
        // Clean up from array after speaking
        window.utterances = window.utterances.filter(function(u) { return u !== utter; }); 
        
        if(sentenceQueue.length > 0) {
            trySpeakNextChunk();
        } else if(streamDone) {
           if(orb) orb.className = 'voice-orb-big';
           if(status) status.innerText = 'Listening...';
           setTimeout(function(){ if(window.voiceChatActive) voiceChatListenOnce(); }, 300);
        }
      };
      speakingNow = true;
      window.speechSynthesis.speak(utter);
    }

    function pump(){
      return reader.read().then(function(result){
        if(result.done){
          streamDone = true;
          if(buffer.trim()) enqueueSentence(buffer);
          return;
        }
        var chunk = decoder.decode(result.value, {stream:true});
        var lines = chunk.split('\n');
        lines.forEach(function(line){
          if(line.startsWith('data:')){
            try {
              var dataStr = line.slice(5).trim();
              if(dataStr === '[DONE]') return; // Handles end stream gracefully
              
              var data = JSON.parse(dataStr);
              var piece = data.candidates && data.candidates[0].content.parts[0].text;
              
              if(piece) {
                fullReplyText += piece;
                buffer += piece;

                // [LIVE UI FIX] AI jab bol raha hoga, tab text real-time me screen par type hoga
                var aiEl = document.getElementById(id);
                if(aiEl && typeof renderMarkdown === 'function'){
                  aiEl.querySelector('.msg-body').innerHTML = renderMarkdown(fullReplyText);
                }

                // Sentence break logic for fast speech mapping
                var m = buffer.match(/^(.*?[.!?।\n,])\s+/);
                if(m){ 
                    enqueueSentence(m[1]); 
                    buffer = buffer.slice(m[0].length); 
                }
              }
            } catch(e){}
          }
        });
        return pump();
      });
    }
    return pump();
  })
  .catch(function(){ 
      var errUtter = new SpeechSynthesisUtterance("Connection lost. Please try again.");
      errUtter.lang = 'en-IN';
      window.speechSynthesis.speak(errUtter);
  });
     }
     
