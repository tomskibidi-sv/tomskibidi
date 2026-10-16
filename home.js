"use strict";

$("home-start").onclick = () => {
  const name = $("home-name").value.trim();
  if (!name) { $("home-msg").textContent = "Nhập tên của bạn để bắt đầu nhé!"; return; }
  location.href = "make.html?name=" + encodeURIComponent(name);
};