(function () {
  "use strict";
  const { $, esc, ico, P, save } = A;
  const app = $("#app");

  let curTab = "pdf"; // "pdf" | "json" | "paste" | "single"
  let msg = null; // { t: "ok"|"err"|"", s: "" }
  let previewList = []; // [{ idx, w, syn, uz, status: "new"|"dup"|"err" }]
  let isLoading = false;
  let loadingText = "";

  const clean = s => String(s || "").replace(/"/g, "'").replace(/\s+/g, " ").trim();
  const exists = (w, extra) =>
    A.WORDS.some(x => x.w.toLowerCase() === w.toLowerCase()) ||
    (extra || []).some(x => x.w.toLowerCase() === w.toLowerCase());

  /* Sinonimlardagi nuqta-vergullarni (;) vergulga (,) aylantirish */
  function normalizeSynonyms(syn) {
    if (!syn) return "";
    return syn
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(Boolean)
      .join(", ");
  }

  /* Ko'p so'zni saqlash */
  function addMany(rows) {
    const list = A.custom.list();
    let added = 0, skipped = 0;
    for (const r of rows) {
      const w = clean(r.w);
      const syn = normalizeSynonyms(clean(r.syn));
      const uz = clean(r.uz);
      if (!w || !uz || exists(w, list)) {
        skipped++;
        continue;
      }
      list.push({ id: A.custom.nextId(list), w, syn, uz });
      added++;
    }
    A.custom.save(list);
    list.forEach(c => {
      if (!A.WORDS.some(x => x.id === c.id)) {
        A.WORDS.push({ id: c.id, w: c.w, syn: c.syn || "", uz: c.uz || "", custom: true });
      }
    });
    return { added, skipped };
  }

  function report(r) {
    msg = r.added
      ? { t: "ok", s: `${r.added} ta so'z muvaffaqiyatli qo'shildi!${r.skipped ? ` (${r.skipped} tasi takror yoki to'liq emasligi sababli o'tkazib yuborildi)` : ""}` }
      : { t: "err", s: "Hech narsa qo'shilmadi: so'z va tarjima to'ldirilgan bo'lishi, so'z esa avval qo'shilmagan bo'lishi kerak." };
  }

  /* -------------------------------------------------------------
     JSON TAHLILCHISI (JSON Parser)
  ------------------------------------------------------------- */
  function parseJsonData(raw) {
    let data;
    try {
      data = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      throw new Error("JSON formati noto'g'ri: " + e.message);
    }

    const results = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        if (!item) continue;
        if (Array.isArray(item)) {
          if (item.length >= 2) {
            results.push({
              w: clean(item[0]),
              syn: item.length >= 3 ? normalizeSynonyms(clean(item[1])) : "",
              uz: clean(item[item.length >= 3 ? 2 : 1])
            });
          }
        } else if (typeof item === "object") {
          const w = clean(item.w || item.word || item.en || item.english || item.term || item.soz || item["so'z"] || item["so‘z"]);
          const syn = normalizeSynonyms(clean(item.syn || item.synonym || item.synonyms || item.sinonim || item.sinonimlar));
          const uz = clean(item.uz || item.uzbek || item.translation || item.translate || item.meaning || item.tarjima || item.tarjimasi);
          if (w && uz) {
            results.push({ w, syn, uz });
          }
        }
      }
    } else if (typeof data === "object" && data !== null) {
      const list = data.words || data.vocabulary || data.list || data.data;
      if (Array.isArray(list)) {
        return parseJsonData(list);
      }
      for (const [key, val] of Object.entries(data)) {
        if (typeof val === "string") {
          results.push({ w: clean(key), syn: "", uz: clean(val) });
        } else if (typeof val === "object" && val !== null) {
          results.push({
            w: clean(key),
            syn: normalizeSynonyms(clean(val.syn || val.synonyms || "")),
            uz: clean(val.uz || val.translation || val.tarjima || "")
          });
        }
      }
    }

    return results;
  }

  /* -------------------------------------------------------------
     AQLLI MATN TAHLILCHISI (Smart Paste Parser)
  ------------------------------------------------------------- */
  function parseTextLines(rawText) {
    if (!rawText || !rawText.trim()) return [];

    // Agar kiritilgan matn JSON bo'lsa, avtomatik JSON parserga yo'naltirish
    const trimmed = rawText.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const jsonResults = parseJsonData(trimmed);
        if (jsonResults.length) return jsonResults;
      } catch (e) {}
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const results = [];
    let curItem = null;

    const stopWords = /^(rainforests|vocabulary|intermediate|sinonimlar|mashq|o‘zbekcha|inglizcha|tarjimasi|so‘z|ibora|№|\d+\s*\/\s*\d+)/i;

    for (let line of lines) {
      if (stopWords.test(line) && !/^\d+\s+[a-z]/i.test(line)) continue;

      if (line.includes("|")) {
        const parts = line.split("|").map(p => clean(p));
        if (parts.length >= 2 && parts[0]) {
          results.push({
            w: parts[0],
            syn: parts.length >= 3 ? normalizeSynonyms(parts[1]) : "",
            uz: parts.length >= 3 ? parts[2] : parts[1]
          });
          continue;
        }
      }

      if (line.includes("\t")) {
        let parts = line.split("\t").map(p => clean(p)).filter(Boolean);
        if (parts.length && /^\d+[\.\)]?$/.test(parts[0])) {
          parts.shift();
        }
        if (parts.length >= 2) {
          results.push({
            w: parts[0],
            syn: parts.length >= 3 ? normalizeSynonyms(parts[1]) : "",
            uz: parts[parts.length - 1]
          });
          continue;
        }
      }

      const numMatch = line.match(/^(\d+)[\.\)\s\t]+(.+)$/);
      if (numMatch) {
        if (curItem && curItem.w && curItem.uz) {
          results.push(curItem);
        }
        const body = numMatch[2].trim();
        curItem = extractColsFromBody(body);
        continue;
      }

      if (curItem) {
        curItem.uz = (curItem.uz + " " + line).trim();
      } else {
        const dashMatch = line.match(/^([a-zA-Z\s'’‘-]+)\s*[-:–—]\s*(.+)$/);
        if (dashMatch) {
          results.push({
            w: clean(dashMatch[1]),
            syn: "",
            uz: clean(dashMatch[2])
          });
        }
      }
    }

    if (curItem && curItem.w && curItem.uz) {
      results.push(curItem);
    }

    return results;
  }

  function extractColsFromBody(body) {
    if (body.includes(";")) {
      const semiIndex = body.indexOf(";");
      const beforeSemi = body.slice(0, semiIndex).trim();
      const afterSemi = body.slice(semiIndex + 1).trim();

      const wordsBefore = beforeSemi.split(/\s+/);
      let splitPoint = Math.max(1, Math.floor(wordsBefore.length / 2));
      if (wordsBefore.length > 3) splitPoint = 2;

      const w = wordsBefore.slice(0, splitPoint).join(" ");
      const synPart1 = wordsBefore.slice(splitPoint).join(" ");

      const afterWords = afterSemi.split(/\s+/);
      let synPart2 = [];
      let uzWords = [];
      let foundUz = false;

      for (let i = 0; i < afterWords.length; i++) {
        const token = afterWords[i];
        if (/[‘'’`]|(bo‘lgan|qilingan|qilmoq|uchun|bilan|teng|xos|zarur|asosiy|keng|nam|xato)/i.test(token) || i >= 4) {
          foundUz = true;
        }
        if (foundUz) {
          uzWords.push(token);
        } else {
          synPart2.push(token);
        }
      }

      const syn = [synPart1, synPart2.join(" ")].filter(Boolean).join("; ");
      const uz = uzWords.join(" ");

      return {
        w: clean(w),
        syn: normalizeSynonyms(clean(syn)),
        uz: clean(uz) || clean(body)
      };
    }

    const parts = body.split(/\s{2,}|\t/);
    if (parts.length >= 3) {
      return { w: clean(parts[0]), syn: normalizeSynonyms(clean(parts[1])), uz: clean(parts[2]) };
    } else if (parts.length === 2) {
      return { w: clean(parts[0]), syn: "", uz: clean(parts[1]) };
    }

    return { w: clean(body), syn: "", uz: "" };
  }

  /* -------------------------------------------------------------
     PDF FAYLNI O'QISH VA PARSING QILISH (PDF.js)
  ------------------------------------------------------------- */
  async function parsePdfFile(file) {
    if (typeof pdfjsLib === "undefined") {
      throw new Error("PDF o'quvchi kutubxonasi yuklanmadi. Iltimos internet aloqasini tekshiring yoki JSON/Matn usulidan foydalaning.");
    }

    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allWords = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const items = content.items.slice().sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 4) return yDiff;
        return a.transform[4] - b.transform[4];
      });

      const rows = [];
      let curRow = [];
      let lastY = null;

      for (const it of items) {
        const str = it.str.trim();
        if (!str) continue;
        const y = it.transform[5];
        const x = it.transform[4];

        if (lastY === null || Math.abs(y - lastY) <= 4.5) {
          curRow.push({ str: it.str, x, y });
          lastY = y;
        } else {
          if (curRow.length) rows.push(curRow);
          curRow = [{ str: it.str, x, y }];
          lastY = y;
        }
      }
      if (curRow.length) rows.push(curRow);

      let currentWord = null;

      for (const row of rows) {
        const fullRowText = row.map(r => r.str).join(" ").trim();

        if (
          /^(rainforests|vocabulary|intermediate|sinonimlar|mashq|o‘zbekcha tarjimasi|№\s*so‘z|1\s*\/\s*\d+|2\s*\/\s*\d+|3\s*\/\s*\d+)/i.test(fullRowText)
        ) {
          continue;
        }

        const firstToken = row[0].str.trim();
        const isNum = /^\d+$/.test(firstToken);

        if (isNum) {
          if (currentWord && currentWord.w && currentWord.uz) {
            allWords.push(currentWord);
          }

          const num = parseInt(firstToken, 10);
          const cols = row.slice(1);

          let colW = [];
          let colSyn = [];
          let colUz = [];

          for (const c of cols) {
            const x = c.x;
            const s = c.str.trim();
            if (!s) continue;

            if (x < 240) {
              colW.push(s);
            } else if (x < 420) {
              colSyn.push(s);
            } else {
              colUz.push(s);
            }
          }

          currentWord = {
            num: num,
            w: clean(colW.join(" ")),
            syn: normalizeSynonyms(clean(colSyn.join(" "))),
            uz: clean(colUz.join(" "))
          };
        } else if (currentWord) {
          for (const c of row) {
            const x = c.x;
            const s = c.str.trim();
            if (!s) continue;
            if (x < 240) {
              currentWord.w = (currentWord.w + " " + s).trim();
            } else if (x < 420) {
              currentWord.syn = (currentWord.syn + " " + s).trim();
            } else {
              currentWord.uz = (currentWord.uz + " " + s).trim();
            }
          }
          currentWord.syn = normalizeSynonyms(currentWord.syn);
        }
      }

      if (currentWord && currentWord.w && currentWord.uz) {
        allWords.push(currentWord);
      }
    }

    return allWords;
  }

  /* -------------------------------------------------------------
     RENDER VA UI
  ------------------------------------------------------------- */
  function buildPreviewList(items) {
    const customList = A.custom.list();
    return items.map((item, idx) => {
      const isDup = exists(item.w, customList);
      return {
        idx: idx + 1,
        w: clean(item.w),
        syn: normalizeSynonyms(clean(item.syn)),
        uz: clean(item.uz),
        status: isDup ? "dup" : (!item.w || !item.uz ? "err" : "new")
      };
    });
  }

  function render() {
    const list = A.custom.list();

    app.innerHTML = `
      <span class="eyebrow">So'zlar bazasi</span>
      <h1>So'z qo'shish</h1>
      <p class="lead">Yangi so'zlarni PDF, JSON fayllardan yoki nusxalab qo'shing. Barcha so'zlar darhol mashqlarda paydo bo'ladi.</p>

      <div class="tabs" role="tablist">
        <button class="tab-btn ${curTab === "pdf" ? "on" : ""}" data-tab="pdf">
          ${ico("book")} PDF import
        </button>
        <button class="tab-btn ${curTab === "json" ? "on" : ""}" data-tab="json">
          ${ico("cards")} JSON import
        </button>
        <button class="tab-btn ${curTab === "paste" ? "on" : ""}" data-tab="paste">
          ${ico("pencil")} Matndan nusxalash
        </button>
        <button class="tab-btn ${curTab === "single" ? "on" : ""}" data-tab="single">
          ${ico("plus")} Bittalab
        </button>
      </div>

      ${msg ? `<div class="notice ${msg.t}" style="margin-top:16px">${esc(msg.s)}</div>` : ""}

      ${isLoading ? `
        <div class="notice" style="margin-top:16px; text-align:center;">
          <b>${esc(loadingText || "Fayl tahlil qilinmoqda...")}</b>
        </div>
      ` : ""}

      <!-- 1. PDF YUKLASH TABI -->
      <div id="tab-pdf" class="tab-content" ${curTab !== "pdf" ? 'style="display:none;"' : ""}>
        <div class="notice" style="margin-top:16px;">
          <b>IELTS / B2 lug'at PDF faylini tanlang</b> (masalan: <i>RAINFORESTS • VOCABULARY</i> kabi 50-60 talik jadvallar).
          Dastur barcha sahifalardagi so'zlarni, sinonimlarni va tarjimalarni avtomatik ajratib oladi!
        </div>

        <div class="dropzone" id="pdfDropzone" style="margin-top:14px;">
          <div class="dz-icon">${ico("book")}</div>
          <b>PDF faylni shu yerga tashlang yoki bosing</b>
          <p>Format: .pdf (50, 60 yoki 100+ so'zli jadvallar)</p>
          <input type="file" id="pdfFileInput" accept="application/pdf">
        </div>
      </div>

      <!-- 2. JSON IMPORT TABI -->
      <div id="tab-json" class="tab-content" ${curTab !== "json" ? 'style="display:none;"' : ""}>
        <div class="notice" style="margin-top:16px;">
          <b>JSON formatida so'zlar yuklash:</b> .json faylni tashlang yoki JSON kodini joylashtiring. Har qanday format (obyektlar ro'yxati yoki massiv) qabul qilinadi.
        </div>

        <div class="dropzone" id="jsonDropzone" style="margin-top:14px;">
          <div class="dz-icon">${ico("cards")}</div>
          <b>JSON faylni shu yerga tashlang yoki tanlang</b>
          <p>Format: .json fayl</p>
          <input type="file" id="jsonFileInput" accept=".json,application/json">
        </div>

        <div class="field" style="margin-top:16px;">
          <label for="jsonTextarea">Yoki JSON matnini shu yerga qo'ying:</label>
          <textarea id="jsonTextarea" placeholder='[&#10;  {"w": "pollution", "syn": "contamination", "uz": "ifloslanish"},&#10;  {"w": "urban", "syn": "city-based", "uz": "shaharga oid"}&#10;]' style="min-height: 120px; font-family: monospace; font-size: 13px;" spellcheck="false"></textarea>
        </div>
        <button class="btn acc block" data-act="parse-json-text" style="margin-top:8px;">
          ${ico("check")} JSON matnini tahlil qilish
        </button>
      </div>

      <!-- 3. MATNDAN NUSXALASH TABI -->
      <div id="tab-paste" class="tab-content" ${curTab !== "paste" ? 'style="display:none;"' : ""}>
        <div class="notice" style="margin-top:16px;">
          PDF yoki matn muharriridan nusxalangan matnni to'g'ridan-to'g'ri tashlang (Ctrl+V).
          Dastur raqamlarni, sinonimlarni va tarjimalarni o'zi aqlli tahlil qiladi.
        </div>

        <div class="field" style="margin-top:14px;">
          <label for="pasteInput">Nusxalangan matnni shu yerga qo'ying:</label>
          <textarea id="pasteInput" placeholder="1 confronted with faced with; exposed to duch kelgan, ro‘baro‘ bo‘lgan&#10;2 alarming worrying; disturbing tashvishga soladigan, xavotirli&#10;...yoki: word | synonym | tarjima" style="min-height: 160px;" spellcheck="false"></textarea>
        </div>
        <button class="btn acc block" data-act="parse-paste" style="margin-top:8px;">
          ${ico("search")} Matnni tahlil qilish va ko'rish
        </button>
      </div>

      <!-- 4. BITTALAB QO'SHISH TABI -->
      <div id="tab-single" class="tab-content" ${curTab !== "single" ? 'style="display:none;"' : ""}>
        <form class="form" id="f" autocomplete="off">
          <div class="field"><label for="fw">Inglizcha so'z / ibora</label><input id="fw" required placeholder="masalan: pollution" autocapitalize="off" spellcheck="false"></div>
          <div class="field"><label for="fs">Sinonimlar (vergul bilan)</label><input id="fs" placeholder="contamination, impurity" autocapitalize="off" spellcheck="false"></div>
          <div class="field"><label for="fu">O'zbekcha tarjima</label><input id="fu" required placeholder="ifloslanish"></div>
          <button class="btn acc block" type="submit">${ico("plus")} So'zni qo'shish</button>
        </form>
      </div>

      <!-- OLDINDAN KO'RISH JADVALI (PREVIEW) -->
      ${previewList.length ? `
        <div class="preview-box">
          <div class="preview-head">
            <div class="preview-title">
              <span>Topilgan so'zlar</span>
              <span class="preview-count">${previewList.length} ta</span>
            </div>
            <span class="muted">Katakchalarni bosib to'g'irlashingiz mumkin</span>
          </div>
          <div class="preview-table-wrap">
            <table class="preview-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Inglizcha so'z</th>
                  <th>Sinonimlar</th>
                  <th>Tarjima</th>
                  <th>Holat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${previewList.map((item, i) => `
                  <tr data-preview-idx="${i}">
                    <td>${item.idx}</td>
                    <td class="cell-w" contenteditable="true" data-field="w">${esc(item.w)}</td>
                    <td class="cell-syn" contenteditable="true" data-field="syn">${esc(item.syn)}</td>
                    <td class="cell-uz" contenteditable="true" data-field="uz">${esc(item.uz)}</td>
                    <td>
                      ${item.status === "dup" ? `<span class="badge-skip" title="Bu so'z allaqachon lug'atda bor">Takror</span>` :
                        item.status === "err" ? `<span class="badge-skip" title="So'z yoki tarjima to'ldirilmagan">Xato</span>` :
                        `<span class="badge-new">Yangi</span>`}
                    </td>
                    <td class="cell-act">
                      <button class="icon-btn sm" data-act="del-preview" data-idx="${i}" aria-label="O'chirish" style="border:0; background:transparent;">${ico("close")}</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <div class="preview-actions">
            <button class="btn acc" data-act="save-preview" style="flex:2;">
              ${ico("check")} Barcha so'zlarni bazaga qo'shish (${previewList.filter(x => x.status === "new").length} yangi)
            </button>
            <button class="btn line" data-act="download-preview-json" style="flex:1;">
              ${ico("cards")} JSON fayl olish
            </button>
            <button class="btn line" data-act="copy-preview" style="flex:1;">
              words.js kodi
            </button>
            <button class="btn line" data-act="clear-preview">
              Bekor qilish
            </button>
          </div>
        </div>
      ` : ""}

      <!-- FOYDALANUVCHI QO'SHGAN SO'ZLAR -->
      <section class="section" style="margin-top:40px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <h2>Siz qo'shgan barcha so'zlar · ${list.length} ta</h2>
          ${list.length ? `
            <div style="display:flex; gap:10px;">
              <button class="link" data-act="export-json" style="color:var(--acc-ink); font-weight:600;">
                JSON yuklab olish (.json)
              </button>
              <button class="link" data-act="clear-all-custom" style="color:var(--bad);">
                Hammasini o'chirish
              </button>
            </div>
          ` : ""}
        </div>

        ${list.length ? `
          <div style="margin-top:12px;">
            ${list.slice().reverse().map(c => `
              <div class="cw">
                <div>
                  <b>${esc(c.w)}</b>
                  <span>${esc(c.uz)}${c.syn ? ` <small class="muted">(${esc(c.syn)})</small>` : ""}</span>
                </div>
                <button class="icon-btn sm" data-act="del" data-id="${c.id}" aria-label="O'chirish">${ico("trash")}</button>
              </div>
            `).join("")}
          </div>
          <div class="row" style="margin-top:16px;">
            <button class="btn line block" data-act="copy">words.js uchun nusxalash</button>
            <a class="btn acc block" href="cards.html">Mashqlarni boshlash ${ico("arrow")}</a>
          </div>
        ` : `
          <p class="muted" style="margin-top:10px;">Hozircha siz qo'shgan yangi so'zlar yo'q. Yuqoridagi PDF yoki JSON orqali birdaniga 50-60 ta so'z yuklashingiz mumkin.</p>
        `}
      </section>
    `;

    // 1. PDF Dropzone hodisalari
    const pdfDz = $("#pdfDropzone");
    const pdfFileInput = $("#pdfFileInput");
    if (pdfDz && pdfFileInput) {
      pdfDz.addEventListener("click", () => pdfFileInput.click());
      pdfDz.addEventListener("dragover", e => { e.preventDefault(); pdfDz.classList.add("dragover"); });
      pdfDz.addEventListener("dragleave", () => pdfDz.classList.remove("dragover"));
      pdfDz.addEventListener("drop", e => {
        e.preventDefault();
        pdfDz.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handlePdfFile(e.dataTransfer.files[0]);
        }
      });
      pdfFileInput.addEventListener("change", e => {
        if (e.target.files && e.target.files[0]) {
          handlePdfFile(e.target.files[0]);
        }
      });
    }

    // 2. JSON Dropzone hodisalari
    const jsonDz = $("#jsonDropzone");
    const jsonFileInput = $("#jsonFileInput");
    if (jsonDz && jsonFileInput) {
      jsonDz.addEventListener("click", () => jsonFileInput.click());
      jsonDz.addEventListener("dragover", e => { e.preventDefault(); jsonDz.classList.add("dragover"); });
      jsonDz.addEventListener("dragleave", () => jsonDz.classList.remove("dragover"));
      jsonDz.addEventListener("drop", e => {
        e.preventDefault();
        jsonDz.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleJsonFile(e.dataTransfer.files[0]);
        }
      });
      jsonFileInput.addEventListener("change", e => {
        if (e.target.files && e.target.files[0]) {
          handleJsonFile(e.target.files[0]);
        }
      });
    }

    // Preview jadvalidagi tahrirlash hodisalari
    const ptable = $(".preview-table");
    if (ptable) {
      ptable.addEventListener("input", e => {
        const td = e.target.closest("[contenteditable]");
        if (!td) return;
        const tr = td.closest("tr");
        const idx = +tr.dataset.previewIdx;
        const field = td.dataset.field;
        if (previewList[idx]) {
          previewList[idx][field] = td.innerText.trim();
        }
      });
    }
  }

  /* PDF faylni qabul qilish */
  async function handlePdfFile(file) {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      msg = { t: "err", s: "Faqat PDF formatdagi fayllarni yuklashingiz mumkin (.pdf)!" };
      render();
      return;
    }

    isLoading = true;
    loadingText = `${file.name} tahlil qilinmoqda...`;
    render();

    try {
      const items = await parsePdfFile(file);
      if (!items || !items.length) {
        msg = { t: "err", s: "PDF ichidan jadval yoki so'zlar topilmadi. Matn nusxalash yoki JSON usulini sinab ko'ring." };
      } else {
        previewList = buildPreviewList(items);
        msg = { t: "ok", s: `PDF'dan ${previewList.length} ta so'z topildi! Tekshirib, "Barcha so'zlarni bazaga qo'shish" tugmasini bosing.` };
      }
    } catch (err) {
      console.error(err);
      msg = { t: "err", s: `Xatolik: ${err.message || "PDF faylni ochib bo'lmadi"}` };
    } finally {
      isLoading = false;
      render();
    }
  }

  /* JSON faylni qabul qilish */
  function handleJsonFile(file) {
    if (!file) return;
    const reader = new FileReader();
    isLoading = true;
    loadingText = `${file.name} o'qilmoqda...`;
    render();

    reader.onload = e => {
      try {
        const items = parseJsonData(e.target.result);
        if (!items || !items.length) {
          msg = { t: "err", s: "JSON faylda so'zlar topilmadi yoki formati noto'g'ri." };
        } else {
          previewList = buildPreviewList(items);
          msg = { t: "ok", s: `JSON fayldan ${previewList.length} ta so'z topildi!` };
        }
      } catch (err) {
        msg = { t: "err", s: "JSON xatolik: " + err.message };
      } finally {
        isLoading = false;
        render();
      }
    };
    reader.onerror = () => {
      isLoading = false;
      msg = { t: "err", s: "Faylni o'qishda xatolik yuz berdi." };
      render();
    };
    reader.readAsText(file);
  }

  /* Faylni kompyuterga yuklab berish yordamchisi */
  function downloadFile(filename, text, type = "application/json") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /* -------------------------------------------------------------
     HODISALARNI TINGLASH (EventListeners)
  ------------------------------------------------------------- */
  document.addEventListener("submit", e => {
    if (e.target.id !== "f") return;
    e.preventDefault();
    report(addMany([{ w: $("#fw").value, syn: $("#fs").value, uz: $("#fu").value }]));
    render();
    if (msg.t === "ok") $("#fw").focus();
  });

  document.addEventListener("click", e => {
    const tabEl = e.target.closest("[data-tab]");
    if (tabEl) {
      curTab = tabEl.dataset.tab;
      msg = null;
      render();
      return;
    }

    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;

    // JSON matnini tahlil qilish
    if (act === "parse-json-text") {
      const txt = $("#jsonTextarea") ? $("#jsonTextarea").value : "";
      if (!txt.trim()) {
        msg = { t: "err", s: "Iltimos, avval JSON matnini kiriting!" };
        render();
        return;
      }
      try {
        const items = parseJsonData(txt);
        if (!items.length) {
          msg = { t: "err", s: "JSON ichidan so'zlar topilmadi." };
        } else {
          previewList = buildPreviewList(items);
          msg = { t: "ok", s: `JSON matnidan ${previewList.length} ta so'z topildi!` };
        }
      } catch (err) {
        msg = { t: "err", s: err.message };
      }
      render();
    }

    // Matndan nusxalangan tahlil
    else if (act === "parse-paste") {
      const txt = $("#pasteInput") ? $("#pasteInput").value : "";
      if (!txt.trim()) {
        msg = { t: "err", s: "Iltimos, avval matnni kiriting!" };
        render();
        return;
      }
      const items = parseTextLines(txt);
      if (!items.length) {
        msg = { t: "err", s: "Kiritilgan matndan so'zlar aniqlanmadi." };
      } else {
        previewList = buildPreviewList(items);
        msg = { t: "ok", s: `Matndan ${previewList.length} ta so'z topildi!` };
      }
      render();
    }

    // Preview qatorini o'chirish
    else if (act === "del-preview") {
      const idx = +el.dataset.idx;
      previewList.splice(idx, 1);
      previewList.forEach((x, i) => { x.idx = i + 1; });
      render();
    }

    // Preview bekor qilish
    else if (act === "clear-preview") {
      previewList = [];
      render();
    }

    // Preview barchasini saqlash
    else if (act === "save-preview") {
      if (!previewList.length) return;
      const r = addMany(previewList);
      report(r);
      previewList = [];
      render();
    }

    // Preview so'zlarini JSON qilib yuklab olish
    else if (act === "download-preview-json") {
      const data = previewList.map(c => ({ w: c.w, syn: c.syn, uz: c.uz }));
      downloadFile("sozlar.json", JSON.stringify(data, null, 2));
    }

    // words.js kodini nusxalash
    else if (act === "copy-preview") {
      const txt = previewList.map(c => `  ["${c.w}", "${c.syn}", "${c.uz}"],`).join("\n");
      const done = ok => {
        msg = ok
          ? { t: "ok", s: "Nusxalandi! Endi assets/words.js fayliga to'g'ridan-to'g'ri qo'yishingiz mumkin." }
          : { t: "err", s: "Nusxalab bo'lmadi." };
        render();
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(() => done(true), () => done(false));
      } else {
        done(false);
      }
    }

    // Barcha custom so'zlarni JSON fayl qilib export qilish
    else if (act === "export-json") {
      const list = A.custom.list();
      if (!list.length) {
        msg = { t: "err", s: "Hozircha saqlangan so'zlar mavjud emas." };
        render();
        return;
      }
      const cleanList = list.map(c => ({ w: c.w, syn: c.syn || "", uz: c.uz }));
      downloadFile("lugat-sozlar.json", JSON.stringify(cleanList, null, 2));
    }

    // Bitta so'zni o'chirish
    else if (act === "del") {
      const id = +el.dataset.id;
      A.custom.save(A.custom.list().filter(x => x.id !== id));
      delete P.m[id];
      save();
      msg = { t: "", s: "So'z o'chirildi." };
      render();
    }

    // Barcha o'zi qo'shgan so'zlarni o'chirish
    else if (act === "clear-all-custom") {
      if (confirm("Rostdan ham siz qo'shgan barcha so'zlarni o'chirmoqchimisiz?")) {
        const list = A.custom.list();
        for (const item of list) {
          delete P.m[item.id];
        }
        A.custom.save([]);
        save();
        msg = { t: "ok", s: "Siz qo'shgan barcha so'zlar tozalandi." };
        render();
      }
    }

    // words.js formatida nusxalash
    else if (act === "copy") {
      const txt = A.custom.list().map(c => `  ["${c.w}", "${c.syn}", "${c.uz}"],`).join("\n");
      const done = ok => {
        msg = ok
          ? { t: "ok", s: "Nusxalandi. Endi assets/words.js ro'yxati oxiriga qo'yishingiz mumkin." }
          : { t: "err", s: "Nusxalab bo'lmadi." };
        render();
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(() => done(true), () => done(false));
      } else {
        done(false);
      }
    }
  });

  render();
})();
