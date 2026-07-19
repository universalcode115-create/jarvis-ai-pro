/* =====================================================
   CONFIG
   ===================================================== */
// Text replies now go through a secure Cloudflare Worker proxy — the real
// Groq API key stays server-side and is never exposed in this public code.
var GROQ_PROXY_URL = "https://jarvis-groq-proxy.rk24363ywhsh.workers.dev/";
var targetAiModel = "groq/compound"; // handles normal chat + automatic real-time web search when needed

// Google Sign-In now uses Firebase Authentication's built-in Google provider
// directly (no separate Client ID needed) — see signInWithGoogleFirebase().

// =====================================================
// FIREBASE CONFIG — real backend (Authentication + Firestore database)
// =====================================================
var firebaseConfig = {
  apiKey: "AIzaSyCg5vul6GhRMQfaOxX9T-xgHLpNG4iKWuQ",
  authDomain: "jarvis-ai-pro-6308a.firebaseapp.com",
  projectId: "jarvis-ai-pro-6308a",
  storageBucket: "jarvis-ai-pro-6308a.firebasestorage.app",
  messagingSenderId: "866337220940",
  appId: "1:866337220940:web:17f207b7ebcd6e992487e9",
  measurementId: "G-4WBLLN31HD"
};
firebase.initializeApp(firebaseConfig);
var fbAuth = firebase.auth();
var fbDb = firebase.firestore();
var currentUid = null;
var cloudSyncReady = false;

// Free public image generation endpoint — no API key required.
function imageGenUrl(prompt){
  return "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=768&height=768&nologo=true";
}

/* =====================================================
   STATE
   ===================================================== */
var isLoggedIn = false, currentUserEmail = "", currentUserName = "", authMode = "login";
var activeChatMessages = JSON.parse(localStorage.getItem('jarvis_active_chat')) || [];
var chatHistorySessions = JSON.parse(localStorage.getItem('jarvis_history_sessions')) || [];
var savedAccounts = JSON.parse(localStorage.getItem('jarvis_saved_accounts')) || [];
var settings = Object.assign({
  theme:'light', responseStyle:'concise', typingSpeed:'slow', voiceOutput:false, personalityMode:'normal', voiceGender:'female',
  systemPrompt:"You are Jarvis, a sharp and helpful personal AI assistant. Be warm but efficient."
}, JSON.parse(localStorage.getItem('jarvis_settings') || '{}'));
var usage = Object.assign({messages:0, tokens:0}, JSON.parse(localStorage.getItem('jarvis_usage') || '{}'));

var AVATAR_COLORS = ['#0284c7','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6'];
var recognizer = null, isListening = false;

