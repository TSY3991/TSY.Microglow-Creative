(function () {
  "use strict";
  const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  let current = null;
  function build(tool, values = {}) {
    const rows = value => String(value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const printed = [];
    for (const id of ['temple','subject','headline','subtitle','solarDate','lunarDate','schedule','location','registration','deadline','notes']) printed.push(...rows(values[id]));
    const names = rows(values.subject);
    const lines = [
      '以另外上傳的主體照片提供身份參考，製作' + (values.ratio || '2:3') + '繁體中文圖片。沒有照片時先請使用者提供，不猜測主體外貌。',
      '保留可辨識的五官、姿勢、服飾、頭冠、法器與重要特徵；可去除生活背景並等比例移動主體。生成可能重繪主體與文字，成品需人工核對。',
      '自主安排構圖、文字方向、區域比例、字體、配色與裝飾。建立主標與主體焦點、清楚閱讀順序、疏密節奏、自然材質、方向光與遠近層次；不預設左右排列、牌匾、框飾或資訊卡。'
    ];
    if (tool.category === 'temple') lines.push('用途為宮廟祝賀；依照片與使用者需求建立莊嚴吉慶氣氛，裝飾種類與位置自主設計。');
    if (values.style === 'cute') lines.push('使用者選擇可愛歡慶周邊；原照主體保持原貌，僅背景與裝飾採圓潤、親切質感，不自動新增配角。');
    if (tool.category === 'festival') {
      const festivals = {midautumn:'中秋',spring:'春節',lantern:'元宵',dragonboat:'端午',birthday:'生日',mother:'母親節',father:'父親節'};
      const festival = values.festival === 'custom' ? String(values.customFestival || '').trim() : festivals[values.festival];
      lines.push(festival ? '節慶為' + festival + '，只使用符合這個節慶的場景與裝飾。未指定的專屬物件不強制加入，不混入其他節慶標語。' : '節慶尚未指定，先詢問使用者；不要自行選用中秋、滿月、玉兔或月餅。');
    }
    if (tool.category === 'event') lines.push('用途為活動公告，可為課程、社群或宮廟活動；依活動內容設計，不預設神像或宗教背景。公告段落保持輸入順序，資訊較多時減少裝飾。');
    if (names.length) lines.push('若提供多張原照，請確認照片順序與下列主體名稱對應；此身份對應說明不印在圖片上：\n' + names.map((n,i) => '第' + (i+1) + '張原照對應：' + n).join('\n'));
    if (printed.length) lines.push('唯一可印文字如下，每項一次；不印清單符號、引號、欄位名或製作說明：\n' + [...new Set(printed)].map(s => '「' + s + '」').join('\n'));
    else lines.push('這是待填寫的提示詞流程。先收集主體照片與使用者確認的文字，再生成；不自行補預設標題，不把範例或佔位符印在圖片上。');
    if (String(values.elements || '').trim()) lines.push('使用者指定裝飾：' + values.elements.trim() + '。自行安排，避免遮住五官或文字。');
    if (String(values.requirements || '').trim()) lines.push('使用者明確需求：' + values.requirements.trim());
    lines.push('選填空白直接省略，不寫「無」，不留空標籤。日期逐字照輸入，不換算、不補年份，也不重複添加國曆／農曆前綴。', '參考圖引導美感、材質與完成度，不沿用人物、宮名或日期；只有使用者明確要求原版布局時才固定構圖。輸出完整圖片，文字筆畫清楚，不添加製作說明、檔名、照片編號、水印或額外 Logo。');
    return lines.join('\n');
  }
    function markup(tool) {
    const fields = tool.builder.fields.map(field => {
      const id = "builder-" + field.id;
      const attrs = ' id="' + id + '" name="' + field.id + '"' + (field.required ? ' required' : '') + ' maxlength="' + (field.maxLength || 120) + '"';
      let control;
      if (field.type === "select") control = '<select' + attrs + '>' + field.options.map(([value,label])=>'<option value="' + escape(value) + '"' + (value === field.default ? ' selected' : '') + '>' + escape(label) + '</option>').join("") + '</select>';
      else if (field.type === "textarea") control = '<textarea' + attrs + ' rows="3" placeholder="' + escape(field.placeholder) + '">' + escape(field.default || "") + '</textarea>';
      else control = '<input type="text"' + attrs + ' placeholder="' + escape(field.placeholder) + '" value="' + escape(field.default || "") + '">';
      return '<label class="builder-field" for="' + id + '"><span>' + escape(field.label) + (field.required ? '（必填）' : '') + '</span>' + control + '</label>';
    }).join("");
    return '<p class="builder-layout">' + escape(tool.builder.summary) + '</p><p class="builder-hint">填好資訊，複製提示詞後貼到 ChatGPT／Gemini，再上傳自己的主體照片。本站不會上傳或儲存這些資料。</p><form id="template-builder" class="builder-fields">' + fields + '</form><p class="builder-hint">這裡產生的是生圖提示詞，圖片中的文字與主體細節請在生成後核對。</p>';
  }
  function values(form) { return Object.fromEntries(new FormData(form).entries()); }
  function mount(tool, container) {
    const form = container.querySelector("#template-builder");
    current = {tool,form};
    const update = () => { form.querySelectorAll('input,textarea,select').forEach(input=>input.setCustomValidity('')); container.querySelector(".prompt-details pre").textContent = build(tool, values(form)); };
    form.addEventListener("input", update); form.addEventListener("change", update);
    form.addEventListener("submit", event => event.preventDefault()); update();
  }
  function getPrompt() {
    if (!current || !current.form.reportValidity()) return null;
    const data=values(current.form);
    if(current.tool.category==='festival' && data.festival==='custom' && !String(data.customFestival||'').trim()){ const input=current.form.querySelector('#builder-customFestival');input.setCustomValidity('請填寫自訂節慶名稱');input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return null;}
    const empty=current.tool.builder.fields.find(field=>field.required&&!String(data[field.id]||"").trim());
    if(empty){const input=current.form.querySelector("#builder-"+empty.id); input.setCustomValidity("請填寫"+empty.label); input.reportValidity(); input.addEventListener("input",()=>input.setCustomValidity(""),{once:true});return null;}
    return build(current.tool,data);
  }
  window.CreativeImageBuilder = {markup,mount,getPrompt,build,template: tool => build(tool,{})};
})();
