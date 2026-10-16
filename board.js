"use strict";

function renderBoard(rows, total) {
  rows.sort((a, b) => b.score - a.score || a.ms - b.ms);

  $("board").innerHTML = rows.map((r, i) => {
    const score = +r.score || 0;
    const percent = Math.round((score / total) * 100);
    return `
      <li class="card">
        <span class="rank">${i + 1}</span>
        <span class="face">${avatarHtml(r.av)}</span>
        <div class="board-item-details">
          <div class="board-meta">
            <b>${escapeHtml(r.nick)}</b>
            <span>${score}/${total} điểm (${formatTime(+r.ms)})</span>
          </div>
          <div class="rank-progress-container">
            <div class="rank-progress-bar" style="width: ${percent}%;"></div>
          </div>
        </div>
      </li>`;
  }).join("");

  $("board-msg").textContent = rows.length ? "" : "Chưa có ai làm bài. Bạn sẽ là người đầu tiên!";
}

async function init() {
  const hash = location.hash.slice(1);
  $("go-play").onclick = () => { location.href = hash ? "play.html#" + hash : "index.html"; };

  let quiz = null;
  try { quiz = await decodeInvite(hash); } catch (err) { /* link sai */ }

  if (!quiz) {
    $("board-title").textContent = "Chưa có bảng xếp hạng";
    $("board-msg").textContent = "Hãy mở trang này từ link mời hoặc từ màn hình kết quả.";
    $("go-play").hidden = true;
    return;
  }
  $("board-title").textContent = `Bảng xếp hạng của ${quiz.n}`;
  renderBoard(scoreStore.list(hashText(hash)), quiz.q.length);
}

init();