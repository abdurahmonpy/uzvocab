/* Umumiy yadro: so'zlar, saqlash, XP, ovoz, sarlavha, so'z oynasi */
(function () {
  "use strict";
  const A = (window.A = {});

  /* ---------- so'zlar ---------- */
  const BASE = (window.WORDS || []).map((r, i) => ({ id: i + 1, w: r[0], syn: r[1], uz: r[2] }));
  const CKEY = "abdurahmon-custom-words-v1";
  function loadCustom() {
    try { const a = JSON.parse(localStorage.getItem(CKEY) || "[]"); return Array.isArray(a) ? a.filter(x => x && x.id && x.w) : []; } catch (e) { return []; }
  }
  const CUSTOM = loadCustom();
  const WORDS = BASE.concat(CUSTOM.map(c => ({ id: c.id, w: c.w, syn: c.syn || "", uz: c.uz || "", custom: true })));
  WORDS.forEach((w, i) => { w.no = i + 1; });
  const byId = {};
  WORDS.forEach(w => (byId[w.id] = w));
  A.custom = {
    list: () => loadCustom(),
    save: l => { try { localStorage.setItem(CKEY, JSON.stringify(l)); } catch (e) {} },
    nextId: l => Math.max(1000, ...l.map(x => x.id)) + 1,
    baseWords: BASE
  };
  const SETN = 10;
  const SETS = [];
  for (let i = 0; i < WORDS.length; i += SETN) SETS.push(WORDS.slice(i, i + SETN));
  const LEVELS = ["Yangi", "Ko'rilgan", "O'rganilmoqda", "Bilaman", "Usta"];
  const LV = 150;
  const uzCount = {};
  WORDS.forEach(w => { uzCount[w.uz] = (uzCount[w.uz] || 0) + 1; });
  Object.assign(A, { WORDS, byId, SETN, SETS, LEVELS, LV, uzCount });

  /* ---------- yordamchilar ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = s => s.toLowerCase().replace(/[^a-z]/g, "");
  const stem = s => s.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5);
  const fmt = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  function lev(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function distract(others, n, lab) {
    const seen = new Set(), out = [];
    for (const x of shuffle(others)) { const l = lab(x); if (seen.has(l)) continue; seen.add(l); out.push(x); if (out.length === n) break; }
    return out;
  }
  Object.assign(A, { $, esc, shuffle, norm, stem, fmt, lev, distract });

  /* ---------- saqlash ---------- */
  const KEY = "abdurahmon-vocab-v2", OLD = "abdurahmon-app-v1";
  const P = { m: {}, xp: 0, streak: 0, last: "", sound: true, rounds: 0, pool: "all" };
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD);
    if (raw) Object.assign(P, JSON.parse(raw));
  } catch (e) {}
  if (P.pool !== "all" && P.pool !== "hard" && !SETS[+String(P.pool).slice(1)]) P.pool = "all";
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };
  const mv = id => P.m[id] || 0;
  const level = () => Math.floor(P.xp / LV) + 1;
  const dstr = d => d.toLocaleDateString("en-CA");
  function touchDay() {
    const t = dstr(new Date()); if (P.last === t) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    P.streak = P.last === dstr(y) ? P.streak + 1 : 1; P.last = t;
  }
  function curStreak() {
    if (!P.last) return 0;
    const y = new Date(); y.setDate(y.getDate() - 1);
    return (P.last === dstr(new Date()) || P.last === dstr(y)) ? P.streak : 0;
  }
  function bump(w, delta, cap) {
    const c = mv(w.id); let n = c + delta;
    if (delta > 0) n = Math.min(n, Math.max(cap, c));
    if (delta < 0) n = Math.max(0, n);
    P.m[w.id] = n;
  }
  function refreshXP() { const b = $("#xp b"); if (b) b.textContent = P.xp; }
  function gain(n, G) { P.xp += n; if (G) G.xp += n; touchDay(); save(); refreshXP(); }
  function resetProgress() { P.m = {}; P.xp = 0; P.streak = 0; P.last = ""; P.rounds = 0; save(); refreshXP(); }
  const known = () => WORDS.filter(w => mv(w.id) >= 3).length;
  Object.assign(A, { P, save, mv, level, curStreak, bump, gain, resetProgress, known, refreshXP });

  /* ---------- so'z to'plami ---------- */
  A.poolWords = () => {
    if (P.pool === "all") return WORDS;
    if (P.pool === "hard") { const h = WORDS.filter(w => mv(w.id) < 3); return h.length >= 4 ? h : WORDS; }
    return SETS[+P.pool.slice(1)] || WORDS;
  };
  A.pickWords = (pool, n) =>
    pool.map(w => ({ w, s: mv(w.id) + Math.random() * 1.6 })).sort((a, b) => a.s - b.s).slice(0, Math.min(n, pool.length)).map(x => x.w);
  A.poolChips = () => {
    const hard = WORDS.filter(w => mv(w.id) < 3).length;
    const c = (v, label, n) => `<button class="chip ${P.pool === v ? "on" : ""}" data-pool="${v}">${label}${n != null ? ` <small>${n}</small>` : ""}</button>`;
    return c("all", "Hammasi", WORDS.length) + c("hard", "Qiyinlari", hard) +
      SETS.map((s, i) => c("s" + i, `${s[0].no}–${s[s.length - 1].no}`)).join("");
  };

  /* ---------- ikonlar ---------- */
  const IC = {
    speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z"/>',
    cards: '<rect x="3" y="7" width="13" height="12" rx="2"/><path d="M8 4h11a2 2 0 0 1 2 2v9"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><path d="M12 17h.01"/>',
    pairs: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    pencil: '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.4 1-1.9A6 6 0 0 0 12 3z"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5z"/><path d="M6 18h13v3H6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'
  };
  const ico = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
  A.ico = ico;

  /* ---------- ovoz ---------- */
  let AC = null;
  function beep(seq) {
    if (!P.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      let t = AC.currentTime;
      for (const [f, d, type] of seq) {
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = type || "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.9;
      }
    } catch (e) {}
  }
  A.sfx = {
    ok: () => beep([[660, .09], [880, .14]]),
    no: () => beep([[220, .2, "sawtooth"]]),
    win: () => beep([[523, .1], [659, .1], [784, .1], [1047, .24]]),
    lose: () => beep([[392, .14], [330, .14], [262, .28]])
  };
  const canSpeak = "speechSynthesis" in window;
  A.say = t => {
    if (!canSpeak) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = "en-GB"; u.rate = 0.9; speechSynthesis.speak(u); } catch (e) {}
  };
  A.speakBtn = id => canSpeak ? `<button class="icon-btn sm" data-say="${id}" aria-label="Talaffuz">${ico("speaker")}</button>` : "";
  A.pips = id => `<span class="pips" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${mv(id) >= i ? "f" : ""}"></i>`).join("")}</span>`;

  /* ---------- umumiy sarlavha va pastki menyu ---------- */
  const NAV = [
    ["index.html", "Bosh sahifa", "Bosh", "home"],
    ["cards.html", "Kartochkalar", "Kartalar", "cards"],
    ["quiz.html", "Tezkor test", "Test", "quiz"],
    ["match.html", "Juftlik", "Juftlik", "pairs"],
    ["type.html", "Yozib yodlash", "Yozish", "pencil"],
    ["dict.html", "Lug'at", "Lug'at", "book"],
    ["add.html", "So'z qo'shish", "Qo'shish", "plus"]
  ];
  A.shell = () => {
    const cur = document.body.dataset.page;
    const on = f => (f.replace(".html", "") === cur ? "on" : "");
    const hd = document.createElement("header");
    hd.className = "hd";
    hd.innerHTML = `<div class="hd-in"><a class="brand" href="index.html"><span class="logo">A</span><span>Abdurahmon's APP</span></a>
      <nav class="nav" aria-label="Asosiy menyu">${NAV.map(n => `<a class="${on(n[0])}" href="${n[0]}">${n[1]}</a>`).join("")}</nav>
      <div class="hd-r"><span class="xp" id="xp">${ico("bolt")}<b>${P.xp}</b> XP</span><button class="icon-btn" id="snd" aria-label="Ovoz">${ico(P.sound ? "speaker" : "mute")}</button></div></div>`;
    document.body.prepend(hd);
    const bn = document.createElement("nav");
    bn.className = "bnav";
    bn.setAttribute("aria-label", "Pastki menyu");
    bn.innerHTML = NAV.map(n => `<a class="${on(n[0])}" href="${n[0]}">${ico(n[3])}<span>${n[2]}</span></a>`).join("");
    document.body.appendChild(bn);
  };
  A.focus = on => document.body.classList.toggle("focus", !!on);

  /* ---------- so'z oynasi ---------- */
  function closeSheet() { const s = $("#sheet"); if (s) s.remove(); }
  A.openSheet = id => {
    closeSheet();
    const w = byId[id]; if (!w) return;
    const m = mv(id);
    const el = document.createElement("div");
    el.className = "sheet-bg"; el.id = "sheet";
    el.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(w.w)}">
      <div class="sh-row"><span class="num">№ ${w.no}</span><span class="sp"></span>${A.speakBtn(w.id)}<button class="icon-btn sm" data-close="1" aria-label="Yopish">${ico("close")}</button></div>
      <div class="big">${esc(w.w)}</div>
      <div><div class="lbl">Tarjima</div><div class="tr-line">${esc(w.uz)}</div></div>
      <div><div class="lbl">Sinonimlar</div><div class="syns">${w.syn.split(",").map(s => `<span class="syn">${esc(s.trim())}</span>`).join("")}</div></div>
      <span class="mlabel m${m}">${A.pips(id)} ${LEVELS[m]}</span></div>`;
    document.body.appendChild(el);
  };

  document.addEventListener("click", e => {
    const t = e.target;
    const sayEl = t.closest("[data-say]");
    if (sayEl) { A.say(byId[sayEl.dataset.say].w); return; }
    if (t.closest("#snd")) {
      P.sound = !P.sound; save();
      $("#snd").innerHTML = ico(P.sound ? "speaker" : "mute");
      return;
    }
    if (t.id === "sheet" || t.closest("[data-close]")) { closeSheet(); return; }
    const pl = t.closest("[data-pool]");
    if (pl) { P.pool = pl.dataset.pool; save(); if (A.onPool) A.onPool(); return; }
    const wd = t.closest("[data-word]");
    if (wd) A.openSheet(+wd.dataset.word);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

  /* ---------- boshlang'ich va yakuniy ekranlar ---------- */
  A.intro = o => `<section class="intro">
    <span class="eyebrow">${esc(o.eyebrow || "Mashq")}</span>
    <h1>${esc(o.title)}</h1>
    <p class="lead">${esc(o.desc)}</p>
    <ul class="rules">${o.rules.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    <h2>Qaysi so'zlar?</h2>
    <div class="chips">${A.poolChips()}</div>
    <p class="muted">${A.poolWords().length} ta so'z tanlangan</p>
    <button class="btn acc block" data-act="start">Boshlash ${ico("arrow")}</button>
  </section>`;

  A.finish = (G, win, starsOverride) => {
    const acc = G.attempts ? Math.round(100 * G.right / G.attempts) : 100;
    let stars = win ? (acc >= 90 ? 3 : acc >= 70 ? 2 : 1) : 0;
    if (starsOverride != null) stars = starsOverride;
    if (win) gain(20, G);
    P.rounds++; save();
    return { win, acc, stars, up: level() > G.lv0 };
  };

  A.result = G => {
    const r = G.res, missed = [...G.missed].map(id => byId[id]);
    const title = !r.win ? "Jonlar tugadi" : r.stars === 3 ? "Ajoyib natija!" : r.stars === 2 ? "Yaxshi, davom eting" : "Yakunlandi";
    const stars = [1, 2, 3].map(i => ico("star", i <= r.stars ? "on" : "")).join("");
    const rev = missed.length
      ? `<div class="review"><h2>Takrorlash kerak</h2>${missed.map(w => `<div class="rv" data-word="${w.id}"><b>${esc(w.w)}</b><span>${esc(w.uz)}</span><span class="sp"></span>${A.speakBtn(w.id)}</div>`).join("")}</div>`
      : "";
    return `<div class="res">
      <div class="stars" aria-label="${r.stars} yulduz">${stars}</div>
      <h1>${title}</h1>
      ${r.up ? `<div class="lvup">Yangi daraja: ${level()}</div>` : ""}
      <div class="stats3">
        <div class="stat"><b>${r.acc}%</b><span>Aniqlik</span></div>
        <div class="stat"><b>+${G.xp}</b><span>XP</span></div>
        <div class="stat"><b>${esc(r.stat[1])}</b><span>${esc(r.stat[0])}</span></div>
      </div>
      ${rev}
      <div class="btns">
        <button class="btn acc block" data-act="replay">Yana o'ynash</button>
        ${missed.length ? `<button class="btn line block" data-act="practice">Xatolarni mashq qilish</button>` : ""}
        <a class="btn line block" href="index.html">Bosh sahifa</a>
      </div></div>`;
  };

  A.shell();
})();
