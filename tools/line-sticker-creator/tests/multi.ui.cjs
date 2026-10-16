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

  const step4=async()=>{for(const n of [2,3,4])await E("document.querySelector('[data-step=\""+n+"\"]').click()");};
  const waitCount=async n=>{for(let k=0;k<100;k++){if(await E("StickerCrop.count()==="+n))return;await delay(50);}throw Error("母圖未加入："+n);};
  const upload=i=>E("(async()=>{const c=document.createElement('canvas');c.width=400;c.height=400;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,400,400);for(let k=0;k<16;k++){x.fillStyle='rgb(200,40,40)';x.fillRect(k%4*100+20,Math.floor(k/4)*100+20,60,60);}const b=await new Promise(r=>c.toBlob(r,'image/png'));const f=new File([b],'m"+(i+1)+".png',{type:'image/png'});const dt=new DataTransfer();dt.items.add(f);const input=document.querySelectorAll('.mother-step')["+i+"].querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await set('source','original');await set('kind','human');await set('style','cute');
  await step4();
  check('16 張（一張母圖）：不出現逐張卡片，維持原本的產生提示詞流程',await E("document.getElementById('multi-flow').hidden&&!document.getElementById('single-flow').hidden&&!document.getElementById('generate').hidden&&document.querySelectorAll('.mother-step').length===0"));
  await E("document.querySelector('[data-step=\"2\"]').click()");await set('count','40');await step4();
  check('40 張：出現 3 張母圖的逐張卡片，整組提示詞收起來',await E("!document.getElementById('multi-flow').hidden&&document.querySelectorAll('.mother-step').length===3&&document.getElementById('single-flow').hidden"));
  check('提醒台詞還沒填，並提供 AI 補齊按鈕',await E("document.getElementById('multi-alerts').textContent.includes('還有 40 句台詞沒填')&&document.getElementById('multi-alerts').querySelector('button')!==null"));
  await E("window.__opened=[];window.open=(...a)=>{__opened.push(a[0]);return null;};window.__copied=[];window.__written=0;Object.defineProperty(navigator.clipboard,'writeText',{value:async t=>{__copied.push(t)},configurable:true});Object.defineProperty(navigator.clipboard,'write',{value:async()=>{__written++},configurable:true});");
  await E("document.querySelectorAll('.mother-step')[0].querySelector('.step .button').click()");await delay(120);
  check('按一下就複製這張的提示詞並打開 ChatGPT',await E("__opened[0]==='https://chatgpt.com/'&&__copied[0].includes('母圖 1')&&__copied[0].includes('貼圖 1～16')&&!__copied[0].includes('【母圖 2')&&document.querySelector('.mother-step .copy-note').textContent.includes('已複製')"));
  await set('platform','gemini');
  await E("document.querySelectorAll('.mother-step')[1].querySelector('.step .button').click()");await delay(120);
  check('選 Gemini 時改開 Gemini，且母圖 2 的提示詞要求沿用母圖 1',await E("__opened[1]==='https://gemini.google.com/app'&&__copied[1].includes('貼圖 17～32')&&__copied[1].includes('附上已完成的母圖 1')"));
  await set('platform','chatgpt');
  check('母圖 1 還沒到時，母圖 2、3 不能放圖，也不能複製參考圖',await E("(()=>{const c=[...document.querySelectorAll('.mother-step')];return c[1].querySelector('input[type=file]').disabled&&c[2].querySelector('input[type=file]').disabled&&c[1].querySelectorAll('.step .button')[1].disabled&&document.getElementById('to-crop').disabled;})()"));
  await set('item-0-text','早安');await set('item-1-text','早安！');
  check('台詞重複會提醒',await E("document.getElementById('multi-alerts').textContent.includes('有 1 句台詞重複')"));
  await upload(0);await waitCount(1);
  check('母圖 1 放進卡片後顯示已收到，母圖 2 解鎖',await E("(()=>{const c=[...document.querySelectorAll('.mother-step')];return c[0].querySelector('.drop-zone').textContent.includes('已收到')&&c[0].classList.contains('done')&&!c[1].querySelector('input[type=file]').disabled&&c[2].querySelector('input[type=file]').disabled&&document.getElementById('multi-status').textContent.includes('1／3');})()"));
  await E("document.querySelectorAll('.mother-step')[1].querySelectorAll('.step .button')[1].click()");await delay(120);
  check('可一鍵複製母圖 1 的圖片當參考',await E("__written===1&&document.querySelectorAll('.mother-step')[1].querySelector('.copy-note').textContent.includes('已複製「母圖 1」')"));
  await upload(1);await waitCount(2);await upload(2);await waitCount(3);
  check('三張都到了才能前往裁切',await E("!document.getElementById('to-crop').disabled&&document.getElementById('multi-status').textContent.includes('全部母圖都到了')"));
  await click('to-crop');
  const cropped=await E("(async()=>{for(let i=0;i<300&&document.querySelectorAll('.crop-sticker').length<40;i++)await new Promise(r=>setTimeout(r,100));return document.querySelectorAll('.crop-sticker').length})()");
  check('按「前往裁切」自動切到裁切分頁並裁好 40 張，不必再選檔案',cropped===40&&await E("document.getElementById('tab-crop').getAttribute('aria-selected')==='true'"));
  await E("document.getElementById('tab-prompt').click();document.querySelector('[data-step=\"4\"]').click()");
  await set('dimension','semi');await E("document.getElementById('dimension').value='3d';document.querySelectorAll('.mother-step')[1].querySelector('.step .button').click()");await delay(120);
  check('逐張母圖複製前重新讀取 3D，不沿用半 3D',await E("__copied.at(-1).includes('呈現方式：3D 立體')&&!__copied.at(-1).includes('呈現方式：半 3D')&&__copied.at(-1).includes('fully modeled 3D character render')"));
  for(const width of [320,390,768]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});check(width+'px 逐張母圖卡片無橫向溢出',await E('document.documentElement.scrollWidth<=innerWidth'));}

  check("頁面無未處理例外",errors.length===0);
  check("本工具所有本機資源成功載入",responses.filter(x=>x.url.startsWith(origin)).every(x=>x.status<400));
  process.stdout.write("SUMMARY passed="+checks.length+" failed=0\n");
  await send("Browser.close");
})().catch(e=>{process.stderr.write("FAIL "+e.stack+"\n");process.exitCode=1;}).finally(async()=>{
  if(ws)ws.close();if(browser&&!browser.killed)browser.kill();if(server)server.close();
  for(let i=0;i<20;i++){try{fs.rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
  if(fs.existsSync(profile)){process.stderr.write("暫存未清理："+profile+"\n");process.exitCode=1;}else process.stdout.write("CLEANUP complete\n");
});
