"use strict";


(() => {
  const TRACKS = [
    { file: "scr/Ms1.m4a", name: "Duyên trời lấy 2" },
    { file: "scr/Ms2.m4a", name: "Tình phai" },
    { file: "scr/Ms3.m4a", name: "hoa cỏ lau" },
    { file: "scr/Ms4.m4a", name: "Thương nhau đến thế" },
  ];
  const KEY = "bg-music";


  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (err) { /* bỏ qua */ }
  const state = { on: true, track: 0, time: 0, ...saved };
  if (!TRACKS[state.track]) state.track = 0;

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { /* bỏ qua */ }
  };


  const audio = new Audio(TRACKS[state.track].file);
  audio.preload = "auto";
  let restoreTime = state.time > 0;

  audio.addEventListener("loadedmetadata", () => {
    if (!restoreTime) return;
    restoreTime = false;
    audio.currentTime = Math.max(0, Math.min(state.time, audio.duration - 1));
  });


  audio.addEventListener("ended", () => selectTrack((state.track + 1) % TRACKS.length));


  const unlock = () => {
    removeEventListener("pointerdown", unlock);
    removeEventListener("keydown", unlock);
    if (state.on) audio.play().catch(() => {});
  };
  function play() {
    audio.play().catch(() => {
      addEventListener("pointerdown", unlock);
      addEventListener("keydown", unlock);
    });
  }

  function selectTrack(index) {
    state.track = index;
    state.time = 0;
    state.on = true;
    restoreTime = false;
    audio.src = TRACKS[index].file;
    save();
    refresh();
    play();
  }


  const bar = document.createElement("div");
  bar.className = "music";
  bar.innerHTML = `
    <button type="button" class="small music-toggle"></button>
    <div class="music-tracks" role="group" aria-label="Chọn bài nhạc">
      ${TRACKS.map((t, i) => `<button type="button" class="small" data-t="${i}">${t.name}</button>`).join("")}
    </div>`;

  const firstFooter = document.querySelector(".wrap footer");
  if (firstFooter) firstFooter.before(bar);
  else (document.querySelector(".wrap") || document.body).appendChild(bar);

  const toggle = bar.querySelector(".music-toggle");
  const trackButtons = [...bar.querySelectorAll("[data-t]")];

  function refresh() {
    toggle.textContent = audio.paused ? "🔇 Bật nhạc" : "🔊 Tắt nhạc";
    trackButtons.forEach((b, i) => b.classList.toggle("on", i === state.track));
  }

  bar.addEventListener("pointerdown", (e) => e.stopPropagation());

  toggle.onclick = () => {
    state.on = audio.paused;
    if (state.on) play(); else audio.pause();
    save();
    refresh();
  };
  trackButtons.forEach((b) => { b.onclick = () => selectTrack(+b.dataset.t); });
  audio.addEventListener("play", refresh);
  audio.addEventListener("pause", refresh);


  const saveTime = () => { if (!audio.paused) { state.time = audio.currentTime; save(); } };
  setInterval(saveTime, 1000);
  addEventListener("pagehide", saveTime);


  refresh();
  if (state.on) play();
})();