(function () {
  "use strict";
  // 頂層切換：靜態貼圖（原有工具，內容與行為不變）／動態貼圖（新增）。只決定誰顯示，不碰靜態工具的狀態。
  const $ = id => document.getElementById(id);
  if (!$("anim-root")) return;
  const staticParts = () => [$("tab-prompt").closest("nav"), $("usage-guide"), $("creator"), $("sticker-crop"), document.querySelector(".save-panel"), $("crop-browser-help")].filter(Boolean);
  const kinds = { static: $("kind-static"), anim: $("kind-anim") }, tabs = { prompt: $("anim-tab-prompt"), crop: $("anim-tab-crop") };
  const panels = { prompt: [$("anim-guide"), $("anim-creator")], crop: [$("anim-crop")] };
  const heroKind = $("hero-kind"), heroText = heroKind ? heroKind.textContent : "";
  const wanted = () => location.hash === "#animated-crop" ? ["anim", "crop"] : location.hash === "#animated" ? ["anim", "prompt"] : ["static", "prompt"];
  let current = "";
  function show(kind, tab) {
    const isAnim = kind === "anim";
    for (const [name, button] of Object.entries(kinds)) { const on = name === kind; button.setAttribute("aria-selected", String(on)); button.tabIndex = on ? 0 : -1; }
    // 靜態工具的顯示由它自己的分頁程式控制；這裡只用額外的 kind-off 蓋住，切回靜態時完全還原。
    for (const part of staticParts()) part.classList.toggle("kind-off", isAnim);
    $("anim-root").classList.toggle("tab-off", !isAnim);
    for (const [name, button] of Object.entries(tabs)) { const on = name === tab; button.setAttribute("aria-selected", String(on)); button.tabIndex = on ? 0 : -1; }
    for (const [name, list] of Object.entries(panels)) for (const el of list) el.classList.toggle("tab-off", name !== tab);
    if (heroKind) heroKind.textContent = isAnim ? "提示詞產生工具・動態貼圖（APNG）" : heroText;
    const key = kind + tab; if (key !== current) { current = key; window.dispatchEvent(new CustomEvent("anim-tab-change", { detail: isAnim ? tab : "" })); }
  }
  function go(kind, tab) {
    show(kind, tab);
    try { history.replaceState(null, "", kind === "anim" ? (tab === "crop" ? "#animated-crop" : "#animated") : ($("tab-crop").getAttribute("aria-selected") === "true" ? "#sticker-crop" : location.pathname + location.search)); } catch { /* 網址無法更新也能用 */ }
  }
  kinds.static.addEventListener("click", () => go("static", "prompt"));
  kinds.anim.addEventListener("click", () => go("anim", "prompt"));
  tabs.prompt.addEventListener("click", () => go("anim", "prompt"));
  tabs.crop.addEventListener("click", () => go("anim", "crop"));
  for (const group of [[kinds.static, kinds.anim], [tabs.prompt, tabs.crop]]) group.forEach((button, i) => button.addEventListener("keydown", event => {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: group.length - 1 }[event.key]; if (next === undefined) return;
    event.preventDefault(); group[(next + group.length) % group.length].focus(); group[(next + group.length) % group.length].click();
  }));
  window.addEventListener("hashchange", () => { const [k, t] = wanted(); if (k === "anim" || current.startsWith("anim")) show(k, t); });
  const [k, t] = wanted(); show(k, t);
})();
