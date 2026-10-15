(function (root) {
  "use strict";
  const common = ["好的","收到","沒問題","謝謝你","辛苦了","加油","等我一下","稍後回覆","了解","我來處理","一起努力","太好了","別擔心","慢慢來","明天見","祝你順心","平安順利","我在這裡","請多指教","感謝支持","有你真好","先休息吧","一切順利","回頭見"];
  const scenes = {
    auto: { label: "AI 自由發想", lines: [] },
    greeting: { label: "日常問候", lines: ["早安","午安","晚安","你好呀","今天好嗎","吃飯了嗎","記得喝水","路上小心","到家了嗎","好久不見","週末愉快","祝你好夢","新的一天加油","保重身體","天冷多穿一點","出門囉","我回來了","下次見","今天也要開心","好好照顧自己","一起吃飯吧","有空聊聊","祝你有美好的一天","晚點見"] },
    emotion: { label: "情緒表達", lines: ["好開心","有點難過","生氣氣","嚇我一跳","好期待","累累的","想哭","笑翻了","好害羞","有點緊張","超感動","我傻眼","好無奈","好委屈","放空中","想躺平","我懂你","需要抱抱","太驚喜了","心動了","不想動","充滿希望","好失望","幸福滿滿"] },
    work: { label: "工作回覆", lines: ["已收到","幫您確認","稍後回覆您","正在處理","已完成","請稍等","幫您追進度","資料已更新","再確認一次","麻煩您了","需要討論一下","可以安排","辛苦大家","準備開會","我來協助","持續跟進中","時間可以","已幫您備註","感謝您的協助","今天告一段落","正在整理","請您放心","等您的消息","合作愉快"] },
    friends: { label: "親友互動", lines: ["想你了","來抱抱","愛你喔","一起出去玩","你最棒","有你真好","陪你聊天","我挺你","一起吃飯","別太累了","下次一起","好想見你","分享給你","有空嗎","約起來","等你來","謝謝陪伴","永遠支持你","一起散步吧","記得休息","要開心喔","想聽你說","我們說好了","再聊一下"] },
    service: { label: "店家客服", lines: ["您好","感謝您的詢問","已收到","幫您確認","請稍候","幫您保留","可以取貨了","正在準備","已安排","感謝支持","有需要都可以問","歡迎再來","幫您查詢","稍後通知您","預約已確認","請您確認","需要什麼呢","很高興為您服務","請您放心","幫您備註","謝謝您的耐心","正在整理資料","有消息通知您","期待再見"] },
    festival: { label: "節慶祝福", lines: ["新年快樂","恭喜發財","中秋快樂","端午安康","元宵快樂","聖誕快樂","母親節快樂","父親節快樂","生日快樂","平安喜樂","闔家幸福","團圓美滿","心想事成","好運到","福氣滿滿","佳節愉快","祝福送給你","幸福每一天","新的一年加油","歲歲平安","健康快樂","日日順心","笑口常開","祝你美夢成真"] },
    taiwan: { label: "台灣口頭禪", lines: ["水啦","讚啦","歹勢啦","沒問題啦","揪一下","真的假的","笑死","先不要","有夠讚","等等我啦","我可以","太扯了吧","哇哩咧","真的假的啦","拍謝拍謝","辛苦啦","加油啦","甘溫","歡喜就好","好啦好啦","安捏可以","毋通喔","有影無","緊來啦"] }
  };
  const options = {
    source: [["","請選擇角色來源"],["original","原創角色"],["photo","照片／圖片參考（人物、動物、物件）"]],
    kind: [["","請選擇角色類型"],["human","人物"],["animal","動物"],["object","擬人化物件"]],
    style: [["","請選擇風格"],["likeness","似顏繪・保留本人辨識度"],["cute","可愛 Q 版"],["line","簡約線條"],["healing","療癒手繪"],["comic","誇張搞怪"],["custom","自行描述"]],
    mode: [["ai","台詞由 AI 發揮"],["preset","使用預設情境台詞"],["manual","全部自行輸入"]],
    textMode: [["all","整組有文字"],["none","整組無文字"],["per","逐張決定"]],
    nameMode: [["none","不加入共用名稱"],["person","加入人名"],["shop","加入店名"]],
    font: [["auto","AI 配合整體風格"],["round","粗體圓體"],["hand","手寫字"],["comic","漫畫字"],["bubble","可愛泡泡字"],["black","正式黑體"],["custom","自行描述"]],
    size: [["auto","AI 依台詞長度調整"],["small","小"],["medium","中"],["large","大"]],
    position: [["auto","AI 依動作安排"],["top","上方"],["bottom","下方"],["left","左側"],["right","右側"]],
    stroke: [["auto","AI 調整"],["none","關閉描邊"],["thin","細"],["medium","中"],["thick","粗"]],
    shadow: [["auto","AI 調整"],["none","關閉陰影"],["weak","弱"],["medium","中"],["strong","強"]],
    textColor: [["auto","AI 配合整體風格"],["multi","多色搭配"],["black","黑"],["white","白"],["red","紅"],["orange","橘"],["yellow","黃"],["green","綠"],["blue","藍"],["purple","紫"],["pink","粉紅"],["custom","自訂顏色"]],
    layoutMode: [["auto","自動分配（建議）：16 格優先，剩餘用 8 格"],["manual","自行調整：自己決定每張母圖放 8 或 16 格"]],
    background: [["transparent","要求 AI 生成透明背景"],["white","純白背景"],["color","自選單一底色"]],
    dimension: [["2d","2D 平面（預設）：像手繪／插畫的平面貼圖"],["semi","半 3D（Semi-3D）：2D 造型加柔和立體光影，有體積感但不是寫實 3D"],["3d","3D 立體：像公仔、黏土或 3D 動畫角色，有體積與光影"]],
    spacing: [["standard","標準：481×416 px（四周多留 15%）"],["wide","加寬：592×512 px（四周多留 30%，預設）"],["widest","最寬：703×608 px（四周多留 45%，偵測到被切到時自動使用）"]],
    platform: [["chatgpt","ChatGPT"],["gemini","Gemini"],["generic","通用版本"]]
  };
  options.strokeColor = options.textColor.filter(x => x[0] !== "multi");
  options.shadowColor = options.strokeColor;
  const defaults = {
    source:"",kind:"",dimension:"2d",character:"",style:"",customStyle:"",
    mode:"ai",scene:"auto",textMode:"all",count:16,
    nameMode:"none",name:"",font:"auto",customFont:"",size:"auto",
    textColor:"auto",textCustom:"#082528",position:"auto",
    stroke:"auto",strokeColor:"auto",strokeCustom:"#ffffff",
    shadow:"auto",shadowColor:"auto",shadowCustom:"#727978",
    layoutMode:"auto",spacing:"wide",background:"transparent",backgroundColor:"#ffffff",
    platform:"chatgpt"
  };
  const api = { scenes, common, options, defaults, counts:[8,16,24,32,40], tool:"microglow-line-sticker-creator", version:1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StickerData = api;
})(typeof window !== "undefined" ? window : globalThis);
