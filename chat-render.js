/* =====================================================
   MESSAGE RENDERING (full width, markdown, code, tools)
   ===================================================== */
function restoreActiveChat(){
  var win = document.getElementById('chatContainer');
  win.innerHTML = '';
  if(activeChatMessages.length===0){
    win.innerHTML = aiBubbleHtml('idle-greet', "Jarvis Matrix loaded. Send a prompt to execute concise logic.", true);
    return;
  }
  activeChatMessages.forEach(function(m){
    if(m.sender==='user') win.innerHTML += userBubbleHtml(m.text);
    else win.innerHTML += aiBubbleHtml('r'+Math.random().toString(36).slice(2), m.text, true, m.isImage, m.imgUrl);
  });
  autoScrollContainer();
}

function userBubbleHtml(text){
  return '<div class="msg-row user"><div class="msg user">'+escapeHtml(text)+'</div></div>';
}
function aiBubbleHtml(id, text, finalRender, isImage, imgUrl){
  var body = isImage
    ? '<div class="msg-img-wrap"><img src="'+imgUrl+'" alt="Generated image" onclick="openImageLightbox(this.src)"></div>'
    : (finalRender ? renderMarkdown(text) : escapeHtml(text));
  var tools = '';
  if(finalRender) tools = isImage ? imageToolsHtml(id, imgUrl) : messageToolsHtml(id);
  return '<div class="msg-row ai"><div class="msg ai" id="'+id+'" data-raw="'+encodeURIComponent(text)+'">'+
         '<div class="msg-sender"><i class="fa-solid fa-robot"></i> Jarvis</div>'+
         '<div class="msg-body">'+body+'</div>'+tools+'</div></div>';
}
function messageToolsHtml(id){
  return '<div class="msg-tools">'+
    '<i class="fa-regular fa-copy msg-tool-btn" onclick="copyMessage(\''+id+'\')" title="Copy"></i>'+
    '<i class="fa-regular fa-thumbs-up msg-tool-btn" id="up-'+id+'" onclick="rateMessage(\''+id+'\',\'up\')" title="Good response"></i>'+
    '<i class="fa-regular fa-thumbs-down msg-tool-btn" id="down-'+id+'" onclick="rateMessage(\''+id+'\',\'down\')" title="Bad response"></i>'+
    '<i class="fa-solid fa-volume-high msg-tool-btn" onclick="speakMessage(\''+id+'\')" title="Listen"></i>'+
    '<i class="fa-solid fa-rotate-right msg-tool-btn" onclick="regenerateMessage(\''+id+'\')" title="Regenerate"></i>'+
    '</div>';
}
function imageToolsHtml(id, imgUrl){
  return '<div class="msg-tools">'+
    '<i class="fa-solid fa-download msg-tool-btn" onclick="saveImage(\''+(imgUrl||'').replace(/'/g,"\\'")+'\')" title="Save"></i>'+
    '<i class="fa-solid fa-eye msg-tool-btn" onclick="describeImage(\''+(imgUrl||'').replace(/'/g,"\\'")+'\')" title="Describe"></i>'+
    '</div>';
}
function rateMessage(id, dir){
  var up = document.getElementById('up-'+id), down = document.getElementById('down-'+id);
  if(dir==='up'){ up.classList.toggle('active'); down.classList.remove('active'); }
  else{ down.classList.toggle('active'); up.classList.remove('active'); }
}
function renderMarkdown(text){
  try{
    var html = marked.parse(text || '');
    return html;
  }catch(e){ return escapeHtml(text); }
}
function highlightAllIn(el){
  try{ el.querySelectorAll('pre code').forEach(function(block){ hljs.highlightElement(block); }); }catch(e){}
}
function copyMessage(id){
  var el = document.getElementById(id);
  if(!el) return;
  var raw = decodeURIComponent(el.getAttribute('data-raw') || '');
  navigator.clipboard.writeText(raw).then(function(){ showToast('Copied to clipboard'); });
}
function detectSpeechLang(text){
  return /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-IN';
}

function friendlyErrorMessage(){
  return "Jarvis is a bit busy right now — please try again in a moment, or start a New Chat if this keeps happening.";
}

/* Picks a matching browser TTS voice for the chosen gender + language.
   Falls back to whatever the device offers if no clear match exists —
   voice lists differ a lot between Android/iOS/desktop browsers. */
var femaleNameHints = ['female','woman','zira','samantha','susan','victoria','moira','tessa','karen','veena','heera','fiona','allison','ava','serena','google हिन्दी','google uk english female','google us english'];
var maleNameHints = ['male','man','david','mark','daniel','alex','fred','rishi','ravi','george','james','google uk english male'];
function pickVoiceForGender(lang){
  var gender = settings.voiceGender || 'default';
  if(gender === 'default') return null;
  var voices = window.speechSynthesis.getVoices() || [];
  if(!voices.length) return null;
  var hints = gender === 'male' ? maleNameHints : femaleNameHints;
  var langVoices = voices.filter(function(v){ return (v.lang||'').toLowerCase().indexOf((lang||'').slice(0,2).toLowerCase()) === 0; });
  var pool = langVoices.length ? langVoices : voices;
  var match = pool.find(function(v){
    var n = (v.name||'').toLowerCase();
    return hints.some(function(h){ return n.indexOf(h) !== -1; });
  });
  return match || null;
}
function speakMessage(id){
  var el = document.getElementById(id);
  if(!el || !('speechSynthesis' in window)) { showToast('Voice not supported here'); return; }
  var raw = decodeURIComponent(el.getAttribute('data-raw') || '');
  window.speechSynthesis.cancel();
  var spoken = cleanForSpeech(raw);
  var utter = new SpeechSynthesisUtterance(spoken);
  utter.rate = 0.98;
  utter.lang = detectSpeechLang(spoken);
  var v = pickVoiceForGender(utter.lang);
  if(v) utter.voice = v;
  window.speechSynthesis.speak(utter);
}
function openImageLightbox(src){
  document.getElementById('imgLightboxImg').src = src;
  var lb = document.getElementById('imgLightbox');
  lb.style.display = 'flex';
}
function closeImageLightbox(){
  document.getElementById('imgLightbox').style.display = 'none';
}
function saveImage(url){
  fetch(url).then(function(res){ return res.blob(); }).then(function(blob){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jarvis-image-' + Date.now() + '.jpg';
    a.click();
    showToast('Image saved');
  }).catch(function(){ showToast('Could not save image'); });
}
function describeImage(url){
  switchTab('chat','btn-chat');
  saveAndAppendMessage('user', 'Describe this image for me.');
  var id = 'ai-'+Date.now();
  appendAiPlaceholder(id);
  analyzeImageWithAI(url, "Describe this image in detail, including any text visible in it.", id);
}
function regenerateMessage(id){
  // Find the user message right before this AI message and re-ask it
  var idx = -1;
  for(var i=0;i<activeChatMessages.length;i++){
    if(activeChatMessages[i].sender==='ai'){ idx = i; }
  }
  if(idx < 1) { showToast('Nothing to regenerate'); return; }
  var priorUser = activeChatMessages[idx-1];
  if(!priorUser || priorUser.sender!=='user'){ showToast('Nothing to regenerate'); return; }
  // remove the last AI message from state (both memory and DOM) then re-ask
  activeChatMessages.splice(idx,1);
  localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
  var el = document.getElementById(id);
  if(el && el.parentElement) el.parentElement.remove();
  var newId = 'ai-'+Date.now();
  appendAiPlaceholder(newId);
  fetchAiReply(priorUser.text, newId);
}

function saveAndAppendMessage(sender, text, isImage, imgUrl){
  activeChatMessages.push({ sender:sender, text:text, isImage:!!isImage, imgUrl:imgUrl||'' });
  localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
  var win = document.getElementById('chatContainer');
  if(sender==='user'){
    win.innerHTML += userBubbleHtml(text);
    usage.messages++; usage.tokens += Math.round(text.length/4); persistUsage();
  } else {
    var id = 'ai-'+Date.now();
    win.innerHTML += aiBubbleHtml(id, text, true, isImage, imgUrl);
    highlightAllIn(document.getElementById(id));
  }
  autoScrollContainer();
}
function appendAiPlaceholder(id){
  var win = document.getElementById('chatContainer');
  win.innerHTML += '<div class="msg-row ai"><div class="msg ai" id="'+id+'" data-raw="">'+
    '<div class="msg-sender"><i class="fa-solid fa-robot"></i> Jarvis</div>'+
    '<div class="msg-body"><div class="shimmer-bar"></div><div class="shimmer-bar"></div><div class="shimmer-bar"></div></div></div></div>';
  autoScrollContainer();
}

/* =====================================================
   CONTROLLED-SPEED REVEAL ENGINE
   Buffers incoming text and reveals it at a speed we control —
   independent of how fast the underlying API actually responds.
   ===================================================== */
var stopGenerationFlags = {};
function stripMarkdownForPreview(text){
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`{1,3}/g, '')
    .replace(/^>\s?/gm, '');
}
function revealTextIntoElement(id, fullText, speedMode, onDone){
  var el = document.getElementById(id);
  if(!el) return;
  var body = el.querySelector('.msg-body');
  var interval = speedMode==='slow' ? 75 : speedMode==='fast' ? 14 : 38;
  var i = 0;
  stopGenerationFlags[id] = false;
  el.setAttribute('data-raw', encodeURIComponent(fullText));

  var stopRow = document.createElement('div');
  stopRow.className = 'stop-gen-row';
  stopRow.id = 'stopRow-'+id;
  stopRow.innerHTML = '<button class="stop-gen-btn" onclick="stopGenerationFlags[\''+id+'\']=true;"><i class="fa-solid fa-stop"></i> Stop generating</button>';
  el.parentElement.appendChild(stopRow);

  function finish(finalText){
    body.innerHTML = renderMarkdown(finalText);
    highlightAllIn(el);
    el.setAttribute('data-raw', encodeURIComponent(finalText));
    var sr = document.getElementById('stopRow-'+id);
    if(sr) sr.remove();
    var toolsWrap = document.createElement('div');
    toolsWrap.innerHTML = messageToolsHtml(id);
    el.appendChild(toolsWrap.firstChild);
    if(settings.voiceOutput) speakMessage(id);
    if(onDone) onDone(finalText);
  }

  function tick(){
    if(stopGenerationFlags[id]){
      finish(fullText.slice(0,i) + (i < fullText.length ? '…' : ''));
      return;
    }
    if(i <= fullText.length){
      var partial = stripMarkdownForPreview(fullText.slice(0,i));
      body.innerHTML = escapeHtml(partial) + '<span style="opacity:.4;">▍</span>';
      i += Math.max(1, Math.round(fullText.length/260));
      autoScrollContainer();
      setTimeout(tick, interval);
    } else {
      finish(fullText);
    }
  }
  tick();
}

