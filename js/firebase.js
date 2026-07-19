/* =====================================================
   FIREBASE CLOUD SYNC — real backend for accounts + chat data
   ===================================================== */
function cloudUserDoc(uid){ return fbDb.collection('users').doc(uid); }

function saveProfileToCloud(uid, profile){
  cloudUserDoc(uid).set(profile, {merge:true}).catch(function(e){ console.warn('profile sync failed', e); });
}

function saveActiveChatToCloud(){
  if(!currentUid || !cloudSyncReady) return;
  cloudUserDoc(currentUid).collection('state').doc('active').set({
    messages: activeChatMessages, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(e){ console.warn('active chat sync failed', e); });
}

function saveHistoryToCloud(){
  if(!currentUid || !cloudSyncReady) return;
  cloudUserDoc(currentUid).collection('state').doc('history').set({
    sessions: chatHistorySessions, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(e){ console.warn('history sync failed', e); });
}

function saveSettingsToCloud(){
  if(!currentUid || !cloudSyncReady) return;
  cloudUserDoc(currentUid).collection('state').doc('settings').set(settings).catch(function(e){});
}

function loadUserDataFromCloud(uid){
  cloudSyncReady = false;
  var stateRef = cloudUserDoc(uid).collection('state');
  Promise.all([
    stateRef.doc('active').get(),
    stateRef.doc('history').get(),
    stateRef.doc('settings').get()
  ]).then(function(results){
    var activeDoc = results[0], historyDoc = results[1], settingsDoc = results[2];
    if(activeDoc.exists && activeDoc.data().messages){
      activeChatMessages = activeDoc.data().messages;
      localStorage.setItem('jarvis_active_chat', JSON.stringify(activeChatMessages));
    }
    if(historyDoc.exists && historyDoc.data().sessions){
      chatHistorySessions = historyDoc.data().sessions;
      localStorage.setItem('jarvis_history_sessions', JSON.stringify(chatHistorySessions));
    }
    if(settingsDoc.exists){
      settings = Object.assign(settings, settingsDoc.data());
      localStorage.setItem('jarvis_settings', JSON.stringify(settings));
      applyTheme();
    }
    restoreActiveChat();
    cloudSyncReady = true;
    // (cloud data loaded silently — no toast, so app open doesn't feel noisy)
  }).catch(function(e){
    console.warn('cloud load failed, using local data', e);
    cloudSyncReady = true;
  });
}

/* =====================================================
   AUTO-SYNC LOOP — watches local data for changes and pushes to Firestore
   ===================================================== */
var lastSyncedActiveJSON = '', lastSyncedHistoryJSON = '', lastSyncedSettingsJSON = '';
function runAutoSyncTick(){
  if(!currentUid || !cloudSyncReady) return;
  var activeJSON = JSON.stringify(activeChatMessages);
  if(activeJSON !== lastSyncedActiveJSON){ lastSyncedActiveJSON = activeJSON; saveActiveChatToCloud(); }
  var historyJSON = JSON.stringify(chatHistorySessions);
  if(historyJSON !== lastSyncedHistoryJSON){ lastSyncedHistoryJSON = historyJSON; saveHistoryToCloud(); }
  var settingsJSON = JSON.stringify(settings);
  if(settingsJSON !== lastSyncedSettingsJSON){ lastSyncedSettingsJSON = settingsJSON; saveSettingsToCloud(); }
}
setInterval(runAutoSyncTick, 2500);

