# AI圖片創作工具 V1

大廳：index.html。工具頁：tools/ai-creative-image/index.html。

## 維護

- shared/creative-image-tools.js 是模板資料來源；新增工具依現有物件填入 id、category、categoryLabel、tags、previewImage、promptTemplate、useCases、requiredInputs、suggestedElements、platforms、status。
- 分類、卡片、詳情、平台按鈕由 shared/creative-image-toolbox.js 產生，不需另寫卡片 HTML。
- 正式助手連結填入 platforms[].url，必須是 HTTPS；null 顯示停用按鈕。平台資料可增加，UI 無需綁定平台名稱。
- previewImage 為 null 時顯示本地 CSS 漸層；有正式圖片後，填入相對工具頁的本地圖片路徑。
- 專屬樣式放 shared/creative.css；沿用 base.css 的 tokens。CSS／JS 改動需同步更新 HTML 中對應的 ?v=。
- 不使用 storage、登入、API 或後端。圖片上傳與生成在外部 AI 平台進行。

## 驗證（2026-10-03）

純靜態專案沒有 package.json、lint、build 或既有前端測試指令，因此這三項不適用，不能宣稱 build PASS。

已執行 node --check（兩份新增 JS）與 git diff --check。Playwright／Chrome 驗證大廳入口、四種篩選、三張卡、詳情與模板展開、三份真實剪貼簿內容、約兩秒回復、權限拒絕回饋、鍵盤 Enter／Esc 與焦點返回。375／390／430／768／1280px 無水平溢出，dialog 均在 viewport 內。測試 response 的第四張卡／新增平台可由資料產生；外連使用 _blank 與 noopener noreferrer。測試資料未寫入 repo。無 console 或 HTTP 錯誤。

## 尚待提供

ChatGPT Assistant URL、Gemini Gem URL、正式示意圖。V1 可先複製模板使用。入口網站的「創作工具」分類連到本 repo 的大廳，再由大廳進入 AI圖片創作工具。正式網址：https://tsy3991.github.io/TSY.Microglow-Creative/tools/ai-creative-image/
