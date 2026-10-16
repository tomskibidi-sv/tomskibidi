"use strict";

const play = { quiz: null, hash: "", quizId: "", avatar: AVATAR_PICS[0], custom: "", index: 0, score: 0, startedAt: 0, timer: 0 };

function startQuiz() {
  if (!$("play-nick").value.trim()) { $("play-msg").textContent = "Nhập tên của bạn trước nhé!"; return; }
  Object.assign(play, { index: 0, score: 0, startedAt: Date.now() });
  
  // Ẩn màn hình intro, kết quả và nút trang chủ khi đang làm bài
  $("play-intro").hidden = $("play-result").hidden = true;
  if ($("play-home")) $("play-home").hidden = true;

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
    btn.classList.add(j === q.a ? "ok" : j === choice ? "bad" : "dim");
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

  // Hiển thị lại nút Trang chủ ở màn hình kết quả
  if ($("play-home")) $("play-home").hidden = false;

  $("result-title").innerHTML = `${avatarHtml(avatar)} ${escapeHtml(nick)}: ${score}/${total} điểm, ${formatTime(ms)}`;
  $("result-text").textContent =
    score >= 9 ? "Bạn thân xịn xò luôn!" :
    score >= 6 ? "Hiểu nhau khá đó!" :
    score >= 3 ? "Cần tâm sự thêm nha." : "Mới quen hả trời?";

  await scoreStore.save(play.quizId, { nick, av: avatar, score, ms, at: Date.now() });
  refreshBoard();
}

// 5 ảnh có sẵn + ảnh người chơi tải lên (nếu có) + nút "+" để tải ảnh.
function renderAvatars() {
  const pics = play.custom ? [...AVATAR_PICS, play.custom] : AVATAR_PICS;
  $("play-avatars").innerHTML = pics.map((src) => `
    <button type="button" class="avatar${src === play.avatar ? " on" : ""}" data-a="${escapeHtml(src)}" aria-label="Chọn avatar">
      <img src="${escapeHtml(src)}" alt="">
    </button>`).join("") + `
    <label class="avatar-upload" title="Tải ảnh lên">+<input type="file" accept="image/*" hidden></label>`;
}

function bind() {
  renderAvatars();
  $("play-avatars").onclick = ({ target }) => {
    const btn = target.closest(".avatar");
    if (!btn) return;
    play.avatar = btn.dataset.a;
    renderAvatars();
  };
  $("play-avatars").onchange = async ({ target }) => {
    const file = target.files && target.files[0];
    const img = file && await cropSquare(file);
    if (!img) return;
    play.custom = play.avatar = img;
    renderAvatars();
  };

  document.querySelectorAll(".answer").forEach((btn) => { btn.onclick = () => chooseAnswer(+btn.dataset.i); });
  $("play-next").onclick = nextQuestion;
  $("play-start").onclick = startQuiz;
  
  // Xử lý nút Làm lại
  $("play-again").onclick = () => {
    $("play-result").hidden = true;
    $("play-intro").hidden = false;
    if ($("play-home")) $("play-home").hidden = false;
  };

  // Nút quay về trang chủ
  if ($("play-home")) {
    $("play-home").onclick = () => { location.href = "index.html"; };
  }

  // Nút tạo bộ câu hỏi riêng ở màn hình kết quả
  if ($("play-create-own")) {
    $("play-create-own").onclick = () => { location.href = "index.html"; };
  }

}

async function refreshBoard() {
  renderBoard(await scoreStore.list(play.quizId), play.quiz.q.length);
}

async function init() {
  const setTitle = (text) => { const el = $("play-title"); if (el) el.textContent = text; };
  bind();
  play.hash = location.hash.slice(1);
  try { play.quiz = await decodeInvite(play.hash); } catch (err) { play.quiz = null; }

  if (!play.quiz) {
    setTitle("Link không hợp lệ hoặc đã bị cắt mất");
    $("play-intro").hidden = true;
    $("play-board").hidden = true;
    return;
  }
  play.quizId = hashText(play.hash);
  setTitle(`Bạn thân ${play.quiz.n} đoán đúng bao nhiêu?`);
  refreshBoard();
  setInterval(refreshBoard, 15000); // cập nhật bảng xếp hạng mỗi 15 giây
}

init();
