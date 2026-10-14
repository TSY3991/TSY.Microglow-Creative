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

  await send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:profile});
  await set('count','8');
  check('去白底預設關閉',await E("!document.getElementById('crop-white').checked"));
  const upload=async(rowsList=[2],kind='valid')=>E('(async()=>{const dt=new DataTransfer();for(const rows of '+JSON.stringify(rowsList)+'){let file;if('+JSON.stringify(kind)+"==='valid'){const c=document.createElement('canvas');c.width=800;c.height=rows*180;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);for(let i=0;i<rows*4;i++){const a=i%4*200,b=Math.floor(i/4)*180;x.fillStyle=i===2?'#ff0000':'#008080';x.fillRect(a+40,b+25,120,130);x.fillStyle='white';x.fillRect(a+75,b+60,50,50);}const blob=await new Promise(r=>c.toBlob(r));file=new File([blob],'mother-'+rows+'.png',{type:'image/png'});}else file=new File(['broken'],'broken.'+('"+kind+"'==='broken'?'png':'svg'),{type:'"+(kind==='broken'?'image/png':'image/svg+xml')+"'});dt.items.add(file);}const e=document.getElementById('crop-files');e.files=dt.files;e.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,350));})()");
  const run=async(n)=>{await click('crop-run');for(let i=0;i<100;i++){if(await E("document.querySelectorAll('.crop-sticker').length==="+n+"&&!document.getElementById('crop-run').disabled"))return;await delay(50);}throw Error('裁切未完成');};
  await upload();await run(8);
  check('保留原圖白底',await E("document.querySelector('.crop-sticker canvas').getContext('2d').getImageData(30,30,1,1).data[3]===255"));
  for(const kind of ['broken','svg']){await upload([2],kind);check('拒絕 '+kind+' 保留母圖',await E("document.querySelectorAll('.crop-mother').length===1"));}
  await click('crop-white');await run(8);
  check('去白底後邊緣透明且封閉白色保留',await E("(()=>{const x=document.querySelector('.crop-sticker canvas').getContext('2d');return x.getImageData(30,30,1,1).data[3]===0&&x.getImageData(185,160,1,1).data[0]===255&&x.getImageData(185,160,1,1).data[3]===255;})()"));
  await E("document.querySelectorAll('[name=crop-main]')[2].click()");
  check('主要圖片採用第三張',await E("(()=>{const p=document.querySelector('#crop-special canvas').getContext('2d').getImageData(120,30,1,1).data;return p[0]===255&&p[1]===0&&p[2]===0&&p[3]===255;})()"));
  await click('crop-review');await click('crop-download');
  const zipPath=path.join(profile,'line-stickers-8.zip');for(let i=0;i<80&&!fs.existsSync(zipPath);i++)await delay(100);
  const data=fs.readFileSync(zipPath),files=[];let offset=0;const C=require('../sticker-crop-core.js');
  while(data.readUInt32LE(offset)===0x04034b50){const size=data.readUInt32LE(offset+18),length=data.readUInt16LE(offset+26),name=data.toString('utf8',offset+30,offset+30+length),start=offset+30+length,png=data.subarray(start,start+size);assert.equal(C.crc(png),data.readUInt32LE(offset+14));const width=png.readUInt32BE(16),height=png.readUInt32BE(20);let found=false;for(let p=8;p<png.length;){const n=png.readUInt32BE(p),type=png.toString('ascii',p+4,p+8);assert.equal(C.crc(png.subarray(p+4,p+8+n)),png.readUInt32BE(p+8+n));if(type==='pHYs'){assert.equal(png.readUInt32BE(p+8),2835);assert.equal(png[p+16],1);found=true;}p+=12+n;}assert.ok(found);assert.ok(size<=1048576);files.push({name,width,height});offset=start+size;}
  check('真實 ZIP 完整包含 10 PNG 且 CRC 與 72 dpi 正確',files.length===10&&files[0].width===240&&files[1].width===96&&files.slice(2).every(f=>f.width===370&&f.height===320));
  check('ZIP 檔名順序',files.map(f=>f.name).join(',')==='main.png,tab.png,01.png,02.png,03.png,04.png,05.png,06.png,07.png,08.png');
  await click('crop-white');await run(8);check('關閉去白底可從原圖還原',await E("document.querySelector('.crop-sticker canvas').getContext('2d').getImageData(30,30,1,1).data[3]===255"));
  await E("const cut=document.querySelector('.crop-mother input[type=number]');cut.value='0';cut.dispatchEvent(new Event('change'))");await click('crop-run');await delay(100);check('非法分割線阻擋輸出',await E("document.getElementById('crop-status').textContent.includes('分割線')&&document.querySelectorAll('.crop-sticker').length===0"));
  await E("document.querySelector('.crop-mother button').click()");await run(8);
  await set('count','24');check('張數變更保留原圖但清除舊輸出',await E("document.querySelectorAll('.crop-mother').length===1&&document.querySelectorAll('.crop-sticker').length===0"));
  await click('crop-run');await delay(100);check('格數不足阻擋',await E("document.getElementById('crop-status').textContent.includes('總格數')"));
  await click('crop-clear');await upload([4,2]);await run(24);check('24 張多母圖順序與網格',await E("document.querySelectorAll('.crop-sticker').length===24&&document.querySelectorAll('.crop-mother select')[0].value==='4'&&document.querySelectorAll('.crop-mother select')[1].value==='2'"));
  await click('crop-clear');await set('count','40');await upload([4,4,2]);await run(40);check('40 張最大組數裁切成功',await E("document.querySelectorAll('.crop-sticker').length===40"));
  await click('crop-review');await click('crop-download');
  const maxZip=path.join(profile,'line-stickers-40.zip');for(let i=0;i<80&&!fs.existsSync(maxZip);i++)await delay(100);
  const maxData=fs.readFileSync(maxZip);check('40 張實際 ZIP 共 42 個檔案',maxData.readUInt16LE(maxData.length-12)===42);
  await E("document.querySelector('.crop-sticker input[type=range]').value='50';document.querySelector('.crop-sticker input[type=range]').dispatchEvent(new Event('input'))");
  check('逐張調整後要求重新確認',await E("!document.getElementById('crop-review').checked&&document.getElementById('crop-download').disabled"));
  for(const width of [320,390,768,1280]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});check(width+'px 裁切預覽無溢出',await E('document.documentElement.scrollWidth<=innerWidth'));}
  check('母圖處理未呼叫 AI',responses.every(r=>!r.url.includes('workers.dev')));
  await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Line/14.0.0'});await send('Page.reload',{ignoreCache:true});await loaded();await E('window.confirm=()=>true');await set('count','8');
  check('LINE 內建瀏覽器加入圖片前即提示限制',await E("!document.getElementById('crop-browser-help').hidden&&document.getElementById('crop-browser-help').textContent.includes('重新加入母圖')"));
  await upload();await run(8);await click('crop-review');
  await E("Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files.length===1&&files[0].type==='application/zip'});Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{window.sharedFiles=files.map(f=>({name:f.name,size:f.size}));window.sharedFromClick=navigator.userActivation.isActive;}})");
  const beforeApp=fs.readdirSync(profile).filter(f=>f.endsWith('.zip')).length;
  await click('crop-download');await delay(400);
  check('LINE 打包不自動觸發受阻下載且保留 ZIP',fs.readdirSync(profile).filter(f=>f.endsWith('.zip')).length===beforeApp&&await E("!document.getElementById('crop-ready').hidden&&!document.getElementById('crop-share').hidden"));
  await click('crop-share');await delay(100);
  check('分享 ZIP 由新點擊觸發且包含真實 File（模擬 API）',await E("window.sharedFromClick&&window.sharedFiles.length===1&&window.sharedFiles[0].name==='line-stickers-8.zip'&&window.sharedFiles[0].size>100"));
  await E("Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancel','AbortError')}})");await click('crop-share');await delay(100);
  check('分享取消保留打包檔案，可再次嘗試',await E("document.getElementById('crop-status').textContent.includes('取消')&&!document.getElementById('crop-ready').hidden&&!document.getElementById('crop-share').disabled"));
  await E("Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files.every(f=>f.type==='image/png')});Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{window.sharedFiles=files.map(f=>f.name);}})");await click('crop-download');await delay(400);await click('crop-share');await delay(100);
  check('ZIP 不可分享時提供全部 PNG，明確標示未打包（模擬 API）',await E("document.getElementById('crop-share').textContent.includes('未打包')&&window.sharedFiles.length===10&&window.sharedFiles.includes('main.png')&&window.sharedFiles.includes('08.png')"));
  await E("Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false})");await click('crop-download');await delay(400);
  check('不支援檔案分享則隱藏分享，不假裝成功',await E("document.getElementById('crop-share').hidden&&!document.getElementById('crop-ready').hidden&&document.getElementById('crop-ready-info').textContent.includes('不代表已保存')"));
  fs.unlinkSync(zipPath);await click('crop-save-zip');for(let i=0;i<80&&!fs.existsSync(zipPath);i++)await delay(100);check('已打包 ZIP 可由獨立按鈕再次實際下載',fs.existsSync(zipPath)&&fs.statSync(zipPath).size>100);
  await E("document.querySelector('.crop-sticker input[type=range]').dispatchEvent(new Event('input'))");check('修改圖片使已打包舊檔失效',await E("document.getElementById('crop-ready').hidden&&document.getElementById('crop-save-zip').disabled"));
  for(const width of [320,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});check(width+'px 外部瀏覽器提示無溢出',await E('document.documentElement.scrollWidth<=innerWidth'));}
  if(process.argv[2]){await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await E("document.getElementById('sticker-crop').scrollIntoView()");await delay(100);const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.argv[2],Buffer.from(shot.data,'base64'));}
  check("頁面無未處理例外",errors.length===0);
  check("本工具所有本機資源成功載入",responses.filter(x=>x.url.startsWith(origin)).every(x=>x.status<400));
  process.stdout.write("SUMMARY passed="+checks.length+" failed=0\n");
  await send("Browser.close");
})().catch(e=>{process.stderr.write("FAIL "+e.stack+"\n");process.exitCode=1;}).finally(async()=>{
  if(ws)ws.close();if(browser&&!browser.killed)browser.kill();if(server)server.close();
  for(let i=0;i<20;i++){try{fs.rmSync(profile,{recursive:true,force:true});break;}catch{await delay(100);}}
  if(fs.existsSync(profile)){process.stderr.write("暫存未清理："+profile+"\n");process.exitCode=1;}else process.stdout.write("CLEANUP complete\n");
});
