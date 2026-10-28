(function () {
  "use strict";
  // 動態貼圖分頁：設定與提示詞、母圖裁切、APNG 合成與下載。與靜態貼圖完全分開，圖片只在目前瀏覽器處理。
  const A = window.StickerAnim, D = window.StickerData, K = window.StickerCropCore, G = window.StickerContentGuard;
  const $ = id => document.getElementById(id);
  if (!A || !$("anim-root")) return;
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const KEY = "microglow-anim-settings-v1";
  let state = A.initial();
  try { const saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved && saved.settings && Array.isArray(saved.settings.items)) { Object.assign(state.settings, saved.settings); A.resize(state); } } catch { /* 沒有儲存也能用 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 儲存被擋也能用 */ } };

  // ---------- ① 設定與提示詞 ----------
  function fillSelect(id, options, filter) {
    const sel = $(id); sel.replaceChildren();
    options.filter(o => !filter || filter(o)).forEach(([value, label]) => sel.add(new Option(label, value)));
  }
  function setupForm() {
    const s = state.settings;
    fillSelect("anim-source", D.options.source);
    fillSelect("anim-kind", D.options.kind);
    fillSelect("anim-style", D.options.style, o => o[0] !== "likeness" || s.source !== "original");
    fillSelect("anim-dimension", D.options.dimension);
    fillSelect("anim-background", [["transparent", "透明背景（建議，LINE 需要）"], ["white", "純白背景"]]);
    fillSelect("anim-count", A.COUNTS.map(n => [String(n), n + " 張（" + n / 4 + " 張母圖）"]));
    fillSelect("anim-textmode", [["ai", "由 AI 在每格畫出同一句文字"], ["none", "不放文字"]]);
    for (const [id, key] of [["anim-source", "source"], ["anim-kind", "kind"], ["anim-style", "style"], ["anim-dimension", "dimension"], ["anim-background", "background"], ["anim-textmode", "textMode"]]) $(id).value = s[key];
    $("anim-count").value = String(s.count); $("anim-character").value = s.character; $("anim-custom-style").value = s.customStyle;
    const bind = (id, key, num) => $(id).addEventListener(id.includes("character") || id.includes("custom") ? "input" : "change", () => {
      state.settings[key] = num ? Number($(id).value) : $(id).value;
      if (key === "count") { A.resize(state); renderItems(); renderPlan(); }
      if (key === "source") fillStyle();
      conditions(); refresh();
    });
    bind("anim-source", "source"); bind("anim-kind", "kind"); bind("anim-style", "style"); bind("anim-dimension", "dimension");
    bind("anim-background", "background"); bind("anim-count", "count", true); bind("anim-textmode", "textMode");
    bind("anim-character", "character"); bind("anim-custom-style", "customStyle");
    conditions(); renderItems(); refresh();
  }
  function fillStyle() {
    const s = state.settings; fillSelect("anim-style", D.options.style, o => o[0] !== "likeness" || s.source !== "original");
    if (![...$("anim-style").options].some(o => o.value === s.style)) s.style = ""; $("anim-style").value = s.style;
  }
  function conditions() {
    const s = state.settings;
    $("anim-kind-field").hidden = s.source !== "original";
    $("anim-custom-style-field").hidden = s.style !== "custom";
  }
  function renderItems() {
    const box = $("anim-items"); box.replaceChildren();
    state.settings.items.forEach((entry, i) => {
      const row = el("div", undefined, "anim-item"), sel = el("select"), text = el("input"), motion = el("input"), warn = el("p", "", "field-hint anim-warn");
      sel.setAttribute("aria-label", "第 " + (i + 1) + " 張動作");
      A.ACTIONS.forEach(a => sel.add(new Option(a.label, a.id))); sel.add(new Option("自訂動作…", "custom")); sel.value = entry.action;
      text.type = "text"; text.maxLength = 20; text.value = entry.text; text.placeholder = "文字（可留空）"; text.setAttribute("aria-label", "第 " + (i + 1) + " 張文字");
      motion.type = "text"; motion.maxLength = 160; motion.value = entry.motion; motion.placeholder = "4 個畫格的動作，用 → 分開，例如：站直→舉手→揮手→放下"; motion.hidden = entry.action !== "custom"; motion.setAttribute("aria-label", "第 " + (i + 1) + " 張自訂動作");
      warn.id = "anim-warn-" + i;
      sel.addEventListener("change", () => {
        const previous = A.actionById(entry.action); entry.action = sel.value; motion.hidden = sel.value !== "custom";
        const next = A.actionById(sel.value); if (next && (!entry.text || (previous && entry.text === previous.text))) { entry.text = next.text; text.value = entry.text; }
        refresh();
      });
      text.addEventListener("input", () => { entry.text = text.value; refresh(); });
      motion.addEventListener("input", () => { entry.motion = motion.value; refresh(); });
      row.append(el("strong", String(i + 1).padStart(2, "0")), sel, text, motion, warn); box.append(row);
    });
  }
  function refresh() {
    const issues = A.validate(state), errors = issues.filter(x => x.level === "error");
    save();
    const list = $("anim-issues"); list.replaceChildren();
    issues.slice(0, 12).forEach(x => list.append(el("li", x.message, x.level === "error" ? "anim-error" : "")));
    $("anim-issues-box").hidden = !issues.length;
    state.settings.items.forEach((_, i) => { const w = $("anim-warn-" + i); if (w) w.textContent = issues.filter(x => x.field === "item-" + i).map(x => x.message).join(" "); });
    $("anim-prompts").hidden = errors.length > 0;
    renderPrompts(errors.length === 0);
    renderPlan(); invalidate();
  }
  let promptRevision = "";
  function renderPrompts(ok) {
    const box = $("anim-prompts"), total = A.mothers(state), key = ok ? JSON.stringify(state.settings) : "";
    if (!ok || key === promptRevision) return; promptRevision = key; box.replaceChildren();
    for (let m = 1; m <= total; m++) {
      const card = el("div", undefined, "anim-prompt-card"), button = el("button", "複製母圖 " + m + " 的提示詞（動態貼圖 " + ((m - 1) * 4 + 1) + "～" + m * 4 + "）", "button primary"), note = el("p", "", "field-hint"), area = el("textarea");
      button.type = "button"; area.readOnly = true; area.hidden = true; area.rows = 8; area.setAttribute("aria-label", "母圖 " + m + " 提示詞");
      button.addEventListener("click", async () => {
        let value; try { value = A.prompt(state, m); } catch (error) { note.textContent = error.message; return; }
        try { await navigator.clipboard.writeText(value); note.textContent = "✔ 已複製母圖 " + m + " 的提示詞。到 ChatGPT 或 Gemini 貼上" + (m > 1 ? "，並先附上前面母圖的圖片，" : "，") + "等圖生成後存成圖片。" + (state.settings.source === "photo" ? "照片角色要把照片一起附上。" : ""); area.hidden = true; }
        catch { area.value = value; area.hidden = false; area.focus(); area.select(); note.textContent = "這個瀏覽器不讓我自動複製。下面的框已選好全部文字，請按 Ctrl+C 複製。"; }
      });
      card.append(button, note, area); box.append(card);
    }
  }
  function renderPlan() { const n = A.mothers(state); $("anim-plan").textContent = "目前設定：" + state.settings.count + " 張動態貼圖，需要 " + n + " 張母圖（每張母圖 4×4 格，共 4 組動作，每組 4 個畫格）。"; }

  // ---------- ② 裁切與合成 ----------
  let files = [], stickers = [], selected = 0, prepared = null, busy = false, revision = 0, spotCache = new Map(), timer = 0;
  const status = text => { $("anim-status").textContent = text; };
  const seq = A.SEQUENCE;
  function invalidate() { revision++; prepared = null; if ($("anim-ready")) $("anim-ready").hidden = true; if ($("anim-review")) $("anim-review").checked = false; controls(); }
  function controls() {
    const ready = stickers.length === state.settings.count && stickers.every(s => s);
    $("anim-run").disabled = busy || files.length !== A.mothers(state) || A.blocked(A.validate(state));
    $("anim-check").disabled = busy || !ready;
    $("anim-download").disabled = busy || !prepared || prepared.issues > 0 || !$("anim-review").checked;
    $("anim-clear").disabled = busy || !files.length;
    $("anim-delay-out").textContent = state.settings.delay + " 毫秒";
    $("anim-loops-out").textContent = state.settings.loops + " 次";
    $("anim-brand-level").textContent = state.settings.brandOpacity + "%";
    const total = seq.length * state.settings.delay * state.settings.loops;
    $("anim-time").textContent = "單次播放 " + (seq.length * state.settings.delay / 1000).toFixed(2) + " 秒，總長 " + (total / 1000).toFixed(1) + " 秒" + (total > 4000 ? "（超過 LINE 的 4 秒上限，請縮短停留時間或減少次數）" : "（符合 4 秒內）");
  }
  function renderFiles() {
    const box = $("anim-mothers"); box.replaceChildren();
    files.forEach((m, i) => {
      const card = el("div", undefined, "crop-mother"), c = canvas(1, 1), k = Math.min(160 / m.image.width, 120 / m.image.height, 1);
      c.width = Math.max(1, Math.round(m.image.width * k)); c.height = Math.max(1, Math.round(m.image.height * k)); c.getContext("2d").drawImage(m.image, 0, 0, c.width, c.height);
      const up = el("button", "往前", "button small"), down = el("button", "往後", "button small"), del = el("button", "移除", "button small");
      for (const b of [up, down, del]) b.type = "button";
      up.disabled = i === 0; down.disabled = i === files.length - 1;
      up.onclick = () => { [files[i - 1], files[i]] = [files[i], files[i - 1]]; changedFiles(); };
      down.onclick = () => { [files[i + 1], files[i]] = [files[i], files[i + 1]]; changedFiles(); };
      del.onclick = () => { files[i].image.close(); files.splice(i, 1); changedFiles(); };
      card.append(el("strong", "母圖 " + (i + 1)), c, el("p", m.file.name + "（" + m.image.width + "×" + m.image.height + "）", "field-hint"), up, down, del); box.append(card);
    });
    $("anim-files-hint").textContent = files.length ? "已加入 " + files.length + " 張，需要 " + A.mothers(state) + " 張；順序就是母圖 1、2…（對應提示詞的動態貼圖 1～4、5～8…）。" : "尚未加入母圖。";
  }
  function changedFiles() { stickers = []; $("anim-results").replaceChildren(); stopAnim(); renderFiles(); invalidate(); status(files.length ? "已更新母圖，請按「裁切並合成動畫」。" : "尚未加入母圖。"); }
  $("anim-files").addEventListener("change", async () => {
    const picked = [...$("anim-files").files]; $("anim-files").value = ""; if (!picked.length) return;
    const need = A.mothers(state); picked.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant", { numeric: true }));
    let added = 0, skipped = [];
    for (const file of picked) {
      if (files.length >= need) { skipped.push(file.name + "（超過需要的 " + need + " 張）"); continue; }
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) { skipped.push(file.name + "（只能 PNG／JPG／WebP，最多 20 MB）"); continue; }
      try { const image = await createImageBitmap(file); if (image.width < 8 || image.height < 8 || image.width * image.height > 16000000) { image.close(); skipped.push(file.name + "（尺寸不合）"); continue; } files.push({ file, image }); added++; }
      catch { skipped.push(file.name + "（讀不到）"); }
    }
    changedFiles(); if (skipped.length) status("有 " + skipped.length + " 個檔案沒有加入：" + skipped.join("、"));
  });
  $("anim-clear").onclick = () => { if (!files.length || !confirm("移除全部母圖與合成結果？原始檔案不受影響。")) return; files.forEach(m => m.image.close()); files = []; changedFiles(); };

  const BLOCK_IDS = [[0, 1, 4, 5], [2, 3, 6, 7], [8, 9, 12, 13], [10, 11, 14, 15]];
  function cutMother(image) {
    const W = image.width, H = image.height, cv = canvas(W, H), g = cv.getContext("2d", { willReadFrequently: true });
    g.drawImage(image, 0, 0); const data = g.getImageData(0, 0, W, H), xs = K.cuts(W, 4), ys = K.cuts(H, 4), notes = [];
    const split = K.splitByContent(data.data, W, H, xs, ys, 24);
    if (split) {
      if (split.clipped.length) notes.push("第 " + split.clipped.map(n => n + 1).join("、") + " 格的圖案貼著格子邊緣，可能已被生成工具切平");
      if (split.merged.length) notes.push("第 " + split.merged.map(n => n + 1).join("、") + " 格的圖案和相鄰格相連，已沿細處分開");
      return { cells: split.cells, xs, ys, notes };
    }
    notes.push("背景不是單一顏色，改用等分硬切（不去背）；請確認母圖是透明背景");
    const cells = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const x = xs[c], y = ys[r], w = xs[c + 1] - x, h = ys[r + 1] - y, d = g.getImageData(x, y, w, h); cells.push({ x, y, width: w, height: h, data: d.data }); }
    return { cells, xs, ys, notes };
  }
  // 4 個畫格各在母圖的不同格子裡：以「各自格子的左上角」為原點對位（而不是母圖上的絕對座標），
  // 所以 AI 把角色畫在每格的同一個相對位置，4 個畫格疊起來就會對齊。
  function buildSticker(cells, ids, xs, ys) {
    const list = ids.map(i => cells[i]), real = list.filter(Boolean);
    if (!real.length) return null;
    const rel = ids.map((i, k) => list[k] ? { x: list[k].x - xs[i % 4], y: list[k].y - ys[Math.floor(i / 4)] } : null);
    const ux = Math.min(...rel.filter(Boolean).map((r, k) => r.x)), uy = Math.min(...rel.filter(Boolean).map(r => r.y));
    const ex = Math.max(...list.map((c, k) => c ? rel[k].x + c.width : -1e9)), ey = Math.max(...list.map((c, k) => c ? rel[k].y + c.height : -1e9));
    const uw = ex - ux, uh = ey - uy;
    const frames = list.map((c, k) => { const f = canvas(uw, uh); if (c) { const t = canvas(c.width, c.height); t.getContext("2d").putImageData(new ImageData(c.data, c.width, c.height), 0, 0); f.getContext("2d").drawImage(t, rel[k].x - ux, rel[k].y - uy); } return f; });
    return { frames, uw, uh, missing: list.map((c, k) => c ? 0 : k + 1).filter(Boolean), zoom: 100 };
  }
  $("anim-run").onclick = async () => {
    if (busy) return; busy = true; controls(); stopAnim(); stickers = []; spotCache = new Map(); const notes = [], token = ++revision;
    try {
      status("裁切中，請稍候…");
      for (let m = 0; m < files.length; m++) {
        await new Promise(r => setTimeout(r, 0));
        const cut = cutMother(files[m].image);
        cut.notes.forEach(n => notes.push("母圖 " + (m + 1) + "：" + n));
        BLOCK_IDS.forEach((ids, b) => { const n = m * 4 + b + 1; if (n > state.settings.count) return; const s = buildSticker(cut.cells, ids, cut.xs, cut.ys); if (!s) { notes.push("母圖 " + (m + 1) + " 的第 " + n + " 張是空的，找不到圖案"); stickers[n - 1] = null; } else { if (s.missing.length) notes.push("第 " + n + " 張缺少畫格 " + s.missing.join("、") + "（會顯示成空白）"); stickers[n - 1] = s; } });
      }
      if (token !== revision) return;
      selected = 0; renderResults(); startAnim();
      status("已合成 " + stickers.filter(Boolean).length + " 張動態貼圖預覽。請逐張檢查動作是否連續，再按「檢查規格並準備下載」。" + (notes.length ? " 提醒：" + notes.join("；") : ""));
    } catch (error) { status("裁切未完成：" + error.message); } finally { busy = false; controls(); }
  };

  function frameAt(s, k, target, W, H, pad) {
    const g = target.getContext("2d"), f = K.fit(s.uw, s.uh, W, H, s.zoom, 0, 0, pad);
    g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(s.frames[k], f.x, f.y, f.width, f.height);
  }
  // 品牌小標記：以整組 4 個畫格的聯集找位置，4 個畫格用同一個位置，播放時標記不會跳動；只畫在有圖案的像素上。
  function brandSpot(s) {
    const key = s.zoom + "|" + state.settings.brandText; if (spotCache.has(s) && spotCache.get(s).key === key) return spotCache.get(s).spot;
    const W = A.STICKER.width, H = A.STICKER.height, union = new Uint8ClampedArray(W * H * 4), tmp = canvas(W, H);
    for (let k = 0; k < 4; k++) { frameAt(s, k, tmp, W, H, 8); const d = tmp.getContext("2d").getImageData(0, 0, W, H).data; for (let i = 3; i < d.length; i += 4) if (d[i] > union[i]) union[i] = d[i]; }
    const spot = window.StickerBrand && window.StickerBrand.place ? window.StickerBrand.place(union, W, H, 74, 16) : null;
    spotCache.set(s, { key, spot }); return spot;
  }
  function stamp(target, s) {
    const text = Array.from(state.settings.brandText.trim().replace(/[\r\n\t]/g, " ")).slice(0, 24).join(""); if (!text) return;
    const alpha = state.settings.brandOpacity / 100, g = target.getContext("2d"), spot = brandSpot(s);
    if (spot) {
      const ink = canvas(74, 16), c = ink.getContext("2d"); c.font = "9px sans-serif"; c.textBaseline = "middle"; c.lineJoin = "round"; c.lineWidth = 2.5;
      c.strokeStyle = spot.mean > 130 ? "#ffffff" : "#181818"; c.strokeText(text, 0, 8, 74); c.fillStyle = spot.mean > 130 ? "#181818" : "#ffffff"; c.fillText(text, 0, 8, 74);
      g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = "source-atop"; g.drawImage(ink, 0, 0, 74, 16, spot.x, spot.y, spot.w, spot.h); g.restore();
    }
    const tile = canvas(Math.ceil(text.length * 8) + 90, 100), t = tile.getContext("2d"); t.translate(tile.width / 2, tile.height / 2); t.rotate(-.35); t.font = "8px sans-serif"; t.textAlign = "center"; t.textBaseline = "middle"; t.lineWidth = 2; t.lineJoin = "round"; t.strokeStyle = "#ffffff"; t.strokeText(text, 0, 0); t.fillStyle = "#181818"; t.fillText(text, 0, 0);
    g.save(); g.globalAlpha = alpha * .35; g.globalCompositeOperation = "source-atop"; g.fillStyle = g.createPattern(tile, "repeat"); g.fillRect(0, 0, target.width, target.height); g.restore();
  }
  function render(s, k, target) { frameAt(s, k, target, A.STICKER.width, A.STICKER.height, 8); stamp(target, s); }

  function renderResults() {
    const box = $("anim-results"); box.replaceChildren();
    stickers.forEach((s, i) => {
      const card = el("article", undefined, "crop-sticker"), c = canvas(A.STICKER.width, A.STICKER.height);
      card.append(el("h3", String(i + 1).padStart(2, "0")));
      if (!s) { card.append(el("p", "這一組沒有找到圖案。", "field-hint")); box.append(card); return; }
      c.setAttribute("aria-label", "第 " + (i + 1) + " 張動畫預覽"); s.canvas = c; render(s, 0, c);
      const radio = el("input"), label = el("label"), zoom = el("input"), zl = el("label");
      radio.type = "radio"; radio.name = "anim-main"; radio.checked = i === selected; radio.onchange = () => { selected = i; invalidate(); };
      label.append(radio, document.createTextNode(" 選為主要圖片／標籤圖片"));
      zoom.type = "range"; zoom.min = 50; zoom.max = 100; zoom.value = s.zoom; zoom.oninput = () => { s.zoom = Number(zoom.value); invalidate(); };
      zl.append(document.createTextNode("大小（%）"), zoom);
      card.append(c, label, zl); if (s.missing.length) card.append(el("p", "缺少畫格 " + s.missing.join("、"), "field-hint")); box.append(card);
    });
  }
  function startAnim() {
    stopAnim(); let last = -1;
    const tick = now => {
      const frame = Math.floor(now / Math.max(60, state.settings.delay)) % seq.length;
      if (frame !== last) { last = frame; for (const s of stickers) if (s && s.canvas) render(s, seq[frame], s.canvas); }
      timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  }
  function stopAnim() { if (timer) cancelAnimationFrame(timer); timer = 0; }
  const blobOf = c => new Promise(resolve => c.toBlob(resolve, "image/png"));
  const bytesOf = async c => { const b = await blobOf(c); if (!b) throw new Error("圖片編碼失敗。"); return new Uint8Array(await b.arrayBuffer()); };

  $("anim-check").onclick = async () => {
    if (busy) return; busy = true; controls(); const token = revision, entries = [], rows = []; let issues = 0;
    try {
      status("正在合成 APNG 並檢查規格…");
      const play = async (s, W, H, pad, brand) => {
        const frames = [];
        for (const k of seq) { const c = canvas(W, H); frameAt(s, k, c, W, H, pad); if (brand) stamp(c, s); frames.push(await bytesOf(c)); c.width = c.height = 1; }
        return A.apng(frames, state.settings.delay, state.settings.loops);
      };
      for (let i = 0; i < stickers.length; i++) {
        if (token !== revision) throw new Error("設定已變更，請重新檢查。");
        const s = stickers[i]; if (!s) { rows.push(["" + (i + 1), "沒有圖案"]); issues++; continue; }
        const data = await play(s, A.STICKER.width, A.STICKER.height, 8, true), problems = A.specIssues({ bytes: data.length, frames: seq.length, loops: state.settings.loops, delay: state.settings.delay, width: A.STICKER.width, height: A.STICKER.height, transparent: state.settings.background === "transparent" });
        entries.push({ name: String(i + 1).padStart(2, "0") + ".png", data }); issues += problems.length ? 1 : 0;
        rows.push([String(i + 1).padStart(2, "0"), Math.ceil(data.length / 1024) + " KB・" + seq.length + " 畫格・" + (seq.length * state.settings.delay / 1000).toFixed(2) + " 秒×" + state.settings.loops + " 次" + (problems.length ? "｜不合格：" + problems.join("；") : "｜合格")]);
      }
      const main = stickers[selected]; if (!main) throw new Error("主要圖片的那一張沒有圖案，請改選。");
      const mainData = await play(main, A.MAIN.width, A.MAIN.height, 8, false);
      if (mainData.length >= 1024 * 1024) { rows.push(["main", Math.ceil(mainData.length / 1024) + " KB｜不合格：要小於 1 MB"]); issues++; } else rows.push(["main", Math.ceil(mainData.length / 1024) + " KB・240×240 動畫｜合格"]);
      const tc = canvas(A.TAB.width, A.TAB.height); frameAt(main, 2, tc, A.TAB.width, A.TAB.height, 4);
      entries.unshift({ name: "tab.png", data: K.png72(await bytesOf(tc)) }, { name: "main.png", data: mainData });
      if (token !== revision) throw new Error("設定已變更，請重新檢查。");
      const list = $("anim-spec"); list.replaceChildren(); rows.forEach(r => list.append(el("li", r[0] + "：" + r[1], /不合格|沒有/.test(r[1]) ? "anim-error" : "")));
      prepared = { entries, issues, revision: token };
      $("anim-spec-box").hidden = false;
      status(issues ? "有 " + issues + " 項不合格，請看下方清單調整後重新檢查。" : "規格檢查全部合格。請勾選確認後下載 ZIP。");
    } catch (error) { prepared = null; status("檢查未完成：" + error.message); } finally { busy = false; controls(); }
  };
  $("anim-download").onclick = () => {
    if (!prepared || prepared.issues || !$("anim-review").checked || prepared.revision !== revision) return;
    try {
      const zip = K.zip(prepared.entries), url = URL.createObjectURL(new Blob([zip], { type: "application/zip" })), a = el("a");
      a.href = url; a.download = "line-animated-stickers-" + state.settings.count + ".zip"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      status("已下載 ZIP（" + Math.ceil(zip.length / 1024) + " KB），內含 main.png、tab.png 與 01.png 起的動態貼圖。請解壓檢查後再到 LINE Creators Market 上傳；此工具不會代為發布，也不保證通過審核。");
    } catch (error) { status("下載未完成：" + error.message); }
  };
  for (const [id, key] of [["anim-delay", "delay"], ["anim-loops", "loops"], ["anim-brand-opacity", "brandOpacity"]]) $(id).addEventListener("input", () => { state.settings[key] = Number($(id).value); save(); invalidate(); if (stickers.length) { spotCache = new Map(); if (key === "brandOpacity") stickers.forEach(s => s && s.canvas && render(s, 0, s.canvas)); } });
  $("anim-brand-text").addEventListener("input", () => { state.settings.brandText = $("anim-brand-text").value; save(); spotCache = new Map(); invalidate(); });
  $("anim-review").addEventListener("change", controls);
  $("anim-delay").value = state.settings.delay; $("anim-loops").value = state.settings.loops; $("anim-brand-text").value = state.settings.brandText; $("anim-brand-opacity").value = state.settings.brandOpacity;
  window.addEventListener("anim-tab-change", event => { if (event.detail === "crop" && stickers.length) startAnim(); else stopAnim(); });
  setupForm(); renderFiles(); controls();
})();
