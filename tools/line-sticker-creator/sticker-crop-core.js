(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StickerCropCore=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const counts=[8,16,24,32,40];
  function cuts(size,n){if(!Number.isInteger(size)||size<n)throw Error('圖片尺寸不足。');return Array.from({length:n+1},(_,i)=>Math.round(size*i/n));}
  function rectangles(w,h,x,y){
    for(const [a,size] of [[x,w],[y,h]])if(a[0]!==0||a[a.length-1]!==size||a.some((v,i)=>!Number.isInteger(v)||(i&&v<=a[i-1])))throw Error('分割線須依序遞增，且位於圖片範圍內。');
    return y.slice(1).flatMap((v,j)=>x.slice(1).map((u,i)=>({x:x[i],y:y[j],width:u-x[i],height:v-y[j]})));
  }
  // Only remove near-white pixels reachable from the frame. Never mutate the source.
  function eraseWhite(data,w,h,threshold=248){
    const out=new Uint8ClampedArray(data),seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
    function add(p){if(seen[p])return;seen[p]=1;const i=p*4,r=out[i],g=out[i+1],b=out[i+2];if(out[i+3]&&Math.min(r,g,b)>=threshold&&Math.max(r,g,b)-Math.min(r,g,b)<=12){queue[tail++]=p;out[i+3]=0;}}
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
    while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);if(x)add(p-1);if(x<w-1)add(p+1);if(y)add(p-w);if(y<h-1)add(p+w);}
    return out;
  }
  function bounds(data,w,h){let left=w,top=h,right=-1,bottom=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return right<0?null:{x:left,y:top,width:right-left+1,height:bottom-top+1};}
  function fit(w,h,W=370,H=320,zoom=100,dx=0,dy=0,pad=10){const s=Math.min((W-2*pad)/w,(H-2*pad)/h)*Math.min(100,Math.max(50,zoom))/100,width=w*s,height=h*s;return {width,height,x:Math.max(pad,Math.min(W-pad-width,(W-width)/2+dx)),y:Math.max(pad,Math.min(H-pad-height,(H-height)/2+dy))};}
  const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  function crc(data){let n=0xffffffff;for(const b of data)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
  function join(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;}
  function png72(bytes){
    const parts=[bytes.slice(0,8)];let p=8;
    if(bytes[0]!==137||bytes[1]!==80)throw Error('PNG 編碼失敗。');
    while(p<bytes.length){const n=new DataView(bytes.buffer,bytes.byteOffset+p,4).getUint32(0),type=String.fromCharCode(...bytes.slice(p+4,p+8));if(p+n+12>bytes.length)throw Error('PNG 不完整。');if(type!=='pHYs')parts.push(bytes.slice(p,p+n+12));if(type==='IHDR'){const c=new Uint8Array(21),v=new DataView(c.buffer);v.setUint32(0,9);c.set([112,72,89,115],4);v.setUint32(8,2835);v.setUint32(12,2835);c[16]=1;v.setUint32(17,crc(c.slice(4,17)));parts.push(c);}p+=n+12;}
    return join(parts);
  }
  function zip(entries){
    const local=[],central=[];let offset=0;
    entries.forEach(({name,data})=>{if(data.length>1024*1024)throw Error(name+' 超過 1 MB，請調整圖片。');const filename=new TextEncoder().encode(name),sum=crc(data),a=new Uint8Array(30+filename.length),av=new DataView(a.buffer);av.setUint32(0,0x04034b50,true);av.setUint16(4,20,true);av.setUint16(12,33,true);av.setUint32(14,sum,true);av.setUint32(18,data.length,true);av.setUint32(22,data.length,true);av.setUint16(26,filename.length,true);a.set(filename,30);local.push(a,data);const b=new Uint8Array(46+filename.length),bv=new DataView(b.buffer);bv.setUint32(0,0x02014b50,true);bv.setUint16(4,20,true);bv.setUint16(6,20,true);bv.setUint16(14,33,true);bv.setUint32(16,sum,true);bv.setUint32(20,data.length,true);bv.setUint32(24,data.length,true);bv.setUint16(28,filename.length,true);bv.setUint32(42,offset,true);b.set(filename,46);central.push(b);offset+=a.length+data.length;});
    const directory=join(central),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,directory.length,true);v.setUint32(16,offset,true);const result=join([...local,directory,end]);if(result.length>=60*1024*1024)throw Error('ZIP 必須小於 60 MB。');return result;
  }
  return {counts,cuts,rectangles,eraseWhite,bounds,fit,crc,png72,zip};
});
