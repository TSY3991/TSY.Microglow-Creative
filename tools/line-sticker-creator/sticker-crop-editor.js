(function(){
  'use strict';
  // 貼圖修圖：擦掉多餘的圖案、或把被切掉的部分從母圖「補回」。
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
    const scale=Math.min(1,640/W,460/H),vw=Math.max(1,Math.round(W*scale)),vh=Math.max(1,Math.round(H*scale));

    const overlay=el('div',undefined,'editor-overlay'),box=el('div',undefined,'editor-box');
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','修圖：'+ctx.label);
    box.append(el('h3','修圖：'+ctx.label));
    box.append(el('p','亮的是目前這張貼圖；半透明的是母圖裡被切掉、可以補回的部分。用「補回」把被切掉的圖塗回來，用「擦掉」去除多餘的圖（例如鄰格的碎片）。以滑鼠或手指在圖上塗抹。','field-hint'));
    const view=canvas(vw,vh);view.className='editor-canvas';view.setAttribute('aria-label','修圖畫布');
    const bar=el('div',undefined,'editor-bar');
    let tool='erase';
    const mk=(text,fn,cls)=>{const b=el('button',text,'button small'+(cls?' '+cls:''));b.type='button';b.onclick=fn;return b;};
    const eraseBtn=mk('擦掉',()=>setTool('erase')),restoreBtn=mk('補回被切掉的部分',()=>setTool('restore'));
    function setTool(t){tool=t;eraseBtn.setAttribute('aria-pressed',String(t==='erase'));restoreBtn.setAttribute('aria-pressed',String(t==='restore'));eraseBtn.classList.toggle('primary',t==='erase');restoreBtn.classList.toggle('primary',t==='restore');}
    const sizeLabel=el('label','筆刷大小');const size=el('input');size.type='range';size.min=4;size.max=80;size.value=24;size.setAttribute('aria-label','筆刷大小');sizeLabel.append(size);
    const undoBtn=mk('復原上一筆',()=>{const prev=undo.pop();if(prev){const g=work.getContext('2d');g.clearRect(0,0,W,H);g.drawImage(prev,0,0);draw();}undoBtn.disabled=!undo.length;});undoBtn.disabled=true;
    const resetBtn=mk('還原成原本裁出的樣子',()=>{undo.push(clone(work));undoBtn.disabled=false;const g=work.getContext('2d');g.clearRect(0,0,W,H);g.drawImage(original,0,0);draw();});
    bar.append(eraseBtn,restoreBtn,sizeLabel,undoBtn,resetBtn);
    const note=el('p','','field-hint');note.setAttribute('role','status');
    const actions=el('div',undefined,'inline-actions');
    const done=mk('完成',finish,'primary'),cancel=mk('取消',close);
    actions.append(done,cancel);
    box.append(bar,view,note,actions);overlay.append(box);document.body.append(overlay);

    function draw(){
      const g=view.getContext('2d');g.clearRect(0,0,vw,vh);g.fillStyle='#26333a';g.fillRect(0,0,vw,vh);
      g.globalAlpha=0.32;g.drawImage(ext,0,0,vw,vh);g.globalAlpha=1;g.drawImage(work,0,0,vw,vh);
      g.strokeStyle='#7fd1ff';g.lineWidth=2;g.setLineDash([6,4]);g.strokeRect((r.x-x0)*scale,(r.y-y0)*scale,r.width*scale,r.height*scale);g.setLineDash([]);
    }
    function stamp(px,py){
      const g=work.getContext('2d'),rad=Number(size.value)/2/scale;
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
    let last=null;
    view.addEventListener('pointerdown',ev=>{ev.preventDefault();try{view.setPointerCapture(ev.pointerId);}catch{}undo.push(clone(work));if(undo.length>12)undo.shift();undoBtn.disabled=false;last=point(ev);stamp(last.x,last.y);draw();});
    view.addEventListener('pointermove',ev=>{if(!last)return;const p=point(ev);stroke(last,p);last=p;draw();});
    const up=()=>{last=null;};view.addEventListener('pointerup',up);view.addEventListener('pointercancel',up);
    function close(){if(!current)return;document.removeEventListener('keydown',onKey,true);overlay.remove();current=null;if(ctx.opener&&ctx.opener.focus)ctx.opener.focus();}
    function finish(){
      const data=work.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H),b=C.bounds(data.data,W,H);
      if(!b){note.textContent='畫面上沒有任何圖案了，請用「復原上一筆」或「還原成原本裁出的樣子」。';return;}
      const out=canvas(b.width,b.height);out.getContext('2d').drawImage(work,b.x,b.y,b.width,b.height,0,0,b.width,b.height);
      const result={canvas:out,at:{x:x0+b.x,y:y0+b.y}};close();ctx.onDone(result.canvas,result.at);
    }
    function onKey(ev){if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();close();}}
    document.addEventListener('keydown',onKey,true);
    current={close};setTool('erase');draw();eraseBtn.focus();
  }
  window.StickerEditor={open,isOpen:()=>!!current,close:()=>current&&current.close()};
})();
