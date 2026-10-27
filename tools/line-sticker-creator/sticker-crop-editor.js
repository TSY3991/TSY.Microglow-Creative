(function(){
  'use strict';
  // 貼圖修圖：擦掉多餘的圖案、把被切掉的部分從母圖「補回」、點一下整塊去除（分塊）、用周圍顏色補平缺口（補平）。
  // 畫面上亮的是目前貼圖，半透明的是母圖裡被切掉、但還可以補回的部分（可能包含鄰格的圖案，補回後可再擦掉）。
  const C=window.StickerCropCore;
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return c;};
  const clone=c=>{const o=canvas(c.width,c.height);o.getContext('2d').drawImage(c,0,0);return o;};
  let current=null;

  // ctx：{image, outside, mw, mh, rect, source, at, remove, threshold, onDone(canvas, at), label}
  function open(ctx){
    if(current)return;
    const margin=0.4,r=ctx.rect,auto=ctx.auto||{source:ctx.source,at:ctx.at};
    const x0=Math.max(0,Math.min(Math.floor(r.x-r.width*margin),ctx.at.x,auto.at.x)),y0=Math.max(0,Math.min(Math.floor(r.y-r.height*margin),ctx.at.y,auto.at.y));
    const x1=Math.min(ctx.mw,Math.max(Math.ceil(r.x+r.width*(1+margin)),ctx.at.x+ctx.source.width,auto.at.x+auto.source.width)),y1=Math.min(ctx.mh,Math.max(Math.ceil(r.y+r.height*(1+margin)),ctx.at.y+ctx.source.height,auto.at.y+auto.source.height));
    const W=x1-x0,H=y1-y0;
    // 可補回的來源：母圖該區域；智慧去背時沿用背景遮罩，硬切去白底時重做去白底，其餘保留原圖。
    const ext=canvas(W,H),ectx=ext.getContext('2d',{willReadFrequently:true});ectx.drawImage(ctx.image,x0,y0,W,H,0,0,W,H);
    const pixels=ectx.getImageData(0,0,W,H);
    if(ctx.outside){for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(ctx.outside[(y0+y)*ctx.mw+x0+x])pixels.data[(y*W+x)*4+3]=0;}
    else if(ctx.remove)pixels.data.set(C.eraseWhite(pixels.data,W,H,ctx.threshold));
    ectx.putImageData(pixels,0,0);
    const work=canvas(W,H);work.getContext('2d').drawImage(ctx.source,ctx.at.x-x0,ctx.at.y-y0);
    const original=canvas(W,H);original.getContext('2d').drawImage(auto.source,auto.at.x-x0,auto.at.y-y0);const undo=[];
    const availH=Math.max(180,window.innerHeight-230),availW=Math.min(680,window.innerWidth-56);let scale=Math.min(1,availW/W,availH/H),vw=Math.max(1,Math.round(W*scale)),vh=Math.max(1,Math.round(H*scale));

    const overlay=el('div',undefined,'editor-overlay'),box=el('div',undefined,'editor-box');
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','修圖：'+ctx.label);
    box.append(el('h3','修圖：'+ctx.label));
    box.append(el('p',ctx.hint||'亮的是目前的貼圖，半透明的是母圖裡被切掉、可補回的部分。擦掉多餘的、補回被切掉的；「移動框線」可框住範圍一次處理。','field-hint'));
    const view=canvas(vw,vh);view.className='editor-canvas';view.setAttribute('aria-label','修圖畫布');
    const bar=el('div',undefined,'editor-bar');
    let tool='erase',hover=null,parts=null,level=3,hoverRegion=0,overlayAll=null,tint=null,tintId=0;
    const fillMask=new Uint8Array(W*H),maskCanvas=canvas(W,H);let maskDirty=false;
    const frame={x:r.x-x0,y:r.y-y0,w:r.width,h:r.height};
    const mk=(text,fn,cls,tip)=>{const b=el('button',text,'button small'+(cls?' '+cls:''));b.type='button';b.onclick=fn;if(tip){b.title=tip;b.setAttribute('aria-label',tip);}return b;};
    const eraseBtn=mk('擦掉',()=>setTool('erase'),'','擦掉多餘的圖'),restoreBtn=mk('補回',()=>setTool('restore'),'','把母圖裡被切掉的部分塗回來'),frameBtn=mk('框線',()=>setTool('frame'),'','拖動藍色虛線框，再一次補回框內或擦掉框外'),regionBtn=mk('分塊',()=>setTool('region'),'','電腦把圖案沿最細的連接處分成幾塊，點一下就整塊去除（適合去掉文字）'),fillBtn=mk('補平',()=>setTool('fill'),'','在缺口上塗一下，用周圍的顏色補平（缺口小時效果好）');
    function setTool(t){
      tool=t;for(const [b,name] of [[eraseBtn,'erase'],[restoreBtn,'restore'],[frameBtn,'frame'],[regionBtn,'region'],[fillBtn,'fill']]){b.setAttribute('aria-pressed',String(t===name));b.classList.toggle('primary',t===name);}
      for(const k of ['erase','restore','frame','region','fill'])view.classList.toggle('tool-'+k,t===k);
      view.classList.remove('hit-move','hit-ns','hit-ew','hit-nwse','hit-nesw');inBtn.hidden=outBtn.hidden=t!=='frame';sizeLabel.hidden=t==='frame'||t==='region';levelLabel.hidden=guessBtn.hidden=t!=='region';
      hover=null;hoverRegion=0;
      if(t==='region'){ensureParts();note.textContent='點一下想去掉的那一塊（例如整欄文字）；塊分得太粗或太細可調「切細」；按「猜文字」會自動選出疑似文字的塊。';}
      else if(t==='fill')note.textContent='在缺口上塗一下，放開後用周圍顏色補平（只補透明的地方；缺口越大越模糊）。';
      else note.textContent='';
      draw();
    }
    const sizeLabel=el('label','筆刷');const size=el('input');size.type='range';size.min=4;size.max=80;size.value=24;size.setAttribute('aria-label','筆刷大小');sizeLabel.append(size);
    size.addEventListener('input',()=>draw()); // 調整粗細後立即更新範圍圈，不必再移動滑鼠。
    const undoBtn=mk('復原',()=>{const prev=undo.pop();if(prev){const g=work.getContext('2d');g.clearRect(0,0,W,H);g.drawImage(prev,0,0);parts=null;if(tool==='region')ensureParts();draw();}undoBtn.disabled=!undo.length;},'','復原上一筆');undoBtn.disabled=true;
    const resetBtn=mk('還原',()=>{undo.push(clone(work));undoBtn.disabled=false;const g=work.getContext('2d');g.clearRect(0,0,W,H);g.drawImage(original,0,0);parts=null;if(tool==='region')ensureParts();draw();},'','還原成原本裁出的樣子');
    const levelLabel=el('label','切細');const levelInput=el('input');levelInput.type='range';levelInput.min=1;levelInput.max=5;levelInput.value=3;levelInput.setAttribute('aria-label','切細程度');levelLabel.append(levelInput);levelLabel.hidden=true;
    levelInput.oninput=()=>{level=Number(levelInput.value);parts=null;ensureParts();hoverRegion=0;draw();};
    const guessBtn=mk('猜文字',()=>{
      ensureParts();const ids=C.guessTextRegions(parts);
      if(!ids.length){note.textContent='沒有找到明顯的文字塊。可以調整「切細」，或直接點選想去掉的塊。';return;}
      snapshot();removeRegions(new Set(ids));note.textContent='已去除 '+ids.length+' 個疑似文字或裝飾的塊；不對的可按「復原」，漏掉的請直接點選。';
    },'','自動選出並去除疑似文字的塊');guessBtn.hidden=true;
    const inBtn=mk('框內補回',()=>{snapshot();const g=work.getContext('2d');g.save();g.beginPath();g.rect(frame.x,frame.y,frame.w,frame.h);g.clip();g.drawImage(ext,0,0);g.restore();parts=null;draw();},'','把框內全部從母圖補回');
    const outBtn=mk('框外擦掉',()=>{snapshot();const g=work.getContext('2d');g.clearRect(0,0,W,Math.max(0,frame.y));g.clearRect(0,frame.y+frame.h,W,H-frame.y-frame.h);g.clearRect(0,frame.y,Math.max(0,frame.x),frame.h);g.clearRect(frame.x+frame.w,frame.y,W-frame.x-frame.w,frame.h);parts=null;draw();},'','把框外全部擦掉');
    inBtn.hidden=outBtn.hidden=true;
    const speckBtn=mk('清碎片',()=>{
      snapshot();const g=work.getContext('2d',{willReadFrequently:true}),data=g.getImageData(0,0,W,H),n=C.cleanSpecks(data.data,W,H);
      if(n){g.putImageData(data,0,0);parts=null;note.textContent='已清掉 '+n+' 個小碎片。';}else{undo.pop();undoBtn.disabled=!undo.length;note.textContent='沒有需要清的小碎片。';}
      draw();
    },'','清除擦完後孤立的小碎片');
    bar.append(eraseBtn,restoreBtn,regionBtn,fillBtn,frameBtn,sizeLabel,levelLabel,guessBtn,inBtn,outBtn,speckBtn,undoBtn,resetBtn);
    const note=el('p','','field-hint');note.setAttribute('role','status');
    const actions=el('div',undefined,'inline-actions');
    const done=mk('完成',finish,'primary'),cancel=mk('取消',close);
    actions.append(done,cancel);
    box.append(bar,view,note,actions);overlay.append(box);document.body.append(overlay);
    // 實際量過版面：若還是比視窗高（小螢幕），把畫布再縮小，讓整個視窗不需要捲動。
    for(let n=0;n<3;n++){const over=box.scrollHeight-box.clientHeight;if(over<=0)break;vh=Math.max(140,vh-over-2);scale=vh/H;vw=Math.max(1,Math.round(W*scale));view.width=vw;view.height=vh;}

    // 分塊：依目前畫面重新計算；overlayAll 是每塊淡淡上色的提示圖層，tint 是滑鼠所在那一塊的紅色高亮。
    const palette=[[255,90,90],[90,200,90],[90,140,255],[255,200,60],[230,90,230],[60,210,210],[255,150,60],[170,170,170]];
    function ensureParts(){
      if(parts)return;
      const data=work.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H);
      parts=C.partitionArt(data.data,W,H,level);
      const img=new ImageData(W,H),index=new Map(parts.regions.map((r,i)=>[r.id,i]));
      for(let p=0;p<W*H;p++){const id=parts.region[p];if(!id)continue;const c=palette[index.get(id)%palette.length];img.data[p*4]=c[0];img.data[p*4+1]=c[1];img.data[p*4+2]=c[2];img.data[p*4+3]=255;}
      overlayAll=canvas(W,H);overlayAll.getContext('2d').putImageData(img,0,0);tint=null;tintId=0;
    }
    function regionAt(p){
      if(!parts)return 0;const x0p=Math.floor(p.x),y0p=Math.floor(p.y);
      for(let r=0;r<=4;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=x0p+dx,y=y0p+dy;if(x<0||y<0||x>=W||y>=H)continue;const id=parts.region[y*W+x];if(id)return id;
      }
      return 0;
    }
    function tintFor(id){
      if(!id){tint=null;tintId=0;return;}
      if(tintId===id&&tint)return;
      const img=new ImageData(W,H);for(let p=0;p<W*H;p++)if(parts.region[p]===id){img.data[p*4]=255;img.data[p*4+1]=40;img.data[p*4+2]=40;img.data[p*4+3]=200;}
      tint=canvas(W,H);tint.getContext('2d').putImageData(img,0,0);tintId=id;
    }
    function removeRegions(ids){
      const g=work.getContext('2d',{willReadFrequently:true}),data=g.getImageData(0,0,W,H);
      for(let p=0;p<W*H;p++)if(ids.has(parts.region[p]))data.data[p*4+3]=0;
      g.putImageData(data,0,0);parts=null;hoverRegion=0;ensureParts();draw();
    }
    function snapshot(){undo.push(clone(work));if(undo.length>12)undo.shift();undoBtn.disabled=false;}
    function draw(){
      const g=view.getContext('2d');g.clearRect(0,0,vw,vh);g.fillStyle='#26333a';g.fillRect(0,0,vw,vh);
      g.globalAlpha=0.32;g.drawImage(ext,0,0,vw,vh);g.globalAlpha=1;g.drawImage(work,0,0,vw,vh);
      if(tool==='region'&&overlayAll){g.globalAlpha=0.5;g.drawImage(overlayAll,0,0,vw,vh);g.globalAlpha=0.85;if(hoverRegion){tintFor(hoverRegion);if(tint)g.drawImage(tint,0,0,vw,vh);}g.globalAlpha=1;}
      if(tool==='fill'&&maskDirty){g.globalAlpha=0.5;g.drawImage(maskCanvas,0,0,vw,vh);g.globalAlpha=1;}
      g.strokeStyle='#7fd1ff';g.lineWidth=2;g.setLineDash([6,4]);g.strokeRect(frame.x*scale,frame.y*scale,frame.w*scale,frame.h*scale);g.setLineDash([]);
      if(tool==='frame'){g.fillStyle='#7fd1ff';for(const [hx,hy] of handles())g.fillRect(hx*scale-4,hy*scale-4,8,8);}
      else if(hover&&tool!=='region'){g.strokeStyle='#fff';g.lineWidth=1.5;g.beginPath();g.arc(hover.x*scale,hover.y*scale,Number(size.value)/2,0,Math.PI*2);g.stroke();g.strokeStyle='#1b2a30';g.lineWidth=.8;g.beginPath();g.arc(hover.x*scale,hover.y*scale,Number(size.value)/2+1.2,0,Math.PI*2);g.stroke();}
    }
    function stamp(px,py){
      const rad=Number(size.value)/2/scale;
      if(tool==='fill'){
        const mg=maskCanvas.getContext('2d');mg.fillStyle='#2ecc71';mg.beginPath();mg.arc(px,py,rad,0,Math.PI*2);mg.fill();
        const r2=rad*rad;for(let y=Math.max(0,Math.floor(py-rad));y<=Math.min(H-1,Math.ceil(py+rad));y++)for(let x=Math.max(0,Math.floor(px-rad));x<=Math.min(W-1,Math.ceil(px+rad));x++)if((x-px)*(x-px)+(y-py)*(y-py)<=r2)fillMask[y*W+x]=1;
        maskDirty=true;return;
      }
      const g=work.getContext('2d');
      g.save();g.beginPath();g.arc(px,py,rad,0,Math.PI*2);
      if(tool==='erase'){g.globalCompositeOperation='destination-out';g.fillStyle='#000';g.fill();}
      else{g.clip();g.drawImage(ext,0,0);}
      g.restore();
    }
    function stroke(from,to){
      const rad=Number(size.value)/2/scale,dx=to.x-from.x,dy=to.y-from.y,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(1,rad/2)));
      for(let i=1;i<=steps;i++)stamp(from.x+dx*i/steps,from.y+dy*i/steps);
    }
    const point=ev=>{const b=view.getBoundingClientRect();return {x:(ev.clientX-b.left)/b.width*W,y:(ev.clientY-b.top)/b.height*H};};
    // 框線：8 個把手 + 內部移動
    const handles=()=>[[frame.x,frame.y],[frame.x+frame.w/2,frame.y],[frame.x+frame.w,frame.y],[frame.x,frame.y+frame.h/2],[frame.x+frame.w,frame.y+frame.h/2],[frame.x,frame.y+frame.h],[frame.x+frame.w/2,frame.y+frame.h],[frame.x+frame.w,frame.y+frame.h]];
    const hitFrame=p=>{
      const tol=9/scale,names=[['nwse','l','t'],['ns',null,'t'],['nesw','r','t'],['ew','l',null],['ew','r',null],['nesw','l','b'],['ns',null,'b'],['nwse','r','b']],hs=handles();
      for(let k=0;k<8;k++)if(Math.abs(p.x-hs[k][0])<=tol&&Math.abs(p.y-hs[k][1])<=tol)return {cursor:names[k][0],x:names[k][1],y:names[k][2]};
      if(p.x>=frame.x&&p.x<=frame.x+frame.w&&p.y>=frame.y&&p.y<=frame.y+frame.h)return {cursor:'move',move:true};
      return null;
    };
    const cursorClasses=['hit-move','hit-ns','hit-ew','hit-nwse','hit-nesw'];
    let last=null,grab=null;
    view.addEventListener('pointerdown',ev=>{
      ev.preventDefault();try{view.setPointerCapture(ev.pointerId);}catch{}
      const p=point(ev);
      if(tool==='frame'){const hit=hitFrame(p);if(hit)grab={hit,p,start:{...frame}};return;}
      if(tool==='region'){
        ensureParts();const id=regionAt(p);
        if(id){snapshot();removeRegions(new Set([id]));note.textContent='已去除這一塊；還有要去掉的就繼續點，錯了按「復原」。';}
        return;
      }
      snapshot();parts=null;last=p;stamp(last.x,last.y);draw();
    });
    view.addEventListener('pointermove',ev=>{
      const p=point(ev);
      if(tool==='frame'){
        if(grab){
          const dx=p.x-grab.p.x,dy=p.y-grab.p.y,s=grab.start,min=20;let {x,y,w,h}=s;
          if(grab.hit.move){x=Math.min(W-w,Math.max(0,s.x+dx));y=Math.min(H-h,Math.max(0,s.y+dy));}
          else{
            if(grab.hit.x==='l'){const nx=Math.min(s.x+s.w-min,Math.max(0,s.x+dx));w=s.x+s.w-nx;x=nx;}
            if(grab.hit.x==='r'){w=Math.min(W-s.x,Math.max(min,s.w+dx));}
            if(grab.hit.y==='t'){const ny=Math.min(s.y+s.h-min,Math.max(0,s.y+dy));h=s.y+s.h-ny;y=ny;}
            if(grab.hit.y==='b'){h=Math.min(H-s.y,Math.max(min,s.h+dy));}
          }
          frame.x=x;frame.y=y;frame.w=w;frame.h=h;draw();return;
        }
        const hit=hitFrame(p);view.classList.remove(...cursorClasses);if(hit)view.classList.add(hit.cursor==='move'?'hit-move':'hit-'+hit.cursor);return;
      }
      if(tool==='region'){const id=regionAt(p);if(id!==hoverRegion){hoverRegion=id;draw();}return;}
      hover=p;
      if(last){stroke(last,p);last=p;}
      draw();
    });
    const commitFill=()=>{
      if(tool!=='fill'||!maskDirty)return;
      const g=work.getContext('2d',{willReadFrequently:true}),data=g.getImageData(0,0,W,H),n=C.inpaint(data.data,W,H,fillMask);
      if(n){g.putImageData(data,0,0);note.textContent='已補平 '+n+' 個像素。缺口大的地方會比較模糊，可再用「擦掉」「補回」修飾。';parts=null;}else{undo.pop();undoBtn.disabled=!undo.length;note.textContent='塗的地方沒有透明缺口可以補。';}
      fillMask.fill(0);maskCanvas.getContext('2d').clearRect(0,0,W,H);maskDirty=false;draw();
    };
    const up=()=>{last=null;grab=null;commitFill();};view.addEventListener('pointerup',up);view.addEventListener('pointercancel',up);
    view.addEventListener('pointerleave',()=>{if(tool!=='frame'){hover=null;hoverRegion=0;draw();}});
    function close(){if(!current)return;document.removeEventListener('keydown',onKey,true);overlay.remove();current=null;if(ctx.opener&&ctx.opener.focus)ctx.opener.focus();}
    function finish(){
      const wctx=work.getContext('2d',{willReadFrequently:true}),data=wctx.getImageData(0,0,W,H);
      // main／tab：完成時自動清掉孤立小碎片；一般貼圖只清「肉眼幾乎看不到」的極小殘點（擦掉後留下的碎屑會撐大外框，讓圖案偏小、偏離中央，無法放大置中）
      if(ctx.cleanup?C.cleanSpecks(data.data,W,H):C.cleanSpecks(data.data,W,H,0.0015,30))wctx.putImageData(data,0,0);
      const b=C.bounds(data.data,W,H);
      if(!b){note.textContent='畫面上沒有任何圖案了，請按「復原」或「還原」。';return;}
      const out=canvas(b.width,b.height);out.getContext('2d').drawImage(work,b.x,b.y,b.width,b.height,0,0,b.width,b.height);
      const result={canvas:out,at:{x:x0+b.x,y:y0+b.y}};close();ctx.onDone(result.canvas,result.at);
    }
    function onKey(ev){if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();close();}}
    document.addEventListener('keydown',onKey,true);
    current={close};setTool('erase');
    if(ctx.cleanup){ // main／tab：先把虛線框放在最大的一塊（角色）外框上，按「框外擦掉」就能一次去掉旁邊的文字
      ensureParts();const m=parts.regions[0];
      if(m){frame.x=Math.max(0,m.minx-2);frame.y=Math.max(0,m.miny-2);frame.w=Math.min(W-frame.x,m.maxx-m.minx+5);frame.h=Math.min(H-frame.y,m.maxy-m.miny+5);}
      setTool('frame');note.textContent='虛線框已放在角色外框上：拖邊角調整，再按「框外擦掉」，就能去掉旁邊的文字；單獨的字塊也可用「分塊」點選。';
    }
    draw();(ctx.cleanup?frameBtn:eraseBtn).focus();
  }
  window.StickerEditor={open,isOpen:()=>!!current,close:()=>current&&current.close()};
})();
