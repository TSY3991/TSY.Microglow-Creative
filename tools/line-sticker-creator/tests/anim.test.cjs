const assert=require('node:assert/strict'),zlib=require('node:zlib'),A=require('../sticker-anim-core.js'),G=require('../sticker-guard.js');
const base=()=>{const s=A.initial();Object.assign(s.settings,{source:'original',kind:'human',style:'cute',character:'戴眼鏡的上班族'});return s;};
// 設定與張數
{const s=base();assert.equal(s.settings.items.length,8);assert.equal(A.mothers(s),2);s.settings.count=24;A.resize(s);assert.equal(s.settings.items.length,24);assert.equal(A.mothers(s),6);
 s.settings.count=10;assert.ok(A.validate(s).some(x=>x.field==='count'));}
// 預設動作與文字都不觸發內容防護；動作各有 4 個畫格
{assert.equal(A.ACTIONS.length,24);assert.equal(new Set(A.ACTIONS.map(a=>a.id)).size,24);
 for(const a of A.ACTIONS){assert.equal(a.motion.split('→').length,4,a.id);assert.deepEqual(G.checkText(a.text),[],a.id+' text');assert.deepEqual(G.checkText(a.motion),[],a.id+' motion');assert.ok(Array.from(a.text).length<=6,a.id);}}
// 驗證：缺設定、自訂動作畫格數、違規文字、播放總長
{const s=A.initial();const f=A.validate(s).map(x=>x.field);assert.ok(f.includes('source')&&f.includes('style'));
 const t=base();assert.deepEqual(A.validate(t),[]);
 t.settings.items[0]={action:'custom',motion:'站直→舉手',text:'嗨'};assert.ok(A.validate(t).some(x=>x.field==='item-0'));
 t.settings.items[0]={action:'custom',motion:'站直→舉手→揮手→放下',text:'加我LINE'};assert.ok(A.blocked(A.validate(t)));
 t.settings.items[0]=A.item(0);t.settings.delay=300;t.settings.loops=4;assert.ok(A.validate(t).some(x=>/4 秒/.test(x.message)));
 const u=base();u.settings.source='original';u.settings.style='likeness';assert.ok(A.validate(u).some(x=>x.field==='style'));}
// 提示詞：每張母圖 4 組、每組 4 個畫格、帶入動作與文字；單張母圖只含自己的貼圖；內容守則為正向寫法
{const s=base(),p=A.prompt(s);assert.ok(p.includes('動態貼圖 1（位置：左上組')&&p.includes('動態貼圖 8（位置：右下組'));
 assert.ok(p.includes('1→2→3→4→3→2')&&p.includes('4×4 共 16 格')&&p.includes('"嗨嗨"')&&p.includes('第 11、12、15、16 格'));
 const one=A.prompt(s,2);assert.ok(one.includes('動態貼圖 5（')&&one.includes('動態貼圖 8（')&&!one.includes('動態貼圖 1（')&&one.includes('與前面母圖保持一致'));
 assert.ok(!/血腥|毒品|賭博|自傷/.test(p)&&p.includes('全年齡、友善'));
 assert.ok(p.includes('真正透明')&&!A.prompt(Object.assign(base(),{}),1).includes('純白色'));
 const w=base();w.settings.background='white';w.settings.textMode='none';const pw=A.prompt(w);assert.ok(pw.includes('純白色')&&pw.includes('整組不放任何文字')&&!pw.includes('同一句文字'));
 assert.throws(()=>A.prompt(A.initial()));assert.throws(()=>A.prompt(s,3));
 const ph=base();ph.settings.source='photo';ph.settings.kind='';assert.ok(A.prompt(ph).includes('不保留照片的寫實質感'));}
// APNG：用 zlib 產生真正的 PNG，組裝後檢查結構（畫格數、播放次數、停留時間、尺寸、CRC）
{const crc=zlib.crc32;const ch=(t,d)=>{const b=Buffer.alloc(12+d.length);b.writeUInt32BE(d.length,0);b.write(t,4);d.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,8+d.length))>>>0,8+d.length);return b;};
 const png=(w,h,fn)=>{const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)raw.set(fn(x,y),y*(w*4+1)+1+x*4);const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ihdr),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));};
 const frames=A.SEQUENCE.map(k=>png(32,27,(x,y)=>[k*60,100,200,x<16+k*3?255:0])),out=A.apng(frames,150,3),i=A.inspect(out);
 assert.deepEqual([i.animated,i.frames,i.loops,i.width,i.height],[true,6,3,32,27]);assert.deepEqual(i.delays,[150,150,150,150,150,150]);
 // 每個區塊的 CRC 都正確，fcTL／fdAT 序號連續
 let p=8,seq=[];const dv=new DataView(out.buffer);while(p<out.length){const n=dv.getUint32(p),type=Buffer.from(out.subarray(p+4,p+8)).toString();const c=dv.getUint32(p+8+n);assert.equal(zlib.crc32(out.subarray(p+4,p+8+n))>>>0,c,type);
  if(type==='fcTL')seq.push(dv.getUint32(p+8));if(type==='fdAT')seq.push(dv.getUint32(p+8));p+=12+n;}
 assert.deepEqual(seq,seq.map((_,k)=>k));
 assert.throws(()=>A.apng([frames[0]],150,1));assert.throws(()=>A.apng([frames[0],png(16,16,()=>[0,0,0,0])],150,1));assert.throws(()=>A.parsePng(new Uint8Array(40)));
 assert.equal(A.inspect(frames[0]).animated,false);}
// 規格檢查
{const ok={bytes:300*1024,frames:6,loops:4,delay:150,width:320,height:270,transparent:true};assert.deepEqual(A.specIssues(ok),[]);
 const bad=A.specIssues({bytes:2e6,frames:4,loops:4,delay:300,width:400,height:200,transparent:false});assert.ok(bad.length>=5,bad.join('|'));
 assert.ok(A.specIssues({...ok,frames:21}).some(x=>/畫格數/.test(x))&&A.specIssues({...ok,loops:5}).length===1&&A.specIssues({...ok,width:200,height:200}).length===1);}
console.log('PASS animated sticker: settings, prompts, APNG assembly, spec checks');
