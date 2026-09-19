// ASMRTube library tools — resume playback, favorite sections, creator library and timestamp editor.
(function(){
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s　]+/g,' ').trim();
  const makeId=()=>typeof uid==='function'?uid():(crypto.randomUUID?.()||`${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
  const getItem=()=>typeof itemById==='function'?itemById(state.selectedId):null;
  const fmtTime=value=>typeof fmt==='function'?fmt(value):String(value??0);
  let lastResumeSaveAt=0;
  let editorRows=[];

  function currentPosition(){try{return Number(state.player?.getCurrentTime?.()||0)}catch{return 0}}
  function currentDuration(){try{return Number(state.player?.getDuration?.()||0)}catch{return 0}}
  function parseEditorTime(value){
    if(typeof parseTime==='function'){const parsed=parseTime(String(value||'').trim());if(parsed!=null)return parsed}
    const parts=String(value||'').trim().split(':').map(Number);
    if(parts.some(Number.isNaN))return null;
    if(parts.length===2&&parts[1]<60)return parts[0]*60+parts[1];
    if(parts.length===3&&parts[1]<60&&parts[2]<60)return parts[0]*3600+parts[1]*60+parts[2];
    return null;
  }

  // ----------------------------------------------------------------------
  // Resume playback
  // ----------------------------------------------------------------------
  function updateResumeCard(item){
    const card=$('#infoCard .resume-card');if(!card)return;
    const resume=Number(item?.resumeAt||0),duration=Number(item?.resumeDuration||0);
    if(resume<=8){card.remove();return}
    const strong=$('strong',card);if(strong)strong.textContent=`${fmtTime(resume)}${duration?` / ${fmtTime(duration)}`:''}`;
  }
  function persistResume(force=false){
    const id=state.currentId;if(!id||!state.player)return;
    const item=itemById(id);if(!item)return;
    let playerState=null;try{playerState=Number(state.player.getPlayerState?.())}catch{}
    if(![0,1,2].includes(playerState))return;
    const now=Date.now();if(!force&&now-lastResumeSaveAt<5000)return;
    const time=currentPosition(),duration=currentDuration();
    if(!Number.isFinite(time)||time<0||!Number.isFinite(duration)||duration<=0)return;
    lastResumeSaveAt=now;

    const previous={resumeAt:item.resumeAt,resumeDuration:item.resumeDuration,resumeUpdatedAt:item.resumeUpdatedAt};
    if(playerState===0||duration-time<15||time/duration>=.975){
      if(item.resumeAt==null)return;
      delete item.resumeAt;delete item.resumeDuration;delete item.resumeUpdatedAt;
      if(!save()){Object.assign(item,previous);return}
      updateResumeCard(item);return;
    }
    if(time<8||(!force&&Math.abs(Number(item.resumeAt||0)-time)<3))return;
    item.resumeAt=Math.floor(time);item.resumeDuration=Math.floor(duration);item.resumeUpdatedAt=now;
    if(!save()){Object.assign(item,previous);return}
    updateResumeCard(item);
  }
  const resumeTimer=setInterval(()=>persistResume(false),5000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistResume(true)});
  window.addEventListener('pagehide',()=>{persistResume(true);clearInterval(resumeTimer)},{once:true});

  // ----------------------------------------------------------------------
  // Favorite sections
  // ----------------------------------------------------------------------
  function sectionsOf(item){
    if(!Array.isArray(item?.favoriteSections))return [];
    return item.favoriteSections
      .filter(x=>x&&Number.isFinite(Number(x.start))&&Number.isFinite(Number(x.end))&&Number(x.end)>Number(x.start))
      .map(x=>{const start=Number(x.start),end=Number(x.end),label=String(x.label||'お気に入り区間').trim()||'お気に入り区間';return {...x,id:String(x.id||`legacy-${start}-${end}-${label.slice(0,12)}`),label,start,end}})
      .sort((a,b)=>a.start-b.start);
  }
  function setLoopUi(start,end){
    state.loopA=Number(start);state.loopB=Number(end);
    const loop=$('#loopBtn'),status=$('#loopStatus');
    if(loop){loop.textContent='A-B ON';loop.classList.add('active');loop.setAttribute('aria-pressed','true')}
    if(status){status.textContent=`${fmtTime(start)} 〜 ${fmtTime(end)}`;status.classList.add('active')}
  }
  function playSection(item,section){
    setLoopUi(section.start,section.end);playItem(item.id,section.start);toast(`「${section.label}」を区間リピートします`);
  }
  function createSectionDialog(){
    if($('#favoriteSectionDialog'))return;
    const dialog=document.createElement('dialog');dialog.id='favoriteSectionDialog';dialog.className='dialog v22-dialog';
    dialog.innerHTML=`<form method="dialog" id="favoriteSectionForm"><div class="dialog-head"><div><div class="eyebrow">FAVORITE SECTION</div><h3>お気に入り区間を保存</h3></div><button value="cancel" class="icon-btn subtle">×</button></div><div class="v22-section-form"><label>名前<input id="favoriteSectionLabel" maxlength="80" placeholder="例: 一番好きな耳ふー"></label><div class="two-col"><label>開始<input id="favoriteSectionStart" placeholder="12:34"></label><label>終了<input id="favoriteSectionEnd" placeholder="14:20"></label></div><div class="v22-dialog-hint">A-B区間が設定されていればその範囲を使います。未設定なら現在位置から30秒を仮入力します。</div></div><div class="dialog-actions"><button value="cancel" class="ghost-btn">キャンセル</button><button type="submit" class="primary-btn">保存</button></div></form>`;
    document.body.appendChild(dialog);
    $('#favoriteSectionForm').addEventListener('submit',event=>{
      event.preventDefault();const item=getItem();if(!item)return;
      const start=parseEditorTime($('#favoriteSectionStart').value),end=parseEditorTime($('#favoriteSectionEnd').value);
      if(start==null||end==null||end<=start)return toast('開始・終了時間を確認してください');
      const duration=currentDuration();if(duration&&end>duration+1)return toast('終了時間が動画時間を超えています');
      const label=$('#favoriteSectionLabel').value.trim()||`${fmtTime(start)} 〜 ${fmtTime(end)}`;
      const previous=item.favoriteSections;
      item.favoriteSections=[...sectionsOf(item),{id:makeId(),label,start,end,createdAt:Date.now()}].sort((a,b)=>a.start-b.start);
      if(!save()){item.favoriteSections=previous;return}
      dialog.close();enhanceInfoCard(true);toast('お気に入り区間を保存しました');
    });
  }
  function openSectionDialog(){
    const item=getItem();if(!item)return;createSectionDialog();
    const duration=currentDuration();let start=Number(state.loopA),end=Number(state.loopB);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start){start=currentPosition();end=duration?Math.min(duration,start+30):start+30}
    $('#favoriteSectionLabel').value='';$('#favoriteSectionStart').value=fmtTime(start);$('#favoriteSectionEnd').value=fmtTime(end);
    $('#favoriteSectionDialog').showModal();setTimeout(()=>$('#favoriteSectionLabel')?.focus(),0);
  }

  // ----------------------------------------------------------------------
  // Creator library
  // ----------------------------------------------------------------------
  function createCreatorDialog(){
    if($('#creatorDialog'))return;
    const dialog=document.createElement('dialog');dialog.id='creatorDialog';dialog.className='dialog v22-dialog v22-creator-dialog';
    dialog.innerHTML=`<form method="dialog"><div class="dialog-head"><div><div class="eyebrow">CREATOR LIBRARY</div><h3 id="creatorDialogTitle">配信者</h3><p class="muted small" id="creatorDialogMeta"></p></div><button value="cancel" class="icon-btn subtle">×</button></div><div id="creatorDialogBody"></div><div class="dialog-actions"><button value="cancel" class="primary-btn">閉じる</button></div></form>`;
    document.body.appendChild(dialog);
  }
  function showCreatorPage(creator){
    const name=String(creator||'').trim();if(!name)return toast('配信者が設定されていません');
    createCreatorDialog();
    const key=normalize(name),items=state.library.filter(x=>normalize(x.creator)===key).sort((a,b)=>(b.rating||0)-(a.rating||0)||(b.createdAt||0)-(a.createdAt||0));
    const fav=items.filter(x=>x.favorite).length,sleep=items.filter(x=>x.sleepFriendly||x.tags?.includes('睡眠')).length,timestamps=items.reduce((n,x)=>n+(x.timestamps?.length||0),0);
    const tagMap=new Map();items.forEach(x=>(x.tags||[]).forEach(tag=>tagMap.set(tag,(tagMap.get(tag)||0)+1)));
    const tags=[...tagMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
    const showThumbs=document.documentElement.dataset.thumbs!=='0';
    $('#creatorDialogTitle').textContent=name;$('#creatorDialogMeta').textContent=`${items.length}作品 ・ お気に入り${fav} ・ 睡眠向け${sleep} ・ タイムスタンプ${timestamps}`;
    $('#creatorDialogBody').innerHTML=`<div class="creator-summary"><div><strong>${items.length}</strong><span>登録作品</span></div><div><strong>${fav}</strong><span>お気に入り</span></div><div><strong>${timestamps}</strong><span>タイムスタンプ</span></div></div>${tags.length?`<div class="creator-tags">${tags.map(([tag,count])=>`<span>${safe(tag)} <b>${count}</b></span>`).join('')}</div>`:''}<div class="creator-work-grid">${items.map(item=>`<button type="button" class="creator-work" data-creator-item="${safe(item.id)}"><span class="creator-work-thumb">${showThumbs?`<img src="https://i.ytimg.com/vi/${safe(item.videoId||'')}/mqdefault.jpg" alt="" width="160" height="100" loading="lazy" decoding="async">`:''}</span><span class="creator-work-copy"><strong>${safe(item.title||'無題')}</strong><span>${ratingLabel(item.rating)}${item.favorite?' ・ ★':''}${item.resumeAt?` ・ 続き ${fmtTime(item.resumeAt)}`:''}</span></span></button>`).join('')}</div>`;
    const dialog=$('#creatorDialog');
    $$('[data-creator-item]',$('#creatorDialogBody')).forEach(button=>button.onclick=()=>{dialog.close();window.asmrtubeProductShell?.hideDashboard?.();selectItem(button.dataset.creatorItem)});
    dialog.showModal();
  }

  // ----------------------------------------------------------------------
  // Selected-item panel
  // ----------------------------------------------------------------------
  function featureSignature(item){return JSON.stringify([Number(item.resumeAt||0),Number(item.resumeDuration||0),sectionsOf(item).map(x=>[x.id,x.label,x.start,x.end])])}
  function enhanceInfoCard(force=false){
    const info=$('#infoCard'),item=getItem();if(!info||!item||!info.querySelector('.info-actions'))return;
    const sig=featureSignature(item),old=info.querySelector('.v22-library-tools');
    if(old&&!force&&old.dataset.signature===sig)return;if(old)old.remove();
    const sections=sectionsOf(item),resume=Number(item.resumeAt||0),resumeDuration=Number(item.resumeDuration||0);
    const wrapper=document.createElement('div');wrapper.className='v22-library-tools';wrapper.dataset.signature=sig;
    wrapper.innerHTML=`${resume>8?`<div class="resume-card"><div><span>前回の続き</span><strong>${fmtTime(resume)}${resumeDuration?` / ${fmtTime(resumeDuration)}`:''}</strong></div><button type="button" class="primary-soft" id="resumePlayBtn">▶ 続きから</button></div>`:''}<div class="v22-tool-row"><button type="button" class="ghost-btn" id="creatorPageBtn">配信者ページ</button><button type="button" class="ghost-btn" id="saveFavoriteSectionBtn">＋ お気に入り区間</button></div><div class="favorite-sections"><div class="favorite-sections-head"><strong>お気に入り区間</strong><span>${sections.length}件</span></div>${sections.length?`<div class="favorite-section-list">${sections.map(section=>`<div class="favorite-section-item"><button type="button" class="favorite-section-play" data-section-play="${safe(section.id)}"><span>${safe(section.label)}</span><small>${fmtTime(section.start)} 〜 ${fmtTime(section.end)}</small></button><button type="button" class="favorite-section-delete" data-section-delete="${safe(section.id)}" title="削除">×</button></div>`).join('')}</div>`:'<div class="favorite-section-empty">A-B区間や好きな場面を名前付きで保存できます。</div>'}</div>`;
    info.querySelector('.info-actions').insertAdjacentElement('beforebegin',wrapper);
    $('#resumePlayBtn',wrapper)?.addEventListener('click',()=>playItem(item.id,resume));
    $('#creatorPageBtn',wrapper)?.addEventListener('click',()=>showCreatorPage(item.creator));
    $('#saveFavoriteSectionBtn',wrapper)?.addEventListener('click',openSectionDialog);
    $$('[data-section-play]',wrapper).forEach(button=>button.onclick=()=>{const section=sections.find(x=>x.id===button.dataset.sectionPlay);if(section)playSection(item,section)});
    $$('[data-section-delete]',wrapper).forEach(button=>button.onclick=()=>{
      const section=sections.find(x=>x.id===button.dataset.sectionDelete);if(!section||!confirm(`「${section.label}」を削除しますか？`))return;
      const previous=item.favoriteSections;item.favoriteSections=sections.filter(x=>x.id!==section.id);
      if(!save()){item.favoriteSections=previous;return}
      enhanceInfoCard(true);toast('お気に入り区間を削除しました');
    });
  }
  const nowCreator=$('#nowCreator');
  if(nowCreator){
    nowCreator.classList.add('creator-link');nowCreator.setAttribute('title','配信者ページを開く');
    nowCreator.addEventListener('click',()=>{const item=getItem();if(item)showCreatorPage(item.creator)});
  }

  // ----------------------------------------------------------------------
  // Manual timestamp editor
  // ----------------------------------------------------------------------
  function createTimestampEditor(){
    if($('#timestampEditDialog'))return;
    const dialog=document.createElement('dialog');dialog.id='timestampEditDialog';dialog.className='dialog timestamp-edit-dialog';
    dialog.innerHTML=`<form method="dialog" id="timestampEditForm"><div class="dialog-head"><div><div class="eyebrow">TIMESTAMP EDITOR</div><h3>保存済みタイムスタンプを編集</h3><p class="muted small">時間・見出し・内容・副題を直接修正できます。親子情報は可能な範囲で維持します。</p></div><button value="cancel" class="icon-btn subtle">×</button></div><div class="timestamp-edit-toolbar"><button type="button" class="ghost-btn" id="timestampAddCurrent">＋ 現在位置</button><button type="button" class="ghost-btn" id="timestampAddBlank">＋ 空の行</button><span id="timestampEditCount"></span></div><div class="timestamp-edit-head"><span>見出し</span><span>時間</span><span>内容</span><span>副題</span><span></span></div><div id="timestampEditRows" class="timestamp-edit-rows"></div><div class="dialog-actions"><button value="cancel" class="ghost-btn">キャンセル</button><button type="submit" class="primary-btn">変更を保存</button></div></form>`;
    document.body.appendChild(dialog);
    $('#timestampAddCurrent').onclick=()=>{captureEditorInputs();addEditorRow(Math.floor(currentPosition()))};
    $('#timestampAddBlank').onclick=()=>{captureEditorInputs();addEditorRow(0)};
    $('#timestampEditForm').addEventListener('submit',saveTimestampEdits);
    $('#timestampEditRows').addEventListener('click',event=>{
      const button=event.target.closest('[data-remove-edit-row]');if(!button)return;
      captureEditorInputs();editorRows=editorRows.filter(row=>row.key!==button.dataset.removeEditRow);renderEditorRows();
    });
  }
  function openTimestampEditor(){
    const item=getItem();if(!item)return;createTimestampEditor();
    editorRows=(item.timestamps||[]).map((row,index)=>({key:`existing-${index}-${makeId()}`,originalTime:Number(row.time),data:{...row},timeInput:null}));
    renderEditorRows();$('#timestampEditDialog').showModal();
  }
  function captureEditorInputs(){
    const box=$('#timestampEditRows');if(!box)return;
    $$('.timestamp-edit-row',box).forEach(dom=>{
      const row=editorRows.find(x=>x.key===dom.dataset.editKey);if(!row)return;
      row.data.group=$('[data-field="group"]',dom).value;row.data.label=$('[data-field="label"]',dom).value;row.data.subtitle=$('[data-field="subtitle"]',dom).value;
      const raw=$('[data-field="time"]',dom).value,time=parseEditorTime(raw);
      if(time==null)row.timeInput=raw;else{row.data.time=time;row.timeInput=null}
    });
  }
  function addEditorRow(time){
    editorRows.push({key:`new-${makeId()}`,originalTime:null,timeInput:null,data:{time:Number(time)||0,label:'タイムスタンプ',group:'',subtitle:'',role:'item',confidence:1,sourceStyle:'manual',tags:[]}});
    editorRows.sort((a,b)=>Number(a.data.time)-Number(b.data.time));renderEditorRows();
    requestAnimationFrame(()=>$('#timestampEditRows')?.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'}));
  }
  function renderEditorRows(){
    const box=$('#timestampEditRows');if(!box)return;$('#timestampEditCount').textContent=`${editorRows.length}件`;
    box.innerHTML=editorRows.map(row=>{
      const data=row.data||{},timeValue=row.timeInput!=null?row.timeInput:fmtTime(data.time);
      return `<div class="timestamp-edit-row" data-edit-key="${safe(row.key)}"><input data-field="group" value="${safe(data.group||'')}" placeholder="見出しなし"><input data-field="time" value="${safe(timeValue)}" placeholder="0:00"><div class="timestamp-edit-label-wrap"><input data-field="label" value="${safe(data.label||'')}" placeholder="内容">${data.role&&data.role!=='item'?`<span class="timestamp-edit-role">${data.role==='parent'?'親':'子'}</span>`:''}</div><input data-field="subtitle" value="${safe(data.subtitle||'')}" placeholder="副題なし"><button type="button" class="timestamp-edit-remove" data-remove-edit-row="${safe(row.key)}" title="削除">×</button></div>`;
    }).join('');
  }
  function saveTimestampEdits(event){
    event.preventDefault();const item=getItem();if(!item)return;
    const drafts=[];let invalid=false;
    $$('.timestamp-edit-row',$('#timestampEditRows')).forEach(dom=>{
      const source=editorRows.find(row=>row.key===dom.dataset.editKey);if(!source)return;
      const time=parseEditorTime($('[data-field="time"]',dom).value);
      if(time==null){invalid=true;dom.classList.add('invalid');return}
      const group=$('[data-field="group"]',dom).value.trim(),label=$('[data-field="label"]',dom).value.trim()||'タイムスタンプ',subtitle=$('[data-field="subtitle"]',dom).value.trim();
      const next={...source.data,time,group,label,editedAt:Date.now()};
      if(subtitle)next.subtitle=subtitle;else delete next.subtitle;
      next.tags=guessTags(label,group,subtitle);
      drafts.push({originalTime:source.originalTime,data:next});
    });
    if(invalid)return toast('時間の形式を確認してください');

    const parentMap=new Map();
    drafts.forEach(row=>{if(row.data.role==='parent'&&row.originalTime!=null)parentMap.set(Number(row.originalTime),{time:Number(row.data.time),label:row.data.label})});
    drafts.forEach(row=>{
      const data=row.data;if(data.role!=='child'||data.parentTime==null)return;
      const parent=parentMap.get(Number(data.parentTime));
      if(parent){data.parentTime=parent.time;data.parentLabel=parent.label;data.depth=1}
      else{data.role='item';data.depth=0;delete data.parentTime;delete data.parentLabel}
    });

    const previous=item.timestamps;
    item.timestamps=drafts.map(row=>row.data).sort((a,b)=>Number(a.time)-Number(b.time));
    if(!save()){item.timestamps=previous;return}
    $('#timestampEditDialog').close();renderTimestamps();renderFilters();toast('タイムスタンプを更新しました');
  }
  function installEditButton(){
    const tools=$('.timestamp-tools');if(!tools)return;
    let button=$('#timestampEditBtn');
    if(!button){button=document.createElement('button');button.id='timestampEditBtn';button.className='ghost-btn';button.textContent='編集';button.onclick=openTimestampEditor;tools.prepend(button)}
    button.disabled=!state.selectedId;
  }

  // ----------------------------------------------------------------------
  // Diagnostics / help integration
  // ----------------------------------------------------------------------
  function installDiagnostics(){
    const body=$('#dataDialog .product-dialog-body');if(!body||$('#qualityDiagnostics'))return;
    const section=document.createElement('section');section.className='product-section';section.id='qualityDiagnostics';
    section.innerHTML='<div class="product-section-title"><div><strong>ライブラリ診断</strong><span>重複動画・壊れた参照・不正なタイムスタンプを確認します。</span></div></div><div class="quality-diagnostic-status" id="qualityDiagnosticStatus">未診断</div><button type="button" class="ghost-btn" id="qualityDiagnosticBtn">整合性を確認</button>';
    body.appendChild(section);
    $('#qualityDiagnosticBtn').onclick=()=>{
      const problems=diagnoseLibrary(),status=$('#qualityDiagnosticStatus');
      status.classList.toggle('problem',!!problems.length);
      status.textContent=problems.length?`${problems.length}件の確認項目があります: ${problems.slice(0,4).join(' / ')}${problems.length>4?' …':''}`:'問題は見つかりませんでした。';
    };
  }
  function installHelpShortcuts(){
    const grid=$('#helpDialog .product-shortcut-grid');if(!grid||grid.dataset.libraryTools)return;
    grid.dataset.libraryTools='1';
    grid.insertAdjacentHTML('beforeend','<div class="shortcut-row"><span>再生 / 一時停止</span><kbd>Space / K</kbd></div><div class="shortcut-row"><span>10秒戻る / 進む</span><kbd>J / L</kbd></div>');
  }

  document.addEventListener('asmrtube:selection-rendered',()=>{installEditButton();enhanceInfoCard(false)});
  document.addEventListener('asmrtube:timestamps-rendered',installEditButton);
  document.addEventListener('asmrtube:data-saved',()=>{if($('#dataDialog')?.open)window.asmrtubeProductShell?.refreshDataDialog?.()});

  installDiagnostics();installHelpShortcuts();installEditButton();enhanceInfoCard(false);
  window.applyAsmrtubeVersion?.();

  window.asmrtubeLibraryTools={persistResume,showCreatorPage,openSectionDialog,openTimestampEditor};
})();
