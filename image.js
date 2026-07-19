/* =====================================================
   FILE HANDLING — real PDF/DOCX/TXT text extraction
   ===================================================== */
/* Compress/resize images client-side before sending for analysis — keeps
   requests small so they don't fail or time out, and speeds up uploads. */
function compressImageDataUrl(dataUrl, callback){
  var img = new Image();
  img.onload = function(){
    var maxDim = 1024;
    var w = img.width, h = img.height;
    if(w > maxDim || h > maxDim){
      if(w > h){ h = Math.round(h * maxDim / w); w = maxDim; }
      else { w = Math.round(w * maxDim / h); h = maxDim; }
    }
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    try{
      callback(canvas.toDataURL('image/jpeg', 0.82));
    }catch(e){
      callback(dataUrl); // fallback to original if canvas export fails
    }
  };
  img.onerror = function(){ callback(dataUrl); };
  img.src = dataUrl;
}

function processMediaAttachment(input, type){
  if(!(input.files && input.files[0])) return;
  var file = input.files[0];
  input.value = '';

  // Images now go into the input box first, so the user can ask their own
  // question about the photo before it's sent — not analyzed immediately.
  if(file.type.startsWith('image/')){
    switchTab('chat','btn-chat');
    var reader4 = new FileReader();
    reader4.onload = function(){
      compressImageDataUrl(reader4.result, function(compressed){
        setPendingImage(compressed);
        document.getElementById('appInputBox').focus();
      });
    };
    reader4.readAsDataURL(file);
    return;
  }

  switchTab('chat','btn-chat');
  saveAndAppendMessage('user', 'Uploaded ' + type + ': ' + file.name);
  var id = 'ai-file-' + Date.now();
  appendAiPlaceholder(id);

  var name = file.name.toLowerCase();

  if(name.endsWith('.pdf')){
    var reader = new FileReader();
    reader.onload = function(){
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsLib.getDocument({data:new Uint8Array(reader.result)}).promise.then(function(pdf){
        var textPromises = [];
        for(var p=1;p<=pdf.numPages;p++){
          textPromises.push(pdf.getPage(p).then(function(page){
            return page.getTextContent().then(function(tc){ return tc.items.map(function(it){return it.str;}).join(' '); });
          }));
        }
        Promise.all(textPromises).then(function(pages){
          var full = pages.join('\n\n').trim();
          var preview = full.length > 1500 ? full.slice(0,1500) + '\n\n...(truncated, ' + full.length + ' chars total)' : full;
          var msg = "Extracted text from **" + file.name + "**:\n\n" + (preview || '_No readable text found (may be a scanned image PDF)._');
          finishFileMessage(id, msg);
        });
      }).catch(function(){ finishFileMessage(id, "Couldn't parse this PDF (it may be encrypted or scanned)."); });
    };
    reader.readAsArrayBuffer(file);
  } else if(name.endsWith('.docx')){
    var reader2 = new FileReader();
    reader2.onload = function(){
      mammoth.extractRawText({arrayBuffer:reader2.result}).then(function(result){
        var full = (result.value||'').trim();
        var preview = full.length > 1500 ? full.slice(0,1500) + '\n\n...(truncated)' : full;
        finishFileMessage(id, "Extracted text from **" + file.name + "**:\n\n" + (preview || '_No text found._'));
      }).catch(function(){ finishFileMessage(id, "Couldn't parse this DOCX file."); });
    };
    reader2.readAsArrayBuffer(file);
  } else if(name.endsWith('.txt')){
    var reader3 = new FileReader();
    reader3.onload = function(){
      var full = String(reader3.result || '').trim();
      var preview = full.length > 1500 ? full.slice(0,1500) + '\n\n...(truncated)' : full;
      finishFileMessage(id, "Content of **" + file.name + "**:\n\n" + preview);
    };
    reader3.readAsText(file);
  } else {
    finishFileMessage(id, "Received " + file.name + " — text extraction isn't supported for this file type yet (.doc, and other formats).");
  }
}
function finishFileMessage(id, text){
  revealTextIntoElement(id, text, 'normal', function(){
    activeChatMessages.push({sender:'ai', text:text});
    localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
  });
}

/* Real image understanding — sends the photo to a vision-capable model
   through the same secure Worker proxy (image data never touches Groq
   directly from the browser, and the API key stays server-side). */
function analyzeImageWithAI(dataUrl, instruction, id){
  var hasProxy = GROQ_PROXY_URL && GROQ_PROXY_URL.indexOf('YOUR_WORKER_URL')===-1;
  if(!hasProxy){
    finishFileMessage(id, "Photo analysis isn't available right now — please try again later.");
    return;
  }
  fetch(GROQ_PROXY_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ vision:true, image:dataUrl, instruction:instruction })
  })
  .then(function(res){ return res.json(); })
  .then(function(data){
    var reply = "Sorry, I couldn't analyze this image.";
    if(data && data.choices && data.choices[0] && data.choices[0].message) reply = data.choices[0].message.content;
    else if(data && data.error) reply = friendlyErrorMessage();
    revealTextIntoElement(id, reply, 'normal', function(){
      activeChatMessages.push({sender:'ai', text:reply});
      localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
    });
  })
  .catch(function(err){
    revealTextIntoElement(id, friendlyErrorMessage(), 'normal');
  });
}

