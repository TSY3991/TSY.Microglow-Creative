"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const C=require("../sticker-core.js"),D=require("../sticker-data.js");
function ready(count=16){const s=C.initial();Object.assign(s.settings,{source:"original",kind:"human",character:"圓框眼鏡、短捲髮的原創人物",style:"cute",mode:"preset",scene:"greeting"});C.resize(s,count);s.items=C.pool("greeting").slice(0,count).map(C.item);return s;}
test("五種官方張數的母圖分配與連續順序",()=>{
  const expected={8:[8],16:[16],24:[16,8],32:[16,16],40:[16,16,8]};
  for(const n of D.counts){const s=ready(n);assert.deepEqual(s.grids,expected[n]);assert.deepEqual(C.validate(s),[]);const plans=C.plans(s);assert.equal(plans.at(-1).end,n);assert.equal(plans[0].start,1);}
});
test("七種情境均可補足 40 句且保留已編輯台詞",()=>{
  for(const scene of Object.keys(D.scenes).filter(k=>k!=="auto")){const s=ready(40);s.settings.scene=scene;s.items=Array.from({length:40},()=>C.item());s.items[0].text="我的自訂台詞";const own=D.scenes[scene],job=!!own.job;assert.equal(C.fillMissing(s),job?own.lines.length:39);assert.equal(s.items[0].text,"我的自訂台詞");
    if(job){const filled=s.items.filter(x=>x.text.trim());assert.equal(filled.length,own.lines.length+1);assert.ok(filled.slice(1).every(x=>own.lines.includes(x.text)),scene);assert.equal(C.presetShortfall(s),40-own.lines.length-1);assert.equal(new Set(filled.map(x=>x.text)).size,filled.length);}
    else{assert.equal(new Set(s.items.map(x=>x.text)).size,40);assert.equal(C.presetShortfall(s),0);}
    assert.deepEqual(C.validate(s),[]);}
});
test("減少張數保留全部內容、阻擋生成",()=>{
  const s=ready(40);s.items[39].text="必須保留";C.resize(s,8);assert.equal(s.items.length,40);assert.equal(s.items[39].text,"必須保留");assert.ok(C.validate(s).some(e=>e.field==="items"));assert.throws(()=>C.prompt(s));s.items=s.items.slice(0,8);assert.deepEqual(C.validate(s),[]);
});
test("無文字模式不補台詞，也不要求台詞",()=>{
  const s=ready();s.settings.textMode="none";s.items=Array.from({length:16},()=>C.item());assert.equal(C.fillMissing(s),0);assert.deepEqual(C.validate(s),[]);assert.equal(C.finalText(s,s.items[0]),"");assert.match(C.prompt(s),/整組不放任何文字/);
});
test("逐張台詞選填，無文字格仍不印字",()=>{
  const s=ready();s.settings.textMode="per";s.items[0].text="";s.items[0].hasText=false;s.items[1].text="";assert.deepEqual(C.validate(s),[]);assert.match(C.prompt(s),/台詞未填/);assert.ok(!C.validate(s).some(e=>e.field==="item-0-text"));C.fillMissing(s);assert.equal(s.items[0].text,"");assert.deepEqual(C.validate(s),[]);
});
test("共用名稱、逐張關閉、手動文字可共存",()=>{
  const s=ready();s.settings.nameMode="person";s.settings.name="小光";s.items[0].text="早安";s.items[1].text="小曜晚安";s.items[1].includeName=false;assert.equal(C.finalText(s,s.items[0]),"小光早安");assert.equal(C.finalText(s,s.items[1]),"小曜晚安");s.settings.textMode="none";assert.equal(C.finalText(s,s.items[0]),"");
});
test("不合法母圖總數阻擋，手動合法分配不誤擋",()=>{
  const s=ready(24);s.settings.layoutMode="manual";s.grids=[16,16];assert.ok(C.validate(s).some(e=>e.field==="grids"));s.grids=[8,8,8];assert.deepEqual(C.validate(s),[]);assert.equal(C.plans(s)[2].start,17);
});
test("原創似顏繪衝突與照片角色正常",()=>{
  const s=ready();s.settings.style="likeness";assert.ok(C.validate(s).some(e=>e.field==="style"));s.settings.source="photo";s.settings.kind="";assert.deepEqual(C.validate(s),[]);assert.match(C.prompt(s),/尚未收到照片時先請我上傳/);
});
test("自訂字體與風格描述選填，留白由 AI 搭配",()=>{
  const s=ready();s.settings.style="custom";s.settings.font="custom";assert.deepEqual(C.validate(s),[]);assert.match(C.prompt(s),/由 AI 選擇/);s.settings.customStyle="扁平剪紙";s.settings.customFont="粗圓手寫";assert.deepEqual(C.validate(s),[]);
});
test("三平台整組指令保留母圖與逐張動作",()=>{
  for(const platform of ["chatgpt","gemini","generic"]){const s=ready(40);s.settings.platform=platform;s.items[0].emotion="開心";s.items[0].action="揮手";const p=C.prompt(s);assert.equal((p.match(/【母圖 \d/g)||[]).length,3);assert.match(p,/貼圖 33～40/);assert.match(p,/揮手/);assert.match(p,/清晰輪廓/);assert.match(p,/不能印在貼圖上/);assert.match(p,/alpha transparency/);assert.match(p,/繼續/);}
});
test("關閉描邊陰影與無字不會錯誤加入名稱",()=>{
  const s=ready();Object.assign(s.settings,{stroke:"none",shadow:"none",textMode:"none",nameMode:"person",name:"測試名"});const p=C.prompt(s);assert.match(p,/描邊：關閉描邊。陰影：關閉陰影/);assert.ok(!p.includes('要印的文字 "測試名'));
});
test("設定檔往返保留逐張資料、色碼及手動網格",()=>{
  const s=ready(24);s.settings.layoutMode="manual";s.grids=[8,8,8];s.items[3].action="拿杯子";s.settings.textColor="custom";s.settings.textCustom="#123abc";assert.deepEqual(C.deserialize(JSON.stringify(C.serialize(s))),s);
});
test("未完成設定可匯入，但生成仍檢查",()=>{
  const s=C.initial();const parsed=C.deserialize(C.serialize(s));assert.ok(C.validate(parsed).length);assert.throws(()=>C.prompt(parsed));
});
test("拒絕錯版本、非本工具與超大設定",()=>{
  const raw=C.serialize(ready());raw.version=2;assert.throws(()=>C.deserialize(raw));raw.version=1;raw.tool="another";assert.throws(()=>C.deserialize(raw));assert.throws(()=>C.deserialize(" ".repeat(250001)));
});
test("拒絕不合法型別、色碼、張數與過量逐張內容",()=>{
  for(const mutate of [x=>x.settings.count=17,x=>x.settings.textCustom="javascript:alert(1)",x=>x.settings.source={},x=>x.items[0].hasText="true",x=>x.items=Array.from({length:81},()=>C.item()),x=>x.grids=[32]]){const raw=C.serialize(ready());mutate(raw.state);assert.throws(()=>C.deserialize(raw));}
});
test("拒絕原型污染欄位，不污染全域",()=>{
  const raw=C.serialize(ready());const json=JSON.stringify(raw).replace('"settings":{','"settings":{"__proto__":{"polluted":true},');assert.throws(()=>C.deserialize(json));assert.equal({}.polluted,undefined);
});
test("引號與換行維持資料邊界，標籤僅作定位",()=>{
  const s=ready();s.items[0].text='早安 "測試"\n第二行';const p=C.prompt(s);assert.match(p,/分 2 行，由上到下依序為 "早安 \\"測試\\""、"第二行"/);assert.ok(!p.includes('\\n'));assert.match(p,/定位標籤不印/);
});
test("整組或逐張全無字不被未填名稱與字體誤擋",()=>{
  for(const mode of ["none","per"]){
    const s=ready();s.settings.textMode=mode;s.settings.nameMode="person";s.settings.name="";s.settings.font="custom";s.settings.customFont="";
    s.items.forEach(x=>{x.hasText=false;x.text="";});
    assert.deepEqual(C.validate(s),[]);assert.doesNotThrow(()=>C.prompt(s));
  }
});

test("照片參考可為動物或物件，三平台均提醒另附圖片",()=>{
  for(const platform of ["chatgpt","gemini","generic"]){const s=ready();s.settings.source="photo";s.settings.platform=platform;s.settings.character="綠色水壺，保留把手與輪廓";const prompt=C.prompt(s);assert.match(prompt,/人物、動物或物件/);assert.match(prompt,/網頁內選圖不代表圖片已傳送/);assert.match(prompt,/尚未收到照片時先請我上傳/);assert.match(prompt,/依指定風格轉成貼圖/);}
});

test("文字全留白不阻擋，照片／原創與有字／無字意圖正確",()=>{for(const source of ["photo","original"]){for(const mode of ["all","none","per"]){const s=ready();Object.assign(s.settings,{source,character:"",style:"custom",customStyle:"",font:"custom",customFont:"",nameMode:"person",name:"",textMode:mode,mode:"manual"});s.items=Array.from({length:16},()=>C.item());if(mode==="per")s.items[0].hasText=false;assert.deepEqual(C.validate(s),[]);const p=C.prompt(s);assert.match(p,source==="photo"?/直接觀察已附參考圖/:/自行設計一個原創角色/);assert.ok(!p.includes('要印的文字 ""'));if(mode==="none")assert.match(p,/整組不放任何文字/);else assert.match(p,/台詞未填/);}}});
test("三平台加寬母圖分隔帶但保留網格與動作變化",()=>{for(const platform of ['chatgpt','gemini','generic']){const s=ready(24);s.settings.platform=platform;const p=C.prompt(s);assert.match(p,/理想是每格 592×512 px（長寬比 37:32/);assert.match(p,/【母圖 1｜4×4｜整張 2368×2048 px/);assert.match(p,/【母圖 2｜4×2｜整張 2368×1024 px/);assert.match(p,/中央 370×320 px/);assert.match(p,/左右各留約 111 px、上下各留約 96 px/);assert.match(p,/平台無法指定精確像素時，請選最接近的比例/);assert.match(p,/4×4 母圖理想整張 2368×2048 px/);assert.match(p,/4×2 母圖理想整張 2368×1024 px/);if(platform==='chatgpt'){assert.match(p,/1:1（正方形）或 3:2（橫式）/);assert.match(p,/3:2（橫式，每格會偏直）/);}if(platform==='gemini'){assert.match(p,/5:4 或 1:1/);assert.match(p,/21:9 或 16:9/);}assert.match(p,/約 18% 的空白/);assert.match(p,/台詞、道具、描邊、陰影與裝飾/);assert.match(p,/不固定每格藝術構圖/);assert.match(p,/不同情緒與動作/);assert.match(p,/貼圖 17～24/);assert.doesNotMatch(p,/不自行套用任意百分比/);}});

test("縮減張數只移除尾端空白項，有內容的完整保留",()=>{
  const s=C.initial();Object.assign(s.settings,{source:"original",kind:"human",style:"cute"});
  C.resize(s,40);C.resize(s,16);assert.equal(s.items.length,16);
  C.resize(s,40);s.items[39].text="尾端內容";C.resize(s,16);assert.equal(s.items.length,40);assert.equal(s.items[39].text,"尾端內容");assert.ok(C.validate(s,3).some(e=>e.field==="items"));
  s.items[20].emotion="中間的表情";C.resize(s,8);assert.equal(s.items.length,40);
});
test("提示詞：無情境不輸出空引號、全部為繁體、自由發想描述正確",()=>{
  const s=ready(8);s.settings.textMode="none";s.items[0].text="";const p=C.prompt(s);assert.ok(!p.includes('參考 ""'));assert.ok(!/[张贴从]/.test(p));
  s.settings.textMode="all";s.settings.mode="ai";s.settings.scene="auto";assert.match(C.prompt(s),/發想情境：不限定，自由發想/);
});
test("匯入自動分配的設定時重算母圖；預設情境不停在自由發想",()=>{
  const s=ready(16);s.settings.layoutMode="auto";s.grids=[8,8];const parsed=C.deserialize(JSON.stringify(C.serialize(s)));assert.deepEqual(parsed.grids,[16]);
  const t=ready(16);t.settings.mode="preset";t.settings.scene="auto";assert.equal(C.deserialize(JSON.stringify(C.serialize(t))).settings.scene,"greeting");
});
test("母圖尺寸由 LINE 貼圖尺寸加外距反推，比例與貼圖一致",()=>{
  assert.equal(C.SAFE.width/C.SAFE.height,C.CELL.width/C.CELL.height);
  assert.deepEqual(C.motherSize(4),{width:2368,height:2048});assert.deepEqual(C.motherSize(2),{width:2368,height:1024});
  const s=ready(40);assert.deepEqual(C.plans(s).map(x=>[x.width,x.height]),[[2368,2048],[2368,2048],[2368,1024]]);
  const K=require("../sticker-crop-core.js");assert.deepEqual(K.cell,C.CELL);assert.deepEqual(K.expectedSize(4),C.motherSize(4));
  assert.ok(K.ratioGap(1536,1024,4)>0.05);assert.ok(K.ratioGap(2368,2048,4)<0.001);
});
test("只有一種母圖時，尺寸建議只寫該種",()=>{
  const s=ready(8);s.settings.platform="gemini";const p=C.prompt(s);
  assert.match(p,/4×2 母圖理想整張 2368×1024 px/);assert.doesNotMatch(p,/4×4 母圖理想整張/);
});
test("單張母圖提示詞：只含該張、第 2 張起沿用母圖 1、列出其他母圖已用台詞",()=>{
  const s=ready(40);s.settings.platform="gemini";s.items[0].text="早安";s.items[20].text="";s.items[35].text="";
  const p1=C.prompt(s,1),p2=C.prompt(s,2),p3=C.prompt(s,3);
  assert.match(p1,/「母圖 1」/);assert.match(p1,/之後會當角色參考|我會把它當角色參考圖/);assert.doesNotMatch(p1,/【母圖 2｜/);
  assert.match(p2,/附上已完成的母圖 1/);assert.match(p2,/貼圖 17～32/);assert.doesNotMatch(p2,/【母圖 1｜/);
  assert.match(p3,/貼圖 33～40/);assert.match(p3,/本組其他母圖已使用這些台詞，本張請不要重複：.*"早安"/);
  assert.throws(()=>C.prompt(s,9));assert.ok(C.prompt(s).includes("【母圖 3｜"));
});
test("重複台詞偵測：忽略空白與標點",()=>{
  const s=ready(8);s.items[0].text="早安";s.items[1].text="早安！";s.items[2].text="早 安";s.items[3].text="晚安";
  const d=C.duplicates(s);assert.equal(d.length,1);assert.deepEqual(d[0].indexes,[0,1,2]);
  s.items[1].text="午安";s.items[2].text="夜安";assert.deepEqual(C.duplicates(s),[]);
});
test("格子留白：預設加寬，標準／加寬／最寬的尺寸長寬比不變",()=>{
  assert.deepEqual(C.cellFor("standard"),{width:481,height:416});assert.deepEqual(C.cellFor("wide"),{width:592,height:512});assert.deepEqual(C.cellFor("widest"),{width:703,height:608});
  assert.deepEqual(C.cellFor("unknown"),{width:592,height:512});assert.deepEqual(C.motherSize(4,"widest"),{width:2812,height:2432});
  const s=ready(16);assert.equal(s.settings.spacing,"wide");assert.equal(C.plans(s)[0].width,2368);
  let p=C.prompt(s);assert.match(p,/每格 592×512 px/);assert.match(p,/整張 2368×2048 px/);assert.match(p,/完整性檢查/);assert.match(p,/約 18% 的空白/);
  s.settings.spacing="widest";p=C.prompt(s);assert.match(p,/每格 703×608 px/);assert.match(p,/整張 2812×2432 px/);assert.doesNotMatch(p,/592×512/);
  s.settings.spacing="standard";assert.match(C.prompt(s),/每格 481×416 px/);assert.match(C.prompt(s),/約 11% 的空白/);
});
test("格子留白：舊設定檔沒有此欄位視為預設，未知值被拒絕",()=>{
  const s=ready(16),raw=C.serialize(s);delete raw.state.settings.spacing;assert.equal(C.deserialize(raw).settings.spacing,"wide");
  s.settings.spacing="widest";assert.equal(C.deserialize(JSON.stringify(C.serialize(s))).settings.spacing,"widest");
  s.settings.spacing="huge";assert.throws(()=>C.deserialize(JSON.stringify(C.serialize(s))));
});
test("呈現方式：預設 2D，3D 寫入提示詞，舊設定檔相容、未知值被拒絕",()=>{
  const s=ready(16);assert.equal(s.settings.dimension,"2d");assert.match(C.prompt(s),/2D 平面插畫，不要 3D 渲染/);
  s.settings.dimension="3d";const p=C.prompt(s);assert.match(p,/呈現方式：3D 立體/);assert.doesNotMatch(p,/不要 3D 渲染/);
  assert.equal(C.deserialize(JSON.stringify(C.serialize(s))).settings.dimension,"3d");
  s.settings.dimension="semi";const q=C.prompt(s);assert.match(q,/半 3D（Semi-3D）/);assert.match(q,/glossy semi-3D cel-shaded/);assert.doesNotMatch(q,/Q 版（chibi）|粗黑外框|storybook|Reel/);assert.doesNotMatch(q,/不要 3D 渲染|呈現方式：3D 立體/);s.settings.dimension="3d";
  const raw=C.serialize(ready(16));delete raw.state.settings.dimension;assert.equal(C.deserialize(raw).settings.dimension,"2d");
  s.settings.dimension="4d";assert.throws(()=>C.deserialize(JSON.stringify(C.serialize(s))));
});
test("職業情境：全部可補滿 40 張、句子不重複、不超過 14 字，並可搜尋",()=>{
  const jobs=Object.entries(D.scenes).filter(([,x])=>x.job);assert.ok(jobs.length>=40);
  for(const [id,x] of jobs){const p=C.pool(id);assert.ok(p.length>=40,id+" 句庫不足："+p.length);assert.equal(new Set(x.lines).size,x.lines.length,id);assert.ok(x.lines.every(t=>t.length<=14&&!D.common.includes(t)),id);assert.ok(x.group&&x.kw);}
  for(const need of ["工程師","軟體工程師","AI 工程師","老師","客服","寵物","宮廟","影音創作者","美髮","司機"])assert.ok(jobs.some(([,x])=>x.label===need),need);
  const s=ready(40);s.settings.scene="job_engineer";s.items=Array.from({length:40},()=>C.item());C.fillMissing(s);const got=s.items.filter(x=>x.text.trim());assert.equal(got.length,16);assert.equal(new Set(got.map(x=>x.text)).size,16);assert.ok(got.every(x=>D.scenes.job_engineer.lines.includes(x.text)),"職業情境不混入通用句");assert.equal(C.presetShortfall(s),24);
  assert.match(C.prompt(s,3),/台詞未填：由 AI 依情境設計/);
  {const g=ready(40);g.settings.scene="greeting";g.items=Array.from({length:40},()=>C.item());C.fillMissing(g);assert.equal(g.items.filter(x=>x.text.trim()).length,40);assert.equal(C.presetShortfall(g),0);}
});
test("語氣、內容平衡、角色鎖定與職業情境寫入提示詞；舊設定檔相容",()=>{
  const s=ready(16);s.settings.mode="ai";s.settings.scene="job_teacher";s.settings.tone="funny";
  const p=C.prompt(s);assert.match(p,/老師職業日常；語氣：搞笑/);assert.match(p,/語氣統一為「搞笑」/);assert.match(p,/避免大量意思重複/);assert.match(p,/角色鎖定（整組每一張都必須相同）/);assert.match(p,/動作可以變，角色不能變/);
  assert.equal(C.sceneName(s.settings),"老師職業日常；語氣：搞笑");s.settings.tone="auto";assert.equal(C.sceneName(s.settings),"老師職業日常");
  s.settings.mode="manual";assert.doesNotMatch(C.prompt(s),/避免大量意思重複/);
  const raw=C.serialize(ready(16));delete raw.state.settings.tone;assert.equal(C.deserialize(raw).settings.tone,"auto");
  raw.state.settings.tone="rude";assert.throws(()=>C.deserialize(raw));
  for(const st of ["clean","jpsoft","handdrawn","meme","festival"]){const t=ready(16);t.settings.style=st;assert.match(C.prompt(t),new RegExp("風格："+C.label("style",st).slice(0,4)));assert.equal(C.deserialize(JSON.stringify(C.serialize(t))).settings.style,st);}
});
