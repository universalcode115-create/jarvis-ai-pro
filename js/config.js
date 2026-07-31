/* =====================================================
   CONFIG - GLOBAL VARIABLES
   ===================================================== */
// Yahan aapka Cloudflare Worker URL hai
var MY_WORKER_URL = "https://jarvis-groq-proxy.rk24363ywhsh.workers.dev";

// Dono variables define kiye hain taaki history.js aur chat_engine.js dono chalein
var GROQ_PROXY_URL = MY_WORKER_URL;
var GEMINI_PROXY_URL = MY_WORKER_URL;

// Gemini Flash model for fast, quality responses
var targetAiModel = "gemini-1.5-flash"; 

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
   STATE & STORAGE (Zaroori Variables)
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

// Image Generation URL Helper
function imageGenUrl(prompt){
  return "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=768&height=768&nologo=true";
}

// Confirm Config Loaded
console.log("Jarvis Config Loaded Successfully!");
