// 工具資料；所有提示詞由 CreativeImageBuilder 建構，避免雙份來源。
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
    "previewImage": "../../assets/creative-previews/temple-celebration-poster-neon-v1.jpg?v=20261013a",
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
    "platforms": [
      {
        "id": "chatgpt",
        "label": "ChatGPT",
        "url": "https://chatgpt.com/share/6ac2f452-09c0-83e8-987e-44066ab4a502"
      },
      {
        "id": "gemini",
        "label": "Gemini",
        "url": "https://share.gemini.google/duSb6BGQAGN9"
      }
    ],
    "status": "active",
    "builder": {
      "layout": "celebration",
      "summary": "依內容與參考圖自由設計，不固定文字方向、主體位置或資訊區比例。",
      "fields": [
        {
          "id": "temple",
          "label": "宮廟名稱",
          "required": true,
          "placeholder": "例如：微光宮"
        },
        {
          "id": "subject",
          "label": "神尊／主體名稱",
          "required": true,
          "placeholder": "例如：福德正神；多位神尊請分行填寫",
          "type": "textarea",
          "maxLength": 200
        },
        {
          "id": "ratio",
          "label": "圖片比例",
          "required": false,
          "placeholder": "",
          "type": "select",
          "options": [
            [
              "2:3",
              "2:3 直式海報"
            ],
            [
              "3:4",
              "3:4 直式圖片"
            ],
            [
              "1:1",
              "1:1 方形圖片"
            ]
          ],
          "default": "2:3"
        },
        {
          "id": "style",
          "label": "主體呈現",
          "required": false,
          "placeholder": "",
          "type": "select",
          "options": [
            [
              "solemn",
              "莊嚴吉慶氛圍"
            ],
            [
              "cute",
              "可愛歡慶周邊（主體保持原貌）"
            ]
          ],
          "default": "solemn"
        },
        {
          "id": "headline",
          "label": "主要祝賀文字",
          "required": true,
          "placeholder": "例如：聖誕千秋"
        },
        {
          "id": "subtitle",
          "label": "副標／祝福語",
          "required": false,
          "placeholder": "例如：生日快樂"
        },
        {
          "id": "solarDate",
          "label": "國曆日期",
          "required": false,
          "placeholder": "例如：10月18日"
        },
        {
          "id": "lunarDate",
          "label": "農曆日期",
          "required": false,
          "placeholder": "例如：9月9日"
        },
        {
          "id": "requirements",
          "label": "其他創作需求",
          "required": false,
          "type": "textarea",
          "maxLength": 400,
          "placeholder": "可指定美術方向；只有明確指定時才固定構圖。"
        }
      ]
    }
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
    "previewImage": "../../assets/creative-previews/festival-greeting-image-neon-v1.jpg?v=20261013a",
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
    "platforms": [
      {
        "id": "chatgpt",
        "label": "ChatGPT",
        "url": null
      },
      {
        "id": "gemini",
        "label": "Gemini",
        "url": "https://share.gemini.google/ezZp2TZnrPie"
      }
    ],
    "status": "active",
    "builder": {
      "layout": "festival",
      "summary": "依內容與參考圖自由設計，不固定文字方向、主體位置或資訊區比例。",
      "fields": [
        {
          "id": "temple",
          "label": "宮廟名稱",
          "required": true,
          "placeholder": "例如：微光宮"
        },
        {
          "id": "subject",
          "label": "神尊／主體名稱",
          "required": true,
          "placeholder": "例如：福德正神；多位神尊請分行填寫",
          "type": "textarea",
          "maxLength": 200
        },
        {
          "id": "festival",
          "label": "節慶",
          "required": true,
          "type": "select",
          "placeholder": "",
          "options": [
            [
              "midautumn",
              "中秋"
            ],
            [
              "spring",
              "春節"
            ],
            [
              "lantern",
              "元宵"
            ],
            [
              "dragonboat",
              "端午"
            ],
            [
              "birthday",
              "生日"
            ],
            [
              "mother",
              "母親節"
            ],
            [
              "father",
              "父親節"
            ],
            [
              "custom",
              "自訂"
            ]
          ],
          "default": "midautumn"
        },
        {
          "id": "customFestival",
          "label": "自訂節慶名稱（選自訂時必填）",
          "required": false,
          "placeholder": "請填寫實際節慶名稱"
        },
        {
          "id": "ratio",
          "label": "圖片比例",
          "required": false,
          "placeholder": "",
          "type": "select",
          "options": [
            [
              "2:3",
              "2:3 直式海報"
            ],
            [
              "3:4",
              "3:4 直式圖片"
            ],
            [
              "1:1",
              "1:1 方形圖片"
            ]
          ],
          "default": "2:3"
        },
        {
          "id": "headline",
          "label": "主要祝福文字",
          "required": true,
          "placeholder": "例如：中秋佳節快樂"
        },
        {
          "id": "subtitle",
          "label": "右側短祝福語",
          "required": false,
          "placeholder": "例如：月圓人團圓，福氣滿人間"
        },
        {
          "id": "elements",
          "label": "其他裝飾（選填）",
          "required": false,
          "placeholder": "例如：月餅、玉兔"
        },
        {
          "id": "requirements",
          "label": "其他創作需求",
          "required": false,
          "type": "textarea",
          "maxLength": 400,
          "placeholder": "可指定美術方向；只有明確指定時才固定構圖。"
        }
      ]
    }
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
    "previewImage": "../../assets/creative-previews/event-announcement-visual-neon-v1.jpg?v=20261013a",
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
    "platforms": [
      {
        "id": "chatgpt",
        "label": "ChatGPT",
        "url": null
      },
      {
        "id": "gemini",
        "label": "Gemini",
        "url": "https://share.gemini.google/hjh6WDtHzCSB"
      }
    ],
    "status": "active",
    "builder": {
      "layout": "announcement",
      "summary": "依內容與參考圖自由設計，不固定文字方向、主體位置或資訊區比例。",
      "fields": [
        {
          "id": "temple",
          "label": "主辦單位",
          "required": true,
          "placeholder": "例如：微光學習中心"
        },
        {
          "id": "subject",
          "label": "主體名稱",
          "required": true,
          "placeholder": "例如：活動人物或吉祥物；多位請分行填寫",
          "type": "textarea",
          "maxLength": 200
        },
        {
          "id": "ratio",
          "label": "圖片比例",
          "required": false,
          "placeholder": "",
          "type": "select",
          "options": [
            [
              "2:3",
              "2:3 直式海報"
            ],
            [
              "3:4",
              "3:4 直式圖片"
            ],
            [
              "1:1",
              "1:1 方形圖片"
            ]
          ],
          "default": "2:3"
        },
        {
          "id": "headline",
          "label": "活動名稱",
          "required": true,
          "placeholder": "例如：濟世日"
        },
        {
          "id": "schedule",
          "label": "活動日期與時間",
          "required": true,
          "placeholder": "例如：115年10月17日 晚上六點",
          "type": "textarea",
          "maxLength": 200
        },
        {
          "id": "location",
          "label": "活動地點",
          "required": false,
          "placeholder": "選填"
        },
        {
          "id": "registration",
          "label": "報名方式",
          "required": false,
          "placeholder": "選填"
        },
        {
          "id": "deadline",
          "label": "預約截止資訊",
          "required": false,
          "placeholder": "例如：10月16日晚上截止"
        },
        {
          "id": "notes",
          "label": "公告資訊（每段一行）",
          "required": false,
          "placeholder": "例如：歡迎線上預約\n當天報名依序安排\n代問請準備本人衣物、地址與農曆生日",
          "type": "textarea",
          "maxLength": 800
        },
        {
          "id": "subtitle",
          "label": "祝福語／結語（選填）",
          "required": false,
          "placeholder": "例如：與您有緣，願有善緣"
        },
        {
          "id": "requirements",
          "label": "其他創作需求",
          "required": false,
          "type": "textarea",
          "maxLength": 400,
          "placeholder": "可指定美術方向；只有明確指定時才固定構圖。"
        }
      ]
    }
  }
];
