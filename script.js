// Google Script endpoint
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyxqwYcNIqVAjV_KSRO6QiIXMJ2dYdvLehVPAOmAaWKg5l8KhZinhGdrrv1sZEs5ZbZ/exec";

let studentName = "";
let studentNIM = "";
let studentClass = "";
let questions = [];
let currentQuestions = [];
let timeLeft = 60 * 50; // default 50 minutes, will be set based on count
let timerInterval;
let answered = {};
let submitted = false;

// Load questions
async function loadQuestions() {
  const resp = await fetch('questions.json', {cache:'no-store'});
  questions = await resp.json();
}

// shuffle
function shuffle(a) {
  return a.sort(() => Math.random() - 0.5);
}

// build UI
function buildQuestions() {
  const container = document.getElementById('questions');
  const nav = document.getElementById('question-numbers');
  container.innerHTML = '';
  nav.innerHTML = '';

  currentQuestions.forEach((q,i) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'question';
    qDiv.id = 'q-'+i;
    const opts = q.options.map(opt => `
      <label class="options"><input type="radio" name="q${i}" value="${opt}"> ${opt}</label>
    `).join('');
    qDiv.innerHTML = `<p><strong>${i+1}. ${q.text}</strong></p>` + opts;
    container.appendChild(qDiv);

    const btn = document.createElement('div');
    btn.className = 'num';
    btn.textContent = i+1;
    btn.dataset.index = i;
    btn.onclick = () => document.getElementById('q-'+i).scrollIntoView({behavior:'smooth', block:'center'});
    nav.appendChild(btn);
  });

  // mark answered UI
  document.querySelectorAll('input[type=radio]').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const name = e.target.name; // q0, q1
      const idx = parseInt(name.replace('q',''));
      answered[currentQuestions[idx].id] = e.target.value;
      const btn = document.querySelector('.num[data-index="'+idx+'"]');
      if(btn) btn.classList.add('answered');
    });
  });
}

// timer
function startTimer(seconds) {
  timeLeft = seconds;
  updateTimer();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();
    if(timeLeft <= 0) {
      clearInterval(timerInterval);
      autoSubmit('waktu habis');
    }
  },1000);
}

function updateTimer() {
  const m = Math.floor(timeLeft/60);
  const s = timeLeft%60;
  document.getElementById('timer').textContent = `Waktu: ${m}:${s<10?'0'+s:s}`;
}

// submit
function collectAndSend(reason='manual') {
  if(submitted) return;
  submitted = true;
  clearInterval(timerInterval);
  const answers = {};
  currentQuestions.forEach((q,i)=>{
    const s = document.querySelector(`input[name=q${i}]:checked`);
    answers[q.id] = s ? s.value : '';
  });
  let score = 0;
  currentQuestions.forEach(q => {
    if(answers[q.id] && answers[q.id] === q.correct) score++;
  });
  const payload = {
    name: studentName,
    nim: studentNIM,
    class: studentClass,
    score,
    detail: answers,
    reason,
    timestamp: new Date().toISOString()
  };

  // save local backup
  try{ localStorage.setItem('lastExamResult', JSON.stringify(payload)); }catch(e){}

  // send to Google Sheets
  fetch(GOOGLE_SCRIPT_URL, {
    method:'POST',
    body: JSON.stringify(payload),
    mode:'no-cors'
  }).catch(()=>{});

  // show result page and replace history so can't go back
  document.getElementById('exam-page').style.display = 'none';
  document.getElementById('result-page').style.display = 'flex';
  document.getElementById('result-text').textContent = `Nama: ${studentName} | NIM: ${studentNIM} | Skor: ${score} / ${currentQuestions.length} (dikirim karena: ${reason})`;
  // replace history
  history.replaceState(null, '', location.pathname + '#result');
  window.addEventListener('popstate', function(){
    history.pushState(null, '', location.pathname + '#result');
  });
}

// auto submit wrapper
function autoSubmit(reason) {
  if(submitted) return;
  alert('Ujian akan dikirim otomatis: ' + reason);
  collectAndSend(reason);
}

// anti-cheat handlers
function setupAntiCheat() {
  // blur (tab switch / minimize)
  window.addEventListener('blur', () => {
    autoSubmit('keluar tab atau minimize');
  });

  // fullscreen exit detection
  document.addEventListener('fullscreenchange', () => {
    if(!document.fullscreenElement) {
      autoSubmit('keluar fullscreen');
    }
  });

  // disable right click
  document.addEventListener('contextmenu', e => {
    e.preventDefault();
    return false;
  });

  // detect common devtools keys and printscreen / copy paste
  window.addEventListener('keydown', (e) => {
    // Ctrl+Shift+I, Ctrl+Shift+J, F12
    if((e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) || e.key === 'F12') {
      autoSubmit('membuka developer tools');
      e.preventDefault();
    }
    // Ctrl+C or Ctrl+V
    if(e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'C' || e.key === 'V')) {
      autoSubmit('copy atau paste terdeteksi');
      e.preventDefault();
    }
    // PrintScreen key
    if(e.key === 'PrintScreen' || e.key === 'PrintScr' || e.key === 'PrtSc') {
      autoSubmit('mencoba screenshot');
      e.preventDefault();
    }
  });

  // detect right-click screenshots via keyup of PrintScreen on some browsers
  window.addEventListener('keyup', (e) => {
    if(e.key === 'PrintScreen') {
      autoSubmit('mencoba screenshot');
    }
  });

  // try to detect devtools by measuring window size changes (heuristic)
  let lastInnerWidth = window.innerWidth, lastInnerHeight = window.innerHeight;
  setInterval(() => {
    if(submitted) return;
    if(Math.abs(window.innerWidth - lastInnerWidth) > 200 || Math.abs(window.innerHeight - lastInnerHeight) > 200) {
      // big resize could be devtools open - don't be too aggressive, do a softer submit
      autoSubmit('perubahan ukuran mendadak (kemungkinan devtools)');
    }
    lastInnerWidth = window.innerWidth;
    lastInnerHeight = window.innerHeight;
  }, 2500);
}

// enforce fullscreen
async function requestFullscreen() {
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      await document.documentElement.webkitRequestFullscreen();
    }
  } catch(e) {
    console.warn('fullscreen failed', e);
  }
}

// initialization
document.getElementById('start-btn').addEventListener('click', async () => {
  studentName = document.getElementById('student-name').value.trim();
  studentNIM = document.getElementById('student-nim').value.trim();
  studentClass = document.getElementById('student-class').value.trim();

  if(!studentName || !studentNIM || !studentClass) {
    alert('Isi Nama, NIM, dan Kelas terlebih dahulu.');
    return;
  }

  await loadQuestions();
  currentQuestions = shuffle(questions);
  // set time: 70 seconds per soal as earlier? using 70s per question
  const totalSeconds = currentQuestions.length * 70;
  startTimer(totalSeconds);

  document.getElementById('login-page').style.display = 'none';
  document.getElementById('exam-page').style.display = 'block';
  document.getElementById('info-student').textContent = `${studentName} • NIM: ${studentNIM} • Kelas: ${studentClass}`;

  buildQuestions();
  setupAntiCheat();

  // request fullscreen - must be triggered by user gesture (button click)
  await requestFullscreen();

  // push history state so back button is disabled
  history.pushState(null, '', location.pathname + '#exam');
  window.addEventListener('popstate', function(){ history.pushState(null, '', location.pathname + '#exam'); });
});

// manual submit button
document.getElementById('submit-btn').addEventListener('click', () => {
  if(confirm('Kirim jawaban sekarang?')) collectAndSend('manual');
});

// prevent F5 / reload
window.addEventListener('beforeunload', function (e) {
  if(!submitted) {
    e.preventDefault();
    e.returnValue = '';
  }
});
