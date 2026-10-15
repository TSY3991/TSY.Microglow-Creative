(function (root) {
  "use strict";
  const C = typeof module !== "undefined" && module.exports ? require("./sticker-core.js") : root.StickerCore;
  const D = typeof module !== "undefined" && module.exports ? require("./sticker-data.js") : root.StickerData;
  function payload(state) {
    const issues = C.validate(state, 2);
    if (issues.length) throw new Error(issues.map(x => x.message).join(" "));
    const s = state.settings;
    return {
      count: s.count,
      context: { source: s.source, kind: C.label("kind", s.kind), character: s.character, style: C.label("style", s.style), customStyle: s.customStyle, scene: C.sceneName(s) },
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
      return row;
    });
    return rows.sort((a, b) => a.id - b.id);
  }
  // 只補真正空白的欄位，並記下每個補入處，讓使用者能一鍵復原。
  function applyDetailed(state, rows) {
    const validated = suggestions({ items: rows }, payload(state));
    const changes = [];
    validated.forEach(x => {
      const entry = state.items[x.id - 1];
      for (const key of ["text", "emotion", "action"]) {
        if (!entry[key].trim() && (key !== "text" || C.hasText(state, entry)) && x[key]) { entry[key] = x[key]; changes.push({ index: x.id - 1, key, value: x[key] }); }
      }
    });
    return { filled: changes.length, changes };
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
      throw new Error(message[response.status] || "AI 服務未完成安排，原有內容保留，請稍後再試。");
    }
    return suggestions(await response.json(), input);
  }
  const api = { payload, suggestions, apply, applyDetailed, undo, endpoint, request };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.StickerAI = api;
})(typeof window !== "undefined" ? window : globalThis);
