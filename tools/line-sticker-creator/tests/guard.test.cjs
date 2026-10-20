const assert=require('node:assert/strict'),G=require('../sticker-guard.js'),C=require('../sticker-core.js'),D=require('../sticker-data.js'),AI=require('../sticker-ai.js');
const level=t=>{const h=G.checkText(t);return h.some(x=>x.level===G.BLOCKED)?G.BLOCKED:h.length?G.REVIEW:G.SAFE;};
// 應擋：每一類至少一例
for(const t of ['看這裡 https://a.com','打給我 0912-345-678','寄到 a@b.co','追蹤 @my_shop','加我LINE','點此購買','記得訂閱 YouTube','IG見','快來入教','請捐款給本宮','投我一票','凍蒜','去死吧','吸毒','色情','簽賭'])assert.equal(level(t),G.BLOCKED,t);
// 應提醒
for(const t of ['掃碼加入','一起參香','跟著遶境','安太歲','邪教','總統好','乾杯','抽菸','揍你喔','笨蛋','打麻將','Google 一下','畫一隻皮卡丘','想死你了'])assert.equal(level(t),G.REVIEW,t);
// 不誤擋：一般祝福、民俗節慶、工作用語、台語再見
for(const t of ['回滾吧','恭喜發財','客戶殺價了','拜拜囉','感謝神明保佑','神明保佑','媽祖保佑','闔家平安','平安喜樂','新年快樂','中秋快樂','倒垃圾','笑死','累死了','AI 幫大忙','早安','穿著神明袍、手持法器的Q版角色','下單請放心','謝謝支持'])assert.equal(level(t),G.SAFE,t);
// 預設句庫與常用語：沒有任何一句被擋（宮廟等民俗用語最多只提醒）
const all=[...D.common,...Object.values(D.scenes).flatMap(x=>x.lines)];
const blocked=all.filter(t=>level(t)===G.BLOCKED);assert.deepEqual(blocked,[]);
// 生成前檢查：只回報，不改任何文字
const state=C.initial();state.settings.source='original';state.settings.kind=state.settings.kind||'person';state.settings.style=state.settings.style||'cute';
state.settings.count=8;state.grids=[8];state.items=Array.from({length:8},()=>C.item(''));
state.items[0].text='加我LINE';state.items[1].text='一起參香';state.items[2].action='穿著廟宇法袍揮手';
const before=JSON.stringify(state),r=G.checkBeforeGeneration(state);
assert.equal(JSON.stringify(state),before);
assert.equal(r.status,G.BLOCKED);assert.ok(r.findings.some(f=>f.index===0&&f.level===G.BLOCKED&&f.clause.includes('4.')));
assert.ok(r.findings.some(f=>f.index===1&&f.level===G.REVIEW));assert.ok(!r.findings.some(f=>f.index===2));
state.items[0].text='收到';assert.equal(G.checkBeforeGeneration(state).status,G.REVIEW);
state.items[1].text='好的';assert.equal(G.checkBeforeGeneration(state).status,G.SAFE);
state.settings.nameMode='shop';state.settings.name='小明麵店';assert.equal(G.checkBeforeGeneration(state).status,G.REVIEW);
// 自訂字型：只提醒授權，不擋
{const s3=C.initial();Object.assign(s3.settings,state.settings);s3.grids=[8];s3.items=Array.from({length:8},()=>C.item(''));
 const none=G.checkBeforeGeneration(s3);assert.ok(!none.findings.some(f=>f.field==='customFont'));
 s3.settings.font='custom';s3.settings.customFont='某某商用黑體';const f3=G.checkBeforeGeneration(s3);
 assert.equal(f3.status,G.REVIEW);assert.ok(f3.findings.some(f=>f.field==='customFont'&&f.clause.includes('5.1')));
 s3.settings.font='round';assert.ok(!G.checkBeforeGeneration(s3).findings.some(f=>f.field==='customFont'));}
// 網站 AI 補內容：有風險的建議不套用（保持空白），其餘照常
state.settings.nameMode='none';state.settings.name='';
const s2=C.initial();Object.assign(s2.settings,state.settings);s2.grids=[8];s2.items=Array.from({length:8},()=>C.item(''));s2.items[0].text='我自己寫的';
const rows=Array.from({length:8},(_,i)=>({id:i+1,text:i===1?'上YouTube':i===2?'一起參香':'早安',emotion:'微笑',action:'揮手'}));
const res=AI.applyDetailed(s2,rows);
assert.equal(s2.items[0].text,'我自己寫的');assert.equal(s2.items[1].text,'');assert.equal(s2.items[2].text,'');assert.equal(s2.items[3].text,'早安');
assert.deepEqual(res.skipped.map(x=>x.index+':'+x.key).sort(),['1:text','2:text']);
// 生成後 QA
const qa=G.checkAfterGeneration({count:3,stickers:[{source:1},{source:null},{source:1,opaque:true,clipped:true}],expected:['早安','','收到']});
assert.equal(qa.status,G.REVIEW);assert.equal(qa.auto[1].detail,'全透明：第 2 張');assert.ok(qa.auto[2].detail.includes('第 3 張'));assert.ok(qa.auto[3].detail.includes('第 3 張'));
assert.equal(qa.manual.length,8);assert.equal(qa.expected[2].text,'收到');
assert.equal(G.checkAfterGeneration({count:1,stickers:[{source:1}],expected:[]}).status,G.SAFE);
console.log('PASS content guard: blocks clear violations, reviews discretion items, keeps blessings/folk culture, never edits user text, skips risky AI suggestions');
{ // 656 句職業／主題預設台詞：不得觸發任何內容防護（含需確認項目）、每個情境 16 句且不重複、不超過 14 字；情境詞彙同樣乾淨
  const jobs=Object.entries(D.scenes).filter(([,v])=>v.job);assert.equal(jobs.length,41);let total=0;
  for(const [k,v] of jobs){assert.equal(v.lines.length,16,k);assert.equal(new Set(v.lines).size,16,k);total+=v.lines.length;
    for(const t of v.lines){assert.deepEqual(G.checkText(t),[],k+'｜'+t);assert.ok(Array.from(t).length<=14,k+'｜'+t);}
    assert.deepEqual(G.checkText(v.terms||''),[],k+' terms');}
  assert.equal(total,656);
  console.log('PASS 656 job lines: no guard hits, unique, short');
}
