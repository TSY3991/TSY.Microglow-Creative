(function (root) {
  "use strict";
  const C = typeof module !== "undefined" && module.exports ? require("./sticker-core.js") : root.StickerCore;
  const D = typeof module !== "undefined" && module.exports ? require("./sticker-data.js") : root.StickerData;
  const G = typeof module !== "undefined" && module.exports ? require("./sticker-guard.js") : root.StickerContentGuard;
  function payload(state) {
    const issues = C.validate(state, 2);
    if (issues.length) throw new Error(issues.map(x => x.message).join(" "));
    const s = state.settings;
    // 角色設計器的選擇以精簡文字併入角色描述（上限 1000 字；超過就不併入，不截斷使用者原文）。
    const design = C.characterDesign(s, true), joined = design ? (s.character.trim() ? s.character.trim() + "｜" : "") + "角色設計：" + design : "";
    const character = joined && joined.length <= 1000 ? joined : s.character;
    return {
      count: s.count,
      context: { source: s.source, kind: C.label("kind", s.kind), character, style: C.styleDescription(s), customStyle: s.customStyle, scene: C.sceneBrief(s)+"。"+C.contentBrief(s)+C.dialogueRule+C.balanceRule(state) },
      items: state.items.map((x, i) => ({ id: i + 1, text: x.text, emotion: x.emotion, action: x.action, hasText: C.hasText(state, x) }))
    };
  }
  function suggestions(data, input) {
    if (!data || !Array.isArray(data.items) || data.items.length !== input.count) throw new Error("AI 回傳筆數不符，原有內容保留。");
    const ids = new Set();
    const rows = data.items.map(x => {
      if (!x || !Number.isInteger(x.id) || x.id < 1 || x.id > input.count || ids.has(x.id)) throw new Error("AI 回傳順序不完整，原有內容保留。");
      ids.add(x.id);
      const original = input.items[x.id - 1], row = { id: x.id };
      for (const key of ["text", "emotion", "action"]) {
        if (typeof x[key] !== "string" || x[key].length > 300) throw new Error("AI 回傳內容格式不符，原有內容保留。");
        row[key] = original[key].trim() ? original[key] : key === "text" && !original.hasText ? original.text : x[key].trim();
        if ((key !== "text" || original.hasText) && !row[key].trim()) throw new Error("AI 回傳內容不完整，原有內容保留。");
      }
      if(original.hasText&&!original.text.trim()&&Array.from(row.text).length>8)throw new Error("AI 第 "+x.id+" 句超過 8 字，尚未套用；原有內容保留。請再安排一次，或自行填入短句。");
      return row;
    });
    return rows.sort((a, b) => a.id - b.id);
  }
  // 只補真正空白的欄位，並記下每個補入處，讓使用者能一鍵復原。
  // AI 自由發想的內容若有任何可辨識風險（含需確認項目）就不套用，該欄保持空白，可再請 AI 重新安排。
  function applyDetailed(state, rows) {
    const validated = suggestions({ items: rows }, payload(state));
    const changes = [], skipped = [];
    validated.forEach(x => {
      const entry = state.items[x.id - 1];
      for (const key of ["text", "emotion", "action"]) {
        if (!entry[key].trim() && (key !== "text" || C.hasText(state, entry)) && x[key]) {
          const hits = G ? G.checkText(x[key]) : [];
          if (hits.length) { skipped.push({ index: x.id - 1, key, label: hits[0].label }); continue; }
          entry[key] = x[key]; changes.push({ index: x.id - 1, key, value: x[key] });
        }
      }
    });
    return { filled: changes.length, changes, skipped };
  }
  function apply(state, rows) { return applyDetailed(state, rows).filled; }
  // 只復原「仍等於 AI 補入值」的欄位；使用者後來改過的不動。
  function undo(state, changes) {
    let restored = 0;
    for (const { index, key, value } of changes) {
      const entry = state.items[index];
      if (entry && entry[key] === value) { entry[key] = ""; restored++; }
    }
    return restored;
  }
  // 同一張只要有任一欄是空的、要重新安排，就把「AI 先前補入、使用者沒改過」的其他欄一起清掉，讓台詞／表情／動作整組重排而不是新舊混搭。
  // origin：{ 張號: { text, emotion, action } }（AI 補入的原值）；回傳被清掉的欄位，失敗時可用 restore 還原。
  function regroup(state, origin) {
    const cleared = [];
    state.items.slice(0, state.settings.count).forEach((entry, index) => {
      const made = origin && origin[index];
      if (!made) return;
      const keys = ["text", "emotion", "action"].filter(k => k !== "text" || C.hasText(state, entry));
      if (!keys.some(k => !entry[k].trim())) return;
      for (const k of keys) if (entry[k].trim() && entry[k] === made[k]) { cleared.push({ index, key: k, value: entry[k] }); entry[k] = ""; }
    });
    return cleared;
  }
  function restore(state, cleared) { for (const { index, key, value } of cleared) { const e = state.items[index]; if (e && !e[key].trim()) e[key] = value; } }
  function endpoint(value) {
    if (!value) return "";
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/arrange") throw new Error("網站 AI 位址設定不正確。");
    return url.href;
  }
  async function request(url, input, signal) {
    const target = endpoint(url);
    if (!target) throw new Error("網站 AI 尚未啟用。");
    const response = await fetch(target, { method: "POST", mode: "cors", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
    if (!response.ok) {
      const message = { 400: "請檢查角色與逐張內容。", 403: "目前網站沒有使用這項 AI 服務的權限。", 413: "內容太多，請縮短描述後再試。", 429: "AI 免費額度或使用頻率已達限制，請稍後再試；仍可手動設定。", 503: "網站 AI 尚未啟用或暫時無法使用，仍可手動設定。", 504: "AI 回覆逾時，原有內容保留，請稍後再試。" };
      const known={
        '網站 AI 尚未啟用。':'網站 AI 服務設定尚未完成，請管理者檢查啟用開關、金鑰與限流設定。原有內容保留。',
        '服務來源辨識未就緒。':'網站 AI 無法辨識請求來源，請管理者檢查服務設定。原有內容保留。',
        'Gemini 無法接受目前的請求設定。':'Gemini 不接受目前的請求設定，請管理者檢查模型與請求格式。原有內容保留。',
        'Gemini 金鑰驗證失敗，請管理者檢查金鑰。':'Gemini 金鑰驗證失敗，請管理者檢查金鑰。原有內容保留。',
        'Gemini 金鑰或專案沒有使用權限，請管理者檢查設定。':'Gemini 專案或金鑰沒有使用權限，請管理者檢查設定。原有內容保留。',
        '目前指定的 Gemini 模型無法使用，請管理者檢查模型設定。':'目前指定的 Gemini 模型無法使用，請管理者確認模型名稱與可用性。原有內容保留。',
        'Gemini 暫時無法使用。':'Gemini 目前暫時無法使用，請稍後再試。原有內容保留；本工具未自動重試。'
      };
      let detail;try{const body=await response.json();if(response.status===503&&typeof body?.error==='string'&&Object.hasOwn(known,body.error))detail=known[body.error];
        const categories={REQUEST_REJECTED:'Gemini 拒絕本次請求，目前無法進一步分類原因，請將診斷碼提供管理者。',FREE_TIER_REGION:'Gemini 回報目前地區無法使用免費方案；本工具不會自動啟用付費。',REGION_UNSUPPORTED:'Gemini 拒絕目前服務連線地區的請求，請管理者檢查服務執行地區與 Google 使用條件。',BILLING_REQUIRED:'Gemini 回報帳務或方案條件未滿足；本工具不會自動啟用付費。',CREDENTIAL:'Gemini 回報驗證設定問題，請管理者檢查金鑰權限。',SCHEMA:'Gemini 拒絕目前的輸出格式設定，請管理者檢查回應結構。',OUTPUT_LIMIT:'Gemini 回報輸出長度設定不符，請管理者檢查模型限制。',INPUT_LIMIT:'Gemini 回報輸入內容超過模型限制，請縮短描述。',MODEL:'Gemini 回報模型設定不符，請管理者檢查模型可用性。'};
        const d=body?.diagnostic;if(response.status===503&&d?.version===1&&typeof d.category==='string'&&Object.hasOwn(categories,d.category))detail=categories[d.category]+'原有內容保留。診斷：'+d.category+(/^[A-Z]{3}$/.test(d.edge||'')?'／'+d.edge:'');
      }catch{}
      throw new Error(detail || message[response.status] || "AI 服務未完成安排，原有內容保留，請稍後再試。");
    }
    return suggestions(await response.json(), input);
  }
  // 搜尋不到的職業／情境字詞回報（使用者勾選同意才會呼叫；只送字詞）。位址由 /arrange 換成 /search-miss。
  function missEndpoint(value) { const target = endpoint(value); if (!target) return ""; const url = new URL(target); url.pathname = "/search-miss"; return url.href; }
  async function reportMiss(url, query) {
    const target = missEndpoint(url), q = String(query).trim().slice(0, 30);
    if (!target || !q) return false;
    try { const response = await fetch(target, { method: "POST", mode: "cors", credentials: "omit", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) }); return response.ok; }
    catch { return false; }
  }
  const api = { regroup, restore, missEndpoint, reportMiss, payload, suggestions, apply, applyDetailed, undo, endpoint, request };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.StickerAI = api;
})(typeof window !== "undefined" ? window : globalThis);
