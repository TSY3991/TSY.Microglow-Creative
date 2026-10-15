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

  check('新設定預設 AI 自由發想，16 張台詞留白',await E("document.getElementById('mode').value==='ai'&&document.getElementById('scene').value==='auto'&&Array.from(document.querySelectorAll('#items textarea[id$=text]')).every(e=>!e.value)"));
  await set('source','original');await set('kind','animal');await set('style','cute');await click('next');await click('next');await click('next');await click('generate');
  check('完整流程不偷補句庫，提示詞沒有固定早午晚台詞',await E("document.getElementById('prompt-output').value.includes('台詞來源：AI 自由創作')&&!document.getElementById('prompt-output').value.includes('要印的文字 '+String.fromCharCode(34)+'早安')&&Array.from(document.querySelectorAll('#items textarea[id$=text]')).every(e=>!e.value)"));
  await E("document.querySelector('[data-step=\"2\"]').click()");await set('mode','preset');await click('apply-scene');check('預設句庫仍可明確選用',await E("document.getElementById('item-0-text').value==='早安'"));
  await set('item-0-text','使用者自己的句子');await set('item-1-emotion','保留表情');await set('item-1-action','保留動作');await set('mode','ai');
  check('改成 AI 發揮釋放預設句子，保留手寫文字與動作',await E("document.getElementById('item-0-text').value==='使用者自己的句子'&&document.getElementById('item-1-text').value===''&&document.getElementById('item-1-emotion').value==='保留表情'&&document.getElementById('item-1-action').value==='保留動作'&&document.getElementById('fill-missing').hidden"));
  await set('scene','friends');await click('next');await set('count','24');check('切情境、前進與增加張數不補入固定台詞',await E("document.getElementById('item-1-text').value===''&&document.getElementById('item-23-text').value===''"));
  await E("document.querySelector('[data-step=\"2\"]').click();window.confirm=()=>false");await click('ai-reset-text');check('拒絕重新創作不清除既有台詞',await E("document.getElementById('item-0-text').value==='使用者自己的句子'"));
  await E('window.confirm=()=>true');await set('textMode','per');await E("document.getElementById('item-2-hasText').click()");await set('item-2-text','不印字的情境');await click('ai-reset-text');
  check('確認重做只清有字台詞，無文字情境與表情動作保留',await E("document.getElementById('item-0-text').value===''&&document.getElementById('item-2-text').value==='不印字的情境'&&document.getElementById('item-1-emotion').value==='保留表情'&&document.getElementById('item-1-action').value==='保留動作'"));
  await set('textMode','none');check('整組無文字不能誤清情境',await E("document.getElementById('ai-reset-text').disabled"));
  await set('textMode','all');await set('mode','preset');await click('apply-scene');await click('save-local');await send('Page.reload',{ignoreCache:true});await loaded();await set('mode','ai');
  check('重載草稿仍能識別系統預設台詞，不把它當手寫',await E("document.getElementById('item-0-text').value===''"));
  await E('window.confirm=()=>true');await click('clear');
  const legacy=await E("(()=>{const s=StickerCore.initial();Object.assign(s.settings,{source:'original',kind:'animal',style:'cute',mode:'preset',scene:'greeting'});s.items=StickerCore.pool('greeting').slice(0,16).map(StickerCore.item);return JSON.stringify(StickerCore.serialize(s));})()");
  await E("(async()=>{window.confirm=()=>true;const dt=new DataTransfer();dt.items.add(new File(["+JSON.stringify(legacy)+"],'legacy.json',{type:'application/json'}));const input=document.getElementById('import-file');input.files=dt.files;input.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,150));})()");
  await set('mode','ai');check('舊版無來源記錄的台詞保留，提供明確重做操作',await E("document.getElementById('item-0-text').value==='早安'&&!document.getElementById('ai-reset-text').hidden"));await click('ai-reset-text');check('舊草稿確認重做後可真正留給 AI',await E("Array.from(document.querySelectorAll('#items textarea[id$=text]')).every(e=>!e.value)"));
  await send('Page.navigate',{url});await loaded();await E('window.confirm=()=>true');
  await set('source','original');await set('kind','animal');await set('style','cute');
  check('AI 模式隱藏與預設句庫有關的按鈕',await E("document.getElementById('apply-scene').hidden&&document.getElementById('fill-missing').hidden&&!document.getElementById('ai-reset-text').hidden"));
  await set('textMode','none');await set('item-0-text','揮手打招呼');await E('window.confirm=()=>false');await set('textMode','all');
  check('不印字的情境描述切成有字需確認，取消則維持原模式與內容',await E("document.getElementById('textMode').value==='none'&&document.getElementById('item-0-text').value==='揮手打招呼'"));
  await E('window.confirm=()=>true');await set('textMode','all');
  check('確認後才切成有字',await E("document.getElementById('textMode').value==='all'"));
  await set('source','original');await set('kind','animal');await set('style','cute');await click('next');await click('next');await click('next');
  check('摘要頁提醒仍有台詞未填，並指向第二步的網站 AI',await E("document.querySelector('#summary .notice').textContent.includes('還有 15 張台詞沒填')"));
  await set('textMode','per');await E("document.getElementById('item-0-hasText').click()");
  check('逐張不印字的格子可編輯，標籤改為情境描述',await E("!document.getElementById('item-0-text').disabled&&document.getElementById('item-0-text').closest('label').textContent.includes('情境描述')"));
  await E('window.confirm=()=>false');await E("document.getElementById('item-0-hasText').click()");
  check('取消勾選「顯示文字」時維持不印字',await E("document.getElementById('item-0-hasText').checked===false&&document.getElementById('item-0-text').value==='揮手打招呼'"));
  await E('window.confirm=()=>true');await set('textMode','all');await set('item-0-text','');
  await set('count','40');await set('count','16');
  check('張數 40 改回 16，空白的多餘項目自動移除',await E("document.querySelectorAll('.sticker-item').length===16&&document.getElementById('trim-items').hidden"));
  await set('count','40');await set('item-39-text','尾端內容');await set('count','16');
  check('尾端有內容時全部保留並出現一鍵刪除',await E("document.querySelectorAll('.sticker-item').length===40&&!document.getElementById('trim-items').hidden"));
  await E('window.confirm=()=>false');await click('trim-items');check('取消一鍵刪除時內容保留',await E("document.querySelectorAll('.sticker-item').length===40"));
  await E('window.confirm=()=>true');await click('trim-items');check('確認後刪除超出張數的項目',await E("document.querySelectorAll('.sticker-item').length===16&&document.getElementById('trim-items').hidden"));
  await E("document.querySelector('[data-step=\"3\"]').click()");
  check('母圖設定即時顯示格數合計',await E("document.getElementById('grid-total').textContent.includes('16／16')"));
  await set('layoutMode','manual');await click('add-grid');
  check('手動分配格數不符時立即提示',await E("document.getElementById('grid-total').textContent.includes('24／16')&&document.getElementById('grid-total').textContent.includes('不符')"));
  check('母圖設定說明為什麼這樣分，且分配選項名稱說明清楚',await E("document.querySelector('.why-split summary').textContent.includes('為什麼這樣分母圖')&&document.querySelector('.why-split').textContent.includes('不是 LINE 規定')&&document.getElementById('layoutMode').options[0].text.includes('16 格優先')&&document.getElementById('layoutMode').options[1].text.includes('8 或 16 格')"));
  for(const width of [320,390,768,1280]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});check(width+'px 台詞模式無溢出',await E('document.documentElement.scrollWidth<=innerWidth'));}
  check("頁面無未處理例外",errors.length===0);
  check("本工具所有本機資源成功載入",responses.filter(x=>x.url.startsWith(origin)).every(x=>x.status<400));
  process.stdout.write("SUMMARY passed="+checks.length+" failed=0\n");
  await send("Browser.close");
})().catch(e=>{process.stderr.write("FAIL "+e.stack+"\n");process.exitCode=1;}).finally(async()=>{
  if(ws)ws.close();if(browser&&!browser.killed)browser.kill();if(server)server.close();
  for(let i=0;i<20;i++){try{fs.rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
  if(fs.existsSync(profile)){process.stderr.write("暫存未清理："+profile+"\n");process.exitCode=1;}else process.stdout.write("CLEANUP complete\n");
});
