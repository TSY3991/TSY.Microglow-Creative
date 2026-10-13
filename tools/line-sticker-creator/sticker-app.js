(function () {
  "use strict";
  const D=window.StickerData,C=window.StickerCore;
  const $=id=>document.getElementById(id);
  const storageKey="microglow:line-sticker-creator:v1";
  let state=C.initial(),step=1,saveEnabled=false,generated=false;
  function node(tag,text,cls) { const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el; }
  function status(message) { $("status").textContent=message; }
  function save() {
    if(!saveEnabled)return;
    try{localStorage.setItem(storageKey,JSON.stringify(C.serialize(state)));$("save-status").textContent="已儲存在目前瀏覽器。";}
    catch{$("save-status").textContent="瀏覽器無法儲存；可改用匯出設定檔。";}
  }
  function invalidate() {
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
    $("fill-missing").disabled=state.settings.textMode==="none";
    const scene=$("scene");scene.disabled=state.settings.mode!=="preset";
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
      const text=inputControl("textarea","item-"+i+"-text",entry.text,value=>{entry.text=value;invalidate();});
      text.disabled=!C.hasText(state,entry);
      const textLabel=node("label",undefined,"field full-width");textLabel.htmlFor=text.id;textLabel.append(node("span",noText?"情境描述（不印字）":"台詞"),text);
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
    const s=state.settings,box=$("live-summary");box.replaceChildren();
    const rows=[["角色來源",s.source?C.label("source",s.source):"尚未選擇"],["角色風格",s.style?C.label("style",s.style):"尚未選擇"],["貼圖總張數",s.count+" 張"],["母圖分配",state.grids.map(x=>x===16?"4×4":"4×2").join(" ＋ ")||"尚未設定"],["文字模式",C.label("textMode",s.textMode)]];
    for(const [title,value]of rows){const row=node("div",undefined,"live-row");row.append(node("span",title),node("strong",value));box.append(row);}
  }
  function summary() {
    const box=$("summary");box.replaceChildren();
    const s=state.settings;
    const info=node("dl",undefined,"summary-info");
    const entries=[
      ["角色",C.label("source",s.source)+(s.source==="original"?"・"+C.label("kind",s.kind):"")],
      ["角色描述",s.character],["角色風格",C.label("style",s.style)+(s.customStyle?"・"+s.customStyle:"")],
      ["台詞模式",C.label("mode",s.mode)+"・"+C.label("textMode",s.textMode)],
      ["共用名稱",s.nameMode==="none"?"不加入":C.label("nameMode",s.nameMode)+"："+s.name],
      ["字體與大小",(s.font==="custom"?s.customFont:C.label("font",s.font))+"／"+C.label("size",s.size)],
      ["文字顏色",s.textColor==="custom"?s.textCustom:C.label("textColor",s.textColor)],
      ["文字位置",C.label("position",s.position)],
      ["描邊",C.label("stroke",s.stroke)+"／"+(s.strokeColor==="custom"?s.strokeCustom:C.label("strokeColor",s.strokeColor))],
      ["陰影",C.label("shadow",s.shadow)+"／"+(s.shadowColor==="custom"?s.shadowCustom:C.label("shadowColor",s.shadowColor))],
      ["背景",C.label("background",s.background)+(s.background==="color"?" "+s.backgroundColor:"")],
      ["母圖",state.grids.map(x=>x===16?"4×4":"4×2").join(" ＋ ")+"；共 "+s.count+" 張貼圖"]
    ];
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
        ["第 "+(Math.floor(n/4)+1)+" 列 第 "+(n%4+1)+" 欄",C.hasText(state,entry)?C.finalText(state,entry):"無文字"+(entry.text?"（情境："+entry.text+"）":""),entry.emotion||"AI 發揮",entry.action||"AI 發揮"].forEach(x=>row.append(node("td",x)));
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
    if(key==="layoutMode"){if(el.value==="auto")state.grids=C.autoGrids(state.settings.count);renderGrids();}
    if(["textMode","nameMode"].includes(key))renderItems();
    if(key==="scene"&&state.settings.mode==="preset"){const filled=C.fillMissing(state);renderItems();if(filled)status("已補入 "+filled+" 句；原有台詞未改動。");}
    conditions();invalidate();
  }));
  $("settings-form").addEventListener("submit",e=>e.preventDefault());
  document.querySelectorAll("[data-step]").forEach(el=>el.addEventListener("click",()=>go(Number(el.dataset.step))));
  $("previous").addEventListener("click",()=>go(step-1));$("next").addEventListener("click",()=>go(step+1));
  $("apply-scene").addEventListener("click",()=>replaceItems(C.pool(state.settings.scene).slice(0,state.settings.count).map(C.item),"套用「"+D.scenes[state.settings.scene].label+"」。"));
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
    $("prompt-output").value=C.prompt(state);$("prompt-area").hidden=false;generated=true;
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
      state=incoming;controls();renderItems();renderGrids();invalidate();step=1;go(1);status("已匯入設定；請重新檢查摘要。");
    }catch(error){status("匯入失敗，原有內容保留："+error.message);}
  });
  try{
    const raw=localStorage.getItem(storageKey);
    if(raw){state=C.deserialize(raw);saveEnabled=true;$("save-local").checked=true;$("save-status").textContent="已載入這個瀏覽器的草稿。";}
  }catch{$("save-status").textContent="瀏覽器草稿無法讀取，未套用；可匯入有效設定檔。";}
  controls();renderItems();renderGrids();live();go(1);$("creator").hidden=false;
})();
