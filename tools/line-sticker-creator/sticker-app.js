(function () {
  "use strict";
  const D=window.StickerData,C=window.StickerCore;
  const $=id=>document.getElementById(id);
  const storageKey="microglow:line-sticker-creator:v1";
  let state=C.initial(),step=1,saveEnabled=false,generated=false;
  let referenceUrl="",referenceRevision=0;
  const AI=window.StickerAI,G=window.StickerContentGuard;
  let aiEndpoint="",aiController=null,aiApplied=null,aiRevision=0,aiOrigin={};
  function clearReference() {
    referenceRevision++;
    if(referenceUrl)URL.revokeObjectURL(referenceUrl);
    referenceUrl="";$("reference-file").value="";$("reference-image").removeAttribute("src");$("reference-preview").hidden=true;
    $("reference-status").textContent="尚未選擇參考圖；也可以稍後直接在 AI 平台附圖。";
  }
  $("reference-file").addEventListener("change",async()=>{
    const file=$("reference-file").files[0];if(!file)return;
    const revision=++referenceRevision;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024){
      $("reference-file").value="";$("reference-status").textContent="請選 JPG、PNG 或 WebP，單張不超過 10 MB。原有參考圖保留。";return;
    }
    const url=URL.createObjectURL(file),image=new Image();image.src=url;
    try{
      await image.decode();
      if(revision!==referenceRevision){URL.revokeObjectURL(url);return;}
      if(referenceUrl)URL.revokeObjectURL(referenceUrl);
      referenceUrl=url;$("reference-image").src=url;$("reference-preview").hidden=false;
      $("reference-status").textContent="已選擇參考圖（"+image.naturalWidth+" × "+image.naturalHeight+"）。請在 AI 對話附上同一張圖。";
      invalidate();
    }catch{
      URL.revokeObjectURL(url);
      if(revision===referenceRevision){$("reference-file").value="";$("reference-status").textContent="無法讀取這張圖片，請改用有效的 JPG、PNG 或 WebP。原有參考圖保留。";}
    }
  });
  $("remove-reference").addEventListener("click",()=>{clearReference();invalidate();});
  window.addEventListener("pagehide",()=>{referenceRevision++;if(referenceUrl)URL.revokeObjectURL(referenceUrl);});
  window.addEventListener("pageshow",event=>{if(event.persisted){clearReference();invalidate();}});
  function node(tag,text,cls) { const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el; }
  function status(message) { $("status").textContent=message; }
  function save() {
    if(!saveEnabled)return;
    try{localStorage.setItem(storageKey,JSON.stringify(C.serialize(state)));$("save-status").textContent="已儲存在目前瀏覽器。";}
    catch{$("save-status").textContent="瀏覽器無法儲存；可改用匯出設定檔。";}
  }
  function invalidate() {
    clearAI("設定已變更，請重新安排 AI 建議。");
    if(!state.items.some(x=>C.hasText(state,x)&&x.text.trim()))$("content-update-notice").hidden=true;
    generated=false;
    $("prompt-area").hidden=true;$("prompt-output").value="";$("copy-feedback").textContent="";
    $("validation").hidden=true;
    document.querySelectorAll(".field-error").forEach(e=>e.textContent="");
    document.querySelectorAll('[aria-invalid="true"]').forEach(e=>e.removeAttribute("aria-invalid"));
    live();save();
    if(step===4)renderMulti();
  }
  function refreshContentNotice(title){
    const box=$('content-update-notice');box.dataset.subject=title;
    const detail=state.settings.mode==='ai'?'要依新設定重新創作，請按「將台詞、表情與動作交給 AI 重新創作」，再安排 AI 或產生提示詞。':state.settings.mode==='preset'?'預設句庫不會依風格或語氣改寫；換情境要按「套用預設情境台詞」，想依新設定重寫可先改選「台詞由 AI 發揮」。':'自行輸入的原文不會改寫；請手動修改，或改選「台詞由 AI 發揮」後重新創作。';
    box.hidden=false;box.textContent=title+'已變更，已有台詞會保留，尚未依新設定重寫。'+detail;status(box.textContent);if(step===4)summary();
  }
  function conditions() {
    document.querySelectorAll("[data-visible]").forEach(el=>{
      const [key,values]=el.dataset.visible.split(":");
      el.hidden=!values.split(",").includes(String(state.settings[key]));
      el.querySelectorAll("[data-setting]").forEach(control=>control.disabled=el.hidden);
    });
    $("apply-scene").hidden=state.settings.mode!=="preset";
    $("apply-scene").disabled=state.settings.textMode==="none";
    $("fill-missing").hidden=state.settings.mode==="ai";
    $("fill-missing").disabled=state.settings.textMode==="none";
    $("ai-reset-text").hidden=state.settings.mode!=="ai";
    $("ai-reset-text").disabled=state.settings.textMode==="none";
    const scene=$("scene");scene.disabled=state.settings.mode==="manual";
    $("scene-review-note").hidden=state.settings.scene!=="job_temple";
    if(scene.options.length)scene.options[0].disabled=state.settings.mode==="preset";
    const noText=state.settings.textMode==="none";
    document.querySelector(".text-settings").hidden=noText;
  }
  // 情境／職業下拉：依分組顯示，輸入關鍵字即時篩選（名稱、分組、同義詞）；目前選中的項目永遠保留。
  function fillScenes(query) {
    const select=$("scene"),q=query.trim().toLowerCase(),groups=new Map();let hit=0;
    select.replaceChildren();
    for(const [id,x] of Object.entries(D.scenes)){
      const text=(x.label+" "+(x.group||"")+" "+(x.kw||"")).toLowerCase();
      if(id!=="auto"&&id!==state.settings.scene&&q&&!text.includes(q))continue;
      if(id!=="auto"&&q&&text.includes(q))hit++;
      const key=id==="auto"?"":x.group;
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push([id,x.label]);
    }
    for(const [group,list] of groups){
      let parent=select;
      if(group){parent=document.createElement("optgroup");parent.label=group;select.append(parent);}
      list.forEach(([id,label])=>parent.append(new Option(label,id)));
    }
    select.value=state.settings.scene;
    $("scene-search-status").textContent=q?(hit?"找到 "+hit+" 個符合的項目，請從下拉選單選擇。":"找不到符合的職業或情境，可改用「AI 自由發想」。"):"";
    const first=select.options[0];if(first)first.disabled=state.settings.mode==="preset";
  }
  // 找不到結果時，經勾選同意，才把搜尋字詞匿名回報（停止輸入 1.5 秒後、同一字詞每次開啟頁面只送一次）。
  let missTimer=0;const reported=new Set();
  function scheduleMiss(query){
    clearTimeout(missTimer);const q=query.trim().toLowerCase();
    const none=q&&$("scene-search-status").textContent.startsWith("找不到");
    $("scene-miss").hidden=!(none&&aiEndpoint);
    if(!none||!aiEndpoint||!$("scene-miss-consent").checked||reported.has(q))return;
    missTimer=setTimeout(()=>{if(reported.has(q))return;reported.add(q);AI.reportMiss(aiEndpoint,q);},1500);
  }
  $("scene-search").addEventListener("input",()=>{fillScenes($("scene-search").value);scheduleMiss($("scene-search").value);});
  $("scene-miss-consent").addEventListener("change",()=>scheduleMiss($("scene-search").value));
  function controls() {
    document.querySelectorAll("[data-setting]").forEach(el=>{
      const key=el.dataset.setting;
      if(el.tagName==="SELECT"&&!el.options.length){
        if(key==="scene")fillScenes("");
        else{
          const options=key==="count"?D.counts.map(x=>[x,x+" 張"]):D.options[key];
          options.forEach(([value,text])=>el.add(new Option(text,value)));
        }
      }
      if(key==="scene"&&el.options.length&&![...el.options].some(o=>o.value===state.settings.scene))fillScenes($("scene-search").value);
      el.value=state.settings[key];
      if(el.tagName==="TEXTAREA") el.placeholder=el.id==="character"?"例如：戴圓框眼鏡、短捲髮，笑起來很親切的角色":el.id==="customStyle"?"描述你希望的線條、材質與配色":"";
      el.setAttribute("aria-describedby","error-"+key);
    });
    conditions();
  }
  // 角色設計器：隨機搭配與全部清除（隨機只發生在這個按鈕，提示詞組裝本身不使用亂數，同設定結果固定）。
  function applyDesign(values) {
    D.design.forEach(([key])=>{state.settings[key]=values[key]||"";});
    controls();invalidate();save();if(step===4){summary();renderMulti();}
  }
  $("design-random").addEventListener("click",()=>{
    const values={};
    D.design.forEach(([key,,scope])=>{
      if(scope==="human"&&state.settings.kind!=="human")return;
      const choices=D.options[key].filter(x=>x[0]);values[key]=choices[Math.floor(Math.random()*choices.length)][0];
    });
    applyDesign(values);status("已隨機搭配一組角色設計；不滿意可再按一次，或逐項修改。");
  });
  $("design-clear").addEventListener("click",()=>{applyDesign({});status("已清除角色設計，改由 AI 決定。");});
  function inputControl(tag,id,value,callback) {
    const el=node(tag);el.id=id;
    if(tag==="textarea"){el.rows=2;el.maxLength=300;}
    el.value=value;el.addEventListener("input",()=>callback(el.value));
    return el;
  }
  function rowField(parent,title,input) { const wrap=node("label",undefined,"field");wrap.htmlFor=input.id;wrap.append(node("span",title),input);parent.append(wrap); }
  function renderItems() {
    const box=$("items");box.replaceChildren();
    if(!state.items.some(x=>C.hasText(state,x)&&x.text.trim()))$("content-update-notice").hidden=true;
    $("trim-items").hidden=state.items.length<=state.settings.count;
    state.items.forEach((entry,i)=>{
      const card=node("article",undefined,"sticker-item");
      if(i>=state.settings.count)card.classList.add("overflow-item");
      const head=node("div",undefined,"item-heading");
      head.append(node("h3","貼圖 "+(i+1)+(i>=state.settings.count?"・超出所選張數":"")));
      const del=node("button","刪除","button small");del.type="button";del.setAttribute("aria-label","刪除第 "+(i+1)+" 張內容");
      del.addEventListener("click",()=>{
        if((entry.text||entry.emotion||entry.action)&&!confirm("刪除第 "+(i+1)+" 張內容？其他內容會保留並接續編號。"))return;
        state.items.splice(i,1);renderItems();invalidate();
      });
      head.append(del);card.append(head);
      const fields=node("div",undefined,"field-grid");
      const text=inputControl("textarea","item-"+i+"-text",entry.text,value=>{entry.text=value;delete entry.presetText;invalidate();});
      const printing=C.hasText(state,entry);
      if(state.settings.mode==="ai")text.placeholder=printing?"留白交給 AI 創作，不會自動填入預設台詞":"情境可留白，由 AI 發揮";
      const textLabel=node("label",undefined,"field full-width");textLabel.htmlFor=text.id;textLabel.append(node("span",printing?"台詞（選填）":"情境描述（不印字，選填）"),text);
      textLabel.append(node("span",undefined,"field-error"));textLabel.lastChild.id="error-item-"+i+"-text";text.setAttribute("aria-describedby",textLabel.lastChild.id);
      fields.append(textLabel);
      if(state.settings.textMode==="per"){
        const lab=node("label",undefined,"check-field");const check=node("input");check.type="checkbox";check.checked=entry.hasText;check.id="item-"+i+"-hasText";
        check.addEventListener("change",()=>{
          if(check.checked&&entry.text.trim()&&!confirm("這張目前的內容是「不印字的情境描述」，勾選後會變成要印在貼圖上的文字；是否繼續？")){check.checked=false;return;}
          entry.hasText=check.checked;renderItems();invalidate();
        });
        lab.append(check,node("span","這張顯示文字"));fields.append(lab);
      }
      if(state.settings.nameMode!=="none"&&C.hasText(state,entry)){
        const lab=node("label",undefined,"check-field"),check=node("input");check.type="checkbox";check.checked=entry.includeName;check.id="item-"+i+"-includeName";
        check.addEventListener("change",()=>{entry.includeName=check.checked;invalidate();});
        lab.append(check,node("span","加入共用"+(state.settings.nameMode==="person"?"人名":"店名")));fields.append(lab);
      }
      rowField(fields,"表情（選填）",inputControl("textarea","item-"+i+"-emotion",entry.emotion,value=>{entry.emotion=value;invalidate();}));
      rowField(fields,"動作／道具（選填）",inputControl("textarea","item-"+i+"-action",entry.action,value=>{entry.action=value;invalidate();}));
      card.append(fields);box.append(card);
    });
    $("items-count").textContent=state.items.length+" 筆內容／預計 "+state.settings.count+" 張";
  }
  function renderGrids() {
    const box=$("grids");box.replaceChildren();
    C.plans(state).forEach((p,i)=>{
      const card=node("div",undefined,"grid-card"),title=node("strong","母圖 "+p.number);
      const select=node("select");select.id="grid-"+i;select.setAttribute("aria-label","母圖 "+p.number+" 網格");
      select.add(new Option("4×2・8 張",8));select.add(new Option("4×4・16 張",16));select.value=p.size;
      select.disabled=state.settings.layoutMode==="auto";
      select.addEventListener("change",()=>{state.grids[i]=Number(select.value);renderGrids();invalidate();});
      const range=node("span","貼圖 "+p.start+"～"+p.end,"field-hint");
      const del=node("button","移除","button small");del.type="button";del.disabled=state.settings.layoutMode==="auto";
      del.addEventListener("click",()=>{state.grids.splice(i,1);renderGrids();invalidate();});
      card.append(title,select,range,del);box.append(card);
    });
    const total=state.grids.reduce((a,b)=>a+b,0),need=state.settings.count;
    $("grid-total").textContent="母圖合計 "+total+"／"+need+" 格"+(total===need?"。":"，與整組張數不符；請調整母圖格數，或新增／移除母圖。");
  }
  function live() {
    window.StickerCropPlan={count:state.settings.count,grids:state.grids.slice()};
    // 生成後 QA 用：每張應印的文字。另外提供而不放進 StickerCropPlan，避免改台詞就讓已裁切的結果失效。
    window.StickerExpectedTexts=()=>state.items.slice(0,state.settings.count).map(x=>C.hasText(state,x)?(C.finalText(state,x)||"（未指定，由 AI 發想）"):"");
    window.dispatchEvent(new Event("sticker-crop-plan"));
  }
  function summary() {
    const box=$("summary");box.replaceChildren();
    if(!$("content-update-notice").hidden)box.append(node("p",$("content-update-notice").textContent,"notice"));
    const s=state.settings;
    const blanks=state.items.slice(0,s.count).filter(x=>C.hasText(state,x)&&!x.text.trim()).length;
    if(blanks)box.append(node("p","還有 "+blanks+" 張台詞沒填：提示詞會寫成「由生圖平台依情境設計」。"+(aiEndpoint?"想先用網站 AI 設計，請回第二步按「AI 安排台詞、表情與動作」。":"")+"也可以直接交給生圖平台發想。","notice"));
    const info=node("dl",undefined,"summary-info");
    const entries=[
      ["角色",C.label("source",s.source)+(s.source==="original"?"・"+C.label("kind",s.kind):"")],
      ["角色描述",s.character.trim()||(s.source==="photo"?"依參考圖辨識":"由 AI 設計")],...(C.characterDesign(s,true)?[["角色設計",C.characterDesign(s,true)]]:[]),["呈現方式",C.label("dimension",s.dimension).split("：")[0].replace("（預設）","")],["角色風格",(s.style==="custom"&&!s.customStyle.trim()?"由 AI 搭配":C.label("style",s.style))+(s.customStyle?"・"+s.customStyle:"")],
      ["台詞模式",C.label("mode",s.mode)+"・"+C.label("textMode",s.textMode)],["情境與語氣",(s.scene==="auto"?"AI 自由發想":D.scenes[s.scene].label)+"／"+C.label("tone",s.tone).split("：")[0]],
      ["共用名稱",s.nameMode==="none"||!s.name.trim()?"不加入":C.label("nameMode",s.nameMode)+"："+s.name],
      ["字體與大小",(s.font==="custom"?(s.customFont.trim()||"由 AI 搭配"):C.label("font",s.font))+"／"+C.label("size",s.size)],
      ["文字顏色",s.textColor==="custom"?s.textCustom:C.label("textColor",s.textColor)],
      ["文字位置",C.label("position",s.position)],
      ["描邊",C.label("stroke",s.stroke)+"／"+(s.strokeColor==="custom"?s.strokeCustom:C.label("strokeColor",s.strokeColor))],
      ["陰影",C.label("shadow",s.shadow)+"／"+(s.shadowColor==="custom"?s.shadowCustom:C.label("shadowColor",s.shadowColor))],
      ["背景",C.label("background",s.background)+(s.background==="color"?" "+s.backgroundColor:"")],
      ["母圖",state.grids.map(x=>x===16?"4×4":"4×2").join(" ＋ ")+"；共 "+s.count+" 張貼圖"]
    ];
    if(s.source==="photo")entries.push(["參考圖",referenceUrl?"本機已預覽；請將同一張圖附到 AI 對話。":"尚未在本頁選圖；請在 AI 對話附上參考圖。"]);
    entries.forEach(([key,value])=>info.append(node("dt",key),node("dd",value)));box.append(info);
    const details=node("details",undefined,"summary-details");details.open=true;details.append(node("summary","貼圖企劃表：逐張內容與排列順序"));
    const list=node("ol",undefined,"summary-items");
    C.plans(state).forEach(p=>{
      const group=node("li");
      group.append(node("h3","母圖 "+p.number+"・4×"+p.rows));
      const table=node("table",undefined,"summary-table"),head=node("thead"),hr=node("tr");
      ["位置","要印的文字","表情","動作"].forEach(x=>hr.append(node("th",x)));
      head.append(hr);table.append(head);const body=node("tbody");
      for(let i=p.start-1;i<p.end;i++){
        const entry=state.items[i],row=node("tr"),n=i-p.start+1;
        ["第 "+(Math.floor(n/4)+1)+" 列 第 "+(n%4+1)+" 欄",C.hasText(state,entry)?(entry.text.trim()?C.finalText(state,entry):"由 AI 依情境設計台詞"):"無文字"+(entry.text?"（情境："+entry.text+"）":""),entry.emotion||"AI 發揮",entry.action||"AI 發揮"].forEach(x=>row.append(node("td",x)));
        body.append(row);
      }
      table.append(body);const scroll=node("div",undefined,"table-scroll");scroll.append(table);group.append(scroll);list.append(group);
    });
    details.append(list);box.append(details);
  }
  function errors(list) {
    $("validation").hidden=!list.length;
    $("validation").textContent=list.map(x=>x.message).join(" ");
    document.querySelectorAll(".field-error").forEach(e=>e.textContent="");
    for(const err of list){
      const msg=$("error-"+err.field);if(msg)msg.textContent=err.message;
      const input=$(err.field);if(input)input.setAttribute("aria-invalid","true");
    }
    if(list.length){$("validation").scrollIntoView({block:"center"});const first=$(list[0].field);if(first&&!first.closest("[hidden]"))first.focus();}
    return !list.length;
  }
  // 職業／主題情境預設只有 16 句：超過的格子留白，由 AI 依情境發想（不再用通用句補滿）。
  const shortNote=()=>{const n=C.presetShortfall(state);return n?"這個情境預設只有 "+D.scenes[state.settings.scene].lines.length+" 句，另外 "+n+" 格留白，會由 AI 依「"+D.scenes[state.settings.scene].label+"」情境設計台詞；也可以按第四步的「讓 AI 幫我補齊台詞」先排好。":"";};
  function go(target) {
    if(target>step){
      if(state.settings.mode==="preset"){C.fillMissing(state);renderItems();}
      if(!errors(C.validate(state,target-1)))return;
      if(target>=4&&shortNote())status(shortNote());
    }
    step=target;
    document.querySelectorAll("[data-panel]").forEach(el=>el.hidden=Number(el.dataset.panel)!==step);
    document.querySelectorAll("[data-step]").forEach(el=>{
      if(Number(el.dataset.step)===step)el.setAttribute("aria-current","step");else el.removeAttribute("aria-current");
    });
    $("previous").disabled=step===1;$("next").hidden=step===4;
    $("step-counter").textContent=step+"／4";
    if(step===4){summary();renderMulti();}
    $("title-"+step).focus();save();
  }
  function replaceItems(items,message) {
    if(state.items.some(x=>x.text||x.emotion||x.action)&&!confirm(message+"目前逐張內容會被取代；是否繼續？"))return;
    $("content-update-notice").hidden=true;state.items=items;renderItems();invalidate();status("已套用；請逐張確認內容。");
  }
  document.querySelectorAll("[data-setting]").forEach(el=>el.addEventListener(el.tagName==="SELECT"||el.type==="color"?"change":"input",()=>{
    const key=el.dataset.setting,previous=state.settings[key];
    if((key==="dimension"||key==="platform")&&previous===el.value)return;
    if(key==="textMode"){
      const printing=(mode,x)=>mode==="all"||(mode==="per"&&x.hasText);
      const moved=state.items.filter(x=>x.text.trim()&&!printing(previous,x)&&printing(el.value,x)).length;
      if(moved&&!confirm("有 "+moved+" 張的內容原本是「不印字的情境描述」，切換後會變成要印在貼圖上的文字；是否繼續？")){el.value=previous;return;}
    }
    state.settings[key]=key==="count"?Number(el.value):el.value;
    if(key==="platform"||key==="dimension"){
      copyLabel();live();
      if(generated){
        try{$("prompt-output").value=currentPrompt();$("copy-feedback").textContent="";status(key==="platform"?"已改用「"+C.label("platform",el.value)+"」版本，提示詞已更新，請重新複製。":"已改為「"+C.label("dimension",el.value).split("：")[0]+"」，提示詞已更新，請重新複製。");}
        catch{invalidate();return;}
      }
      save();if(step===4){summary();renderMulti();}return;
    }
    if(key==="count"){
      const before=state.items.length;C.resize(state,Number(el.value));renderItems();renderGrids();controls();
      if(state.items.length<before)status("已移除 "+(before-state.items.length)+" 筆多餘的空白項目。");
    }
    if(key==="mode"){
      if(el.value==="ai"){const n=C.releasePreset(state);status(n?"已釋放 "+n+" 句系統預設台詞，改由 AI 發揮；自行修改的台詞保留。":"已改為 AI 發揮。已有內容保留；想重新創作可按「將台詞、表情與動作交給 AI 重新創作」。");}
      if(el.value==="preset"&&state.settings.scene==="auto"){state.settings.scene="greeting";fillScenes($("scene-search").value);}
      renderItems();
    }
    if(key==="layoutMode"){if(el.value==="auto")state.grids=C.autoGrids(state.settings.count);renderGrids();}
    if(["textMode","nameMode"].includes(key))renderItems();
    if(key==="series"&&state.settings.mode==="preset"){const n=C.releasePreset(state),filled=C.fillMissing(state);renderItems();status("已改為第 "+el.value+" 篇：換掉 "+n+" 句系統預設台詞，補入 "+filled+" 句新的；自行修改的台詞保留。"+shortNote());}
    if(key==="style"&&el.value==="goat"&&state.settings.scene!=="job_newyear"&&state.settings.mode!=="manual"){state.settings.scene="job_newyear";fillScenes($("scene-search").value);if(state.settings.mode==="preset")C.fillMissing(state);renderItems();status("已選羊年賀歲特輯：台詞情境已自動改為「新年過年」；特輯規定不可含姓名或暱稱，且至少 8 張要和羊年或過年有關。");}
    if(key==="scene"&&state.settings.mode==="preset"){const filled=C.fillMissing(state);renderItems();if(filled||shortNote())status((filled?"已補入 "+filled+" 句；原有台詞未改動。":"")+shortNote());}
    if(key==="source"&&el.value!=="photo")clearReference();
    conditions();invalidate();
    if(key==='mode'&&!$('content-update-notice').hidden)refreshContentNotice($('content-update-notice').dataset.subject||'設定');
    if(['style','customStyle','character','scene','tone'].includes(key)&&previous!==el.value&&state.items.some(x=>C.hasText(state,x)&&x.text.trim())){
      const title={style:'角色風格',customStyle:'風格描述',character:'角色描述',scene:'情境',tone:'台詞語氣'}[key];
      refreshContentNotice(title);
    }
  }));
  for(const id of ['dimension','platform'])$(id).addEventListener('input',()=>$(id).dispatchEvent(new Event('change',{bubbles:true})));
  $("settings-form").addEventListener("submit",e=>e.preventDefault());
  document.querySelectorAll("[data-step]").forEach(el=>el.addEventListener("click",()=>go(Number(el.dataset.step))));
  $("previous").addEventListener("click",()=>go(step-1));$("next").addEventListener("click",()=>go(step+1));
  $("apply-scene").addEventListener("click",()=>replaceItems(C.presetCandidates(state,new Set()).slice(0,state.settings.count).map(C.presetItem),"套用「"+D.scenes[state.settings.scene].label+"」。"));
  $("ai-reset-text").addEventListener("click",()=>{
    if(state.settings.mode!=="ai"||state.settings.textMode==="none")return;
    const rows=state.items.slice(0,state.settings.count),targets=rows.filter(x=>C.hasText(state,x));
    if(rows.some(x=>x.text.trim()||x.emotion.trim()||x.action.trim())&&!confirm("將這一組的台詞、表情與動作／道具全部清空，交給 AI 重新創作？包含自行輸入或先前 AI 的內容。角色設定、無文字格的情境說明與共用名稱保留。"))return;
    targets.forEach(x=>{x.text="";delete x.presetText;});rows.forEach(x=>{x.emotion="";x.action="";});aiOrigin={};renderItems();invalidate();status("台詞、表情與動作已清空，改由 AI 重新發揮。可用網站 AI 先安排，或直接產生提示詞交給生圖平台；不會自動送出 AI 請求。");
  });
  $("prev-capture").addEventListener("click",()=>{
    const lines=[];state.items.slice(0,state.settings.count).forEach(x=>{const t=C.hasText(state,x)?x.text.trim():"";if(t)lines.push(t);});
    if(!lines.length){$("prev-capture-note").textContent="目前沒有台詞可記錄。";return;}
    const merged=[...new Set([...C.usedBefore(state.settings),...lines])];let text="";
    for(const x of merged){const next=text?text+"\n"+x:x;if(next.length>1000)break;text=next;}
    state.settings.prevUsed=text;$("prevUsed").value=text;invalidate();save();
    $("prev-capture-note").textContent="已記下 "+text.split("\n").length+" 句。接著可以把「第幾篇」改成下一篇，再清空或換新台詞。";
  });
  $("fill-missing").addEventListener("click",()=>{const n=C.fillMissing(state);renderItems();invalidate();status((n?"已補入 "+n+" 句，請確認或修改。":"目前沒有可補的文字空缺；無文字格子不補台詞。")+shortNote());});
  $("apply-bulk").addEventListener("click",()=>{
    const lines=$("bulk").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)return status("請先貼上台詞。");
    if(lines.length>80||lines.some(x=>x.length>300))return status("清單最多 80 筆，每筆最多 300 字；請先縮短內容。");
    const items=lines.map(C.item);while(items.length<state.settings.count)items.push(C.item());
    replaceItems(items,"套用貼上的台詞清單。");
  });
  $("trim-items").addEventListener("click",()=>{
    const extra=state.items.slice(state.settings.count);if(!extra.length)return;
    if(extra.some(x=>!C.blank(x))&&!confirm("將刪除第 "+(state.settings.count+1)+" 筆之後共 "+extra.length+" 筆內容，其中有已填寫的文字；是否繼續？"))return;
    state.items.length=state.settings.count;renderItems();invalidate();status("已刪除超出張數的 "+extra.length+" 筆內容。");
  });
  $("add-item").addEventListener("click",()=>{if(state.items.length>=80)return status("最多保留 80 筆內容，請先刪減。");state.items.push(C.item());renderItems();invalidate();});
  $("add-grid").addEventListener("click",()=>{if(state.grids.length>=5)return status("最多 5 張母圖。");state.grids.push(8);renderGrids();invalidate();});
  // 內容防護：產生提示詞前檢查使用者內容。明確違規就暫停並請使用者自行修改；需確認的照原文產生並列出提醒。網站不替使用者改字。
  function renderGuard(result){
    const box=$("guard-result");box.replaceChildren();
    if(!G||result.status===G.SAFE){box.hidden=true;return;}
    const blocked=result.status===G.BLOCKED,seen=new Set(),list=node("ul");
    [...result.findings].sort((a,b)=>(a.level===G.BLOCKED?0:1)-(b.level===G.BLOCKED?0:1)).forEach(f=>{
      const key=f.where+"|"+f.label;if(seen.has(key))return;seen.add(key);
      list.append(node("li",(f.level===G.BLOCKED?"【需修改】":"【請確認】")+f.where+"「"+f.term+"」："+f.label+"（"+f.clause+"）。建議："+f.suggest+(f.source==="preset"?"（這句來自預設句庫）":"")));
    });
    box.className="notice guard-result"+(blocked?" error-notice":"");
    box.append(node("p",blocked?"有內容明顯不符合 LINE 規範，已暫停產生提示詞。請自行修改下列標示「需修改」的內容（網站不會替你改字）：":"下列內容可能涉及 LINE 審核裁量，已照原文產生提示詞；要不要調整由你決定："),list,node("p","此檢查只比對字面，可能漏判或誤判，不保證通過 LINE 審核。"));
    box.hidden=false;
  }
  function guardCheck(){const result=G?G.checkBeforeGeneration(state):{status:"SAFE",findings:[]};renderGuard(result);return result;}
  $("generate").addEventListener("click",()=>{
    if(!errors(C.validate(state)))return;
    if(guardCheck().status===G?.BLOCKED){$("prompt-area").hidden=true;generated=false;status("有內容需要修改，請看上方紅色清單。");$("guard-result").scrollIntoView({block:"center"});return;}
    $("reference-handoff").hidden=state.settings.source!=="photo";$("prompt-output").value=currentPrompt();$("prompt-area").hidden=false;generated=true;copyLabel();
    status("已產生整組提示詞；請核對內容後複製。");
  });
  // 一張母圖（8／16 張）也比照多張母圖：按一下就複製並打開所選平台的網頁。
  function currentPrompt(only){
    const value=$('dimension').value;
    if(D.options.dimension.some(([id])=>id===value)&&value!==state.settings.dimension){
      state.settings.dimension=value;save();if(step===4)summary();
    }
    if(guardCheck().status===G?.BLOCKED)throw new Error("有內容不符合 LINE 規範，請先依「確認摘要並產生提示詞」上方的紅色清單修改。");
    return C.prompt(state,only);
  }
  function copyLabel(){const info=platformInfo();$("copy").textContent=info.name?"複製提示詞，並打開 "+info.name:"複製整組提示詞";}
  $("copy").addEventListener("click",async()=>{
    if(!generated)return;
    try{$('prompt-output').value=currentPrompt();}catch(error){status(error.message);return;}
    const info=platformInfo();
    if(info.url)window.open(info.url,"_blank","noopener");
    try{await navigator.clipboard.writeText($("prompt-output").value);$("copy-feedback").textContent=info.url?"✔ 已複製提示詞，並幫你打開 "+info.name+"。請到那個網頁，點一下訊息輸入框，按 Ctrl+V 貼上（Mac 按 Command+V；手機長按輸入框再選「貼上」）。":"已複製整組提示詞，可貼到選用的 AI 平台。";}
    catch{$("prompt-output").focus();$("prompt-output").select();$("copy-feedback").textContent="瀏覽器無法使用剪貼簿；已選取提示詞，請手動複製。";}
  });
  $("save-local").addEventListener("change",()=>{
    saveEnabled=$("save-local").checked;
    if(saveEnabled)save();else{
      try{localStorage.removeItem(storageKey);$("save-status").textContent="已移除瀏覽器草稿；目前頁面設定保留。";}
      catch{$("save-status").textContent="無法移除瀏覽器草稿，請至瀏覽器網站資料設定清除。";}
    }
  });
  $("clear").addEventListener("click",()=>{
    if(!confirm("只清除這個工具的瀏覽器草稿？目前頁面內容與其他網站資料會保留。"))return;
    try{localStorage.removeItem(storageKey);saveEnabled=false;$("save-local").checked=false;$("save-status").textContent="瀏覽器草稿已清除，目前頁面內容保留。";}
    catch{$("save-status").textContent="無法清除；請至瀏覽器網站資料設定處理。";}
  });
  $("reset-all").addEventListener("click",()=>{
    if(!confirm("清除全部設定並重新開始？角色、台詞、參考圖、母圖、裁切／修圖進度與本工具的瀏覽器草稿都會清除；電腦上的原始圖片與已下載檔案不受影響。"))return;
    try{localStorage.removeItem(storageKey);}
    catch{status("無法清除瀏覽器草稿，尚未重新開始。請先匯出設定，或到瀏覽器的網站資料設定處理後再試。");return;}
    clearAI();clearTimeout(missTimer);saveEnabled=false;
    clearReference();document.querySelectorAll("form").forEach(form=>form.reset());
    // 頁底儲存區與裁切區不在表單內，也要清掉瀏覽器可能在重新載入時還原的欄位值。
    document.querySelectorAll("input,textarea,select").forEach(control=>{
      if(control.tagName==="SELECT"){control.selectedIndex=0;for(const option of control.options)if(option.defaultSelected)option.selected=true;}
      else if(control.type==="checkbox"||control.type==="radio")control.checked=control.defaultChecked;
      else control.value=control.type==="file"?"":control.defaultValue;
    });
    // 重新建立頁面以釋放圖片、裁切、修圖與下載快取，也使尚未完成的操作無法套回新設定。
    try{history.replaceState(null,"",location.pathname+location.search);}catch{}
    window.scrollTo(0,0);location.reload();
  });
  $("export").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify(C.serialize(state),null,2)+"\n"],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=node("a");a.href=url;a.download="line-sticker-settings.json";
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status("已匯出文字設定，不含照片。");
  });
  $("import").addEventListener("click",()=>$("import-file").click());
  $("import-file").addEventListener("change",async()=>{
    const file=$("import-file").files[0];$("import-file").value="";if(!file)return;
    try{
      if(file.size>250000)throw new Error("設定檔超過 250 KB。");
      const incoming=C.deserialize(await file.text());
      if(!confirm("匯入將取代目前頁面的設定。是否繼續？"))return;
      clearReference();hideApplied();state=incoming;$("content-update-notice").hidden=true;controls();renderItems();renderGrids();invalidate();step=1;go(1);status("已匯入設定；請重新檢查摘要。");
    }catch(error){status("匯入失敗，原有內容保留："+error.message);}
  });
  try{
    const raw=localStorage.getItem(storageKey);
    if(raw){state=C.deserialize(raw);saveEnabled=true;$("save-local").checked=true;$("save-status").textContent="已載入這個瀏覽器的草稿。";}
  }catch{$("save-status").textContent="瀏覽器草稿無法讀取，未套用；可匯入有效設定檔。";}
  function aiAvailability() {
    $("ai-arrange").disabled=!aiEndpoint||!$("ai-consent").checked||!!aiController;
    $("ai-cancel").hidden=!aiController;
    $("ai-arrange").textContent=aiController?"AI 安排中…":"AI 安排台詞、表情與動作";
  }
  function clearAI(message) {
    const hadWork=!!aiController;
    aiRevision++;
    if(aiController)aiController.abort();
    aiController=null;
    if(hadWork&&message)$("ai-status").textContent=message;
    aiAvailability();
  }
  function hideApplied() {aiApplied=null;$("ai-preview").hidden=true;$("ai-preview-body").replaceChildren();}
  function showApplied(result) {
    const body=$("ai-preview-body");body.replaceChildren();
    state.items.slice(0,state.settings.count).forEach((entry,i)=>{
      const printing=C.hasText(state,entry),shown=printing?entry.text:(entry.text?"無文字（情境："+entry.text+"）":"無文字");
      const row=node("tr");[String(i+1),shown,entry.emotion,entry.action].forEach(value=>row.append(node("td",value)));body.append(row);
    });
    aiApplied={changes:result.changes};$("ai-preview").hidden=false;
    const skipped=(result.skipped||[]).map(x=>x.index+1).filter((n,i,a)=>a.indexOf(n)===i);
    $("ai-status").textContent="AI 已補入 "+result.filled+" 個空白欄位，原有內容未更動；提示詞會直接使用這些內容。可在下方逐張修改，或按「復原這次補入」。"+(skipped.length?"第 "+skipped.join("、")+" 張的 AI 建議可能不符合 LINE 規範，已略過並保持空白；可再按一次讓 AI 重新安排，或自行填寫。":"");
    status("已套用 AI 內容；尚未生成圖片。");
  }
  $("ai-consent").addEventListener("change",()=>{if(!$("ai-consent").checked)clearAI("已取消同意，已中止等待。");aiAvailability();});
  $("ai-cancel").addEventListener("click",()=>clearAI("已取消等待，原有內容保留；已送出的服務端請求可能仍會計入額度。"));
  $("ai-discard").addEventListener("click",()=>{hideApplied();$("ai-status").textContent="已關閉補入清單；補入的內容仍保留，可在逐張欄位修改。";});
  $("ai-undo").addEventListener("click",()=>{
    if(!aiApplied)return;
    const restored=AI.undo(state,aiApplied.changes);hideApplied();renderItems();invalidate();
    $("ai-status").textContent="已復原 "+restored+" 個 AI 補入的欄位；你之後自己改過的欄位不受影響。";
  });
  async function runArrange() {
    if(!aiEndpoint||!$("ai-consent").checked||aiController)return;
    let input,cleared=[];
    try{input=AI.payload(state);}catch(error){$("ai-status").textContent=error.message;return;}
    const hasBlank=input.items.some(x=>!x.emotion.trim()||!x.action.trim()||(x.hasText&&!x.text.trim()));
    if(!hasBlank){$("ai-status").textContent="目前沒有空白欄位；如要新的建議，請先清空想重新安排的欄位。";return;}
    clearAI();hideApplied();
    cleared=AI.regroup(state,aiOrigin);if(cleared.length){renderItems();invalidate();try{input=AI.payload(state);}catch(error){AI.restore(state,cleared);renderItems();invalidate();$("ai-status").textContent=error.message;return;}}
    const revision=aiRevision,snapshot=JSON.stringify(C.serialize(state)),controller=new AbortController();
    aiController=controller;aiAvailability();$("ai-status").textContent="正在安排逐張內容，完成後會自動補入空白欄位。";
    const timer=setTimeout(()=>controller.abort(),65000);
    try{
      const rows=await AI.request(aiEndpoint,input,controller.signal);
      if(revision!==aiRevision)return;
      if(snapshot!==JSON.stringify(C.serialize(state))){clearAI("設定已變更，請重新安排。");return;}
      let result;
      try{result=AI.applyDetailed(state,rows);}catch(error){AI.restore(state,cleared);renderItems();invalidate();$("ai-status").textContent=error.message;return;}
      result.changes.forEach(c=>{(aiOrigin[c.index]=aiOrigin[c.index]||{})[c.key]=c.value;});
      aiController=null;renderItems();invalidate();showApplied(result);
    }catch(error){
      if(revision===aiRevision){AI.restore(state,cleared);renderItems();invalidate();}
      if(revision===aiRevision)$("ai-status").textContent=controller.signal.aborted?"等待逾時，原有內容保留，請稍後再試。":error instanceof TypeError?"無法連上網站 AI，仍可手動設定；請稍後再試。":error.message;
    }finally{clearTimeout(timer);if(revision===aiRevision){aiController=null;aiAvailability();}}
  }
  $("ai-arrange").addEventListener("click",runArrange);

  // ---- 多張母圖：逐張引導（一組貼圖要用到兩張以上母圖時才出現）----
  let showSingle=false;
  const crop=()=>window.StickerCrop;
  function platformInfo() {const p=state.settings.platform;return p==="chatgpt"?{name:"ChatGPT",url:"https://chatgpt.com/"}:p==="gemini"?{name:"Gemini",url:"https://gemini.google.com/app"}:{name:"",url:""};}
  const pasteHint="點一下訊息輸入框，按 Ctrl+V 貼上（Mac 按 Command+V；手機長按輸入框再選「貼上」）。";
  // 防呆：母圖 2 起，要先附上前面所有母圖（同一份圖片才算數；前面的母圖換圖後要重新附上），提示詞才可以複製。
  const attached=new Map(),notes=new Map();
  const prevSig=n=>n>1&&crop()&&crop().count()>=n-1?crop().sig(n-1):"";
  const prevAttached=n=>n<=1||(!!prevSig(n)&&attached.get(n)===prevSig(n));
  const prevNames=n=>n>2?"母圖 1～"+(n-1):"母圖 1";
  async function copyAndOpen(n,box) {
    const info=platformInfo(),note=box.querySelector(".copy-note");let text;
    if(!prevAttached(n)){note.textContent="請先完成上一步：附上"+prevNames(n)+" 的圖片，再複製這張的提示詞。";return;}
    try{text=currentPrompt(n);}catch(error){note.textContent=error.message;return;}
    const copying=navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(text):Promise.reject(new Error("no clipboard"));
    if(info.url)window.open(info.url,"_blank","noopener");
    try{await copying;note.textContent="✔ 已複製母圖 "+n+" 的提示詞。"+(info.url?"已幫你打開 "+info.name+"。請到那個網頁，":"請到你的生圖網站，")+pasteHint;}
    catch{const area=box.querySelector(".manual-prompt");area.value=text;area.hidden=false;area.focus();area.select();note.textContent="這個瀏覽器不讓我自動複製。下面的框已選好全部文字，請按 Ctrl+C 複製，再到生圖網站貼上。";}
  }
  async function copyReference(n) {
    const sig=prevSig(n),names=prevNames(n);if(!sig)return;
    try{await crop().copyImages(n-1);attached.set(n,sig);notes.set(n,"✔ 已複製"+names+" 的圖片"+(n>2?"（合併成一張）":"")+"。到生圖網站的輸入框貼上（Ctrl+V，Mac 按 Command+V），圖片出現後再做下一步。照片角色的原始照片也要一起附上。");}
    catch{notes.set(n,"這個瀏覽器不能一鍵複製圖片。請到生圖網站按「＋」或迴紋針，選你存好的"+names+" 檔案，附上後勾選下面的「我已附上」。");}
    renderMulti();
  }
  async function aiFromStep4(fixDuplicates) {
    if(!aiEndpoint)return;
    if(!$("ai-consent").checked){
      if(!confirm("要把角色描述、風格與台詞（不含照片）傳到 Google Gemini，讓 AI 幫你補齊空白嗎？"))return;
      $("ai-consent").checked=true;aiAvailability();
    }
    if(fixDuplicates==="actions"){C.similarActions(state).forEach(g=>g.indexes.slice(1).forEach(i=>{state.items[i].emotion="";state.items[i].action="";}));renderItems();invalidate();}
    else if(fixDuplicates){(fixDuplicates==="similar"?C.similar(state):C.duplicates(state)).forEach(g=>g.indexes.slice(1).forEach(i=>{state.items[i].text="";delete state.items[i].presetText;}));renderItems();invalidate();}
    $("multi-status").textContent="AI 正在安排台詞，請稍等，約需 10～60 秒…";
    await runArrange();
    $("multi-status").textContent=$("ai-status").textContent;
  }
  function renderAlerts() {
    const box=$("multi-alerts");box.replaceChildren();
    const blanks=state.items.slice(0,state.settings.count).filter(x=>C.hasText(state,x)&&!x.text.trim()).length,dups=C.duplicates(state);
    if(blanks){
      const p=node("div",undefined,"notice mini-alert");
      p.append(node("strong","還有 "+blanks+" 句台詞沒填。"),node("span",aiEndpoint?"建議先讓 AI 一次補齊，這樣每張母圖的字才不會各自亂想、也不會重複。":"沒填的字會交給生圖平台各自發想，不同母圖之間可能重複。"));
      if(aiEndpoint){const b=node("button","讓 AI 幫我補齊台詞","button primary");b.type="button";b.addEventListener("click",()=>aiFromStep4(false));p.append(b);}
      box.append(p);
    }
    const sims=C.similar(state);
    if(sims.length){
      const p=node("div",undefined,"notice mini-alert");
      p.append(node("strong","有 "+sims.length+" 組意思相近的句子：「"+sims.slice(0,3).map(g=>g.text).join("」、「")+"」"+(sims.length>3?"…":"")),node("span",aiEndpoint?"整組貼圖的句子最好用途各不相同；可以讓 AI 把後面那句換成不同意思的。":"建議回第二步改掉其中一句，讓每句的用途都不同。"));
      if(aiEndpoint){const b=node("button","請 AI 換掉相近的","button primary");b.type="button";b.addEventListener("click",()=>aiFromStep4("similar"));p.append(b);}
      box.append(p);
    }
    const acts=C.similarActions(state);
    if(acts.length){
      const p=node("div",undefined,"notice mini-alert");
      p.append(node("strong","有 "+acts.length+" 組動作太像：「"+acts.slice(0,3).map(g=>g.text).join("」、「")+"」"+(acts.length>3?"…":"")),node("span",aiEndpoint?"可以讓 AI 把後面那張的表情與動作換掉，台詞不動。":"建議在逐張欄位改掉其中一個動作。"));
      if(aiEndpoint){const b=node("button","請 AI 換掉相似動作","button primary");b.type="button";b.addEventListener("click",()=>aiFromStep4("actions"));p.append(b);}
      box.append(p);
    }
    if(dups.length){
      const p=node("div",undefined,"notice mini-alert");
      p.append(node("strong","有 "+dups.length+" 句台詞重複："+dups.slice(0,3).map(g=>"「"+g.text+"」").join("、")+(dups.length>3?"…":"")),node("span",aiEndpoint?"可以讓 AI 把重複的換成新的。":"請回第二步改掉重複的句子。"));
      if(aiEndpoint){const b=node("button","請 AI 換掉重複的","button primary");b.type="button";b.addEventListener("click",()=>aiFromStep4(true));p.append(b);}
      box.append(p);
    }
  }
  function renderMulti() {
    const plans=C.plans(state),multi=plans.length>1;
    $("multi-flow").hidden=!multi;$("single-flow").hidden=multi&&!showSingle;
    $("show-single").textContent=showSingle?"收起「整組一次複製」":"改用「整組一次複製」（進階）";
    if(!multi||!crop())return;
    $("multi-count").textContent=String(plans.length);renderAlerts();
    const list=$("mother-steps"),info=platformInfo(),loaded=crop().count();list.replaceChildren();
    plans.forEach((p,i)=>{
      const got=crop().info(i),li=node("li",undefined,"mother-step"+(got?" done":""));
      li.append(node("h4","母圖 "+p.number+"／"+plans.length+"（貼圖 "+p.start+"～"+p.end+"，共 "+p.size+" 格）"));
      let n=1;
      const step=(title,text,button)=>{const d=node("div",undefined,"step");d.append(node("b","第 "+(n++)+" 步："+title));if(text)d.append(node("span",text));if(button)d.append(button);li.append(d);};
      const copy=node("button","複製提示詞"+(info.name?"，並打開 "+info.name:""),"button primary");copy.type="button";copy.addEventListener("click",()=>copyAndOpen(p.number,li));
      if(i===0)step("複製這張的提示詞",(info.name?"按下去會自動複製，並打開 "+info.name+" 的網頁。":"按下去會自動複製，請到你的生圖網站貼上。")+(state.settings.source==="photo"?" 你的角色照片也要在那個網頁一起附上。":""),copy);
      else{
        const names=prevNames(p.number),ready=!!prevSig(p.number),ok=prevAttached(p.number);
        const ref=node("button","複製"+names+" 的圖片"+(p.number>2?"（合併成一張）":""),"button");ref.type="button";ref.disabled=!ready;ref.addEventListener("click",()=>copyReference(p.number));
        step("先附上"+names,ready?"按下面的按鈕複製圖片，到生圖網站的輸入框貼上。AI 會照著畫同一個角色，並避開前面已經用過的台詞。":"請先把"+(p.number>2?"母圖 "+(p.number-1):"母圖 1")+" 做好，並放進它的「把圖放進來」，才能繼續。",ref);
        const lab=node("label",undefined,"check-field"),box=node("input");box.type="checkbox";box.disabled=!ready;box.checked=ok;
        box.addEventListener("change",()=>{if(box.checked&&ready)attached.set(p.number,prevSig(p.number));else attached.delete(p.number);notes.delete(p.number);renderMulti();});
        lab.append(box,node("span","我已在生圖網站的輸入框附上"+names+" 的圖片"));li.lastChild.append(lab);
        copy.disabled=!ok;
        step("再複製這張的提示詞",ok?(info.name?"按下去會自動複製，並打開 "+info.name+" 的網頁；貼在同一個輸入框（圖片後面），一起送出。":"按下去會自動複製；貼在同一個輸入框（圖片後面），一起送出。"):"要先完成上一步（附上"+names+" 的圖片），這個按鈕才會打開。",copy);
      }
      step("送出，等圖做好","做好後把圖存到電腦（點圖片再按下載，或右鍵另存）。");
      const zone=node("label",undefined,"drop-zone"+(got?" done":"")+(i>loaded?" locked":"")),input=node("input");
      input.type="file";input.accept="image/png,image/jpeg,image/webp";input.disabled=i>loaded;input.setAttribute("aria-label","放入母圖 "+p.number+" 的圖片");
      if(got)zone.append(crop().thumb(i,160));
      zone.append(node("span",got?"✔ 已收到："+got.name+"（"+got.width+"×"+got.height+"）。要換圖，把新圖拖進來。":i>loaded?"請先完成母圖 "+i:"把做好的圖拖到這裡，或按這裡選檔案"),input);
      const msg=node("p",undefined,"field-hint");msg.setAttribute("role","alert");
      const take=async file=>{if(!file)return;msg.textContent="";try{await crop().set(i,file);}catch(error){msg.textContent=error.message;}};
      input.addEventListener("change",()=>take(input.files[0]));
      zone.addEventListener("dragover",e=>{if(input.disabled)return;e.preventDefault();zone.classList.add("over");});
      zone.addEventListener("dragleave",()=>zone.classList.remove("over"));
      zone.addEventListener("drop",e=>{e.preventDefault();zone.classList.remove("over");if(!input.disabled)take(e.dataTransfer.files[0]);});
      step("把圖放進來","");li.lastChild.append(zone,msg);
      li.append(node("p",notes.get(p.number)||"","copy-note field-hint"));const area=node("textarea",undefined,"manual-prompt");area.readOnly=true;area.rows=6;area.hidden=true;area.setAttribute("aria-label","提示詞，供手動複製");li.append(area);
      list.append(li);
    });
    const ready=crop().ready();$("to-crop").disabled=!ready;
    $("multi-status").textContent=loaded===plans.length?(ready?"全部母圖都到了！按下面的按鈕，會自動幫你裁好。":"母圖張數都到了，但格數和設定對不上，請到「② 母圖裁切與下載」檢查。"):"已收到 "+loaded+"／"+plans.length+" 張母圖。";
  }
  $("show-single").addEventListener("click",()=>{showSingle=!showSingle;renderMulti();});
  $("to-crop").addEventListener("click",()=>{$("tab-crop").click();$("tab-crop").closest("nav").scrollIntoView({block:"start"});setTimeout(()=>crop().run(),80);});
  window.addEventListener("sticker-mothers-changed",()=>{if(step===4)renderMulti();});
  // 裁切頁發現母圖有圖被切到：不讓使用者選，直接把之後的提示詞改成更寬的格子留白。
  // 裁切頁：母圖格數與設定張數不符時，一鍵把張數改成和母圖一樣（走原本的張數選單流程）。
  window.addEventListener("sticker-set-count",event=>{
    const count=Number(event.detail&&event.detail.count);if(!D.counts.includes(count)||count===state.settings.count)return;
    $("count").value=String(count);$("count").dispatchEvent(new Event("change",{bubbles:true}));
    status("已把張數改成 "+count+" 張（依你放入的母圖）；母圖分配已自動重排。");
  });
  window.addEventListener("sticker-clipped",()=>{
    if(state.settings.spacing==="widest")return;
    state.settings.spacing="widest";renderGrids();
    if(generated){try{$("prompt-output").value=currentPrompt();$("copy-feedback").textContent="";}catch{invalidate();}}
    if(step===4)renderMulti();
    save();status("裁切時發現母圖有圖被切到，已自動把提示詞的格子留白加到最寬（每格 703×608）。請重新複製提示詞，再生成被切到的那張母圖。");
  });
  try{
    aiEndpoint=AI.endpoint(window.StickerAIConfig?.endpoint);
    if(aiEndpoint){$("ai-service-summary").textContent="網站 AI 已設定服務位址，可在第二步嘗試安排內容。";$("ai-status").textContent="勾選同意後可取得 AI 建議；免費額度由網站共用，服務可用性以實際請求為準。";}
  }catch(error){$("ai-status").textContent=error.message+"手動設定仍可使用。";}
  aiAvailability();
  controls();renderItems();renderGrids();live();go(1);$("creator").hidden=false;
})();
