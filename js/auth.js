/* =====================================================
   ONE TAP / GOOGLE / LOCAL ACCOUNTS  (unchanged logic, restyled)
   ===================================================== */
function openOneTap(){ renderOneTapList(); document.getElementById('oneTapOverlay').classList.add('show'); }
function closeOneTap(){ document.getElementById('oneTapOverlay').classList.remove('show'); }

var isGuestMode = false;
function continueAsGuest(){
  isGuestMode = true;
  localStorage.setItem('jarvis_guest_mode', 'true');
  closeOneTap();
  showToast('Continuing as Guest — chats stay on this device only');
  refreshProfileView();
}

function renderOneTapList(){
  var list = document.getElementById('oneTapAccountList');
  var divider = document.getElementById('oneTapDivider');
  list.innerHTML='';
  if(savedAccounts.length===0){ divider.style.display='none'; return; }
  divider.style.display='flex';
  savedAccounts.forEach(function(acc){
    var row = document.createElement('div');
    row.className='onetap-account-row';
    var avatarHtml = acc.picture
      ? '<img src="'+acc.picture+'" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;" referrerpolicy="no-referrer">'
      : '<div class="onetap-avatar" style="background:'+acc.color+';">'+initialsFor(acc.name, acc.email)+'</div>';
    row.innerHTML = avatarHtml +
      '<div class="onetap-account-info"><div class="onetap-account-name">'+escapeHtml(acc.name||acc.email.split('@')[0])+'</div>'+
      '<div class="onetap-account-email">'+escapeHtml(acc.email)+'</div></div>'+
      '<i class="fa-solid fa-trash onetap-remove" title="Remove"></i><i class="fa-solid fa-chevron-right onetap-chevron"></i>';
    row.onclick = function(){
      closeOneTap();
      openAuthForm('login', true);
      document.getElementById('authEmailInput').value = acc.email;
      document.getElementById('authPassInput').focus();
      showToast('Enter password to continue as ' + (acc.name || acc.email));
    };
    row.querySelector('.onetap-remove').addEventListener('click', function(e){ e.stopPropagation(); removeAccount(e, acc.email); });
    list.appendChild(row);
  });
}
function onFirebaseUserReady(user, silent){
  currentUid = user.uid;
  isLoggedIn = true;
  currentUserEmail = user.email || '';
  currentUserName = user.displayName || (currentUserEmail ? currentUserEmail.split('@')[0] : 'Chief');

  var picture = user.photoURL || "";
  var existing = savedAccounts.find(function(a){return a.email===currentUserEmail;});
  if(existing){ existing.name=currentUserName; existing.picture=picture; }
  else if(currentUserEmail){ savedAccounts.push({email:currentUserEmail,name:currentUserName,picture:picture,color:colorForEmail(currentUserEmail)}); }
  localStorage.setItem('jarvis_saved_accounts', JSON.stringify(savedAccounts));
  localStorage.setItem('jarvis_last_active_email', currentUserEmail);

  saveProfileToCloud(user.uid, { email: currentUserEmail, name: currentUserName, picture: picture });
  loadUserDataFromCloud(user.uid);

  closeOneTap();
  if(!silent) showToast('Signed in as ' + currentUserName);
  refreshProfileView();
}

function removeAccount(evt, email){
  evt.stopPropagation();
  savedAccounts = savedAccounts.filter(function(a){return a.email!==email;});
  localStorage.setItem('jarvis_saved_accounts', JSON.stringify(savedAccounts));
  renderOneTapList();
  showToast('Removed from this device (account itself is unaffected)');
}
function openAuthForm(mode, fromOneTap){
  closeOneTap(); authMode = mode||'login'; applyAuthModeUI();
  document.getElementById('backToOneTapBtn').style.display = (fromOneTap && savedAccounts.length>0) ? 'block' : 'none';
  document.getElementById('authFormSection').style.display='block';
  document.getElementById('profileActiveSection').style.display='none';
  switchTab('profile','btn-profile');
}
function toggleAuthMode(){ authMode = authMode==='login' ? 'signup' : 'login'; applyAuthModeUI(); }
function applyAuthModeUI(){
  var s = authMode==='signup';
  document.getElementById('authNameInput').style.display = s?'block':'none';
  document.getElementById('authFormTitle').innerText = s?'Create Account':'Identity Core';
  document.getElementById('authSubmitBtn').innerText = s?'Sign Up':'Login Securely';
  document.getElementById('authSubmitBtn').setAttribute('onclick', "handleAuth('"+authMode+"')");
  document.getElementById('authToggleText').innerText = s?'Already have an account?':'New here?';
  document.getElementById('authToggleLink').innerText = s?'Login instead':'Create account';
}
function handleAuth(action){
  if(action==='signup'){
    var name=document.getElementById('authNameInput').value.trim();
    var email=document.getElementById('authEmailInput').value.trim();
    var pass=document.getElementById('authPassInput').value.trim();
    if(!email||!pass){ showToast('Enter email and password'); return; }
    fbAuth.createUserWithEmailAndPassword(email, pass).then(function(cred){
      if(name){ return cred.user.updateProfile({displayName:name}).then(function(){ return cred.user; }); }
      return cred.user;
    }).then(function(user){ onFirebaseUserReady(user); clearAuthInputs(); })
      .catch(function(err){ showToast(err.message); });
    return;
  }
  if(action==='login'){
    var email=document.getElementById('authEmailInput').value.trim();
    var pass=document.getElementById('authPassInput').value.trim();
    if(!email||!pass){ showToast('Enter email and password'); return; }
    fbAuth.signInWithEmailAndPassword(email, pass).then(function(cred){
      onFirebaseUserReady(cred.user); clearAuthInputs();
    }).catch(function(err){
      if(err.code === 'auth/user-not-found'){
        // Auto-signup: first-time login creates the account
        fbAuth.createUserWithEmailAndPassword(email, pass).then(function(cred){
          onFirebaseUserReady(cred.user); clearAuthInputs();
        }).catch(function(e2){ showToast(e2.message); });
      } else {
        showToast(err.message);
      }
    });
    return;
  }
  if(action==='logout'){
    fbAuth.signOut().then(function(){
      isLoggedIn=false; currentUserEmail=""; currentUserName=""; currentUid=null; cloudSyncReady=false;
      localStorage.removeItem('jarvis_last_active_email');
      showToast('Logged out');
      refreshProfileView();
    });
  }
}
function clearAuthInputs(){
  document.getElementById('authNameInput').value='';
  document.getElementById('authEmailInput').value='';
  document.getElementById('authPassInput').value='';
}
function refreshProfileView(){
  var authForm=document.getElementById('authFormSection'), activeSection=document.getElementById('profileActiveSection');
  if(isLoggedIn){
    authForm.style.display='none'; activeSection.style.display='block';
    var accRecord = savedAccounts.find(function(a){return a.email===currentUserEmail;});
    var avatarEl = document.getElementById('profileAvatar');
    if(accRecord && accRecord.picture){
      avatarEl.style.background='transparent';
      avatarEl.innerHTML='<img src="'+accRecord.picture+'" style="width:100%;height:100%;border-radius:50%;" referrerpolicy="no-referrer">';
    } else {
      avatarEl.style.background=colorForEmail(currentUserEmail);
      avatarEl.innerText=initialsFor(currentUserName, currentUserEmail);
    }
    document.getElementById('profileNameDisplay').innerText = currentUserName || currentUserEmail.split('@')[0];
    document.getElementById('activeEmailDisplay').innerText = currentUserEmail;
  } else {
    authForm.style.display='block'; activeSection.style.display='none';
    authMode='login'; applyAuthModeUI();
    document.getElementById('backToOneTapBtn').style.display = savedAccounts.length>0 ? 'block':'none';
    document.getElementById('guestBanner').style.display = isGuestMode ? 'block' : 'none';
  }
}

/* Google Sign-In — uses Firebase Authentication's built-in Google provider.
   We force LOCAL persistence (plain localStorage) before redirecting, since
   the default persistence can get storage-partitioned on mobile Chrome when
   the auth domain (firebaseapp.com) differs from the hosting domain
   (github.io) — that partitioning is what causes "missing initial state"
   and popups silently reporting closed-by-user. */
function signInWithGoogleFirebase(){
  var provider = new firebase.auth.GoogleAuthProvider();
  closeOneTap();
  fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(function(){
    return fbAuth.signInWithRedirect(provider);
  }).catch(function(err){
    showToast('Google sign-in failed: ' + err.message);
  });
}
function checkGoogleRedirectResult(){
  fbAuth.getRedirectResult().then(function(result){
    if(result && result.user){ onFirebaseUserReady(result.user); }
  }).catch(function(err){
    if(err && err.code && err.code !== 'auth/no-current-user') showToast('Google sign-in failed: ' + err.message);
  });
}

