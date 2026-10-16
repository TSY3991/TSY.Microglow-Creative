const assert=require('node:assert/strict'),C=require('../sticker-crop-core.js');
const r=C.rectangles(1491,647,C.cuts(1491,4),C.cuts(647,2));assert.equal(r.length,8);assert.equal(r.reduce((n,r)=>n+r.width*r.height,0),1491*647);assert.equal(r[4].x,0);assert.equal(r[4].y,324);assert.throws(()=>C.rectangles(20,20,[0,10,9,20],[0,20]));assert.throws(()=>C.rectangles(20,20,[0,NaN,20],[0,20]));
const data=new Uint8ClampedArray(7*7*4).fill(255);for(let y=1;y<6;y++)for(let x=1;x<6;x++)if(x===1||x===5||y===1||y===5){const i=(y*7+x)*4;data[i]=10;data[i+1]=60;data[i+2]=90;}
const out=C.eraseWhite(data,7,7);assert.equal(out[3],0);assert.equal(out[(3*7+3)*4+3],255);assert.equal(data[3],255);assert.deepEqual(C.bounds(out,7,7),{x:1,y:1,width:5,height:5});assert.equal(C.bounds(new Uint8Array(16),2,2),null);
for(const [w,h] of [[10,1000],[1000,10],[300,200]])for(const zoom of [50,100])for(const shift of [-999,999]){const f=C.fit(w,h,370,320,zoom,shift,shift);assert.ok(f.x>=10&&f.y>=10&&f.x+f.width<=360.001&&f.y+f.height<=310.001);}
assert.equal(C.crc(new TextEncoder().encode('123456789')),0xcbf43926);const z=C.zip([{name:'01.png',data:new Uint8Array([1,2,3])}]);assert.equal(new DataView(z.buffer).getUint32(0,true),0x04034b50);assert.equal(new DataView(z.buffer).getUint32(z.length-22,true),0x06054b50);assert.throws(()=>C.zip([{name:'bad.png',data:new Uint8Array(1048577)}]));
assert.throws(()=>C.rectangles(20,20,[0,10,9,20],[0,20]),/直線 2/);assert.throws(()=>C.rectangles(20,20,[0,10,20],[0,25,20]),/橫線 1/);assert.throws(()=>C.rectangles(20,20,[1,10,20],[0,20]),/首尾/);
console.log('PASS crop geometry, non-destructive white removal, bounds, safe fit, ZIP and CRC');

{
  const make=(w,h,bg=[255,255,255,255])=>{const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)d.set(bg,i*4);return d;};
  const rect=(d,w,x,y,rw,rh,c)=>{for(let j=y;j<y+rh;j++)for(let i=x;i<x+rw;i++)d.set(c,(j*w+i)*4);};
  const W=400,H=200,xs=C.cuts(W,4),ys=C.cuts(H,2),red=[200,30,30,255],blue=[30,60,200,255];
  const d=make(W,H);
  rect(d,W,10,10,50,80,red);                       // 格 0：一般
  rect(d,W,120,20,60,95,blue);                     // 格 1：多出平均線 15px，仍屬格 1
  rect(d,W,210,60,80,80,red);                      // 格 2／6：上下各半，彼此相連
  rect(d,W,310,10,80,80,[10,10,10,255]);rect(d,W,340,30,20,20,[255,255,255,255]); // 格 3：內有封閉白洞
  d[(150*W+350)*4]=0;d[(150*W+350)*4+1]=0;d[(150*W+350)*4+2]=0; // 格 7：單點雜訊
  const r=C.splitByContent(d,W,H,xs,ys,24);
  assert.ok(r);assert.equal(r.cells.length,8);
  assert.deepEqual([r.cells[0].width,r.cells[0].height],[50,80]);
  assert.deepEqual([r.cells[1].width,r.cells[1].height],[60,95]);              // 沒被分割線切掉
  assert.equal(r.cells[5],null);                                               // 溢出的部分沒有被當成另一張
  assert.deepEqual(r.merged,[2,6]);
  assert.deepEqual([r.cells[2].height,r.cells[6].height],[40,40]);             // 相連圖案只能依線切開
  const hole=r.cells[3];                                                       // 白洞中心 (350,40)
  assert.equal(hole.data[((40-hole.y)*hole.width+(350-hole.x))*4+3],255);      // 封閉白洞保留不透明
  assert.equal(r.cells[7],null);                                               // 雜訊不成為貼圖
  assert.equal(r.cells[0].data[3],255);
  // 透明背景的母圖
  const t=new Uint8ClampedArray(W*H*4);rect(t,W,10,10,50,80,red);
  const rt=C.splitByContent(t,W,H,xs,ys,24);assert.ok(rt.transparent);assert.equal(rt.cells[0].width,50);
  // 背景整張都是漸層／雜訊（連往內幾圈也不是單一顏色）就不猜
  const m=make(W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)m.set([(x*7+y*3)%256,(x*3+y*11)%256,(x*13+y*5)%256,255],(y*W+x)*4);
  assert.equal(C.splitByContent(m,W,H,xs,ys,24),null);
  // 淺灰白描邊：保守強度（12）保留，較強（40）會吃掉
  const o=make(W,H);rect(o,W,10,10,54,84,[232,232,232,255]);rect(o,W,12,12,50,80,blue);
  assert.equal(C.splitByContent(o,W,H,xs,ys,12).cells[0].width,54);
  assert.equal(C.splitByContent(o,W,H,xs,ys,40).cells[0].width,50);
  console.log('PASS smart split keeps graphics whole, flags joined stickers, keeps enclosed whites');
  // 自動建議與可能被切平的格子
  assert.ok(r.spill.includes(1));                                              // 格 1 的圖案超出平均線，硬切會切到
  assert.deepEqual(C.advise(r).mode,'smart');assert.ok(C.advise(r).cross.includes(1));
  assert.equal(C.advise(null).mode,'hard');assert.match(C.advise(null).reasons[0],/不是單一顏色/);
  const clean=make(W,H);rect(clean,W,130,30,40,50,red);rect(clean,W,10,20,50,60,blue);
  const rc=C.splitByContent(clean,W,H,xs,ys,24);assert.deepEqual(rc.spill,[]);assert.deepEqual(rc.merged,[]);assert.deepEqual(rc.clipped,[]);
  assert.deepEqual([C.advise(rc).mode,C.advise(rc).cross],['smart',[]]);          // 單色背景：智慧分割可順便去背
  const clean2=new Uint8ClampedArray(W*H*4);rect(clean2,W,130,30,40,50,red);
  const ra=C.advise(C.splitByContent(clean2,W,H,xs,ys,24));assert.equal(ra.mode,'hard');assert.match(ra.reasons[0],/透明背景/); // 已透明且乾淨：硬切即可
  // 圖案緊貼格子左邊緣、外面是背景：母圖可能已被切平
  const flat=make(W,H);rect(flat,W,100,20,50,60,red);rect(flat,W,230,30,40,40,blue);
  assert.deepEqual(C.splitByContent(flat,W,H,xs,ys,24).clipped,[1]);
  const edge=make(W,H);rect(edge,W,0,20,40,60,red);assert.deepEqual(C.splitByContent(edge,W,H,xs,ys,24).clipped,[0]); // 貼著圖片邊緣
  console.log('PASS advice: spill/clipped detection and smart-vs-hard recommendation');
}
{
  const rect=(d,w,x,y,rw,rh,c)=>{for(let j=y;j<y+rh;j++)for(let i=x;i<x+rw;i++)d.set(c,(j*w+i)*4);};
  const W=400,H=200,xs=C.cuts(W,4),ys=C.cuts(H,2),red=[200,30,30,255],white=[255,255,255,255];
  // 每格外畫了黑色框線：格內白底與圖片邊緣不相連，仍要去成透明
  const g=new Uint8ClampedArray(W*H*4);for(let i=0;i<W*H;i++)g.set(white,i*4);
  for(let r=0;r<2;r++)for(let c=0;c<4;c++){const x0=xs[c]+4,y0=ys[r]+4,w=xs[c+1]-xs[c]-8,h=ys[r+1]-ys[r]-8;rect(g,W,x0,y0,w,3,[0,0,0,255]);rect(g,W,x0,y0+h-3,w,3,[0,0,0,255]);rect(g,W,x0,y0,3,h,[0,0,0,255]);rect(g,W,x0+w-3,y0,3,h,[0,0,0,255]);rect(g,W,xs[c]+30,ys[r]+25,40,50,red);}
  const rg=C.splitByContent(g,W,H,xs,ys,24),cell=rg.cells[0];
  const at=(cx,x,y)=>cx.data[((y-cx.y)*cx.width+(x-cx.x))*4+3];
  assert.equal(at(cell,10,10),0);assert.equal(at(cell,50,50),255);                 // 框線內的白底透明、圖案保留
  assert.ok(cell.width<=W/4);
  // 灰白棋盤格當「透明」：兩種顏色都視為背景
  const k=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++)k.set(((x>>3)+(y>>3))&1?[204,204,204,255]:white,(y*W+x)*4);
  rect(k,W,30,25,40,50,red);rect(k,W,230,25,40,50,red);
  const bk=C.estimateBackground(k,W,H,24);assert.ok(bk&&bk.checker&&bk.colors.length===2);
  const rk=C.splitByContent(k,W,H,xs,ys,24);assert.ok(rk);assert.deepEqual([rk.cells[0].width,rk.cells[0].height],[40,50]);assert.deepEqual([rk.cells[2].width,rk.cells[2].height],[40,50]);
  // 漸層背景仍不猜
  const gr=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++)gr.set([x%256,(y*3)%256,(x+y)%256,255],(y*W+x)*4);
  assert.equal(C.estimateBackground(gr,W,H,24),null);
  console.log('PASS background removal: frames around cells, grey checkerboard, gradient not guessed');
}
{
  const W=400,H=200,xs=C.cuts(W,4),ys=C.cuts(H,2),d=new Uint8ClampedArray(W*H*4).fill(255);
  for(let x=0;x<W;x++)for(const y of [0,1,H-2,H-1])d.set([30,30,30,255],(y*W+x)*4);
  for(let y=0;y<H;y++)for(const x of [0,1,W-2,W-1])d.set([30,30,30,255],(y*W+x)*4);
  for(let y=25;y<75;y++)for(let x=30;x<70;x++)d.set([200,30,30,255],(y*W+x)*4);
  const bg=C.estimateBackground(d,W,H,24);assert.ok(bg&&!bg.transparent);       // 最外圈是框線，往內取樣仍找得到白底
  const r=C.splitByContent(d,W,H,xs,ys,24);assert.ok(r);
  assert.equal(r.cells[0].data[((60-r.cells[0].y)*r.cells[0].width+(50-r.cells[0].x))*4+3],255);
  console.log('PASS background estimate survives a thin frame on the outer edge');
}
{
  const W=400,H=200,xs=C.cuts(W,4),ys=C.cuts(H,2),red=[200,30,30,255];
  const d=new Uint8ClampedArray(W*H*4);for(let i=0;i<W*H;i++)d.set([255,255,255,255],i*4);
  const rect=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)d.set(red,(j*W+i)*4);};
  rect(20,30,80,40);   // 格 0：右端剛好停在分割線前（x=99）的一長段，外面是背景 → 被切平
  rect(320,30,40,40);rect(300,50,60,4);  // 格 3：只有 4 px 碰到左線 → 不算
  const r=C.splitByContent(d,W,H,xs,ys,24);assert.deepEqual(r.clipped,[0]);
  console.log('PASS clipped detection needs a long contiguous run along the cell edge');
}
