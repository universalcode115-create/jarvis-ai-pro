/* =====================================================
   VOICE INPUT
   ===================================================== */
function startVoiceInput(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ showToast('Voice input not supported in this browser'); return; }
  if(isListening){ recognizer.stop(); return; }
  recognizer = new SR();
  recognizer.lang = 'en-IN';
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  isListening = true;
  document.getElementById('micBtn').classList.add('mic-active');
  showToast('Listening...');
  recognizer.onresult = function(e){
    var text = e.results[0][0].transcript;
    document.getElementById('appInputBox').value = text;
  };
  recognizer.onerror = function(){ showToast('Could not hear you clearly'); };
  recognizer.onend = function(){ isListening=false; document.getElementById('micBtn').classList.remove('mic-active'); };
  recognizer.start();
}

/* =====================================================
   VOICE CHAT MODE — continuous spoken back-and-forth with the AI,
   like talking to a person: you speak, Jarvis replies out loud.
   ===================================================== */
var voiceChatRecognizer = null, voiceChatActive = false, voiceChatListening = false;

function openVoiceChat(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ showToast('Voice chat needs a browser with speech recognition support'); return; }
  voiceChatActive = true;
  document.getElementById('voiceOverlay').classList.add('show');
  document.getElementById('voiceStatus').innerText = 'Tap the mic to start talking';
  document.getElementById('voiceTranscript').innerText = '';
  document.getElementById('voiceOrb').className = 'voice-orb-big';
}
function closeVoiceChat(){
  voiceChatActive = false;
  window.speechSynthesis.cancel();
  if(voiceChatRecognizer){ try{ voiceChatRecognizer.stop(); }catch(e){} }
  voiceChatListening = false;
  document.getElementById('voiceOverlay').classList.remove('show');
}
function voiceChatToggleListen(){
  // Tap while Jarvis is talking = interrupt it immediately and start
  // listening right away, like tapping "stop" on a real phone call.
  if(window.speechSynthesis && window.speechSynthesis.speaking){
    window.speechSynthesis.cancel();
    voiceChatListenOnce();
    return;
  }
  if(voiceChatListening){
    if(voiceChatRecognizer) voiceChatRecognizer.stop();
    return;
  }
  voiceChatListenOnce();
}
function voiceChatListenOnce(){
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR || !voiceChatActive) return;
  window.speechSynthesis.cancel();
  voiceChatRecognizer = new SR();
  voiceChatRecognizer.lang = 'en-IN';
  voiceChatRecognizer.interimResults = false;
  voiceChatRecognizer.maxAlternatives = 1;
  voiceChatListening = true;
  document.getElementById('voiceOrb').className = 'voice-orb-big listening';
  document.getElementById('voiceStatus').innerText = 'Listening...';
  document.getElementById('voiceMicIcon').className = 'fa-solid fa-stop';

  voiceChatRecognizer.onstart = function(){ window.speechSynthesis.cancel(); };
  voiceChatRecognizer.onresult = function(e){
    var text = e.results[0][0].transcript;
    document.getElementById('voiceTranscript').innerText = 'You: ' + text;
    voiceChatSendAndSpeak(text);
  };
  voiceChatRecognizer.onerror = function(){
    document.getElementById('voiceStatus').innerText = 'Didn\'t catch that — tap the mic to try again';
  };
  voiceChatRecognizer.onend = function(){
    voiceChatListening = false;
    document.getElementById('voiceMicIcon').className = 'fa-solid fa-microphone';
    if(document.getElementById('voiceOrb').className.indexOf('listening')!==-1){
      document.getElementById('voiceOrb').className = 'voice-orb-big';
    }
  };
  voiceChatRecognizer.start();
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
  var base = buildConversationPayload(latestUserText);
  base[0] = { role:'system', content: base[0].content + " This is a spoken voice conversation, not text chat — answer in natural, clear spoken sentences only. No bullet points, no markdown, no headers, no asterisks — just talk like a person explaining something out loud, in 2-5 short sentences unless asked for more." };
  return base;
}

function voiceChatSendAndSpeak(text){
  if(!voiceChatActive) return;
  document.getElementById('voiceStatus').innerText = 'Thinking...';
  document.getElementById('voiceOrb').className = 'voice-orb-big';

  // Also log this exchange into the real chat history so it's saved
  saveAndAppendMessage('user', text);
  var id = 'ai-voice-' + Date.now();
  appendAiPlaceholder(id);

  function speakReply(reply){
    var toolsWrap = document.createElement('div');
    var el = document.getElementById(id);
    if(el){
      el.querySelector('.msg-body').innerHTML = renderMarkdown(reply);
      el.setAttribute('data-raw', encodeURIComponent(reply));
      toolsWrap.innerHTML = messageToolsHtml(id);
      el.appendChild(toolsWrap.firstChild);
    }
    activeChatMessages.push({sender:'ai', text:reply});
    localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));

    if(!voiceChatActive) return;
    var spoken = cleanForSpeech(reply);
    document.getElementById('voiceTranscript').innerText = 'Jarvis: ' + spoken;
    document.getElementById('voiceStatus').innerText = 'Speaking...';
    document.getElementById('voiceOrb').className = 'voice-orb-big speaking';
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(spoken);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.volume = 1;
    utter.lang = detectSpeechLang(spoken);
    var vch = pickVoiceForGender(utter.lang);
    if(vch) utter.voice = vch;
    utter.onend = function(){
      if(!voiceChatActive) return;
      document.getElementById('voiceOrb').className = 'voice-orb-big';
      document.getElementById('voiceStatus').innerText = 'Listening...';
      // Continuous conversation — automatically listen again, like a live call
      setTimeout(function(){ if(voiceChatActive) voiceChatListenOnce(); }, 350);
    };
    window.speechSynthesis.speak(utter);
  }

  // Image requests spoken in voice chat should actually generate an image,
  // not get a text description from the language model.
  var imagePrompt = detectImagePrompt(text);
  if(imagePrompt){
    var genEl = document.getElementById(id);
    handleImageGeneration(imagePrompt, id);
    speakReply("Here's the image I created for you — you can see it in the chat.");
    return;
  }

  var payload = buildVoicePayload(text);
  var hasProxy = GROQ_PROXY_URL && GROQ_PROXY_URL.indexOf('YOUR_WORKER_URL')===-1;

  if(!hasProxy){
    setTimeout(function(){ speakReply("Jarvis isn't fully set up yet — please try again later."); }, 500);
    return;
  }

  // Speak sentence-by-sentence AS the reply streams in, instead of waiting
  // for the whole answer — this is what makes it feel like a live back-and-forth
  // instead of "type everything, then talk".
  var sentenceQueue = [];
  var speakingNow = false;
  var fullReplyText = '';
  var streamDone = false;

  function enqueueSentence(s){
    s = s.trim();
    if(!s) return;
    sentenceQueue.push(s);
    trySpeakNextChunk();
  }
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
        // A few real words heard while Jarvis is talking = the user is
        // interrupting on purpose, like a real conversation.
        if(heard.split(/\s+/).length >= 2){
          stopInterruptWatcher();
          window.speechSynthesis.cancel();
          speakingNow = false;
          sentenceQueue.length = 0;
          voiceChatListenOnce();
        }
      };
      interruptWatcher.onerror = function(){};
      interruptWatcher.onend = function(){ interruptWatcher = null; };
      interruptWatcher.start();
    }catch(e){ interruptWatcher = null; }
  }
  function stopInterruptWatcher(){
    if(interruptWatcher){ try{ interruptWatcher.onend = null; interruptWatcher.stop(); }catch(e){} interruptWatcher = null; }
  }

  function trySpeakNextChunk(){
    if(speakingNow || sentenceQueue.length===0 || !voiceChatActive) return;
    speakingNow = true;
    var chunk = sentenceQueue.shift();
    document.getElementById('voiceTranscript').innerText = 'Jarvis: ' + chunk;
    document.getElementById('voiceStatus').innerText = 'Speaking... (tap or start talking to interrupt)';
    document.getElementById('voiceOrb').className = 'voice-orb-big speaking';
    var utter = new SpeechSynthesisUtterance(cleanForSpeech(chunk));
    utter.rate = 0.97;
    utter.pitch = 1;
    utter.volume = 1;
    utter.lang = detectSpeechLang(chunk);
    var vch = pickVoiceForGender(utter.lang);
    if(vch) utter.voice = vch;
    utter.onend = function(){
      stopInterruptWatcher();
      speakingNow = false;
      if(sentenceQueue.length){ trySpeakNextChunk(); return; }
      if(streamDone){
        // fully done speaking the entire reply — go back to listening, like a live call
        if(!voiceChatActive) return;
        document.getElementById('voiceOrb').className = 'voice-orb-big';
        document.getElementById('voiceStatus').innerText = 'Listening...';
        setTimeout(function(){ if(voiceChatActive) voiceChatListenOnce(); }, 300);
      }
    };
    window.speechSynthesis.speak(utter);
    startInterruptWatcher();
  }

  var el = document.getElementById(id);
  var buffer = '';
  fetch(GROQ_PROXY_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ model: targetAiModel, messages: payload, max_tokens: 300, stream:true })
  })
  .then(function(res){
    if(!res.body || !res.ok) throw new Error('no-stream');
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var raw = '';
    function pump(){
      return reader.read().then(function(result){
        if(result.done){
          streamDone = true;
          if(buffer.trim()) enqueueSentence(buffer);
          if(!fullReplyText.trim()) speakReply("Sorry, I couldn't generate a reply.");
          else{
            if(el){
              el.querySelector('.msg-body').innerHTML = renderMarkdown(fullReplyText);
              el.setAttribute('data-raw', encodeURIComponent(fullReplyText));
              var toolsWrap = document.createElement('div');
              toolsWrap.innerHTML = messageToolsHtml(id);
              el.appendChild(toolsWrap.firstChild);
            }
            activeChatMessages.push({sender:'ai', text:fullReplyText});
            localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
          }
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
            var cand = obj.candidates && obj.candidates[0];
            var piece = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
            if(piece){
              fullReplyText += piece;
              buffer += piece;
              var m;
              while((m = buffer.match(/^(.*?[.!?।\n])\s*/))){
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
    // Streaming failed — fall back to the simple one-shot request
    fetch(GROQ_PROXY_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ model: targetAiModel, messages: payload, max_tokens: 300, stream:false })
    })
    .then(function(res){ return res.json(); })
    .then(function(data){
      var reply = "Sorry, I couldn't generate a reply.";
      if(data && data.choices && data.choices[0] && data.choices[0].message) reply = data.choices[0].message.content;
      speakReply(reply);
    })
    .catch(function(){ speakReply(friendlyErrorMessage()); });
  });
}

