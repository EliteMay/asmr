// ASMRTube appearance — canonical owner for theme, display settings and media ambience.
(function(){
  'use strict';

  const SETTINGS_KEY='asmrtube.settings.v1';
  const THEMES={
    violet:{label:'Moon Violet',themeColor:'#0b0911'},
    rose:{label:'Soft Rose',themeColor:'#10090d'},
    ocean:{label:'Deep Ocean',themeColor:'#07101a'},
    forest:{label:'Quiet Forest',themeColor:'#07110e'},
    amber:{label:'Warm Lamp',themeColor:'#120d08'},
    graphite:{label:'Graphite',themeColor:'#0a0b0d'}
  };
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

  let settings={theme:'violet',brightness:100,compact:false,showThumbs:true,reduceMotion:false,startDashboard:false};
  try{
    const stored=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
    if(stored&&typeof stored==='object')settings={...settings,...stored};
  }catch(error){
    try{window.asmrtubeDiagnostics?.record('settings.read.failure',{name:error?.name||'Error'})}catch{}
  }

  function saveSettings(){
    try{
      localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
      return true;
    }catch(error){
      try{window.asmrtubeDiagnostics?.record('settings.write.failure',{name:error?.name||'Error'})}catch{}
      if(typeof toast==='function')toast('表示設定を保存できませんでした');
      return false;
    }
  }

  function ensureDimmer(){
    let dimmer=$('#screenDimmer');
    if(dimmer)return dimmer;
    dimmer=document.createElement('div');
    dimmer.id='screenDimmer';
    dimmer.setAttribute('aria-hidden','true');
    document.body.appendChild(dimmer);
    return dimmer;
  }

  function normalize(){
    settings.theme=THEMES[settings.theme]?settings.theme:'violet';
    settings.brightness=Math.max(30,Math.min(100,Number(settings.brightness)||100));
    settings.compact=!!settings.compact;
    settings.showThumbs=settings.showThumbs!==false;
    settings.reduceMotion=!!settings.reduceMotion;
    settings.startDashboard=!!settings.startDashboard;
  }

  function syncControls(){
    $$('[data-theme-choice]').forEach(button=>{
      const active=button.dataset.themeChoice===settings.theme;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
      button.setAttribute('aria-label',`${button.querySelector('strong')?.textContent||'テーマ'}${active?'（選択中）':''}`);
    });
    const brightness=$('#appearanceBrightness');if(brightness)brightness.value=String(settings.brightness);
    const brightnessValue=$('#appearanceBrightnessValue');if(brightnessValue)brightnessValue.textContent=`${settings.brightness}%`;
    $$('[data-appearance-brightness]').forEach(button=>button.classList.toggle('active',Number(button.dataset.appearanceBrightness)===settings.brightness));
    const pairs={appearanceCompact:'compact',appearanceThumbs:'showThumbs',appearanceMotion:'reduceMotion',appearanceDashboard:'startDashboard'};
    Object.entries(pairs).forEach(([id,key])=>{const input=$(`#${id}`);if(input)input.checked=!!settings[key]});
    const currentTheme=$('#currentThemeName');if(currentTheme)currentTheme.textContent=THEMES[settings.theme].label;
  }

  function syncMediaArt(){
    let item=null;
    try{item=typeof itemById==='function'?itemById(state.selectedId):null}catch{}
    const id=/^[A-Za-z0-9_-]{11}$/.test(String(item?.videoId||''))?String(item.videoId):'';
    if(!id||!settings.showThumbs){
      document.documentElement.style.setProperty('--media-art','none');
      document.documentElement.dataset.hasMediaArt='0';
      return;
    }
    document.documentElement.style.setProperty('--media-art',`url("https://i.ytimg.com/vi/${id}/hqdefault.jpg")`);
    document.documentElement.dataset.hasMediaArt='1';
  }

  function applyAppearance({save=true,rerenderLibrary=true}={}){
    normalize();
    const previousThumbs=document.documentElement.dataset.thumbs;
    document.documentElement.dataset.theme=settings.theme;
    document.documentElement.dataset.compact=settings.compact?'1':'0';
    document.documentElement.dataset.thumbs=settings.showThumbs?'1':'0';
    document.documentElement.dataset.reduceMotion=settings.reduceMotion?'1':'0';
    document.body.dataset.theme=settings.theme;
    ensureDimmer().style.opacity=String((100-settings.brightness)/100);
    const themeMeta=$('meta[name="theme-color"]');if(themeMeta)themeMeta.setAttribute('content',THEMES[settings.theme].themeColor);
    syncControls();
    if(save)saveSettings();
    if(rerenderLibrary&&previousThumbs!==document.documentElement.dataset.thumbs&&typeof renderSongList==='function')renderSongList();
    syncMediaArt();
    document.dispatchEvent(new CustomEvent('asmrtube:appearance-change',{detail:{...settings}}));
  }

  function showSettings(event){
    event?.preventDefault?.();event?.stopPropagation?.();
    try{window.asmrtubeProductShell?.hideDashboard?.()}catch{}
    const page=$('#settingsPage');if(!page)return;
    document.body.classList.remove('mobile-sidebar-open');
    document.body.classList.add('settings-mode');
    page.hidden=false;$('#settingsPageBtn')?.classList.add('active');syncControls();window.scrollTo?.(0,0);
  }
  function hideSettings(){
    const page=$('#settingsPage');document.body.classList.remove('settings-mode');$('#settingsPageBtn')?.classList.remove('active');if(page)page.hidden=true;
    if(typeof renderSelection==='function')renderSelection();
  }

  function bindSettingsTriggers(){
    $('#settingsPageBtn')?.addEventListener('click',showSettings);
    $('#settingsBackBtn')?.addEventListener('click',hideSettings);
  }
  function bindControls(){
    $$('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>{
      if(!THEMES[button.dataset.themeChoice])return;settings.theme=button.dataset.themeChoice;applyAppearance();
    }));
    $('#appearanceBrightness')?.addEventListener('input',event=>{settings.brightness=Number(event.target.value);applyAppearance()});
    $$('[data-appearance-brightness]').forEach(button=>button.addEventListener('click',()=>{settings.brightness=Number(button.dataset.appearanceBrightness);applyAppearance()}));
    const pairs={appearanceCompact:'compact',appearanceThumbs:'showThumbs',appearanceMotion:'reduceMotion',appearanceDashboard:'startDashboard'};
    Object.entries(pairs).forEach(([id,key])=>$('#'+id)?.addEventListener('change',event=>{settings[key]=event.target.checked;applyAppearance()}));
    $('#settingsDataBtn')?.addEventListener('click',()=>{
      try{window.asmrtubeProductShell?.refreshDataDialog?.()}catch{}
      const dialog=$('#dataDialog');if(dialog?.showModal)dialog.showModal();else $('#exportBtn')?.focus();
    });
    $('#settingsHelpBtnV3')?.addEventListener('click',()=>{
      const dialog=$('#helpDialog');if(dialog?.showModal)dialog.showModal();else if(typeof toast==='function')toast('ヘルプを準備できませんでした');
    });
  }
  function bindWorkspaceExit(){
    document.addEventListener('click',event=>{
      if(!document.body.classList.contains('settings-mode'))return;
      if(event.target.closest('.song-item,.playlist-item,.channel-item,.tag-sidebar-item,.page-switch-btn,.view-btn,#dashboardBtn,#topAddBtn,#addVideoBtn'))hideSettings();
    },true);
  }

  normalize();
  applyAppearance({save:false,rerenderLibrary:false});
  bindSettingsTriggers();bindControls();bindWorkspaceExit();syncMediaArt();
  document.addEventListener('asmrtube:selection-rendered',syncMediaArt);

  window.asmrtubeAppearance={showSettings,hideSettings,applyAppearance,getSettings:()=>({...settings})};
})();
