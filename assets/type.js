(function () {
  const { $, esc, norm, lev, ico, mv, bump, WORDS } = A;
  const app = $("#app");
  let G = null, phase = "intro";

  function start(words) {
    const pool = words && words.length ? words : A.poolWords();
    const ws = A.pickWords(pool, 8);
    G = { pool, xp: 0, lv0: A.level(), missed: new Set(), right: 0, attempts: 0, tries: {}, done: new Set(),
      queue: ws.slice(), total: ws.length, combo: 0, lastGain: 0 };
    phase = "play"; loadQ(); render(); window.scrollTo(0, 0);
  }
  function loadQ() { G.cur = G.queue.shift(); G.status = null; G.val = ""; G.hint = 0; }

  function matches(guess, w) {
    const g = norm(guess); if (!g) return false;
    const t = norm(w.w);
    if (t === g) return true;
    if (t === "artefact" && g === "artifact") return true;
    if (t === "categorise" && g === "categorize") return true;
    return WORDS.some(x => x.id !== w.id && x.uz === w.uz && norm(x.w) === g);
  }
  function submit() {
    const inp = $("#ans"); if (!inp || G.status) return;
    const guess = inp.value; if (!guess.trim()) return;
    const w = G.cur; G.val = guess;
    const first = !G.tries[w.id];
    G.tries[w.id] = (G.tries[w.id] || 0) + 1; G.attempts++;
    if (matches(guess, w)) {
      G.status = "ok"; G.right++; G.combo++;
      G.lastGain = G.hint === 0 ? 12 : 7;
      if (first) bump(w, 1, G.hint ? 3 : 4);
      A.gain(G.lastGain, G); G.done.add(w.id); A.sfx.ok();
    } else {
      const g = norm(guess), t = norm(w.w);
      G.status = (t.length >= 6 && lev(g, t) === 1) ? "near" : "no";
      G.combo = 0; G.missed.add(w.id); bump(w, -1); A.sfx.no();
      if (G.tries[w.id] < 3) G.queue.push(w); else G.done.add(w.id);
    }
    A.save(); render();
  }
  function next() {
    if (!G.queue.length) return finish();
    loadQ(); render();
  }
  function finish() {
    G.res = A.finish(G, true);
    G.res.stat = ["So'zlar", G.done.size + " / " + G.total];
    phase = "result"; A.sfx.win(); render(); window.scrollTo(0, 0);
  }
  const mask = w => w.w.split("").map((c, i) => /[A-Za-z]/.test(c) ? (i === 0 ? c.toUpperCase() : "_") : (c === " " ? "  " : c)).join(" ");

  function playHTML() {
    const w = G.cur;
    const pct = Math.round(100 * G.done.size / G.total);
    let h = `<div class="gbar"><a class="icon-btn" href="index.html" aria-label="Chiqish">${ico("close")}</a><div class="prog"><i style="width:${pct}%"></i></div>${G.combo >= 3 ? `<span class="combo">×${G.combo}</span>` : ""}<span class="cnt">${G.done.size} / ${G.total}</span></div>
      <div class="game"><div class="qcard"><div class="qlabel">Inglizcha so'zni yozing</div><div class="big sm">${esc(w.uz)}</div>
      <div class="sub"><span class="mask">${esc(mask(w))}</span></div>
      ${G.hint >= 1 ? `<div class="syns">${w.syn.split(",").map(s => `<span class="syn">${esc(s.trim())}</span>`).join("")}</div>` : ""}</div>
      <input id="ans" class="inp ${G.status || ""}" value="${esc(G.val)}" ${G.status ? "disabled" : ""} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Javobni yozing" aria-label="Javob">`;
    if (G.status) {
      const t = G.status === "ok" ? "To'g'ri!" : G.status === "near" ? "Deyarli! Imloni tekshiring" : "Noto'g'ri";
      h += `<div class="fb ${G.status}"><div class="fb-h"><span>${t}</span>${G.status === "ok" ? `<span>+${G.lastGain} XP</span>` : ""}</div>
        <div class="fb-b"><span><b>${esc(w.w)}</b> · ${esc(w.uz)}</span><span class="sm">${esc(w.syn)}</span></div>
        <button class="btn block" data-act="next">Davom ${ico("arrow")}</button></div>`;
    } else {
      h += `<div class="row"><button class="btn line" data-act="hint" ${G.hint >= 1 ? "disabled" : ""}>${ico("bulb")} Maslahat</button><button class="btn" data-act="check">Tekshirish</button></div>`;
    }
    return h + `</div>`;
  }

  function render() {
    const a = $("#ans");
    if (a && G && phase === "play" && !G.status) G.val = a.value;
    A.focus(phase === "play");
    if (phase === "intro") {
      app.innerHTML = A.intro({
        eyebrow: "Mashq 04", title: "Yozib yodlash",
        desc: "Tarjimaga qarab inglizcha so'zni o'zingiz yozasiz. Eng samarali usul — va “Usta” darajasi faqat shu yerda beriladi.",
        rules: ["8 ta so'z, har biri uchun 3 tagacha urinish", "Maslahat sinonimlarni ochadi (XP kamroq)", "Imlodagi bitta xato “Deyarli” deb belgilanadi", "Enter tugmasi bilan tekshiring va davom eting"]
      });
    } else if (phase === "play") {
      app.innerHTML = playHTML();
      if (!G.status) { const i = $("#ans"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    } else app.innerHTML = A.result(G);
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    switch (el.dataset.act) {
      case "start": start(); break;
      case "check": submit(); break;
      case "hint": { const i = $("#ans"); if (i) G.val = i.value; if (G.hint < 1) G.hint++; render(); break; }
      case "next": next(); break;
      case "replay": start(G.pool); break;
      case "practice": start([...G.missed].map(id => A.byId[id])); break;
    }
  });
  document.addEventListener("keydown", e => {
    if (phase !== "play" || !G || e.key !== "Enter") return;
    e.preventDefault();
    if (G.status) next(); else submit();
  });
  A.onPool = render;
  render();
})();
