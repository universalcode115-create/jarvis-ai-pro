/* =====================================================
   GLOBAL STATE FOR VOICE
   ===================================================== */
// Point 1 & 2: Defining missing global variables
if (typeof recognizer === 'undefined') var recognizer = null;
if (typeof isListening === 'undefined') var isListening = false;
if (typeof voiceChatRecognizer === 'undefined') var voiceChatRecognizer = null;
if (typeof voiceChatActive === 'undefined') var voiceChatActive = false;
if (typeof voiceChatListening === 'undefined') var voiceChatListening = false;

var speakingNow = false;
var sentenceQueue = [];
var fullReplyText = '';
var streamDone = false;

/* =====================================================
   VOICE INPUT (Main Chat Mic)
   ===================================================== */
function startVoiceInput(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ 
    if(typeof showToast === 'function') showToast('Voice input not supported'); 
    return; 
  }

  // Point 3: Use abort() and reset state properly
  if(isListening){ 
    if(recognizer) {
      try { recognizer.abort(); } catch(e) {}
    }
    isListening = false;
    document.getElementById('micBtn').classList.remove('mic-active');
    return; 
  }
  
  recognizer = new SR();
  // Point 8: Better language support
  recognizer.lang = 'en-IN'; 
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  isListening = true;
  
  var micBtn = document.getElementById('micBtn');
  if(micBtn) micBtn.classList.add('mic-active');
  if(typeof showToast === 'function') showToast('Listening...');

  recognizer.onresult = function(e){
    var text = e.results[0][0].transcript;
    var input = document.getElementById('appInputBox');
    if(input) input.value = text;
  };

  // Point 7: Detailed Error Logging
  recognizer.onerror = function(e){ 
    console.error("Speech Recognition Error:", e.error);
    if(e.error === 'not-allowed') showToast('Mic permission denied');
    else if(typeof showToast === 'function') showToast('Could not hear you'); 
  };

  recognizer.onend = function(){ 
    isListening = false; 
    if(micBtn) micBtn.classList.remove('mic-active'); 
  };
  
  try {
    recognizer.start();
  } catch(e) {
    console.error("Start Error:", e);
    isListening = false;
  }
}

/* =====================================================
   VOICE CHAT MODE — continuous spoken back-and-forth
   ===================================================== */
function openVoiceChat(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ 
    if(typeof showToast === 'function') showToast('Speech not supported'); 
    return; 
  }
  voiceChatActive = true;
  var overlay = document.getElementById('voiceOverlay');
  if(overlay) overlay.classList.add('show');
  
  var status = document.getElementById('voiceStatus');
  if(status) status.innerText = 'Jarvis is ready. Start talking...';
  
  var transcript = document.getElementById('voiceTranscript');
  if(transcript) transcript.innerText = '';
  
  var orb = document.getElementById('voiceOrb');
  if(orb) orb.className = 'voice-orb-big';
  
  // Point 4: Triggered by user click (openVoiceChat is called by button)
  voiceChatListenOnce();
}

function closeVoiceChat(){
  voiceChatActive = false;
  window.speechSynthesis.cancel();
  // Point 5: Abort existing recognizer
  if(voiceChatRecognizer){ 
    try{ voiceChatRecognizer.abort(); }catch(e){} 
    voiceChatRecognizer = null;
  }
  voiceChatListening = false;
  var overlay = document.getElementById('voiceOverlay');
  if(overlay) overlay.classList.remove('show');
}

function voiceChatToggleListen(){
  if(window.speechSynthesis && window.speechSynthesis.speaking){
    window.speechSynthesis.cancel();
    voiceChatListenOnce();
    return;
  }
  if(voiceChatListening){
    if(voiceChatRecognizer) {
      try { voiceChatRecognizer.abort(); } catch(e) {}
    }
    return;
  }
  voiceChatListenOnce();
}

function voiceChatListenOnce(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR || !voiceChatActive) return;

  // Point 5: Abort existing before creating new
  if(voiceChatRecognizer) {
    try { voiceChatRecognizer.abort(); } catch(e) {}
  }

  window.speechSynthesis.cancel();
  voiceChatRecognizer = new SR();
  voiceChatRecognizer.lang = 'en-IN';
  voiceChatRecognizer.interimResults = false;
  voiceChatRecognizer.maxAlternatives = 1;
  voiceChatListening = true;
  
  var orb = document.getElementById('voiceOrb');
  if(orb) orb.className = 'voice-orb-big listening';
  
  var status = document.getElementById('voiceStatus');
  if(status) status.innerText = 'Listening...';
  
  var micIcon = document.getElementById('voiceMicIcon');
  if(micIcon) micIcon.className = 'fa-solid fa-stop';

  voiceChatRecognizer.onresult = function(e){
    var text = e.results[0][0].transcript;
    var transcript = document.getElementById('voiceTranscript');
    if(transcript) transcript.innerText = 'You: ' + text;
    voiceChatSendAndSpeak(text);
  };

  voiceChatRecognizer.onerror = function(e){
    console.error("Voice Chat Error:", e.error);
    if(voiceChatActive && status) status.innerText = 'Tap the mic to try again';
  };

  voiceChatRecognizer.onend = function(){
    voiceChatListening = false;
    if(micIcon) micIcon.className = 'fa-solid fa-microphone';
    if(voiceChatActive && !speakingNow && orb){
      orb.className = 'voice-orb-big';
    }
  };

  try {
    voiceChatRecognizer.start();
  } catch(e) {
    console.error("Voice Chat Start Error:", e);
  }
}

function cleanForSpeech(text){
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, function(m){ return m.replace(/`/g,''); })
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildVoicePayload(latestUserText){
  if(typeof buildConversationPayload !== 'function') return [{role:'user', content:latestUserText}];
  var base = buildConversationPayload(latestUserText);
  base[0] = { 
    role:'system', 
    content: base[0].content + " This is a LIVE voice conversation. Answer in natural, clear spoken sentences. No markdown. Be very brief (2-3 sentences)." 
  };
  return base;
}

function voiceChatSendAndSpeak(text){
  if(!voiceChatActive) return;
  var status = document.getElementById('voiceStatus');
  var orb = document.getElementById('voiceOrb');
  var transcript = document.getElementById('voiceTranscript');
  
  if(status) status.innerText = 'Thinking...';
  if(orb) orb.className = 'voice-orb-big';

  if(typeof saveAndAppendMessage === 'function') saveAndAppendMessage('user', text);
  var id = 'ai-voice-' + Date.now();
  if(typeof appendAiPlaceholder === 'function') appendAiPlaceholder(id);

  function speakReply(reply){
    var el = document.getElementById(id);
    if(el){
      var body = el.querySelector('.msg-body');
      if(body && typeof renderMarkdown === 'function') body.innerHTML = renderMarkdown(reply);
      el.setAttribute('data-raw', encodeURIComponent(reply));
      if(typeof messageToolsHtml === 'function'){
        var toolsWrap = document.createElement('div');
        toolsWrap.innerHTML = messageToolsHtml(id);
        el.appendChild(toolsWrap.firstChild);
      }
    }
    if(typeof activeChatMessages !== 'undefined') {
      activeChatMessages.push({sender:'ai', text:reply});
      localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
    }

    if(!voiceChatActive) return;
    var spoken = cleanForSpeech(reply);
    if(transcript) transcript.innerText = 'Jarvis: ' + spoken;
    if(status) status.innerText = 'Speaking...';
    if(orb) orb.className = 'voice-orb-big speaking';
    
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(spoken);
    utter.rate = 1.0;
    if(typeof detectSpeechLang === 'function') utter.lang = detectSpeechLang(spoken);
    
    // Point 6: Start listening ONLY after speech is done
    utter.onend = function(){
      speakingNow = false;
      if(!voiceChatActive) return;
      if(orb) orb.className = 'voice-orb-big';
      if(status) status.innerText = 'Listening...';
      setTimeout(function(){ 
        if(voiceChatActive && !speakingNow) voiceChatListenOnce(); 
      }, 300);
    };
    
    speakingNow = true;
    window.speechSynthesis.speak(utter);
  }

  var imagePrompt = (typeof detectImagePrompt === 'function') ? detectImagePrompt(text) : null;
  if(imagePrompt){
    if(typeof handleImageGeneration === 'function') handleImageGeneration(imagePrompt, id);
    speakReply("I'm creating that image for you now.");
    return;
  }

  var payload = buildVoicePayload(text);
  sentenceQueue = [];
  speakingNow = false;
  fullReplyText = '';
  streamDone = false;

  var interruptWatcher = null;
  function startInterruptWatcher(){
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) return;
    try{
      interruptWatcher = new SR();
      interruptWatcher.lang = 'en-IN';
      interruptWatcher.continuous = true;
      interruptWatcher.interimResults = true;
      interruptWatcher.onresult = function(e){
        var res = e.results[e.results.length-1];
        var heard = (res && res[0] && res[0].transcript || '').trim();
        if(heard.split(/\s+/).length >= 2){
          stopInterruptWatcher();
          window.speechSynthesis.cancel();
          speakingNow = false;
          sentenceQueue.length = 0;
          voiceChatListenOnce();
        }
      };
      interruptWatcher.start();
    }catch(e){ interruptWatcher = null; }
  }
  function stopInterruptWatcher(){
    if(interruptWatcher){ try{ interruptWatcher.abort(); }catch(e){} interruptWatcher = null; }
  }

  function trySpeakNextChunk(){
    if(speakingNow || sentenceQueue.length===0 || !voiceChatActive) return;
    
    var chunk = sentenceQueue.shift();
    if(transcript) transcript.innerText = 'Jarvis: ' + chunk;
    if(status) status.innerText = 'Speaking...';
    if(orb) orb.className = 'voice-orb-big speaking';
    
    var utter = new SpeechSynthesisUtterance(cleanForSpeech(chunk));
    utter.rate = 1.0;
    if(typeof detectSpeechLang === 'function') utter.lang = detectSpeechLang(chunk);
    
    utter.onend = function(){
      stopInterruptWatcher();
      speakingNow = false;
      if(sentenceQueue.length){ 
        trySpeakNextChunk(); 
      } else if(streamDone){
        if(!voiceChatActive) return;
        if(orb) orb.className = 'voice-orb-big';
        if(status) status.innerText = 'Listening...';
        setTimeout(function(){ if(voiceChatActive && !speakingNow) voiceChatListenOnce(); }, 300);
      }
    };
    
    speakingNow = true;
    window.speechSynthesis.speak(utter);
    startInterruptWatcher();
  }

  var proxyUrl = (typeof GROQ_PROXY_URL !== 'undefined') ? GROQ_PROXY_URL : '';
  if(!proxyUrl){
    speakReply("Jarvis is not configured yet.");
    return;
  }

  fetch(proxyUrl, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ 
      model: (typeof targetAiModel !== 'undefined' ? targetAiModel : "llama-3.3-70b-versatile"), 
      messages: payload, 
      max_tokens: 400, 
      stream:true 
    })
  })
  .then(function(res){
    if(!res.body || !res.ok) throw new Error('no-stream');
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var raw = '';
    
    function enqueueSentence(s){
      s = s.trim();
      if(!s) return;
      sentenceQueue.push(s);
      trySpeakNextChunk();
    }

    function pump(){
      return reader.read().then(function(result){
        if(result.done){
          streamDone = true;
          if(buffer.trim()) enqueueSentence(buffer);
          if(!fullReplyText.trim()) speakReply("Sorry, I couldn't generate a reply.");
          return;
        }
        raw += decoder.decode(result.value, {stream:true});
        var lines = raw.split('\n');
        raw = lines.pop();
        lines.forEach(function(line){
          line = line.trim();
          if(line.indexOf('data:') !== 0) return;
          var jsonStr = line.slice(5).trim();
          if(!jsonStr || jsonStr === '[DONE]') return;
          try{
            var obj = JSON.parse(jsonStr);
            var piece = obj.candidates && obj.candidates[0] && obj.candidates[0].content && obj.candidates[0].content.parts && obj.candidates[0].content.parts[0] && obj.candidates[0].content.parts[0].text;
            if(piece){
              fullReplyText += piece;
              buffer += piece;
              var m = buffer.match(/^(.*?[.!?।\n,])\s+/);
              if(m){
                enqueueSentence(m[1]);
                buffer = buffer.slice(m[0].length);
              }
            }
          }catch(e){}
        });
        return pump();
      });
    }
    return pump();
  })
  .catch(function(err){
    console.error("Fetch Error:", err);
    speakReply("Connection lost. Please try again.");
  });
     }
                  
