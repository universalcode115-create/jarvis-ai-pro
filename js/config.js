/* =====================================================
   CONFIG - GLOBAL VARIABLES
   ===================================================== */
// Cloudflare Worker URL (Bina aakhri slash ke)
var MY_WORKER_URL = "https://jarvis-groq-proxy.rk24363ywhsh.workers.dev";

var GROQ_PROXY_URL = MY_WORKER_URL;
var GEMINI_PROXY_URL = MY_WORKER_URL;

// Groq ka sabse smart aur fast model
var targetAiModel = "llama-3.1-70b-versatile"; 

// =====================================================
// FIREBASE CONFIG
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

var fbAuth = null, fbDb = null;
var currentUid = null;
var cloudSyncReady = false;

try {
  firebase.initializeApp(firebaseConfig);
  fbAuth = firebase.auth();
  fbDb = firebase.firestore();
} catch (e) {
  console.warn('Firebase failed to initialize.', e);
}

/* =====================================================
   STATE & STORAGE
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

function imageGenUrl(prompt){
  return "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=768&height=768&nologo=true";
}

console.log("Jarvis Optimized for Groq!");
