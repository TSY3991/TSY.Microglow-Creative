(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StickerContentGuard=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  // 依 LINE Creators Market 服務條款與貼圖審核準則整理的「字面可辨識」風險（2026-10-19 核對）。
  // 只做關鍵字與格式比對，無法理解語意；結果只能降低可辨識風險，不保證通過 LINE 審核。
  // BLOCKED：字面上明確違反已確認規範；REVIEW：可能涉及 LINE 裁量，需要使用者確認。
  // 宗教／民俗角色的服飾、法器與身分特徵不在檢查範圍；一般祝福、祈福與節慶用語也不列入。
  const SAFE='SAFE',REVIEW='REVIEW_REQUIRED',BLOCKED='BLOCKED';
  const rules=[
    [BLOCKED,'商業與廣告','審核準則 2.4、4.4',/https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|tw|io|me|cc|shop)\b/i,'網址','刪除網址；貼圖不能放連結。'],
    [REVIEW,'商業與廣告','審核準則 4.4',/QR ?code|QRCode|掃碼/i,'QR code 或掃碼','貼圖畫面不能放真的 QR code；文字提到掃碼請確認不是宣傳。'],
    [BLOCKED,'商業與廣告','審核準則 3.10、4.4',/(?:\+?886[- ]?|0)9\d{2}[- ]?\d{3}[- ]?\d{3}|\b0\d{1,2}[- ]\d{6,8}\b/,'電話號碼','刪除電話號碼。'],
    [BLOCKED,'商業與廣告','審核準則 3.10、4.4',/[\w.+-]+@[\w-]+\.[\w.]+/,'Email','刪除 Email。'],
    [BLOCKED,'商業與廣告','審核準則 4.1、4.4',/(?:^|[^\w@])@[A-Za-z0-9_.]{3,}|LINE ?ID|IG ?[:：]|加我(?:好友|賴|LINE)/i,'社群帳號或 ID','刪除帳號、ID 與加好友邀請。'],
    [BLOCKED,'商業與廣告','審核準則 4.4',/(?:購買|下單)連結|點(?:此|我)購買|優惠碼|折扣碼|限時優惠/,'購買或促銷訊息','改成一般日常回應，例如「謝謝支持」。'],
    [BLOCKED,'其他服務名稱','審核準則 4.3、製作準則',/YouTube|Instagram|\bIG\b|Facebook|\bFB\b|臉書|TikTok|抖音|Threads|微信|WeChat|WhatsApp|Telegram|Discord|Messenger|Twitter|推特|小紅書|Snapchat/i,'LINE 以外的社群或通訊服務名稱','改用不指名的說法，例如「影片上線」「記得追蹤」。'],
    [BLOCKED,'宗教','服務條款 12.9；審核準則 3.13、4.6',/(?:快來|歡迎|一起|趕快)(?:入教|皈依|信主|信教)|加入(?:本|我們的?)(?:教會|教團|宮|廟|寺|道場)|(?:請|快|歡迎|記得)(?:捐款|捐獻|奉獻)|捐(?:款|獻)給/,'宗教招募或捐獻勸誘','改成祝福或問候，例如「平安喜樂」「闔家平安」。'],
    [BLOCKED,'政治','審核準則 3.14、4.6',/投(?:我|給\S{0,6})一票|請?投票給|凍蒜|拜票|民進黨|國民黨|民眾黨|時代力量|親民黨|台灣基進|共產黨|政治獻金/,'選舉或政黨宣傳','刪除政治與選舉內容。'],
    [BLOCKED,'暴力與不當內容','服務條款 12.4；審核準則 3.20',/去死|自殺|輕生|割腕|跳樓/,'自殺或自傷用語','改成安慰或打氣，例如「抱抱你」。'],
    [BLOCKED,'暴力與不當內容','服務條款 12.4；審核準則 3.4、3.20',/吸毒|毒品|大麻|安非他命|K他命|搖頭丸|嗑藥/,'毒品或藥物濫用','刪除相關內容。'],
    [BLOCKED,'暴力與不當內容','服務條款 12.4；審核準則 3.3、3.16',/色情|裸照|做愛|約炮|性交/,'色情或性描寫','刪除相關內容。'],
    [BLOCKED,'暴力與不當內容','審核準則 3.17',/簽賭|下注|賭場|博弈|百家樂|老虎機/,'賭博','刪除賭博內容。'],
    [REVIEW,'宗教','審核準則 3.13',/參香|上香|進香|遶境|繞境|安太歲|求籤|擲筊|還願|法會|光明燈|點燈|添香油|拜斗|收驚|受洗|做禮拜|彌撒|誦經|唸經|念經|阿門|阿彌陀佛|南無/,'宗教儀式或活動','LINE 對強烈宗教性要素保留審核裁量；可保留，或改成祝福、平安等日常用語。'],
    [REVIEW,'宗教','審核準則 3.12',/邪教|異教徒|迷信/,'可能貶抑宗教','確認沒有攻擊或貶抑任何信仰。'],
    [REVIEW,'政治','審核準則 3.14',/總統|選舉|立委|議員|市長|公投|罷免|藍綠|政黨/,'政治相關用語','確認不是政治或選舉宣傳。'],
    [REVIEW,'暴力與不當內容','審核準則 3.4、3.5',/喝酒|啤酒|乾杯|喝醉|醉了|紅酒|威士忌|高粱|酒駕/,'飲酒','確認沒有鼓勵過量飲酒或酒駕。'],
    [REVIEW,'暴力與不當內容','審核準則 3.4',/抽菸|香菸|吸菸|電子菸|檳榔/,'菸品','確認沒有鼓勵吸菸，尤其未成年。'],
    [REVIEW,'暴力與不當內容','審核準則 3.6、3.8',/手槍|步槍|槍枝|開槍|炸彈|揍你|打死|殺了你|殺死|扁你|宰了你|砍死/,'武器或暴力用語','誇張搞笑可以，但避免寫實暴力。'],
    [REVIEW,'暴力與不當內容','審核準則 3.11、3.21、3.22',/笨蛋|白癡|白痴|智障|廢物|(?<!倒)垃圾(?!桶|車|袋)|閉嘴|去你的|幹你|靠北|靠夭|三小|機掰|雞掰|想死/,'粗話、罵人或霸凌用語','開玩笑的語氣可以，但避免針對他人或粗俗。'],
    [REVIEW,'暴力與不當內容','審核準則 3.17、3.19',/麻將|樂透|彩券|刮刮樂|柏青哥|小鋼珠|賽馬|賭/,'賭博相關','確認沒有助長賭博。'],
    [REVIEW,'其他服務名稱','製作準則（LINE 以外的網路服務名稱）',/Google|谷歌|ChatGPT|Gemini|Netflix|Spotify|Uber|Foodpanda|熊貓外送|蝦皮|Shopee|Figma|Canva|Zoom|Notion|PayPal|iPhone/i,'其他網路服務或品牌名稱','改用不指名的說法。'],
    [REVIEW,'智慧財產權','審核準則 5.1、5.2、5.4',/皮卡丘|寶可夢|Pok[eé]mon|哆啦A夢|小叮噹|Hello ?Kitty|凱蒂貓|三麗鷗|Sanrio|米老鼠|米奇|迪士尼|Disney|蠟筆小新|海綿寶寶|史努比|Snoopy|熊大|吉伊卡哇|Chiikawa|拉拉熊|瑪利歐|Mario|漫威|Marvel|鋼鐵人|蜘蛛人|吉卜力|Ghibli|宮崎駿|皮克斯|Pixar|航海王|海賊王|鬼滅|柯南/i,'既有角色或作品名稱','只能畫原創角色；若有正式授權，送審時需附授權證明。']
  ].map(([level,category,clause,re,label,suggest])=>({level,category,clause,re,label,suggest}));
  function checkText(text){
    const value=String(text||'');if(!value.trim())return [];
    const hits=[];for(const r of rules){const m=value.match(r.re);if(m)hits.push({level:r.level,category:r.category,clause:r.clause,label:r.label,suggest:r.suggest,term:m[0].replace(/^[^\w@一-鿿]+/,'')});}
    return hits;
  }
  const worst=list=>list.some(x=>x.level===BLOCKED)?BLOCKED:list.length?REVIEW:SAFE;
  // 生成前：檢查會寫進提示詞的使用者內容。不改任何文字，只回報。
  function checkBeforeGeneration(state){
    const s=state.settings,findings=[];
    const add=(where,field,text,source,extra)=>{for(const h of checkText(text))findings.push({where,field,source,...h,...extra});};
    add('角色描述','character',s.character,'user');
    add('自訂風格','customStyle',s.customStyle,'user');
    if(s.nameMode!=='none')add('人名／店名','name',s.name,'user');
    state.items.slice(0,s.count).forEach((x,i)=>{
      const where='第 '+(i+1)+' 張',source=x.presetText!==undefined&&x.presetText===x.text?'preset':'user';
      add(where+'台詞','text',x.text,source,{index:i});add(where+'表情','emotion',x.emotion,'user',{index:i});add(where+'動作','action',x.action,'user',{index:i});
    });
    if(s.nameMode==='shop'&&String(s.name||'').trim())findings.push({where:'人名／店名',field:'name',source:'user',level:REVIEW,category:'商業與廣告',clause:'審核準則 4.4；製作準則（企業商標）',label:'店名會印在貼圖上',term:s.name.trim(),suggest:'付費貼圖不能以宣傳為目的；確認不是店家廣告。'});
    if(s.font==='custom'&&String(s.customFont||'').trim()){add('自訂字型','customFont',s.customFont,'user');findings.push({where:'自訂字型',field:'customFont',source:'user',level:REVIEW,category:'智慧財產權',clause:'審核準則 5.1（素材違反第三方使用條件）',label:'指定字型需有商用授權',term:String(s.customFont).trim().slice(0,30),suggest:'確認該字型的授權允許用在販售的貼圖；授權不明就改用有明確商用授權的字型。'});}
    if(s.source==='photo')findings.push({where:'角色來源',field:'source',source:'user',level:REVIEW,category:'智慧財產權',clause:'審核準則 5.3、5.4',label:'使用照片',term:'照片',suggest:'照片中的人需同意使用肖像；公眾人物、角色或商標需附權利證明書。'});
    return {status:worst(findings),findings};
  }
  // 生成後：能自動判定的只有圖形結構；文字正確性等需要人眼逐張比對（網站不讀圖中文字）。
  function checkAfterGeneration(result){
    const st=result.stickers||[],count=result.count,miss=f=>st.map((s,i)=>f(s)?i+1:0).filter(Boolean);
    const blank=miss(s=>!s.source),opaque=miss(s=>s.source&&s.opaque),clipped=miss(s=>s.source&&s.clipped),joined=miss(s=>s.source&&s.joined);
    const item=(label,list,bad)=>({label,ok:!list.length,detail:list.length?bad+'：第 '+list.join('、')+' 張':'未發現問題'});
    const auto=[
      {label:'貼圖格數',ok:st.length===count,detail:st.length===count?count+' 張，與設定相符':'裁出 '+st.length+' 張，設定是 '+count+' 張'},
      item('空白格',blank,'全透明'),item('透明背景',opaque,'四個角落都不透明'),item('安全留白（貼邊被切）',clipped,'圖案貼著格子邊緣'),item('跨格或重疊',joined,'圖案和相鄰貼圖相連')
    ];
    const manual=['文字是正確的台灣繁體中文','沒有錯字、漏字或亂碼','沒有多出指令以外的文字','角色外觀整組一致','沒有未授權的商標或 Logo','沒有意外的政治或宗教宣傳','沒有不適當的動作或道具','內容與指令相符（可對照下方每張應印文字）'];
    const expected=(result.expected||[]).slice(0,count).map((t,i)=>({index:i,text:t||''}));
    return {status:auto.every(x=>x.ok)?SAFE:REVIEW,auto,manual,expected};
  }
  return {SAFE,REVIEW,BLOCKED,rules,checkText,checkBeforeGeneration,checkAfterGeneration};
});
