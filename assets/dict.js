(function () {
  const { $, esc, ico, mv, WORDS } = A;
  const app = $("#app");
  let q = "", filter = "all";

  const FILTERS = [["all", "Hammasi"], ["new", "O'rganilmagan"], ["known", "Bilaman"]];

  function list() {
    const s = q.trim().toLowerCase();
    return WORDS.filter(w => {
      if (filter === "new" && mv(w.id) >= 3) return false;
      if (filter === "known" && mv(w.id) < 3) return false;
      return !s || (w.w + " " + w.uz + " " + w.syn).toLowerCase().includes(s);
    });
  }
  function rows() {
    const l = list();
    $("#cnt").textContent = l.length + " ta so'z";
    if (!l.length) return `<li class="muted" style="padding:20px 4px">Hech narsa topilmadi.</li>`;
    return l.map(w => `<li class="dw" data-word="${w.id}"><div class="dw-h"><span class="dw-w">${esc(w.w)}</span>${A.speakBtn(w.id)}<span class="sp"></span>${A.pips(w.id)}<span class="dw-n">${w.no}</span></div><div class="dw-t">${esc(w.uz)}</div><div class="dw-d">${esc(w.syn)}</div></li>`).join("");
  }

  app.innerHTML = `<span class="eyebrow">Lug'at</span><h1>Barcha so'zlar</h1>
    <p class="lead">So'z, tarjima yoki sinonim bo'yicha qidiring. Bosing — to'liq ma'lumot ochiladi.</p>
    <div class="search-wrap">${ico("search")}<input id="q" class="search" type="search" placeholder="Qidirish…" autocomplete="off" aria-label="Qidirish"></div>
    <div class="chips" id="flt"></div>
    <p class="count" id="cnt" style="margin-top:14px"></p>
    <ul class="dl" id="dl"></ul>`;

  function drawFilters() {
    $("#flt").innerHTML = FILTERS.map(f => `<button class="chip ${filter === f[0] ? "on" : ""}" data-flt="${f[0]}">${f[1]}</button>`).join("");
  }
  function draw() { $("#dl").innerHTML = rows(); }

  document.addEventListener("input", e => { if (e.target.id === "q") { q = e.target.value; draw(); } });
  document.addEventListener("click", e => {
    const f = e.target.closest("[data-flt]");
    if (f) { filter = f.dataset.flt; drawFilters(); draw(); }
  });
  drawFilters(); draw();
})();
