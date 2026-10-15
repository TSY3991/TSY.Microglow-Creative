(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const tabs=['prompt','crop'].map(name=>({name,button:$('tab-'+name)}));
  const panels={prompt:[$('usage-guide'),$('creator')],crop:[$('sticker-crop')]};
  const wanted=()=>location.hash==='#sticker-crop'?'crop':'prompt';
  function show(name){
    for(const tab of tabs){const on=tab.name===name;tab.button.setAttribute('aria-selected',String(on));tab.button.tabIndex=on?0:-1;}
    for(const [key,list] of Object.entries(panels))for(const el of list)el.classList.toggle('tab-off',key!==name);
  }
  function choose(name,focus){
    show(name);
    try{history.replaceState(null,'',name==='crop'?'#sticker-crop':location.pathname+location.search);}catch{}
    if(focus)$('tab-'+name).focus();
  }
  tabs.forEach((tab,i)=>{
    tab.button.addEventListener('click',()=>choose(tab.name,false));
    tab.button.addEventListener('keydown',event=>{
      const next={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:tabs.length-1}[event.key];
      if(next===undefined)return;event.preventDefault();choose(tabs[(next+tabs.length)%tabs.length].name,true);
    });
  });
  // 站內連結（例如摘要頁的「前往裁切」）改 hash 時同步切換分頁，並回到分頁列。
  window.addEventListener('hashchange',()=>{show(wanted());$('tab-prompt').closest('nav').scrollIntoView({block:'start'});});
  $('crop-to-prompt').addEventListener('click',()=>{choose('prompt',false);$('tab-prompt').closest('nav').scrollIntoView({block:'start'});});
  show(wanted());
  // 右側欄（小計畫＋儲存設定）只在整欄放得進視窗時才固定；太矮時固定會讓下半截（匯出／匯入按鈕）卡在畫面外、捲不到。
  const column=document.querySelector('.preview-column');
  if(column){
    const fit=()=>column.classList.toggle('is-sticky',window.innerWidth>850&&column.offsetHeight+40<=window.innerHeight);
    window.addEventListener('resize',fit);
    if(typeof ResizeObserver==='function')new ResizeObserver(fit).observe(column);
    fit();
  }
})();
