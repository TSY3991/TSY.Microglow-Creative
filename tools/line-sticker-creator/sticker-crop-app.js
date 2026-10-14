(function(){
  'use strict';
  const C=window.StickerCropCore,$=id=>document.getElementById(id),el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  let plan=window.StickerCropPlan,mothers=[],stickers=[],revision=0,uploadRevision=0,selected=0,busy=false;
  const canvas=(w,h)=>{const c=el('canvas');c.width=w;c.height=h;return c;};
  const message=text=>{$('crop-status').textContent=text;};
  function invalidate(){revision++;stickers=[];$('crop-results').replaceChildren();$('crop-special').replaceChildren();$('crop-review').checked=false;$('crop-download').disabled=true;}
  function controls(){ $('crop-run').disabled=busy||!mothers.length;$('crop-files').disabled=busy;$('crop-download').disabled=busy||!stickers.length||stickers.some(s=>!s.source)||!$('crop-review').checked;}
  function updatePlan(){plan=window.StickerCropPlan;$('crop-plan').textContent='目前 '+plan.count+' 張；母圖依序 '+plan.grids.map(n=>'4×'+n/4).join(' ＋ ');}
  window.addEventListener('sticker-crop-plan',()=>{const next=window.StickerCropPlan;if(JSON.stringify(plan)!==JSON.stringify(next)){updatePlan();invalidate();controls();message('張數或母圖分配已變更，原圖保留，請確認網格後重新裁切。');}});
  function resetCuts(m){m.x=C.cuts(m.image.width,4);m.y=C.cuts(m.image.height,m.rows);}
  function drawMother(m,c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(m.image,0,0,c.width,c.height);ctx.strokeStyle='#ff3060';ctx.lineWidth=2;ctx.beginPath();for(const x of m.x.slice(1,-1)){const p=x/m.image.width*c.width;ctx.moveTo(p,0);ctx.lineTo(p,c.height);}for(const y of m.y.slice(1,-1)){const p=y/m.image.height*c.height;ctx.moveTo(0,p);ctx.lineTo(c.width,p);}ctx.stroke();}
  function button(text,fn){const b=el('button',text);b.type='button';b.className='button small';b.onclick=fn;return b;}
  function renderMothers(){
    $('crop-mothers').replaceChildren();mothers.forEach((m,i)=>{
      const box=el('article');box.className='crop-mother';box.append(el('h3','母圖 '+(i+1)+'｜'+m.file.name),el('p',m.image.width+' × '+m.image.height+' px'));
      const grid=el('select');grid.setAttribute('aria-label','母圖 '+(i+1)+' 裁切網格');grid.add(new Option('4×2（8 格）',2));grid.add(new Option('4×4（16 格）',4));grid.value=m.rows;
      grid.onchange=()=>{m.rows=Number(grid.value);resetCuts(m);invalidate();renderMothers();controls();};box.append(grid);
      const previewScale=Math.min(600/m.image.width,450/m.image.height),c=canvas(Math.max(1,Math.round(m.image.width*previewScale)),Math.max(1,Math.round(m.image.height*previewScale)));c.className='crop-mother-preview';c.setAttribute('aria-label','母圖與分割線預覽');drawMother(m,c);box.append(c);
      const details=el('details');details.append(el('summary','調整分割線（原圖像素位置）'));
      for(const [axis,title] of [['x','直線'],['y','橫線']])m[axis].slice(1,-1).forEach((value,j)=>{const label=el('label',title+' '+(j+1)+' '),input=el('input');input.type='number';input.min=1;input.max=(axis==='x'?m.image.width:m.image.height)-1;input.step=1;input.value=value;input.setAttribute('aria-label','母圖 '+(i+1)+' '+title+' '+(j+1));input.onchange=()=>{m[axis][j+1]=Number(input.value);invalidate();drawMother(m,c);controls();};label.append(input);details.append(label);});box.append(details);
      const actions=el('div');actions.className='inline-actions';actions.append(button('平均分割',()=>{resetCuts(m);invalidate();renderMothers();controls();}),button('前移',()=>{if(i){[mothers[i-1],mothers[i]]=[m,mothers[i-1]];invalidate();renderMothers();controls();}}),button('後移',()=>{if(i<mothers.length-1){[mothers[i+1],mothers[i]]=[m,mothers[i+1]];invalidate();renderMothers();controls();}}),button('移除',()=>{uploadRevision++;m.image.close();mothers.splice(i,1);invalidate();renderMothers();controls();}));box.append(actions);$('crop-mothers').append(box);
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
    }catch(error){incoming.forEach(m=>m.image.close());if(token===uploadRevision)message('未加入圖片，原圖保留：'+error.message);}controls();
  };
  function renderSticker(s,target,W=370,H=320,pad=10){const ctx=target.getContext('2d');ctx.clearRect(0,0,W,H);if(s.source){const f=C.fit(s.source.width,s.source.height,W,H,W===370?s.zoom:100,W===370?s.dx:0,W===370?s.dy:0,pad);ctx.drawImage(s.source,f.x,f.y,f.width,f.height);}}
  function special(){ $('crop-special').replaceChildren();if(!stickers[selected]?.source)return;for(const [name,w,h,pad] of [['main.png',240,240,10],['tab.png',96,74,4]]){const box=el('div'),c=canvas(w,h);box.append(el('strong',name+'｜'+w+'×'+h),c);renderSticker(stickers[selected],c,w,h,pad);$('crop-special').append(box);}}
  function renderResults(){
    $('crop-results').replaceChildren();stickers.forEach((s,i)=>{const box=el('article');box.className='crop-sticker';box.append(el('h3',String(i+1).padStart(2,'0')+'.png'));const c=canvas(370,320);c.setAttribute('aria-label','貼圖 '+(i+1)+' 預覽');renderSticker(s,c);box.append(c);if(!s.source)box.append(el('p','此格全透明，請調整母圖分割線後重新裁切。'));
      const lab=el('label'),radio=el('input');radio.type='radio';radio.name='crop-main';radio.checked=i===selected;radio.onchange=()=>{selected=i;revision++;$('crop-review').checked=false;special();controls();};lab.append(radio,el('span','選為主要圖片／標籤圖片'));box.append(lab);
      for(const [key,title,min,max] of [['zoom','大小（%）',50,100],['dx','水平位移（px）',-180,180],['dy','垂直位移（px）',-150,150]]){const l=el('label',title),input=el('input');input.type='range';input.min=min;input.max=max;input.step=1;input.value=s[key];input.setAttribute('aria-label','貼圖 '+(i+1)+' '+title);input.oninput=()=>{s[key]=Number(input.value);revision++;renderSticker(s,c);$('crop-review').checked=false;controls();};l.append(input);box.append(l);}
      box.append(button('還原大小與位置',()=>{s.zoom=100;s.dx=s.dy=0;revision++;$('crop-review').checked=false;renderResults();controls();}));$('crop-results').append(box);
    });special();
  }
  $('crop-run').onclick=async()=>{
    if(busy)return;invalidate();const token=revision;busy=true;controls();const results=[];
    try{
      const geometry=mothers.map(m=>C.rectangles(m.image.width,m.image.height,m.x,m.y));if(!C.counts.includes(plan.count)||geometry.reduce((n,a)=>n+a.length,0)!==plan.count)throw Error('總格數必須符合目前 '+plan.count+' 張設定；請調整母圖網格或第三步的張數。');
      const remove=$('crop-white').checked,threshold=Number($('crop-strength').value);
      for(let j=0;j<mothers.length;j++)for(const r of geometry[j]){
        if(token!==revision)throw Error('設定已變更，請重新裁切。');const c=canvas(r.width,r.height),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(mothers[j].image,r.x,r.y,r.width,r.height,0,0,r.width,r.height);const pixels=ctx.getImageData(0,0,r.width,r.height);if(remove){pixels.data.set(C.eraseWhite(pixels.data,r.width,r.height,threshold));ctx.putImageData(pixels,0,0);}const b=C.bounds(pixels.data,r.width,r.height);let source=null;if(b){source=canvas(b.width,b.height);source.getContext('2d').drawImage(c,b.x,b.y,b.width,b.height,0,0,b.width,b.height);}results.push({source,zoom:100,dx:0,dy:0});c.width=c.height=1;message('裁切中 '+results.length+'／'+plan.count);await new Promise(requestAnimationFrame);
      }
      if(token!==revision)throw Error('設定已變更，請重新裁切。');stickers=results;selected=0;$('crop-review').checked=false;renderResults();message('已裁切 '+stickers.length+' 張。'+(remove?'已移除邊緣相連的近白色；':'保留原圖背景；')+'請用深淺預覽逐張檢查，確認後下載。');
    }catch(error){message(error.message);}finally{busy=false;controls();}
  };
  for(const id of ['crop-white','crop-strength'])$(id).onchange=()=>{invalidate();controls();message('去白底設定已變更，請重新裁切；原圖保留。');};
  $('crop-backdrop').onchange=()=>{$('crop-results').dataset.backdrop=$('crop-backdrop').value;$('crop-special').dataset.backdrop=$('crop-backdrop').value;};
  $('crop-review').onchange=controls;
  $('crop-clear').onclick=()=>{if(!mothers.length)return;if(!confirm('移除此頁全部母圖與裁切預覽？原始檔案不受影響。'))return;uploadRevision++;mothers.forEach(m=>m.image.close());mothers=[];invalidate();renderMothers();controls();message('已移除母圖；電腦上的原始檔案保留。');};
  $('crop-download').onclick=async()=>{
    if(busy||!$('crop-review').checked||stickers.length!==plan.count||stickers.some(s=>!s.source))return;busy=true;controls();const token=revision,entries=[];
    try{
      const jobs=[['main.png',stickers[selected],240,240,10],['tab.png',stickers[selected],96,74,4],...stickers.map((s,i)=>[String(i+1).padStart(2,'0')+'.png',s,370,320,10])];
      for(const [name,s,w,h,pad] of jobs){if(token!==revision)throw Error('圖片設定已變更，請重新檢查後下載。');const c=canvas(w,h);renderSticker(s,c,w,h,pad);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('圖片編碼失敗。');entries.push({name,data:C.png72(new Uint8Array(await blob.arrayBuffer()))});c.width=c.height=1;}
      const data=C.zip(entries);if(token!==revision||!$('crop-review').checked)throw Error('設定已變更，請重新確認。');const url=URL.createObjectURL(new Blob([data],{type:'application/zip'})),a=el('a');a.href=url;a.download='line-stickers-'+plan.count+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);message('已打包 '+entries.length+' 個 PNG（含 main.png、tab.png），'+Math.ceil(data.length/1024)+' KB。請解壓逐張檢查，再至 LINE Creators Market 上傳。');
    }catch(error){message('下載未完成：'+error.message);}finally{busy=false;controls();}
  };
  updatePlan();controls();
})();
