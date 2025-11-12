// =======================
// SCRIPT.JS — Hybrid Anti-Cheat (Mode C)
// - Deteksi mobile/desktop
// - Anti-cheat ketat di desktop
// - Anti-cheat toleran di mobile (no resize auto-submit)
// - Tetap auto-submit pada blur (keluar tab/app) dan exit fullscreen
// - Kirim hasil ke Google Apps Script + localStorage backup
// =======================

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyxqwYcNIqVAjV_KSRO6QiIXMJ2dYdvLehVPAOmAaWKg5l8KhZinhGdrrv1sZEs5ZbZ/exec";

let studentName = "";
let studentNIM = "";
let studentClass = "";
let questions = [];
let currentQuestions = [];
let timeLeft = 0;
let timerInterval;
let answered = {};
let submitted = false;

// ---------- Device detection ----------
function isMobileDevice() {
  // Simple check: touch support + narrow screen OR common mobile keywords
  return (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
         /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent);
}

// ---------- Load questions ----------
async function loadQuestions() {
  const resp = await fetch('questions.json', { cache: 'no-store' });
  questions = await resp.json();
}

// ---------- Shuffle ----------
function shuffle(a) { return a.sort(() => Math.random() - 0.5); }

// ---------- Build UI ----------
function buildQuestionsUI() {
  const container = document.getElementById('questions');
  const nav = document.getElementById('question-numbers');
  container.innerHTML = '';
  nav.innerHTML = '';

  currentQuestions.forEach((q, i) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'question';
    qDiv.id = 'q-' + i;

    const optsHTML = q.options.map(opt => `
      <label class="options"><input type="radio" name="q${i}" value="${opt}"> ${opt}</label>
    `).join('');

    qDiv.innerHTML = `<p><strong>${i+1}. ${q.text}</strong></p>` + optsHTML;
    container.appendChild(qDiv);

    const btn = document.createElement('div');
    btn.className = 'num';
    btn.textContent = i+1;
    btn.dataset.index = i;
    btn.onclick = () => document.getElementById('q-'+i).scrollIntoView({ behavior:'smooth', block:'center' });
    nav.appendChild(btn);
  });

  // mark answered
  container.querySelectorAll('input[type=radio]').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const name = e.target.name; // q0, q1
      const idx = parseInt(name.replace('q',''));
      answered[currentQuestions[idx].id] = e.target.value;
      const btn = document.querySelector('.num[data-index="'+idx+'"]');
      if (btn) btn.classList.add('answered');
    });
  });
}

// ---------- Timer ----------
function startTimer(seconds) {
  timeLeft = seconds;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      autoSubmit('waktu habis');
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(timeLeft/60);
  const s = timeLeft % 60;
  const el = document.getElementById('timer');
  if (el) el.textContent = `Waktu: ${m}:${s < 10 ? '0'+s : s}`;
}

// ---------- Collect & Send ----------
function collectAndSend(reason = 'manual') {
  if (submitted) return;
  submitted = true;
  clearInterval(timerInterval);

  const answers = {};
  currentQuestions.forEach((q,i) => {
    const s = document.querySelector(`input[name=q${i}]:checked`);
    answers[q.id] = s ? s.value : '';
  });

  let score = 0;
  currentQuestions.forEach(q => {
    if (answers[q.id] && answers[q.id] === q.correct) score++;
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

  try { localStorage.setItem('lastExamResult', JSON.stringify(payload)); } catch (e) {}

  // send to Google Apps Script (no-cors to avoid CORS issues; it will still POST)
  fetch(GOOGLE_SCRIPT_URL, { method:'POST', body: JSON.stringify(payload), mode: 'no-cors' })
    .catch(()=>{ /* ignore send errors — we have local backup */ });

  // show result page and lock history (can't go back)
  document.getElementById('exam-page').style.display = 'none';
  document.getElementById('result-page').style.display = 'flex';
  document.getElementById('result-text').textContent = `Nama: ${studentName} | NIM: ${studentNIM} | Skor: ${score} / ${currentQuestions.length} (dikirim: ${reason})`;

  // replace history and prevent back navigation to exam
  history.replaceState(null, '', location.pathname + '#result');
  window.addEventListener('popstate', () => { history.replaceState(null, '', location.pathname + '#result'); });
}

function autoSubmit(reason) {
  if (submitted) return;
  // On mobile, show a short notice before auto-submitting (less aggressive) — but per rules we auto-submit for blur/exit-fullscreen
  alert('Ujian akan dikirim otomatis karena: ' + reason);
  collectAndSend(reason);
}

// ---------- Anti-cheat setup (Hybrid) ----------
function setupAntiCheat() {
  const mobile = isMobileDevice();

  // 1) Blur: always auto-submit (user left the tab/app)
  window.addEventListener('blur', () => {
    // On some mobile browsers blur fires on keyboard open; to avoid false positive,
    // ignore blur on mobile if it's immediately followed by focus (keyboard). We'll use a small timeout check.
    if (mobile) {
      let cancelled = false;
      const timer = setTimeout(() => { if (!cancelled) autoSubmit('keluar tab atau app (mobile)'); }, 1000);
      window.addEventListener('focus', () => { cancelled = true; clearTimeout(timer); }, { once: true });
    } else {
      autoSubmit('keluar tab atau app');
    }
  });

  // 2) Fullscreen exit: strict on both
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      autoSubmit('keluar fullscreen');
    }
  });

  // 3) Right click: disable
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // 4) Key detection — only apply stricter keys on desktop
  window.addEventListener('keydown', (e) => {
    if (mobile) {
      // On mobile skip developer keys and printscreen detection (not reliable)
      // Still detect virtual keyboard copy/paste keys? ignore to avoid false positive.
      return;
    }

    // Desktop checks:
    // Ctrl+Shift+I, Ctrl+Shift+J, F12 => devtools
    if ((e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) || e.key === 'F12') {
      autoSubmit('membuka developer tools');
      e.preventDefault();
      return;
    }

    // Ctrl+C / Ctrl+V (copy paste) -> auto
    if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'C' || e.key === 'V')) {
      autoSubmit('copy atau paste terdeteksi');
      e.preventDefault();
      return;
    }

    // PrintScreen on desktop
    if (e.key === 'PrintScreen' || e.key === 'PrintScr' || e.key === 'PrtSc') {
      autoSubmit('mencoba screenshot');
      e.preventDefault();
      return;
    }
  });

  // 5) Soft heuristics for devtools via resize — only on desktop
  if (!mobile) {
    let lastInnerWidth = window.innerWidth, lastInnerHeight = window.innerHeight;
    setInterval(() => {
      if (submitted) return;
      const dx = Math.abs(window.innerWidth - lastInnerWidth);
      const dy = Math.abs(window.innerHeight - lastInnerHeight);
      // if a large sudden change -> possible devtools open; be somewhat tolerant but still aggressive
      if (dx > 200 || dy > 200) {
        autoSubmit('perubahan ukuran mendadak (mungkin devtools)');
      }
      lastInnerWidth = window.innerWidth;
      lastInnerHeight = window.innerHeight;
    }, 1500);
  } else {
    // On mobile: monitor orientation change but do NOT auto-submit. Instead, show a warning.
    window.addEventListener('orientationchange', () => {
      // small timeout to allow orientation settle
      setTimeout(() => {
        showMobileWarning('Perubahan orientasi terdeteksi — pastikan tidak meninggalkan aplikasi.');
      }, 400);
    });

    // Avoid auto-submit on keyboard open (mobile). Keyboard often triggers resize; we ignore those for mobile.
    // But we can notify user when keyboard opens/closes if desired (optional).
  }

  // 6) Additional safety: intercept copy events and treat on desktop only
  window.addEventListener('copy', (e) => {
    if (!mobile) {
      autoSubmit('menyalin isi halaman');
      e.preventDefault();
    }
  });

  // 7) Prevent common navigation keys that might leave page (desktop)
  window.addEventListener('keydown', (e) => {
    if (submitted) return;
    // Prevent F5 reload (warn user)
    if (!mobile && (e.key === 'F5' || (e.ctrlKey && e.key === 'r'))) {
      e.preventDefault();
      if (confirm('Memuat ulang akan mengakhiri ujian. Apakah Anda ingin mengirim jawaban sekarang?')) {
        collectAndSend('reload terdeteksi');
      }
    }
  });
}

function showMobileWarning(msg) {
  // show non-blocking small in-page warning
  let w = document.getElementById('mobile-warning');
  if (!w) {
    w = document.createElement('div');
    w.id = 'mobile-warning';
    w.style.position = 'fixed';
    w.style.bottom = '14px';
    w.style.left = '50%';
    w.style.transform = 'translateX(-50%)';
    w.style.background = 'rgba(255,165,0,0.12)';
    w.style.color = '#ffdba3';
    w.style.padding = '8px 12px';
    w.style.borderRadius = '8px';
    w.style.backdropFilter = 'blur(6px)';
    w.style.zIndex = 9999;
    document.body.appendChild(w);
    setTimeout(() => { if (w) w.remove(); }, 5000);
  }
  w.textContent = msg;
}

// ---------- Fullscreen helper ----------
async function requestFullscreen() {
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      await document.documentElement.webkitRequestFullscreen();
    }
  } catch (e) {
    console.warn('fullscreen failed', e);
  }
}

// ---------- Initialization ----------
document.getElementById('start-btn').addEventListener('click', async () => {
  studentName = document.getElementById('student-name').value.trim();
  studentNIM = document.getElementById('student-nim').value.trim();
  studentClass = document.getElementById('student-class').value.trim();

  if (!studentName || !studentNIM || !studentClass) {
    alert('Isi Nama, NIM, dan Kelas terlebih dahulu.');
    return;
  }

  await loadQuestions();
  currentQuestions = shuffle(questions);

  // set time: use 70 seconds per question (same as earlier)
  const totalSeconds = currentQuestions.length * 70;
  startTimer(totalSeconds);

  document.getElementById('login-page').style.display = 'none';
  document.getElementById('exam-page').style.display = 'block';
  document.getElementById('info-student').textContent = `${studentName} • NIM: ${studentNIM} • Kelas: ${studentClass}`;

  buildQuestionsUI();
  setupAntiCheat();

  // request fullscreen (user gesture)
  await requestFullscreen();

  // push history to block back navigation
  history.pushState(null, '', location.pathname + '#exam');
  window.addEventListener('popstate', () => { history.pushState(null, '', location.pathname + '#exam'); });
});

// Manual submit
document.getElementById('submit-btn').addEventListener('click', () => {
  if (confirm('Kirim jawaban sekarang?')) collectAndSend('manual');
});

// prevent accidental unload (double-check)
window.addEventListener('beforeunload', function(e) {
  if (!submitted) {
    e.preventDefault();
    e.returnValue = '';
  }
});
