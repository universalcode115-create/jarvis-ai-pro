/* =====================================================
   CHAT ACTION — text + image intent + streaming
   ===================================================== */
function detectImagePrompt(text){
  // Explicit negation ("...image me nahi", "not an image") — user is saying
  // NOT to make an image, so never trigger generation here.
  if(/\b(image|photo|picture|logo)\b[^.!?]*\b(nahi|not|mat)\b/i.test(text)) return null;
  if(/\b(nahi|not|mat)\b[^.!?]*\b(image|photo|picture|logo)\b/i.test(text)) return null;

  // "Give me a prompt" requests want TEXT (a suggested prompt), not an
  // actual generated image yet.
  if(/\bprompt\b[^.!?]*(do|de do|dedo|batao|suggest|dijiye)/i.test(text)) return null;
  if(/\b(give me|suggest)\b.*\bprompt\b/i.test(text)) return null;

  // Capability questions ("can you make photos?") should get a text answer,
  // not trigger actual generation.
  var isCapabilityQuestion = (/\b(kya|can you|do you|are you able)\b/i.test(text) && /\b(sakte|sakta|able)\b/i.test(text));
  if(isCapabilityQuestion) return null;

  var patterns = [
    /^(generate|create|make|draw|design|paint)\s+(me\s+)?(a|an|the)?\s*(premium\s+|hyper-realistic\s+|realistic\s+)?(image|photo|picture|logo|drawing|painting|artwork|illustration|wallpaper|poster)\s*(of|for|showing)?\s*/i,
    /^(image|photo|picture|logo)\s*(of|for)\s*/i,
    /^(ek\s+|mujhe\s+)?.*?\bbana\w*\b\s*/i
  ];
  var imageNoun = /\b(photo|tasveer|tasvir|chitra|image|painting|drawing|wallpaper|poster|logo|picture|photograph)\b/i;
  var styleWords = /\b(logo|vector|wallpaper|poster|background|3d|icon|artwork|illustration|minimalist|neon|realistic|hyper-realistic|cartoon|anime|portrait|landscape|hd|4k|digital art|concept art)\b/gi;
  var styleMatchCount = (text.match(styleWords) || []).length;
  var isQuotedDescription = /^["']/.test(text.trim()) || /["']$/.test(text.trim());

  // Proximity check for Hindi "bana-" verb + image noun — must be close
  // together (within 5 words), not just anywhere in a long sentence, to
  // avoid false positives like "app bana saku, image me nahi".
  var words = text.toLowerCase().split(/\s+/);
  var banaIdx = -1, imgIdx = -1;
  words.forEach(function(w, i){
    if(/^bana\w*$/.test(w) && banaIdx===-1) banaIdx = i;
    if(/^(photo|tasveer|tasvir|chitra|image|painting|drawing|wallpaper|poster|logo|picture|photograph)$/.test(w) && imgIdx===-1) imgIdx = i;
  });
  var hindiProximityMatch = banaIdx!==-1 && imgIdx!==-1 && Math.abs(banaIdx-imgIdx) <= 5;

  var isIntent = /\b(generate|create|make|draw|design|paint)\b.*\b(image|photo|picture|logo|drawing|painting|artwork|illustration|wallpaper|poster)\b/i.test(text)
    || /\b(image|photo|picture|logo)\s+(of|for)\b/i.test(text)
    || hindiProximityMatch
    || (isQuotedDescription && styleMatchCount >= 1) // quoted visual description
    || styleMatchCount >= 2; // multiple visual-style keywords = almost certainly an image prompt

  if(!isIntent) return null;
  var cleanPrompt = text.replace(/^["']|["']$/g, '');
  for(var i=0;i<patterns.length;i++){ cleanPrompt = cleanPrompt.replace(patterns[i], ''); }
  cleanPrompt = cleanPrompt.trim();
  return cleanPrompt.length > 2 ? cleanPrompt : text;
}

/* Pending image — selected photo waits in the input area until the user
   types their own question and sends, instead of being analyzed instantly. */
var pendingImageDataUrl = null;
function setPendingImage(dataUrl){
  pendingImageDataUrl = dataUrl;
  document.getElementById('pendingImagePreview').src = dataUrl;
  document.getElementById('pendingImageRow').style.display = 'flex';
}
function clearPendingImage(){
  pendingImageDataUrl = null;
  document.getElementById('pendingImageRow').style.display = 'none';
  document.getElementById('pendingImagePreview').src = '';
}

/* Explicit image-generation mode — chosen via the image icon/chip. Whatever
   the user types next is used as the image prompt directly, no keyword
   guessing needed, so any description (in any language) works. */
var pendingImageGenMode = false;
function enterImageGenMode(){
  pendingImageGenMode = true;
  document.getElementById('imageGenHintRow').style.display = 'flex';
  document.getElementById('appInputBox').placeholder = 'Describe the image you want...';
  document.getElementById('appInputBox').focus();
}
function exitImageGenMode(){
  pendingImageGenMode = false;
  document.getElementById('imageGenHintRow').style.display = 'none';
  document.getElementById('appInputBox').placeholder = 'Ask Jarvis Pro...';
}

function executeChatAction(){
  var box = document.getElementById('appInputBox');
  var text = box.value.trim();

  if(pendingImageGenMode){
    if(!text) return;
    switchTab('chat','btn-chat');
    saveAndAppendMessage('user', text);
    box.value='';
    exitImageGenMode();
    var genId = 'ai-'+Date.now();
    appendAiPlaceholder(genId);
    handleImageGeneration(text, genId);
    return;
  }

  if(pendingImageDataUrl){
    if(!text) text = "What's in this photo?";
    switchTab('chat','btn-chat');
    var imgToSend = pendingImageDataUrl;
    var win = document.getElementById('chatContainer');
    win.innerHTML += '<div class="msg-row user"><div class="msg user">'+escapeHtml(text)+
      '<div class="msg-img-wrap"><img src="'+imgToSend+'" alt="Uploaded photo" onclick="openImageLightbox(this.src)"></div></div></div>';
    activeChatMessages.push({sender:'user', text:'[Photo] ' + text});
    localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
    usage.messages++; usage.tokens += Math.round(text.length/4); persistUsage();
    box.value='';
    clearPendingImage();
    autoScrollContainer();

    var imgId = 'ai-img-'+Date.now();
    appendAiPlaceholder(imgId);

    // Editing instructions ("change/remove/add/badlo/hatao/banao isme...")
    // actually modify the photo; questions ("what/kya/describe") analyze it.
    var isEditRequest = /\b(change|edit|remove|add|replace|make it|turn|convert|colou?r|background|filter|badlo|badal|hatao|jodo|banao|banado|kar do|lagao)\b/i.test(text);
    if(isEditRequest){
      handleImageGeneration(text, imgId, imgToSend);
    } else {
      var fullInstruction = text + " Also clearly mention any text visible in the image (read it out / transcribe it), and briefly note why that text might be there if it's relevant.";
      analyzeImageWithAI(imgToSend, fullInstruction, imgId);
    }
    return;
  }

  if(!text) return;
  switchTab('chat','btn-chat');
  saveAndAppendMessage('user', text);
  box.value='';

  var imagePrompt = detectImagePrompt(text);

  var id = 'ai-'+Date.now();
  appendAiPlaceholder(id);

  if(imagePrompt){
    handleImageGeneration(imagePrompt, id);
    return;
  }

  fetchAiReply(text, id);
}

function handleImageGeneration(prompt, id, inputImageDataUrl){
  var hasProxy = GROQ_PROXY_URL && GROQ_PROXY_URL.indexOf('YOUR_WORKER_URL')===-1;
  var el = document.getElementById(id);
  if(!el) return;

  function showImageResult(url, caption){
    var sr = document.getElementById('stopRow-'+id); if(sr) sr.remove();
    var captionHtml = caption ? '<p style="margin-top:8px;">'+escapeHtml(caption)+'</p>' : '';
    el.querySelector('.msg-body').innerHTML = '<div class="msg-img-wrap"><img src="'+url+'" alt="Generated image" onload="autoScrollContainer()" onclick="openImageLightbox(this.src)"></div>' + captionHtml;
    el.setAttribute('data-raw', encodeURIComponent(url));
    var toolsWrap = document.createElement('div');
    toolsWrap.innerHTML = imageToolsHtml(id, url);
    el.appendChild(toolsWrap.firstChild);
    activeChatMessages.push({sender:'ai', text:'[Generated image: '+prompt+']', isImage:true, imgUrl:url});
    localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
    autoScrollContainer();
  }

  function showImageError(){
    var sr = document.getElementById('stopRow-'+id); if(sr) sr.remove();
    el.querySelector('.msg-body').innerHTML = escapeHtml(friendlyErrorMessage());
  }

  if(!hasProxy){
    // Fallback to free public generator if the proxy isn't configured
    setTimeout(function(){ showImageResult(imageGenUrl(prompt), ''); }, 500);
    return;
  }

  var payload = { imagegen:true, prompt: prompt };
  if(inputImageDataUrl) payload.inputImage = inputImageDataUrl;

  fetch(GROQ_PROXY_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  })
  .then(function(res){ return res.json(); })
  .then(function(data){
    if(data && data.imageDataUrl){
      showImageResult(data.imageDataUrl, data.caption);
    } else {
      // Fall back to the free generator rather than showing a dead end
      showImageResult(imageGenUrl(prompt), '');
    }
  })
  .catch(function(){
    showImageResult(imageGenUrl(prompt), '');
  });
}

function isCodeQuestion(text){
  return /\b(code|function|script|program|bug|debug|error|class |algorithm|python|javascript|java|html|css|sql|api|regex|compile|syntax)\b/i.test(text)
    || /\b(kod|program|coding|likho.*code|code.*likho|banao.*program|website banao|app banao)\b/i.test(text);
}

function truncateForContext(text, maxLen){
  if(!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

function buildConversationPayload(latestUserText){
  var short = isShortQuestion(latestUserText);
  var isCode = isCodeQuestion(latestUserText);
  var stylePrompt;
  if(isCode){
    stylePrompt = " The user is asking about code. Write clean, correct code in a code block, then explain it step by step in short, simple points so a beginner can follow along.";
  } else if(settings.responseStyle === 'concise'){
    stylePrompt = " Keep answers short and clear — a few concise sentences for simple questions. Always finish your thought completely; never cut a sentence off midway. Go longer only if the user explicitly asks for detail or the topic truly needs it.";
  } else {
    stylePrompt = " Give thorough, well-structured, clear answers with helpful detail. Always finish your thought completely; never cut a sentence off midway.";
  }
  var langPrompt = " Always reply in the same language and script the user just wrote in — if they write in English, reply in English; if they write in Hindi (Devanagari or Hinglish), reply the same way. Mirror their language naturally.";
  var capabilityPrompt = " If the user asks whether you can create/generate images or photos, say yes — just tell them to describe what they want and it will be created, since this app has an image generation feature. Never say you can't make images.";
  var personalityModes = {
    normal: "",
    jarvis: " Speak like Jarvis from Iron Man — crisp, dryly witty, calls the user 'Sir' or 'Boss' occasionally, highly capable and composed.",
    krishna: " Speak with the wisdom and calm of a spiritual guide — thoughtful, gentle, and reassuring, offering perspective along with the answer.",
    maharaj: " Speak respectfully and warmly like a spiritual elder — polite, measured, and encouraging."
  };
  var personalityPrompt = personalityModes[settings.personalityMode] || "";
  var sys = { role:'system', content: settings.systemPrompt + stylePrompt + langPrompt + capabilityPrompt + personalityPrompt };

  // Keep only the last few turns, and cap each message's length — long chats
  // were sending huge context on every message, triggering "too large" /
  // rate-limit errors. This keeps enough context for continuity without bloat.
  var history = activeChatMessages.slice(-30).filter(function(m){ return !m.isImage; }).map(function(m){
    return { role: m.sender==='user' ? 'user' : 'assistant', content: truncateForContext(m.text, 400) };
  });
  // last entry is already the current user message (pushed before calling this)
  return [sys].concat(history);
}

var activeStreamControllers = {};
function stopStream(id){
  if(activeStreamControllers[id]){ activeStreamControllers[id].abort(); delete activeStreamControllers[id]; }
}

function fetchAiReply(userText, id){
  var hasProxy = GROQ_PROXY_URL && GROQ_PROXY_URL.indexOf('YOUR_WORKER_URL')===-1;
  var short = isShortQuestion(userText);
  var isCode = isCodeQuestion(userText);
  var maxTok = isCode ? 900 : (settings.responseStyle==='concise' ? (short ? 180 : 380) : 700);

  if(!hasProxy){
    setTimeout(function(){
      var reply = "Jarvis isn't fully set up yet, so I can't give a full answer right now. Please try again later.";
      revealTextIntoElement(id, reply, 'normal', function(){
        activeChatMessages.push({sender:'ai', text:reply});
        localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
        usage.tokens += Math.round(reply.length/4); persistUsage();
      });
    }, 700);
    return;
  }

  var payload = buildConversationPayload(userText);
  var el = document.getElementById(id);
  if(!el) return;
  var body = el.querySelector('.msg-body');
  var controller = new AbortController();
  activeStreamControllers[id] = controller;

  var stopRow = document.createElement('div');
  stopRow.className = 'stop-gen-row';
  stopRow.id = 'stopRow-'+id;
  stopRow.innerHTML = '<button class="stop-gen-btn" onclick="stopStream(\''+id+'\')"><i class="fa-solid fa-stop"></i> Stop generating</button>';
  el.parentElement.appendChild(stopRow);

  var fullText = '';

  function finishStream(){
    delete activeStreamControllers[id];
    var sr = document.getElementById('stopRow-'+id); if(sr) sr.remove();
    if(!fullText.trim()){
      // Streaming produced nothing usable — fall back to a plain
      // non-streaming request rather than showing an error right away.
      fetchAiReplyNonStream(userText, id, maxTok);
      return;
    }
    body.innerHTML = renderMarkdown(fullText);
    highlightAllIn(el);
    el.setAttribute('data-raw', encodeURIComponent(fullText));
    var toolsWrap = document.createElement('div');
    toolsWrap.innerHTML = messageToolsHtml(id);
    el.appendChild(toolsWrap.firstChild);
    if(settings.voiceOutput) speakMessage(id);
    activeChatMessages.push({sender:'ai', text: fullText});
    localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
    usage.tokens += Math.round(fullText.length/4); persistUsage();
  }

  fetch(GROQ_PROXY_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ model: targetAiModel, messages: payload, max_tokens: maxTok, stream:true }),
    signal: controller.signal
  })
  .then(function(res){
    if(!res.ok || !res.body){ throw new Error('stream failed'); }
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    function pump(){
      return reader.read().then(function(result){
        if(result.done){ finishStream(); return; }
        buffer += decoder.decode(result.value, {stream:true});
        var lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(function(line){
          line = line.trim();
          if(line.indexOf('data:') !== 0) return;
          var jsonStr = line.slice(5).trim();
          if(!jsonStr || jsonStr === '[DONE]') return;
          try{
            var obj = JSON.parse(jsonStr);
            var cand = obj.candidates && obj.candidates[0];
            var piece = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
            if(piece){
              fullText += piece;
              body.innerHTML = escapeHtml(stripMarkdownForPreview(fullText)) + '<span style="opacity:.4;">▍</span>';
              autoScrollContainer();
            }
          }catch(e){}
        });
        return pump();
      });
    }
    return pump();
  })
  .catch(function(err){
    delete activeStreamControllers[id];
    var sr = document.getElementById('stopRow-'+id); if(sr) sr.remove();
    if(err && err.name === 'AbortError'){
      if(fullText.trim()){ finishStreamAfterAbort(); }
      return;
    }
    // Streaming request itself failed (network hiccup, etc) — try the
    // simpler non-streaming endpoint before giving up.
    fetchAiReplyNonStream(userText, id, maxTok);
  });

  function finishStreamAfterAbort(){
    body.innerHTML = renderMarkdown(fullText + '…');
    highlightAllIn(el);
    el.setAttribute('data-raw', encodeURIComponent(fullText));
    var toolsWrap = document.createElement('div');
    toolsWrap.innerHTML = messageToolsHtml(id);
    el.appendChild(toolsWrap.firstChild);
    activeChatMessages.push({sender:'ai', text: fullText});
    localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
  }
}

function fetchAiReplyNonStream(userText, id, maxTok){
  var payload = buildConversationPayload(userText);
  var el = document.getElementById(id);
  if(!el) return;
  fetch(GROQ_PROXY_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ model: targetAiModel, messages: payload, max_tokens: maxTok || 500, stream:false })
  })
  .then(function(res){ return res.json(); })
  .then(function(data){
    var reply = "Sorry, I could not generate a reply.";
    if(data && data.choices && data.choices[0] && data.choices[0].message) reply = data.choices[0].message.content;
    else if(data && data.error) reply = friendlyErrorMessage();
    revealTextIntoElement(id, reply, 'normal', function(){
      activeChatMessages.push({sender:'ai', text:reply});
      localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
      usage.tokens += Math.round(reply.length/4); persistUsage();
    });
  })
  .catch(function(err){
    revealTextIntoElement(id, friendlyErrorMessage(), 'normal');
  });
}

