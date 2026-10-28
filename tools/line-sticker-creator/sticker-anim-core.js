(function (root) {
  "use strict";
  // LINE 動態貼圖（APNG）：設定、動作清單、母圖提示詞、APNG 組裝、規格檢查。純運算，不碰 DOM、不動靜態貼圖的任何程式。
  const D = typeof module !== "undefined" && module.exports ? require("./sticker-data.js") : root.StickerData;
  const C = typeof module !== "undefined" && module.exports ? require("./sticker-core.js") : root.StickerCore;
  const G = typeof module !== "undefined" && module.exports ? require("./sticker-guard.js") : root.StickerContentGuard;

  const COUNTS = [8, 16, 24];
  const SEQUENCE = [0, 1, 2, 3, 2, 1]; // 4 個關鍵畫格來回播放：1-2-3-4-3-2，共 6 畫格（LINE 要求 5～20 畫格）
  const CELL = { width: 592, height: 512 }, SAFE = { width: 370, height: 320 }; // 與靜態母圖相同的格子與安全區
  const STICKER = { width: 320, height: 270 }, MAIN = { width: 240, height: 240 }, TAB = { width: 96, height: 74 };
  const BLOCKS = [[1, 2, 5, 6], [3, 4, 7, 8], [9, 10, 13, 14], [11, 12, 15, 16]], BLOCK_NAME = ["左上", "右上", "左下", "右下"];

  // [id, 名稱, 四個畫格的動作（以 → 分隔）, 預設台詞]
  const ACTIONS = [
    ["wave", "揮手", "手自然放下→舉手到胸前→手掌向左揮→手掌向右揮", "嗨嗨"],
    ["nod", "點頭", "面向前方→頭微微低下→頭低到最低、眼睛瞇起→頭抬回一半", "好的"],
    ["laugh", "大笑", "微笑→嘴巴張開笑→大笑、身體微微後仰→笑到肩膀抖動", "哈哈哈"],
    ["heart", "冒愛心", "雙手放胸前→雙手比出愛心→愛心從手上飄起→愛心變大飄遠", "愛你"],
    ["angry", "生氣冒煙", "皺眉→臉變紅、頭頂冒煙→煙變多、雙手握拳→握拳發抖", "氣氣氣"],
    ["sleepy", "打瞌睡", "眼睛半閉→頭慢慢低下→頭垂到最低、冒出 Z 字→頭猛然抬起一半", "好睏"],
    ["thumb", "比讚", "手握拳放身側→舉起手→豎起大拇指→大拇指向前推並眨眼", "讚"],
    ["scared", "嚇一跳", "正常表情→睜大眼睛→張大嘴巴、身體後退、頭上冒汗→全身發抖", "嚇！"],
    ["clap", "鼓掌", "雙手分開→雙手靠近→雙手互拍→雙手分開、周圍閃出小星星", "太棒了"],
    ["cry", "流淚", "嘴角下垂→眼眶泛淚→淚水流下→淚水變多", "嗚嗚"],
    ["shy", "害羞", "微微低頭→臉頰變紅→雙手遮住臉→從指縫偷看", "害羞"],
    ["shake", "搖頭", "面向前→頭轉向左→回到中間→頭轉向右", "不要"],
    ["salute", "敬禮", "站直→手舉向額頭→敬禮停住→手放下一半", "收到"],
    ["thanks", "鞠躬", "站直→身體前傾→深深低頭→回正一半", "謝謝"],
    ["dance", "跳舞", "身體向左傾→回到中間→身體向右傾→回中並舉起一隻手", "開心"],
    ["cheer", "加油", "握拳放胸前→雙手握拳舉起→雙拳高舉→拳頭用力下壓", "加油"],
    ["think", "思考", "手托下巴→眼睛向上看→頭上冒出問號→問號變大", "想想"],
    ["wow", "驚喜", "眼睛睜大→嘴巴張成圓形→雙手舉起→頭上冒出星星", "哇！"],
    ["bye", "揮別", "舉起手→手向左揮→手向右揮→手再向左揮", "掰掰"],
    ["please", "拜託", "雙手交握放胸前→雙手舉到下巴→眼睛閃閃發亮→雙手微微搖晃", "拜託"],
    ["eat", "吃東西", "拿起食物→送到嘴邊→咬一口→臉頰鼓起咀嚼", "開動"],
    ["tea", "喝茶休息", "雙手捧著杯子→杯子舉近→喝一口→放鬆吐氣、冒出熱氣", "休息"],
    ["typing", "忙碌打字", "雙手放在鍵盤上→手指快速敲打→頭上冒汗→手指更快", "忙碌中"],
    ["okay", "OK 手勢", "手放身側→手舉起→比出 OK→眨眼", "OK"]
  ].map(([id, label, motion, text]) => ({ id, label, motion, text }));
  const actionById = id => ACTIONS.find(a => a.id === id);

  function initial() {
    const s = {
      source: "", kind: "", character: "", style: "", customStyle: "", dimension: "2d", background: "transparent",
      count: 8, textMode: "ai", delay: 150, loops: 4, brandText: "", brandOpacity: 12, items: []
    };
    return resize({ settings: s });
  }
  function item(index) { const a = ACTIONS[index % ACTIONS.length]; return { action: a.id, motion: "", text: a.text }; }
  function resize(state) {
    const n = state.settings.count;
    while (state.settings.items.length < n) state.settings.items.push(item(state.settings.items.length));
    state.settings.items.length = n;
    return state;
  }
  function motionOf(entry) { const a = actionById(entry.action); return entry.action === "custom" ? (entry.motion || "").trim() : (a ? a.motion : ""); }
  function labelOf(entry) { const a = actionById(entry.action); return entry.action === "custom" ? "自訂動作" : (a ? a.label : ""); }
  const phases = entry => motionOf(entry).split(/→|->/).map(x => x.trim()).filter(Boolean);
  const mothers = state => Math.ceil(state.settings.count / 4);

  // 每個欄位的問題清單（只提醒，不改使用者文字；BLOCKED 一律擋下）。
  function validate(state) {
    const s = state.settings, out = [], add = (field, message, level) => out.push({ field, message, level: level || "error" });
    if (!s.source) add("source", "請選擇角色來源。");
    if (s.source === "original" && !s.kind) add("kind", "請選擇原創角色類型。");
    if (!s.style) add("style", "請選擇角色風格。");
    if (s.source === "original" && s.style === "likeness") add("style", "似顏繪需要照片；請改選其他風格或角色來源。");
    if (!COUNTS.includes(s.count)) add("count", "動態貼圖只能做 8、16 或 24 張。");
    s.items.slice(0, s.count).forEach((x, i) => {
      if (x.action === "custom" && !phases(x).length) add("item-" + i, "第 " + (i + 1) + " 張選了自訂動作，請描述動作（用 → 分成四個畫格）。");
      if (x.action === "custom" && phases(x).length !== 4) add("item-" + i, "第 " + (i + 1) + " 張的自訂動作需要剛好 4 個畫格（用 → 分開）。");
      if (s.textMode === "ai" && Array.from(x.text || "").length > 8) add("item-" + i, "第 " + (i + 1) + " 張的文字超過 8 字，動態貼圖字太多會看不清楚。", "warn");
      if (G) for (const [label, text] of [["文字", x.text], ["動作", x.motion]]) {
        if (!text || !text.trim()) continue;
        const hits = G.checkText(text);
        if (hits.some(h => h.level === G.BLOCKED)) add("item-" + i, "第 " + (i + 1) + " 張的" + label + "「" + text + "」" + hits[0].label + "，違反 LINE 規範，請改掉。");
        else if (hits.length) add("item-" + i, "第 " + (i + 1) + " 張的" + label + "「" + text + "」：" + hits[0].label + "，請確認。", "warn");
      }
    });
    if (G) {
      const hits = G.checkText([s.character, s.customStyle].join(" "));
      if (hits.some(h => h.level === G.BLOCKED)) add("character", "角色描述含有違規內容：" + hits[0].label + "，請修改。");
    }
    if (!(s.delay >= 60 && s.delay <= 500)) add("delay", "每個畫格停留時間請設在 60～500 毫秒。");
    if (!(s.loops >= 1 && s.loops <= 4)) add("loops", "播放次數只能是 1～4 次。");
    if (SEQUENCE.length * s.delay * s.loops > 4000) add("loops", "播放總長超過 4 秒（LINE 上限）：請縮短停留時間或減少播放次數。");
    return out;
  }
  const blocked = list => list.some(x => x.level === "error");

  function mark(text) { return "「" + text + "」"; }
  function cellList(arr) { return arr.map(n => "第 " + n + " 格").join("、"); }
  const quote = t => JSON.stringify(String(t).replace(/[\r\n\t]+/g, " ").trim());

  function stickerLine(state, n) {
    const s = state.settings, e = s.items[n - 1], p = phases(e), block = (n - 1) % 4, cells = BLOCKS[block];
    const lines = [
      "動態貼圖 " + n + "（位置：" + BLOCK_NAME[block] + "組，" + cellList(cells) + "）：動作「" + labelOf(e) + "」；" +
        (s.textMode === "ai" && (e.text || "").trim() ? "四個畫格都印同一句文字 " + quote(e.text) + "。" : "不放任何文字。")
    ];
    cells.forEach((cell, k) => lines.push("  " + cellList([cell]) + "（畫格 " + (k + 1) + "）：" + (p[k] || "依動作自然變化") + "。"));
    return lines;
  }

  function prompt(state, only) {
    const issues = validate(state);
    if (blocked(issues)) throw new Error("請先完成設定檢查：" + issues.filter(x => x.level === "error")[0].message);
    const s = state.settings, total = mothers(state), single = only !== undefined, from = ((single ? only : 1) - 1) * 4 + 1, to = single ? only * 4 : s.count;
    if (single && (only < 1 || only > total)) throw new Error("沒有這張母圖。");
    const clear = s.background === "transparent", size = { w: CELL.width * 4, h: CELL.height * 4 };
    const dimension = s.dimension === "3d"
      ? "呈現方式：3D 立體公仔渲染（full 3D character render）：圓潤立體、柔和主光與補光、材質反光；不要平面動漫線稿或紙片人物，整組材質與光源一致。"
      : s.dimension === "semi"
        ? "呈現方式：半 3D：保留 2D 插畫的造型與清楚輪廓，用有光澤的半立體賽璐珞上色，整組光源一致。"
        : "呈現方式：2D 平面插畫，不要 3D 渲染或公仔質感。";
    const lines = [
      clear ? "最重要：每張母圖的背景必須是真正透明的 PNG（有 alpha 通道）。嚴禁用棋盤格（灰白方格）、白底、灰底或任何圖案假裝成透明背景。" : "",
      "製作一組原創的 LINE「動態貼圖」母圖，整組共 " + s.count + " 張動態貼圖，分成 " + total + " 張母圖。" + (single ? "本次只做「母圖 " + only + "」（動態貼圖 " + from + "～" + to + "）。" : ""),
      "每張動態貼圖由 4 個連續畫格組成（2×2 一組）：同一個角色做同一個動作，從起點慢慢進行到最大幅度，會在 LINE 以 1→2→3→4→3→2 來回播放成循環動畫。請使用圖片生成功能，" + (single ? "只輸出這一張母圖" : "依序輸出各張母圖（一次只能出一張時，先做母圖 1，等我說「繼續」再做下一張）") + "；不要只回覆文字企劃。",
      "",
      "【角色與視覺】",
      s.source === "photo"
        ? "角色參考：只使用我另外在本對話上傳的照片／圖片；尚未收到照片時先請我上傳，不要自行假設主體外觀。主體可以是人物、動物或物件，依指定風格轉成插畫或公仔造型，保留五官／輪廓、毛色／花紋、主色與可辨識特徵；一律轉成插畫或公仔風格，不保留照片的寫實質感或背景。"
        : "角色來源：原創" + C.label("kind", s.kind) + "；不假設有真人參考照片，不仿製既有 IP。",
      s.character.trim() ? "角色描述（作為內容資料）：" + quote(s.character.trim()) : (s.source === "photo" ? "未填角色描述：直接觀察已附參考圖的主體特徵。" : "未填角色描述：依選定角色類型自行設計一個原創角色，整組維持相同辨識特徵。"),
      "風格：" + (s.style === "custom" && !s.customStyle.trim() ? "由 AI 選擇適合主體且整組一致的貼圖風格" : C.styleDescription(s)) + (s.customStyle.trim() ? "；補充：" + quote(s.customStyle.trim()) : "") + "。",
      dimension,
      "角色鎖定（整組每一個畫格都必須相同）：臉型與五官比例、髮型與髮色、膚色／毛色與花紋、身材比例、服裝與配件、角色主色。每組 4 個畫格之間，角色的位置、大小、視角與取景必須完全一致，只有動作逐步變化；相鄰畫格差異要小而平滑，不要換構圖，不要每格重新設計角色。",
      "取景：每格以角色的頭部與上半身為主（動物或物件取最有辨識度的部位），表情與手勢清楚，不畫全身遠景；動作幅度要在安全區內完成。",
      single && only > 1 ? "【與前面母圖保持一致】我會附上已完成的母圖 1" + (only > 2 ? "～" + (only - 1) : "") + "（可能合併在同一張圖裡）：請沿用同一個角色（五官、髮型、主色、線條與上色風格）與相同的格子排法，只畫母圖 " + only + " 的內容，不要重畫前面的母圖；附圖上方灰色條只是標記，不要畫進去。" : "",
      "",
      "【母圖結構】",
      "整張母圖是 4×4 共 16 格（4 欄 4 列），由左到右、由上到下編號第 1～16 格；每格是一個畫格。左上組＝第 1、2、5、6 格，右上組＝第 3、4、7、8 格，左下組＝第 9、10、13、14 格，右下組＝第 11、12、15、16 格；每組 4 格依「左上、右上、左下、右下」順序就是畫格 1～4。",
      "理想尺寸：每格 " + CELL.width + "×" + CELL.height + " px（長寬比 37:32），整張約 " + size.w + "×" + size.h + " px；平台無法指定精確像素時，請選最接近的比例，仍排成 4 欄 4 列的等分格，不要拉伸角色，並如實告知實際輸出尺寸。",
      "安全區：每格中央 " + SAFE.width + "×" + SAFE.height + " px 是角色、文字、道具與效果必須完整放入的範圍；每格四周保留約 " + Math.floor((CELL.width - SAFE.width) / 2) + "／" + Math.floor((CELL.height - SAFE.height) / 2) + " px 的空白，相鄰格的內容之間要有乾淨的分隔帶，不畫格線、外框、分割標記或編號；任何部分都不得跨格、貼邊或被裁切，空間不夠就把角色縮小。",
      clear ? "背景：真正透明背景（alpha transparency）；不要棋盤格、白底、灰底或任何「透明示意」圖案，不要用顏色填滿代替透明。若工具不支援真透明，先說明限制，不要假裝已透明。" : "背景：純白色，整張母圖各格一致。",
      "",
      "【內容守則（LINE 審核）】",
      "所有貼圖均須符合全年齡、友善、安全及 LINE Creators Market 內容規範。避免不適當或具爭議性的內容，保留自然、可愛及適度誇張的表情動作。",
      "角色照本次設定繪製，不替換成其他角色；不要畫或模仿任何既有卡通、動漫、遊戲角色、吉祥物或名人，不加入網址、QR code、電話、社群帳號或未指定的品牌文字。",
      "",
      "【文字】",
      s.textMode === "ai"
        ? "只印明細中指定的文字，維持原字與繁體中文；每組 4 個畫格印同一句，文字的位置、大小、顏色、字體、描邊完全相同，不隨動作移動、不變形；使用正確台灣繁體字形，字與字清楚分開、不重疊，整段文字寬度不超過該格安全區的八成，不遮住角色五官與手勢。生成後逐格核對有無錯字、漏字或位置跑掉。"
        : "整組不放任何文字，只用表情與動作表達。",
      "",
      "【母圖 " + (single ? only : "1～" + total) + "】"
    ];
    for (let m = single ? only : 1; m <= (single ? only : total); m++) {
      if (!single) lines.push("（母圖 " + m + "：動態貼圖 " + ((m - 1) * 4 + 1) + "～" + m * 4 + "）");
      for (let n = (m - 1) * 4 + 1; n <= m * 4; n++) lines.push(...stickerLine(state, n));
    }
    lines.push("", "只輸出各張完整母圖，不製作宣傳海報、漫畫分鏡、主圖或聊天標籤圖。生成後需人工核對角色一致、每組 4 個畫格動作連續、格數與背景；本指令不保證審核通過。");
    if (clear) lines.push("完成前檢查：背景必須是真正透明，不是棋盤格或白底；若看到棋盤格、灰白方格或單色底，請重新生成。");
    return lines.filter((x, i, a) => x !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
  }

  // ---- APNG ----
  const table = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  function crc32(parts) { let n = 0xffffffff; for (const p of parts) for (let i = 0; i < p.length; i++) n = table[(n ^ p[i]) & 255] ^ (n >>> 8); return (n ^ 0xffffffff) >>> 0; }
  const be32 = v => Uint8Array.of(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
  const be16 = v => Uint8Array.of(v >>> 8 & 255, v & 255);
  const text = s => Uint8Array.from(s, c => c.charCodeAt(0));
  function chunk(type, data) { const t = text(type); return [be32(data.length), t, data, be32(crc32([t, data]))]; }
  function parsePng(bytes) {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 33 || sig.some((v, i) => bytes[i] !== v)) throw new Error("不是有效的 PNG。");
    const chunks = [], view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    for (let p = 8; p + 12 <= bytes.length;) {
      const len = view.getUint32(p), type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
      if (p + 12 + len > bytes.length) throw new Error("PNG 不完整。");
      chunks.push({ type, data: bytes.subarray(p + 8, p + 8 + len) }); p += 12 + len;
    }
    const h = chunks.find(c => c.type === "IHDR");
    if (!h) throw new Error("PNG 缺少檔頭。");
    return { chunks, width: new DataView(h.data.buffer, h.data.byteOffset, 13).getUint32(0), height: new DataView(h.data.buffer, h.data.byteOffset, 13).getUint32(4), ihdr: h.data };
  }
  // frames：PNG 位元組陣列（尺寸必須相同）；delayMs：每畫格停留；loops：播放次數（1～4）。輸出標準 APNG，72 dpi。
  function apng(frames, delayMs, loops) {
    if (!Array.isArray(frames) || frames.length < 2) throw new Error("動畫至少要有 2 個畫格。");
    const parsed = frames.map(parsePng), first = parsed[0];
    parsed.forEach(p => { if (p.width !== first.width || p.height !== first.height) throw new Error("每個畫格的尺寸必須相同。"); });
    const parts = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), ...chunk("IHDR", first.ihdr), ...chunk("pHYs", Uint8Array.of(...be32(2835), ...be32(2835), 1)),
      ...chunk("acTL", Uint8Array.of(...be32(frames.length), ...be32(loops)))];
    let seq = 0;
    parsed.forEach((p, i) => {
      parts.push(...chunk("fcTL", Uint8Array.of(...be32(seq++), ...be32(first.width), ...be32(first.height), ...be32(0), ...be32(0), ...be16(Math.max(1, Math.round(delayMs))), ...be16(1000), 0, 0)));
      for (const c of p.chunks) {
        if (c.type !== "IDAT") continue;
        if (i === 0) parts.push(...chunk("IDAT", c.data)); else parts.push(...chunk("fdAT", Uint8Array.of(...be32(seq++), ...c.data)));
      }
    });
    parts.push(...chunk("IEND", new Uint8Array(0)));
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  // 讀回 APNG 的結構（測試與規格檢查用）：畫格數、播放次數、各畫格停留毫秒、尺寸。
  function inspect(bytes) {
    const p = parsePng(bytes), act = p.chunks.find(c => c.type === "acTL");
    if (!act) return { animated: false, width: p.width, height: p.height, frames: 1, loops: 0, delays: [] };
    const v = new DataView(act.data.buffer, act.data.byteOffset, 8), delays = p.chunks.filter(c => c.type === "fcTL").map(c => {
      const d = new DataView(c.data.buffer, c.data.byteOffset, c.data.length); return d.getUint16(20) / (d.getUint16(22) || 100) * 1000;
    });
    return { animated: true, width: p.width, height: p.height, frames: v.getUint32(0), loops: v.getUint32(4), delays };
  }
  // info：{ bytes, frames, loops, delay, width, height, transparent }；回傳不符合 LINE 動態貼圖規格的項目。
  function specIssues(info) {
    const out = [], total = info.frames * info.delay * info.loops;
    if (info.frames < 5 || info.frames > 20) out.push("畫格數 " + info.frames + "，要 5～20 格");
    if (info.width > STICKER.width || info.height > STICKER.height || (info.width < 270 && info.height < 270)) out.push("尺寸 " + info.width + "×" + info.height + "，要在 320×270 以內且一邊 ≥270");
    if (info.bytes >= 1024 * 1024) out.push("檔案 " + Math.ceil(info.bytes / 1024) + " KB，要小於 1 MB");
    if (info.frames * info.delay > 4000) out.push("單次播放 " + (info.frames * info.delay / 1000).toFixed(1) + " 秒，最長 4 秒");
    if (!(info.loops >= 1 && info.loops <= 4)) out.push("播放次數要 1～4 次");
    else if (total > 4000) out.push("播放總長 " + (total / 1000).toFixed(1) + " 秒，不可超過 4 秒");
    if (info.transparent === false) out.push("背景不是透明");
    return out;
  }
  const api = { COUNTS, SEQUENCE, CELL, SAFE, STICKER, MAIN, TAB, BLOCKS, ACTIONS, actionById, initial, item, resize, motionOf, labelOf, phases, mothers, validate, blocked, prompt, apng, inspect, specIssues, parsePng };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.StickerAnim = api;
})(typeof window !== "undefined" ? window : globalThis);
