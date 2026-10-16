"use strict";

const make = { owner: "", items: [] };

const fromBank = (i) => ({ q: BANK[i][0], o: [BANK[i][1], BANK[i][2]], a: -1, img: "" });
const blankItem = () => ({ q: "", o: ["", ""], a: -1, img: "" });

function setMode(mode) {
  make.items = Array.from({ length: QUESTION_COUNT }, (_, i) => (mode === "template" ? fromBank(i) : blankItem()));
  $("mode-template").classList.toggle("on", mode === "template");
  $("mode-blank").classList.toggle("on", mode !== "template");
  render();
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
    : `<label class="upload">+ Thêm hình (làm link dài hơn)
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

function render() {
  $("make-list").innerHTML = make.items.map(questionCard).join("");
  updateProgress();
}

function updateProgress() {
  const done = make.items.filter((it) => it.a >= 0).length;
  $("make-progress").textContent = `Đã chọn: ${done}/${make.items.length}`;
}

function swapQuestion(i) {
  const used = make.items.map((it) => it.q);
  const free = BANK.map((_, n) => n).filter((n) => !used.includes(BANK[n][0]));
  const pool = free.length ? free : BANK.map((_, n) => n);
  make.items[i] = fromBank(pool[Math.floor(Math.random() * pool.length)]);
  render();
}

function validate() {
  for (const [i, it] of make.items.entries()) {
    if (!it.q.trim() || it.o.some((t) => !t.trim())) return `Câu ${i + 1} còn ô trống, điền nốt nhé!`;
    if (it.a < 0) return `Câu ${i + 1} chưa chọn đáp án đúng.`;
  }
  return "";
}

async function createLink() {
  const error = validate();
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

  const link = `${pageUrl("play.html")}#${await encodeInvite(quiz)}`;
  $("make-link").value = link;
  $("make-link").hidden = $("make-copy").hidden = false;
  $("make-msg").textContent = `Done,Link dài ${link.length} ký tự.` +
    (quiz.q.some((it) => it.i) ? " Có hình nên link khá dài, gửi qua tin nhắn có thể bị cắt." : "");
}

function bind() {
  const list = $("make-list");

  list.addEventListener("input", ({ target: t }) => {
    const item = make.items[+t.dataset.i];
    if (t.dataset.k === "q") item.q = t.value;
    if (t.dataset.k === "o") item.o[+t.dataset.j] = t.value;
  });

  list.addEventListener("change", async ({ target: t }) => {
    const item = make.items[+t.dataset.i];
    if (t.dataset.k === "a") { item.a = +t.value; updateProgress(); }
    if (t.dataset.k === "img" && t.files[0]) { item.img = await resizeImage(t.files[0]); render(); }
  });

  list.addEventListener("click", ({ target: t }) => {
    const i = +t.dataset.i;
    if (t.dataset.k === "swap") swapQuestion(i);
    if (t.dataset.k === "remove-img") { make.items[i].img = ""; render(); }
  });

  $("mode-template").onclick = () => setMode("template");
  $("mode-blank").onclick = () => setMode("blank");
  $("make-back").onclick = () => { location.href = "index.html"; };
  $("make-submit").onclick = createLink;
  $("make-copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("make-link").value);
      $("make-msg").textContent = "Đã sao chép link!";
    } catch (err) {
      $("make-link").select();
      $("make-msg").textContent = "Bấm giữ ô link để sao chép";
    }
  };
}

function init() {
  make.owner = (new URLSearchParams(location.search).get("name") || "").trim();
  if (!make.owner) { location.replace("index.html"); return; }
  $("make-title").textContent = " " + make.owner;
  bind();
  setMode("template");
}

init();
