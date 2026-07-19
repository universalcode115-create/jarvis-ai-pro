/* =====================================================
   OFFLINE DETECTION
   ===================================================== */
function updateOnlineStatus(){
  var banner = document.getElementById('offlineBanner');
  banner.classList.toggle('show', !navigator.onLine);
  refreshStats();
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

/* Keyboard/viewport stability now handled by CSS `100svh` on body — no JS
   resize hack needed, which avoids the visible layout jump that manual
   resizing caused during keyboard open/close animation. */

/* =====================================================
   STARTUP
   ===================================================== */
if('speechSynthesis' in window){
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = function(){ window.speechSynthesis.getVoices(); };
}
(function init(){
  applyTheme();
  isGuestMode = localStorage.getItem('jarvis_guest_mode') === 'true';
  restoreActiveChat();
  refreshProfileView();
  checkGoogleRedirectResult();
  updateOnlineStatus();

  // Firebase persists the login session automatically across visits.
  fbAuth.onAuthStateChanged(function(user){
    if(user){
      isGuestMode = false;
      localStorage.removeItem('jarvis_guest_mode');
      onFirebaseUserReady(user, true);
    } else {
      isLoggedIn=false; currentUid=null; cloudSyncReady=false;
      refreshProfileView();
      if(!isGuestMode){ setTimeout(function(){ openOneTap(); }, 500); }
    }
  });

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(function(){});
  }
})();
