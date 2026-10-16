"use strict";

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
  renderBoard(await scoreStore.list(hashText(hash)), quiz.q.length);
}

init();
