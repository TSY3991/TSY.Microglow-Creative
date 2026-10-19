const assert=require('node:assert/strict');global.window={};require('../sticker-brand.js');const place=window.StickerBrand.place;
const W=370,H=320,blank=()=>new Uint8ClampedArray(W*H*4);
const rect=(d,x,y,w,h,c=[200,60,60,255])=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)d.set(c,(j*W+i)*4);};
const inside=(d,p)=>{let n=0;for(let y=p.y;y<p.y+p.h;y++)for(let x=p.x;x<p.x+p.w;x++)if(d[(y*W+x)*4+3]>=128)n++;return n/(p.w*p.h);};
// 一般大圖案：整個標記都落在圖案內
let d=blank();rect(d,60,20,250,280);let p=place(d,W,H,74,16);assert.ok(p&&p.cov>=.95&&p.w===74&&p.y>=H*.55);assert.ok(inside(d,p)>=.95);
// 小圖案（原本 12px 邊界找不到）：縮小後仍放得進去
d=blank();rect(d,150,100,60,60);p=place(d,W,H,74,16);assert.ok(p&&p.cov>=.95&&p.w<74);assert.ok(inside(d,p)>=.95);
// 細長圖案：取覆蓋率最高者，仍有位置
d=blank();rect(d,180,10,8,300);p=place(d,W,H,74,16);assert.ok(p&&p.cov>0);
// 貼近邊緣的圖案
d=blank();rect(d,0,0,40,40);p=place(d,W,H,74,16);assert.ok(p&&inside(d,p)>0&&p.x>=0&&p.y>=0&&p.x+p.w<=W&&p.y+p.h<=H);
// 圖案很淡（半透明 alpha 100）不算實體；全透明回傳 null
d=blank();assert.equal(place(d,W,H,74,16),null);
// 標記永不超出畫布
for(const [x,y,w,h] of [[0,280,370,40],[330,0,40,320],[100,100,5,5]]){d=blank();rect(d,x,y,w,h);p=place(d,W,H,74,16);assert.ok(p&&p.x>=0&&p.y>=0&&p.x+p.w<=W&&p.y+p.h<=H);}
console.log('PASS brand placement: always inside figure when possible, shrinks for small art, never leaves canvas');
