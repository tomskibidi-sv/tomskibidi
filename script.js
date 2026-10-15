"use strict";

/* ========== 1. DỮ LIỆU CÓ SẴN ========== */
const QUESTION_COUNT = 10;

// Mỗi câu: [câu hỏi, đáp án A, đáp án B]
const BANK = [
  ["Món ăn mình thích nhất là gì?", "Phở", "Pizza"],
  ["Mình sợ gì nhất?", "Gián", "Ma"],
  ["Cuối tuần mình thích làm gì?", "Ngủ nướng", "Đi chơi"],
  ["Màu mình thích nhất?", "Đỏ", "Xanh dương"],
  ["Mình hay trễ hẹn không?", "Luôn luôn", "Thỉnh thoảng"],
  ["Mình thích nghe nhạc gì?", "Pop", "Rap"],
  ["Mình thích mùa nào nhất?", "Xuân", "Hạ"],
  ["Mình muốn đi du lịch ở đâu?", "Biển", "Núi"],
  ["Mình giận thì sẽ làm gì?", "Im lặng", "Nói liền"],
  ["Món ăn vặt mình mê nhất?", "Trà sữa", "Xiên que"],
  ["Mình là cú đêm hay chim sớm?", "Cú đêm", "Chim sớm"],
  ["Mình thích con vật nào nhất?", "Chó", "Mèo"],
];

const AVATARS = ["🐶", "🐱", "🐰", "🦊", "🐼", "🐸", "🐵", "🦄", "🐧", "🐯", "🐨", "🐙"];

/* ========== 2. HÀM TIỆN ÍCH ========== */
const $ = (id) => document.getElementById(id);

const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const formatTime = (ms) => `${(ms / 1000).toFixed(1)} giây`;

// Điểm cao hơn thắng; bằng điểm thì ai nhanh hơn thắng.
const isBetter = (a, b) => a.score > b.score || (a.score === b.score && a.ms < b.ms);

const encodeQuiz = (quiz) => btoa(unescape(encodeURIComponent(JSON.stringify(quiz))));
const decodeQuiz = (text) => JSON.parse(decodeURIComponent(escape(atob(text))));

function hashText(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return "x" + (h >>> 0).toString(36);
}

// Thu nhỏ ảnh để link không quá dài.
function resizeImage(file, maxSize = 360) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.55));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ========== 3. LƯU TRỮ ==========
   Trên claude.ai: lưu vào cơ sở dữ liệu dùng chung (db).
   Chạy file riêng: bảng xếp hạng lưu trong trình duyệt (chỉ trên máy này),
   link câu hỏi mang theo toàn bộ dữ liệu. */
const store = {
  db: null,
  uid: null,
  localListener: null,

  async init() {
    try {
      if (window.claude?.use) {
        this.db = await claude.use("db");
        const user = await claude.use("user");
        this.uid = user ? await user.id() : null;
      }
    } catch (err) {
      this.db = null;
    }
  },

  async saveQuiz(id, quiz) {
    if (!this.db) return false;
    await this.db.collection("quizzes").doc(id).set(quiz);
    return true;
  },

  async loadQuiz(id) {
    if (!this.db) return null;
    const snap = await this.db.collection("quizzes").doc(id).get();
    return snap.exists ? snap.data() : null;
  },

  readLocal(quizId) {
    try { return JSON.parse(localStorage.getItem("scores:" + quizId)) || {}; }
    catch (err) { return {}; }
  },

  async saveScore(quizId, record) {
    if (this.db) {
      if (!this.uid) throw new Error("not signed in");
      const ref = this.db.collection(`scores/${quizId}/r`).doc(this.uid);
      const old = await ref.get();
      if (!old.exists || isBetter(record, old.data())) await ref.set(record);
      return;
    }
    const all = this.readLocal(quizId);
    if (!all[record.nick] || isBetter(record, all[record.nick])) all[record.nick] = record;
    try { localStorage.setItem("scores:" + quizId, JSON.stringify(all)); } catch (err) { /* bỏ qua */ }
    this.localListener?.(Object.values(all));
  },

  watchScores(quizId, callback) {
    if (this.db) {
      this.db.collection(`scores/${quizId}/r`).onSnapshot(
        (snap) => callback(snap.docs.map((d) => d.data())),
        () => callback(null)
      );
    } else {
      this.localListener = callback;
      callback(Object.values(this.readLocal(quizId)));
    }
  },
};

/* ========== 4. CHUYỂN TRANG ========== */
function showView(name) {
  for (const id of ["home", "make", "play"]) $("view-" + id).hidden = id !== name;
  window.scrollTo(0, 0);
}

/* ========== 5. TRANG TẠO CÂU HỎI ========== */
const make = { owner: "", items: [] };

const fromBank = (i) => ({ q: BANK[i][0], o: [BANK[i][1], BANK[i][2]], a: -1, img: "" });
const blankItem = () => ({ q: "", o: ["", ""], a: -1, img: "" });

function setMode(mode) {
  make.items = Array.from({ length: QUESTION_COUNT }, (_, i) => (mode === "template" ? fromBank(i) : blankItem()));
  $("mode-template").classList.toggle("on", mode === "template");
  $("mode-blank").classList.toggle("on", mode !== "template");
  renderMake();
}

function questionCard(item, i) {
  const options = item.o.map((text, j) => `
    <div class="opt">
      <input type="radio" name="right-${i}" data-k="a" data-i="${i}" value="${j}"
             ${item.a === j ? "checked" : ""} aria-label="Đáp án đúng">
      <input data-k="o" data-i="${i}" data-j="${j}" value="${escapeHtml(text)}"
             placeholder="Đáp án ${"AB"[j]}" aria-label="Đáp án ${"AB"[j]}">
    </div>`).join("");

  const image = item.img
    ? `<img class="preview" src="${item.img}" alt="Hình câu ${i + 1}">
       <button class="small" type="button" data-k="remove-img" data-i="${i}">Xoá hình</button>`
    : `<label class="upload">+ Thêm hình (không bắt buộc)
         <input type="file" accept="image/*" data-k="img" data-i="${i}" hidden>
       </label>`;

  return `
    <div class="card q">
      <h3>Câu ${i + 1}</h3>
      <input data-k="q" data-i="${i}" value="${escapeHtml(item.q)}"
             placeholder="Viết câu hỏi của bạn" aria-label="Câu hỏi ${i + 1}">
      ${options}
      ${image}
      <button class="small" type="button" data-k="swap" data-i="${i}">Gợi ý câu khác</button>
    </div>`;
}

function renderMake() {
  $("make-list").innerHTML = make.items.map(questionCard).join("");
  updateProgress();
}

function updateProgress() {
  const done = make.items.filter((it) => it.a >= 0).length;
  $("make-progress").textContent = `Đã chọn đáp án đúng: ${done}/${make.items.length}`;
}

function swapQuestion(i) {
  const used = make.items.map((it) => it.q);
  const free = BANK.map((_, n) => n).filter((n) => !used.includes(BANK[n][0]));
  const pool = free.length ? free : BANK.map((_, n) => n);
  make.items[i] = fromBank(pool[Math.floor(Math.random() * pool.length)]);
  renderMake();
}

function validateMake() {
  for (const [i, it] of make.items.entries()) {
    if (!it.q.trim() || it.o.some((t) => !t.trim())) return `Câu ${i + 1} còn ô trống, điền nốt nhé!`;
    if (it.a < 0) return `Câu ${i + 1} chưa chọn đáp án đúng.`;
  }
  return "";
}

async function createLink() {
  const error = validateMake();
  $("make-msg").textContent = error;
  if (error) return;

  const quiz = {
    n: make.owner,
    q: make.items.map((it) => ({
      q: it.q.trim(),
      o: it.o.map((t) => t.trim()),
      a: it.a,
      i: it.img || undefined,
    })),
  };

  const base = location.href.split("#")[0];
  const id = Math.random().toString(36).slice(2, 8);
  let link = `${base}#${encodeQuiz(quiz)}`;
  let message = "Xong rồi! Link này đã chứa sẵn 10 câu hỏi của bạn.";

  try {
    if (await store.saveQuiz(id, quiz)) {
      link = `${base}#${id}`;
      message = "Xong rồi! Gửi link này cho bạn thân nhé.";
    }
  } catch (err) { /* dùng link dài */ }

  if (link.length > 2000 && !link.endsWith(id)) message += " Link khá dài, gửi qua tin nhắn có thể bị cắt.";
  $("make-link").value = link;
  $("make-link").hidden = $("make-copy").hidden = false;
  $("make-msg").textContent = message;
}

function startMake(name) {
  make.owner = name;
  $("make-title").textContent = "Câu hỏi về " + name;
  $("make-link").hidden = $("make-copy").hidden = true;
  $("make-msg").textContent = "";
  setMode("template");
  showView("make");
}

function bindMake() {
  const list = $("make-list");

  list.addEventListener("input", ({ target: t }) => {
    const item = make.items[+t.dataset.i];
    if (t.dataset.k === "q") item.q = t.value;
    if (t.dataset.k === "o") item.o[+t.dataset.j] = t.value;
  });

  list.addEventListener("change", async ({ target: t }) => {
    const item = make.items[+t.dataset.i];
    if (t.dataset.k === "a") { item.a = +t.value; updateProgress(); }
    if (t.dataset.k === "img" && t.files[0]) { item.img = await resizeImage(t.files[0]); renderMake(); }
  });

  list.addEventListener("click", ({ target: t }) => {
    const i = +t.dataset.i;
    if (t.dataset.k === "swap") swapQuestion(i);
    if (t.dataset.k === "remove-img") { make.items[i].img = ""; renderMake(); }
  });

  $("mode-template").onclick = () => setMode("template");
  $("mode-blank").onclick = () => setMode("blank");
  $("make-back").onclick = () => showView("home");
  $("make-submit").onclick = createLink;
  $("make-copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("make-link").value);
      $("make-msg").textContent = "Đã sao chép link!";
    } catch (err) {
      $("make-link").select();
      $("make-msg").textContent = "Bấm giữ ô link để sao chép nhé.";
    }
  };
}

/* ========== 6. TRANG LÀM BÀI ========== */
const play = { quiz: null, quizId: "", avatar: AVATARS[0], index: 0, score: 0, startedAt: 0, timer: 0 };

async function openPlay(hash) {
  showView("play");
  const isShortId = hash.length <= 12;
  let quiz = null;

  try {
    quiz = isShortId ? await store.loadQuiz(hash) : decodeQuiz(hash);
  } catch (err) { /* quiz = null */ }

  if (!quiz) {
    $("play-title").textContent = isShortId && !store.db
      ? "Cần đăng nhập claude.ai để mở bộ câu hỏi này"
      : "Không tìm thấy bộ câu hỏi này";
    $("play-intro").hidden = true;
    return;
  }

  play.quiz = quiz;
  play.quizId = isShortId ? hash : hashText(hash);
  $("play-title").textContent = `Bạn thân ${quiz.n} đoán đúng bao nhiêu?`;
  store.watchScores(play.quizId, renderBoard);
}

function renderBoard(rows) {
  if (!rows) { $("board-msg").textContent = "Chưa tải được bảng xếp hạng."; return; }
  rows.sort((a, b) => b.score - a.score || a.ms - b.ms);
  
  const totalQuestions = play.quiz ? play.quiz.q.length : QUESTION_COUNT;

  $("board").innerHTML = rows.map((r, i) => {
    const scoreNum = +r.score || 0;
    const percent = Math.round((scoreNum / totalQuestions) * 100);

    return `
      <li class="card">
        <span class="rank">${i + 1}</span>
        <span class="face">${escapeHtml(r.av)}</span>
        <div class="board-item-details">
          <div class="board-meta">
            <b>${escapeHtml(r.nick)}</b>
            <span>${scoreNum}/${totalQuestions} điểm (${formatTime(+r.ms)})</span>
          </div>
          <div class="rank-progress-container">
            <div class="rank-progress-bar" style="width: ${percent}%;"></div>
          </div>
        </div>
      </li>`;
  }).join("");
  
  $("board-msg").textContent = rows.length ? "" : "Chưa có ai làm bài. Bạn sẽ là người đầu tiên!";
}
function startQuiz() {
  if (!$("play-nick").value.trim()) { $("play-msg").textContent = "Nhập tên của bạn trước nhé!"; return; }
  Object.assign(play, { index: 0, score: 0, startedAt: Date.now() });
  $("play-intro").hidden = $("play-result").hidden = true;
  $("play-quiz").hidden = false;
  clearInterval(play.timer);
  play.timer = setInterval(() => {
    $("play-timer").textContent = "Thời gian: " + formatTime(Date.now() - play.startedAt);
  }, 200);
  showQuestion();
}

function showQuestion() {
  const { quiz, index } = play;
  const q = quiz.q[index];

  $("play-count").textContent = `Câu ${index + 1}/${quiz.q.length}`;
  $("play-question").textContent = q.q;
  $("play-image").hidden = !q.i;
  if (q.i) $("play-image").src = q.i;

  document.querySelectorAll(".answer").forEach((btn, j) => {
    btn.textContent = q.o[j];
    btn.className = "answer";
    btn.disabled = false;
  });
  $("play-feedback").textContent = "";
  $("play-feedback").className = "feedback";
  $("play-next").hidden = true;
}

// Sau khi chọn: khoá nút, tô xanh đáp án đúng, tô đỏ nếu chọn sai.
function chooseAnswer(choice) {
  const q = play.quiz.q[play.index];
  const correct = choice === q.a;
  if (correct) play.score++;

  document.querySelectorAll(".answer").forEach((btn, j) => {
    btn.disabled = true;
    if (j === q.a) btn.classList.add("ok");
    else if (j === choice) btn.classList.add("bad");
    else btn.classList.add("dim");
  });

  $("play-feedback").textContent = correct ? "Đúng rồi! 🎉" : `Sai rồi! Đáp án đúng là "${q.o[q.a]}"`;
  $("play-feedback").className = "feedback " + (correct ? "ok" : "bad");
  $("play-next").textContent = play.index === play.quiz.q.length - 1 ? "Xem kết quả" : "Câu tiếp";
  $("play-next").hidden = false;
}

function nextQuestion() {
  play.index++;
  if (play.index >= play.quiz.q.length) finishQuiz();
  else showQuestion();
}

async function finishQuiz() {
  clearInterval(play.timer);
  const ms = Date.now() - play.startedAt;
  const total = play.quiz.q.length;
  const nick = $("play-nick").value.trim();
  const { score, avatar } = play;

  $("play-quiz").hidden = true;
  $("play-result").hidden = false;
  $("result-title").textContent = `${avatar} ${nick}: ${score}/${total} điểm, ${formatTime(ms)}`;
  $("result-text").textContent =
    score >= 9 ? "Bạn thân xịn xò luôn!" :
    score >= 6 ? "Hiểu nhau khá đó!" :
    score >= 3 ? "Cần tâm sự thêm nha." : "Mới quen hả trời?";

  try {
    await store.saveScore(play.quizId, { nick, av: avatar, score, ms, at: Date.now() });
  } catch (err) {
    $("board-msg").textContent = "Chưa lưu được điểm của bạn vào bảng xếp hạng.";
  }
}

function bindPlay() {
  $("play-avatars").innerHTML = AVATARS.map((a, i) =>
    `<button type="button" class="avatar${i ? "" : " on"}" data-a="${a}" aria-label="Avatar ${a}">${a}</button>`).join("");

  $("play-avatars").onclick = ({ target }) => {
    const btn = target.closest(".avatar");
    if (!btn) return;
    play.avatar = btn.dataset.a;
    document.querySelectorAll(".avatar").forEach((b) => b.classList.toggle("on", b === btn));
  };

  document.querySelectorAll(".answer").forEach((btn) => {
    btn.onclick = () => chooseAnswer(+btn.dataset.i);
  });
  $("play-next").onclick = nextQuestion;
  $("play-start").onclick = startQuiz;
  $("play-again").onclick = () => { $("play-result").hidden = true; $("play-intro").hidden = false; };
}

/* ========== 7. KHỞI ĐỘNG ========== */
function bindHome() {
  $("home-start").onclick = () => {
    const name = $("home-name").value.trim();
    if (!name) { $("home-msg").textContent = "Nhập tên của bạn để bắt đầu nhé!"; return; }
    startMake(name);
  };
}

async function init() {
  bindHome();
  bindMake();
  bindPlay();
  await store.init();

  const hash = location.hash.slice(1);
  if (hash) openPlay(hash);
}

init();
