# 微光創作工具

可被 TSY 微光創作室入口網站連接的獨立靜態專案，集中放置創作類工具（AI 製圖輔助等），之後陸續新增。

- 入口網站：https://tsy3991.github.io/TSY.Microglow-Website/
- GitHub Pages repo name：`TSY.Microglow-Creative`（分支 `main`）
- 創作工具大廳：https://tsy3991.github.io/TSY.Microglow-Creative/

## Structure

```text
Creative/
  index.html
  shared/
    base.css          — 色彩、reset、大廳版型（與 Tools 同一套色票，不要改色）
    tool-detail.css   — 工具詳情頁共用樣板
    creative.css      — 本專案專屬樣式（空狀態等）
    portal-return.js  — 「回入口網站」按鈕
  assets/
    favicon.png
    logo-mark.png
  tools/
    <tool-name>/index.html
```

## 新增工具的步驟

1. 在 `tools/<tool-name>/` 建立頁面，樣式引用 `shared/base.css` 與 `shared/tool-detail.css`。
2. 在 `index.html` 的「可用工具」加一張 `.tool-card`（格式參考 TSY.Microglow-Tools 的大廳卡片），並移除空狀態。
3. 到入口網站 `scripts/portal-records.js` 的 `tools[]` 加一筆 `category: "creative"` 的資料。
4. 改動 CSS／JS 後，同步升 `?v=` 版本號。
