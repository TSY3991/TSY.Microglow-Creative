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
    const availH=Math.max(180,window.innerHeight-230),availW=Math.min(680,window.innerWidth-56);let scale=Math.min(1,availW/W,availH/H),vw=Math.max(1,Math.round(W*scale)),vh=Math.max(1,Math.round(H*scale));

    const overlay=el('div',undefined,'editor-overlay'),box=el('div',undefined,'editor-box');
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','修圖：'+ctx.label);
    box.append(el('h3','修圖：'+ctx.label));
    box.append(el('p',ctx.hint||'亮的是目前的貼圖，半透明的是母圖裡被切掉、可補回的部分。擦掉多餘的、補回被切掉的；「移動框線」可框住範圍一次處理。','field-hint'));
    const view=canvas(vw,vh);view.className='editor-canvas';view.setAttribute('aria-label','修圖畫布');
    const bar=el('div',undefined,'editor-bar');
    let tool='erase',hover=null;
    const frame={x:r.x-x0,y:r.y-y0,w:r.width,h:r.height};
    const mk=(text,fn,cls,tip)=>{const b=el('button',text,'button small'+(cls?' '+cls:''));b.type='button';b.onclick=fn;if(tip){b.title=tip;b.setAttribute('aria-label',tip);}return b;};
    const eraseBtn=mk('擦掉',()=>setTool('erase'),'','擦掉多餘的圖'),restoreBtn=mk('補回',()=>setTool('restore'),'','把母圖裡被切掉的部分塗回來'),frameBtn=mk('移動框線',()=>setTool('frame'),'','拖動藍色虛線框，再一次補回框內或擦掉框外');
    function setTool(t){
      tool=t;for(const [b,name] of [[eraseBtn,'erase'],[restoreBtn,'restore'],[frameBtn,'frame']]){b.setAttribute('aria-pressed',String(t===name));b.classList.toggle('primary',t===name);}
      view.classList.toggle('tool-erase',t==='erase');view.classList.toggle('tool-restore',t==='restore');view.classList.toggle('tool-frame',t==='frame');
      view.classList.remove('hit-move','hit-ns','hit-ew','hit-nwse','hit-nesw');inBtn.hidden=outBtn.hidden=t!=='frame';sizeLabel.hidden=t==='frame';hover=null;draw();
    }
    const sizeLabel=el('label','筆刷');const size=el('input');size.type='range';size.min=4;size.max=80;size.value=24;size.setAttribute('aria-label','筆刷大小');sizeLabel.append(size);
    const undoBtn=mk('復原',()=>{const prev=undo.pop();if(prev){const g=work.getContext('2d');g.clearRect(0,0,W,H);g.drawImage(prev,0,0);draw();}undoBtn.disabled=!undo.length;},'','復原上一筆');undoBtn.disabled=true;
    const resetBtn=mk('還原',()=>{undo.push(clone(work));undoBtn.disabled=false;const g=work.getContext('2d');g.clearRect(0,0,W,H);g.drawImage(original,0,0);draw();},'','還原成原本裁出的樣子');
    const inBtn=mk('框內補回',()=>{snapshot();const g=work.getContext('2d');g.save();g.beginPath();g.rect(frame.x,frame.y,frame.w,frame.h);g.clip();g.drawImage(ext,0,0);g.restore();draw();},'','把框內全部從母圖補回');
    const outBtn=mk('框外擦掉',()=>{snapshot();const g=work.getContext('2d');g.clearRect(0,0,W,Math.max(0,frame.y));g.clearRect(0,frame.y+frame.h,W,H-frame.y-frame.h);g.clearRect(0,frame.y,Math.max(0,frame.x),frame.h);g.clearRect(frame.x+frame.w,frame.y,W-frame.x-frame.w,frame.h);draw();},'','把框外全部擦掉');
    inBtn.hidden=outBtn.hidden=true;
    bar.append(eraseBtn,restoreBtn,frameBtn,sizeLabel,inBtn,outBtn,undoBtn,resetBtn);
    const note=el('p','','field-hint');note.setAttribute('role','status');
    const actions=el('div',undefined,'inline-actions');
    const done=mk('完成',finish,'primary'),cancel=mk('取消',close);
    actions.append(done,cancel);
    box.append(bar,view,note,actions);overlay.append(box);document.body.append(overlay);
    // 實際量過版面：若還是比視窗高（小螢幕），把畫布再縮小，讓整個視窗不需要捲動。
    for(let n=0;n<3;n++){const over=box.scrollHeight-box.clientHeight;if(over<=0)break;vh=Math.max(140,vh-over-2);scale=vh/H;vw=Math.max(1,Math.round(W*scale));view.width=vw;view.height=vh;}

    function snapshot(){undo.push(clone(work));if(undo.length>12)undo.shift();undoBtn.disabled=false;}
    function draw(){
      const g=view.getContext('2d');g.clearRect(0,0,vw,vh);g.fillStyle='#26333a';g.fillRect(0,0,vw,vh);
      g.globalAlpha=0.32;g.drawImage(ext,0,0,vw,vh);g.globalAlpha=1;g.drawImage(work,0,0,vw,vh);
      g.strokeStyle='#7fd1ff';g.lineWidth=2;g.setLineDash([6,4]);g.strokeRect(frame.x*scale,frame.y*scale,frame.w*scale,frame.h*scale);g.setLineDash([]);
      if(tool==='frame'){g.fillStyle='#7fd1ff';for(const [hx,hy] of handles())g.fillRect(hx*scale-4,hy*scale-4,8,8);}
      else if(hover){g.strokeStyle='#fff';g.lineWidth=1.5;g.beginPath();g.arc(hover.x*scale,hover.y*scale,Number(size.value)/2,0,Math.PI*2);g.stroke();g.strokeStyle='#1b2a30';g.lineWidth=.8;g.beginPath();g.arc(hover.x*scale,hover.y*scale,Number(size.value)/2+1.2,0,Math.PI*2);g.stroke();}
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
      snapshot();last=p;stamp(last.x,last.y);draw();
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
      hover=p;
      if(last){stroke(last,p);last=p;}
      draw();
    });
    const up=()=>{last=null;grab=null;};view.addEventListener('pointerup',up);view.addEventListener('pointercancel',up);
    view.addEventListener('pointerleave',()=>{if(tool!=='frame'){hover=null;draw();}});
    function close(){if(!current)return;document.removeEventListener('keydown',onKey,true);overlay.remove();current=null;if(ctx.opener&&ctx.opener.focus)ctx.opener.focus();}
    function finish(){
      const data=work.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H),b=C.bounds(data.data,W,H);
      if(!b){note.textContent='畫面上沒有任何圖案了，請按「復原」或「還原」。';return;}
      const out=canvas(b.width,b.height);out.getContext('2d').drawImage(work,b.x,b.y,b.width,b.height,0,0,b.width,b.height);
      const result={canvas:out,at:{x:x0+b.x,y:y0+b.y}};close();ctx.onDone(result.canvas,result.at);
    }
    function onKey(ev){if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();close();}}
    document.addEventListener('keydown',onKey,true);
    current={close};setTool('erase');draw();eraseBtn.focus();
  }
  window.StickerEditor={open,isOpen:()=>!!current,close:()=>current&&current.close()};
})();
