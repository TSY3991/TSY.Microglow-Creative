(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StickerCropCore=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const counts=[8,16,24,32,40];
  // 與 sticker-core.js 預設留白（wide）相同：每格 592×512（37:32），中央 370×320 為 LINE 貼圖尺寸；留白改變時長寬比不變。
  const cell={width:592,height:512};
  const expectedSize=rows=>({width:4*cell.width,height:rows*cell.height});
  const ratioGap=(w,h,rows)=>{const e=expectedSize(rows),want=e.width/e.height;return Math.abs(w/h-want)/want;};
  function cuts(size,n){if(!Number.isInteger(size)||size<n)throw Error('圖片尺寸不足。');return Array.from({length:n+1},(_,i)=>Math.round(size*i/n));}
  function rectangles(w,h,x,y){
    for(const [a,size,name] of [[x,w,'直線'],[y,h,'橫線']]){
      if(a[0]!==0||a[a.length-1]!==size)throw Error(name+'的首尾須是 0 與圖片邊界。');
      for(let i=1;i<a.length-1;i++)if(!Number.isInteger(a[i])||a[i]<=a[i-1]||a[i]>=size)throw Error(name+' '+i+' 的位置不合法：須為整數、比前一條大，並在圖片範圍內。');
    }
    return y.slice(1).flatMap((v,j)=>x.slice(1).map((u,i)=>({x:x[i],y:y[j],width:u-x[i],height:v-y[j]})));
  }
  // 背景：邊緣像素絕大多數透明，或接近同一個顏色；否則回傳 null（無法可靠判斷，由呼叫端改用分割線硬切）。
  function estimateBackground(data,w,h,tol){
    const samples=[],step=Math.max(1,Math.floor(2*(w+h)/4000));
    const take=(x,y)=>{const i=(y*w+x)*4;samples.push([data[i],data[i+1],data[i+2],data[i+3]]);};
    for(let x=0;x<w;x+=step){take(x,0);take(x,h-1);}for(let y=0;y<h;y+=step){take(0,y);take(w-1,y);}
    if(samples.filter(v=>v[3]<=8).length>=samples.length*0.8)return {transparent:true};
    const solid=samples.filter(v=>v[3]>8),mid=c=>solid.map(v=>v[c]).sort((a,b)=>a-b)[solid.length>>1],color=[mid(0),mid(1),mid(2)];
    const near=solid.filter(v=>Math.abs(v[0]-color[0])<=tol&&Math.abs(v[1]-color[1])<=tol&&Math.abs(v[2]-color[2])<=tol).length;
    return near>=samples.length*0.9?{transparent:false,color}:null;
  }
  // 依圖案歸格：先去除與圖片邊緣相連的背景，再把相連的圖案（角色＋文字＋效果）整塊分到所屬格子。
  // 圖案超出平均網格線時不會被切開；只有「兩張貼圖的圖案彼此相連」才依分割線切，並回報 merged。
  function splitByContent(data,w,h,xs,ys,tol=24){
    const bg=estimateBackground(data,w,h,Math.max(tol,16));if(!bg)return null; // 判斷「背景是不是單一顏色」放寬到 16，避免 JPEG 雜訊誤判
    const n=w*h,cols=xs.length-1,rows=ys.length-1,cellCount=cols*rows,c0=bg.color;
    const isBg=p=>{const i=p*4;if(data[i+3]<=8)return true;if(bg.transparent)return false;return Math.abs(data[i]-c0[0])<=tol&&Math.abs(data[i+1]-c0[1])<=tol&&Math.abs(data[i+2]-c0[2])<=tol;};
    const colOf=new Uint8Array(w),rowOf=new Uint8Array(h);
    for(let c=0;c<cols;c++)for(let x=xs[c];x<xs[c+1];x++)colOf[x]=c;
    for(let r=0;r<rows;r++)for(let y=ys[r];y<ys[r+1];y++)rowOf[y]=r;
    const queue=new Int32Array(n),outside=new Uint8Array(n);let head=0,tail=0;
    const seed=p=>{if(!outside[p]&&isBg(p)){outside[p]=1;queue[tail++]=p;}};
    for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x);}for(let y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
    while(head<tail){const p=queue[head++],x=p%w;if(x)seed(p-1);if(x<w-1)seed(p+1);if(p>=w)seed(p-w);if(p<n-w)seed(p+w);}
    const label=new Int32Array(n),stats=[null];let total=0;
    for(let start=0;start<n;start++){
      if(outside[start]||label[start])continue;
      const id=stats.length,counts=new Uint32Array(cellCount);let size=0;head=0;tail=0;label[start]=id;queue[tail++]=start;
      while(head<tail){
        const p=queue[head++],x=p%w,y=(p-x)/w;counts[rowOf[y]*cols+colOf[x]]++;size++;
        for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w||(!dx&&!dy))continue;const q=yy*w+xx;if(!outside[q]&&!label[q]){label[q]=id;queue[tail++]=q;}}}
      }
      stats.push({counts,size});total+=size;
    }
    const cellArea=n/cellCount,target=new Int16Array(stats.length),merged=new Set(),spill=new Set();
    for(let id=1;id<stats.length;id++){
      const {counts,size}=stats[id];let best=0;for(let c=1;c<cellCount;c++)if(counts[c]>counts[best])best=c;
      if(size<Math.max(12,cellArea*0.0005))target[id]=-2;
      else if(counts[best]>=size*0.8||size<cellArea*0.01){target[id]=best;if(size-counts[best]>Math.max(10,cellArea*0.002))spill.add(best);}
      else{target[id]=-1;for(let c=0;c<cellCount;c++)if(counts[c]>=size*0.05)merged.add(c);}
    }
    const box=Array.from({length:cellCount},()=>({l:w,t:h,r:-1,b:-1}));
    const owner=p=>{const t=target[label[p]];if(t>=0)return t;const x=p%w;return rowOf[(p-x)/w]*cols+colOf[x];};
    for(let p=0;p<n;p++){if(!label[p]||target[label[p]]===-2)continue;const x=p%w,y=(p-x)/w,b=box[owner(p)];if(x<b.l)b.l=x;if(x>b.r)b.r=x;if(y<b.t)b.t=y;if(y>b.b)b.b=y;}
    // 圖案貼著所屬格子的邊緣、且邊緣外面就是背景（或圖片外）：母圖在這裡可能已被生成工具切平。
    const edge=Array.from({length:cellCount},()=>[0,0,0,0]);
    for(let p=0;p<n;p++){
      if(!label[p]||target[label[p]]===-2)continue;
      const x=p%w,y=(p-x)/w,a=owner(p),cx=a%cols,cy=(a-cx)/cols,gone=q=>!label[q]||target[label[q]]===-2;
      if(x===xs[cx]&&(x===0||gone(p-1)))edge[a][0]++;
      if(x===xs[cx+1]-1&&(x===w-1||gone(p+1)))edge[a][1]++;
      if(y===ys[cy]&&(y===0||gone(p-w)))edge[a][2]++;
      if(y===ys[cy+1]-1&&(y===h-1||gone(p+w)))edge[a][3]++;
    }
    const clipped=[];
    for(let a=0;a<cellCount;a++){const cx=a%cols,cy=(a-cx)/cols,limit=Math.max(6,0.04*Math.min(xs[cx+1]-xs[cx],ys[cy+1]-ys[cy]));if(Math.max(...edge[a])>=limit)clipped.push(a);}
    const cells=box.map(b=>b.r<0?null:{x:b.l,y:b.t,width:b.r-b.l+1,height:b.b-b.t+1,data:null});
    cells.forEach(c=>{if(c)c.data=new Uint8ClampedArray(c.width*c.height*4);});
    for(let p=0;p<n;p++){
      if(!label[p]||target[label[p]]===-2)continue;const a=owner(p),c=cells[a],x=p%w,y=(p-x)/w,o=((y-c.y)*c.width+(x-c.x))*4,i=p*4;
      c.data[o]=data[i];c.data[o+1]=data[i+1];c.data[o+2]=data[i+2];c.data[o+3]=data[i+3];
    }
    const sorted=set=>Array.from(set).sort((a,b)=>a-b);
    return {cells,merged:sorted(merged),spill:sorted(spill),clipped,components:stats.length-1,transparent:bg.transparent};
  }
  // 依 splitByContent 的結果（無法判斷背景時傳 null）建議用哪一種裁切方式，並附上白話原因。
  function advise(split){
    if(!split)return {mode:'hard',reasons:['背景不是單一顏色（可能有漸層、陰影或花紋），智慧分割無法可靠辨識，只能依分割線硬切。']};
    const cross=Array.from(new Set([...split.spill,...split.merged])).sort((a,b)=>a-b);
    if(cross.length)return {mode:'smart',cross,reasons:['第 '+cross.map(n=>n+1).join('、')+' 格的圖案超出或壓在分割線上，硬切會切到；智慧分割會讓圖案保持完整。'+(split.merged.length?'（其中第 '+split.merged.map(n=>n+1).join('、')+' 格的圖案和相鄰格相連，仍只能依分割線切開。）':'')]};
    if(split.transparent)return {mode:'hard',cross:[],reasons:['每格圖案都在分割線內，母圖本身已是透明背景，兩種方式結果幾乎相同；硬切最單純，不會誤去掉白色描邊。']};
    return {mode:'smart',cross:[],reasons:['每格圖案都在分割線內，不會被切到；但母圖是單色背景，智慧分割能順便把背景去成透明（LINE 貼圖需要透明背景）。']};
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
  return {counts,cell,expectedSize,ratioGap,estimateBackground,splitByContent,advise,cuts,rectangles,eraseWhite,bounds,fit,crc,png72,zip};
});
