/* =====================================================
   MENU / TABS
   ===================================================== */
function toggleMenu(){ document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('open'); }
function toggleExportMenu(){ document.getElementById('exportMenu').classList.toggle('show'); }

var tabHistoryStack = [];
var currentTabId = 'home';
function switchTab(tabId, navId, skipHistoryPush){
  if(!skipHistoryPush && currentTabId && currentTabId!==tabId){ tabHistoryStack.push(currentTabId); }
  currentTabId = tabId;
  document.querySelectorAll('.app-tab').forEach(function(t){ t.style.display='none'; });
  document.getElementById(tabId).style.display='block';
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  if(navId){ var navEl = document.getElementById(navId); if(navEl) navEl.classList.add('active'); }
  document.getElementById('attachMenu').style.display='none';
  document.getElementById('plusToggleBtn').classList.remove('open');
  document.getElementById('exportMenu').classList.remove('show');
  if(tabId==='history') renderHistoryTab();
  if(tabId==='gallery') renderGalleryTab();
  if(tabId==='profile') refreshProfileView();
  if(tabId==='workspace') { loadSettingsIntoUI(); refreshStats(); }
  var backBtn = document.getElementById('headerBackBtn');
  if(backBtn) backBtn.classList.toggle('show', tabId!=='home');
  autoScrollContainer();
}
function goBackTab(){
  var prev = tabHistoryStack.pop() || 'home';
  var navId = 'btn-' + prev;
  switchTab(prev, navId, true);
}

function toggleAttachmentMenu(){
  var m=document.getElementById('attachMenu'), b=document.getElementById('plusToggleBtn');
  if(m.style.display==='flex'){ m.style.display='none'; b.classList.remove('open'); }
  else{ m.style.display='flex'; b.classList.add('open'); }
}
function triggerHardware(type){
  toggleAttachmentMenu();
  if(type==='gallery') document.getElementById('nativeGalleryIn').click();
  if(type==='photo') document.getElementById('nativePhotoIn').click();
  if(type==='video') document.getElementById('nativeVideoIn').click();
  if(type==='file') document.getElementById('nativeFileIn').click();
}
function runPreset(text){ switchTab('chat','btn-chat'); document.getElementById('appInputBox').value=text; document.getElementById('appInputBox').focus(); }
function goToFreshChat(){
  startNewChatSession();
  document.getElementById('appInputBox').focus();
}
function autoScrollContainer(){
  var sc=document.getElementById('scrollContainer');
  if(!sc) return;
  sc.scrollTop = sc.scrollHeight;
  setTimeout(function(){ sc.scrollTop = sc.scrollHeight; }, 60);
}

function openPrivacyPolicy(){ document.getElementById('policyOverlay').classList.add('show'); }
function closePrivacyPolicy(){ document.getElementById('policyOverlay').classList.remove('show'); }

