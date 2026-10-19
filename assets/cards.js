(function () {
  const { $, esc, ico, mv, bump } = A;
  const app = $("#app");
  let G = null, phase = "intro";

  function start(words) {
    const pool = words && words.length ? words : A.poolWords();
    const ws = A.pickWords(pool, 20);
    G = { pool, xp: 0, lv0: A.level(), missed: new Set(), right: 0, attempts: 0, tries: {}, done: new Set(),
      deck: ws, total: ws.length, flip: false, known: 0, again: 0 };
    phase = "play"; render(); window.scrollTo(0, 0);
  }
  function flip() {
    G.flip = !G.flip;
    const fc = $(".fc"); if (fc) fc.classList.toggle("flip", G.flip);
    const a = $("#acts"), h = $("#tapline");
    if (a) a.hidden = !G.flip;
    if (h) h.hidden = G.flip;
    const w = G.deck[0];
    if (G.flip && mv(w.id) < 1) { A.P.m[w.id] = 1; A.save(); }
  }
  function know() {
    const w = G.deck.shift();
    const first = !G.tries[w.id]; G.tries[w.id] = 1;
    if (first) bump(w, 1, 2);
    G.known++; G.attempts++; G.right++; G.done.add(w.id);
    A.gain(3, G); A.sfx.ok(); G.flip = false;
    if (!G.deck.length) return finish();
    render();
  }
  function again() {
    const w = G.deck.shift();
    G.tries[w.id] = 1; G.missed.add(w.id); G.again++; G.attempts++;
    G.deck.splice(Math.min(G.deck.length, 3), 0, w);
    G.flip = false; A.save(); render();
  }
  function finish() {
    const r = G.again / Math.max(1, G.total);
    G.res = A.finish(G, true, r <= 0.3 ? 3 : r <= 0.6 ? 2 : 1);
    G.res.stat = ["Bilaman", G.known];
    phase = "result"; A.sfx.win(); render(); window.scrollTo(0, 0);
  }

  function playHTML() {
    const w = G.deck[0];
    const pct = Math.round(100 * G.known / G.total);
    return `<div class="gbar"><a class="icon-btn" href="index.html" aria-label="Chiqish">${ico("close")}</a><div class="prog"><i style="width:${pct}%"></i></div><span class="cnt">${G.known} / ${G.total}</span></div>
      <div class="game">
      <div class="fc ${G.flip ? "flip" : ""}" data-act="flip" role="button" tabindex="0" aria-label="Kartani aylantirish"><div class="fc-in">
        <div class="face front"><span class="num">${G.known + 1} / ${G.total}</span><div class="big">${esc(w.w)}</div><div class="sub">${A.speakBtn(w.id)}</div><span class="tap">Tarjimani ko'rish uchun bosing</span></div>
        <div class="face back"><div class="trl">${esc(w.uz)}</div><div class="syns">${w.syn.split(",").map(s => `<span class="syn">${esc(s.trim())}</span>`).join("")}</div></div>
      </div></div>
      <p class="muted fc-help" id="tapline" ${G.flip ? "hidden" : ""}>Avval javobni o'zingizcha eslang, keyin aylantiring.</p>
      <div class="row" id="acts" ${G.flip ? "" : "hidden"}><button class="btn line" data-act="again">Yana ko'raman</button><button class="btn ok" data-act="know">Bildim</button></div>
      </div>`;
  }

  function render() {
    A.focus(phase === "play");
    if (phase === "intro") {
      app.innerHTML = A.intro({
        eyebrow: "Mashq 01", title: "Kartochkalar",
        desc: "So'zni ko'ring, tarjimasini o'zingizcha eslang, so'ng kartani aylantirib tekshiring.",
        rules: ["20 tagacha so'z, qiyinlari birinchi chiqadi", "“Yana ko'raman” kartani bir oz keyinroq qaytaradi", "Klaviatura: probel — aylantirish, ← yana, → bildim"]
      });
    } else if (phase === "play") app.innerHTML = playHTML();
    else app.innerHTML = A.result(G);
  }

  document.addEventListener("click", e => {
    if (e.target.closest("[data-say]")) return;
    const el = e.target.closest("[data-act]"); if (!el) return;
    switch (el.dataset.act) {
      case "start": start(); break;
      case "flip": flip(); break;
      case "know": know(); break;
      case "again": again(); break;
      case "replay": start(G.pool); break;
      case "practice": start([...G.missed].map(id => A.byId[id])); break;
    }
  });
  document.addEventListener("keydown", e => {
    if (phase !== "play" || !G) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
    else if (G.flip && e.key === "ArrowRight") know();
    else if (G.flip && e.key === "ArrowLeft") again();
  });
  A.onPool = render;
  render();
})();
