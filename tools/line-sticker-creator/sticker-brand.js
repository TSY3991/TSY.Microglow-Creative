(function(){
  'use strict';
  // 標記只合成在輸出副本，絕不寫回母圖或修圖來源。
  // 純運算：在不透明像素上找放得下 sw×sh 標記的位置。先找 100%、再縮小，最後取覆蓋率最高者；整張都沒有不透明像素才回傳 null。
  function place(data,W,H,sw,sh){
    const S=W+1,cnt=new Int32Array(S*(H+1)),sum=new Float64Array(S*(H+1)),sq=new Float64Array(S*(H+1));
    for(let y=0;y<H;y++){let c=0,a=0,b=0;for(let x=0;x<W;x++){const p=(y*W+x)*4;if(data[p+3]>=128){const l=data[p]*.2126+data[p+1]*.7152+data[p+2]*.0722;c++;a+=l;b+=l*l;}const i=(y+1)*S+x+1,u=y*S+x+1;cnt[i]=cnt[u]+c;sum[i]=sum[u]+a;sq[i]=sq[u]+b;}}
    const area=(t,x,y,w,h)=>t[(y+h)*S+x+w]-t[y*S+x+w]-t[(y+h)*S+x]+t[y*S+x];
    let best=null,fallback=null;
    for(const scale of [1,.8,.62,.48,.36]){
      const w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale)),m=Math.min(4,Math.floor((W-w)/2),Math.floor((H-h)/2));
      if(m<0)continue;
      for(let y=H-h-m;y>=m;y-=3)for(let x=m;x<=W-w-m;x+=4){
        const n=area(cnt,x,y,w,h);if(!n)continue;const cov=n/(w*h),mean=area(sum,x,y,w,h)/n,variance=area(sq,x,y,w,h)/n-mean*mean;
        if(!fallback||cov>fallback.cov+1e-9)fallback={x,y,w,h,cov,mean};
        if(cov<.95)continue;
        const score=-variance*.015+y/H*10+(y>=H*.55?200:0)+scale*60;
        if(!best||score>best.score)best={x,y,w,h,cov,mean,score};
      }
      if(best)break;
    }
    return best||fallback;
  }
  window.StickerBrand=function(changed){
    const $=id=>document.getElementById(id);
    let logo=null,loadToken=0,loading=false;
    const status=text=>{$('crop-brand-status').textContent=text;};
    const notify=()=>{changed();};
    $('crop-brand-text').addEventListener('input',notify);
    $('crop-brand-opacity').addEventListener('input',()=>{$('crop-brand-level').textContent=$('crop-brand-opacity').value+'%';notify();});
    $('crop-brand-clear').onclick=()=>{
      loadToken++;loading=false;if(logo)logo.close();logo=null;
      $('crop-brand-text').value='';$('crop-brand-file').value='';status('已移除品牌標記。');notify();
    };
    $('crop-brand-file').onchange=async()=>{
      const file=$('crop-brand-file').files[0];$('crop-brand-file').value='';if(!file)return;
      const token=++loadToken;loading=true;notify();let image;
      try{
        if(!['image/png','image/webp','image/jpeg'].includes(file.type)||file.size>5*1024*1024)throw Error('請選 PNG、WebP 或 JPG，最多 5 MB；透明 PNG 效果較好。');
        image=await createImageBitmap(file);
        if(image.width*image.height>4000000)throw Error('商標圖片最多 400 萬像素，請縮小後再加入。');
        if(token!==loadToken){image.close();return;}
        if(logo)logo.close();logo=image;image=null;status('商標已加入；縮放與位置由網站自動安排。');
      }catch(error){if(image)image.close();if(token===loadToken)status('未更換商標，原設定保留：'+error.message);}
      finally{if(token===loadToken){loading=false;notify();}}
    };
    function draw(target){
      const text=Array.from($('crop-brand-text').value.trim().replace(/[\r\n\t]/g,' ')).slice(0,24).join('');
      if(!text&&!logo)return {marked:true,placed:false};
      const ctx=target.getContext('2d'),W=target.width,H=target.height,alpha=Number($('crop-brand-opacity').value)/100;
      const stamp=document.createElement('canvas');stamp.width=74;stamp.height=16;
      const ink=stamp.getContext('2d');let offset=0;
      if(logo){const k=Math.min(30/logo.width,14/logo.height);const w=Math.max(1,Math.round(logo.width*k)),h=Math.max(1,Math.round(logo.height*k));ink.drawImage(logo,0,(16-h)/2,w,h);offset=w+3;}
      const width=text?74:Math.max(1,offset-3),height=16;
      const spot=place(ctx.getImageData(0,0,W,H).data,W,H,width,height);
      // 主標記：蓋在有實體內容的位置；文字加反色描邊，深淺底都看得到。
      if(spot){
        if(text){ink.font='9px sans-serif';ink.textBaseline='middle';ink.lineJoin='round';ink.lineWidth=2.5;ink.strokeStyle=spot.mean>130?'#ffffff':'#181818';ink.strokeText(text,offset,8,74-offset);ink.fillStyle=spot.mean>130?'#181818':'#ffffff';ink.fillText(text,offset,8,74-offset);}
        ctx.save();ctx.globalAlpha=Math.min(1,alpha*1.6);
        // 只覆蓋既有像素，透明邊距及半透明邊緣的 alpha 保持不變。
        ctx.globalCompositeOperation='source-atop';ctx.drawImage(stamp,0,0,width,height,spot.x,spot.y,spot.w,spot.h);ctx.restore();
      }
      // 副標記：整張斜向重複的淡色小字，只落在圖案上；即使主標記被修掉或找不到位置，每張仍有標記。
      const tile=makeTile(text,logo);
      if(tile){ctx.save();ctx.globalAlpha=alpha*.6;ctx.globalCompositeOperation='source-atop';ctx.fillStyle=ctx.createPattern(tile,'repeat');ctx.fillRect(0,0,W,H);ctx.restore();}
      return {marked:true,placed:!!spot};
    }
    function makeTile(text,mark){
      const c=document.createElement('canvas'),probe=c.getContext('2d');probe.font='8px sans-serif';
      const tw=text?Math.ceil(probe.measureText(text).width):(mark?Math.round(mark.width*Math.min(1,10/mark.height)):0);
      if(!tw)return null;
      c.width=tw+30;c.height=Math.ceil(tw*.36)+34;const g=c.getContext('2d');
      g.translate(c.width/2,c.height/2);g.rotate(-.35);g.lineJoin='round';
      if(text){g.font='8px sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=2;g.strokeStyle='#ffffff';g.strokeText(text,0,0);g.fillStyle='#181818';g.fillText(text,0,0);}
      else{const k=Math.min(1,10/mark.height);g.drawImage(mark,-mark.width*k/2,-mark.height*k/2,mark.width*k,mark.height*k);}
      return c;
    }
    return {draw,loading:()=>loading};
  };
  window.StickerBrand.place=place;
})();
