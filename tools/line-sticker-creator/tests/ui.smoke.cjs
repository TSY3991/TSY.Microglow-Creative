"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http"),os=require("node:os");
const {spawn}=require("node:child_process");
const root=path.resolve(__dirname,"../../.."),tool="tools/line-sticker-creator/";
const chrome=process.env.CHROME_PATH||path.join(process.env.ProgramFiles||process.env.PROGRAMFILES||os.homedir(),"Google/Chrome/Application/chrome.exe");
if(!fs.existsSync(chrome))throw Error("找不到 Chrome，請以 CHROME_PATH 指定瀏覽器執行檔。");
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"microglow-sticker-ui-"));
const delay=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],errors=[],responses=[];
let browser,ws,server;
(async()=>{
  server=http.createServer((req,res)=>{
    try{
      let file=path.resolve(root,"."+decodeURIComponent(new URL(req.url,"http://localhost").pathname));
      if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
      if(fs.statSync(file).isDirectory())file=path.join(file,"index.html");
      const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".png":"image/png"};
      res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});fs.createReadStream(file).pipe(res);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const origin="http://127.0.0.1:"+server.address().port,url=origin+"/"+tool;
  browser=spawn(chrome,["--headless=new","--disable-gpu","--no-first-run","--remote-debugging-port=0","--user-data-dir="+profile,"about:blank"],{windowsHide:true,stdio:"ignore"});
  const portFile=path.join(profile,"DevToolsActivePort");
  for(let i=0;i<100&&!fs.existsSync(portFile);i++)await delay(100);
  const port=fs.readFileSync(portFile,"utf8").split("\n")[0];
  const pages=await(await fetch("http://127.0.0.1:"+port+"/json")).json();
  const page=pages.find(x=>x.type==="page");ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let seq=0;const pending=new Map();
  function send(method,params={}){
    return new Promise((resolve,reject)=>{
      const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error("CDP 逾時："+method));},15000);
      pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
    });
  }
  ws.onmessage=e=>{
    const v=JSON.parse(e.data);
    if(v.id){const q=pending.get(v.id);if(q){clearTimeout(q.timer);pending.delete(v.id);v.error?q.reject(Error(v.error.message)):q.resolve(v.result);}}
    if(v.method==="Page.javascriptDialogOpening")send("Page.handleJavascriptDialog",{accept:true}).catch(()=>{});
    if(v.method==="Runtime.exceptionThrown")errors.push(v.params.exceptionDetails.text);
    if(v.method==="Network.responseReceived")responses.push({url:v.params.response.url,status:v.params.response.status});
  };
  const E=async expression=>{
    const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true,userGesture:true});
    if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
    return r.result.value;
  };
  const click=id=>E("document.getElementById("+JSON.stringify(id)+").click()");
  const set=(id,value)=>E("(()=>{const e=document.getElementById("+JSON.stringify(id)+");e.value="+JSON.stringify(value)+";e.dispatchEvent(new Event(e.tagName==='SELECT'||e.type==='color'?'change':'input',{bubbles:true}));return e.value;})()");
  const check=(name,value)=>{assert.ok(value,name);checks.push(name);process.stdout.write("PASS "+name+"\n");};
  async function loaded(){
    for(let i=0;i<80;i++){if(await E("Boolean(document.getElementById('creator')&&!document.getElementById('creator').hidden)"))return;await delay(50);}throw Error("介面未啟動");
  }
  await send("Page.enable");await send("Runtime.enable");await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride",{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await send("Page.navigate",{url});await loaded();await E("window.confirm=()=>true");
  check("預設顯示提示詞分頁，裁切區獨立在另一個分頁",await E("document.getElementById('tab-prompt').getAttribute('aria-selected')==='true'&&document.getElementById('sticker-crop').classList.contains('tab-off')&&!document.getElementById('creator').classList.contains('tab-off')"));
  await click("tab-crop");check("切到裁切分頁後隱藏提示詞設定並更新網址 hash",await E("!document.getElementById('sticker-crop').classList.contains('tab-off')&&document.getElementById('creator').classList.contains('tab-off')&&document.getElementById('usage-guide').classList.contains('tab-off')&&location.hash==='#sticker-crop'&&document.getElementById('tab-crop').getAttribute('aria-selected')==='true'"));
  await E("document.getElementById('tab-crop').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");
  check("方向鍵可切換分頁並移動焦點",await E("document.getElementById('tab-prompt').getAttribute('aria-selected')==='true'&&document.activeElement.id==='tab-prompt'&&!document.getElementById('creator').classList.contains('tab-off')"));
  await E("location.hash='#sticker-crop'");await delay(100);
  check("站內連結改 hash 會自動切到裁切分頁",await E("!document.getElementById('sticker-crop').classList.contains('tab-off')"));
  await click("crop-to-prompt");check("裁切分頁內可回到提示詞設定",await E("!document.getElementById('creator').classList.contains('tab-off')&&document.getElementById('sticker-crop').classList.contains('tab-off')"));
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:700,deviceScaleFactor:1,mobile:false});await delay(200);
  check("移除小計畫右欄，製作欄位使用完整工作區寬度",await E("(()=>{const w=document.querySelector('.workspace'),s=document.querySelector('.settings-column');return !document.querySelector('.preview-column')&&Math.abs(w.getBoundingClientRect().width-s.getBoundingClientRect().width)<1;})()"));
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1300,deviceScaleFactor:1,mobile:false});await delay(200);
  check("高視窗仍為全寬工作區，儲存區維持頁底正常文件流",await E("(()=>{const p=document.querySelector('.save-panel');return getComputedStyle(p).position==='static'&&p.nextElementSibling.tagName==='FOOTER'&&!document.querySelector('.preview-column');})()"));
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await delay(200);
  check("四步驟啟動與未預選角色風格",await E("document.querySelectorAll('[data-step]').length===4&&document.getElementById('style').value===''"));
  await click("next");check("角色未完成時擋下前進",await E("!document.getElementById('validation').hidden&&document.querySelector('[data-panel=\"2\"]').hidden"));
  await set("source","photo");
  const upload=async(kind="valid")=>E("(async()=>{const input=document.getElementById('reference-file'),data=new DataTransfer();let file;if("+JSON.stringify(kind)+"==='valid'){const canvas=document.createElement('canvas');canvas.width=48;canvas.height=32;const ctx=canvas.getContext('2d');ctx.fillStyle='#0e8f88';ctx.fillRect(0,0,48,32);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));file=new File([blob],'private-reference.png',{type:'image/png'});}else if("+JSON.stringify(kind)+"==='large')file=new File([new Uint8Array(10*1024*1024+1)],'large.png',{type:'image/png'});else file=new File(['not an image'],'bad.'+("+JSON.stringify(kind)+"==='broken'?'png':'svg'),{type:"+JSON.stringify(kind)+"==='broken'?'image/png':'image/svg+xml'});data.items.add(file);input.files=data.files;input.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,200));})()");
  await upload();
  check("參考圖正常選擇、解碼並預覽",await E("!document.getElementById('reference-preview').hidden&&document.getElementById('reference-image').naturalWidth===48"));
  const firstUrl=await E("document.getElementById('reference-image').src");
  for(const kind of ["svg","large","broken"]){await upload(kind);check("參考圖拒絕 "+kind+" 並保留原圖",await E("document.getElementById('reference-image').src==="+JSON.stringify(firstUrl)+"&&!document.getElementById('reference-preview').hidden"));}
  await click("save-local");
  check("草稿不保存參考圖、檔名或 Blob URL",await E("!Object.values(localStorage).some(x=>x.includes('blob:')||x.includes('private-reference')||x.includes('data:image'))"));
  await set("character","");await set("style","custom");await set("customStyle","");await click("next");await click("next");await click("next");await click("generate");
  check("照片角色不填描述仍可產生提示詞",await E("document.getElementById('prompt-output').value.includes('直接觀察已附參考圖')"));
  check("照片提示詞含動物物件與附圖提醒",await E("!document.getElementById('reference-handoff').hidden&&document.getElementById('prompt-output').value.includes('人物、動物或物件')&&document.getElementById('prompt-output').value.includes('網頁內選圖不代表')"));
  await E("document.querySelector('[data-step=\"1\"]').click()");await click("remove-reference");
  check("移除照片清除預覽並使舊提示詞失效",await E("document.getElementById('reference-preview').hidden&&!document.getElementById('reference-image').hasAttribute('src')&&document.getElementById('prompt-area').hidden"));
  await upload();await send("Page.reload",{ignoreCache:true});await loaded();await E("window.confirm=()=>true");
  check("重新載入保留文字草稿但不還原照片",await E("document.getElementById('source').value==='photo'&&document.getElementById('reference-preview').hidden"));
  await upload();await set("source","original");
  check("切回原創清除參考圖",await E("document.getElementById('reference-preview').hidden&&!document.getElementById('reference-image').hasAttribute('src')"));
  await click("clear");
  await set("source","original");await set("kind","animal");await set("character","虛構橘色貓咪，綠色圍巾與圓眼睛");await set("style","cute");await click("next");
  check("正常角色可進入台詞步驟",await E("!document.querySelector('[data-panel=\"2\"]').hidden"));
  await set("mode","manual");await set("character","");await set("customFont","");await set("font","custom");await set("nameMode","person");await set("name","");
  await set("item-0-text","");await click("next");await click("next");await click("generate");
  check("文字欄位留白可生成且摘要明確標示 AI 搭配",await E("document.getElementById('prompt-output').value.includes('台詞未填')&&document.getElementById('summary').textContent.includes('由 AI 搭配')"));
  await click("previous");await click("previous");await set("bulk",Array.from({length:24},(_,i)=>"測試台詞"+(i+1)).join("\n"));await click("apply-bulk");await click("next");
  check("台詞超量完整保留，並在第二步提供一鍵刪除多餘項目",await E("document.querySelectorAll('.sticker-item').length===24&&document.querySelector('[data-panel=\"3\"]').hidden&&!document.getElementById('validation').hidden&&!document.getElementById('trim-items').hidden"));
  await click("next");check("超量阻擋摘要與生成",await E("!document.getElementById('validation').hidden&&document.querySelector('[data-panel=\"4\"]').hidden"));
  await set("count","24");await click("next");await click("next");
  check("合法 24 張摘要顯示兩張母圖",await E("!document.querySelector('[data-panel=\"4\"]').hidden&&document.querySelectorAll('#summary .summary-table').length===2"));
  check("摘要頁不需另外勾選即可產生",await E("!document.getElementById('generate').disabled"));
  await click("generate");
  check("整組提示詞包含完整 24 張與定位規則",await E("document.getElementById('prompt-output').value.includes('貼圖 17～24')&&document.getElementById('prompt-output').value.includes('定位標籤不印')"));
  await send("Emulation.setFocusEmulationEnabled",{enabled:true});await send("Page.bringToFront");await send("Browser.grantPermissions",{origin,permissions:["clipboardReadWrite","clipboardSanitizedWrite"]});await E("window.__opened=[];window.open=(u)=>{window.__opened.push(u);return null;}");await click("copy");
  check("單張母圖：複製鈕同時打開所選平台",await E("window.__opened.length===1&&window.__opened[0].startsWith('https://chatgpt.com')&&document.getElementById('copy').textContent.includes('打開 ChatGPT')&&document.getElementById('copy-feedback').textContent.includes('幫你打開 ChatGPT')"));
  const copied=await E("navigator.clipboard.readText()");
  check("實際剪貼簿複製整組內容",copied.includes("貼圖 17～24"));
  await set("platform","gemini");check("換平台就地更新已產生的提示詞，不要求重新確認",await E("document.getElementById('copy').textContent.includes('打開 Gemini')&&!document.getElementById('prompt-area').hidden&&document.getElementById('prompt-output').value.includes('請使用圖片生成模式')&&!document.getElementById('generate').disabled"));
  await set("dimension","3d");check("選 3D 立體：提示詞就地更新、第四步摘要顯示",await E("document.getElementById('prompt-output').value.includes('呈現方式：3D 立體')&&document.getElementById('summary').textContent.includes('3D 立體')"));await set("dimension","semi");check("選半 3D：提示詞與第四步摘要同步",await E("document.getElementById('prompt-output').value.includes('半 3D（Semi-3D）')&&document.getElementById('summary').textContent.includes('半 3D')"));await set("dimension","2d");check("可切回 2D 平面",await E("document.getElementById('prompt-output').value.includes('2D 平面插畫')"));
  check("格子留白不提供給使用者選，預設加寬",await E("!document.getElementById('spacing')&&document.getElementById('prompt-output').value.includes('592×512')"));await E("window.dispatchEvent(new Event('sticker-clipped'))");check("裁切發現被切到時，自動改最寬並就地更新提示詞",await E("document.getElementById('prompt-output').value.includes('703×608')&&!document.getElementById('prompt-output').value.includes('592×512')&&document.getElementById('status').textContent.includes('自動')"));
  await click("generate");
  await E("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}})");await click("copy");
  check("剪貼簿拒絕提供手動複製與文字選取",await E("document.getElementById('copy-feedback').textContent.includes('手動複製')&&document.getElementById('prompt-output').selectionEnd>0"));
  await click("previous");await set("count","16");await click("next");
  check("減少張數不截斷 24 筆內容",await E("document.querySelectorAll('.sticker-item').length===24&&!document.getElementById('validation').hidden"));
  await set("count","24");await set("layoutMode","manual");await E("document.getElementById('grid-1').value='16';document.getElementById('grid-1').dispatchEvent(new Event('change',{bubbles:true}))");await click("next");
  check("不合法母圖總格數擋下",await E("document.getElementById('error-grids').textContent.includes('24')"));
  await set("layoutMode","auto");await click("previous");await set("textMode","none");await click("next");await click("next");await click("generate");
  check("整組無字不印台詞與名稱",await E("document.getElementById('prompt-output').value.includes('整組不放任何文字')&&!document.getElementById('prompt-output').value.includes('要印的文字 '+String.fromCharCode(34)+'測試台詞')"));
  await click("previous");await click("previous");await set("textMode","per");await E("document.getElementById('item-0-hasText').click()");await click("fill-missing");
  check("逐張無字保持關閉",await E("!document.getElementById('item-0-hasText').checked"));
  await set("nameMode","person");await set("name","小曜");await set("item-1-text","您好");await E("document.getElementById('item-1-includeName').click()");
  await set("item-2-text",'<img src=x onerror="window.__xss=1">');await click("next");await click("next");
  check("摘要名稱逐張開關有效且輸入不執行 HTML",await E("document.getElementById('summary').textContent.includes('您好')&&!document.getElementById('summary').textContent.includes('小曜您好')&&document.getElementById('summary').textContent.includes('<img src=x')&&!window.__xss&&!document.querySelector('#summary img')"));
  await E("localStorage.setItem('unrelated-tool','keep')");await click("save-local");
  await send("Page.reload",{ignoreCache:true});await loaded();await E("window.confirm=()=>true");
  check("重新載入還原本工具草稿",await E("document.getElementById('save-local').checked&&document.getElementById('name').value==='小曜'"));
  await click("clear");check("清除只移除本工具，不清空頁面或其他資料",await E("!localStorage.getItem('microglow:line-sticker-creator:v1')&&localStorage.getItem('unrelated-tool')==='keep'&&document.getElementById('name').value==='小曜'"));
  const raw=await E("JSON.stringify(StickerCore.serialize({settings:{...Object.fromEntries([...document.querySelectorAll('[data-setting]')].map(e=>[e.dataset.setting,e.dataset.setting==='count'?Number(e.value):e.value])),count:16},items:Array.from({length:16},()=>StickerCore.item('匯入測試')),grids:[16]}))");
  const importResult=await E("(async()=>{const input=document.getElementById('import-file');const data=new DataTransfer();data.items.add(new File(['invalid json'],'bad.json',{type:'application/json'}));input.files=data.files;input.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,100));return document.getElementById('status').textContent;})()");
  check("壞檔案拒絕且不覆蓋目前設定",importResult.includes("匯入失敗")&&await E("document.getElementById('name').value==='小曜'"));
  await set("source","photo");await upload();
  await E("(async()=>{const input=document.getElementById('import-file'),data=new DataTransfer();data.items.add(new File(["+JSON.stringify(raw)+"],'ok.json',{type:'application/json'}));input.files=data.files;input.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,150));})()");
  check("合法匯入設定可套用、返回第一步並要求重新確認",await E("document.querySelectorAll('.sticker-item').length===16&&document.getElementById('item-0-text').value==='匯入測試'&&document.getElementById('prompt-area').hidden"));
  check("成功匯入設定會清除原參考圖",await E("document.getElementById('reference-preview').hidden&&!document.getElementById('reference-image').hasAttribute('src')"));
  await send("Page.setDownloadBehavior",{behavior:"allow",downloadPath:profile});await click("export");
  for(let i=0;i<50&&!fs.existsSync(path.join(profile,"line-sticker-settings.json"));i++)await delay(100);
  const exported=JSON.parse(fs.readFileSync(path.join(profile,"line-sticker-settings.json"),"utf8"));check("實際下載的設定檔可解析且不含照片",exported.tool==="microglow-line-sticker-creator"&&exported.state.items.length===16&&!JSON.stringify(exported).includes("data:image"));
  await set("source","photo");await upload();
  for(const width of [320,390,768,1280]){
    await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await E("window.scrollTo(0,0)");
    const metric=await E("({width:innerWidth,scroll:document.documentElement.scrollWidth})");check(width+"px 無橫向溢出",metric.scroll<=metric.width);
    await click("next");await click("next");await click("next");
    check(width+"px 摘要確實開啟",await E("!document.querySelector('[data-panel=\"4\"]').hidden"));
    const summaryMetric=await E("({width:innerWidth,scroll:document.documentElement.scrollWidth})");check(width+"px 摘要無橫向溢出",summaryMetric.scroll<=summaryMetric.width);
    await E("document.querySelector('[data-step=\"1\"]').click()");
  }
  check("清除全部放在製作步驟區，不在返回導覽列",await E("!!document.querySelector('#creator .creator-actions #reset-all')&&!document.querySelector('.topbar #reset-all')"));
  check("儲存設定位於頁面底部，提示詞和裁切分頁都可使用",await E("(()=>{const p=document.querySelector('.save-panel');return p.nextElementSibling.tagName==='FOOTER'&&!document.getElementById('creator').contains(p)&&!document.getElementById('sticker-crop').contains(p)&&p.querySelector('#export')&&p.querySelector('#import');})()"));
  await set("bulk","重設前的批次內容");await click("save-local");
  await E("document.getElementById('ai-consent').checked=true");
  await E("(async()=>{const c=document.createElement('canvas');c.width=c.height=800;const g=c.getContext('2d');g.fillStyle='#008080';for(let i=0;i<16;i++)g.fillRect(i%4*200+40,Math.floor(i/4)*200+40,120,120);const blob=await new Promise(r=>c.toBlob(r));await StickerCrop.set(0,new File([blob],'reset-test.png',{type:'image/png'}));document.getElementById('tab-crop').click();StickerCrop.run();})()");
  for(let i=0;i<100;i++){if(await E("document.querySelectorAll('.crop-sticker').length===16&&!document.getElementById('crop-run').disabled"))break;await delay(50);}
  check("重設測試先建立參考圖、草稿與裁切結果",await E("!document.getElementById('reference-preview').hidden&&!!localStorage.getItem('microglow:line-sticker-creator:v1')&&StickerCrop.count()===1&&document.querySelectorAll('.crop-sticker').length===16"));
  await E("window.confirm=()=>false");await click("reset-all");
  check("取消全部清除時，設定、參考圖、母圖與草稿都保留",await E("document.getElementById('bulk').value==='重設前的批次內容'&&!document.getElementById('reference-preview').hidden&&StickerCrop.count()===1&&!!localStorage.getItem('microglow:line-sticker-creator:v1')"));
  await E("window.confirm=()=>true;window.__removeItem=Storage.prototype.removeItem;Storage.prototype.removeItem=function(){throw Error('test storage blocked')}");await click("reset-all");
  check("草稿清除失敗時明說未重設，原資料保留",await E("document.getElementById('status').textContent.includes('尚未重新開始')&&document.getElementById('bulk').value==='重設前的批次內容'&&StickerCrop.count()===1"));
  await E("Storage.prototype.removeItem=window.__removeItem");await click("reset-all");await delay(350);await loaded();
  check("確認後回第一步與預設設定，批次文字及 AI 同意一併歸零",await E("document.getElementById('source').value===''&&document.getElementById('style').value===''&&document.getElementById('count').value==='16'&&document.getElementById('scene').value==='auto'&&document.getElementById('bulk').value===''&&!document.getElementById('ai-consent').checked&&document.getElementById('step-counter').textContent==='1／4'"));
  check("全部清除移除母圖、裁切、提示詞、參考圖與本站草稿，保留其他工具資料",await E("StickerCrop.count()===0&&document.querySelectorAll('.crop-sticker').length===0&&document.getElementById('prompt-area').hidden&&document.getElementById('prompt-output').value===''&&document.getElementById('reference-preview').hidden&&!localStorage.getItem('microglow:line-sticker-creator:v1')&&localStorage.getItem('unrelated-tool')==='keep'&&location.hash===''&&document.getElementById('tab-prompt').getAttribute('aria-selected')==='true'"));
  check("移到頁底的儲存開關與表單外裁切設定也重設",await E("!document.getElementById('save-local').checked&&document.getElementById('crop-mode').value==='smart'&&document.getElementById('crop-backdrop').value==='dark'&&document.getElementById('crop-strength').value==='248'"));
  await set("source","original");await set("kind","animal");await set("style","cute");await click("next");await click("next");await click("next");await click("generate");
  check("全部清除後仍能重新設定並產生提示詞",await E("!document.getElementById('prompt-area').hidden&&document.getElementById('prompt-output').value.includes('共 16 張')"));
  const shots=process.argv[2];
  if(shots){
    fs.mkdirSync(shots,{recursive:true});
    for(const [width,height,name]of [[1280,900,"desktop"],[390,844,"mobile"]]){
      await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<600});
      await E("window.scrollTo(0,0);document.activeElement.blur()");await delay(100);
      const metrics=await send("Page.getLayoutMetrics"),shot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(metrics.cssContentSize.height),scale:1}});
      fs.writeFileSync(path.join(shots,"line-sticker-functional-"+name+".png"),Buffer.from(shot.data,"base64"));
    }
  }
  check("頁面無未處理例外",errors.length===0);
  check("本工具所有本機資源成功載入",responses.filter(x=>x.url.startsWith(origin)).every(x=>x.status<400));
  process.stdout.write("SUMMARY passed="+checks.length+" failed=0\n");
  await send("Browser.close");
})().catch(e=>{process.stderr.write("FAIL "+e.stack+"\n");process.exitCode=1;}).finally(async()=>{
  if(ws)ws.close();if(browser&&!browser.killed)browser.kill();if(server)server.close();
  for(let i=0;i<20;i++){try{fs.rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
  if(fs.existsSync(profile)){process.stderr.write("暫存未清理："+profile+"\n");process.exitCode=1;}else process.stdout.write("CLEANUP complete\n");
});
