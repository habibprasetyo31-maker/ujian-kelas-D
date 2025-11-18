const GOOGLE_SCRIPT_URL = "PASTE_URL_GOOGLE_SCRIPT_DI_SINI";

let studentName = "";
let studentNIM = "";
let studentClass = "";
let currentQuestions = [];
let timeLeft = 300;
let timerInterval;

// ================= LOAD SOAL =================
async function loadQuestions() {
  const response = await fetch("questions.json");
  return response.json();
}

// ================= MULAI UJIAN =================
async function startExam() {
  studentName = document.getElementById("student-name").value.trim();
  studentNIM = document.getElementById("student-nim").value.trim();
  studentClass = document.getElementById("student-class").value.trim();

  if (!studentName || !studentNIM || !studentClass) {
    alert("Harap isi Nama, NIM, dan Kelas!");
    return;
  }

  const q = await loadQuestions();
  currentQuestions = shuffle(q);

  showQuestions(currentQuestions);
  startTimer();

  document.getElementById("login-page").style.display = "none";
  document.getElementById("exam-page").style.display = "block";
}

// ================= ACak =================
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

// ================= TAMPILKAN SOAL =================
function showQuestions(questions) {
  const container = document.getElementById("questions");
  const nav = document.getElementById("question-numbers");

  container.innerHTML = "";
  nav.innerHTML = "";

  questions.forEach((q, i) => {
    container.innerHTML += `
      <div class="question">
        <p><b>${i + 1}.</b> ${q.text}</p>
        ${q.options.map(opt => `
          <label>
            <input type="radio" name="q${i}" value="${opt}">
            ${opt}
          </label>
        `).join("")}
      </div>
    `;

    const number = document.createElement("div");
    number.className = "number";
    number.textContent = i + 1;
    number.onclick = () => {
      document.getElementById("question-" + i)?.scrollIntoView({ behavior: "smooth" });
    };
    nav.appendChild(number);
  });
}

// ================= TIMER =================
function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;

    document.getElementById("timer").textContent =
      `Waktu: ${m}:${s < 10 ? "0" + s : s}`;

    if (timeLeft <= 0) submitExam(true);
  }, 1000);
}

// ================= SUBMIT =================
function submitExam(auto = false) {
  if (!auto) {
    if (!confirm("Kirim jawaban sekarang?")) return;
  }

  clearInterval(timerInterval);

  let score = 0;

  currentQuestions.forEach((q, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    if (selected && selected.value === q.correct) score++;
  });

  const result = {
    name: studentName,
    nim: studentNIM,
    class: studentClass,
    score,
  };

  // simpan localStorage
  localStorage.setItem("lastResult", JSON.stringify(result));

  // kirim ke Google Sheet
  fetch(https://script.google.com/macros/s/AKfycbyxqwYcNIqVAjV_KSRO6QiIXMJ2dYdvLehVPAOmAaWKg5l8KhZinhGdrrv1sZEs5ZbZ/exec, {
    method: "POST",
    body: JSON.stringify(result),
  });

  document.getElementById("exam-page").style.display = "none";
  document.getElementById("result-page").style.display = "block";
  document.getElementById("result-text").textContent =
    `Nama: ${studentName} | NIM: ${studentNIM} | Skor: ${score}`;
}
