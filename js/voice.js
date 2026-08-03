/* =====================================================
   JARVIS PRO - UNIFIED VOICE & CHAT (Manus Style)
   ===================================================== */
window.recognizer = window.recognizer || null;
window.isListening = window.isListening || false;
window.voiceChatActive = window.voiceChatActive || false;
var speakingNow = false;
var sentenceQueue = [];
var fullReplyText = '';
var streamDone = false;

// Function to add download buttons to code blocks
function addDownloadButtons(containerId) {
  var container = document.getElementById(containerId);
  if(!container) return;
  var codeBlocks = container.querySelectorAll('pre code');
  codeBlocks.forEach(function(block, index) {
    if(block.parentElement.querySelector('.download-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'download-btn';
    btn.innerHTML = '<i class="fa-solid fa-download"></i> Download Code';
    btn.style = "margin-top:8px; padding:6px 12px; background:#0284c7; color:white; border:none; border-radius:6px; cursor:pointer; font-size:11px; display:block;";
    btn.onclick = function() {
      var blob = new Blob([block.innerText], {type: 'text/plain'});
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'jarvis_code_' + Date.now() + '.txt';
      a.click();
      window.URL.revokeObjectURL(url);
    };
    block.parentElement.appendChild(btn);
  });
}

function startVoiceInput(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return;
  if(window.isListening){ if(window.recognizer) window.recognizer.abort(); return; }
  window.recognizer = new SR();
  window.recognizer.lang = 'en-IN';
  window.isListening = true;
  document.getElementById('micBtn').classList.add('mic-active');
  window.recognizer.onresult = function(e){
    document.getElementById('appInputBox').value = e.results[0][0].transcript;
  };
  window.recognizer.onend = function(){
    window.isListening = false;
    document.getElementById('micBtn').classList.remove('mic-active');
  };
  window.recognizer.start();
}

function openVoiceChat(){
  window.voiceChatActive = true;
  document.getElementById('voiceOverlay').classList.add('show');
  document.getElementById('voiceStatus').innerText = 'Listening...';
  voiceChatListenOnce();
}

function closeVoiceChat(){
  window.voiceChatActive = false;
  window.speechSynthesis.cancel();
  if(window.voiceChatRecognizer) window.voiceChatRecognizer.abort();
  document.getElementById('voiceOverlay').classList.remove('show');
}

function voiceChatListenOnce(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR || !window.voiceChatActive) return;
  if(window.voiceChatRecognizer) window.voiceChatRecognizer.abort();
  window.voiceChatRecognizer = new SR();
  window.voiceChatRecognizer.lang = 'en-IN';
  window.voiceChatRecognizer.onresult = function(e){
    var text = e.results[e.results.length-1][0].transcript;
    document.getElementById('voiceTranscript').innerText = 'You: ' + text;
    if(e.results[e.results.length-1].isFinal) voiceChatSendAndSpeak(text);
  };
  window.voiceChatRecognizer.onend = function(){
    if(window.voiceChatActive && !speakingNow) window.voiceChatRecognizer.start();
  };
  window.voiceChatRecognizer.start();
}

function voiceChatSendAndSpeak(text){
  if(!window.voiceChatActive) return;
  document.getElementById('voiceStatus').innerText = 'Thinking...';
  if(typeof saveAndAppendMessage === 'function') saveAndAppendMessage('user', text);
  var id = 'ai-voice-' + Date.now();
  if(typeof appendAiPlaceholder === 'function') appendAiPlaceholder(id);

  fetch(GROQ_PROXY_URL, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ messages: buildConversationPayload(text), stream: true })
  })
  .then(res => {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    fullReplyText = "";
    streamDone = false;

    function pump() {
      return reader.read().then(({done, value}) => {
        if(done) {
          streamDone = true;
          setTimeout(() => { addDownloadButtons(id); }, 500);
          return;
        }
        var chunk = decoder.decode(value, {stream:true});
        var lines = chunk.split('\n');
        lines.forEach(line => {
          if(line.startsWith('data: ')) {
            try {
              var piece = JSON.parse(line.slice(6)).candidates[0].content.parts[0].text;
              if(piece) {
                fullReplyText += piece;
                var el = document.getElementById(id);
                if(el) el.querySelector('.msg-body').innerHTML = renderMarkdown(fullReplyText);
                // Simple speech trigger
                if(!speakingNow && fullReplyText.length > 20) startSpeaking(fullReplyText);
              }
            } catch(e){}
          }
        });
        return pump();
      });
    }
    return pump();
  });
}

function startSpeaking(text) {
  if(speakingNow) return;
  speakingNow = true;
  window.speechSynthesis.cancel();
  var utter = new SpeechSynthesisUtterance(text.replace(/[*#`_]/g, ''));
  utter.onend = () => { speakingNow = false; };
  window.speechSynthesis.speak(utter);
     }
                 
