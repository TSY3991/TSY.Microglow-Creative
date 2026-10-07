// 新增模板以資料為主；正式平台連結填入 platforms[].url。
window.creativeImageTools = [
  {
    "id": "temple-celebration-poster",
    "title": "宮廟祝賀海報生成器",
    "description": "上傳神像或人物圖片，快速生成宮廟風格祝賀海報。",
    "category": "temple",
    "categoryLabel": "宮廟海報",
    "tags": [
      "海報生成",
      "圖片創作",
      "宮廟風格"
    ],
    "previewImage": null,
    "previewLabel": "宮廟海報・示意預留",
    "useCases": [
      "聖誕千秋",
      "神尊祝壽",
      "宮慶祝賀",
      "宮廟節慶圖片"
    ],
    "requiredInputs": [
      "神像或人物圖片",
      "主題名稱",
      "祝賀類型",
      "想加入的元素"
    ],
    "suggestedElements": [
      "宮廟",
      "祥雲",
      "蓮花",
      "燈籠",
      "金光",
      "花飾",
      "月亮",
      "元寶",
      "壽桃"
    ],
    "promptTemplate": "請使用我上傳的圖片作為主要主體，製作一張宮廟風格祝賀海報。\n主題：\n{主題名稱}\n祝賀類型：\n{祝賀類型}\n希望加入的元素：\n{元素}\n請保留原始人物或神像的主要辨識特徵，不要任意改變五官、神像造型、服飾、頭冠、法器或重要宗教特徵。\n整體風格：\n台灣宮廟喜慶風格、莊重、華麗、紅金色調、祥雲與金色光影。\n請讓主體成為畫面視覺中心，背景與裝飾不得搶過主體。\n若沒有另外指定文字需求，優先生成適合作為海報底圖的完整視覺。",
    "platforms": [
      {
        "id": "chatgpt",
        "label": "ChatGPT",
        "url": "https://chatgpt.com/share/6ac2f452-09c0-83e8-987e-44066ab4a502"
      },
      {
        "id": "gemini",
        "label": "Gemini",
        "url": "https://share.gemini.google/zoqKb6D81nri"
      }
    ],
    "status": "active"
  },
  {
    "id": "festival-greeting-image",
    "title": "節慶祝福圖片生成器",
    "description": "上傳主體圖片，快速套用節慶氛圍，製作祝福圖片。",
    "category": "festival",
    "categoryLabel": "節慶祝福",
    "tags": [
      "節慶圖片",
      "祝福圖片",
      "圖片創作"
    ],
    "previewImage": null,
    "previewLabel": "節慶祝福・示意預留",
    "useCases": [
      "中秋節",
      "春節",
      "元宵節",
      "端午節",
      "母親節",
      "父親節",
      "生日祝福",
      "一般節慶賀圖"
    ],
    "requiredInputs": [
      "人物 / 神像 / 主體圖片",
      "節慶名稱",
      "祝福主題",
      "想加入的元素"
    ],
    "suggestedElements": [
      "月亮",
      "燈籠",
      "煙火",
      "花卉",
      "紅包",
      "金飾",
      "吉祥裝飾",
      "節慶背景"
    ],
    "promptTemplate": "請使用我上傳的圖片作為主要主體，製作一張節慶祝福圖片。\n節慶：\n{節慶類型}\n祝福主題：\n{祝福主題}\n希望加入的元素：\n{元素}\n請盡量保持原始人物或主體的辨識度，不要任意修改重要外貌特徵。\n整體畫面需具有：\n溫暖、喜慶、精緻、有節日氛圍的視覺效果。\n請依節慶安排合適背景與裝飾，但不要讓裝飾元素搶過主要人物或主體。",
    "platforms": [
      {
        "id": "chatgpt",
        "label": "ChatGPT",
        "url": null
      },
      {
        "id": "gemini",
        "label": "Gemini",
        "url": "https://share.gemini.google/WJRBYsEbb6Pt"
      }
    ],
    "status": "active"
  },
  {
    "id": "event-announcement-visual",
    "title": "活動公告視覺生成器",
    "description": "快速生成活動公告、法會宣傳或報名使用的主視覺圖片。",
    "category": "event",
    "categoryLabel": "活動視覺",
    "tags": [
      "活動公告",
      "宣傳圖片",
      "視覺設計"
    ],
    "previewImage": null,
    "previewLabel": "活動視覺・示意預留",
    "useCases": [
      "活動宣傳",
      "法會公告",
      "課程活動",
      "報名活動",
      "社群公告",
      "宮廟活動"
    ],
    "requiredInputs": [
      "主體圖片",
      "活動名稱",
      "活動類型",
      "風格需求",
      "想加入的背景元素"
    ],
    "suggestedElements": [],
    "promptTemplate": "請使用我上傳的圖片作為主要視覺主體，製作一張活動公告主視覺圖片。\n活動名稱：\n{活動名稱}\n活動類型：\n{活動類型}\n視覺需求：\n{風格需求}\n希望加入的元素：\n{元素}\n請保留主體重點與辨識度。\n畫面需適合後續加入：\n活動名稱、日期、時間、地點與公告資訊。\n請建立清楚的視覺層級，避免背景過度複雜，並保留適當資訊區域。",
    "platforms": [
      {
        "id": "chatgpt",
        "label": "ChatGPT",
        "url": null
      },
      {
        "id": "gemini",
        "label": "Gemini",
        "url": "https://share.gemini.google/xNdaRyzYJr1m"
      }
    ],
    "status": "active"
  }
];
