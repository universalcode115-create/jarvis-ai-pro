/* =====================================================
   UTIL
   ===================================================== */
function escapeHtml(str){ var d=document.createElement('div'); d.innerText=str; return d.innerHTML; }
function showToast(t){ var e=document.getElementById('toastBox'); e.innerText=t; e.classList.add('show'); setTimeout(function(){e.classList.remove('show');},1900); }
function colorForEmail(email){ var s=0; for(var i=0;i<email.length;i++){s+=email.charCodeAt(i);} return AVATAR_COLORS[s % AVATAR_COLORS.length]; }
function initialsFor(name,email){ var src=(name && name.trim())?name.trim():email; return src.charAt(0).toUpperCase(); }
function persistUsage(){ localStorage.setItem('jarvis_usage', JSON.stringify(usage)); }
function isShortQuestion(text){ return text.trim().split(/\s+/).length <= 9 || text.trim().length <= 55; }

