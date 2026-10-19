(function () {
  const { $, esc, shuffle, fmt, ico, bump } = A;
  const app = $("#app");
  let G = null, phase = "intro", timer = null;

  function start(words) {
    clearInterval(timer);
    let pool = words && words.length ? words : A.poolWords();
    if (pool.length < 4) pool = pool.concat(shuffle(A.WORDS.filter(w => !pool.includes(w))).slice(0, 4 - pool.length));
    G = { pool, xp: 0, lv0: A.level(), missed: new Set(), right: 0, attempts: 0,
      size: Math.min(6, pool.length), boards: pool.length >= 12 ? 2 : 1, bi: 0, used: new Set(), mistakes: 0, pairs: 0, t0: Date.now(), lock: false };
    newBoard();
    phase = "play"; render(); window.scrollTo(0, 0);
    timer = setInterval(() => { const el = $("#tm span"); if (el && G) el.textContent = fmt(Date.now() - G.t0); }, 500);
  }
  function newBoard() {
    const order = A.pickWords(G.pool, G.pool.length);
    let cand = order.filter(w => !G.used.has(w.id));
    if (cand.length < G.size) cand = order;
    const words = [], seen = new Set();
    for (const w of cand) { if (seen.has(w.uz)) continue; seen.add(w.uz); words.push(w); if (words.length === G.size) break; }
    words.forEach(w => G.used.add(w.id));
    G.board = words; G.colL = shuffle(words); G.colR = shuffle(words);
    G.done = new Set(); G.miss = new Set(); G.sl = null; G.sr = null; G.flash = null; G.lock = false;
  }
  function pick(side, id) {
    if (G.lock || G.done.has(id)) return;
    if (side === "l") G.sl = G.sl === id ? null : id; else G.sr = G.sr === id ? null : id;
    if (G.sl !== null && G.sr !== null) {
      if (G.sl === G.sr) {
        const w = A.byId[id];
        G.done.add(id); G.pairs++; G.attempts++; G.right++;
        const clean = !G.miss.has(id);
        if (clean) bump(w, 1, 3);
        A.gain(clean ? 8 : 3, G); A.sfx.ok(); G.sl = null; G.sr = null;
        if (G.done.size === G.board.length) {
          G.lock = true; render();
          setTimeout(() => {
            if (!G || phase !== "play") return;
            if (G.bi + 1 < G.boards) { G.bi++; newBoard(); render(); } else finish();
          }, 600);
          return;
        }
      } else {
        G.mistakes++; G.attempts++;
        G.miss.add(G.sl); G.miss.add(G.sr); G.missed.add(G.sl); G.missed.add(G.sr);
        G.flash = { l: G.sl, r: G.sr }; G.lock = true; A.sfx.no();
        A.save();
        setTimeout(() => { if (!G || phase !== "play") return; G.flash = null; G.sl = null; G.sr = null; G.lock = false; render(); }, 450);
      }
    }
    render();
  }
  function finish() {
    clearInterval(timer);
    G.res = A.finish(G, true);
    G.res.stat = ["Vaqt", fmt(Date.now() - G.t0)];
    phase = "result"; A.sfx.win(); render(); window.scrollTo(0, 0);
  }

  function playHTML() {
    const fl = G.flash;
    const pct = Math.round(100 * (G.bi * G.size + G.done.size) / (G.boards * G.size));
    const L = G.colL.map(w => `<button class="mt en ${G.done.has(w.id) ? "done" : ""} ${G.sl === w.id ? "sel" : ""} ${fl && fl.l === w.id ? "bad shake" : ""}" data-act="ml" data-id="${w.id}">${esc(w.w)}</button>`).join("");
    const R = G.colR.map(w => `<button class="mt ${G.done.has(w.id) ? "done" : ""} ${G.sr === w.id ? "sel" : ""} ${fl && fl.r === w.id ? "bad shake" : ""}" data-act="mr" data-id="${w.id}">${esc(w.uz)}</button>`).join("");
    return `<div class="gbar"><a class="icon-btn" href="index.html" aria-label="Chiqish">${ico("close")}</a><div class="prog"><i style="width:${pct}%"></i></div><span class="timer" id="tm">${ico("clock")}<span>${fmt(Date.now() - G.t0)}</span></span></div>
      <div class="game"><div class="bno">${G.boards > 1 ? `Taxta ${G.bi + 1} / ${G.boards} · ` : ""}Xatolar: ${G.mistakes}</div>
      <div class="mgrid"><div class="mcol">${L}</div><div class="mcol">${R}</div></div></div>`;
  }

  function render() {
    A.focus(phase === "play");
    if (phase === "intro") {
      app.innerHTML = A.intro({
        eyebrow: "Mashq 03", title: "Juftlik topish",
        desc: "Chapdagi inglizcha so'zni o'ngdagi tarjimasi bilan juftlang. Qancha tez bo'lsa, shuncha yaxshi.",
        rules: ["Har taxtada 6 ta juftlik", "To'plam katta bo'lsa 2 ta taxta o'ynaladi", "Xato juftlik so'zni “Takrorlash kerak” ro'yxatiga qo'shadi"]
      });
    } else if (phase === "play") app.innerHTML = playHTML();
    else app.innerHTML = A.result(G);
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    switch (el.dataset.act) {
      case "start": start(); break;
      case "ml": pick("l", +el.dataset.id); break;
      case "mr": pick("r", +el.dataset.id); break;
      case "replay": start(G.pool); break;
      case "practice": start([...G.missed].map(id => A.byId[id])); break;
    }
  });
  A.onPool = render;
  render();
})();
