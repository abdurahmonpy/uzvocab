(function () {
  const { $, esc, ico, P, mv, WORDS, LEVELS, LV } = A;
  const app = $("#app");
  let confirmReset = false;

  const MODES = [
    ["cards.html", "cards", "Kartochkalar", "So'zni ko'ring, tarjimasini eslang, kartani aylantiring."],
    ["quiz.html", "quiz", "Tezkor test", "10 savol, 3 jon. Xato javob savolni qaytaradi."],
    ["match.html", "pairs", "Juftlik topish", "So'z va tarjimani vaqtga qarshi birlashtiring."],
    ["type.html", "pencil", "Yozib yodlash", "Tarjimaga qarab so'zni o'zingiz yozing. Usta darajasi faqat shu yerda."]
  ];

  function render() {
    const lv = A.level(), xpIn = P.xp % LV;
    const known = A.known();
    app.innerHTML = `
      <section class="hero">
        <span class="eyebrow">IELTS lug'ati</span>
        <h1>So'z boyligingizni mustahkamlang</h1>
        <p class="lead">${WORDS.length} ta so'z, to'rt xil mashq. Har kuni bir oz — natija o'zi keladi.</p>
      </section>

      <section class="stats">
        <div class="card lvl"><div class="lbl">Daraja</div><div class="val">${lv}<small>${xpIn} / ${LV} XP</small></div><div class="bar"><i style="width:${Math.round(100 * xpIn / LV)}%"></i></div></div>
        <div class="card"><div class="lbl">Seriya</div><div class="val">${A.curStreak()}<small>kun</small></div></div>
        <div class="card"><div class="lbl">Bilaman</div><div class="val">${known}<small>/ ${WORDS.length}</small></div></div>
      </section>

      <section class="section"><h2>Mashq turlari</h2>
        <div class="modes">${MODES.map(m => `<a class="mode" href="${m[0]}"><span class="mi">${ico(m[1])}</span><b>${m[2]} ${ico("arrow")}</b><span class="d">${m[3]}</span></a>`).join("")}</div>
      </section>

      <section class="section"><h2>Qaysi so'zlar?</h2>
        <div class="chips">${A.poolChips()}</div>
        <p class="muted">${A.poolWords().length} ta so'z tanlangan. Bu tanlov barcha mashqlarda ishlaydi.</p>
      </section>

      <section class="section"><h2>So'zlar xaritasi</h2>
        <div class="legend">${LEVELS.map((n, i) => `<span><i class="lg${i}"></i>${n}</span>`).join("")}</div>
        <div class="map">${WORDS.map(w => `<button class="tile m${mv(w.id)}" data-word="${w.id}"><small>${w.no}</small><b>${esc(w.w)}</b></button>`).join("")}</div>
      </section>

      <div class="foot"><span>Natijalar faqat shu qurilmadagi brauzerda saqlanadi.</span>
        <button class="link" data-act="reset">${confirmReset ? "Rostdan ham tozalaymi? Yana bosing" : "Natijalarni tozalash"}</button></div>`;
  }

  document.addEventListener("click", e => {
    if (!e.target.closest('[data-act="reset"]')) return;
    if (!confirmReset) { confirmReset = true; render(); return; }
    A.resetProgress(); confirmReset = false; render();
  });
  A.onPool = render;
  render();
})();
