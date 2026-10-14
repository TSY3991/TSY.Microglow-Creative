(function () {
  "use strict";
  const D=window.StickerData,C=window.StickerCore;
  const $=id=>document.getElementById(id);
  const storageKey="microglow:line-sticker-creator:v1";
  let state=C.initial(),step=1,saveEnabled=false,generated=false;
  let referenceUrl="",referenceRevision=0;
  const AI=window.StickerAI;
  let aiEndpoint="",aiController=null,aiPending=null,aiRevision=0;
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
    generated=false;$("confirm-summary").checked=false;$("generate").disabled=true;
    $("prompt-area").hidden=true;$("prompt-output").value="";$("copy-feedback").textContent="";
    $("validation").hidden=true;
    document.querySelectorAll(".field-error").forEach(e=>e.textContent="");
    document.querySelectorAll('[aria-invalid="true"]').forEach(e=>e.removeAttribute("aria-invalid"));
    live();save();
  }
  function conditions() {
    document.querySelectorAll("[data-visible]").forEach(el=>{
      const [key,values]=el.dataset.visible.split(":");
      el.hidden=!values.split(",").includes(String(state.settings[key]));
      el.querySelectorAll("[data-setting]").forEach(control=>control.disabled=el.hidden);
    });
    $("apply-scene").disabled=state.settings.mode!=="preset"||state.settings.textMode==="none";
    $("fill-missing").disabled=state.settings.textMode==="none"||state.settings.mode==="ai";
    $("ai-reset-text").hidden=state.settings.mode!=="ai";
    $("ai-reset-text").disabled=state.settings.textMode==="none";
    const scene=$("scene");scene.disabled=state.settings.mode==="manual";
    if(scene.options.length)scene.options[0].disabled=state.settings.mode==="preset";
    const noText=state.settings.textMode==="none";
    document.querySelector(".text-settings").hidden=noText;
  }
  function controls() {
    document.querySelectorAll("[data-setting]").forEach(el=>{
      const key=el.dataset.setting;
      if(el.tagName==="SELECT"&&!el.options.length){
        const options=key==="scene"?Object.entries(D.scenes).map(([id,x])=>[id,x.label]):key==="count"?D.counts.map(x=>[x,x+" 張"]):D.options[key];
        options.forEach(([value,text])=>el.add(new Option(text,value)));
      }
      el.value=state.settings[key];
      if(el.tagName==="TEXTAREA") el.placeholder=el.id==="character"?"例如：戴圓框眼鏡、短捲髮，笑起來很親切的角色":el.id==="customStyle"?"描述你希望的線條、材質與配色":"";
      el.setAttribute("aria-describedby","error-"+key);
    });
    conditions();
  }
  function inputControl(tag,id,value,callback) {
    const el=node(tag);el.id=id;
    if(tag==="textarea"){el.rows=2;el.maxLength=300;}
    el.value=value;el.addEventListener("input",()=>callback(el.value));
    return el;
  }
  function rowField(parent,title,input) { const wrap=node("label",undefined,"field");wrap.htmlFor=input.id;wrap.append(node("span",title),input);parent.append(wrap); }
  function renderItems() {
    const box=$("items");box.replaceChildren();
    const noText=state.settings.textMode==="none";
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
      if(state.settings.mode==="ai")text.placeholder=noText?"情境可留白，由 AI 發揮":"留白交給 AI 創作，不會自動填入預設台詞";
      text.disabled=!C.hasText(state,entry);
      const textLabel=node("label",undefined,"field full-width");textLabel.htmlFor=text.id;textLabel.append(node("span",noText?"情境描述（不印字，選填）":"台詞（選填）"),text);
      if(noText){text.disabled=false;textLabel.firstChild.textContent="情境描述（不印字，選填）";}
      textLabel.append(node("span",undefined,"field-error"));textLabel.lastChild.id="error-item-"+i+"-text";text.setAttribute("aria-describedby",textLabel.lastChild.id);
      fields.append(textLabel);
      if(state.settings.textMode==="per"){
        const lab=node("label",undefined,"check-field");const check=node("input");check.type="checkbox";check.checked=entry.hasText;check.id="item-"+i+"-hasText";
        check.addEventListener("change",()=>{entry.hasText=check.checked;renderItems();invalidate();});
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
  }
  function live() {
    window.StickerCropPlan={count:state.settings.count,grids:state.grids.slice()};
    window.dispatchEvent(new Event("sticker-crop-plan"));
    const s=state.settings,box=$("live-summary");box.replaceChildren();
    const rows=[["角色來源",s.source?C.label("source",s.source):"尚未選擇"],["角色風格",s.style?C.label("style",s.style):"尚未選擇"],["貼圖總張數",s.count+" 張"],["母圖分配",state.grids.map(x=>x===16?"4×4":"4×2").join(" ＋ ")||"尚未設定"],["文字模式",C.label("textMode",s.textMode)]];
    if(s.source==="photo")rows.push(["參考圖",referenceUrl?"已選擇・需另外附到 AI":"請在 AI 對話附圖"]);
    for(const [title,value]of rows){const row=node("div",undefined,"live-row");row.append(node("span",title),node("strong",value));box.append(row);}
  }
  function summary() {
    const box=$("summary");box.replaceChildren();
    const s=state.settings;
    const info=node("dl",undefined,"summary-info");
    const entries=[
      ["角色",C.label("source",s.source)+(s.source==="original"?"・"+C.label("kind",s.kind):"")],
      ["角色描述",s.character.trim()||(s.source==="photo"?"依參考圖辨識":"由 AI 設計")],["角色風格",(s.style==="custom"&&!s.customStyle.trim()?"由 AI 搭配":C.label("style",s.style))+(s.customStyle?"・"+s.customStyle:"")],
      ["台詞模式",C.label("mode",s.mode)+"・"+C.label("textMode",s.textMode)],
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
    const details=node("details",undefined,"summary-details");details.open=true;details.append(node("summary","逐張內容與排列順序"));
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
  function go(target) {
    if(target>step){
      if(state.settings.mode==="preset"){C.fillMissing(state);renderItems();}
      let issues=C.validate(state,target-1);
      if(target===3&&state.items.length>state.settings.count){
        issues=issues.filter(x=>x.field!=="items");
        status("逐張內容超量：可在母圖設定增加張數，或回上一步刪減。產生提示詞前必須處理完成。");
      }
      if(!errors(issues))return;
    }
    step=target;
    document.querySelectorAll("[data-panel]").forEach(el=>el.hidden=Number(el.dataset.panel)!==step);
    document.querySelectorAll("[data-step]").forEach(el=>{
      if(Number(el.dataset.step)===step)el.setAttribute("aria-current","step");else el.removeAttribute("aria-current");
    });
    $("previous").disabled=step===1;$("next").hidden=step===4;
    $("step-counter").textContent=step+"／4";$("live-step").textContent="步驟 "+step+"／4";
    if(step===4)summary();
    $("title-"+step).focus();save();
  }
  function replaceItems(items,message) {
    if(state.items.some(x=>x.text||x.emotion||x.action)&&!confirm(message+"目前逐張內容會被取代；是否繼續？"))return;
    state.items=items;renderItems();invalidate();status("已套用；請逐張確認內容。");
  }
  document.querySelectorAll("[data-setting]").forEach(el=>el.addEventListener(el.tagName==="SELECT"||el.type==="color"?"change":"input",()=>{
    const key=el.dataset.setting;
    state.settings[key]=key==="count"?Number(el.value):el.value;
    if(key==="count"){C.resize(state,Number(el.value));renderItems();renderGrids();controls();}
    if(key==="mode"){
      if(el.value==="ai"){const n=C.releasePreset(state);status(n?"已釋放 "+n+" 句系統預設台詞，改由 AI 發揮；自行修改的台詞保留。":"已改為 AI 發揮。已有內容保留；想重新創作可按「將台詞交給 AI 重新創作」。");}
      if(el.value==="preset"&&state.settings.scene==="auto"){state.settings.scene="greeting";$("scene").value="greeting";}
      renderItems();
    }
    if(key==="layoutMode"){if(el.value==="auto")state.grids=C.autoGrids(state.settings.count);renderGrids();}
    if(["textMode","nameMode"].includes(key))renderItems();
    if(key==="scene"&&state.settings.mode==="preset"){const filled=C.fillMissing(state);renderItems();if(filled)status("已補入 "+filled+" 句；原有台詞未改動。");}
    if(key==="source"&&el.value!=="photo")clearReference();
    conditions();invalidate();
  }));
  $("settings-form").addEventListener("submit",e=>e.preventDefault());
  document.querySelectorAll("[data-step]").forEach(el=>el.addEventListener("click",()=>go(Number(el.dataset.step))));
  $("previous").addEventListener("click",()=>go(step-1));$("next").addEventListener("click",()=>go(step+1));
  $("apply-scene").addEventListener("click",()=>replaceItems(C.pool(state.settings.scene).slice(0,state.settings.count).map(C.presetItem),"套用「"+D.scenes[state.settings.scene].label+"」。"));
  $("ai-reset-text").addEventListener("click",()=>{
    if(state.settings.mode!=="ai"||state.settings.textMode==="none")return;
    const targets=state.items.filter(x=>C.hasText(state,x));
    if(targets.some(x=>x.text.trim())&&!confirm("將所有有文字貼圖的台詞清空，交給 AI 重新創作？包含自行輸入或先前 AI 台詞。角色、表情、動作、無文字格的情境與共用名稱設定保留。"))return;
    targets.forEach(x=>{x.text="";delete x.presetText;});renderItems();invalidate();status("台詞已改為 AI 發揮。可用網站 AI 先安排，或直接產生提示詞交給生圖平台；不會自動送出 AI 請求。");
  });
  $("fill-missing").addEventListener("click",()=>{const n=C.fillMissing(state);renderItems();invalidate();status(n?"已補入 "+n+" 句，請確認或修改。":"目前沒有可補的文字空缺；無文字格子不補台詞。");});
  $("apply-bulk").addEventListener("click",()=>{
    const lines=$("bulk").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)return status("請先貼上台詞。");
    if(lines.length>80||lines.some(x=>x.length>300))return status("清單最多 80 筆，每筆最多 300 字；請先縮短內容。");
    const items=lines.map(C.item);while(items.length<state.settings.count)items.push(C.item());
    replaceItems(items,"套用貼上的台詞清單。");
  });
  $("add-item").addEventListener("click",()=>{if(state.items.length>=80)return status("最多保留 80 筆內容，請先刪減。");state.items.push(C.item());renderItems();invalidate();});
  $("add-grid").addEventListener("click",()=>{if(state.grids.length>=5)return status("最多 5 張母圖。");state.grids.push(8);renderGrids();invalidate();});
  $("confirm-summary").addEventListener("change",()=>{$("generate").disabled=!$("confirm-summary").checked;});
  $("generate").addEventListener("click",()=>{
    if(!$("confirm-summary").checked)return;
    if(!errors(C.validate(state)))return;
    $("reference-handoff").hidden=state.settings.source!=="photo";$("prompt-output").value=C.prompt(state);$("prompt-area").hidden=false;generated=true;
    status("已產生整組提示詞；請核對內容後複製。");
  });
  $("copy").addEventListener("click",async()=>{
    if(!generated||!$("confirm-summary").checked)return;
    try{await navigator.clipboard.writeText($("prompt-output").value);$("copy-feedback").textContent="已複製整組提示詞，可貼到選用的 AI 平台。";}
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
      clearReference();state=incoming;controls();renderItems();renderGrids();invalidate();step=1;go(1);status("已匯入設定；請重新檢查摘要。");
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
    const hadWork=!!aiController||!!aiPending;
    aiRevision++;
    if(aiController)aiController.abort();
    aiController=null;aiPending=null;$("ai-preview").hidden=true;$("ai-preview-body").replaceChildren();
    if(hadWork&&message)$("ai-status").textContent=message;
    aiAvailability();
  }
  $("ai-consent").addEventListener("change",()=>{if(!$("ai-consent").checked)clearAI("已取消同意，未套用的建議已清除。");aiAvailability();});
  $("ai-cancel").addEventListener("click",()=>clearAI("已取消等待，原有內容保留；已送出的服務端請求可能仍會計入額度。"));
  $("ai-discard").addEventListener("click",()=>clearAI("已捨棄建議，原有內容保留。"));
  $("ai-arrange").addEventListener("click",async()=>{
    if(!aiEndpoint||!$("ai-consent").checked||aiController)return;
    let input;
    try{input=AI.payload(state);}catch(error){$("ai-status").textContent=error.message;return;}
    const hasBlank=input.items.some(x=>!x.emotion.trim()||!x.action.trim()||(x.hasText&&!x.text.trim()));
    if(!hasBlank){$("ai-status").textContent="目前沒有空白欄位；如要新的建議，請先清空想重新安排的欄位。";return;}
    clearAI();
    const revision=aiRevision,snapshot=JSON.stringify(C.serialize(state)),controller=new AbortController();
    aiController=controller;aiAvailability();$("ai-status").textContent="正在安排逐張內容，完成後會先顯示建議。";
    const timer=setTimeout(()=>controller.abort(),65000);
    try{
      const rows=await AI.request(aiEndpoint,input,controller.signal);
      if(revision!==aiRevision)return;
      if(snapshot!==JSON.stringify(C.serialize(state))){clearAI("設定已變更，請重新安排。");return;}
      aiPending={rows,snapshot};
      const body=$("ai-preview-body");body.replaceChildren();
      rows.forEach(x=>{const row=node("tr");[String(x.id),x.text||"無文字",x.emotion,x.action].forEach(value=>row.append(node("td",value)));body.append(row);});
      $("ai-preview").hidden=false;$("ai-status").textContent="AI 建議已完成，尚未套用；請先確認內容。";
    }catch(error){
      if(revision===aiRevision)$("ai-status").textContent=controller.signal.aborted?"等待逾時，原有內容保留，請稍後再試。":error instanceof TypeError?"無法連上網站 AI，仍可手動設定；請稍後再試。":error.message;
    }finally{clearTimeout(timer);if(revision===aiRevision){aiController=null;aiAvailability();}}
  });
  $("ai-apply").addEventListener("click",()=>{
    if(!aiPending)return;
    if(aiPending.snapshot!==JSON.stringify(C.serialize(state))){clearAI("設定已變更，請重新安排。");return;}
    try{const n=AI.apply(state,aiPending.rows);renderItems();invalidate();$("ai-status").textContent="已補入 "+n+" 個空白欄位，請逐張確認或修改，再重新確認摘要。";status("已套用 AI 建議；尚未生成圖片。");}
    catch(error){clearAI(error.message);}
  });
  try{
    aiEndpoint=AI.endpoint(window.StickerAIConfig?.endpoint);
    if(aiEndpoint){$("ai-service-summary").textContent="網站 AI 已設定服務位址，可在第二步嘗試安排內容。";$("ai-status").textContent="勾選同意後可取得 AI 建議；免費額度由網站共用，服務可用性以實際請求為準。";}
  }catch(error){$("ai-status").textContent=error.message+"手動設定仍可使用。";}
  aiAvailability();
  controls();renderItems();renderGrids();live();go(1);$("creator").hidden=false;
})();
