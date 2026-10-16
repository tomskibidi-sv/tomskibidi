"use strict";

/* ========== DỮ LIỆU DÙNG CHUNG ========== */
const QUESTION_COUNT = 10;

// Mỗi câu: [câu hỏi, đáp án A, đáp án B]
// QUAN TRỌNG: chỉ thêm câu MỚI vào CUỐI danh sách (tối đa 18 câu).
// Đổi thứ tự hoặc xoá câu sẽ làm hỏng các link đã gửi đi.
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

// 5 ảnh avatar có sẵn trong thư mục scr: pic1 ... pic5 (đổi đuôi nếu ảnh của bạn là .jpg / .webp)
const AVATAR_EXT = "png";
const AVATAR_PICS = [1, 2, 3, 4, 5].map((n) => `scr/pic${n}.${AVATAR_EXT}`);

/* ========== TIỆN ÍCH ========== */
const $ = (id) => document.getElementById(id);
const pageUrl = (file) => new URL(file, location.href).href;
const formatTime = (ms) => `${(ms / 1000).toFixed(1)} giây`;
const escapeHtml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Điểm cao hơn thắng; bằng điểm thì ai nhanh hơn thắng.
const isBetter = (a, b) => a.score > b.score || (a.score === b.score && a.ms < b.ms);

function hashText(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return "x" + (h >>> 0).toString(36);
}

// Thu nhỏ ảnh để link không quá dài.
function resizeImage(file, maxSize = 300) {
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
        resolve(canvas.toDataURL("image/jpeg", 0.5));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Avatar có thể là đường dẫn ảnh (scr/pic1.png), ảnh tải lên (data:image...) hoặc emoji cũ.
function avatarHtml(av) {
  return /^(scr\/|data:image)/.test(av)
    ? `<img class="face-img" src="${escapeHtml(av)}" alt="avatar">`
    : escapeHtml(av);
}

// Cắt ảnh tải lên thành hình vuông nhỏ để lưu gọn.
function cropSquare(file, size = 96) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas.getContext("2d").drawImage(
          img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}


const toBase64Url = (bytes) => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromBase64Url = (text) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function runStream(bytes, stream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

const findBank = (it) =>
  BANK.findIndex((b) => b[0] === it.q && b[1] === it.o[0] && b[2] === it.o[1]);

async function encodeInvite(quiz) {
  const codes = quiz.q.map((it) => {
    const i = findBank(it);
    return i >= 0 && !it.i ? (i * 2 + it.a).toString(36) : "-";
  });
  const custom = quiz.q
    .filter((_, k) => codes[k] === "-")
    .map((it) => [it.q, it.o[0], it.o[1], it.a, it.i || ""]);
  const t = codes.join("");

  if (!custom.length) return t + encodeURIComponent(quiz.n);

  const bytes = new TextEncoder().encode(JSON.stringify([quiz.n, t, custom]));
  return window.CompressionStream
    ? "z" + toBase64Url(await runStream(bytes, new CompressionStream("deflate-raw")))
    : "y" + toBase64Url(bytes);
}

async function decodeInvite(hash) {
  let name, codes, custom = [];

  if (hash[0] === "z" || hash[0] === "y") {
    let bytes = fromBase64Url(hash.slice(1));
    if (hash[0] === "z") bytes = await runStream(bytes, new DecompressionStream("deflate-raw"));
    [name, codes, custom] = JSON.parse(new TextDecoder().decode(bytes));
  } else {
    codes = hash.slice(0, QUESTION_COUNT);
    name = decodeURIComponent(hash.slice(QUESTION_COUNT));
  }

  if (!/^[0-9a-n-]{10}$/.test(codes)) throw new Error("bad link");

  const q = [...codes].map((ch) => {
    if (ch === "-") {
      const [text, a, b, right, img] = custom.shift();
      return { q: text, o: [a, b], a: right, i: img || undefined };
    }
    const code = parseInt(ch, 36);
    const [text, a, b] = BANK[code >> 1];
    return { q: text, o: [a, b], a: code & 1 };
  });
  return { n: name, q };
}

/* ========== BẢNG ĐIỂM (lưu trong trình duyệt của máy này) ========== */
const scoreStore = {
  list(quizId) {
    try { return Object.values(JSON.parse(localStorage.getItem("scores:" + quizId)) || {}); }
    catch (err) { return []; }
  },
  save(quizId, record) {
    const all = {};
    for (const r of this.list(quizId)) all[r.nick] = r;
    if (!all[record.nick] || isBetter(record, all[record.nick])) all[record.nick] = record;
    try { localStorage.setItem("scores:" + quizId, JSON.stringify(all)); } catch (err) { /* bỏ qua */ }
  },
};