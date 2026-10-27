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
  assert.equal(r.cells[2].height+r.cells[6].height,80);assert.ok(Math.abs(r.cells[2].height-40)<=3);   // 粗細一致、沒有頸部的相連圖案：從兩格中央往外長，約在中間交會
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
{
  // 兩個圖案只靠一條細頸相連，頸在分割線之外：切口應落在頸部，而不是直線切開大圖案
  const W=400,H=100,xs=C.cuts(W,4),ys=[0,100],d=new Uint8ClampedArray(W*H*4);for(let i=0;i<W*H;i++)d.set([255,255,255,255],i*4);
  const rect=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)d.set([200,30,30,255],(j*W+i)*4);};
  rect(10,20,131,60);   // 格 0 的大圖案，伸到 x=140，越過分割線 x=100
  rect(141,47,10,6);    // 細頸
  rect(151,30,40,40);   // 格 1 的小圖案
  const r=C.splitByContent(d,W,H,xs,ys,24);
  assert.deepEqual(r.merged,[0,1]);
  assert.ok(r.cells[0].width>=131&&r.cells[0].width<=140);                       // 大圖案完整留在格 0，沒被 x=100 切開（切口在頸部）
  assert.ok(r.cells[1].width<=50&&r.cells[1].x>=141);                              // 格 1 只拿到頸部之後的部分
  console.log('PASS joined art is cut at the narrow neck, following the shape');
}
{
  const W=300,H=200,d=new Uint8ClampedArray(W*H*4);
  const rect=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)d.set([200,30,30,255],(j*W+i)*4);};
  rect(60,40,100,120);        // 角色
  rect(200,30,24,130);        // 旁邊分開的文字欄：中心在角色外框外 → 視為多餘
  rect(100,10,4,4);           // 角色外框內的小碎片：太小 → 視為多餘
  rect(70,170,30,20);         // 角色外框外的另一塊：視為多餘
  const r=C.textBlobs(d,W,H);assert.equal(r.count,3);
  assert.equal(r.mask[(60*W)+210],1);assert.equal(r.mask[(60*W)+100],0);assert.equal(r.mask[(11*W)+101],1);
  // 只有一塊或都在角色外框內：不動
  const one=new Uint8ClampedArray(W*H*4);for(let y=40;y<160;y++)for(let x=60;x<160;x++)one.set([1,1,1,255],(y*W+x)*4);
  assert.equal(C.textBlobs(one,W,H).count,0);
  // 清碎片：只清孤立的小塊，不動大的
  const e=new Uint8ClampedArray(W*H*4);const box=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)e.set([9,9,9,255],(j*W+i)*4);};
  box(50,50,100,100);box(200,20,3,3);box(220,100,5,5);box(180,150,30,30);
  assert.equal(C.cleanSpecks(e,W,H),2);assert.equal(e[(21*W+201)*4+3],0);assert.equal(e[(160*W+190)*4+3],255);assert.equal(e[(100*W+100)*4+3],255);
  console.log('PASS textBlobs removes detached text/decoration; cleanSpecks removes only isolated tiny pieces');
}
{
  const W=300,H=200,d=new Uint8ClampedArray(W*H*4);
  const rect=(x,y,w,h,c)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)d.set(c,(j*W+i)*4);};
  rect(30,30,120,140,[200,160,40,255]);      // 角色（粗）
  rect(150,95,20,10,[200,160,40,255]);       // 細頸（和文字相連）
  rect(170,20,50,160,[200,30,30,255]);       // 文字欄（粗）
  rect(240,60,6,6,[90,90,90,255]);           // 另一個分開的小東西
  const parts=C.partitionArt(d,W,H,3);
  assert.ok(parts.regions.length>=3);
  const idAt=(x,y)=>parts.region[y*W+x];
  assert.notEqual(idAt(80,100),idAt(190,100));                       // 角色和文字欄分成不同塊
  assert.equal(idAt(80,100),parts.regions[0].id===idAt(80,100)?idAt(80,100):-1);
  assert.ok(Math.abs(parts.regions.find(r=>r.id===idAt(190,100)).minx-170)<=12); // 切口落在頸部附近，文字欄幾乎完整
  assert.equal(idAt(5,5),0);
  const guess=C.guessTextRegions(parts);assert.ok(guess.includes(idAt(190,100)));assert.ok(!guess.includes(idAt(80,100)));
  // 一整塊圖案不會被亂切
  const solid=new Uint8ClampedArray(W*H*4);for(let y=30;y<170;y++)for(let x=40;x<200;x++)solid.set([10,10,10,255],(y*W+x)*4);
  assert.equal(C.partitionArt(solid,W,H,6).regions.length,1);
  // 補平缺口：紅色塊中間挖一個洞，補平後不透明且接近紅色；塊外面不動
  const f=new Uint8ClampedArray(W*H*4);for(let y=50;y<150;y++)for(let x=50;x<150;x++)f.set([200,30,30,255],(y*W+x)*4);
  for(let y=90;y<100;y++)for(let x=90;x<100;x++)f[(y*W+x)*4+3]=0;
  const mask=new Uint8Array(W*H).fill(1);const filled=C.inpaint(f,W,H,mask);
  assert.equal(filled>=100,true);assert.equal(f[(95*W+95)*4+3],255);assert.ok(Math.abs(f[(95*W+95)*4]-200)<=3&&Math.abs(f[(95*W+95)*4+1]-30)<=3);
  console.log('PASS partitionArt separates text from character at the neck; inpaint fills small gaps');
}
{
  // 多格相連時，不能只因找到兩個主體就停止：較細的第三格也必須拿到自己的圖案。
  const W=400,H=100,xs=C.cuts(W,4),ys=[0,H];
  for(const joined of [false,true]){
    const d=new Uint8ClampedArray(W*H*4).fill(255);
    const rect=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)d.set([40,90,150,255],(j*W+i)*4);};
    rect(10,25,80,50);rect(110,25,80,50);rect(210,47,80,6);
    if(joined){rect(90,48,20,4);rect(190,48,20,4);}
    const original=new Uint8ClampedArray(d),r=C.splitByContent(d,W,H,xs,ys,24);
    assert.deepEqual(d,original); // 原始母圖不受影響
    for(const k of [0,1,2])assert.ok(r.cells[k],`cell ${k+1} must keep its artwork`);
    assert.equal(r.cells[3],null); // 真正沒有圖案的格子仍保持空白
    const c=r.cells[2],x=250,y=50;
    assert.ok(x>=c.x&&x<c.x+c.width&&y>=c.y&&y<c.y+c.height);
    assert.equal(c.data[((y-c.y)*c.width+x-c.x)*4+3],255);
  }
  console.log('PASS every significant cell gets a marker, including thin joined art; empty cells stay empty');
}

{ // pickMain：只在面積最大的前三分之一隨機，排除空格與有問題的格子
  const items=[{area:10,ok:true},{area:90,ok:true},null,{area:80,ok:true},{area:99,ok:false},{area:70,ok:true},{area:50,ok:true},{area:20,ok:true}];
  const seen=new Set();for(const r of [0,.2,.4,.6,.8,.999])seen.add(C.pickMain(items,()=>r));
  assert.deepEqual([...seen].sort(),[1,3]);                                    // 有效且 ok 的 6 張取前 2：面積 90（#1）、80（#3）；#4 面積最大但 ok=false 被排除
  assert.equal(C.pickMain([null,null]),0);assert.equal(C.pickMain([{area:5,ok:false},{area:9,ok:false}],()=>0),1); // 全有問題時退回全部有圖的格子
  assert.equal(C.pickMain([{area:7,ok:true}],()=>.99),0);
  console.log('PASS pickMain picks among the largest third, skips empty/clipped cells');
}

{ // 單格修正：整組貼圖序號 → 所在母圖、格號、列欄；修正提示詞要改與要保留分開，並以 Do not change anything else 收尾
  const g=[16,16,8];
  assert.deepEqual(C.locateCell(g,0),{mother:1,cell:1,row:1,col:1,sticker:1});
  assert.deepEqual(C.locateCell(g,15),{mother:1,cell:16,row:4,col:4,sticker:16});
  assert.deepEqual(C.locateCell(g,16),{mother:2,cell:1,row:1,col:1,sticker:17});
  assert.deepEqual(C.locateCell(g,39),{mother:3,cell:8,row:2,col:4,sticker:40});
  assert.equal(C.locateCell(g,40),null);
  const p=C.cellFixPrompt(C.locateCell(g,17),' 收到 ');
  assert.match(p,/母圖 2 的第 2 格（第 1 列第 2 欄，整組第 18 張貼圖）/);assert.match(p,/改成「收到」/);assert.match(p,/必須保留：/);assert.match(p,/其他所有格子的內容與位置/);assert.match(p,/Do not change anything else\.$/);
  assert.doesNotMatch(p,/【請在此填入/);
  assert.match(C.cellFixPrompt(C.locateCell(g,0),''),/【請在此填入要修改的地方】/);
  console.log('PASS cell fix prompt');
}

{ // 回歸：上下兩張貼圖在一格內相連，較薄的那張被侵蝕到只剩一小塊種子時，不可被另一張吞掉（實際母圖的輪廓縮小版，只有形狀、沒有圖案）
  const rows=["...............................................",
".................................#####.........",
"................................#########......",
"...............................###########.....",
"..............................#############....",
".............................##############....",
"...................##.......###############....",
"..........####.#######....#################....",
".......###############...##################....",
"......################..###################....",
"......################.####################....",
"......#####################################....",
"......######################################...",
".....#######################################...",
"......#######################################..",
".......######################################..",
".......######################################..",
".......######################################..",
"........#####################################..",
".......######################################..",
"......#######################################..",
"......#######################################..",
"......#######################################..",
"......######################################...",
".......#####################################...",
".......####################################....",
".......######.........####################.....",
".......................###################.....",
"......................###################......",
".................###.###################.......",
"..............##.###.##################........",
".............###.#####################.........",
"..............########################.........",
"...............########################........",
"...............########################........",
"................########################.......",
"....................####################.......",
"..........################################.....",
"........###################################....",
"................................#..######......",
"................................##########.....",
"...............................############....",
"..............................#############....",
"................#####.........#############....",
"..............#######.......################...",
"......################.....################....",
"......################....#################....",
".....#################...###################...",
".....#################..#####################..",
".....#################..#####################..",
".....#################.#######################.",
".....#################.#######################.",
".....##########################################",
".......########################################",
"......#########################################",
".....##########################################",
".....##########################################",
".....##########################################",
".....#########################################.",
"......#########################################",
"......###########..###########################.",
"......######..........########################.",
".......##..............######################..",
"...................#########################...",
".........#######.##########################....",
"......##########..########################.....",
"......##########..#######################......",
"......##########...########################....",
"......#####################################....",
"......#####################################....",
"......#####################################....",
"......################.####################....",
"......################...###################...",
"......################.....#################...",
"......##################...#################...",
".....###################..###################..",
".....###################..####################.",
".....###################.#####################.",
".....###################.......................",
"...............................................",
"..............................................."];
  const W=rows[0].length,H=rows.length,d=new Uint8ClampedArray(W*H*4);
  rows.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='#'){const i=(y*W+x)*4;d[i]=200;d[i+1]=80;d[i+2]=60;d[i+3]=255;}}));
  const res=C.splitByContent(d,W,H,[0,W],[0,41,H],24);
  assert.ok(res.merged.includes(0)&&res.merged.includes(1));
  assert.ok(res.cells[0]&&res.cells[1],'兩格都要有圖');
  assert.ok(res.cells[0].height<=50&&res.cells[1].height>=35,'上下兩張要分開：'+res.cells.map(c=>c.height).join('/'));
  console.log('PASS touching stickers with a thinner neighbour are split');
}
