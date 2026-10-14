# LINE 貼圖創作工具

2026-10-13：第一版功能，外部 AI 生圖效果待驗證；使用靜態 HTML、CSS、JavaScript，不需套件安裝或建置。

## 範圍與流程

獨立頁面，已接入創作工具大廳，未改既有三個圖片工具。四步驟為角色與風格、台詞與文字、母圖設定、摘要與提示詞。本站可選擇並預覽人物、動物或物件參考圖；圖片只在本機使用 Blob URL，不傳送、不保存。使用者仍需將同一張圖附到外部 AI 對話；本站不生成圖片；取得母圖後，可在本機裁切、選擇去白底並匯出 ZIP。

## 已確認規格

- 原創人物、動物與擬人化物件，或人物、動物與物件照片／圖片參考；角色風格不預選。似顏繪限照片來源。保留辨識特徵，服裝、表情、姿勢與道具可變化。
- 情境組合與自行輸入兩種台詞來源；七類情境：日常問候、情緒表達、工作回覆、親友互動、店家客服、節慶祝福、台灣口頭禪。
- 逐張台詞、表情、動作、顯字開關與名稱開關。整組有字、無字或逐張決定。名稱加在台詞前方，摘要顯示實際要印的完整文字。
- 情境不足時補足空缺，保留已有文字；另提供手動補齊按鈕。切換情境不覆蓋舊台詞；按「套用情境台詞」才確認取代。無文字格不補台詞。
- 超量內容全部保留，阻止進入摘要；須刪減或增加張數，不自動截斷。刪除單筆及套用新清單均先確認。
- 一般靜態貼圖張數 8／16／24／32／40，預設 16。
- 母圖只提供 4 欄 2 列（8 格）及 4 欄 4 列（16 格）；預設自動優先 16 格。24 張＝16＋8；40 張＝16＋16＋8。可自行調整，格數總和必須等於貼圖總張數。
- 預設要求真正透明背景，也可選純白或單色。提示詞不能保證 alpha 透明效果。
- 字體、大小、顏色、位置、描邊粗細／顏色、陰影強弱／顏色均預設由 AI 調整。九色色票、多色文字與自訂色均提供；描邊與陰影可關閉。字體也可自行描述。
- 固定安全留白不提供選單；具體比例保留為生圖待校準，不套用未驗證百分比。
- ChatGPT、Gemini、通用版本，整組一次複製。各母圖分段，平台無法一次完成時，在同一對話說「繼續」。實際生成能力未測試。
- 設定改動後，清除舊提示詞及摘要確認，須重新確認才可生成；複製拒絕時選取文字並提供手動複製提示。

## 保存與匯入匯出

瀏覽器保存為使用者主動勾選，專用鍵 `microglow:line-sticker-creator:v1`；清除只移除該鍵，不用 `localStorage.clear()`。取消保存或清除草稿不清空目前頁面。

JSON 設定檔包含 tool/version/state；不含照片、帳號或 API key。匯入前驗證版本、欄位型別、列舉值、色碼與資料量，拒絕危險物件鍵。拒絕不會覆蓋當前設定。未完成設定也可匯出／匯入，仍須經完整檢查才能產生提示詞。

文字設定上限 1000 字、逐張文字上限 300 字、保留筆數最多 80、匯入檔案上限 250 KB。這些是工具輸入保護，不是 LINE 官方規格。

## 檔案

- `index.html`：介面與四步驟。
- `sticker-creator.css`：所有選擇器限制在 `.line-sticker-tool`，共用色票沿用 `shared/base.css`。
- `sticker-data.js`：列舉、台詞、預設值。
- `sticker-core.js`：分配、驗證、提示詞與設定檔解析；CommonJS 可供 Node 測試。
- `sticker-app.js`：頁面事件與狀態；使用者資料透過 textContent／value 寫入。

CSP 使用外部 CSS／JS，無 inline script、onclick 或第三方依賴。所有新檔案 UTF-8 無 BOM／LF。更新 JS／CSS 時同步升本頁引用版本。

## 參考與驗證界線

2026-10-13 交叉查核 LINE 官方製作準則與支援說明：
- https://creator.line.me/zh-hant/guideline/sticker/
- https://help2.line.me/creators/web/pc?contentId=20005145&lang=zh-Hant

官方張數是整組成品數，母圖分配是工具規則。主圖、聊天標籤圖與 PNG／ZIP 由下方裁切工具輸出；背景、圖片內容及送審仍須人工核對，不保證通過審核。

提示詞依 ai-media-generator 的主體／動作／風格／構圖結構、身份一致性與 quoted text 原則撰寫；保留網格與變化兩層規則，不用導演名或平台不通用參數。整組指令含逐張內容，長度由所選張數決定。

簡約線條、療癒手繪、誇張搞怪是參考 LINE STORE 與官方創作者範例歸納的選項，不是官方趨勢排名：
- https://store.line.me/stickershop/showcase/top_creators/zh-Hant?listType=top&page=1
- https://creator.line.me/zh-hant/management/creators/

尚未實測：外部平台生圖、真人身份相似度、真透明背景、中文文字渲染、角色跨母圖一致性及安全留白比例。四步驟 UI 驗證與生圖驗證分別回報。

## 本機驗證

在工具目錄執行：

```text
node --test tests/core.test.cjs
node tests/ui.smoke.cjs
```

瀏覽器測試需 Node.js 22 以上與 Chrome；可用 CHROME_PATH 指定執行檔，截圖目錄可作為 ui.smoke.cjs 的第一個參數。測試使用動態本機連接埠與獨立暫存瀏覽器資料，結束自動清理。

2026-10-13 結果：
- 核心回歸 18 項通過，涵蓋分配、台詞保留、無文字不誤擋、名稱及設定檔驗證。
- 瀏覽器檢查 35 項通過，涵蓋完整流程、實際剪貼簿、拒絕時手動複製、設定保存／清除、壞檔拒絕、合法匯入、實際設定檔下載與 320／390／768／1280px 正常頁及摘要版面。
- 測試對 confirm 模擬接受；未驗證實體滑鼠操作原生確認對話框與真手機觸控。
- 非本工具目錄的既有檔案雜湊保持一致。
- 所有本次檔案 UTF-8 無 BOM／LF。
- 外部平台實際生圖、透明背景與留白比例仍未驗證。

檢視頁面可直接以瀏覽器開啟 index.html；若瀏覽器限制本機檔案剪貼簿，使用手動複製提示即可。瀏覽器保存資料會依使用的來源位址分開。

大廳與工具頁首預覽圖：assets/creative-previews/line-sticker-entry-v2.jpg（640×640、約 62 KB），採「微光柔和風」生成示意插畫，不是本工具實際產生的貼圖成果、介面快照或使用者照片。

參考圖支援 JPG／PNG／WebP，單張最多 10 MB；解碼失敗或超限不取代原有預覽。移除、切回原創或成功匯入設定會清除參考圖；重新載入需重新選圖。CSP 僅額外允許 img-src blob:，目前 connect-src 只允許 microglow-sticker-ai.microglow-creative.workers.dev。草稿與匯出不含圖片、檔名或 Blob URL。

所有文字輸入皆為選填：角色描述留白時依參考圖辨識／原創類型設計，風格與字體補充留白由 AI 搭配；名稱留白不加名稱。台詞留白由 AI 依情境創作簡短繁體中文台詞；無文字格維持不印字。角色來源、原創類型、風格選項、張數與母圖格數仍需有效。

## 網站 AI 文字安排（2026-10-14）

前端維持靜態 HTML/CSS/JS。新增 sticker-ai-config.js（公開端點，沒有金鑰）、sticker-ai.js（資料白名單／驗證／只補空白）、第二步建議預覽與確認套用。Worker 來源在 worker/，無框架或 SDK 相依，直接呼叫 Gemini REST API；部署 CLI 不影響前端建置。

前端已設定專用 Worker HTTPS 位址，connect-src 只允許該精確 origin。Worker 部署範例保留 AI_ENABLED=false；實際正式服務已由管理者設好 Secret 並啟用。未設定端點或停用服務時，仍保留手動流程。部署設定見 [worker/部署說明.md](worker/部署說明.md)。

只傳角色文字描述、風格、情境與逐張 text/emotion/action/hasText；不傳照片、檔名、共用名稱設定或其他外觀欄位。描述／台詞內的個資仍屬傳送文字，介面提醒使用者先移除；同意不儲存，每次載入需重新勾選。結果先預覽，套用只補空白並使舊摘要與提示詞失效。等待期間修改設定、取消或撤回同意會中止瀏覽器等待並拒絕遲到結果，無法保證上游已停止或不計額度。

本機檢查指令：

```text
node --test tests/core.test.cjs tests/ai.test.cjs
node tests/ui.smoke.cjs
node tests/ai.ui.cjs
```

ai.test.cjs 使用模擬 Gemini 回應與限流 binding；ai.ui.cjs 使用真實 headless Chrome，但只在隔離測試伺服器放行測試 origin，透過 CDP 模擬 AI 回應，未呼叫真正 Gemini。正式頁面 CSP 不因此放寬。

2026-10-14 已實際部署並透過 Worker 呼叫 Gemini 3.5 Flash-Lite，8 張測試完整回傳、保留原台詞與指定表情，8 個動作各不相同。此結果是文字建議，未測試真正圖片生成；免費額度總量與每次服務延遲不保證。

2026-10-14 本機結果：核心與模擬 Worker 共 31 項通過；既有瀏覽器介面 47 項通過；模擬上游的 AI 瀏覽器介面 18 項通過。涵蓋缺金鑰停用、來源／格式／限流拒絕、只補空白、確認後套用、取消與遲到回應、撤回同意，以及 320／390／768／1280px 版面。兩個瀏覽器測試均已清理自身暫存資料。此段為串接前的模擬測試；後續真實驗證見下方。
頁首依需求移除 LOGO／品牌文字與圖片創作工具箱按鈕，保留回創作工具大廳與入口網站。

## 正式服務設定

Worker：https://microglow-sticker-ai.microglow-creative.workers.dev/arrange。Account ID 固定在 worker/wrangler.jsonc，部署使用具名 profile microglow。金鑰只放 Cloudflare Secret，未讀取或寫入 repo。wrangler.jsonc 是停用的部署範例，重新部署前需明確核對 AI_ENABLED；停用不影響手動提示詞。

最初選定的 gemini-2.5-flash-lite 實測回覆 404。2026-10-14 Google 官方模型與 deprecations 頁面指出 2.5 系列限制給先前使用的專案，新專案應使用 3.5 Flash-Lite 或 3.8 Flash；因此明確改用 gemini-3.5-flash-lite（官方列有免費文字額度），沒有執行時自動切模型。

來源：https://ai.google.dev/gemini-api/docs/models 、https://ai.google.dev/gemini-api/docs/deprecations 、https://ai.google.dev/gemini-api/docs/pricing 。

非 429 上游錯誤提供 X-AI-Upstream-Status 與固定錯誤分類，不回傳 Google 原始錯誤或金鑰。

2026-10-14 最大張數實測：40 張真正 Gemini 回應 HTTP 200，約 34 秒完成，40 筆完整通過結構驗證、40 個動作各不相同。Worker 等待上限為 60 秒，前端 65 秒；不是所有次數都保證相同延遲。實際圖片生成仍未測試。

## 母圖裁切與下載（2026-10-14）

新增 sticker-crop-core.js（網格、邊缘相連近白色移除、縮放限制、PNG 72 dpi metadata、CRC32 與 ZIP store）、sticker-crop-app.js（本機圖片處理與預覽）、sticker-crop.css（限定本工具的樣式）。不新增套件、建置流程或後端；CSP 網路範圍未放寬。sticker-app.js 只提供張數與網格的唯讀事件。

母圖加入後預設繼承第三步的母圖分配，可調整 4×2／4×4、分割線像素、順序及移除。總格數須等於整組張數，否則拒絕裁切。最大 5 張、每張 20 MB／1,600 萬像素、合計 3,200 萬像素是瀏覽器記憶體保護限制，不是 LINE 規格。圖片不傳至 Gemini、不存草稿，重新載入需重新選圖。失敗的圖片批次不取代既有原圖。

去白底預設關閉。開啟後採邊界 flood fill，保守／一般／較強門檻 248／240／230，RGB 色差不超過 12。此方法沒有 AI 語意判斷：與背景相連的白色衣物、描邊、文字可能被移除，封閉白底可能殘留；原始 bitmap 保留，可關閉後重新裁切還原。深淺與棋盤格底色只顯示在預覽，不寫入 PNG。

逐張可調整 50～100% 大小與水平／垂直位置；限制在約 10 px 留白內避免裁掉內容。主要圖片與標籤圖片依所選代表貼圖完整置中縮放，獨立於貼圖位置設定。全透明格不能下載。調整母圖／去白底／張數會使舊輸出失效；調整貼圖／代表圖片後需重新勾選人工檢查。

輸出 01.png～所選張數（370×320）、main.png（240×240）、tab.png（96×74），PNG RGBA，pHYs 2835 pixels/meter（約 72 dpi），單張不超過 1 MB、ZIP 小於 60 MB。ZIP 使用不壓縮 store，所有檔案皆有 CRC32；檔名固定，不將使用者照片檔名、操作標籤印進圖片。保留原圖背景時，即使外圍留白透明，內容區仍可能是不透明白底，介面明確要求人工確認。

官方來源於 2026-10-14 重新查核：https://creator.line.me/zh-hant/guideline/sticker/ ，並交叉查看 https://help2.line.me/creators/web/pc?contentId=20005145&lang=zh-Hant 。此版本只處理一般靜態貼圖，不代為提交、不保證審核通過。

驗證：node --test tests/core.test.cjs tests/ai.test.cjs tests/crop.test.cjs；node tests/ui.smoke.cjs；node tests/ai.ui.cjs；node tests/crop.ui.cjs。2026-10-14：32 個 Node 測試、47 個既有介面檢查、18 個模擬上游 AI 檢查、23 個裁切瀏覽器檢查通過。裁切以自製測試母圖驗證 8／24／40 張、白底還原、封閉白色保留、分割線與格數拒絕、實際 8／40 張 ZIP、檔名／尺寸／全部 PNG 與 ZIP CRC／72 dpi、320～1280 px 版面。測試暫存清理完成。

未驗證：任意實際 AI 母圖的去白底品質、LINE 實際上傳／送審、原生手機觸控及所有瀏覽器；Chrome headless 的合成母圖測試不代表所有圖片皆適用。
