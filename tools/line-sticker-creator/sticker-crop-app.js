(function(){
  'use strict';
  const C=window.StickerCropCore,$=id=>document.getElementById(id),el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  let plan=window.StickerCropPlan,mothers=[],stickers=[],adjust=[],revision=0,uploadRevision=0,selected=0,busy=false;
  let prepared=null;
  const inApp=/Line\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
  function clearPrepared(){prepared=null;$('crop-ready').hidden=true;}
  const canvas=(w,h)=>{const c=el('canvas');c.width=w;c.height=h;return c;};
  const message=text=>{$('crop-status').textContent=text;};
  const names=list=>list.map(n=>n).join('、');
  const brand=window.StickerBrand(()=>{
    touched();$('crop-review').checked=false;controls();
    if(stickers.length)renderResults();
  });
  // keep=true：只因去白底設定而重裁，保留每張已調整的大小與位置；其餘變更（母圖、網格、張數）一律歸零。
  function invalidate(keep){
    revision++;clearPrepared();mainNote='';
    if(keep){if(stickers.length)adjust=stickers.map(s=>({zoom:s.zoom,dx:s.dx,dy:s.dy}));}else{adjust=[];selected=0;}
    stickers=[];$('crop-brand-preview').getContext('2d').clearRect(0,0,1110,960);$('crop-brand-preview-hint').textContent='裁切後顯示預覽。';$('crop-results').replaceChildren();$('crop-special').replaceChildren();$('crop-review').checked=false;$('crop-download').disabled=true;
  }
  // 只有四個角落都不透明才提醒；角色剛好碰到格角時可能誤報，因此僅提示、不阻擋。
  function opaqueCorners(source){const w=source.width,h=source.height,ctx=source.getContext('2d');return [[0,0],[w-1,0],[0,h-1],[w-1,h-1]].every(([x,y])=>ctx.getImageData(x,y,1,1).data[3]>=250);}
  const opaqueList=()=>stickers.map((s,i)=>s.opaque?i+1:0).filter(Boolean);
  function controls(){
    if(prepared&&prepared.revision!==revision)clearPrepared();
    const checked=$('crop-review').checked,blank=stickers.map((s,i)=>s.source?0:i+1).filter(Boolean);
    const cells=mothers.reduce((n,m)=>n+m.rows*4,0),match=$('crop-match');
    match.hidden=!mothers.length;match.classList.toggle('notice',mothers.length>0&&cells!==plan.count);
    const text=$('crop-match-text'),fix=$('crop-match-fix'),fixable=mothers.length>0&&cells!==plan.count&&C.counts.includes(cells);
    if(mothers.length)text.textContent=cells===plan.count?'✔ 已放 '+mothers.length+' 張母圖，共 '+cells+' 格，和目前設定的 '+plan.count+' 張相符，可以裁切。':'⚠ 目前母圖共 '+cells+' 格，但第二步設定是 '+plan.count+' 張，兩者必須一樣才能裁切。'+(fixable?'按下面的按鈕，把張數改成和母圖一樣的 '+cells+' 張。':'可調整每張母圖的「格數」（4×2／4×4）、增減母圖，或回第二步改張數。');
    fix.hidden=!fixable;if(fixable)fix.textContent='把張數改成 '+cells+' 張';
    $('crop-run').disabled=busy;$('crop-files').disabled=busy;$('crop-clear').disabled=busy;
    const smart=$('crop-mode').value==='smart';
    $('crop-mode').disabled=busy;$('crop-white').disabled=busy||smart;$('crop-strength').disabled=busy||(!smart&&!$('crop-white').checked);
    document.querySelectorAll('#crop-mothers button,#crop-mothers select,#crop-mothers input,#crop-results button,#crop-results input').forEach(e=>{e.disabled=busy;});
    document.querySelectorAll('#crop-brand input,#crop-brand button').forEach(e=>{e.disabled=busy;});
    $('crop-download').disabled=busy||brand.loading()||!stickers.length||blank.length>0||!checked;
    for(const id of ['crop-save-zip','crop-share'])$(id).disabled=busy||!prepared||!checked;
    let hint='';
    if(!busy){
      if(brand.loading())hint='商標讀取中，請稍候。';
      else if(!mothers.length)hint='請先加入母圖。';
      else if(!stickers.length)hint='請先按「確認分割線並裁切」。';
      else if(blank.length)hint='第 '+names(blank)+' 張是空白格（全透明），請調整母圖分割線後重新裁切。';
      else if(!checked)hint='請先勾選上方的逐張檢查，才能打包下載。';
    }
    $('crop-download-hint').textContent=hint;
  }
  // 調整貼圖或代表圖片後，已打包的 ZIP 內容已過期；保留勾選的檢查狀態，只要求重新打包。
  function touched(){const had=!!prepared;revision++;controls();if(had)message('已調整圖片，先前打包的 ZIP 已失效，請重新按「打包 PNG 並下載 ZIP」。');}
  function canShare(files){try{return typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files});}catch{return false;}}
  function downloadPrepared(){if(!prepared||prepared.revision!==revision||!$('crop-review').checked)return;const url=URL.createObjectURL(prepared.file),a=el('a');a.href=url;a.download=prepared.file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('已送出下載請求，請確認瀏覽器下載清單。若未收到檔案，可再按一次下載或用系統分享；仍不行就只能改用 Chrome／Safari 從頭做一次（目前進度不會帶過去）。');}
  $('crop-save-zip').onclick=downloadPrepared;
  $('crop-share').onclick=async()=>{if(busy||!prepared||prepared.revision!==revision||!$('crop-review').checked)return;const snapshot=prepared;busy=true;controls();try{await navigator.share({files:snapshot.shareFiles});if(prepared===snapshot)message('已交由系統分享處理，請在選擇的目的地確認檔案是否保存。');}catch(error){if(prepared===snapshot)message(error.name==='AbortError'?'分享已取消或沒有可用的目的地；檔案仍保留，可再次下載或分享。':'系統未能分享檔案；檔案仍保留。只能改用 Chrome／Safari 開啟本頁，從頭加入母圖並下載（目前進度不會帶過去）。');}finally{busy=false;controls();}};
  $('crop-copy-url').onclick=async()=>{const url='https://tsy3991.github.io/TSY.Microglow-Creative/tools/line-sticker-creator/#sticker-crop';try{await navigator.clipboard.writeText(url);message('已複製網址。貼到 Chrome／Safari 開啟後請從頭開始；目前頁面的母圖與進度不會帶過去，設定可先用「匯出設定檔」帶過去。');}catch{const input=$('crop-page-url');input.hidden=false;input.value=url;input.focus();input.select();message('無法自動複製，請手動複製已選取的網址。');}};
  function updatePlan(){plan=window.StickerCropPlan;$('crop-plan').textContent='目前 '+plan.count+' 張；母圖依序 '+plan.grids.map(n=>'4×'+n/4).join(' ＋ ');}
  window.addEventListener('sticker-crop-plan',()=>{const next=window.StickerCropPlan;if(JSON.stringify(plan)!==JSON.stringify(next)){updatePlan();invalidate();controls();message('張數或母圖分配已變更，原圖保留，請確認網格後重新裁切。');}});
  // 自動建議：母圖放入或分割線變動後，在背景快速分析（縮小到 900 px 內，不上傳），建議智慧分割或硬切。
  let adviceTimer=0,adviceToken=0,advicePending=null,adviceDone=null,modeChosen=false;
  const tolerance=()=>({248:12,240:24,230:40}[Number($('crop-strength').value)]||12);
  async function analyze(m){
    const tol=tolerance(),key=JSON.stringify([m.x,m.y,tol]);
    if(m.analysis&&m.analysis.key===key)return m.analysis.value;
    let value=null;
    try{
      const w=m.image.width,h=m.image.height,k=Math.min(1,900/Math.max(w,h)),sw=Math.max(4,Math.round(w*k)),sh=Math.max(4,Math.round(h*k));
      const c=canvas(sw,sh),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(m.image,0,0,sw,sh);
      const image=ctx.getImageData(0,0,sw,sh);c.width=c.height=1;
      const scale=(a,from,to)=>a.map((v,i)=>i===0?0:i===a.length-1?to:Math.round(v*to/from)),ok=a=>a.every((v,i)=>!i||v>a[i-1]);
      let xs=scale(m.x,w,sw),ys=scale(m.y,h,sh);if(!ok(xs))xs=C.cuts(sw,4);if(!ok(ys))ys=C.cuts(sh,m.rows);
      const split=C.splitByContent(image.data,sw,sh,xs,ys,tol);
      value={advice:C.advise(split),clipped:split?split.clipped:[]};
    }catch{return null;}
    m.analysis={key,value};return value;
  }
  const offsetOf=i=>mothers.slice(0,i).reduce((n,m)=>n+m.rows*4,0);
  const modeName=mode=>mode==='smart'?'智慧分割':'硬切';
  function adviceButtons(){
    const advice=$('crop-advice').dataset.mode;
    for(const mode of ['smart','hard']){const b=$('crop-advice-'+mode),on=$('crop-mode').value===mode;b.textContent=modeName(mode)+(advice===mode?'（建議）':'')+(on?'・目前選用':'');b.setAttribute('aria-pressed',String(on));b.classList.toggle('primary',on);}
  }
  function showAdvice(list){
    const known=list.filter(Boolean);if(!known.length){$('crop-advice').hidden=true;return;}
    const mode=known.some(a=>a.advice.mode==='smart')?'smart':'hard',box=$('crop-advice');box.dataset.mode=mode;
    $('crop-advice-title').textContent='我檢查了母圖，建議用「'+modeName(mode)+'」';
    $('crop-advice-list').replaceChildren(...list.map((a,i)=>a?el('li',(list.length>1?'母圖 '+(i+1)+'：':'')+a.advice.reasons[0]):null).filter(Boolean));
    const clipped=list.flatMap((a,i)=>a?a.clipped.map(k=>offsetOf(i)+k+1):[]);
    $('crop-advice-clip').hidden=!clipped.length;
    if(clipped.length)window.dispatchEvent(new Event('sticker-clipped'));
    if(clipped.length)$('crop-advice-clip').textContent='注意：第 '+names(clipped)+' 張的圖案貼著格子邊緣，母圖在這裡可能已被生成工具切平，兩種裁切方式都救不回來。網站已自動把提示詞的格子留白加到最寬，請回到提示詞頁重新複製，再生成那張母圖。';
    if(!modeChosen&&$('crop-mode').value!==mode){$('crop-mode').value=mode;controls();}
    box.hidden=false;adviceButtons();
  }
  function scheduleAdvice(){
    clearTimeout(adviceTimer);const token=++adviceToken;
    if(adviceDone){adviceDone();adviceDone=null;} // 被取代的排程也要放行，否則正在等它的「裁切」會永遠卡住
    if(!mothers.length){$('crop-advice').hidden=true;advicePending=null;return;}
    let done;advicePending=new Promise(resolve=>{done=resolve;});adviceDone=done;
    adviceTimer=setTimeout(async()=>{
      try{const list=[];for(const m of mothers.slice()){list.push(await analyze(m));if(token!==adviceToken)return;await new Promise(r=>setTimeout(r));}showAdvice(list);}
      catch{}finally{if(token===adviceToken)advicePending=null;done();}
    },300);
  }
  const chooseMode=mode=>{$('crop-mode').value=mode;$('crop-mode').dispatchEvent(new Event('change'));};
  $('crop-advice-smart').onclick=()=>chooseMode('smart');$('crop-advice-hard').onclick=()=>chooseMode('hard');
  // 母圖是 4×4 還是 4×2（僅「加入母圖」自由上傳用；步驟四逐張卡片以第二步的分配為準）：圖片長寬比明顯接近其中一種就照圖片判斷，例如設定 16 張卻放兩張 16 格的圖；看不出來才依第二步的分配。
  function guessRows(image,index){
    const r=image.width/image.height,r4=C.expectedSize(4).width/C.expectedSize(4).height,r2=C.expectedSize(2).width/C.expectedSize(2).height,d4=Math.abs(r-r4)/r4,d2=Math.abs(r-r2)/r2;
    if(Math.min(d4,d2)<0.3)return d4<=d2?4:2;
    return (plan.grids[index]||8)/4;
  }
  function resetCuts(m){m.x=C.cuts(m.image.width,4);m.y=C.cuts(m.image.height,m.rows);}
  function drawMother(m,c,active){
    const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(m.image,0,0,c.width,c.height);
    const line=(axis,v,on)=>{ctx.strokeStyle=on?'#0a7cff':'#ff3060';ctx.lineWidth=on?4:2;ctx.beginPath();if(axis==='x'){const p=v/m.image.width*c.width;ctx.moveTo(p,0);ctx.lineTo(p,c.height);}else{const p=v/m.image.height*c.height;ctx.moveTo(0,p);ctx.lineTo(c.width,p);}ctx.stroke();};
    m.x.slice(1,-1).forEach((v,k)=>line('x',v,!!active&&active.axis==='x'&&active.index===k+1));
    m.y.slice(1,-1).forEach((v,k)=>line('y',v,!!active&&active.axis==='y'&&active.index===k+1));
  }
  function button(text,fn){const b=el('button',text);b.type='button';b.className='button small';b.onclick=fn;return b;}
  function renderMothers(){
    $('crop-mothers').replaceChildren();mothers.forEach((m,i)=>{
      const box=el('article'),info=el('div'),view=el('div');box.className='crop-mother';info.className='crop-mother-info';view.className='crop-mother-view';
      const want=C.expectedSize(m.rows),gap=C.ratioGap(m.image.width,m.image.height,m.rows),cw=m.image.width/4,ch=m.image.height/m.rows;
      info.append(el('h3','母圖 '+(i+1)+'｜'+m.file.name),el('p',m.image.width+' × '+m.image.height+' px；每格約 '+Math.round(cw)+' × '+Math.round(ch)+' px'));
      const note=el('p','建議尺寸 '+want.width+' × '+want.height+' px（每格 '+C.cell.width+' × '+C.cell.height+'）。'+(gap>0.05?'此圖長寬比與建議相差約 '+Math.round(gap*100)+'%，每格形狀會和 370×320 不同；仍可裁切，輸出會等比縮放進 370×320。':'長寬比符合建議。')+(cw<370||ch<320?' 每格小於 370×320，輸出時會放大而略顯模糊。':''));
      note.className='field-hint';info.append(note);
      const gridLabel=el('label'),grid=el('select');gridLabel.className='field';gridLabel.append(el('span','這張母圖的格數'));grid.setAttribute('aria-label','母圖 '+(i+1)+' 裁切網格');grid.add(new Option('4×2（8 格）',2));grid.add(new Option('4×4（16 格）',4));grid.value=m.rows;
      grid.onchange=()=>{m.rows=Number(grid.value);resetCuts(m);invalidate();renderMothers();controls();};gridLabel.append(grid);info.append(gridLabel);
      const previewScale=Math.min(600/m.image.width,450/m.image.height),c=canvas(Math.max(1,Math.round(m.image.width*previewScale)),Math.max(1,Math.round(m.image.height*previewScale)));c.className='crop-mother-preview';c.setAttribute('aria-label','母圖與分割線預覽（紅線為分割線，藍線為正在調整）');drawMother(m,c);view.append(c);
      const details=el('details');details.open=true;details.append(el('summary','調整分割線（拖曳時預覽即時移動）'));
      const tip=el('p','藍色線是正在調整的那一條；用滑鼠可以直接在上方母圖拖曳線條（手機請用滑桿與箭頭）；數字單位是像素，數字越大，直線越往右、橫線越往下。智慧分割時分割線只用來決定圖案歸哪一格；硬切時就是實際切開的位置。');tip.className='field-hint';details.append(tip);const groups=el('div');groups.className='cut-groups';details.append(groups);
      const lineList=[];
      for(const [axis,title] of [['x','直線'],['y','橫線']]){const group=el('div');group.className='cut-group';group.append(el('h4',axis==='x'?'直線（左右切，用 ← → 移動）':'橫線（上下切，用 ↑ ↓ 移動）'));groups.append(group);m[axis].slice(1,-1).forEach((value,k)=>{
        const idx=k+1,size=axis==='x'?m.image.width:m.image.height,name='母圖 '+(i+1)+' '+title+' '+idx;
        const row=el('div'),range=el('input'),num=el('input');row.className='cut-row';
        range.type='range';range.min=1;range.max=size-1;range.step=1;range.value=value;range.setAttribute('aria-label',name+'（拖曳即時預覽）');
        num.type='number';num.min=1;num.max=size-1;num.step=1;num.value=value;num.setAttribute('aria-label',name+' 像素位置');
        const apply=v=>{const next=Math.min(m[axis][idx+1]-1,Math.max(m[axis][idx-1]+1,Math.round(v)));m[axis][idx]=next;range.value=next;num.value=next;invalidate();drawMother(m,c,{axis,index:idx});controls();scheduleAdvice();};
        const done=()=>{num.value=m[axis][idx];range.value=m[axis][idx];drawMother(m,c);message(name+' 已調整為 '+m[axis][idx]+' px，請重新裁切。');};
        range.oninput=()=>apply(Number(range.value));num.oninput=()=>{if(num.value!==''&&Number.isFinite(Number(num.value)))apply(Number(num.value));};
        range.onchange=done;num.onchange=done;lineList.push({axis,idx,apply,done});
        const nudge=(sym,tip,d)=>{const b=el('button',sym);b.type='button';b.className='button small nudge';b.title=tip+'（'+name+'）';b.setAttribute('aria-label',name+tip);b.onclick=()=>{apply(m[axis][idx]+d);message(name+' 目前在 '+m[axis][idx]+' px，請重新裁切。');};return b;};
        const top=el('div');top.className='cut-top';
        top.append(el('span',title+' '+idx),nudge(axis==='x'?'←':'↑',axis==='x'?'向左移 1 像素':'向上移 1 像素',-1),num,nudge(axis==='x'?'→':'↓',axis==='x'?'向右移 1 像素':'向下移 1 像素',1));
        row.append(top,range);group.append(row);
      });}
      info.append(details);
      // 直接在母圖預覽上拖分割線（滑鼠／觸控筆；手指觸控會和捲動衝突，仍用滑桿與箭頭）。
      let drag=null;
      const near=ev=>{
        const r=c.getBoundingClientRect(),px=ev.clientX-r.left,py=ev.clientY-r.top;let best=null,gap=10;
        for(const L of lineList){const v=m[L.axis][L.idx],d=Math.abs(L.axis==='x'?px-v/m.image.width*r.width:py-v/m.image.height*r.height);if(d<gap){gap=d;best=L;}}
        return best;
      };
      const toValue=(ev,L)=>{const r=c.getBoundingClientRect();return L.axis==='x'?(ev.clientX-r.left)/r.width*m.image.width:(ev.clientY-r.top)/r.height*m.image.height;};
      c.addEventListener('pointermove',ev=>{
        if(ev.pointerType==='touch'||busy)return;
        if(drag){drag.apply(toValue(ev,drag));return;}
        const L=near(ev);c.classList.toggle('line-x',!!L&&L.axis==='x');c.classList.toggle('line-y',!!L&&L.axis==='y');
      });
      c.addEventListener('pointerdown',ev=>{
        if(ev.pointerType==='touch'||busy||ev.button!==0)return;
        const L=near(ev);if(!L)return;drag=L;try{c.setPointerCapture(ev.pointerId);}catch{}ev.preventDefault();
      });
      const release=()=>{if(!drag)return;const L=drag;drag=null;L.done();};
      c.addEventListener('pointerup',release);c.addEventListener('pointercancel',release);
      const actions=el('div');actions.className='inline-actions';actions.append(button('平均分割',()=>{resetCuts(m);invalidate();renderMothers();controls();}),button('前移',()=>{if(i){[mothers[i-1],mothers[i]]=[m,mothers[i-1]];invalidate();renderMothers();controls();}}),button('後移',()=>{if(i<mothers.length-1){[mothers[i+1],mothers[i]]=[m,mothers[i+1]];invalidate();renderMothers();controls();}}),button('移除',()=>{uploadRevision++;m.image.close();mothers.splice(i,1);invalidate();renderMothers();controls();}));info.append(actions);
      box.append(info,view);$('crop-mothers').append(box);
    });
    window.dispatchEvent(new Event('sticker-mothers-changed'));scheduleAdvice();
  }
  $('crop-files').onchange=async()=>{
    const files=Array.from($('crop-files').files);$('crop-files').value='';if(!files.length)return;const token=++uploadRevision,incoming=[];
    try{
      if(mothers.length+files.length>5)throw Error('最多保留 5 張母圖。');
      let pixels=mothers.reduce((n,m)=>n+m.image.width*m.image.height,0);
      for(const file of files){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('請選 PNG、JPG 或 WebP，單張最多 20 MB。');const image=await createImageBitmap(file);incoming.push({file,image,rows:guessRows(image,mothers.length+incoming.length)});if(image.width<4||image.height<4||image.width*image.height>16000000)throw Error('單張尺寸需至少 4×4，且不超過 1,600 萬像素。');pixels+=image.width*image.height;if(pixels>32000000)throw Error('母圖合計最多 3,200 萬像素，請縮小圖片。');}
      if(token!==uploadRevision){incoming.forEach(m=>m.image.close());return;}
      incoming.forEach(resetCuts);mothers.push(...incoming);invalidate();renderMothers();message('母圖已加入。請確認順序與分割線，再裁切。');
    }catch(error){incoming.forEach(m=>m.image.close());if(token===uploadRevision)message('未加入圖片，原圖保留：'+error.message);}
    finally{controls();}
  };
  function renderSticker(s,target,W=370,H=320,pad=10){const ctx=target.getContext('2d');ctx.clearRect(0,0,W,H);if(s.source){const f=C.fit(s.source.width,s.source.height,W,H,W===370?s.zoom:100,W===370?s.dx:0,W===370?s.dy:0,pad);ctx.drawImage(s.source,f.x,f.y,f.width,f.height);if(W===370)return brand.draw(target);}}
  function openEditor(s,i,opener){
    const m=mothers[s.mother];if(!m||!window.StickerEditor||busy)return;
    window.StickerEditor.open({image:m.image,outside:m.outside||null,mw:m.image.width,mh:m.image.height,rect:s.rect,source:s.source,at:s.at,auto:s.auto||null,remove:s.remove,threshold:s.threshold,opener,label:String(i+1).padStart(2,'0')+'.png',
      onDone:(canvas,at)=>{if(!s.auto)s.auto={source:s.source,at:s.at};s.source=canvas;s.at=at;s.edited=true;s.opaque=false;s.joined=false;s.clipped=false;renderResults();touched();message(String(i+1).padStart(2,'0')+'.png 已修圖；重新按「確認分割線並裁切」會回到自動結果。');}});
  }
  // main／tab 可以另外修圖（例如去掉文字，只留角色），不影響 01～N 的貼圖。
  const forMain=s=>s.mainSource?{...s,source:s.mainSource,zoom:100,dx:0,dy:0}:s;
  // 一鍵：把選中貼圖中和角色不相連的文字／裝飾擦掉，再清小碎片，只用在 main／tab。
  let mainNote='';
  function autoMain(){
    const s=stickers[selected];if(!s||!s.source||busy)return;
    const w=s.source.width,h=s.source.height,ctx=s.source.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,w,h);
    const found=C.textBlobs(img.data,w,h);
    if(!found.count){mainNote='沒有找到可以自動分開的文字：文字的外框和角色（或太陽、愛心等裝飾）連在一起，電腦分不出來，所以沒有任何變化。請按「手動修圖」：虛線框已放在角色外框上，調整後按「框外擦掉」，或用「分塊」點選整欄文字。';message(mainNote);special();return;}
    for(let p=0;p<found.mask.length;p++)if(found.mask[p])img.data[p*4+3]=0;
    C.cleanSpecks(img.data,w,h);
    const b=C.bounds(img.data,w,h);if(!b){message('自動處理後畫面是空的，已保留原圖。');return;}
    const full=canvas(w,h);full.getContext('2d').putImageData(img,0,0);
    const out=canvas(b.width,b.height);out.getContext('2d').drawImage(full,b.x,b.y,b.width,b.height,0,0,b.width,b.height);
    let before=0,after=0;{const o=ctx.getImageData(0,0,w,h).data;for(let i=3;i<o.length;i+=4){if(o[i]>8)before++;if(img.data[i]>8)after++;}}
    const pct=before?Math.round((before-after)/before*100):0;
    mainNote=pct<3?'只擦掉了不到 3% 的內容，畫面幾乎沒變：文字的外框和角色（或太陽、愛心等裝飾）連在一起，電腦分不出來。請按「手動修圖」：虛線框已放在角色外框上，調整後按「框外擦掉」，或用「分塊」點選整欄文字。':'已擦掉約 '+pct+'% 的內容（'+found.count+' 個和角色分開的區塊）。如果文字還在，表示它和角色連在一起，請按「手動修圖」處理。';
    s.mainSource=out;s.mainAt={x:s.at.x+b.x,y:s.at.y+b.y};special();touched();
    message(mainNote);
  }
  function mainControls(){
    const s=stickers[selected],box=el('div');box.className='special-controls';
    box.append(el('p',s.mainSource?'main.png 與 tab.png 目前用第 '+String(selected+1).padStart(2,'0')+' 張「去除文字後」的版本（自動或手動修過）；要回到完整圖案按「還原成貼圖原樣」。':'main.png 與 tab.png 目前是第 '+String(selected+1).padStart(2,'0')+' 張的完整圖案（含文字）。想只留角色：按「自動去除文字」（會擦掉和角色分開的文字與裝飾），再用「手動修圖」微調；文字壓在角色身上時需要手動處理。','field-hint'));
    const autoBtn=button('自動去除文字',()=>autoMain());autoBtn.className='button small primary';box.append(autoBtn);
    if(mainNote){const n=el('p',mainNote);n.className='notice';n.setAttribute('role','status');box.append(n);}
    const edit=button(s.mainSource?'手動修圖（已自訂）':'手動修圖（只影響 main 與 tab）',()=>{
      const m=mothers[s.mother];if(!m||!window.StickerEditor||busy)return;
      const base=s.mainSource?{source:s.mainSource,at:s.mainAt}:{source:s.source,at:s.at};
      window.StickerEditor.open({image:m.image,outside:m.outside||null,mw:m.image.width,mh:m.image.height,rect:s.rect,source:base.source,at:base.at,auto:{source:s.source,at:s.at},remove:s.remove,threshold:s.threshold,opener:edit,label:'main／tab',
        hint:'這裡的修改只用在 main.png 與 tab.png。建議：調整虛線框後按「框外擦掉」去掉旁邊文字，單獨的字塊用「分塊」點選，缺口用「補平」。',
        cleanup:true,onDone:(canvas,at)=>{s.mainSource=canvas;s.mainAt=at;special();touched();message('main／tab 已自訂（不含文字的版本）；01～'+String(stickers.length).padStart(2,'0')+' 號貼圖不受影響。');}});
    });
    box.append(edit);
    if(s.mainSource){const back=button('還原成貼圖原樣',()=>{delete s.mainSource;delete s.mainAt;mainNote='';special();touched();});box.append(back);}
    $('crop-special').append(box);
  }
  function special(){ $('crop-special').replaceChildren();if(!stickers[selected]?.source)return;for(const [name,w,h,pad] of [['main.png',240,240,10],['tab.png',96,74,4]]){const box=el('div'),c=canvas(w,h);box.append(el('strong',name+'｜'+w+'×'+h),c);renderSticker(forMain(stickers[selected]),c,w,h,pad);$('crop-special').append(box);}mainControls();}
  function renderResults(){
    $('crop-results').replaceChildren();stickers.forEach((s,i)=>{const box=el('article');box.className='crop-sticker';box.append(el('h3',String(i+1).padStart(2,'0')+'.png'));const c=canvas(370,320);c.setAttribute('aria-label','貼圖 '+(i+1)+' 預覽');renderSticker(s,c);box.append(c);if(!s.source)box.append(el('p','此格全透明，請調整母圖分割線後重新裁切。'));else if(s.joined)box.append(el('p','圖案和相鄰貼圖相連，已順著圖案形狀分開；請檢查，必要時按下面的「修圖」擦掉多餘或補回被切掉的部分。'));else if(s.opaque)box.append(el('p','四個角落都不透明，背景可能還在。請用深色底確認；LINE 要求透明背景。'));if(s.clipped&&s.source)box.append(el('p','圖案貼著格子邊緣，母圖在這裡可能已被切掉。請檢查；必要時回提示詞頁重新複製提示詞（已自動加寬留白），重新生成這張母圖。'));
      if(s.source&&s.at){
        const edit=button(s.edited?'修圖（已修改過）':'修圖：擦掉多餘／補回被切掉的部分',()=>openEditor(s,i,edit));edit.className='button small';box.append(edit);
        if(s.edited)box.append(el('p','這張已手動修圖；重新裁切會回到自動結果。'));
      }
      const lab=el('label'),radio=el('input');radio.type='radio';radio.name='crop-main';radio.checked=i===selected;radio.onchange=()=>{selected=i;mainNote='';special();touched();};lab.append(radio,el('span','選為主要圖片／標籤圖片'));box.append(lab);
      for(const [key,title,min,max] of [['zoom','大小（%）',50,100],['dx','水平位移（px）',-180,180],['dy','垂直位移（px）',-150,150]]){const l=el('label',title),input=el('input');input.type='range';input.min=min;input.max=max;input.step=1;input.value=s[key];input.setAttribute('aria-label','貼圖 '+(i+1)+' '+title);input.oninput=()=>{s[key]=Number(input.value);renderSticker(s,c);updateBrandPreview();touched();};l.append(input);box.append(l);}
      box.append(button('還原大小與位置',()=>{s.zoom=100;s.dx=s.dy=0;renderResults();touched();}));$('crop-results').append(box);
    });special();updateBrandPreview();
  }
  function updateBrandPreview(){
    const target=$('crop-brand-preview'),ctx=target.getContext('2d'),first=$('crop-results').querySelector('canvas');ctx.clearRect(0,0,target.width,target.height);
    if(first){ctx.imageSmoothingEnabled=false;ctx.drawImage(first,0,0,target.width,target.height);}
    $('crop-brand-preview-hint').textContent=first?'這是輸出像素的 3 倍檢查，放大不會增加原始細節。':'裁切後顯示預覽。';
  }
  function hardCut(m,r,remove,threshold){
    const c=canvas(r.width,r.height),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(m.image,r.x,r.y,r.width,r.height,0,0,r.width,r.height);
    const pixels=ctx.getImageData(0,0,r.width,r.height);if(remove){pixels.data.set(C.eraseWhite(pixels.data,r.width,r.height,threshold));ctx.putImageData(pixels,0,0);}
    const b=C.bounds(pixels.data,r.width,r.height);let source=null,opaque=false;
    if(b){source=canvas(b.width,b.height);source.getContext('2d',{willReadFrequently:true}).drawImage(c,b.x,b.y,b.width,b.height,0,0,b.width,b.height);opaque=opaqueCorners(source);}
    c.width=c.height=1;return {source,opaque,b};
  }
  $('crop-match-fix').onclick=()=>{const cells=mothers.reduce((n,m)=>n+m.rows*4,0);if(C.counts.includes(cells))window.dispatchEvent(new CustomEvent('sticker-set-count',{detail:{count:cells}}));};
  $('crop-run').onclick=async()=>{
    if(busy)return;
    if(!mothers.length){message('還沒有母圖：請先按上方「加入母圖」選擇檔案，再回來按這個按鈕。');$('crop-files').scrollIntoView({block:'center'});$('crop-files').focus();return;}
    invalidate(true);const token=revision;busy=true;controls();const results=[],notes=[];
    try{
      let waiting;for(let n=0;n<20&&(waiting=advicePending);n++)await Promise.race([waiting,new Promise(r=>setTimeout(r,4000))]); // 最多等 4 秒，分析沒完成也照常裁切
      if(token!==revision)throw Error('設定已變更，請重新裁切。');
      const geometry=mothers.map((m,j)=>{try{return C.rectangles(m.image.width,m.image.height,m.x,m.y);}catch(error){throw Error('母圖 '+(j+1)+'：'+error.message);}});
      if(!C.counts.includes(plan.count)||geometry.reduce((n,a)=>n+a.length,0)!==plan.count)throw Error('總格數必須符合目前 '+plan.count+' 張設定；請調整母圖網格或第二步的張數。');
      const smart=$('crop-mode').value==='smart',remove=!smart&&$('crop-white').checked,threshold=Number($('crop-strength').value),tol=tolerance();
      message('裁切中 0／'+plan.count);
      for(let j=0;j<mothers.length;j++){
        const m=mothers[j];let split=null;const clipSet=new Set(((await analyze(m))||{clipped:[]}).clipped);
        if(smart){
          message('分析母圖 '+(j+1)+'／'+mothers.length+'…');await new Promise(requestAnimationFrame);
          const full=canvas(m.image.width,m.image.height),fctx=full.getContext('2d',{willReadFrequently:true});fctx.drawImage(m.image,0,0);
          const image=fctx.getImageData(0,0,full.width,full.height);full.width=full.height=1;
          split=C.splitByContent(image.data,m.image.width,m.image.height,m.x,m.y,tol);m.outside=split?split.outside:null;
          if(!split)notes.push('母圖 '+(j+1)+' 的背景不是單一顏色（有漸層、陰影或花紋），智慧去背無法使用，這張已改依分割線切開；要去掉白底可把「裁切方式」改成硬切並勾選「去除白色背景」');
        }
        for(let k=0;k<geometry[j].length;k++){
          if(token!==revision)throw Error('設定已變更，請重新裁切。');
          let source=null,opaque=false,joined=false,at=null,b=null;
          if(split){
            const cell=split.cells[k];
            if(cell){source=canvas(cell.width,cell.height);source.getContext('2d').putImageData(new ImageData(cell.data,cell.width,cell.height),0,0);at={x:cell.x,y:cell.y};}
            joined=split.merged.includes(k);
          }else{({source,opaque,b}=hardCut(m,geometry[j][k],remove,threshold));if(b)at={x:geometry[j][k].x+b.x,y:geometry[j][k].y+b.y};}
          const a=adjust[results.length]||{zoom:100,dx:0,dy:0};results.push({source,opaque,joined,clipped:clipSet.has(k),mother:j,rect:geometry[j][k],at,remove,threshold,zoom:a.zoom,dx:a.dx,dy:a.dy});
          if(results.length%8===0||results.length===plan.count)message('裁切中 '+results.length+'／'+plan.count);
          await new Promise(requestAnimationFrame);
        }
      }
      if(token!==revision)throw Error('設定已變更，請重新裁切。');
      stickers=results;if(selected>=results.length)selected=0;$('crop-review').checked=false;renderResults();
      const kept=adjust.some(a=>a.zoom!==100||a.dx||a.dy),opaque=opaqueList(),joined=results.map((x,n)=>x.joined?n+1:0).filter(Boolean),clippedList=results.map((x,n)=>x.clipped&&x.source?n+1:0).filter(Boolean);
      message('已裁切 '+stickers.length+' 張。'+(smart?'已依圖案歸格並去除外圍背景色；':(remove?'已移除邊緣相連的近白色；':'保留原圖背景；'))+(kept?'已保留先前的大小與位置調整；':'')+(joined.length?'第 '+names(joined)+' 張的圖案和相鄰貼圖相連，已順著圖案形狀分開，請檢查，必要時用「修圖」調整；':'')+(opaque.length?'第 '+names(opaque)+' 張四個角落都不透明，背景可能未去除；':'')+(clippedList.length?'第 '+names(clippedList)+' 張的圖案貼著格子邊緣，母圖可能已被切掉；':'')+(notes.length?notes.join('；')+'；':'')+'請用深淺預覽逐張檢查，確認後下載。');
    }catch(error){message(error.message);}finally{busy=false;controls();}
  };
  $('crop-mode').onchange=()=>{modeChosen=true;adviceButtons();controls();if(stickers.length){invalidate(true);controls();message('裁切方式已變更，請重新裁切；原圖與先前的大小位置調整會保留。');}};
  $('crop-white').onchange=()=>{controls();if(stickers.length){invalidate(true);controls();message('去白底設定已變更，請重新裁切；原圖與先前的大小位置調整會保留。');}};
  $('crop-strength').onchange=()=>{scheduleAdvice();if(($('crop-mode').value==='smart'||$('crop-white').checked)&&stickers.length){invalidate(true);controls();message('去白底強度已變更，請重新裁切；原圖與先前的大小位置調整會保留。');}};
  $('crop-backdrop').onchange=()=>{$('crop-results').dataset.backdrop=$('crop-backdrop').value;$('crop-special').dataset.backdrop=$('crop-backdrop').value;};
  $('crop-review').onchange=controls;
  $('crop-clear').onclick=()=>{if(!mothers.length)return;if(!confirm('移除此頁全部母圖與裁切預覽？原始檔案不受影響。'))return;uploadRevision++;mothers.forEach(m=>m.image.close());mothers=[];invalidate();renderMothers();controls();message('已移除母圖；電腦上的原始檔案保留。');};
  $('crop-download').onclick=async()=>{
    if(busy||brand.loading()||!$('crop-review').checked||stickers.length!==plan.count||stickers.some(s=>!s.source))return;busy=true;controls();const token=revision,entries=[],weak=[];
    try{
      const jobs=[['main.png',forMain(stickers[selected]),240,240,10],['tab.png',forMain(stickers[selected]),96,74,4],...stickers.map((s,i)=>[String(i+1).padStart(2,'0')+'.png',s,370,320,10])];
      for(const [name,s,w,h,pad] of jobs){if(token!==revision)throw Error('圖片設定已變更，請重新檢查後下載。');const c=canvas(w,h);const mark=renderSticker(s,c,w,h,pad);if(mark&&mark.marked&&!mark.placed)weak.push(name.replace('.png',''));const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('圖片編碼失敗。');entries.push({name,data:C.png72(new Uint8Array(await blob.arrayBuffer()))});c.width=c.height=1;}
      const data=C.zip(entries);if(token!==revision||!$('crop-review').checked)throw Error('設定已變更，請重新確認。');
      const file=new File([data],'line-stickers-'+plan.count+'.zip',{type:'application/zip'}),pngFiles=entries.map(e=>new File([e.data],e.name,{type:'image/png'}));
      const shareFiles=canShare([file])?[file]:canShare(pngFiles)?pngFiles:null;
      const opaque=opaqueList();
      prepared={file,shareFiles,revision:token};$('crop-ready').hidden=false;$('crop-ready-info').textContent='已準備 '+entries.length+' 個 PNG（含 main.png、tab.png），ZIP '+Math.ceil(data.length/1024)+' KB。打包完成不代表已保存至裝置。'+(weak.length?'提醒：第 '+weak.join('、')+' 張圖案太小，只有斜向淡色小字、沒有主標記。':'')+(opaque.length?'提醒：第 '+names(opaque)+' 張四個角落都不透明，LINE 要求透明背景。':'');$('crop-share').hidden=!shareFiles;$('crop-share').textContent=shareFiles?.length===1?'系統分享 ZIP 檔案':'系統分享全部 PNG（未打包）';
      if(inApp)message('偵測到 App 內建瀏覽器，未自動下載。可嘗試下方系統分享；若沒有分享功能或無法保存，只能改用 Chrome／Safari 從頭做一次（目前進度不會帶過去）。');else downloadPrepared();
    }catch(error){message('下載未完成：'+error.message);}finally{busy=false;controls();}
  };
  // 給「步驟四」逐張母圖卡片使用：直接收圖、複製圖片、自動裁切。
  const thumb=(i,max)=>{const m=mothers[i],c=canvas(1,1);if(!m)return c;const k=Math.min(max/m.image.width,max/m.image.height,1);c.width=Math.max(1,Math.round(m.image.width*k));c.height=Math.max(1,Math.round(m.image.height*k));c.getContext('2d').drawImage(m.image,0,0,c.width,c.height);c.className='mother-thumb';c.setAttribute('aria-hidden','true');return c;};
  async function setMother(i,file){
    if(busy)throw Error('正在處理中，請稍等一下再放圖。');
    if(i>mothers.length)throw Error('請先完成前一張母圖。');
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('這個檔案不能用。請選 PNG、JPG 或 WebP 圖片，單張最多 20 MB。');
    const token=++uploadRevision;let image;
    try{image=await createImageBitmap(file);}catch{throw Error('讀不到這張圖片，請換一張。');}
    const others=mothers.reduce((n,m,k)=>k===i?n:n+m.image.width*m.image.height,0);
    if(image.width<4||image.height<4||image.width*image.height>16000000){image.close();throw Error('圖片尺寸不合：至少 4×4，且不超過 1,600 萬像素。');}
    if(others+image.width*image.height>32000000){image.close();throw Error('母圖合計太大，請縮小圖片。');}
    if(token!==uploadRevision){image.close();throw Error('已被新的操作取代，請再放一次。');}
    const loaded={file,image,rows:(plan.grids[i]||8)/4};resetCuts(loaded);
    if(i<mothers.length){mothers[i].image.close();mothers[i]=loaded;}else mothers.push(loaded);
    invalidate();renderMothers();controls();message('母圖 '+(i+1)+' 已加入。');
  }
  async function copyImage(i){
    const m=mothers[i];if(!m)throw Error('沒有這張母圖。');
    if(!navigator.clipboard||typeof navigator.clipboard.write!=='function'||typeof ClipboardItem!=='function')throw Error('不支援');
    const c=canvas(m.image.width,m.image.height);c.getContext('2d').drawImage(m.image,0,0);
    const blob=new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('編碼失敗')),'image/png'));
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
  }
  window.StickerCrop={
    count:()=>mothers.length,
    info:i=>mothers[i]?{name:mothers[i].file.name,width:mothers[i].image.width,height:mothers[i].image.height}:null,
    thumb,set:setMother,copyImage,
    ready:()=>mothers.length>0&&mothers.reduce((n,m)=>n+m.rows*4,0)===plan.count,
    run:()=>{if(!busy&&window.StickerCrop.ready())$('crop-run').click();}
  };
  if(inApp)$('crop-browser-help').hidden=false;
  updatePlan();controls();
})();
