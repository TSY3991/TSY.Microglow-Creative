(function () {
  "use strict";
  const tools = window.creativeImageTools.filter(tool => tool.status === "active");
  const grid = document.querySelector("#image-tool-grid");
  const filters = document.querySelector("#tool-filters");
  const dialog = document.querySelector("#tool-detail");
  const content = document.querySelector("#detail-content");
  const feedback = document.querySelector("#copy-status");
  const timers = new WeakMap();
  const escape = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  function safeUrl(value) {
    if (!value) return null;
    try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; } catch { return null; }
  }
  function actions(tool, filled = false) {
    const platforms = tool.platforms.map(platform => {
      const url = safeUrl(platform.url);
      return url ? '<a class="tool-button platform-button" href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">' + escape(platform.id === 'chatgpt' && url.includes('/share/') ? '查看 ChatGPT 示範對話' : '使用 ' + platform.label) + '</a>' : '<button class="tool-button platform-button" type="button" disabled>' + escape(platform.label) + '・即將推出</button>';
    }).join("");
    return '<div class="tool-actions">' + platforms + '<button type="button" class="tool-button copy-button" data-copy="' + escape(tool.id) + '">' + (filled ? '複製生圖提示詞' : '複製空白模板') + '</button></div>';
  }
  function badges(items) { return '<div class="tool-tags">' + items.map(item => '<span>' + escape(item) + '</span>').join("") + '</div>'; }
  function render(category) {
    const selected = tools.filter(tool => category === "all" || tool.category === category);
    grid.innerHTML = selected.map(tool => {
      const preview = tool.previewImage ? '<img src="' + escape(tool.previewImage) + '" alt="' + escape(tool.title + '示意圖') + '">' : '<span class="preview-glyph" aria-hidden="true">✦</span><span>' + escape(tool.previewLabel) + '</span>';
      return '<article class="image-tool-card"><div class="tool-preview">' + preview + '</div><div class="image-card-copy"><span class="tool-category">' + escape(tool.categoryLabel) + '</span><h3><button type="button" class="tool-title-button" data-detail="' + escape(tool.id) + '">' + escape(tool.title) + '</button></h3><p>' + escape(tool.description) + '</p>' + badges(tool.tags) + '<div class="platform-badges" aria-label="支援平台">' + badges(tool.platforms.map(platform => platform.label)) + '</div><button type="button" class="detail-button" data-detail="' + escape(tool.id) + '">填寫模板 →</button>' + actions(tool) + '</div></article>';
    }).join("");
    document.querySelector("#tool-count").textContent = selected.length + " 個模板";
    filters.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.category === category)));
  }
  const categories = new Map([["all", "全部"]]);
  tools.forEach(tool => categories.set(tool.category, tool.categoryLabel));
  filters.innerHTML = Array.from(categories, ([id,label]) => '<button type="button" class="tool-button" data-category="' + escape(id) + '" aria-pressed="false">' + escape(label) + '</button>').join("");
  filters.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (button) render(button.dataset.category);
  });
  function list(title, items) { return '<section class="detail-list"><h3>' + title + '</h3>' + (items.length ? '<ul>' + items.map(item => '<li>' + escape(item) + '</li>').join("") + '</ul>' : '<p>依活動需求選擇背景元素。</p>') + '</section>'; }
  async function copy(button, tool) {
    const filled = Boolean(button.closest("dialog"));
    const prompt = filled ? window.CreativeImageBuilder.getPrompt() : window.CreativeImageBuilder.template(tool);
    if (prompt === null) return;
    const label = filled ? "複製生圖提示詞" : "複製空白模板";
    clearTimeout(timers.get(button));
    try {
      await navigator.clipboard.writeText(prompt);
      button.textContent = "已複製";
      const detailFeedback = content.querySelector(".detail-copy-status");
      if (filled && detailFeedback) detailFeedback.textContent = "已複製，可貼到外部 AI 平台使用。";
      feedback.textContent = "已複製「" + tool.title + "」模板";
      timers.set(button, setTimeout(() => { button.textContent = label; feedback.textContent = ""; }, 2000));
    } catch {
      button.textContent = "複製失敗";
      const message = "無法使用剪貼簿，請開啟詳情的「查看生圖提示詞」，選取文字後手動複製。";
      feedback.textContent = message;
      const detailFeedback = content.querySelector(".detail-copy-status");
      if (dialog.open && detailFeedback) detailFeedback.textContent = message;
      timers.set(button, setTimeout(() => { button.textContent = label; }, 2000));
    }
  }
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-detail], [data-copy]");
    if (!button) return;
    const tool = tools.find(item => item.id === (button.dataset.detail || button.dataset.copy));
    if (!tool) return;
    if (button.dataset.copy) { copy(button, tool); return; }
    content.innerHTML = '<h2 id="detail-title">' + escape(tool.title) + '</h2>' + window.CreativeImageBuilder.markup(tool) + actions(tool, true) + '<p class="detail-copy-status" role="status"></p><details class="prompt-details"><summary>查看生圖提示詞</summary><pre></pre></details><details class="preparation-details"><summary>適合用途與準備資料</summary><div class="detail-lists">' + list("適合用途",tool.useCases) + list("建議準備",tool.requiredInputs) + list("可加入元素",tool.suggestedElements) + '</div></details>';
    window.CreativeImageBuilder.mount(tool, content);
    dialog.showModal();
    dialog.scrollTop = 0;
  });
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  render("all");
})();
