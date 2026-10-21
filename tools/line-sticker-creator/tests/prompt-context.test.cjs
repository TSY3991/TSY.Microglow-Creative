const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../sticker-core.js'),D=require('../sticker-data.js'),AI=require('../sticker-ai.js');
function ready(count=24){const s=C.initial();Object.assign(s.settings,{source:'original',kind:'animal',style:'cute'});C.resize(s,count);return s;}

test('所有既有角色風格進入整組與逐張母圖提示詞，參考圖不會取代風格',()=>{
  for(const [style,name] of D.options.style.filter(([id])=>id)){
    const s=ready();s.settings.style=style;if(style==='likeness')s.settings.source='photo';
    if(style==='custom')s.settings.customStyle='淡彩水墨筆觸';
    const snapshot=C.clone(s);
    for(const platform of ['chatgpt','gemini','generic']){
      s.settings.platform=platform;
      for(const only of [undefined,1,2]){
        const p=C.prompt(s,only);
        if(style==='custom')assert.ok(p.includes(s.settings.customStyle));
        else {assert.ok(p.includes(name));assert.ok(p.includes(D.styleGuides[style]),style);}
        assert.match(p,/參考圖提供角色身份，不取代選定風格/);
      }
    }
    s.settings.platform=snapshot.settings.platform;assert.deepEqual(s,snapshot);
  }
});

test('全部職業／主題帶入領域詞彙，AI、預設與手動以及多張母圖皆不遺漏',()=>{
  for(const [scene,info] of Object.entries(D.scenes).filter(([,v])=>v.job)){
    assert.ok(info.terms,scene);
    for(const mode of ['ai','preset','manual']){
      const s=ready();Object.assign(s.settings,{scene,mode});const snapshot=C.clone(s);
      for(const platform of ['chatgpt','gemini','generic']){
        s.settings.platform=platform;
        for(const only of [undefined,1,2]){
          const p=C.prompt(s,only);assert.ok(p.includes(info.label));assert.ok(p.includes(info.terms),scene+' '+mode+' '+platform);
        }
      }
      s.settings.platform=snapshot.settings.platform;assert.deepEqual(s,snapshot);
      assert.ok(s.items.every(x=>!x.text&&!x.action&&!x.emotion)); // 詞彙不是固定台詞或自動補入
    }
  }
});

test('無文字與手寫內容保留，切換職業不偷改台詞，不把情境詞彙當要印的字',()=>{
  const s=ready(8);s.settings.scene='job_temple';s.settings.textMode='none';
  const p=C.prompt(s);assert.match(p,/廟會、祈福、平安/);assert.match(p,/內容守則（LINE 審核）/);assert.match(p,/依原設定保留，不刪除也不替換/);assert.doesNotMatch(p,/不畫成神明/);assert.doesNotMatch(p,/安太歲|供桌/);assert.match(p,/不產生任何文字/);assert.doesNotMatch(p,/要印的文字/);
  s.settings.textMode='all';s.settings.mode='manual';s.items[0].text='保留我的原文';
  const before=C.clone(s.items),q=C.prompt(s);assert.match(q,/要印的文字 "保留我的原文"/);assert.match(q,/不因情境換字/);assert.deepEqual(s.items,before);
  s.settings.scene='job_photographer';assert.match(C.prompt(s),/快門、光圈、對焦/);assert.deepEqual(s.items,before);
});

test('網站 AI 與既有 Worker 契約相容，真的收到風格細節與職業詞彙；不帶句庫',async()=>{
  const {validateInput,modelRequest}=await import('../worker/worker.mjs');
  for(const [scene,info] of Object.entries(D.scenes).filter(([,v])=>v.job)){
    const s=ready(8);s.settings.scene=scene;s.settings.style='handdrawn';
    const input=AI.payload(s);assert.deepEqual(validateInput(input),input);
    assert.ok(input.context.style.includes(D.styleGuides.handdrawn));assert.ok(input.context.scene.includes(info.terms));
    assert.ok(input.context.scene.length<=1000&&input.context.style.length<=1000);
    assert.ok(input.items.every(x=>x.text===''));
    const upstream=modelRequest(input).contents[0].parts[0].text;assert.ok(upstream.includes(info.terms));
    assert.ok(!Object.hasOwn(input.context,'lines')); // 沒有把預設台詞清單送入 AI
  }
  const free=ready(8);assert.ok(AI.payload(free).context.scene.startsWith('AI 自由發想。'));assert.ok(AI.payload(free).context.scene.includes(C.dialogueRule));
  assert.ok(!C.prompt(free).includes('情境詞彙（'));
});

test('短句、台灣用語與不擠字規則進入各平台及每張母圖，手寫長句不截斷',()=>{
  const s=ready(24);s.items[0].text='這是使用者自己寫的完整長句必須保留';
  for(const platform of ['chatgpt','gemini','generic']){s.settings.platform=platform;for(const only of [undefined,1,2]){const p=C.prompt(s,only);assert.ok(p.includes(C.dialogueRule));assert.match(p,/描邊的外輪廓都須清楚分開/);assert.match(p,/正確台灣繁體字形/);if(only!==2)assert.ok(p.includes(s.items[0].text));}}
  s.settings.textMode='none';assert.ok(!C.prompt(s).includes(C.dialogueRule));
});
test('3D 軟萌風格優先建立立體造型，不沿用平面渲染；半 3D 保留原設定',()=>{
  const s=ready();s.settings.style='jpsoft';s.settings.dimension='3d';
  for(const only of [undefined,1,2]){const p=C.prompt(s,only);assert.match(p,/日系軟萌/);assert.match(p,/fully modeled 3D character render/);assert.match(p,/側面厚度/);assert.match(p,/重新建立立體造型/);assert.ok(!p.includes('呈現方式：半 3D'));assert.ok(!p.includes('consistent linework'));}
  s.settings.dimension='semi';assert.match(C.prompt(s),/呈現方式：半 3D（Semi-3D）/);assert.ok(!C.prompt(s).includes('fully modeled 3D character render'));
});

test('角色、情境與語氣搭配規則進入整組與逐張母圖及既有 Worker',async()=>{
  const {validateInput,modelRequest}=await import('../worker/worker.mjs');
  for(const mode of ['ai','preset','manual'])for(const [tone]of D.options.tone){const s=ready();Object.assign(s.settings,{mode,tone,style:'jpsoft',scene:'job_teacher',character:'個性沉穩'});s.items[0].text='保留我的原文';const before=C.clone(s);const rule=C.contentBrief(s.settings);
    for(const platform of ['chatgpt','gemini','generic']){s.settings.platform=platform;for(const only of [undefined,1,2]){const p=C.prompt(s,only);assert.ok(p.includes(rule));assert.match(p,/情境決定說什麼，語氣決定怎麼說/);if(tone==='auto')assert.match(p,/自動語氣：綜合角色描述/);else assert.ok(p.includes('指定語氣優先：依「'+C.label('tone',tone)+'」'));}}
    s.settings.platform=before.settings.platform;assert.deepEqual(s,before);const input=AI.payload(s);assert.deepEqual(validateInput(input),input);assert.ok(modelRequest(input).contents[0].parts[0].text.includes(rule));assert.ok(input.context.scene.length<=1000);if(mode==='preset')assert.match(rule,/預設句庫原文保留/);if(mode==='manual')assert.match(rule,/自行輸入的原文保留/);
  }
  for(const scene of Object.keys(D.scenes)){const s=ready(8);s.settings.scene=scene;assert.ok(AI.payload(s).context.scene.length<=1000);}
  const s=ready(8);s.settings.textMode='none';assert.match(C.contentBrief(s.settings),/不新增台詞/);assert.doesNotMatch(C.contentBrief(s.settings),/創作新台詞/);
});
{const s2=ready(8);s2.settings.scene='greeting';const p2=C.prompt(s2);assert.match(p2,/不寫勸人信教/);assert.match(p2,/商標、品牌 logo/);assert.match(p2,/逐字照印/);assert.doesNotMatch(p2,/不畫成神明/);console.log('PASS LINE review rules in prompt');}
{ // 透明背景要特別強調禁用棋盤格；其他背景選項不出現
  const make=bg=>{const s=ready(8);s.settings.background=bg;return C.prompt(s);};
  const clear=make('transparent'),lines=clear.split('\n');
  assert.match(lines[0],/最重要.*真正透明的 PNG.*嚴禁用棋盤格/);
  assert.match(clear,/不要畫出棋盤格、灰白方格、馬賽克/);assert.match(clear,/不要用白色、灰色或其他顏色填滿背景代替透明/);
  assert.match(lines[lines.length-1],/完成前檢查：背景必須是真正透明/);assert.doesNotMatch(clear,/不保證透明效果/);
  for(const bg of ['white','color']){const p=make(bg);assert.doesNotMatch(p,/最重要：每張母圖的背景/);assert.doesNotMatch(p,/棋盤格/);assert.doesNotMatch(p,/完成前檢查：背景/);}
  const one=(()=>{const s=ready(8);s.settings.background='transparent';return C.prompt(s,1);})();assert.match(one,/最重要.*嚴禁用棋盤格/);assert.match(one,/完成前檢查：背景必須是真正透明/);
  console.log('PASS transparent background emphasis');
}

test('透明背景去除殘邊但保留指定白色或灰色描邊，不影響關閉描邊與其他背景',()=>{
  for(const count of D.counts)for(const platform of ['chatgpt','gemini','generic']){
    for(const background of ['transparent','white','color'])for(const stroke of ['thick','none']){
      for(const [strokeColor,strokeCustom,colorLabel] of [['white','#ffffff','白'],['custom','#727978','#727978']]){
        const s=ready(count);Object.assign(s.settings,{platform,background,stroke,strokeColor,strokeCustom});
        s.items[0].text='保留我的台詞';const before=C.clone(s);
        for(const only of [undefined,...s.grids.map((_,i)=>i+1)]){
          const p=C.prompt(s,only);
          assert.doesNotMatch(p,/外框不要帶白邊或灰邊/);
          if(background==='transparent'){
            assert.match(p,/只去除背景殘留的白邊、灰邊與不應出現的底色/);
            assert.match(p,/描邊依下方設定，指定的白色或灰色描邊須保留/);
            assert.match(p,/嚴禁用棋盤格/);
          }else assert.doesNotMatch(p,/只去除背景殘留/);
          assert.ok(p.includes(stroke==='none'?'描邊：關閉描邊。':'描邊：粗；顏色：'+colorLabel+'。'));
          if(!only||only===1)assert.ok(p.includes('要印的文字 "保留我的台詞"'));
        }
        assert.deepEqual(s,before);
      }
    }
  }
});
{ // 多張母圖逐張複製：每張不同發想重點（依母圖序號、可重現）、母圖 2 起附前面母圖並不可重複其台詞
  const make=(count,grids,mode='ai',fill='')=>{const s=ready(8);s.settings.count=count;s.settings.mode=mode;s.settings.scene='job_temple';s.grids=grids;s.items=Array.from({length:count},(_,i)=>C.item(typeof fill==='function'?fill(i):fill));return s;};
  const s=make(40,[16,16,8]),p=[1,2,3].map(n=>C.prompt(s,n));
  const focus=p.map(x=>(x.split('\n').find(l=>l.startsWith('【本張發想重點】'))||''));
  assert.ok(focus.every(Boolean));assert.equal(new Set(focus).size,3);
  assert.ok(focus.every(l=>l.includes('不是要印的文字')));
  assert.equal(C.prompt(make(40,[16,16,8]),2),p[1]);
  assert.doesNotMatch(p[0],/不可重複前面母圖的台詞/);assert.match(p[1],/不可重複前面母圖的台詞/);assert.match(p[2],/母圖 1～2（可能合併在同一張圖裡）/);
  assert.match(p[1],/附上已完成的母圖 1 當參考圖/);
  // 每張的重點不得出現在「要印的文字」
  for(const x of p)assert.ok(!x.split('\n').some(l=>/^第 \d+ 格/.test(l)&&/發想重點|台詞用途/.test(l)));
  // 台詞全部由使用者填好（手動）時，不加發想重點與不重複指示，原文照印
  const m=make(32,[16,16],'manual',i=>'字'+(i+1)),q=C.prompt(m,2);
  assert.doesNotMatch(q,/本張發想重點|不可重複前面母圖的台詞/);assert.match(q,/要印的文字 "字17"/);
  // 單張母圖與整組一次複製不受影響
  assert.doesNotMatch(C.prompt(make(16,[16])),/本張發想重點/);assert.doesNotMatch(C.prompt(s),/本張發想重點/);
  console.log('PASS multi-mother focus and no-repeat');
}
{ // 取景限制、附圖分工（照片／前面母圖各管一件事、標籤條不畫進圖）
  const mk=(source,count,grids)=>{const s=ready(8);s.settings.source=source;s.settings.count=count;s.settings.mode='ai';s.grids=grids;s.items=Array.from({length:count},()=>C.item(''));return s;};
  const photo=mk('photo',40,[16,16,8]),orig=mk('original',32,[16,16]);
  for(const s of [photo,orig]){const p=C.prompt(s,1);assert.match(p,/取景與畫面限制：每格以角色的頭部與上半身為主/);assert.match(p,/手部與人物比例自然/);assert.doesNotMatch(p,/【附圖分工】/);}
  const p2=C.prompt(photo,2),p3=C.prompt(photo,3),q2=C.prompt(orig,2);
  assert.match(p2,/【附圖分工】附圖中的原始照片：只用來決定角色外觀/);assert.match(p2,/附圖中的前面母圖：只用來保持同一角色的畫風、線條與格子排法，並避開已用過的台詞/);assert.doesNotMatch(p2,/灰色條/);
  assert.match(p3,/灰色條與「母圖 N」字樣只是標記/);
  assert.doesNotMatch(q2,/原始照片：只用來決定角色外觀/);assert.match(q2,/附圖中的前面母圖：只用來保持/);
  assert.doesNotMatch(C.prompt(photo),/【附圖分工】/);
  console.log('PASS framing limits and attachment roles');
}
