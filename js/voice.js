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
var micStream = null; // mic permission ke liye

// Mic permission ek baar lena hai
async function ensureMicPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Permission mil gaya, ab stream ko band kar sakte hai, SpeechRecognition apna mic kholega
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (err) {
    console.error("Mic Permission Denied:", err);
    const status = document.getElementById('voiceStatus');
    if (status) {
      status.innerText = 'Mic Blocked hai! Lock icon pe click karke Allow karo.';
    }
    if (typeof showToast === 'function') showToast('Mic permission Allow karo');
    return false;
  }
}

/* =====================================================
   VOICE INPUT (Main Chat Mic)
   ===================================================== */
async function startVoiceInput(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ if(typeof showToast === 'function') showToast('Mic not supported'); return; }

  if(window.isListening){
    if(window.recognizer) { try { window.recognizer.stop(); } catch(e) {} }
    window.isListening = false;
    return;
  }

  // FIX 1: Pehle permission lo
  const hasPermission = await ensureMicPermission();
  if (!hasPermission) return;

  window.recognizer = new SR();
  window.recognizer.lang = 'en-IN';
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
async function openVoiceChat(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ if(typeof showToast === 'function') showToast('Speech not supported'); return; }

  // FIX 2: Overlay khulte hi permission lo
  const hasPermission = await ensureMicPermission();
  if (!hasPermission) {
    document.getElementById('voiceOverlay').classList.add('show');
    document.getElementById('voiceStatus').innerText = 'Mic permission Blocked hai';
    return;
  }

  window.voiceChatActive = true;
  document.getElementById('voiceOverlay').classList.add('show');
  document.getElementById('voiceStatus').innerText = 'Say something...';
  document.getElementById('voiceTranscript').innerText = '';
  document.getElementById('voiceOrb').className = 'voice-orb-big';

  voiceChatListenOnce();
}

function closeVoiceChat(){
  window.voiceChatActive = false;
  window.speechSynthesis.cancel();
  clearTimeout(silenceTimer);
  if(window.voiceChatRecognizer){
    try{ window.voiceChatRecognizer.stop(); }catch(e){}
    window.voiceChatRecognizer = null;
  }
  window.voiceChatListening = false;
  document.getElementById('voiceOverlay').classList.remove('show');
}

function voiceChatToggleListen(){
  if(window.speechSynthesis && window.speechSynthesis.speaking){
    window.speechSynthesis.cancel();
  }
  voiceChatListenOnce();
}

function voiceChatListenOnce(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR ||!window.voiceChatActive) return;

  if(window.voiceChatRecognizer) { try { window.voiceChatRecognizer.stop(); } catch(e) {} }
  window.speechSynthesis.cancel();

  window.voiceChatRecognizer = new SR();
  window.voiceChatRecognizer.lang = 'en-IN';
  window.voiceChatRecognizer.interimResults = true;
  window.voiceChatListening = true;

  var orb = document.getElementById('voiceOrb');
  var status = document.getElementById('voiceStatus');
  var transcript = document.getElementById('voiceTranscript');

  if(orb) orb.className = 'voice-orb-big listening';
  if(status) status.innerText = 'Listening...';

  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(function(){
    if(window.voiceChatListening &&!speakingNow) {
      try { window.voiceChatRecognizer.stop(); } catch(e){}
    }
  }, 8000);

  window.voiceChatRecognizer.onresult = function(e){
    clearTimeout(silenceTimer);
    var result = e.results[e.results.length - 1];
    var text = result[0].transcript;
    if(transcript) transcript.innerText = 'You: ' + text;

    if(result.isFinal) {
      voiceChatSendAndSpeak(text);
    }
  };

  window.voiceChatRecognizer.onerror = function(e){
    console.error("VoiceChat Error:", e.error);
    window.voiceChatListening = false;
    clearTimeout(silenceTimer);
    if(status){
      if(e.error === 'not-allowed'){
        status.innerText = 'Mic Blocked! Browser settings me Allow karo.';
        if(orb) orb.className = 'voice-orb-big';
      } else if(e.error === 'no-speech') {
        status.innerText = 'Tap to try again';
      } else {
        status.innerText = 'Error: ' + e.error;
      }
    }
  };

  window.voiceChatRecognizer.onend = function(){
    window.voiceChatListening = false;
    clearTimeout(silenceTimer);
    if(window.voiceChatActive &&!speakingNow && orb){
      orb.className = 'voice-orb-big';
      if(status && status.innerText === 'Listening...') {
        status.innerText = 'Tap to try again';
      }
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

  function speakReply(reply){
    var el = document.getElementById(id);
    if(el && typeof renderMarkdown === 'function'){
      el.querySelector('.msg-body').innerHTML = renderMarkdown(reply);
    }

    if(!window.voiceChatActive) return;
    var spoken = cleanForSpeech(reply);
    if(status) status.innerText = 'Speaking...';
    if(orb) orb.className = 'voice-orb-big speaking';

    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(spoken);
    utter.rate = 1.0;

    utter.onend = function(){
      speakingNow = false;
      if(window.voiceChatActive) {
        if(orb) orb.className = 'voice-orb-big';
        if(status) status.innerText = 'Listening...';
        setTimeout(function(){ if(window.voiceChatActive) voiceChatListenOnce(); }, 300);
      }
    };

    speakingNow = true;
    window.speechSynthesis.speak(utter);
  }

  sentenceQueue = [];
  speakingNow = false;
  fullReplyText = '';
  streamDone = false;

  var proxyUrl = (typeof GROQ_PROXY_URL!== 'undefined')? GROQ_PROXY_URL : '';
  fetch(proxyUrl, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      model: (typeof targetAiModel!== 'undefined'? targetAiModel : "llama-3.3-70b-versatile"),
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
      if(speakingNow || sentenceQueue.length === 0 ||!window.voiceChatActive) return;
      var chunk = sentenceQueue.shift();
      var utter = new SpeechSynthesisUtterance(cleanForSpeech(chunk));
      utter.onend = function(){
        speakingNow = false;
        if(sentenceQueue.length > 0) trySpeakNextChunk();
        else if(streamDone) {
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
              var data = JSON.parse(line.slice(5));
              var piece = data.candidates[0].content.parts[0].text;
              if(piece) {
                fullReplyText += piece;
                buffer += piece;
                var m = buffer.match(/^(.*?[.!?।\n,])\s+/);
                if(m){ enqueueSentence(m[1]); buffer = buffer.slice(m[0].length); }
              }
            } catch(e){}
          }
        });
        return pump();
      });
    }
    return pump();
  })
 .catch(function(){ speakReply("Connection lost."); });
}
