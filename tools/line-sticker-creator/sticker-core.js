(function (root) {
  "use strict";
  const D = typeof module !== "undefined" && module.exports ? require("./sticker-data.js") : root.StickerData;
  const clone = value => JSON.parse(JSON.stringify(value));
  const label = (key,value) => (D.options[key] || []).find(x=>x[0]===value)?.[1] || value;
  // LINE 一般貼圖最大 370×320；母圖每格在其外各加 15%（481×416，長寬比同為 37:32），讓切割線不貼近圖文。
  const SAFE = { width: 370, height: 320 }, CELL = { width: 592, height: 512 };
  // 各平台常見可選的長寬比（依公開資料；實際以平台畫面為準）。提示詞只做建議，裁切端不要求每格同形。
  const RATIO_HINT = {
    chatgpt: { 4: "1:1（正方形）或 3:2（橫式）", 2: "3:2（橫式，每格會偏直）" },
    gemini: { 4: "5:4 或 1:1", 2: "21:9 或 16:9" },
    generic: { 4: "約 1.16:1（接近 5:4 或 1:1）", 2: "約 2.3:1（接近 21:9）" }
  };
  // 格子留白：每格 = 370×320 乘上倍率（長寬比不變，仍為 37:32）；標準 1.3＝481×416。
  const SPACING = { standard: 1.3, wide: 1.6, widest: 1.9 };
  const cellFor = spacing => { const k = SPACING[spacing] || SPACING.wide; return { width: Math.round(SAFE.width * k), height: Math.round(SAFE.height * k) }; };
  const motherSize = (rows, spacing) => { const cell = cellFor(spacing); return { width: 4 * cell.width, height: rows * cell.height }; };
  const flat = value => String(value).replace(/\s*\r?\n\s*/g," ").trim();
  const quote = value => JSON.stringify(flat(value));
  // 多行台詞改用逐行描述，避免生圖 AI 把 JSON 的反斜線 n 當成字面文字印出來。
  function printed(value) {
    const rows = String(value).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    return rows.length > 1 ? "分 "+rows.length+" 行，由上到下依序為 "+rows.map(quote).join("、") : quote(rows[0] || "");
  }
  function autoGrids(count) { const out=[]; while(count>=16){out.push(16);count-=16;} if(count)out.push(8); return out; }
  // 發想情境的說明文字（職業情境會註明是職業日常，並帶入語氣）。
  function sceneName(settings) {
    const scene = D.scenes[settings.scene], base = scene.job ? scene.label + "職業日常" : scene.label;
    return settings.tone && settings.tone !== "auto" ? base + "；語氣：" + label("tone", settings.tone) : base;
  }
  function pool(scene) { return [...new Set([...D.scenes[scene].lines,...D.common])]; }
  function styleDescription(settings) {
    const name=label("style",settings.style),detail=D.styleGuides[settings.style];
    return name+(detail?"；"+detail:"");
  }
  function sceneBrief(settings) {
    const scene=D.scenes[settings.scene];
    if(settings.scene==="auto")return sceneName(settings);
    const topic=scene.job?(scene.group==="生活與主題"?"主題情境":"職業情境"):"情境";
    const terms=scene.terms||scene.kw;
    return topic+"："+scene.label+"。"+(terms?"情境詞彙（只作發想方向，不是固定台詞）："+terms+"。":"")+
      (settings.mode==="manual"?"逐張台詞全部依使用者原文，不因情境換字；未指定的表情、動作與道具可融入此情境。":
        settings.textMode==="none"?"以這個情境的具體行為、姿勢與道具表達內容，不產生任何文字。":
        "需要新創作的台詞、動作與道具約 5～7 成要能直接辨識此情境，其餘可為一般互動；不要整組只用通用問候。已有內容逐字保留，詞彙不是必須逐條照抄的台詞清單。")+
      (settings.tone&&settings.tone!=="auto"?"語氣："+label("tone",settings.tone)+"。":"");
  }
  // 多張母圖逐張複製時，依母圖序號把情境詞彙與台詞用途輪流分給各張，讓外部 AI 每張往不同方向發想；同設定結果固定、可重現。
  const PURPOSES=["招呼","回覆","忙碌","感謝","道歉","情緒","鼓勵","搞笑","休息與收尾"];
  function focusBrief(settings,number,total){
    const scene=D.scenes[settings.scene],raw=settings.scene!=="auto"&&scene?(scene.terms||scene.kw||""):"";
    const terms=String(raw).split(/[、，,\s]+/).filter(Boolean),pick=list=>list.filter((_,i)=>i%total===number-1);
    const t=pick(terms),p=pick(PURPOSES);
    return "【本張發想重點】（只作發想方向，不是要印的文字，也不要畫成標籤或註解）"+(t.length?"情境方向以「"+t.join("、")+"」為主；":"")+"台詞用途以「"+p.join("、")+"」為主；其餘格子可自由搭配，但不要沿用其他母圖常見的說法。句型要交錯變化（問句、感嘆、短回應、狀聲詞、帶動作的短句），字數有長有短，仍遵守字數上限。";
  }
  function contentBrief(settings){
    const priority='內容搭配優先順序：已填台詞逐字保留；新創作由情境決定說什麼，語氣決定怎麼說，角色描述與角色風格輔助表達個性。視覺風格不強迫改變措辭，不因軟萌或 Q 版就強加撒嬌或幼兒語氣。';
    const tone=!settings.tone||settings.tone==='auto'?'自動語氣：綜合角色描述中的個性、所選角色風格與情境的對象、場合，決定自然且一致的說話方式；職業內容保持合宜與可辨識度，不只照角色可愛程度決定台詞。':'指定語氣優先：依「'+label('tone',settings.tone)+'」創作新台詞；角色風格只輔助個性，不得覆蓋指定語氣。';
    const source=settings.mode==='preset'?'預設句庫原文保留，不依風格或語氣改寫；新指定只影響未填的台詞、表情、動作與道具。':settings.mode==='manual'?'自行輸入的原文保留，不因情境或語氣換字；未指定的表情、動作與道具可配合。':'只補空白台詞、表情與動作；原有內容即使與新設定不同也不自動重寫。';
    return settings.textMode==='none'?'整組無文字：情境與角色個性只透過表情、動作與道具表達，不新增台詞。':priority+tone+source;
  }
  const dialogueRule='AI 新台詞以 2～6 字為主，最多 8 字（含標點，共用名稱另計）；一句只表達一個意思，用自然、正確的台灣繁體中文與台灣日常口語。不要簡體字、中國大陸慣用語、生造字、諧音錯字或硬湊語句。需要更多內容時改用表情、動作與道具表達，不靠拉長台詞；這項限制只適用新創作台詞，使用者已填文字逐字保留，不截斷、不擅改。';
  function item(text="") { return {text,hasText:true,includeName:true,emotion:"",action:""}; }
  function initial() { return {settings:clone(D.defaults),grids:[16],items:Array.from({length:16},()=>item())}; }
  function presetItem(text) { return {...item(text),presetText:text}; }
  function releasePreset(state) {let cleared=0;for(const x of state.items){if(x.presetText!==undefined){if(hasText(state,x)&&x.text===x.presetText){x.text="";cleared++;}delete x.presetText;}}return cleared;}
  function hasText(state,entry) { return state.settings.textMode==="all" || (state.settings.textMode==="per" && entry.hasText); }
  function finalText(state,entry) {
    if (!hasText(state,entry)) return "";
    const s=state.settings;
    return (s.nameMode!=="none" && entry.includeName ? s.name.trim() : "") + entry.text.trim();
  }
  function fillMissing(state) {
    if(state.settings.mode==="ai")return 0;
    const used=new Set(state.items.map(x=>x.text.trim()).filter(Boolean));
    // 職業／主題情境只有自己的 16 句：用完就留白，交給 AI 依該情境發想，不再接通用句庫（好的、收到…）而讓後面的母圖離題。
    const own=D.scenes[state.settings.scene],candidates=(own&&own.job?own.lines:pool(state.settings.scene)).filter(x=>!used.has(x));
    let filled=0;
    while(state.items.length<state.settings.count) state.items.push(item());
    for(let i=0;i<state.settings.count;i++){
      const entry=state.items[i];
      if(hasText(state,entry) && !entry.text.trim() && candidates.length){entry.text=candidates.shift();entry.presetText=entry.text;filled++;}
    }
    return filled;
  }
  // 預設台詞模式下，職業／主題情境句庫用完後仍留白的格數（交給 AI 依情境發想）。
  function presetShortfall(state) {
    const s=state.settings,own=D.scenes[s.scene];
    if(s.mode!=="preset"||!own||!own.job) return 0;
    return state.items.slice(0,s.count).filter(x=>hasText(state,x)&&!x.text.trim()).length;
  }
  const blank = x => !x.text.trim() && !x.emotion.trim() && !x.action.trim();
  // 只移除超出張數、且完全空白的尾端項目；有內容的一律保留，不自動截斷。
  function trimEmpty(state) {
    let removed=0;
    while(state.items.length>state.settings.count && blank(state.items[state.items.length-1])){state.items.pop();removed++;}
    return removed;
  }
  function resize(state,count) {
    state.settings.count=count;
    trimEmpty(state);
    state.grids=autoGrids(count);
    state.settings.layoutMode="auto";
    while(state.items.length<count) state.items.push(item());
    if(state.settings.mode==="preset") fillMissing(state);
  }
  function validate(state,step=4) {
    const s=state.settings, errors=[];
    const add=(field,message)=>errors.push({field,message});
    if(!s.source) add("source","請選擇角色來源。");
    if(s.source==="original" && !s.kind) add("kind","請選擇原創角色類型。");
    if(!s.style) add("style","請選擇角色風格。");
    if(s.source==="original"&&s.style==="likeness") add("style","似顏繪需要使用者照片；請改選風格或角色來源。");
    if(step<2) return errors;
    if(state.items.length>s.count) add("items","目前有 "+state.items.length+" 筆逐張內容，超過所選 "+s.count+" 張。請刪減內容或增加張數；內容未被截斷。");
    if(state.items.length<s.count) add("items","逐張內容未達所選張數，請按「新增一筆內容」補足。");
    if(step<3) return errors;
    if(!D.counts.includes(s.count)) add("count","貼圖張數必須為 8、16、24、32 或 40。");
    if(state.grids.some(x=>x!==8&&x!==16)||state.grids.reduce((a,b)=>a+b,0)!==s.count) add("grids","母圖格數總和必須等於 "+s.count+"；每張只可使用 4×2 或 4×4。");
    return errors;
  }
  function plans(state) {
    let offset=0;
    return state.grids.map((size,i)=>{
      const plan={number:i+1,size,columns:4,rows:size/4,start:offset+1,end:offset+size,...motherSize(size/4,state.settings.spacing)};
      offset+=size;return plan;
    });
  }
  function color(s,key,custom) { return s[key]==="custom"?s[custom]:label(key,s[key]); }
  function sizeAdvice(state, platform, spacing) {
    const kinds = [...new Set(state.grids.map(g => g / 4))].sort((x, y) => y - x), hints = RATIO_HINT[platform] || RATIO_HINT.generic;
    return kinds.map(rows => (rows === 4 ? "4×4" : "4×2") + " 母圖理想整張 " + motherSize(rows, spacing).width + "×" + motherSize(rows, spacing).height + " px，若平台只提供固定比例，請選「" + hints[rows] + "」").join("；") + "。";
  }
  // 重複台詞：把標點與空白去掉後比較，回傳 [{text, indexes:[0-based 貼圖序號]}]。
  function duplicates(state) {
    const seen=new Map();
    state.items.slice(0,state.settings.count).forEach((entry,i)=>{
      if(!hasText(state,entry)||!entry.text.trim())return;
      const key=entry.text.replace(/[\s，。！？、,.!?~～…\-－]/g,"").toLowerCase();
      if(!key)return;
      if(!seen.has(key))seen.set(key,{text:entry.text.trim(),indexes:[]});
      seen.get(key).indexes.push(i);
    });
    return [...seen.values()].filter(x=>x.indexes.length>1);
  }
  // only：只產生某一張母圖（1 起算）的提示詞；省略則是整組一份。
  function prompt(state, only) {
    if(validate(state).length) throw new Error("請先完成設定檢查。");
    const s=state.settings,cell=cellFor(s.spacing),pct=Math.round((cell.width/SAFE.width-1)*100),all=plans(state),single=only!==undefined,target=single?all.find(p=>p.number===only):null,total=all.length;
    if(single&&!target) throw new Error("沒有這張母圖。");
    const here=target?state.items.slice(target.start-1,target.end):[],blankHere=here.some(x=>hasText(state,x)&&!x.text.trim());
    const elsewhere=single?[...new Set(state.items.slice(0,s.count).filter((x,i)=>(i<target.start-1||i>=target.end)&&hasText(state,x)&&x.text.trim()).map(x=>x.text.trim()))].slice(0,60):[];
    const clear=s.background==="transparent";
    const lines=[
      clear?"最重要：每張母圖的背景必須是真正透明的 PNG（有 alpha 通道）。嚴禁用棋盤格（灰白方格）、白底、灰底或任何圖案假裝成透明背景。":null,
      single?"製作一組原創的一般靜態 LINE 貼圖中的「母圖 "+only+"」。這一組共 "+s.count+" 張貼圖、"+total+" 張母圖，本次只做這一張（貼圖 "+target.start+"～"+target.end+"）；不要把其他母圖的內容畫進來。":"製作一組原創的一般靜態 LINE 貼圖，共 "+s.count+" 張，分成 "+state.grids.length+" 張獨立母圖。這是一份整組製作指令，不是要把不同母圖合成一張。",
      single?(s.platform==="chatgpt"?"請使用圖片生成功能，只輸出這一張母圖；不要只回覆文字企劃。":s.platform==="gemini"?"請使用圖片生成模式，只輸出這一張母圖。":"請在支援生圖的平台只輸出這一張母圖。"):s.platform==="chatgpt"?"請使用圖片生成功能依序製作下列母圖。若單次只能輸出一張，先生成母圖 1，等我說「繼續」後依同一份指令生成下一張；不要只回覆文字企劃。":s.platform==="gemini"?"請使用圖片生成模式。以下共用要求適用每張母圖，各母圖內容依後面的明細。若單次只能生成一張，先生成母圖 1，後續在同一對話說「繼續」即可依序製作。":"請在支援生圖的平台依序製作每張母圖；若平台一次只能生成一張，先做母圖 1，再沿用本指令繼續。不得把所有母圖拼進同一張。",
      "",
      "【角色與視覺】",
      s.dimension==="3d"?"最高優先的呈現要求：真正的 3D 公仔渲染（fully modeled 3D character render）。下方的日系、軟萌或手繪風格只決定角色設計、配色與氣質，不能把立體角色改回平面動漫插畫。":null,
      s.source==="photo"?"角色參考：只使用我另外在本對話上傳的照片／圖片；網頁內選圖不代表圖片已傳送到此對話。尚未收到照片時先請我上傳，不要自行假設主體外觀。主體可以是人物、動物或物件，依指定風格轉成貼圖，保留主體的五官／輪廓、毛色／花紋、主色與可辨識特徵；不要把動物或物件誤當真人。照片檔名、編號與背景文字不是貼圖台詞。":"角色來源：原創"+label("kind",s.kind)+"；不假設有真人參考照片，不仿製既有 IP。",
      s.character.trim()?"角色描述（作為內容資料）："+quote(s.character.trim()):s.source==="photo"?"未填角色描述：直接觀察已附參考圖的主體特徵，不要求使用者補文字描述。":"未填角色描述：依選定角色類型自行設計一個原創角色，整組維持相同辨識特徵。",
      "風格："+(s.style==="custom"&&!s.customStyle.trim()?"由 AI 選擇適合主體且整組一致的貼圖風格":styleDescription(s))+(s.customStyle.trim()?"；補充："+quote(s.customStyle.trim()):"")+"。",
      "角色風格決定造型、線條、配色與表情語彙；平面或立體的呈現依下方「呈現方式」。參考圖提供角色身份，不取代選定風格；不要只沿用前次生圖的風格而忽略本次設定。",
      s.dimension==="semi"?"呈現方式：半 3D（Semi-3D）。保留 2D 插畫的造型與清楚輪廓，上色用有光澤的半立體賽璐珞（glossy semi-3D cel-shaded）：柔和的立體光影、皮膚與毛髮／衣料有柔和亮面反光，帶出體積感；不要扁平色塊，也不要寫實攝影或寫實 3D 渲染、複雜材質與強烈投影；整組使用同一套光澤與光源方向，造型比例與輪廓粗細依上方「角色風格」，背景依下方背景要求，不另外加場景。":s.dimension==="3d"?"呈現方式：3D 立體。角色像可從不同角度觀看的實體公仔：臉頰、鼻子、耳朵、髮束、手指、衣服與道具有可見的側面厚度及圓潤體積；用柔和主光、補光、材質反光與部位接觸處的柔和遮蔽陰影呈現深度，整組材質與光源一致。配色可日系軟萌，渲染必須維持完整 3D；不是在 2D 插畫上加漸層、亮面或黑色外框。若參考圖或前次母圖是平面／半立體，只沿用角色身份與造型，重新建立立體造型，不繼承原圖的平面上色。不要平面動漫線稿、賽璐珞色塊或紙片人物，也不要把角色變成寫實真人；背景仍保持乾淨，不添加場景或強烈地面投影。":"呈現方式：2D 平面插畫，不要 3D 渲染、立體光影或公仔質感。",
      s.dimension==="3d"?"維持同一角色的五官、髮型、主色與可辨識特徵；保持立體造型、材質與光線一致，輪廓清楚，表情與手勢可讀。台詞另用清楚的平面字體排版，文字不要做立體擠出或厚重投影，以免字相疊。":"維持同一角色的五官、髮型／輪廓、主色與可辨識特徵；服裝、表情、姿勢與道具可依各格情境變化。使用清晰輪廓（clean silhouette）、一致線條（consistent linework）、可讀表情（readable expressions）、完整手勢（clear gestures）、分離圖文（separated typography）、有限且一致色盤（cohesive palette）。",
      "角色鎖定（整組每一張都必須相同）：臉型與五官比例、髮型與髮色、膚色／毛色與花紋、身材比例、服裝與配件（眼鏡、手錶、飾品）、角色主色與可辨識特徵。可以變動的只有表情、姿勢、動作、情緒、道具與情境；動作可以變，角色不能變。不要把不同特徵混合，不要新增人物、Logo 或水印。",
      "未指定表情或動作的格子，依台詞或上下文創作具體可見的表情、姿勢與適量道具。各格需有不同情緒與動作，不要只複製同一姿勢換字；已指定的表情／動作優先。",
      single&&total>1?(only>1?"【與前面母圖保持一致】我會附上已完成的"+(only>2?"母圖 1～"+(only-1)+"（可能合併在同一張圖裡）":"母圖 1")+" 當參考圖：請沿用母圖 1 的同一個角色（五官、髮型、主色、線條與上色風格）與相同的格子排法，只畫母圖 "+only+" 的內容，不要重畫前面的母圖。若沒看到附圖，請先請我附上，不要自行改變角色外觀。":"【後續母圖】這一張完成後，我會把它當角色參考圖用在其他母圖，請把角色外觀畫得清楚、前後一致。"):null,
      "",
      "【母圖結構】",
      single?"每格是一張獨立貼圖；從左到右、由上到下排列；這一張母圖對應整組的第 "+target.start+"～"+target.end+" 張貼圖。4×2 表示 4 欄 2 列，4×4 表示 4 欄 4 列。":"每格是一張獨立貼圖；從左到右、由上到下排列，母圖之間接續同一份清單。4×2 表示 4 欄 2 列，4×4 表示 4 欄 4 列。",
      "母圖尺寸：理想是每格 "+cell.width+"×"+cell.height+" px（長寬比 37:32，與 LINE 貼圖 370×320 同比例，另外多留邊）。"+sizeAdvice(single?{grids:[target.size]}:state,s.platform,s.spacing)+"平台無法指定精確像素時，請選最接近的比例，仍排成 4 欄的等分格，不要拉伸或壓縮角色，並如實告知實際輸出尺寸；比例不同只會讓每格寬高不同，圖文仍須落在各格中央的安全區內。",
      "安全區：每格中央 "+SAFE.width+"×"+SAFE.height+" px 是角色、台詞、道具、描邊、陰影與裝飾必須完整放入的範圍（generous negative space）；每格左右各留約 "+Math.floor((cell.width-SAFE.width)/2)+" px、上下各留約 "+Math.floor((cell.height-SAFE.height)/2)+" px（約 "+Math.round(pct/2)+"%）的空白，相鄰格的可見內容之間因此至少有約 "+(cell.width-SAFE.width)+" px（左右）／"+(cell.height-SAFE.height)+" px（上下）的乾淨分隔帶（以理想尺寸計；實際尺寸不同時，請依相同比例，在各格四周保留約 "+Math.floor(pct/2/(100+pct)*100)+"% 的空白），方便沿平均網格切割。分隔帶只呈現指定背景，不畫格線、外框、分割標記或編號。這是母圖裁切用的生成目標，不是 LINE 官方尺寸規定。",
      "網格限制的是容納區與順序，不固定每格藝術構圖。角色與文字不得跨格、重疊、貼邊或被裁切；空間不足時縮小整組角色與文字。",
      "完整性檢查（重要）：頭髮、耳朵、手腳、尾巴、道具、台詞文字與陰影，每一個部分的最外緣都要距離所屬格子的邊緣至少 "+Math.floor((cell.width-SAFE.width)/2)+" px（左右）／"+Math.floor((cell.height-SAFE.height)/2)+" px（上下）；任何部分碰到或超出安全區，就把整個角色縮小一點，寧可畫小，也不要讓任何一格的圖被切掉或貼著格線。生成後逐格自查，有被切到的格子請重畫。",
      s.background==="transparent"?"背景要求：真正透明背景（alpha transparency）。不要畫出棋盤格、灰白方格、馬賽克或任何「透明示意」圖案；不要用白色、灰色或其他顏色填滿背景代替透明；只去除背景殘留的白邊、灰邊與不應出現的底色。角色與文字的描邊依下方設定，指定的白色或灰色描邊須保留；關閉描邊時不另加描邊。若生成工具不支援真透明，先明確說明限制，不要用棋盤格或白底假裝已透明。":s.background==="white"?"背景：純白色，整張母圖與各格一致。":"背景：單一純色 "+s.backgroundColor+"，整張母圖與各格一致。",
      "",
      "【內容守則（LINE 審核）】",
      "角色照本次設定繪製，不替換成其他角色；不要畫或模仿任何既有卡通、動漫、遊戲角色、吉祥物或名人。",
      "角色若本身有宗教或民俗身分（服飾、頭冠、法器等），依原設定保留，不刪除也不替換；一般祝福、祈福與節慶問候可以使用。",
      "自行發想的台詞、動作與道具：不寫勸人信教、要求參加宗教活動、捐獻或貶抑任何宗教；不寫選舉、政黨宣傳或政治攻擊；不加入購買連結、廣告、募款、QR code、電話、社群帳號或未指定的品牌文字。",
      "畫面不得出現未授權的商標、品牌 logo、網址或 QR code，也不要出現 LINE 以外的網路服務、通訊 App 名稱或其圖示（例如播放鍵、通知鈴鐺、社群平台圖示）。",
      "避免血腥、裸露、性暗示、毒品、鼓勵賭博或飲酒過量、自傷、歧視、霸凌與過度粗俗的內容；搞笑誇張的表情和動作可以。",
      "已指定的台詞逐字照印，不因本守則改字。自行發想時保持多樣：日常問候、工作生活、幽默、朋友互動、鼓勵安慰、感謝、關心、節慶、趣味反應與角色專屬情境，不要整組只用早安、晚安、謝謝、加油這類句子。",
      "每張都要是日常聊天用得上的表情或回應，角色清楚可辨；不要只有文字、只有物品或風景。",
      "",
      "【文字外觀】",
      sceneBrief(s),
      contentBrief(s),
      s.mode==="ai"?"台詞來源：AI 自由創作。發想情境："+(s.scene==="auto"?"不限定，自由發想"+(s.tone!=="auto"?"；語氣："+label("tone",s.tone):""):sceneName(s))+"。未填台詞依角色個性與生活互動創作有口語特色的短句，讓情緒、語氣與句式多元；不要照固定問候清單或每次使用相同開場順序。使用者已填的台詞仍逐字保留；每次生成可重新發想，但不保證跨次完全沒有重複。":"台詞來源："+label("mode",s.mode)+"；未填台詞可依情境補充。",
      s.textMode!=="none"?dialogueRule:null,
      s.textMode!=="none"&&s.mode!=="manual"?"台詞要平均涵蓋：招呼、回覆、忙碌、感謝、道歉、情緒、鼓勵、搞笑、休息與收尾"+(s.scene==="auto"?"":"，以及所選情境的專業用語（情境相關約占 5～7 成、一般聊天約 3～5 成）")+"；避免大量意思重複的句子（例如一堆早安、哈囉、你好），每句都要有不同用途。"+(s.tone!=="auto"?"語氣統一為「"+label("tone",s.tone)+"」。":""):null,
      s.textMode==="none"?"整組不放任何文字，仍依各格描述表達不同情緒與動作。":"只印明細中「要印的文字」的完整內容，維持原字與繁體中文；標示「台詞未填」時，依情境設計簡短繁體中文台詞。標示「無文字」的格子不得產生文字。不要添加道具文字、標題、水印或 Logo。",
      single&&total>1&&blankHere&&elsewhere.length?"本組其他母圖已使用這些台詞，本張請不要重複："+elsewhere.map(quote).join("、")+"。":null,
      single&&total>1&&only>1&&blankHere?"【不可重複前面母圖的台詞】先讀出附圖（前面母圖）中已經印出的每一句台詞；本張新創作的台詞一律不得與它們相同，也不要只改一兩個字，或換成同樣意思、同樣句型的說法。附圖中的台詞只用來避開，不要畫進本張。":null,
      single&&total>1&&blankHere?focusBrief(s,only,total):null,
      s.textMode!=="none"?'文字排版檢查：每格的完整台詞只印一次，不額外重複字句當裝飾。文字使用正確台灣繁體字形，逐字比對要印的原文，不能自行換成形近字、簡體字或錯字。每個字與描邊的外輪廓都須清楚分開，字與字保留至少一個筆畫寬的空隙，不重疊、不黏在一起；陰影不得形成第二層字。文字區與角色分開，整段文字寬度不超過該格安全區的八成；空間不夠時縮小文字或分行，禁止壓扁字形、壓縮字距或跨格。未指定換行的短句優先單行，較長內容自然分成兩行；使用者指定的換行則照原文。生成前檢查文字長度，生成後自查有無錯字、漏字、擠字與重影。':null,
      "字體："+(s.font==="custom"?(s.customFont.trim()?quote(s.customFont.trim()):"由 AI 選擇清楚易讀且配合貼圖風格的字體"):label("font",s.font))+"；大小："+label("size",s.size)+"；顏色："+color(s,"textColor","textCustom")+"；位置："+label("position",s.position)+"。",
      "描邊："+label("stroke",s.stroke)+(s.stroke==="none"?"":"；顏色："+color(s,"strokeColor","strokeCustom"))+"。陰影："+label("shadow",s.shadow)+(s.shadow==="none"?"":"；顏色："+color(s,"shadowColor","shadowCustom"))+"。",
      "文字不能遮住角色五官、手勢與關鍵道具，不缺字、不重字、不出現亂碼。本文的欄位標籤、格號、序號、照片檔名與操作說明都只是製作資料，不能印在貼圖上。",
      ""
    ];
    for(const p of all){
      if(single&&p!==target)continue;
      lines.push("【母圖 "+p.number+"｜4×"+p.rows+"｜整張 "+p.width+"×"+p.height+" px｜貼圖 "+p.start+"～"+p.end+"】");
      for(let i=p.start-1;i<p.end;i++){
        const entry=state.items[i],text=finalText(state,entry);
        lines.push("第 "+(i-p.start+2)+" 格（第 "+(i+1)+" 張貼圖，定位標籤不印）："+(hasText(state,entry)?(entry.text.trim()?"要印的文字 "+printed(text):"台詞未填：由 AI 依情境設計簡短繁體中文台詞"+(s.nameMode!=="none"&&entry.includeName&&s.name.trim()?"，在台詞前加上共用名稱 "+quote(s.name.trim()):"，不自行加入人名或店名")):"無文字"+(entry.text.trim()?"；原台詞只作情境參考 "+quote(entry.text):""))+"；表情 "+(entry.emotion.trim()?quote(entry.emotion.trim()):"依情境創作")+"；動作 "+(entry.action.trim()?quote(entry.action.trim()):"依情境創作不同姿勢")+"。");
      }
      lines.push("");
    }
    lines.push(single?"只輸出母圖 "+only+" 這一張完整圖片，不製作其他母圖、宣傳海報、漫畫分鏡、主圖或聊天標籤圖。生成後需人工核對文字、身份、表情動作、格數與背景；本指令不保證審核通過。":"只輸出各張完整母圖，不製作宣傳海報、漫畫分鏡、主圖或聊天標籤圖。生成後需人工核對文字、身份、表情動作、格數與背景；本指令不保證審核通過。");
    if(clear)lines.push("完成前檢查：背景必須是真正透明，不是棋盤格或白底；若畫面中看到棋盤格、灰白方格或單色底，請重新生成。");
    return lines.filter(x=>x!==null).join("\n");
  }
  function serialize(state) { return {tool:D.tool,version:D.version,state:clone(state)}; }
  function deserialize(raw) {
    if(typeof raw==="string"){if(raw.length>250000)throw new Error("設定檔超過 250 KB，請改用本工具匯出的檔案。");raw=JSON.parse(raw);}
    const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
    function scan(x){if(!x||typeof x!=="object")return;for(const k of Object.keys(x)){if(["__proto__","constructor","prototype"].includes(k))throw new Error("設定檔包含不允許的欄位。");scan(x[k]);}}
    scan(raw);
    if(!object(raw)||raw.tool!==D.tool||raw.version!==D.version||!object(raw.state))throw new Error("不是本工具支援的設定檔版本。");
    const input=raw.state;if(!object(input.settings)||!Array.isArray(input.items)||!Array.isArray(input.grids))throw new Error("設定檔結構不完整。");
    const settings={};
    for(const [key,def] of Object.entries(D.defaults)){
      const value=(key==="spacing"||key==="dimension"||key==="tone")&&input.settings[key]===undefined?def:input.settings[key]; // 舊設定檔沒有此欄位
      if(typeof value!==typeof def)throw new Error("設定欄位格式不正確："+key);
      if(typeof value==="string"&&value.length>1000)throw new Error("設定文字過長："+key);
      if(D.options[key]&&!D.options[key].some(x=>x[0]===value))throw new Error("未知設定選項："+key);
      if(key==="scene"&&!Object.hasOwn(D.scenes,value))throw new Error("未知情境。");
      if(key==="count"&&!D.counts.includes(value))throw new Error("不支援的貼圖張數。");
      if(["textCustom","strokeCustom","shadowCustom","backgroundColor"].includes(key)&&!/^#[0-9a-f]{6}$/i.test(value))throw new Error("顏色格式不正確。");
      settings[key]=value;
    }
    if(input.items.length>80||input.grids.length>5)throw new Error("設定檔筆數超出範圍。");
    const items=input.items.map(x=>{
      if(!object(x))throw new Error("逐張內容格式不正確。");
      const entry={};
      for(const key of ["text","emotion","action"]){if(typeof x[key]!=="string"||x[key].length>300)throw new Error("逐張文字格式不正確或超過 300 字。");entry[key]=x[key];}
      for(const key of ["hasText","includeName"]){if(typeof x[key]!=="boolean")throw new Error("逐張開關格式不正確。");entry[key]=x[key];}
      if(x.presetText!==undefined){if(typeof x.presetText!=="string"||x.presetText.length>300)throw new Error("預設台詞來源格式不正確。");entry.presetText=x.presetText;}
      return entry;
    });
    if(input.grids.some(x=>x!==8&&x!==16))throw new Error("設定檔母圖只可為 8 或 16 格。");
    // 自動分配以張數重算；預設情境模式不可停在「自由發想」。
    const grids=settings.layoutMode==="auto"?autoGrids(settings.count):input.grids.slice();
    if(settings.mode==="preset"&&settings.scene==="auto")settings.scene="greeting";
    return {settings,items,grids};
  }
  const api={presetShortfall,focusBrief,contentBrief,dialogueRule,styleDescription,sceneBrief,sceneName,SAFE,CELL,SPACING,cellFor,motherSize,initial,item,presetItem,releasePreset,trimEmpty,blank,printed,clone,label,autoGrids,pool,hasText,finalText,fillMissing,resize,validate,plans,prompt,duplicates,serialize,deserialize};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.StickerCore=api;
})(typeof window!=="undefined"?window:globalThis);
