// ASMRTube product shell — help, data recovery, dashboard and mobile navigation.
(function(){
  'use strict';
  const LIBRARY_KEY='asmrtube.library.v1';
  const SETTINGS_KEY='asmrtube.settings.v1';
  const SNAPSHOT_KEY='asmrtube.snapshot.v1';
  const PRE_RESTORE_KEY='asmrtube.snapshot.beforeRestore.v1';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const diag=(type,detail={})=>{try{window.asmrtubeDiagnostics?.record(type,detail)}catch{}};

  function brandSetup(){
    const brandMark=$('.brand-mark');
    if(brandMark)brandMark.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h2.2l1.4-4.6 2.2 9.2 2.1-11.2 2.2 12.8 1.8-6.2H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const sidebar=$('.sidebar');
    if(sidebar&&!$('.sidebar-version',sidebar)){
      const version=document.createElement('div');version.className='sidebar-version';
      version.innerHTML=`<span>ASMRTUBE</span><strong>v${safe(window.ASMRTUBE_CONFIG?.appVersion||'')}</strong>`;
      sidebar.appendChild(version);
    }
    const nowTitle=$('.now-title');
    if(nowTitle&&!$('.now-playing-wrap')){
      const wrap=document.createElement('div');wrap.className='now-playing-wrap';nowTitle.parentNode.insertBefore(wrap,nowTitle);
      const art=document.createElement('div');art.className='now-art empty';art.id='nowArt';art.textContent='A';wrap.appendChild(art);wrap.appendChild(nowTitle);
    }
    updateNowArt();window.applyAsmrtubeVersion?.();
  }
  function thumbnailsEnabled(){
    const flag=document.documentElement.dataset.thumbs;if(flag==='0')return false;if(flag==='1')return true;
    try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}').showThumbs!==false}catch{return true}
  }
  function updateNowArt(){
    const art=$('#nowArt');if(!art)return;
    const item=typeof itemById==='function'?itemById(state.selectedId):null;
    const id=/^[A-Za-z0-9_-]{11}$/.test(String(item?.videoId||''))?item.videoId:'';
    if(id&&thumbnailsEnabled()){art.className='now-art';art.innerHTML=`<img src="https://i.ytimg.com/vi/${safe(id)}/mqdefault.jpg" alt="" width="124" height="124" loading="lazy" decoding="async">`}
    else{art.className='now-art empty';art.textContent='A'}
  }

  function createHelpDialog(){
    if($('#helpDialog'))return;
    const dialog=document.createElement('dialog');dialog.id='helpDialog';dialog.className='dialog product-dialog-wide';
    dialog.innerHTML=`<form method="dialog">
      <div class="dialog-head"><div><div class="eyebrow">HELP / GUIDE</div><h3>ASMRTubeの使い方</h3></div><button value="cancel" class="icon-btn subtle">×</button></div>
      <div class="product-dialog-body">
        <section class="product-section"><div class="product-section-title"><div><strong>基本の流れ</strong><span>登録からタイムスタンプ利用まで。</span></div></div><div class="help-steps"><div class="help-step">ASMR追加からYouTube URLを貼り付ける。タイトルとチャンネル名は自動取得できます。</div><div class="help-step">YouTubeコメント欄のタイムスタンプをそのままコピーして「コメントから取込」へ貼る。</div><div class="help-step">解析結果を確認し、必要なら見出し・時間・内容を修正して保存。</div><div class="help-step">右パネルの「見出し / すべて」を使い分け、目的の音へ直接ジャンプ。</div></div></section>
        <section class="product-section"><div class="product-section-title"><div><strong>対応タイムスタンプ例</strong><span>人によって違う書き方を汎用パーサーで吸収します。</span></div></div><div class="help-code">0:00 開始\n[12:35](YouTube URL) 耳かき\n25:54 - 梵天(右耳)\n耳ふー  4:46 右  5:38 左\n▷ 38:10 スライム  └ 41:20 握力52kg\n1:40 柔らかいタオル Soft Towel</div></section>
        <section class="product-section"><div class="product-section-title"><div><strong>ショートカット</strong><span>入力欄やボタンを操作中は再生ショートカットが割り込みません。</span></div></div><div class="product-shortcut-grid" data-library-tools="1"><div class="shortcut-row"><span>検索へ移動</span><kbd>Ctrl K</kbd></div><div class="shortcut-row"><span>ヘルプを開く</span><kbd>?</kbd></div><div class="shortcut-row"><span>再生 / 一時停止</span><kbd>Space / K</kbd></div><div class="shortcut-row"><span>10秒戻る / 進む</span><kbd>J / L</kbd></div><div class="shortcut-row"><span>サイドバーを閉じる</span><kbd>Esc</kbd></div></div></section>
        <section class="product-section"><div class="product-section-title"><div><strong>データ保護</strong><span>ブラウザのサイトデータを消すとローカル保存も消えます。</span></div></div><div class="settings-note">重要なライブラリは定期的に「データ管理 → JSONを書き出す」でバックアップしてください。読み込み・削除・復元前にはローカルスナップショットも利用します。</div></section>
      </div><div class="dialog-actions"><button value="cancel" class="primary-btn">閉じる</button></div>
    </form>`;
    document.body.appendChild(dialog);
  }

  function createSnapshot(reason='manual'){
    try{
      const raw=localStorage.getItem(LIBRARY_KEY)||JSON.stringify({library:state.library||[],playlists:state.playlists||[],recent:state.recent||[]});
      localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({createdAt:Date.now(),reason,raw}));diag('snapshot.save',{reason});return true;
    }catch(error){diag('snapshot.failure',{reason,name:error?.name||'Error'});return false}
  }
  function readStoredSnapshot(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  function snapshotInfo(){return readStoredSnapshot(SNAPSHOT_KEY)}
  function beforeRestoreInfo(){return readStoredSnapshot(PRE_RESTORE_KEY)}
  function formatBytes(bytes){const n=Number(bytes)||0;if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(2)} MB`}
  function dataStats(){
    const library=state.library||[],timestamps=library.reduce((n,item)=>n+(item.timestamps?.length||0),0),raw=localStorage.getItem(LIBRARY_KEY)||'';
    let bytes=raw.length;try{bytes=new Blob([raw]).size}catch{}
    return {items:library.length,timestamps,playlists:(state.playlists||[]).length,storage:formatBytes(bytes)};
  }
  function refreshDataDialog(){
    const stats=dataStats();$('#dataItemCount')?.replaceChildren(document.createTextNode(String(stats.items)));$('#dataTimestampCount')?.replaceChildren(document.createTextNode(String(stats.timestamps)));$('#dataPlaylistCount')?.replaceChildren(document.createTextNode(String(stats.playlists)));$('#dataStorageSize')?.replaceChildren(document.createTextNode(stats.storage));
    const snap=snapshotInfo(),status=$('#snapshotStatus');if(status)status.textContent=snap?`最新スナップショット: ${new Date(snap.createdAt).toLocaleString('ja-JP')} / ${snap.reason}`:'スナップショットはまだありません。';
    const previous=beforeRestoreInfo(),undo=$('#snapshotUndoRestoreBtn'),undoStatus=$('#snapshotUndoRestoreStatus');
    if(undo){undo.disabled=!previous?.raw;undo.hidden=!previous?.raw}if(undoStatus)undoStatus.textContent=previous?.raw?`復元前状態: ${new Date(previous.createdAt).toLocaleString('ja-JP')}`:'';
    const diagnostics=window.asmrtubeDiagnostics?.summary?.(),diagStatus=$('#runtimeDiagnosticsStatus');
    if(diagStatus&&diagnostics)diagStatus.textContent=`診断イベント ${diagnostics.events}件 / エラー系 ${diagnostics.errors}件 / 保存 ${diagnostics.storageAvailable?'利用可':'利用不可'}`;
  }
  function restoreRaw(raw,{rememberCurrent=true}={}){
    try{
      JSON.parse(raw);
      if(rememberCurrent){const current=localStorage.getItem(LIBRARY_KEY)||'';localStorage.setItem(PRE_RESTORE_KEY,JSON.stringify({createdAt:Date.now(),raw:current}))}
      localStorage.setItem(LIBRARY_KEY,raw);diag('snapshot.restore');location.reload();return true;
    }catch(error){toast('スナップショットを復元できませんでした');diag('snapshot.restore.failure',{name:error?.name||'Error'});return false}
  }

  function createDataDialog(){
    if($('#dataDialog'))return;
    const dialog=document.createElement('dialog');dialog.id='dataDialog';dialog.className='dialog product-dialog';
    dialog.innerHTML=`<form method="dialog"><div class="dialog-head"><div><div class="eyebrow">DATA MANAGEMENT</div><h3>データ管理</h3></div><button value="cancel" class="icon-btn subtle">×</button></div><div class="product-dialog-body">
      <section class="product-section"><div class="product-section-title"><div><strong>現在のデータ</strong><span>このブラウザに保存されているASMRTubeデータの概要です。</span></div></div><div class="data-stats"><div class="data-stat"><span>ASMR</span><strong id="dataItemCount">0</strong></div><div class="data-stat"><span>TIMESTAMPS</span><strong id="dataTimestampCount">0</strong></div><div class="data-stat"><span>PLAYLISTS</span><strong id="dataPlaylistCount">0</strong></div><div class="data-stat"><span>STORAGE</span><strong id="dataStorageSize">0 KB</strong></div></div></section>
      <section class="product-section"><div class="product-section-title"><div><strong>JSONバックアップ</strong><span>別PC・別ブラウザへの移行にも使えます。読み込み前に内容を検証します。</span></div></div><div class="data-actions-grid"><button type="button" class="primary-soft" id="dataExportBtn">JSONを書き出す</button><button type="button" class="ghost-btn" id="dataImportBtn">JSONを読み込む</button></div></section>
      <section class="product-section"><div class="product-section-title"><div><strong>ローカルスナップショット</strong><span>誤削除や読み込みミス対策。ブラウザ内だけの簡易退避です。</span></div></div><div class="snapshot-status" id="snapshotStatus"></div><div class="data-actions-grid"><button type="button" class="ghost-btn" id="snapshotSaveBtn">今の状態を退避</button><button type="button" class="ghost-btn" id="snapshotRestoreBtn">退避状態へ戻す</button></div><div class="snapshot-status" id="snapshotUndoRestoreStatus"></div><button type="button" class="ghost-btn" id="snapshotUndoRestoreBtn" hidden>復元前の状態へ戻す</button><div class="settings-note">サイトデータ自体を削除するとスナップショットも消えるため、重要なバックアップはJSON書き出しを使ってください。</div></section>
      <section class="product-section"><div class="product-section-title"><div><strong>Runtime Diagnostics</strong><span>直近のエラー・保存失敗・初期化状態を端末内だけに最大120件保持します。入力本文やTokenは記録しません。</span></div></div><div class="quality-diagnostic-status" id="runtimeDiagnosticsStatus">診断情報を確認中…</div><div class="data-actions-grid"><button type="button" class="ghost-btn" id="diagnosticsExportBtn">診断JSONを書き出す</button><button type="button" class="ghost-btn" id="diagnosticsClearBtn">診断を消去</button></div></section>
    </div><div class="dialog-actions"><button value="cancel" class="primary-btn">完了</button></div></form>`;
    document.body.appendChild(dialog);
    $('#dataExportBtn').onclick=()=>$('#exportBtn')?.click();$('#dataImportBtn').onclick=()=>$('#importInput')?.click();
    $('#snapshotSaveBtn').onclick=()=>{if(createSnapshot('manual')){refreshDataDialog();toast('現在の状態を退避しました')}else toast('スナップショットを保存できませんでした')};
    $('#snapshotRestoreBtn').onclick=()=>{const snap=snapshotInfo();if(!snap?.raw)return toast('復元できるスナップショットがありません');if(confirm('現在のライブラリを退避状態で置き換えますか？'))restoreRaw(snap.raw)};
    $('#snapshotUndoRestoreBtn').onclick=()=>{const previous=beforeRestoreInfo();if(!previous?.raw)return;if(confirm('復元前の状態へ戻しますか？'))restoreRaw(previous.raw)};
    $('#diagnosticsExportBtn').onclick=()=>window.asmrtubeDiagnostics?.exportJson?.();
    $('#diagnosticsClearBtn').onclick=()=>{if(window.asmrtubeDiagnostics?.clear?.()){refreshDataDialog();toast('診断情報を消去しました')}};
  }
  function setupDataButton(){
    const tools=$('.sidebar-tools');if(tools&&!$('#dataManageBtn')){const button=document.createElement('button');button.className='ghost-btn';button.id='dataManageBtn';button.textContent='データ管理';tools.appendChild(button);button.onclick=()=>{refreshDataDialog();$('#dataDialog')?.showModal();closeMobileSidebar()}}
  }

  function createDashboard(){
    if($('#dashboardPage'))return;
    const nav=$('#nav');if(nav&&!$('#dashboardBtn')){const button=document.createElement('button');button.className='view-btn';button.id='dashboardBtn';button.innerHTML='<span>概要</span><span class="nav-count">⌂</span>';nav.prepend(button);button.onclick=showDashboard}
    const workspace=$('.workspace');if(workspace){const page=document.createElement('section');page.id='dashboardPage';page.className='dashboard-page';workspace.insertAdjacentElement('beforebegin',page)}
    $$('.view-btn[data-view]').forEach(button=>button.addEventListener('click',hideDashboard));$('.sidebar')?.addEventListener('click',event=>{if(event.target.closest('.song-item,.playlist-item'))hideDashboard()});
  }
  function renderDashboard(){
    const page=$('#dashboardPage');if(!page)return;
    const library=state.library||[],fav=library.filter(x=>x.favorite).length,sleep=library.filter(x=>x.sleepFriendly||x.tags?.includes('睡眠')).length,timestamps=library.reduce((n,x)=>n+(x.timestamps?.length||0),0),recentIds=state.recent||[];
    const resume=library.filter(x=>Number(x.resumeAt||0)>8).sort((a,b)=>(b.resumeUpdatedAt||0)-(a.resumeUpdatedAt||0));
    let recent=recentIds.map(id=>library.find(x=>x.id===id)).filter(Boolean).slice(0,6);
    const recentHeading=recent.length?'最近聴いた':'最近追加';
    if(!recent.length)recent=[...library].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,6);
    const tagCounts=new Map();library.forEach(x=>(x.tags||[]).forEach(tag=>tagCounts.set(tag,(tagCounts.get(tag)||0)+1)));const tags=[...tagCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ja')).slice(0,12);
    const showThumbs=document.documentElement.dataset.thumbs!=='0';
    page.innerHTML=`<div class="dashboard-hero"><div class="dashboard-hero-copy"><div class="eyebrow">LIBRARY OVERVIEW</div><h2>聴きたいASMRへ、すぐ辿り着く。</h2><p>ライブラリ全体・最近聴いた作品・よく使うタグを1画面で確認できます。</p></div><div class="dashboard-hero-actions"><button class="ghost-btn" data-dashboard-action="data">データ管理</button><button class="primary-btn" data-dashboard-action="add">＋ ASMR追加</button></div></div><div class="dashboard-stats"><article class="dashboard-stat"><span class="dashboard-stat-label">LIBRARY</span><strong class="dashboard-stat-value">${library.length}</strong><span class="dashboard-stat-note">登録ASMR</span></article><article class="dashboard-stat"><span class="dashboard-stat-label">FAVORITES</span><strong class="dashboard-stat-value">${fav}</strong><span class="dashboard-stat-note">お気に入り</span></article><article class="dashboard-stat"><span class="dashboard-stat-label">SLEEP</span><strong class="dashboard-stat-value">${sleep}</strong><span class="dashboard-stat-note">睡眠向け</span></article><article class="dashboard-stat"><span class="dashboard-stat-label">TIMESTAMPS</span><strong class="dashboard-stat-value">${timestamps}</strong><span class="dashboard-stat-note">登録タイムスタンプ</span></article></div><div class="dashboard-grid"><section class="dashboard-panel"><div class="dashboard-panel-head"><h3>${recentHeading}</h3><span>${recent.length}件</span></div>${recent.length?`<div class="dashboard-recent-grid">${recent.map(item=>`<button class="dashboard-recent" data-dashboard-item="${safe(item.id)}"><span class="dashboard-recent-thumb">${showThumbs?`<img src="https://i.ytimg.com/vi/${safe(item.videoId||'')}/mqdefault.jpg" alt="" width="240" height="150" loading="lazy" decoding="async">`:''}</span><span class="dashboard-recent-copy"><strong>${safe(item.title||'無題')}</strong><span>${safe(item.creator||'配信者未設定')}</span></span></button>`).join('')}</div>`:'<div class="dashboard-empty">ASMRを追加するとここに表示されます。</div>'}</section><aside class="dashboard-panel"><div class="dashboard-panel-head"><h3>よく使うタグ</h3><span>TOP ${tags.length}</span></div>${tags.length?`<div class="dashboard-tags">${tags.map(([name,count])=>`<span class="dashboard-tag">${safe(name)} <b>${count}</b></span>`).join('')}</div>`:'<div class="dashboard-empty">タグはまだありません。</div>'}<div class="dashboard-quick"><button class="ghost-btn" data-dashboard-view="favorites"><span>お気に入りを見る</span><span>${fav} →</span></button><button class="ghost-btn" data-dashboard-view="sleep"><span>睡眠向けを見る</span><span>${sleep} →</span></button><button class="ghost-btn" data-dashboard-view="recent"><span>最近聴いたを見る</span><span>${recentIds.length} →</span></button><button class="ghost-btn" data-dashboard-view="resume"><span>続きから見る</span><span>${resume.length} →</span></button></div></aside></div>`;
    $$('[data-dashboard-item]',page).forEach(button=>button.onclick=()=>{hideDashboard();selectItem(button.dataset.dashboardItem);closeMobileSidebar()});$$('[data-dashboard-view]',page).forEach(button=>button.onclick=()=>{hideDashboard();$(`.view-btn[data-view="${button.dataset.dashboardView}"]`)?.click()});$('[data-dashboard-action="add"]',page)?.addEventListener('click',()=>{hideDashboard();$('#topAddBtn')?.click()});$('[data-dashboard-action="data"]',page)?.addEventListener('click',()=>{refreshDataDialog();$('#dataDialog')?.showModal()});
  }
  function showDashboard(){renderDashboard();document.body.classList.add('dashboard-mode');$$('.view-btn').forEach(button=>button.classList.toggle('active',button.id==='dashboardBtn'));$('#viewEyebrow').textContent='LIBRARY OVERVIEW';$('#nowTitle').textContent='ライブラリ概要';$('#nowCreator').textContent='登録状況と最近聴いたASMR';closeMobileSidebar();diag('dashboard.open')}
  function hideDashboard(){if(!document.body.classList.contains('dashboard-mode'))return;document.body.classList.remove('dashboard-mode');$('#dashboardBtn')?.classList.remove('active');renderSelection()}

  function initMobileNavigation(){
    const topbar=$('.topbar'),sidebar=$('.sidebar'),brandRow=$('.brand-row');if(!topbar||!sidebar||$('#mobileMenuBtn'))return;
    const menu=document.createElement('button');menu.className='mobile-menu-btn';menu.id='mobileMenuBtn';menu.type='button';menu.textContent='☰';menu.setAttribute('aria-label','メニュー');menu.setAttribute('aria-expanded','false');topbar.prepend(menu);
    const close=document.createElement('button');close.className='mobile-sidebar-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','メニューを閉じる');brandRow?.appendChild(close);
    const backdrop=document.createElement('button');backdrop.className='mobile-sidebar-backdrop';backdrop.type='button';backdrop.setAttribute('aria-label','メニューを閉じる');document.body.appendChild(backdrop);
    menu.onclick=()=>{const open=document.body.classList.toggle('mobile-sidebar-open');menu.setAttribute('aria-expanded',String(open))};close.onclick=closeMobileSidebar;backdrop.onclick=closeMobileSidebar;
    sidebar.addEventListener('click',event=>{if(matchMedia('(max-width:900px)').matches&&event.target.closest('.song-item,.view-btn,.playlist-item'))setTimeout(closeMobileSidebar,30)});
  }
  function closeMobileSidebar(){document.body.classList.remove('mobile-sidebar-open');$('#mobileMenuBtn')?.setAttribute('aria-expanded','false')}

  function ensureParseInsights(){let box=$('#parseInsights');if(box)return box;const row=$('.parse-row');if(!row)return null;box=document.createElement('div');box.id='parseInsights';box.className='parse-insights';row.insertAdjacentElement('afterend',box);return box}
  function updateParseInsights(){
    const box=ensureParseInsights();if(!box)return;const stats=window.ASMRTubeTimestampParser?.stats?.(),rows=state.parsedTimestamps||[];if(!stats||!rows.length){box.classList.remove('show');box.innerHTML='';return}
    const chips=[['検出',stats.total,'good'],['見出し',stats.groups,''],['親',stats.parents,''],['子',stats.children,''],['二言語',stats.bilingual,''],['URL時刻',stats.urlDerived,''],['要確認',stats.inferred,stats.inferred?'warn':'good']];box.innerHTML=chips.filter(([,value],index)=>index===0||Number(value)>0).map(([key,value,cls])=>`<span class="parse-insight ${cls}">${key}<strong>${value}</strong></span>`).join('');box.classList.add('show');if($('#parseSummary'))$('#parseSummary').textContent=stats.inferred?`${stats.total}件検出 / ${stats.inferred}件は推定を含みます`:`${stats.total}件検出 / 高信頼`;
    $$('.preview-grouped-row,.preview-row',$('#timestampPreview')).forEach((element,index)=>{const row=rows[index];if(!row)return;const confidence=Number(row.confidence??1),badge=document.createElement('span');badge.className=`preview-confidence ${confidence>=.95?'high':confidence>=.85?'mid':''}`;badge.textContent=confidence>=.95?'高':confidence>=.85?'中':'確認';badge.title=`解析信頼度 ${Math.round(confidence*100)}%${row.role&&row.role!=='item'?` / ${row.role}`:''}`;element.appendChild(badge);if(confidence<.9)element.classList.add('parser-review')});
  }
  function isInteractive(target){return !!target?.closest?.('button,a,input,textarea,select,summary,[contenteditable="true"],[role="button"]')}
  function setupShortcuts(){window.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMobileSidebar();return}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();closeMobileSidebar();$('#searchInput')?.focus();$('#searchInput')?.select();return}if(!isInteractive(event.target)&&!$('dialog[open]')&&event.key==='?'){event.preventDefault();$('#helpDialog')?.showModal()}})}
  function shouldStartDashboard(){try{return !!JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}').startDashboard}catch{return false}}

  brandSetup();createHelpDialog();createDataDialog();setupDataButton();createDashboard();initMobileNavigation();ensureParseInsights();setupShortcuts();
  document.addEventListener('asmrtube:selection-rendered',updateNowArt);document.addEventListener('asmrtube:parser-result',()=>setTimeout(updateParseInsights,0));document.addEventListener('asmrtube:appearance-change',()=>{if(document.body.classList.contains('dashboard-mode'))renderDashboard()});
  if(shouldStartDashboard())setTimeout(showDashboard,80);
  window.asmrtubeProductShell={showDashboard,hideDashboard,refreshDataDialog,createSnapshot};
})();
