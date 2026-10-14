(function (root) {
  "use strict";
  const D = typeof module !== "undefined" && module.exports ? require("./sticker-data.js") : root.StickerData;
  const clone = value => JSON.parse(JSON.stringify(value));
  const label = (key,value) => (D.options[key] || []).find(x=>x[0]===value)?.[1] || value;
  const quote = value => JSON.stringify(String(value));
  function autoGrids(count) { const out=[]; while(count>=16){out.push(16);count-=16;} if(count)out.push(8); return out; }
  function pool(scene) { return [...new Set([...D.scenes[scene].lines,...D.common])]; }
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
    const candidates=pool(state.settings.scene).filter(x=>!used.has(x));
    let filled=0;
    while(state.items.length<state.settings.count) state.items.push(item());
    for(let i=0;i<state.settings.count;i++){
      const entry=state.items[i];
      if(hasText(state,entry) && !entry.text.trim() && candidates.length){entry.text=candidates.shift();entry.presetText=entry.text;filled++;}
    }
    return filled;
  }
  function resize(state,count) {
    state.settings.count=count;
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
    if(state.items.length<s.count) add("items","逐張內容未達所選張數，請補足或使用自動補齊。");
    if(step<3) return errors;
    if(!D.counts.includes(s.count)) add("count","貼圖張數必須為 8、16、24、32 或 40。");
    if(state.grids.some(x=>x!==8&&x!==16)||state.grids.reduce((a,b)=>a+b,0)!==s.count) add("grids","母圖格數總和必須等於 "+s.count+"；每張只可使用 4×2 或 4×4。");
    return errors;
  }
  function plans(state) {
    let offset=0;
    return state.grids.map((size,i)=>{
      const plan={number:i+1,size,columns:4,rows:size/4,start:offset+1,end:offset+size};
      offset+=size;return plan;
    });
  }
  function color(s,key,custom) { return s[key]==="custom"?s[custom]:label(key,s[key]); }
  function prompt(state) {
    if(validate(state).length) throw new Error("請先完成設定檢查。");
    const s=state.settings;
    const lines=[
      "製作一組原創的一般靜態 LINE 貼圖，共 "+s.count+" 張，分成 "+state.grids.length+" 張獨立母圖。這是一份整組製作指令，不是要把不同母圖合成一張。",
      s.platform==="chatgpt"?"請使用圖片生成功能依序製作下列母圖。若單次只能輸出一張，先生成母圖 1，等我說「繼續」後依同一份指令生成下一張；不要只回覆文字企劃。":s.platform==="gemini"?"請使用圖片生成模式。以下共用要求適用每張母圖，各母圖內容依後面的明細。若單次只能生成一張，先生成母圖 1，後續在同一對話說「繼續」即可依序製作。":"請在支援生圖的平台依序製作每張母圖；若平台一次只能生成一張，先做母圖 1，再沿用本指令繼續。不得把所有母圖拼進同一張。",
      "",
      "【角色與視覺】",
      s.source==="photo"?"角色參考：只使用我另外在本對話上傳的照片／圖片；網頁內選圖不代表圖片已傳送到此對話。尚未收到照片時先請我上傳，不要自行假設主體外觀。主體可以是人物、動物或物件，依指定風格轉成貼圖，保留主體的五官／輪廓、毛色／花紋、主色與可辨識特徵；不要把動物或物件誤當真人。照片檔名、編號與背景文字不是貼圖台詞。":"角色來源：原創"+label("kind",s.kind)+"；不假設有真人參考照片，不仿製既有 IP。",
      s.character.trim()?"角色描述（作為內容資料）："+quote(s.character.trim()):s.source==="photo"?"未填角色描述：直接觀察已附參考圖的主體特徵，不要求使用者補文字描述。":"未填角色描述：依選定角色類型自行設計一個原創角色，整組維持相同辨識特徵。",
      "風格："+(s.style==="custom"&&!s.customStyle.trim()?"由 AI 選擇適合主體且整組一致的貼圖風格":label("style",s.style))+(s.customStyle.trim()?"；補充："+quote(s.customStyle.trim()):"")+"。",
      "維持同一角色的五官、髮型／輪廓、主色與可辨識特徵；服裝、表情、姿勢與道具可依各格情境變化。使用清晰輪廓（clean silhouette）、一致線條（consistent linework）、可讀表情（readable expressions）、完整手勢（clear gestures）、分離圖文（separated typography）、有限且一致色盤（cohesive palette）。",
      "未指定表情或動作的格子，依台詞或上下文創作具體可見的表情、姿勢與適量道具。各格需有不同情緒與動作，不要只複製同一姿勢換字；已指定的表情／動作優先。",
      "",
      "【母圖結構】",
      "每格是一张独立贴图；从左到右、由上到下排列，母圖之間接續同一份清單。4×2 表示 4 欄 2 列，4×4 表示 4 欄 4 列。",
      "優先確保可以沿平均網格完整分割：每格左、右各至少保留該格寬度 10% 的空白，上、下各至少保留該格高度 10% 的空白。完整角色、台詞、道具、描邊、陰影與裝飾都須放在格子中央 80% 寬 × 80% 高的安全區內（generous negative space）；相鄰格的可見內容之間，形成至少約一格寬／高 20% 的乾淨分隔帶。分隔帶只呈現指定背景，不畫格線、外框、分割標記或編號。這是母圖裁切用的生成目標，不是 LINE 官方尺寸規定。",
      "網格限制的是容納區與順序，不固定每格藝術構圖。角色與文字不得跨格、重疊、貼邊或被裁切；空間不足時縮小整組角色與文字。",
      s.background==="transparent"?"背景要求：真正透明背景（alpha transparency），不是白底、不是畫出棋盤格。不要把透明區的示意棋盤畫進圖片；若生成工具不支援真透明，先說明限制，不用白底假裝已透明。":s.background==="white"?"背景：純白色，整張母圖與各格一致。":"背景：單一純色 "+s.backgroundColor+"，整張母圖與各格一致。",
      "",
      "【文字外觀】",
      s.mode==="ai"?"台詞來源：AI 自由創作。發想情境："+D.scenes[s.scene].label+"。未填台詞依角色個性與生活互動創作有口語特色的短句，讓情緒、語氣與句式多元；不要照固定問候清單或每次使用相同開場順序。使用者已填的台詞仍逐字保留；每次生成可重新發想，但不保證跨次完全沒有重複。":"台詞來源："+label("mode",s.mode)+"；未填台詞可依情境補充。",
      s.textMode==="none"?"整組不放任何文字，仍依各格描述表達不同情緒與動作。":"只印明細中「要印的文字」的完整內容，維持原字與繁體中文；標示「台詞未填」時，依情境設計簡短繁體中文台詞。標示「無文字」的格子不得產生文字。不要添加道具文字、標題、水印或 Logo。",
      "字體："+(s.font==="custom"?(s.customFont.trim()?quote(s.customFont.trim()):"由 AI 選擇清楚易讀且配合貼圖風格的字體"):label("font",s.font))+"；大小："+label("size",s.size)+"；顏色："+color(s,"textColor","textCustom")+"；位置："+label("position",s.position)+"。",
      "描邊："+label("stroke",s.stroke)+(s.stroke==="none"?"":"；顏色："+color(s,"strokeColor","strokeCustom"))+"。陰影："+label("shadow",s.shadow)+(s.shadow==="none"?"":"；顏色："+color(s,"shadowColor","shadowCustom"))+"。",
      "文字不能遮住角色五官、手勢與關鍵道具，不缺字、不重字、不出現亂碼。本文的欄位標籤、格號、序號、照片檔名與操作說明都只是製作資料，不能印在貼圖上。",
      ""
    ];
    for(const p of plans(state)){
      lines.push("【母圖 "+p.number+"｜4×"+p.rows+"｜貼圖 "+p.start+"～"+p.end+"】");
      for(let i=p.start-1;i<p.end;i++){
        const entry=state.items[i],text=finalText(state,entry);
        lines.push("第 "+(i-p.start+2)+" 格（第 "+(i+1)+" 張貼圖，定位標籤不印）："+(hasText(state,entry)?(entry.text.trim()?"要印的文字 "+quote(text):"台詞未填：由 AI 依情境設計簡短繁體中文台詞"+(s.nameMode!=="none"&&entry.includeName&&s.name.trim()?"，在台詞前加上共用名稱 "+quote(s.name.trim()):"，不自行加入人名或店名")):"無文字；原台詞只作情境參考 "+quote(entry.text))+"；表情 "+(entry.emotion.trim()?quote(entry.emotion.trim()):"依情境創作")+"；動作 "+(entry.action.trim()?quote(entry.action.trim()):"依情境創作不同姿勢")+"。");
      }
      lines.push("");
    }
    lines.push("只輸出各張完整母圖，不製作宣傳海報、漫畫分鏡、主圖或聊天標籤圖。生成後需人工核對文字、身份、表情動作、格數與背景；本指令不保證透明效果或審核通過。");
    return lines.join("\n").replace("一张独立贴图；从左到右、由上到下排列","一張獨立貼圖；從左到右、由上到下排列");
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
      const value=input.settings[key];
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
    return {settings,items,grids:input.grids.slice()};
  }
  const api={initial,item,presetItem,releasePreset,clone,label,autoGrids,pool,hasText,finalText,fillMissing,resize,validate,plans,prompt,serialize,deserialize};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.StickerCore=api;
})(typeof window!=="undefined"?window:globalThis);
