"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const C=require("../sticker-core.js"),D=require("../sticker-data.js");
function ready(count=16){const s=C.initial();Object.assign(s.settings,{source:"original",kind:"human",character:"圓框眼鏡、短捲髮的原創人物",style:"cute"});C.resize(s,count);s.items=C.pool("greeting").slice(0,count).map(C.item);return s;}
test("五種官方張數的母圖分配與連續順序",()=>{
  const expected={8:[8],16:[16],24:[16,8],32:[16,16],40:[16,16,8]};
  for(const n of D.counts){const s=ready(n);assert.deepEqual(s.grids,expected[n]);assert.deepEqual(C.validate(s),[]);const plans=C.plans(s);assert.equal(plans.at(-1).end,n);assert.equal(plans[0].start,1);}
});
test("七種情境均可補足 40 句且保留已編輯台詞",()=>{
  for(const scene of Object.keys(D.scenes)){const s=ready(40);s.settings.scene=scene;s.items=Array.from({length:40},()=>C.item());s.items[0].text="我的自訂台詞";assert.equal(C.fillMissing(s),39);assert.equal(s.items[0].text,"我的自訂台詞");assert.equal(new Set(s.items.map(x=>x.text)).size,40);assert.deepEqual(C.validate(s),[]);}
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
  const s=ready();s.items[0].text='早安 "測試"\n第二行';const p=C.prompt(s);assert.ok(p.includes(JSON.stringify(s.items[0].text)));assert.match(p,/定位標籤不印/);
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
test("三平台加寬母圖分隔帶但保留網格與動作變化",()=>{for(const platform of ['chatgpt','gemini','generic']){const s=ready(24);s.settings.platform=platform;const p=C.prompt(s);assert.match(p,/寬度 10%/);assert.match(p,/高度 10%/);assert.match(p,/80% 寬 × 80% 高/);assert.match(p,/台詞、道具、描邊、陰影與裝飾/);assert.match(p,/不固定每格藝術構圖/);assert.match(p,/不同情緒與動作/);assert.match(p,/貼圖 17～24/);assert.doesNotMatch(p,/不自行套用任意百分比/);}});
