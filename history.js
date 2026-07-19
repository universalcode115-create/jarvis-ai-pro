/* =====================================================
   NEW CHAT
   ===================================================== */
function startNewChatSession(){
  if(activeChatMessages.length>0){
    var sessId = 'sess-'+Date.now();
    chatHistorySessions.unshift({
      id:sessId, date:new Date().toLocaleString(), pinned:false,
      messages:activeChatMessages, preview:(activeChatMessages[0].text||'Image chat').slice(0,60)
    });
    localStorage.setItem('jarvis_history_sessions', JSON.stringify(chatHistorySessions));
    generateSmartTitle(sessId, activeChatMessages);
  }
  activeChatMessages = [];
  localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
  restoreActiveChat();
  switchTab('chat','btn-chat');
  showToast('New chat started');
}

/* Analyzes the conversation and replaces the raw-first-message title with a
   short, meaningful summary — like "Calculator App Code" instead of "Hello". */
function generateSmartTitle(sessionId, messages){
  var hasProxy = GROQ_PROXY_URL && GROQ_PROXY_URL.indexOf('YOUR_WORKER_URL')===-1;
  if(!hasProxy) return;
  var transcript = messages.slice(0,6).map(function(m){
    return (m.sender==='user'?'User: ':'Jarvis: ') + truncateForContext(m.text||'[image]', 200);
  }).join('\n');
  var payload = [
    { role:'system', content: "Read this chat and reply with ONLY a short 3-5 word title summarizing what it's about — no quotes, no punctuation at the end, no explanation. Match the language the conversation is in." },
    { role:'user', content: transcript }
  ];
  fetch(GROQ_PROXY_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ model: targetAiModel, messages: payload, max_tokens: 20, stream:false })
  })
  .then(function(res){ return res.json(); })
  .then(function(data){
    var title = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if(!title) return;
    title = title.trim().replace(/^["']|["']$/g,'').slice(0,60);
    if(!title) return;
    var session = chatHistorySessions.find(function(s){ return s.id === sessionId; });
    if(session){
      session.preview = title;
      localStorage.setItem('jarvis_history_sessions', JSON.stringify(chatHistorySessions));
    }
  })
  .catch(function(){ /* keep the fallback title silently if this fails */ });
}

/* =====================================================
   HISTORY (search + pin)
   ===================================================== */
function renderHistoryTab(){
  var q = (document.getElementById('historySearchInput').value || '').toLowerCase();
  var container = document.getElementById('historyListContainer');
  container.innerHTML='';
  var list = chatHistorySessions.filter(function(s){
    if(!q) return true;
    var hay = (s.preview||'') + ' ' + s.messages.map(function(m){return m.text||'';}).join(' ');
    return hay.toLowerCase().indexOf(q) !== -1;
  }).sort(function(a,b){ return (b.pinned?1:0) - (a.pinned?1:0); });

  if(list.length===0){ container.innerHTML='<div class="empty-note">No matching sessions.</div>'; return; }

  list.forEach(function(session){
    var item = document.createElement('div');
    item.className='history-item';
    item.innerHTML =
      '<div onclick="loadHistorySession(\''+session.id+'\')" style="flex:1; min-width:0;">'+
        '<div style="font-weight:700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">'+escapeHtml(session.preview||'Chat session')+'</div>'+
        '<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">'+session.date+'</div>'+
      '</div>'+
      '<i class="fa-solid fa-thumbtack pin-btn'+(session.pinned?' pinned':'')+'" onclick="togglePin(event,\''+session.id+'\')"></i>'+
      '<i class="fa-solid fa-trash del-btn" onclick="deleteHistorySession(event,\''+session.id+'\')"></i>';
    container.appendChild(item);
  });
}
function togglePin(evt,id){
  evt.stopPropagation();
  var s = chatHistorySessions.find(function(s){return s.id===id;});
  if(s){ s.pinned = !s.pinned; localStorage.setItem('jarvis_history_sessions', JSON.stringify(chatHistorySessions)); renderHistoryTab(); }
}
function loadHistorySession(id){
  var session = chatHistorySessions.find(function(s){return s.id===id;});
  if(!session) return;
  activeChatMessages = session.messages.slice();
  localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
  restoreActiveChat();
  switchTab('chat','btn-chat');
}
function deleteHistorySession(evt,id){
  evt.stopPropagation();
  chatHistorySessions = chatHistorySessions.filter(function(s){return s.id!==id;});
  localStorage.setItem('jarvis_history_sessions', JSON.stringify(chatHistorySessions));
  renderHistoryTab();
  showToast('Session deleted');
}

/* =====================================================
   EXPORT
   ===================================================== */
function exportChatAsText(){
  toggleExportMenu();
  var lines = activeChatMessages.map(function(m){ return (m.sender==='user'?'Chief: ':'Jarvis: ') + (m.isImage ? '[image] '+m.imgUrl : m.text); });
  var blob = new Blob([lines.join('\n\n')], {type:'text/plain'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'jarvis-chat.txt';
  a.click();
  showToast('Exported as text');
}
function exportChatAsPdf(){
  toggleExportMenu();
  try{
    var jsPDFCtor = window.jspdf.jsPDF;
    var doc = new jsPDFCtor();
    var y = 15;
    doc.setFontSize(14); doc.text('Jarvis AI Pro — Chat Export', 10, y); y+=10;
    doc.setFontSize(10);
    activeChatMessages.forEach(function(m){
      var prefix = (m.sender==='user'?'Chief: ':'Jarvis: ');
      var text = prefix + (m.isImage ? '[image attached]' : m.text);
      var split = doc.splitTextToSize(text, 180);
      split.forEach(function(line){
        if(y>280){ doc.addPage(); y=15; }
        doc.text(line, 10, y); y+=6;
      });
      y+=3;
    });
    doc.save('jarvis-chat.pdf');
    showToast('Exported as PDF');
  }catch(e){ showToast('PDF export failed'); }
}

