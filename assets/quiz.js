(function () {
  const { $, esc, shuffle, stem, ico, mv, bump, WORDS } = A;
  const app = $("#app");
  let G = null, phase = "intro";

  function synStems(w) { return w.syn.split(",").flatMap(x => x.trim().split(/\s+/)).map(stem).filter(x => x.length >= 3); }

  function buildQ(w) {
    const bag = ["tr", "tr", "syn", "rev"];
    let t = bag[Math.floor(Math.random() * bag.length)];
    const own = stem(w.w);
    if (t === "rev" && A.uzCount[w.uz] > 1) t = "tr";
    if (t === "syn" && w.syn.toLowerCase().replace(/[^a-z ,]/g, "").includes(own)) t = "tr";
    let others = WORDS.filter(x => x.id !== w.id), opts, label, prompt;
    if (t === "tr") {
      others = others.filter(x => x.uz !== w.uz);
      opts = [{ label: w.uz, ok: true }, ...A.distract(others, 3, x => x.uz).map(x => ({ label: x.uz, ok: false }))];
      label = "Tarjimasini toping";
      prompt = `<div class="big">${esc(w.w)}</div><div class="sub">${A.speakBtn(w.id)}</div>`;
    } else if (t === "rev") {
      others = others.filter(x => x.uz !== w.uz);
      opts = [{ label: w.w, ok: true }, ...A.distract(others, 3, x => x.w).map(x => ({ label: x.w, ok: false }))];
      label = "Inglizcha so'z yoki iborani toping";
      prompt = `<div class="big sm">${esc(w.uz)}</div>`;
    } else {
      const st = synStems(w), mine = w.syn.split(",").map(x => x.trim().toLowerCase());
      others = others.filter(x => !st.includes(stem(x.w)) && !x.syn.split(",").some(y => mine.includes(y.trim().toLowerCase())));
      opts = [{ label: w.w, ok: true }, ...A.distract(others, 3, x => x.w).map(x => ({ label: x.w, ok: false }))];
      label = "Bu sinonimlar qaysi so'z yoki iboraga tegishli?";
      prompt = `<div class="syns">${w.syn.split(",").map(x => `<span class="syn">${esc(x.trim())}</span>`).join("")}</div>`;
    }
    return { label, prompt, options: shuffle(opts) };
  }

  function start(words) {
    const pool = words && words.length ? words : A.poolWords();
    const ws = A.pickWords(pool, 10);
    G = { pool, xp: 0, lv0: A.level(), missed: new Set(), right: 0, attempts: 0, tries: {}, done: new Set(),
      queue: ws.slice(), total: ws.length, hearts: 3, combo: 0, best: 0, lastGain: 0 };
    phase = "play"; loadQ(); render(); window.scrollTo(0, 0);
  }
  function loadQ() { G.cur = G.queue.shift(); G.sel = null; G.q = buildQ(G.cur); }

  function answer(i) {
    if (G.sel !== null) return;
    G.sel = i;
    const ok = G.q.options[i].ok, w = G.cur;
    const first = !G.tries[w.id];
    G.tries[w.id] = (G.tries[w.id] || 0) + 1; G.attempts++;
    if (ok) {
      G.right++; G.combo++; G.best = Math.max(G.best, G.combo);
      G.lastGain = first ? 10 + Math.min(G.combo, 5) * 2 : 5;
      if (first) bump(w, 1, 3);
      A.gain(G.lastGain, G); G.done.add(w.id); A.sfx.ok();
    } else {
      G.hearts--; G.combo = 0; G.missed.add(w.id); bump(w, -1); G.queue.push(w); A.sfx.no();
    }
    A.save(); render();
  }
  function next() {
    if (G.hearts <= 0) return finish(false);
    if (!G.queue.length) return finish(true);
    loadQ(); render();
  }
  function finish(win) {
    G.res = A.finish(G, win);
    G.res.stat = ["Eng uzun seriya", "×" + G.best];
    phase = "result"; (win ? A.sfx.win : A.sfx.lose)(); render(); window.scrollTo(0, 0);
  }

  function playHTML() {
    const q = G.q, w = G.cur;
    const pct = Math.round(100 * G.done.size / G.total);
    const hearts = [0, 1, 2].map(i => ico("heart", i < G.hearts ? "" : "off")).join("");
    let h = `<div class="gbar"><a class="icon-btn" href="index.html" aria-label="Chiqish">${ico("close")}</a><div class="prog"><i style="width:${pct}%"></i></div>${G.combo >= 3 ? `<span class="combo">×${G.combo}</span>` : ""}<span class="hearts" aria-label="Jonlar: ${G.hearts}">${hearts}</span></div>
      <div class="game"><div class="qcard"><div class="qlabel">${q.label}</div>${q.prompt}</div>
      <div class="opts">${q.options.map((o, i) => {
        const c = G.sel === null ? "" : o.ok ? "ok" : i === G.sel ? "no" : "";
        return `<button class="opt ${c}" data-act="opt" data-i="${i}" ${G.sel !== null ? "disabled" : ""}><kbd>${i + 1}</kbd><span>${esc(o.label)}</span></button>`;
      }).join("")}</div>`;
    if (G.sel !== null) {
      const ok = q.options[G.sel].ok;
      h += `<div class="fb ${ok ? "ok" : "no"}"><div class="fb-h"><span>${ok ? "To'g'ri!" : "Noto'g'ri"}</span>${ok ? `<span>+${G.lastGain} XP</span>` : ""}</div>
        <div class="fb-b"><span><b>${esc(w.w)}</b> · ${esc(w.uz)}</span><span class="sm">${esc(w.syn)}</span></div>
        <button class="btn block" data-act="next">Davom ${ico("arrow")}</button></div>`;
    }
    return h + `</div>`;
  }

  function render() {
    A.focus(phase === "play");
    if (phase === "intro") {
      app.innerHTML = A.intro({
        eyebrow: "Mashq 02", title: "Tezkor test",
        desc: "Ko'p variantli savollar: tarjima, sinonim va teskari yo'nalish aralash keladi.",
        rules: ["10 ta savol, 3 ta jon", "Xato javob berilgan so'z oxirida yana so'raladi", "Ketma-ket to'g'ri javoblar qo'shimcha XP beradi", "Klaviaturada 1–4 tugmalari va Enter ishlaydi"]
      });
    } else if (phase === "play") app.innerHTML = playHTML();
    else app.innerHTML = A.result(G);
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    switch (el.dataset.act) {
      case "start": start(); break;
      case "opt": answer(+el.dataset.i); break;
      case "next": next(); break;
      case "replay": start(G.pool); break;
      case "practice": start([...G.missed].map(id => A.byId[id])); break;
    }
  });
  document.addEventListener("keydown", e => {
    if (phase !== "play" || !G) return;
    if (G.sel === null && /^[1-4]$/.test(e.key)) { const i = +e.key - 1; if (i < G.q.options.length) answer(i); }
    else if (G.sel !== null && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); }
  });
  A.onPool = render;
  render();
})();
