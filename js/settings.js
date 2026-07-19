/* =====================================================
   THEME
   ===================================================== */
function applyTheme(){
  document.body.classList.toggle('dark', settings.theme === 'dark');
  document.getElementById('darkModeToggle').checked = settings.theme === 'dark';
}
function toggleDarkMode(){
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('jarvis_settings', JSON.stringify(settings));
  applyTheme();
}

/* =====================================================
   SETTINGS PANEL
   ===================================================== */
function loadSettingsIntoUI(){
  document.getElementById('responseStyleSelect').value = settings.responseStyle;
  document.getElementById('typingSpeedSelect').value = settings.typingSpeed;
  document.getElementById('voiceOutputToggle').checked = settings.voiceOutput;
  document.getElementById('voiceGenderSelect').value = settings.voiceGender;
  document.getElementById('personalityModeSelect').value = settings.personalityMode;
  document.getElementById('systemPromptInput').value = settings.systemPrompt;
}
function saveSettingsFromUI(){
  settings.responseStyle = document.getElementById('responseStyleSelect').value;
  settings.typingSpeed = document.getElementById('typingSpeedSelect').value;
  settings.voiceOutput = document.getElementById('voiceOutputToggle').checked;
  settings.voiceGender = document.getElementById('voiceGenderSelect').value;
  settings.personalityMode = document.getElementById('personalityModeSelect').value;
  settings.systemPrompt = document.getElementById('systemPromptInput').value || settings.systemPrompt;
  localStorage.setItem('jarvis_settings', JSON.stringify(settings));
  showToast('Settings saved');
}
function refreshStats(){
  document.getElementById('statMessages').innerText = usage.messages;
  document.getElementById('statTokens').innerText = usage.tokens;
  document.getElementById('statSessions').innerText = chatHistorySessions.length;
  document.getElementById('statStatus').innerText = navigator.onLine ? 'Online' : 'Offline';
}

