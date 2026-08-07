/* =====================================================
   JARVIS PRO - CONTINUOUS VOICE CHAT
   Listen → Think → Speak → Listen Again
   ===================================================== */

window.voiceChatRecognizer = window.voiceChatRecognizer || null;
window.voiceChatActive = window.voiceChatActive || false;

var speakingNow = false;
var fullReplyText = '';
var streamDone = false;
var voiceRequestRunning = false;


/* =====================================================
   OPEN VOICE CHAT
   ===================================================== */

function openVoiceChat() {
  window.voiceChatActive = true;
  speakingNow = false;
  voiceRequestRunning = false;

  document.getElementById('voiceOverlay').classList.add('show');
  document.getElementById('voiceStatus').innerText = 'Listening...';

  voiceChatListenOnce();
}


/* =====================================================
   CLOSE VOICE CHAT
   ===================================================== */

function closeVoiceChat() {
  window.voiceChatActive = false;
  speakingNow = false;
  voiceRequestRunning = false;

  // Stop AI voice
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // Stop microphone recognition
  if (window.voiceChatRecognizer) {
    try {
      window.voiceChatRecognizer.abort();
    } catch (e) {}

    window.voiceChatRecognizer = null;
  }

  var overlay = document.getElementById('voiceOverlay');
  if (overlay) {
    overlay.classList.remove('show');
  }

  var status = document.getElementById('voiceStatus');
  if (status) {
    status.innerText = 'Voice Chat Closed';
  }
}


/* =====================================================
   START LISTENING
   ===================================================== */

function voiceChatListenOnce() {

  var SR = window.SpeechRecognition ||
           window.webkitSpeechRecognition;

  if (!SR || !window.voiceChatActive) {
    return;
  }

  // Don't start microphone while AI is speaking
  if (speakingNow || voiceRequestRunning) {
    return;
  }

  // Stop previous recognizer if any
  if (window.voiceChatRecognizer) {
    try {
      window.voiceChatRecognizer.abort();
    } catch (e) {}
  }

  var recognizer = new SR();

  window.voiceChatRecognizer = recognizer;

  recognizer.lang = 'en-IN';

  // Don't continuously keep one recognition session alive
  // We manually restart it after every completed turn.
  recognizer.continuous = false;
  recognizer.interimResults = true;
  recognizer.maxAlternatives = 1;


  /* ===================================================
     WHEN USER SPEAKS
     =================================================== */

  recognizer.onresult = function(e) {

    var lastResult =
      e.results[e.results.length - 1];

    var text =
      lastResult[0].transcript.trim();

    if (!text) return;

    var transcript =
      document.getElementById('voiceTranscript');

    if (transcript) {
      transcript.innerText = 'You: ' + text;
    }

    // Only send final result
    if (lastResult.isFinal) {

      voiceRequestRunning = true;

      // Stop microphone before sending request
      try {
        recognizer.stop();
      } catch (err) {}

      voiceChatSendAndSpeak(text);
    }
  };


  /* ===================================================
     RECOGNITION END
     =================================================== */

  recognizer.onend = function() {

    // Ignore old recognizer
    if (window.voiceChatRecognizer !== recognizer) {
      return;
    }

    // If chat was closed, do nothing
    if (!window.voiceChatActive) {
      return;
    }

    // Don't restart while AI is thinking/speaking
    if (speakingNow || voiceRequestRunning) {
      return;
    }

    // Automatically listen again
    setTimeout(function() {

      if (
        window.voiceChatActive &&
        !speakingNow &&
        !voiceRequestRunning
      ) {
        voiceChatListenOnce();
      }

    }, 300);
  };


  /* ===================================================
     RECOGNITION ERROR
     =================================================== */

  recognizer.onerror = function(e) {

    console.log(
      'Voice recognition error:',
      e.error
    );

    if (!window.voiceChatActive) {
      return;
    }

    // Ignore normal no-speech error
    if (e.error === 'no-speech') {

      setTimeout(function() {

        if (
          window.voiceChatActive &&
          !speakingNow &&
          !voiceRequestRunning
        ) {
          voiceChatListenOnce();
        }

      }, 500);

      return;
    }

    // Permission / microphone error
    if (e.error === 'not-allowed' ||
        e.error === 'service-not-allowed') {

      var status =
        document.getElementById('voiceStatus');

      if (status) {
        status.innerText =
          'Microphone permission required';
      }

      return;
    }
  };


  /* ===================================================
     START RECOGNITION
     =================================================== */

  try {

    var status =
      document.getElementById('voiceStatus');

    if (status) {
      status.innerText = 'Listening...';
    }

    recognizer.start();

  } catch (e) {

    console.log(
      'Recognizer start error:',
      e
    );
  }
}


/* =====================================================
   SEND USER TEXT → AI → SPEAK
   ===================================================== */

function voiceChatSendAndSpeak(text) {

  if (!window.voiceChatActive || !text) {
    voiceRequestRunning = false;
    return;
  }

  speakingNow = false;
  fullReplyText = '';
  streamDone = false;

  var status =
    document.getElementById('voiceStatus');

  if (status) {
    status.innerText = 'Thinking...';
  }


  // Save user message
  if (typeof saveAndAppendMessage === 'function') {
    saveAndAppendMessage('user', text);
  }


  // Create AI placeholder
  var id = 'ai-voice-' + Date.now();

  if (typeof appendAiPlaceholder === 'function') {
    appendAiPlaceholder(id);
  }


  fetch(GROQ_PROXY_URL, {

    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      messages: buildConversationPayload(text),
      stream: true
    })

  })

  .then(function(res) {

    if (!res.ok) {
      throw new Error(
        'AI request failed: ' + res.status
      );
    }

    if (!res.body) {
      throw new Error(
        'Streaming not supported'
      );
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder();

    var buffer = "";


    /* ================================================
       READ STREAM
       ================================================ */

    function pump() {

      return reader.read().then(function(result) {

        var done = result.done;
        var value = result.value;

        if (done) {

          streamDone = true;
          voiceRequestRunning = false;

          // Update UI
          var finalStatus =
            document.getElementById('voiceStatus');

          if (finalStatus && !speakingNow) {
            finalStatus.innerText = 'Speaking...';
          }

          // Download buttons
          setTimeout(function() {

            if (
              typeof addDownloadButtons === 'function'
            ) {
              addDownloadButtons(id);
            }

          }, 500);


          // Speak COMPLETE response
          if (fullReplyText.trim()) {

            startSpeaking(fullReplyText);

          } else {

            // Nothing received → listen again
            setTimeout(function() {

              if (window.voiceChatActive) {
                voiceChatListenOnce();
              }

            }, 500);
          }

          return;
        }


        var chunk =
          decoder.decode(
            value,
            { stream: true }
          );

        buffer += chunk;


        // Process complete SSE lines
        var lines =
          buffer.split('\n');

        buffer =
          lines.pop() || '';


        lines.forEach(function(line) {

          line = line.trim();

          if (!line.startsWith('data:')) {
            return;
          }

          var data =
            line.slice(5).trim();

          if (!data || data === '[DONE]') {
            return;
          }


          try {

            var json =
              JSON.parse(data);

            var piece = '';


            /*
             * Supports your current response format
             */

            if (
              json.candidates &&
              json.candidates[0] &&
              json.candidates[0].content &&
              json.candidates[0].content.parts &&
              json.candidates[0].content.parts[0]
            ) {

              piece =
                json.candidates[0]
                  .content.parts[0].text || '';
            }


            /*
             * Also supports OpenAI/Groq-style
             * streaming response
             */

            if (
              json.choices &&
              json.choices[0] &&
              json.choices[0].delta
            ) {

              piece =
                json.choices[0]
                  .delta.content || '';
            }


            if (!piece) return;


            fullReplyText += piece;


            // Update AI message on screen
            var el =
              document.getElementById(id);

            if (el) {

              var body =
                el.querySelector('.msg-body');

              if (body &&
                  typeof renderMarkdown === 'function') {

                body.innerHTML =
                  renderMarkdown(
                    fullReplyText
                  );
              }
            }

          } catch (e) {

            // Ignore incomplete SSE chunks
            console.log(
              'Stream parse:',
              e
            );
          }

        });


        return pump();

      });
    }


    return pump();

  })

  .catch(function(error) {

    console.error(
      'Voice AI error:',
      error
    );

    voiceRequestRunning = false;
    speakingNow = false;


    var status =
      document.getElementById('voiceStatus');

    if (status) {
      status.innerText =
        'Something went wrong';
    }


    // Automatically return to listening
    setTimeout(function() {

      if (window.voiceChatActive) {
        voiceChatListenOnce();
      }

    }, 1000);

  });
}


/* =====================================================
   TEXT TO SPEECH
   ===================================================== */

function startSpeaking(text) {

  if (!window.voiceChatActive) {
    return;
  }

  if (!text || !text.trim()) {
    voiceChatListenOnce();
    return;
  }


  speakingNow = true;

  // Stop any previous speech
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }


  var cleanText = text

    // Remove markdown
    .replace(/```[\s\S]*?```/g, ' ')

    .replace(/[*#`_~]/g, '')

    // Remove markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    // Remove excessive whitespace
    .replace(/\s+/g, ' ')

    .trim();


  var utter =
    new SpeechSynthesisUtterance(
      cleanText
    );


  utter.lang = 'en-IN';

  // Change speed if needed
  utter.rate = 1.0;

  utter.pitch = 1.0;


  utter.onstart = function() {

    if (!window.voiceChatActive) {
      window.speechSynthesis.cancel();
      return;
    }

    var status =
      document.getElementById('voiceStatus');

    if (status) {
      status.innerText = 'Speaking...';
    }
  };


  utter.onend = function() {

    speakingNow = false;


    if (!window.voiceChatActive) {
      return;
    }


    var status =
      document.getElementById('voiceStatus');

    if (status) {
      status.innerText =
        'Listening...';
    }


    // AI finished speaking → microphone ON again
    setTimeout(function() {

      if (
        window.voiceChatActive &&
        !speakingNow &&
        !voiceRequestRunning
      ) {

        voiceChatListenOnce();

      }

    }, 400);
  };


  utter.onerror = function(e) {

    console.log(
      'Speech synthesis error:',
      e
    );

    speakingNow = false;


    if (!window.voiceChatActive) {
      return;
    }


    setTimeout(function() {

      if (
        window.voiceChatActive &&
        !speakingNow &&
        !voiceRequestRunning
      ) {

        voiceChatListenOnce();

      }

    }, 500);
  };


  window.speechSynthesis.speak(utter);
                                       }
