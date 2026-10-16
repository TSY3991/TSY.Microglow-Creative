(function(){
  'use strict';
  // 標記只合成在輸出副本，絕不寫回母圖或修圖來源。
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
      if(!text&&!logo)return;
      const ctx=target.getContext('2d'),W=target.width,H=target.height;
      const stamp=document.createElement('canvas');stamp.width=74;stamp.height=16;
      const ink=stamp.getContext('2d');let offset=0;
      if(logo){const k=Math.min(30/logo.width,14/logo.height);const w=Math.max(1,Math.round(logo.width*k)),h=Math.max(1,Math.round(logo.height*k));ink.drawImage(logo,0,(16-h)/2,w,h);offset=w+3;}
      // 在下半部尋找較平整、且有實體內容承接的位置，避免臉部所在的上半部。
      const width=text?74:Math.max(1,offset-3),height=16;
      const data=ctx.getImageData(0,0,W,H).data;let best=null;
      for(let y=H-height-12;y>=12;y-=6)for(let x=12;x<=W-width-12;x+=8){
        let count=0,total=0,squares=0,samples=0;
        for(let yy=y;yy<y+height;yy+=2)for(let xx=x;xx<x+width;xx+=2){const p=(yy*W+xx)*4;samples++;if(data[p+3]<220)continue;const l=(data[p]*.2126+data[p+1]*.7152+data[p+2]*.0722);count++;total+=l;squares+=l*l;}
        if(!count)continue;const mean=total/count,variance=squares/count-mean*mean;
        const score=count/samples*1000-variance*.015+y/H*10+(y>=H*.58?200:0);
        if(!best||score>best.score)best={x,y,score,mean};
      }
      if(!best)return;
      if(text){ink.fillStyle=best.mean>130?'#181818':'#ffffff';ink.font='9px sans-serif';ink.textBaseline='middle';ink.fillText(text,offset,8,74-offset);}
      ctx.save();ctx.globalAlpha=Number($('crop-brand-opacity').value)/100;
      // 只覆蓋既有像素，透明邊距及半透明邊緣的 alpha 保持不變。
      ctx.globalCompositeOperation='source-atop';ctx.drawImage(stamp,0,0,width,height,best.x,best.y,width,height);ctx.restore();
    }
    return {draw,loading:()=>loading};
  };
})();
