"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http"),os=require("node:os");
const {spawn}=require("node:child_process");
const root=path.resolve(__dirname,"../../.."),tool="tools/line-sticker-creator/";
const chrome=process.env.CHROME_PATH||path.join(process.env.ProgramFiles||process.env.PROGRAMFILES||os.homedir(),"Google/Chrome/Application/chrome.exe");
if(!fs.existsSync(chrome))throw Error("找不到 Chrome，請以 CHROME_PATH 指定瀏覽器執行檔。");
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"microglow-sticker-ui-"));
const delay=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],errors=[],responses=[];
let browser,ws,server;
let configured=false,mode="good",requests=0,delayed=null;
(async()=>{
  server=http.createServer((req,res)=>{
    try{
      if(new URL(req.url,"http://localhost").pathname.endsWith("/sticker-ai-config.js")) {res.writeHead(200,{"Content-Type":"text/javascript"});return res.end("window.StickerAIConfig={endpoint:"+JSON.stringify(configured?"https://ai.mock/arrange":"")+"}");}
      let file=path.resolve(root,"."+decodeURIComponent(new URL(req.url,"http://localhost").pathname));
      if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
      if(fs.statSync(file).isDirectory())file=path.join(file,"index.html");
      if(configured&&file.endsWith("index.html")){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});return res.end(fs.readFileSync(file,"utf8").replace(/connect-src[^;]*/,"connect-src https://ai.mock"));}
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
    if(v.method==="Fetch.requestPaused"){
      const p=v.params;
      (async()=>{
        const headers=[{name:"Content-Type",value:"application/json"},{name:"Access-Control-Allow-Origin",value:origin},{name:"Access-Control-Allow-Methods",value:"POST"},{name:"Access-Control-Allow-Headers",value:"Content-Type"}];
        if(p.request.method==="OPTIONS")return send("Fetch.fulfillRequest",{requestId:p.requestId,responseCode:204,responseHeaders:headers});
        requests++;
        const input=JSON.parse(p.request.postData);
        assert.ok(!JSON.stringify(input).includes("私人名稱"));assert.ok(!JSON.stringify(input).includes("blob:"));
        const data={items:input.items.map(x=>({id:x.id,text:"AI台詞"+x.id,emotion:"瞇眼笑"+x.id,action:"揮手"+x.id}))};
        if(mode==="bad")data.items[data.items.length-1].id=1;
        const deliver=()=>send("Fetch.fulfillRequest",{requestId:p.requestId,responseCode:mode==="quota"?429:200,responseHeaders:headers,body:Buffer.from(JSON.stringify(data)).toString("base64")});
        if(mode==="delayed")delayed=deliver;else await deliver();
      })().catch(e=>{errors.push(e.message);send("Fetch.failRequest",{requestId:p.requestId,errorReason:"Failed"}).catch(()=>{});});
    }
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
  check("未設定 AI 時停用按鈕與明確提示",await E("document.getElementById('ai-arrange').disabled&&document.getElementById('ai-service-summary').textContent.includes('尚未啟用')"));
  check("未設定 AI 不發外部請求",requests===0);
  configured=true;await send("Fetch.enable",{patterns:[{urlPattern:"https://ai.mock/*"}]});
  await send("Page.reload",{ignoreCache:true});await loaded();
  await set("source","original");await set("kind","animal");await set("style","cute");await click("next");await set("mode","manual");
  await set("nameMode","person");await set("name","私人名稱");await set("item-0-text","保留台詞");await set("item-0-emotion","自己的表情");await set("item-1-text","");
  check("未同意前不能傳送 AI",await E("document.getElementById('ai-arrange').disabled"));
  await click("ai-consent");check("同意後可安排",await E("!document.getElementById('ai-arrange').disabled"));
  async function settled(){for(let i=0;i<100;i++){if(await E("!document.getElementById('ai-cancel').hidden")){await delay(30);continue;}return;}throw Error("AI 等待未結束");}
  mode="quota";await click("ai-arrange");await settled();
  check("429 明確顯示限制並保留設定",await E("document.getElementById('ai-status').textContent.includes('額度')&&document.getElementById('item-0-text').value==='保留台詞'&&document.getElementById('ai-preview').hidden"));
  mode="bad";await click("ai-arrange");await settled();
  check("壞回應拒絕且無預覽或變更",await E("document.getElementById('ai-preview').hidden&&document.getElementById('item-1-text').value===''"));
  mode="good";await click("ai-arrange");await settled();
  check("正常回應只預覽、未套用",await E("!document.getElementById('ai-preview').hidden&&document.querySelectorAll('#ai-preview-body tr').length===16&&document.getElementById('item-1-text').value===''"));
  await set("item-2-action","新設定");check("修改設定清除舊建議",await E("document.getElementById('ai-preview').hidden"));
  await click("ai-arrange");await settled();await click("ai-discard");check("捨棄建議保留設定",await E("document.getElementById('ai-preview').hidden&&document.getElementById('item-1-text').value===''"));
  await click("ai-arrange");await settled();await click("ai-apply");
  check("套用補空白並保留既有內容",await E("document.getElementById('item-0-text').value==='保留台詞'&&document.getElementById('item-0-emotion').value==='自己的表情'&&document.getElementById('item-1-text').value==='AI台詞2'&&document.getElementById('item-2-action').value==='新設定'&&!document.getElementById('confirm-summary').checked"));
  await set("item-1-action","");mode="delayed";await click("ai-arrange");
  for(let i=0;i<50&&!delayed;i++)await delay(20);
  await click("ai-cancel");await delayed().catch(()=>{});delayed=null;await delay(100);
  check("取消等待不套用遲到回應",await E("document.getElementById('ai-preview').hidden&&document.getElementById('item-1-action').value===''&&!document.getElementById('ai-arrange').disabled"));
  mode="delayed";await click("ai-arrange");for(let i=0;i<50&&!delayed;i++)await delay(20);
  await set("item-1-action","等待時修改");await delayed().catch(()=>{});delayed=null;await delay(100);
  check("等待時修改保留新內容並捨棄遲到回應",await E("document.getElementById('item-1-action').value==='等待時修改'&&document.getElementById('ai-preview').hidden"));
  await click("ai-consent");check("撤回同意再次停用",await E("document.getElementById('ai-arrange').disabled"));
  for(const width of [320,390,768,1280]){await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<600});check(width+"px AI 介面無橫向溢出",await E("document.documentElement.scrollWidth<=innerWidth"));}
  const shots=process.argv[2];
  if(shots){
    mode="good";await click("ai-consent");await set("item-1-action","");await click("ai-arrange");await settled();
    fs.mkdirSync(shots,{recursive:true});
    for(const width of [1280,390]){
      await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<600});
      await E("document.querySelector('.ai-planner').scrollIntoView({block:'start'});document.activeElement.blur()");await delay(100);
      const shot=await send("Page.captureScreenshot",{format:"png"});fs.writeFileSync(path.join(shots,"sticker-ai-"+width+".png"),Buffer.from(shot.data,"base64"));
    }
  }
  check("AI 介面無未處理例外",errors.length===0);
  process.stdout.write("SUMMARY AI UI mocked-upstream passed="+checks.length+" failed=0\n");
  await send("Browser.close");
})().catch(e=>{process.stderr.write("FAIL "+e.stack+"\n");process.exitCode=1;}).finally(async()=>{
  if(ws)ws.close();if(browser&&!browser.killed)browser.kill();if(server)server.close();
  for(let i=0;i<20;i++){try{fs.rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
  if(fs.existsSync(profile)){process.stderr.write("暫存未清理："+profile+"\n");process.exitCode=1;}else process.stdout.write("CLEANUP complete\n");
});
