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
  // keep=true：只因去白底設定而重裁，保留每張已調整的大小與位置；其餘變更（母圖、網格、張數）一律歸零。
  function invalidate(keep){
    revision++;clearPrepared();
    if(keep){if(stickers.length)adjust=stickers.map(s=>({zoom:s.zoom,dx:s.dx,dy:s.dy}));}else{adjust=[];selected=0;}
    stickers=[];$('crop-results').replaceChildren();$('crop-special').replaceChildren();$('crop-review').checked=false;$('crop-download').disabled=true;
  }
  // 只有四個角落都不透明才提醒；角色剛好碰到格角時可能誤報，因此僅提示、不阻擋。
  function opaqueCorners(source){const w=source.width,h=source.height,ctx=source.getContext('2d');return [[0,0],[w-1,0],[0,h-1],[w-1,h-1]].every(([x,y])=>ctx.getImageData(x,y,1,1).data[3]>=250);}
  const opaqueList=()=>stickers.map((s,i)=>s.opaque?i+1:0).filter(Boolean);
  function controls(){
    if(prepared&&prepared.revision!==revision)clearPrepared();
    const checked=$('crop-review').checked,blank=stickers.map((s,i)=>s.source?0:i+1).filter(Boolean);
    $('crop-run').disabled=busy||!mothers.length;$('crop-files').disabled=busy;$('crop-clear').disabled=busy;
    const smart=$('crop-mode').value==='smart';
    $('crop-mode').disabled=busy;$('crop-white').disabled=busy||smart;$('crop-strength').disabled=busy||(!smart&&!$('crop-white').checked);
    document.querySelectorAll('#crop-mothers button,#crop-mothers select,#crop-mothers input,#crop-results button,#crop-results input').forEach(e=>{e.disabled=busy;});
    $('crop-download').disabled=busy||!stickers.length||blank.length>0||!checked;
    for(const id of ['crop-save-zip','crop-share'])$(id).disabled=busy||!prepared||!checked;
    let hint='';
    if(!busy){
      if(!mothers.length)hint='請先加入母圖。';
      else if(!stickers.length)hint='請先按「確認分割線並裁切」。';
      else if(blank.length)hint='第 '+names(blank)+' 張是空白格（全透明），請調整母圖分割線後重新裁切。';
      else if(!checked)hint='請先勾選上方的逐張檢查，才能打包下載。';
    }
    $('crop-download-hint').textContent=hint;
  }
  // 調整貼圖或代表圖片後，已打包的 ZIP 內容已過期；保留勾選的檢查狀態，只要求重新打包。
  function touched(){const had=!!prepared;revision++;controls();if(had)message('已調整圖片，先前打包的 ZIP 已失效，請重新按「打包 PNG 並下載 ZIP」。');}
  function canShare(files){try{return typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files});}catch{return false;}}
  function downloadPrepared(){if(!prepared||prepared.revision!==revision||!$('crop-review').checked)return;const url=URL.createObjectURL(prepared.file),a=el('a');a.href=url;a.download=prepared.file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('已送出下載請求，請確認瀏覽器下載清單。若未收到檔案，可用下方系統分享，或在 Chrome／Safari 開啟本頁重新加入母圖。');}
  $('crop-save-zip').onclick=downloadPrepared;
  $('crop-share').onclick=async()=>{if(busy||!prepared||prepared.revision!==revision||!$('crop-review').checked)return;const snapshot=prepared;busy=true;controls();try{await navigator.share({files:snapshot.shareFiles});if(prepared===snapshot)message('已交由系統分享處理，請在選擇的目的地確認檔案是否保存。');}catch(error){if(prepared===snapshot)message(error.name==='AbortError'?'分享已取消或沒有可用的目的地；檔案仍保留，可再次下載或分享。':'系統未能分享檔案；檔案仍保留。請改用 Chrome／Safari 開啟本頁，重新加入母圖並下載。');}finally{busy=false;controls();}};
  $('crop-copy-url').onclick=async()=>{const url='https://tsy3991.github.io/TSY.Microglow-Creative/tools/line-sticker-creator/#sticker-crop';try{await navigator.clipboard.writeText(url);message('已複製網址。請貼到 Chrome／Safari，重新加入母圖裁切；目前圖片不會自動帶到另一個瀏覽器。');}catch{const input=$('crop-page-url');input.hidden=false;input.value=url;input.focus();input.select();message('無法自動複製，請手動複製已選取的網址。');}};
  function updatePlan(){plan=window.StickerCropPlan;$('crop-plan').textContent='目前 '+plan.count+' 張；母圖依序 '+plan.grids.map(n=>'4×'+n/4).join(' ＋ ');}
  window.addEventListener('sticker-crop-plan',()=>{const next=window.StickerCropPlan;if(JSON.stringify(plan)!==JSON.stringify(next)){updatePlan();invalidate();controls();message('張數或母圖分配已變更，原圖保留，請確認網格後重新裁切。');}});
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
      const tip=el('p','藍色線是正在調整的那一條。智慧分割時分割線只用來決定圖案歸哪一格；硬切時就是實際切開的位置。');tip.className='field-hint';details.append(tip);
      for(const [axis,title] of [['x','直線'],['y','橫線']])m[axis].slice(1,-1).forEach((value,k)=>{
        const idx=k+1,size=axis==='x'?m.image.width:m.image.height,name='母圖 '+(i+1)+' '+title+' '+idx;
        const row=el('div'),range=el('input'),num=el('input');row.className='cut-row';
        range.type='range';range.min=1;range.max=size-1;range.step=1;range.value=value;range.setAttribute('aria-label',name+'（拖曳即時預覽）');
        num.type='number';num.min=1;num.max=size-1;num.step=1;num.value=value;num.setAttribute('aria-label',name+' 像素位置');
        const apply=v=>{const next=Math.min(m[axis][idx+1]-1,Math.max(m[axis][idx-1]+1,Math.round(v)));m[axis][idx]=next;range.value=next;num.value=next;invalidate();drawMother(m,c,{axis,index:idx});controls();};
        const done=()=>{num.value=m[axis][idx];range.value=m[axis][idx];drawMother(m,c);message(name+' 已調整為 '+m[axis][idx]+' px，請重新裁切。');};
        range.oninput=()=>apply(Number(range.value));num.oninput=()=>{if(num.value!==''&&Number.isFinite(Number(num.value)))apply(Number(num.value));};
        range.onchange=done;num.onchange=done;
        row.append(el('span',title+' '+idx),range,num,el('span','px'));details.append(row);
      });
      info.append(details);
      const actions=el('div');actions.className='inline-actions';actions.append(button('平均分割',()=>{resetCuts(m);invalidate();renderMothers();controls();}),button('前移',()=>{if(i){[mothers[i-1],mothers[i]]=[m,mothers[i-1]];invalidate();renderMothers();controls();}}),button('後移',()=>{if(i<mothers.length-1){[mothers[i+1],mothers[i]]=[m,mothers[i+1]];invalidate();renderMothers();controls();}}),button('移除',()=>{uploadRevision++;m.image.close();mothers.splice(i,1);invalidate();renderMothers();controls();}));info.append(actions);
      box.append(info,view);$('crop-mothers').append(box);
    });
  }
  $('crop-files').onchange=async()=>{
    const files=Array.from($('crop-files').files);$('crop-files').value='';if(!files.length)return;const token=++uploadRevision,incoming=[];
    try{
      if(mothers.length+files.length>5)throw Error('最多保留 5 張母圖。');
      let pixels=mothers.reduce((n,m)=>n+m.image.width*m.image.height,0);
      for(const file of files){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('請選 PNG、JPG 或 WebP，單張最多 20 MB。');const image=await createImageBitmap(file);incoming.push({file,image,rows:(plan.grids[mothers.length+incoming.length]||8)/4});if(image.width<4||image.height<4||image.width*image.height>16000000)throw Error('單張尺寸需至少 4×4，且不超過 1,600 萬像素。');pixels+=image.width*image.height;if(pixels>32000000)throw Error('母圖合計最多 3,200 萬像素，請縮小圖片。');}
      if(token!==uploadRevision){incoming.forEach(m=>m.image.close());return;}
      incoming.forEach(resetCuts);mothers.push(...incoming);invalidate();renderMothers();message('母圖已加入。請確認順序與分割線，再裁切。');
    }catch(error){incoming.forEach(m=>m.image.close());if(token===uploadRevision)message('未加入圖片，原圖保留：'+error.message);}
    finally{controls();}
  };
  function renderSticker(s,target,W=370,H=320,pad=10){const ctx=target.getContext('2d');ctx.clearRect(0,0,W,H);if(s.source){const f=C.fit(s.source.width,s.source.height,W,H,W===370?s.zoom:100,W===370?s.dx:0,W===370?s.dy:0,pad);ctx.drawImage(s.source,f.x,f.y,f.width,f.height);}}
  function special(){ $('crop-special').replaceChildren();if(!stickers[selected]?.source)return;for(const [name,w,h,pad] of [['main.png',240,240,10],['tab.png',96,74,4]]){const box=el('div'),c=canvas(w,h);box.append(el('strong',name+'｜'+w+'×'+h),c);renderSticker(stickers[selected],c,w,h,pad);$('crop-special').append(box);}}
  function renderResults(){
    $('crop-results').replaceChildren();stickers.forEach((s,i)=>{const box=el('article');box.className='crop-sticker';box.append(el('h3',String(i+1).padStart(2,'0')+'.png'));const c=canvas(370,320);c.setAttribute('aria-label','貼圖 '+(i+1)+' 預覽');renderSticker(s,c);box.append(c);if(!s.source)box.append(el('p','此格全透明，請調整母圖分割線後重新裁切。'));else if(s.joined)box.append(el('p','圖案和相鄰貼圖相連，只能依分割線切開，可能切到圖；請檢查，必要時重新生成這一格。'));else if(s.opaque)box.append(el('p','四個角落都不透明，背景可能還在。請用深色底確認；LINE 要求透明背景。'));
      const lab=el('label'),radio=el('input');radio.type='radio';radio.name='crop-main';radio.checked=i===selected;radio.onchange=()=>{selected=i;special();touched();};lab.append(radio,el('span','選為主要圖片／標籤圖片'));box.append(lab);
      for(const [key,title,min,max] of [['zoom','大小（%）',50,100],['dx','水平位移（px）',-180,180],['dy','垂直位移（px）',-150,150]]){const l=el('label',title),input=el('input');input.type='range';input.min=min;input.max=max;input.step=1;input.value=s[key];input.setAttribute('aria-label','貼圖 '+(i+1)+' '+title);input.oninput=()=>{s[key]=Number(input.value);renderSticker(s,c);touched();};l.append(input);box.append(l);}
      box.append(button('還原大小與位置',()=>{s.zoom=100;s.dx=s.dy=0;renderResults();touched();}));$('crop-results').append(box);
    });special();
  }
  function hardCut(m,r,remove,threshold){
    const c=canvas(r.width,r.height),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(m.image,r.x,r.y,r.width,r.height,0,0,r.width,r.height);
    const pixels=ctx.getImageData(0,0,r.width,r.height);if(remove){pixels.data.set(C.eraseWhite(pixels.data,r.width,r.height,threshold));ctx.putImageData(pixels,0,0);}
    const b=C.bounds(pixels.data,r.width,r.height);let source=null,opaque=false;
    if(b){source=canvas(b.width,b.height);source.getContext('2d',{willReadFrequently:true}).drawImage(c,b.x,b.y,b.width,b.height,0,0,b.width,b.height);opaque=opaqueCorners(source);}
    c.width=c.height=1;return {source,opaque};
  }
  $('crop-run').onclick=async()=>{
    if(busy)return;invalidate(true);const token=revision;busy=true;controls();const results=[],notes=[];
    try{
      const geometry=mothers.map((m,j)=>{try{return C.rectangles(m.image.width,m.image.height,m.x,m.y);}catch(error){throw Error('母圖 '+(j+1)+'：'+error.message);}});
      if(!C.counts.includes(plan.count)||geometry.reduce((n,a)=>n+a.length,0)!==plan.count)throw Error('總格數必須符合目前 '+plan.count+' 張設定；請調整母圖網格或第二步的張數。');
      const smart=$('crop-mode').value==='smart',remove=!smart&&$('crop-white').checked,threshold=Number($('crop-strength').value),tol=Math.round((255-threshold)*2+6);
      message('裁切中 0／'+plan.count);
      for(let j=0;j<mothers.length;j++){
        const m=mothers[j];let split=null;
        if(smart){
          message('分析母圖 '+(j+1)+'／'+mothers.length+'…');await new Promise(requestAnimationFrame);
          const full=canvas(m.image.width,m.image.height),fctx=full.getContext('2d',{willReadFrequently:true});fctx.drawImage(m.image,0,0);
          const image=fctx.getImageData(0,0,full.width,full.height);full.width=full.height=1;
          split=C.splitByContent(image.data,m.image.width,m.image.height,m.x,m.y,tol);
          if(!split)notes.push('母圖 '+(j+1)+' 的背景不是單一顏色，已改依分割線切開');
        }
        for(let k=0;k<geometry[j].length;k++){
          if(token!==revision)throw Error('設定已變更，請重新裁切。');
          let source=null,opaque=false,joined=false;
          if(split){
            const cell=split.cells[k];
            if(cell){source=canvas(cell.width,cell.height);source.getContext('2d').putImageData(new ImageData(cell.data,cell.width,cell.height),0,0);}
            joined=split.merged.includes(k);
          }else({source,opaque}=hardCut(m,geometry[j][k],remove,threshold));
          const a=adjust[results.length]||{zoom:100,dx:0,dy:0};results.push({source,opaque,joined,zoom:a.zoom,dx:a.dx,dy:a.dy});
          if(results.length%8===0||results.length===plan.count)message('裁切中 '+results.length+'／'+plan.count);
          await new Promise(requestAnimationFrame);
        }
      }
      if(token!==revision)throw Error('設定已變更，請重新裁切。');
      stickers=results;if(selected>=results.length)selected=0;$('crop-review').checked=false;renderResults();
      const kept=adjust.some(a=>a.zoom!==100||a.dx||a.dy),opaque=opaqueList(),joined=results.map((x,n)=>x.joined?n+1:0).filter(Boolean);
      message('已裁切 '+stickers.length+' 張。'+(smart?'已依圖案歸格並去除外圍背景色；':(remove?'已移除邊緣相連的近白色；':'保留原圖背景；'))+(kept?'已保留先前的大小與位置調整；':'')+(joined.length?'第 '+names(joined)+' 張的圖案和相鄰貼圖相連，只能依分割線切開，可能切到圖；':'')+(opaque.length?'第 '+names(opaque)+' 張四個角落都不透明，背景可能未去除；':'')+(notes.length?notes.join('；')+'；':'')+'請用深淺預覽逐張檢查，確認後下載。');
    }catch(error){message(error.message);}finally{busy=false;controls();}
  };
  $('crop-mode').onchange=()=>{controls();if(stickers.length){invalidate(true);controls();message('裁切方式已變更，請重新裁切；原圖與先前的大小位置調整會保留。');}};
  $('crop-white').onchange=()=>{controls();if(stickers.length){invalidate(true);controls();message('去白底設定已變更，請重新裁切；原圖與先前的大小位置調整會保留。');}};
  $('crop-strength').onchange=()=>{if(($('crop-mode').value==='smart'||$('crop-white').checked)&&stickers.length){invalidate(true);controls();message('去白底強度已變更，請重新裁切；原圖與先前的大小位置調整會保留。');}};
  $('crop-backdrop').onchange=()=>{$('crop-results').dataset.backdrop=$('crop-backdrop').value;$('crop-special').dataset.backdrop=$('crop-backdrop').value;};
  $('crop-review').onchange=controls;
  $('crop-clear').onclick=()=>{if(!mothers.length)return;if(!confirm('移除此頁全部母圖與裁切預覽？原始檔案不受影響。'))return;uploadRevision++;mothers.forEach(m=>m.image.close());mothers=[];invalidate();renderMothers();controls();message('已移除母圖；電腦上的原始檔案保留。');};
  $('crop-download').onclick=async()=>{
    if(busy||!$('crop-review').checked||stickers.length!==plan.count||stickers.some(s=>!s.source))return;busy=true;controls();const token=revision,entries=[];
    try{
      const jobs=[['main.png',stickers[selected],240,240,10],['tab.png',stickers[selected],96,74,4],...stickers.map((s,i)=>[String(i+1).padStart(2,'0')+'.png',s,370,320,10])];
      for(const [name,s,w,h,pad] of jobs){if(token!==revision)throw Error('圖片設定已變更，請重新檢查後下載。');const c=canvas(w,h);renderSticker(s,c,w,h,pad);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('圖片編碼失敗。');entries.push({name,data:C.png72(new Uint8Array(await blob.arrayBuffer()))});c.width=c.height=1;}
      const data=C.zip(entries);if(token!==revision||!$('crop-review').checked)throw Error('設定已變更，請重新確認。');
      const file=new File([data],'line-stickers-'+plan.count+'.zip',{type:'application/zip'}),pngFiles=entries.map(e=>new File([e.data],e.name,{type:'image/png'}));
      const shareFiles=canShare([file])?[file]:canShare(pngFiles)?pngFiles:null;
      const opaque=opaqueList();
      prepared={file,shareFiles,revision:token};$('crop-ready').hidden=false;$('crop-url-box').hidden=false;$('crop-ready-info').textContent='已準備 '+entries.length+' 個 PNG（含 main.png、tab.png），ZIP '+Math.ceil(data.length/1024)+' KB。打包完成不代表已保存至裝置。'+(opaque.length?'提醒：第 '+names(opaque)+' 張四個角落都不透明，LINE 要求透明背景。':'');$('crop-share').hidden=!shareFiles;$('crop-share').textContent=shareFiles?.length===1?'系統分享 ZIP 檔案':'系統分享全部 PNG（未打包）';
      if(inApp)message('偵測到 App 內建瀏覽器，未自動下載。可嘗試下方系統分享；若沒有分享功能或無法保存，請在 Chrome／Safari 開啟本頁重新加入母圖。');else downloadPrepared();
    }catch(error){message('下載未完成：'+error.message);}finally{busy=false;controls();}
  };
  if(inApp){$('crop-browser-help').hidden=false;$('crop-url-box').hidden=false;}
  updatePlan();controls();
})();
