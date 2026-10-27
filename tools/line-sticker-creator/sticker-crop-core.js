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
  // 生成工具常在圖片最外圈留一道細框線或陰影，所以除了最外圈，也試著往內 1%～5% 的幾圈取樣，取第一個能判斷出背景的。
  function estimateBackground(data,w,h,tol){
    for(const f of [0,0.01,0.02,0.03,0.05]){
      const inset=f?Math.max(1,Math.round(f*Math.min(w,h))):0;
      if(w-2*inset<8||h-2*inset<8)break;
      const found=estimateRing(data,w,h,tol,inset);if(found)return found;
    }
    return null;
  }
  function estimateRing(data,w,h,tol,inset){
    const samples=[],step=Math.max(1,Math.floor(2*(w+h)/4000)),x0=inset,y0=inset,x1=w-1-inset,y1=h-1-inset;
    const take=(x,y)=>{const i=(y*w+x)*4;samples.push([data[i],data[i+1],data[i+2],data[i+3]]);};
    for(let x=x0;x<=x1;x+=step){take(x,y0);take(x,y1);}for(let y=y0;y<=y1;y+=step){take(x0,y);take(x1,y);}
    if(samples.filter(v=>v[3]<=8).length>=samples.length*0.8)return {transparent:true};
    const solid=samples.filter(v=>v[3]>8),mid=c=>solid.map(v=>v[c]).sort((a,b)=>a-b)[solid.length>>1],color=[mid(0),mid(1),mid(2)];
    const near=solid.filter(v=>Math.abs(v[0]-color[0])<=tol&&Math.abs(v[1]-color[1])<=tol&&Math.abs(v[2]-color[2])<=tol).length;
    if(near>=samples.length*0.9)return {transparent:false,color,colors:[color]};
    // AI 常把「透明」畫成灰白棋盤格：邊緣只有兩種接近灰白的顏色交錯時，兩種都視為背景。
    const grey=v=>Math.max(v[0],v[1],v[2])-Math.min(v[0],v[1],v[2])<=14,lum=v=>v[0]+v[1]+v[2],sorted=solid.slice().sort((a,b)=>lum(a)-lum(b)),half=sorted.length>>1;
    if(solid.length>=samples.length*0.9&&solid.every(grey)&&half>=4){
      const med=(list,c)=>list.map(v=>v[c]).sort((a,b)=>a-b)[list.length>>1],lo=sorted.slice(0,half),hi=sorted.slice(half),a=[med(lo,0),med(lo,1),med(lo,2)],b=[med(hi,0),med(hi,1),med(hi,2)];
      const close=(v,c)=>Math.abs(v[0]-c[0])<=tol&&Math.abs(v[1]-c[1])<=tol&&Math.abs(v[2]-c[2])<=tol;
      const na=solid.filter(v=>close(v,a)).length,nb=solid.filter(v=>close(v,b)).length;
      if(lum(b)-lum(a)>=24&&na>=samples.length*0.25&&nb>=samples.length*0.25&&na+nb>=samples.length*0.9)return {transparent:false,color:b,colors:[a,b],checker:true};
    }
    return null;
  }
  // 依圖案歸格：先去除與圖片邊緣相連的背景，再把相連的圖案（角色＋文字＋效果）整塊分到所屬格子。
  // 圖案超出平均網格線時不會被切開；只有「兩張貼圖的圖案彼此相連」才依分割線切，並回報 merged。
  function splitByContent(data,w,h,xs,ys,tol=24){
    const bg=estimateBackground(data,w,h,Math.max(tol,16));if(!bg)return null; // 判斷「背景是不是單一顏色」放寬到 16，避免 JPEG 雜訊誤判
    const n=w*h,cols=xs.length-1,rows=ys.length-1,cellCount=cols*rows,bgColors=bg.colors||[bg.color];
    const isBg=p=>{const i=p*4;if(data[i+3]<=8)return true;if(bg.transparent)return false;for(const c0 of bgColors)if(Math.abs(data[i]-c0[0])<=tol&&Math.abs(data[i+1]-c0[1])<=tol&&Math.abs(data[i+2]-c0[2])<=tol)return true;return false;};
    const colOf=new Uint8Array(w),rowOf=new Uint8Array(h);
    for(let c=0;c<cols;c++)for(let x=xs[c];x<xs[c+1];x++)colOf[x]=c;
    for(let r=0;r<rows;r++)for(let y=ys[r];y<ys[r+1];y++)rowOf[y]=r;
    const queue=new Int32Array(n),outside=new Uint8Array(n);let head=0,tail=0;
    const seed=p=>{if(!outside[p]&&isBg(p)){outside[p]=1;queue[tail++]=p;}};
    for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x);}for(let y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
    // 生成工具常在每格外畫框線或格線，使格內背景與圖片邊緣不相連：另外從每格內縮一點的四邊也當起點。
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const x0=xs[c],x1=xs[c+1]-1,y0=ys[r],y1=ys[r+1]-1;
      for(const f of [0.03,0.06,0.09]){ // 框線粗細不明，內縮 3%／6%／9% 各取一圈（只有背景色的點會成為起點）
        const d=Math.max(2,Math.round(f*Math.min(x1-x0,y1-y0)));
        if(x1-x0<=2*d||y1-y0<=2*d)continue;
        for(let x=x0+d;x<=x1-d;x++){seed((y0+d)*w+x);seed((y1-d)*w+x);}
        for(let y=y0+d;y<=y1-d;y++){seed(y*w+x0+d);seed(y*w+x1-d);}
      }
    }
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
    // 相連的圖案（兩張貼圖的圖案碰在一起）：不沿直線切，而是從每格中央的圖案往外「長」，在最細的連接處交會，
    // 這樣切口會順著圖案的形狀走。每一步的成本與該處厚度成反比（厚處便宜、細處貴），所以分界落在頸部。
    const own=new Int16Array(n).fill(-1);
    if(target.some(t=>t===-1)){
      const INF=1e9,dt=new Int32Array(n);
      const mergedPx=p=>label[p]&&target[label[p]]===-1;
      for(let p=0;p<n;p++)dt[p]=mergedPx(p)?INF:0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(!dt[p])continue;let v=dt[p];
        if(x===0||y===0)v=Math.min(v,3);
        if(x)v=Math.min(v,dt[p-1]+3);if(y)v=Math.min(v,dt[p-w]+3);if(x&&y)v=Math.min(v,dt[p-w-1]+4);if(x<w-1&&y)v=Math.min(v,dt[p-w+1]+4);dt[p]=v;}
      for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const p=y*w+x;if(!dt[p])continue;let v=dt[p];
        if(x===w-1||y===h-1)v=Math.min(v,3);
        if(x<w-1)v=Math.min(v,dt[p+1]+3);if(y<h-1)v=Math.min(v,dt[p+w]+3);if(x<w-1&&y<h-1)v=Math.min(v,dt[p+w+1]+4);if(x&&y<h-1)v=Math.min(v,dt[p+w-1]+4);dt[p]=v;}
      const cost=p=>1+Math.round(30/(1+dt[p]/3));
      const dist=new Int32Array(n).fill(INF),hk=[],hv=[];
      const push=(k,v)=>{let i=hk.length;hk.push(k);hv.push(v);while(i>0){const j=(i-1)>>1;if(hk[j]<=k)break;hk[i]=hk[j];hv[i]=hv[j];i=j;}hk[i]=k;hv[i]=v;};
      const pop=()=>{const k0=hk[0],v0=hv[0],k=hk.pop(),v=hv.pop();if(hk.length){let i=0;for(;;){let c=2*i+1;if(c>=hk.length)break;if(c+1<hk.length&&hk[c+1]<hk[c])c++;if(hk[c]>=k)break;hk[i]=hk[c];hv[i]=hv[c];i=c;}hk[i]=k;hv[i]=v;}return [k0,v0];};
      // 種子（標記）：把每塊相連圖案逐步「侵蝕」（只留下夠厚的部分），直到斷成兩塊以上、且分屬不同格，
      // 這些厚實的主體就是各格的標記；細細的連接處在侵蝕時先斷掉，所以切口會落在頸部。
      const pts=new Map();
      for(let p=0;p<n;p++)if(mergedPx(p)){const id=label[p];if(!pts.has(id))pts.set(id,[]);pts.get(id).push(p);}
      const piece=new Int32Array(n).fill(-1),cellOf=p=>{const x=p%w;return rowOf[(p-x)/w]*cols+colOf[x];};
      for(const [id,list] of pts){
        let maxDt=0;for(const p of list)if(dt[p]>maxDt)maxDt=dt[p];
        // 每個明顯有這塊圖案的格子都要有標記；只找到部分格子的主體就停止，會把漏掉的整張歸給鄰格。
        const needed=[];for(let c=0;c<cellCount;c++)if(stats[id].counts[c]>=stats[id].size*0.05)needed.push(c);
        let marked=false;
        for(const f of [0.2,0.3,0.4,0.55,0.7]){
          const T=maxDt*f,pieces=[];
          for(const start of list){
            if(dt[start]<=T||piece[start]>=0)continue;
            const members=[start];piece[start]=pieces.length;let sx=0,sy=0;
            for(let k=0;k<members.length;k++){
              const q=members[k],qx=q%w,qy=(q-qx)/w;sx+=qx;sy+=qy;
              for(let dy=-1;dy<=1;dy++){const yy=qy+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=qx+dx;if(xx<0||xx>=w||(!dx&&!dy))continue;const r=yy*w+xx;if(label[r]===id&&dt[r]>T&&piece[r]<0){piece[r]=pieces.length;members.push(r);}}}
            }
            pieces.push({members,cell:cellOf(Math.round(sy/members.length)*w+Math.round(sx/members.length))});
          }
          const big=pieces.filter(x=>x.members.length>=Math.max(30,cellArea*0.01,stats[id].counts[x.cell]*0.1)); // 主體要占該格相連圖案的一成以上，避免較薄的那張貼圖被侵蝕到只剩一小塊、種子太小而被鄰格吞掉
          const represented=new Set(big.map(x=>x.cell));
          if(big.length>=2&&represented.size>=2&&needed.every(c=>represented.has(c))){
            for(const pc of big)for(const q of pc.members){own[q]=pc.cell;dist[q]=0;push(0,q);}
            marked=true;
          }
          for(const pc of pieces)for(const q of pc.members)piece[q]=-1;
          if(marked)break;
        }
        if(!marked){ // 侵蝕分不開：退回「每格中央一小塊」當種子（12%→40% 逐步放寬）
          const seededCell=new Set();
          for(const f of [0.12,0.2,0.3,0.4]){
            const found=new Set();
            for(const p of list){const x=p%w,y=(p-x)/w,c=colOf[x],r=rowOf[y],cw=xs[c+1]-xs[c],ch=ys[r+1]-ys[r],key=r*cols+c;
              if(seededCell.has(key))continue;
              if(Math.abs(x-(xs[c]+cw/2))<=cw*f&&Math.abs(y-(ys[r]+ch/2))<=ch*f){own[p]=key;dist[p]=0;push(0,p);found.add(key);}}
            found.forEach(k=>seededCell.add(k));
          }
        }
      }
      while(hk.length){
        const [d,p]=pop();if(d>dist[p])continue;const x=p%w,y=(p-x)/w;
        for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w||(!dx&&!dy))continue;const q=yy*w+xx;
          if(label[q]!==label[p])continue;const nd=d+cost(q);if(nd<dist[q]){dist[q]=nd;own[q]=own[p];push(nd,q);}}}
      }
    }
    const owner=p=>{const t=target[label[p]];if(t>=0)return t;if(own[p]>=0)return own[p];const x=p%w;return rowOf[(p-x)/w]*cols+colOf[x];};
    for(let p=0;p<n;p++){if(!label[p]||target[label[p]]===-2)continue;const x=p%w,y=(p-x)/w,b=box[owner(p)];if(x<b.l)b.l=x;if(x>b.r)b.r=x;if(y<b.t)b.t=y;if(y>b.b)b.b=y;}
    // 圖案貼著所屬格子的邊緣、且邊緣外面就是背景（或圖片外）：母圖在這裡可能已被生成工具切平。
    // 要有「連續一長段」貼邊才算被切平：手指、髮絲之類只在線上碰到幾個點的不算。
    const lastX=new Int32Array(cellCount*4).fill(-9),lastY=new Int32Array(cellCount*4).fill(-9),run=new Int32Array(cellCount*4),best=new Int32Array(cellCount*4);
    const hit=(a,side,x,y)=>{
      const k=a*4+side,next=side<2?(lastY[k]===y-1&&lastX[k]===x):(lastY[k]===y&&lastX[k]===x-1);
      run[k]=next?run[k]+1:1;lastX[k]=x;lastY[k]=y;if(run[k]>best[k])best[k]=run[k];
    };
    for(let p=0;p<n;p++){
      if(!label[p]||target[label[p]]===-2)continue;
      const x=p%w,y=(p-x)/w,a=owner(p),cx=a%cols,cy=(a-cx)/cols,gone=q=>!label[q]||target[label[q]]===-2;
      if(x===xs[cx]&&(x===0||gone(p-1)))hit(a,0,x,y);
      if(x===xs[cx+1]-1&&(x===w-1||gone(p+1)))hit(a,1,x,y);
      if(y===ys[cy]&&(y===0||gone(p-w)))hit(a,2,x,y);
      if(y===ys[cy+1]-1&&(y===h-1||gone(p+w)))hit(a,3,x,y);
    }
    const clipped=[];
    for(let a=0;a<cellCount;a++){const cx=a%cols,cy=(a-cx)/cols,limit=Math.max(8,0.06*Math.min(xs[cx+1]-xs[cx],ys[cy+1]-ys[cy]));if(Math.max(best[a*4],best[a*4+1],best[a*4+2],best[a*4+3])>=limit)clipped.push(a);}
    const cells=box.map(b=>b.r<0?null:{x:b.l,y:b.t,width:b.r-b.l+1,height:b.b-b.t+1,data:null});
    cells.forEach(c=>{if(c)c.data=new Uint8ClampedArray(c.width*c.height*4);});
    for(let p=0;p<n;p++){
      if(!label[p]||target[label[p]]===-2)continue;const a=owner(p),c=cells[a],x=p%w,y=(p-x)/w,o=((y-c.y)*c.width+(x-c.x))*4,i=p*4;
      c.data[o]=data[i];c.data[o+1]=data[i+1];c.data[o+2]=data[i+2];c.data[o+3]=data[i+3];
    }
    const sorted=set=>Array.from(set).sort((a,b)=>a-b);
    return {cells,merged:sorted(merged),spill:sorted(spill),clipped,components:stats.length-1,transparent:bg.transparent,outside,width:w,height:h};
  }
  // 依 splitByContent 的結果（無法判斷背景時傳 null）建議用哪一種裁切方式，並附上白話原因。
  function advise(split){
    if(!split)return {mode:'hard',reasons:['背景不是單一顏色（可能有漸層、陰影或花紋），智慧分割無法可靠辨識，只能依分割線硬切。']};
    const cross=Array.from(new Set([...split.spill,...split.merged])).sort((a,b)=>a-b);
    if(cross.length)return {mode:'smart',cross,reasons:['第 '+cross.map(n=>n+1).join('、')+' 格的圖案超出或壓在分割線上，硬切會切到；智慧分割會讓圖案保持完整。'+(split.merged.length?'（其中第 '+split.merged.map(n=>n+1).join('、')+' 格的圖案和相鄰格相連，仍只能依分割線切開。）':'')]};
    if(split.transparent)return {mode:'hard',cross:[],reasons:['每格圖案都在分割線內，母圖本身已是透明背景，兩種方式結果幾乎相同；硬切最單純，不會誤去掉白色描邊。']};
    return {mode:'smart',cross:[],reasons:['每格圖案都在分割線內，不會被切到；但母圖是單色背景，智慧分割能順便把背景去成透明（LINE 貼圖需要透明背景）。']};
  }
  // 依透明度把圖案分成互不相連的區塊（8 鄰接），回傳每個區塊的面積與外框。
  function alphaComponents(data,w,h,min=8){
    const n=w*h,label=new Int32Array(n),queue=new Int32Array(n),comps=[];
    for(let start=0;start<n;start++){
      if(data[start*4+3]<=min||label[start])continue;
      const id=comps.length+1,c={id,area:0,minx:w,maxx:-1,miny:h,maxy:-1};let head=0,tail=0;label[start]=id;queue[tail++]=start;
      while(head<tail){
        const q=queue[head++],x=q%w,y=(q-x)/w;c.area++;if(x<c.minx)c.minx=x;if(x>c.maxx)c.maxx=x;if(y<c.miny)c.miny=y;if(y>c.maxy)c.maxy=y;
        for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w||(!dx&&!dy))continue;const r=yy*w+xx;if(data[r*4+3]>min&&!label[r]){label[r]=id;queue[tail++]=r;}}}
      }
      comps.push(c);
    }
    return {label,comps};
  }
  // 把圖案分成「塊」：先分成互不相連的區塊，再把每塊在最細的連接處（頸部）切開，切口順著形狀走。
  // level 1～6：數字越大，越容易在較粗的連接處切開（塊數變多）。回傳 region（每個像素的塊編號，0＝沒有圖案）與每塊的面積、外框。
  function partitionArt(data,w,h,level=3,solid=200){
    // 以「夠不透明」的像素（alpha≥solid）找區塊與厚度，避免半透明的光暈把文字和角色黏在一起；最後再把半透明邊緣歸給最近的塊。
    const {label,comps}=alphaComponents(data,w,h,solid-1),n=w*h,region=new Int32Array(n),fractions=[0.06,0.1,0.15,0.22,0.32,0.45],frac=fractions[Math.max(0,Math.min(5,level-1))];
    if(!comps.length)return {region,regions:[]};
    const INF=1e9,dt=new Int32Array(n);
    for(let p=0;p<n;p++)dt[p]=label[p]?INF:0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(!dt[p])continue;let v=dt[p];if(x===0||y===0)v=Math.min(v,3);if(x)v=Math.min(v,dt[p-1]+3);if(y)v=Math.min(v,dt[p-w]+3);if(x&&y)v=Math.min(v,dt[p-w-1]+4);if(x<w-1&&y)v=Math.min(v,dt[p-w+1]+4);dt[p]=v;}
    for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const p=y*w+x;if(!dt[p])continue;let v=dt[p];if(x===w-1||y===h-1)v=Math.min(v,3);if(x<w-1)v=Math.min(v,dt[p+1]+3);if(y<h-1)v=Math.min(v,dt[p+w]+3);if(x<w-1&&y<h-1)v=Math.min(v,dt[p+w+1]+4);if(x&&y<h-1)v=Math.min(v,dt[p+w-1]+4);dt[p]=v;}
    const cost=p=>1+Math.round(30/(1+dt[p]/3)),dist=new Int32Array(n).fill(INF),hk=[],hv=[];
    const push=(k,v)=>{let i=hk.length;hk.push(k);hv.push(v);while(i>0){const j=(i-1)>>1;if(hk[j]<=k)break;hk[i]=hk[j];hv[i]=hv[j];i=j;}hk[i]=k;hv[i]=v;};
    const pop=()=>{const k0=hk[0],v0=hv[0],k=hk.pop(),v=hv.pop();if(hk.length){let i=0;for(;;){let c=2*i+1;if(c>=hk.length)break;if(c+1<hk.length&&hk[c+1]<hk[c])c++;if(hk[c]>=k)break;hk[i]=hk[c];hv[i]=hv[c];i=c;}hk[i]=k;hv[i]=v;}return [k0,v0];};
    const pts=new Map();for(let p=0;p<n;p++)if(label[p]){if(!pts.has(label[p]))pts.set(label[p],[]);pts.get(label[p]).push(p);}
    const piece=new Int32Array(n).fill(-1);let nextId=0;
    for(const [id,list] of pts){
      let maxDt=0;for(const p of list)if(dt[p]>maxDt)maxDt=dt[p];
      const T=maxDt*frac,pieces=[],minArea=Math.max(30,list.length*0.005);
      for(const start of list){
        if(dt[start]<=T||piece[start]>=0)continue;
        const members=[start];piece[start]=pieces.length;
        for(let k=0;k<members.length;k++){
          const q=members[k],qx=q%w,qy=(q-qx)/w;
          for(let dy=-1;dy<=1;dy++){const yy=qy+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=qx+dx;if(xx<0||xx>=w||(!dx&&!dy))continue;const r=yy*w+xx;if(label[r]===id&&dt[r]>T&&piece[r]<0){piece[r]=pieces.length;members.push(r);}}}
        }
        pieces.push(members);
      }
      const big=pieces.filter(m=>m.length>=minArea);
      for(const m of pieces)for(const q of m)piece[q]=-1;
      if(big.length<2){const rid=++nextId;for(const p of list)region[p]=rid;continue;}
      const ids=big.map(()=>++nextId);
      big.forEach((m,i)=>{for(const q of m){region[q]=ids[i];dist[q]=0;push(0,q);}});
      while(hk.length){
        const [d,p]=pop();if(d>dist[p])continue;const x=p%w,y=(p-x)/w;
        for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w||(!dx&&!dy))continue;const q=yy*w+xx;
          if(label[q]!==id)continue;const nd=d+cost(q);if(nd<dist[q]){dist[q]=nd;region[q]=region[p];push(nd,q);}}}
      }
      for(const p of list)if(!region[p]){const rid=++nextId;region[p]=rid;} // 理論上不會發生：沒被擴張到的像素自成一塊
    }
    {const q=[];for(let p=0;p<n;p++)if(region[p])q.push(p);
      for(let head=0;head<q.length;head++){const p=q[head],x=p%w,y=(p-x)/w;
        for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w||(!dx&&!dy))continue;const r=yy*w+xx;if(!region[r]&&data[r*4+3]>8){region[r]=region[p];q.push(r);}}}}}
    const stats=new Map();
    for(let p=0;p<n;p++){const r=region[p];if(!r)continue;const x=p%w,y=(p-x)/w;let s=stats.get(r);if(!s){s={id:r,area:0,minx:w,maxx:-1,miny:h,maxy:-1};stats.set(r,s);}s.area++;if(x<s.minx)s.minx=x;if(x>s.maxx)s.maxx=x;if(y<s.miny)s.miny=y;if(y>s.maxy)s.maxy=y;}
    return {region,regions:Array.from(stats.values()).sort((a,b)=>b.area-a.area)};
  }
  // 猜哪些「塊」是文字或裝飾：最大的當角色；其餘中心落在角色外框之外，或面積小於角色 1% 的，視為多餘。
  function guessTextRegions(parts){
    const {regions}=parts;if(regions.length<2)return [];
    const main=regions[0];
    return regions.slice(1).filter(c=>{const cx=(c.minx+c.maxx)/2,cy=(c.miny+c.maxy)/2;return cx<main.minx||cx>main.maxx||cy<main.miny||cy>main.maxy||c.area<main.area*0.01;}).map(c=>c.id);
  }
  // 補平缺口：mask=1 且目前透明的像素，由周圍不透明的像素顏色一圈一圈往內擴散補上（適合小缺口；缺口越大越模糊）。直接修改 data，回傳補了幾個像素。
  function inpaint(data,w,h,mask,maxPasses=80){
    const n=w*h,todo=new Uint8Array(n);let remain=0;
    for(let p=0;p<n;p++)if(mask[p]&&data[p*4+3]<=8){todo[p]=1;remain++;}
    const total=remain;
    for(let pass=0;pass<maxPasses&&remain;pass++){
      const upd=[];
      for(let p=0;p<n;p++){
        if(!todo[p])continue;const x=p%w,y=(p-x)/w;let r=0,g=0,b=0,k=0;
        for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w||(!dx&&!dy))continue;const q=yy*w+xx;if(todo[q]||data[q*4+3]<=8)continue;const wt=data[q*4+3]/255*(dx&&dy?0.7:1);r+=data[q*4]*wt;g+=data[q*4+1]*wt;b+=data[q*4+2]*wt;k+=wt;}}
        if(k>0)upd.push(p,Math.round(r/k),Math.round(g/k),Math.round(b/k));
      }
      if(!upd.length)break;
      for(let i=0;i<upd.length;i+=4){const p=upd[i];data[p*4]=upd[i+1];data[p*4+1]=upd[i+2];data[p*4+2]=upd[i+3];data[p*4+3]=255;todo[p]=0;remain--;}
    }
    return total-remain;
  }
  // 猜哪些區塊是文字或裝飾：最大的相連圖案當角色；其他區塊中心落在角色外框之外、或面積很小的都視為多餘。
  // 只能處理「和角色沒有相連」的文字；文字壓在角色上或與角色相連時分不開，需要手動修圖。回傳要擦掉的遮罩。
  function textBlobs(data,w,h){
    const {label,comps}=alphaComponents(data,w,h);
    if(comps.length<2)return {mask:null,count:0};
    const main=comps.reduce((a,b)=>b.area>a.area?b:a);
    const drop=new Set();
    for(const c of comps){
      if(c===main)continue;
      const cx=(c.minx+c.maxx)/2,cy=(c.miny+c.maxy)/2,inside=cx>=main.minx&&cx<=main.maxx&&cy>=main.miny&&cy<=main.maxy;
      if(!inside||c.area<main.area*0.01)drop.add(c.id);
    }
    if(!drop.size)return {mask:null,count:0};
    const mask=new Uint8Array(w*h);for(let p=0;p<mask.length;p++)if(drop.has(label[p]))mask[p]=1;
    return {mask,count:drop.size};
  }
  // 清掉擦完後留下的小碎片：面積小於最大區塊 0.4%（且不到 40 像素以上的）孤立區塊。直接修改 data 的 alpha，回傳清掉幾塊。
  function cleanSpecks(data,w,h,ratio=0.004,min=40){
    const {label,comps}=alphaComponents(data,w,h);if(!comps.length)return 0;
    const biggest=comps.reduce((a,b)=>b.area>a.area?b:a),limit=Math.max(min,biggest.area*ratio),drop=new Set(comps.filter(c=>c!==biggest&&c.area<limit).map(c=>c.id));
    if(!drop.size)return 0;
    for(let p=0;p<label.length;p++)if(drop.has(label[p]))data[p*4+3]=0;
    return drop.size;
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
  // main／tab 預設：在「角色佔比最大的前三分之一」裡隨機挑一張；排除被切到、相連或背景未去的格子（都排除就退回全部有圖的格子）。
  function pickMain(items,rnd=Math.random){
    const has=items.map((x,i)=>x&&x.area>0?i:-1).filter(i=>i>=0);if(!has.length)return 0;
    const good=has.filter(i=>items[i].ok),pool=(good.length?good:has).sort((a,b)=>items[b].area-items[a].area||a-b);
    const top=pool.slice(0,Math.max(1,Math.ceil(pool.length/3)));return top[Math.min(top.length-1,Math.floor(rnd()*top.length))];
  }
  // 單格修正（改圖不走樣）：由整組第 index 張貼圖（0 起算）推得所在母圖、格號、列欄；grids 為各母圖格數（8 或 16）。
  function locateCell(grids,index){
    let rest=index;
    for(let m=0;m<grids.length;m++){if(rest<grids[m])return {mother:m+1,cell:rest+1,row:Math.floor(rest/4)+1,col:rest%4+1,sticker:index+1};rest-=grids[m];}
    return null;
  }
  // 只改一格的文字：要改與要保留分開寫，並以 Do not change anything else 收尾。text 空白時改成讓使用者自己描述要改的地方。
  function cellFixPrompt(loc,text){
    const t=String(text||'').trim(),where='母圖 '+loc.mother+' 的第 '+loc.cell+' 格（第 '+loc.row+' 列第 '+loc.col+' 欄，整組第 '+loc.sticker+' 張貼圖）';
    const change=t?'把這一格裡的文字改成「'+t+'」：繁體中文、清楚易讀、不缺字不亂碼，文字不遮住角色的五官與手勢；不要在這一格出現其他文字。':'修改這一格的【請在此填入要修改的地方】。';
    return ['請只修改我附上的'+where+'：',change,'',
      '必須保留：','- 角色的臉型、五官、髮型與服裝配色','- 這一格的動作、構圖與大小','- 其他所有格子的內容與位置','- 真正透明的背景（不要畫棋盤格或白底）與原本的格子排法','',
      '請輸出修改後完整的這一張母圖（含所有格子）。不要改變其他任何細節。Do not change anything else.'].join('\n');
  }
  return {locateCell,cellFixPrompt,pickMain,counts,cell,expectedSize,ratioGap,estimateBackground,splitByContent,advise,alphaComponents,partitionArt,guessTextRegions,inpaint,textBlobs,cleanSpecks,cuts,rectangles,eraseWhite,bounds,fit,crc,png72,zip};
});
