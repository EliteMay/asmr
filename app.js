const STORAGE_KEY='asmrtube.library.v1';
const DEFAULT_TAGS=['耳かき','梵天','囁き','吐息','オノマトペ','タッピング','マッサージ','添い寝','ロールプレイ','睡眠'];
const EAR_TAGS=['右耳','左耳','両耳','交互'];
const state={library:[],playlists:[],recent:[],selectedId:null,currentView:'all',currentPlaylist:null,currentChannel:null,browseChannel:null,query:'',browseQuery:'',filters:new Set(),player:null,currentId:null,duration:0,loopA:null,loopB:null,sleepTimer:null,parsedTimestamps:[]};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
let metadataSeq=0;
let metadataTimer=null;
let volumeSaveTimer=null;
let lastDurableRaw='';
let saveFailureToastAt=0;

function diag(type,detail={}){try{window.asmrtubeDiagnostics?.record(type,detail)}catch{}}
function serializeState(){return JSON.stringify({library:state.library,playlists:state.playlists,recent:state.recent})}
function applyStoredData(data){
  state.library=Array.isArray(data?.library)?data.library:[];
  state.playlists=Array.isArray(data?.playlists)?data.playlists:[];
  state.recent=Array.isArray(data?.recent)?data.recent:[];
  if(state.selectedId&&!state.library.some(item=>item.id===state.selectedId))state.selectedId=null;
  if(state.currentId&&!state.library.some(item=>item.id===state.currentId))state.currentId=null;
}
function restoreDurableState(){
  if(!lastDurableRaw)return;
  try{
    applyStoredData(JSON.parse(lastDurableRaw));
    const item=itemById(state.currentId||state.selectedId);
    if(item&&$('#volume'))$('#volume').value=String(item.volume??35);
  }catch{}
}
function save({silent=false,reason='library'}={}){
  try{
    const raw=serializeState();
    localStorage.setItem(STORAGE_KEY,raw);
    lastDurableRaw=raw;
    document.dispatchEvent(new CustomEvent('asmrtube:data-saved',{detail:{reason}}));
    return true;
  }catch(error){
    diag('storage.write.failure',{reason,name:error?.name||'Error',message:error?.message||'unknown'});
    restoreDurableState();
    document.dispatchEvent(new CustomEvent('asmrtube:save-failed',{detail:{reason}}));
    if(!silent&&Date.now()-saveFailureToastAt>2500){saveFailureToastAt=Date.now();toast('保存できませんでした。直前の変更を元に戻しました')}
    queueMicrotask(()=>{try{renderAll()}catch{}});
    return false;
  }
}
function load(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){lastDurableRaw=serializeState();diag('storage.load.empty');return true}
    const data=JSON.parse(raw);
    applyStoredData(data);
    lastDurableRaw=raw;
    diag('storage.load.success',{items:state.library.length,playlists:state.playlists.length});
    return true;
  }catch(error){
    lastDurableRaw=serializeState();
    diag('storage.read.failure',{name:error?.name||'Error',message:error?.message||'unknown'});
    toast('保存データを読み込めませんでした。データ管理からバックアップを確認してください');
    return false;
  }
}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function ytId(url){return window.ASMRTubeCore?.youtubeVideoId(url)||null}
function canonicalYoutubeUrl(videoId){return window.ASMRTubeCore?.canonicalYoutubeUrl(videoId)||''}
function thumb(id){return /^[A-Za-z0-9_-]{11}$/.test(String(id||''))?`https://i.ytimg.com/vi/${id}/hqdefault.jpg`:''}
function fmt(sec){sec=Math.max(0,Math.floor(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
function parseTime(t){const p=String(t).trim().split(':').map(Number);if(p.some(Number.isNaN))return null;if(p.length===2&&p[1]<60)return p[0]*60+p[1];if(p.length===3&&p[1]<60&&p[2]<60)return p[0]*3600+p[1]*60+p[2];return null}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function attr(s){return esc(s)}
function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2200)}
function ratingLabel(n){return ['未評価','普通','好き','かなり好き','神'][Number(n)||0]}
function tagList(v){return String(v||'').split(/[,、]/).map(s=>s.trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).slice(0,100)}
function itemById(id){return state.library.find(x=>x.id===id)}
function allTags(){return [...new Set([...DEFAULT_TAGS,...EAR_TAGS,...state.library.flatMap(x=>x.tags||[])])].sort((a,b)=>a.localeCompare(b,'ja'))}
function normalizeSearch(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[\s　]+/g,' ').trim()}
function channelKey(value){const name=String(value??'').trim();return name?normalizeSearch(name):'__unset__'}
function channelGroups(){
  const groups=new Map();
  state.library.forEach(item=>{
    const key=channelKey(item.creator),name=String(item.creator||'').trim()||'チャンネル未設定';
    if(!groups.has(key))groups.set(key,{key,name,count:0});
    groups.get(key).count++;
  });
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'ja'));
}
function searchText(item){
  const timestamps=(item.timestamps||[]).flatMap(t=>[t.label,t.group,t.subtitle,t.parentLabel,...(t.tags||[])]);
  const sections=(item.favoriteSections||[]).flatMap(section=>[section.label,fmt(section.start),fmt(section.end)]);
  return normalizeSearch([item.title,item.creator,...(item.tags||[]),...timestamps,...sections].filter(Boolean).join(' '));
}

function setMetadataStatus(message,type=''){
  const el=$('#metadataStatus');if(!el)return;
  el.textContent=message;
  el.className=`field-hint${type?` ${type}`:''}`;
}
async function fetchWithTimeout(url,timeoutMs=6000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{mode:'cors',cache:'no-store',signal:controller.signal})}
  finally{clearTimeout(timer)}
}
async function fetchYoutubeMetadata(url,{silent=false}={}){
  const videoId=ytId(url);
  if(!videoId){setMetadataStatus('有効なYouTube URLを貼り付けてください。','error');return false}
  const seq=++metadataSeq;
  const canonical=canonicalYoutubeUrl(videoId);
  setMetadataStatus('タイトルとチャンネル名を取得中…','loading');
  const endpoints=[
    `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`,
    `https://noembed.com/embed?url=${encodeURIComponent(canonical)}`
  ];
  for(const endpoint of endpoints){
    try{
      const res=await fetchWithTimeout(endpoint,6000);
      if(!res.ok){diag('metadata.fetch.failure',{provider:new URL(endpoint).hostname,status:res.status});continue}
      const data=await res.json();
      if(seq!==metadataSeq)return false;
      if(data.title)$('#videoTitle').value=String(data.title).slice(0,300);
      if(data.author_name)$('#creator').value=String(data.author_name).slice(0,220);
      if(data.title||data.author_name){
        setMetadataStatus('タイトルとチャンネル名を自動取得しました。','success');
        diag('metadata.fetch.success',{provider:new URL(endpoint).hostname});
        return true;
      }
    }catch(error){diag('metadata.fetch.failure',{provider:new URL(endpoint).hostname,name:error?.name||'Error'})}
  }
  if(seq!==metadataSeq)return false;
  setMetadataStatus('自動取得できませんでした。タイトル・チャンネル名は手入力できます。','error');
  if(!silent)toast('動画情報を自動取得できませんでした');
  return false;
}
function queueMetadataFetch(){
  clearTimeout(metadataTimer);
  const url=$('#videoUrl').value.trim();
  if(!url){setMetadataStatus('URLを貼るとタイトルとチャンネル名を自動取得します。');return}
  if(!ytId(url)){setMetadataStatus('YouTube URLを認識できません。','error');return}
  metadataTimer=setTimeout(()=>fetchYoutubeMetadata(url,{silent:true}),400);
}

function filtered({query=state.query}={}){
  let items=[...state.library];
  if(state.currentView==='favorites')items=items.filter(x=>x.favorite);
  if(state.currentView==='recent')items=state.recent.map(id=>itemById(id)).filter(Boolean);
  if(state.currentView==='resume')items=items.filter(x=>Number(x.resumeAt||0)>8).sort((a,b)=>(b.resumeUpdatedAt||0)-(a.resumeUpdatedAt||0));
  if(state.currentView==='sleep')items=items.filter(x=>x.sleepFriendly||x.tags?.includes('睡眠'));
  if(state.currentView==='channel')items=items.filter(x=>channelKey(x.creator)===state.currentChannel);
  if(state.currentView==='playlist'){
    const playlist=state.playlists.find(p=>p.id===state.currentPlaylist);
    items=(playlist?.items||[]).map(id=>itemById(id)).filter(Boolean);
  }
  if(query){
    const terms=normalizeSearch(query).split(' ').filter(Boolean);
    items=items.filter(item=>{const haystack=searchText(item);return terms.every(term=>haystack.includes(term))});
  }
  if(state.filters.size)items=items.filter(item=>[...state.filters].every(tag=>item.tags?.includes(tag)));
  const sort=$('#sortSelect')?.value||'new';
  if(sort==='title')items.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'ja'));
  else if(sort==='rating')items.sort((a,b)=>(b.rating||0)-(a.rating||0)||(b.createdAt||0)-(a.createdAt||0));
  else if(state.currentView!=='recent'&&state.currentView!=='resume')items.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return items;
}

function renderCounts(){
  $('#countAll').textContent=state.library.length;
  $('#countFav').textContent=state.library.filter(x=>x.favorite).length;
  $('#countRecent').textContent=state.recent.filter(id=>itemById(id)).length;
  $('#countResume').textContent=state.library.filter(x=>Number(x.resumeAt||0)>8).length;
  $('#countSleep').textContent=state.library.filter(x=>x.sleepFriendly||x.tags?.includes('睡眠')).length;
}
function renderFilters(){
  $('#earFilters').innerHTML=EAR_TAGS.map(tag=>chipHtml(tag)).join('');
  $('#typeFilters').innerHTML=allTags().filter(t=>!EAR_TAGS.includes(t)).map(tag=>chipHtml(tag)).join('');
  $$('.filter-chip').forEach(button=>button.onclick=()=>{state.filters.has(button.dataset.tag)?state.filters.delete(button.dataset.tag):state.filters.add(button.dataset.tag);renderFilters();renderSongList()});
}
function chipHtml(tag){return `<button class="chip filter-chip ${state.filters.has(tag)?'active':''}" data-tag="${attr(tag)}">${esc(tag)}</button>`}
function renderChannels(){
  const box=$('#channelList'),groups=channelGroups();
  if(!box)return;
  $('#channelCount').textContent=groups.length;
  box.innerHTML=groups.map(group=>`<button class="channel-item ${state.currentView==='channel'&&state.currentChannel===group.key?'active':''}" data-channel-key="${attr(group.key)}"><span>${esc(group.name)}</span><span class="channel-item-count">${group.count}</span></button>`).join('');
  [...box.children].forEach(button=>button.onclick=()=>{
    state.currentView='channel';state.currentChannel=button.dataset.channelKey;state.currentPlaylist=null;
    $$('.view-btn').forEach(node=>node.classList.remove('active'));
    const items=filtered();if(!items.some(item=>item.id===state.selectedId))state.selectedId=items[0]?.id||null;
    renderAll();
  });
}
function renderPlaylists(){
  const box=$('#playlistList');
  box.innerHTML=state.playlists.map(p=>`<button class="playlist-item ${state.currentView==='playlist'&&state.currentPlaylist===p.id?'active':''}" data-id="${attr(p.id)}">${esc(p.name)} (${p.items.length})</button>`).join('');
  [...box.children].forEach(button=>button.onclick=()=>{
    state.currentView='playlist';state.currentPlaylist=button.dataset.id;state.currentChannel=null;
    $$('.view-btn').forEach(node=>node.classList.remove('active'));
    renderAll();
  });
}
function thumbnailsEnabled(){
  const flag=document.documentElement.dataset.thumbs;if(flag==='0')return false;if(flag==='1')return true;
  try{return JSON.parse(localStorage.getItem('asmrtube.settings.v1')||'{}').showThumbs!==false}catch{return true}
}
function songHtml(item){
  const showThumbs=thumbnailsEnabled();
  const image=showThumbs&&thumb(item.videoId)?`<img src="${thumb(item.videoId)}" alt="" width="116" height="72" loading="lazy" decoding="async">`:'';
  return `<button class="song-item ${state.selectedId===item.id?'active':''}" data-id="${attr(item.id)}"><span class="thumb">${image}</span><span class="song-meta"><strong>${esc(item.title)}</strong><span>${esc(item.creator||'チャンネル未設定')}</span></span><span class="favorite-mark">${item.favorite?'★':''}</span></button>`;
}
function renderSongList(){
  const items=filtered();
  $('#resultCount').textContent=items.length;
  $('#songList').innerHTML=items.map(songHtml).join('');
  $('#emptyState').classList.toggle('hidden',items.length>0||state.library.length>0);
  $$('.song-item').forEach(button=>button.onclick=()=>selectItem(button.dataset.id));
  if(!items.length&&state.library.length){
    const narrowed=!!state.query||state.filters.size>0;
    const viewOnly=state.currentView!=='all'&&!narrowed;
    $('#songList').innerHTML=`<div class="quality-empty-state"><div class="quality-empty-icon">⌕</div><strong>${narrowed?'条件に合うASMRがありません':viewOnly?'この一覧にはまだASMRがありません':'ASMRがありません'}</strong><span>${narrowed?'検索語やタグ条件を解除すると他の作品を表示できます。':viewOnly?'「すべて」へ戻るとライブラリ全体を確認できます。':'ASMRを追加してください。'}</span><button class="ghost-btn" id="qualityEmptyAction">${narrowed?'検索・絞り込みを解除':viewOnly?'すべて表示':'ASMRを追加'}</button></div>`;
    $('#qualityEmptyAction')?.addEventListener('click',()=>{
      if(narrowed){state.query='';state.filters.clear();$('#searchInput').value='';renderFilters();renderSongList();return}
      if(viewOnly){$('.view-btn[data-view="all"]')?.click();return}
      $('#topAddBtn')?.click();
    });
  }
  renderCounts();
}
function currentViewLabel(){
  if(state.currentView==='favorites')return 'FAVORITES';
  if(state.currentView==='recent')return 'RECENTLY PLAYED';
  if(state.currentView==='sleep')return 'SLEEP ASMR';
  if(state.currentView==='channel'){const group=channelGroups().find(value=>value.key===state.currentChannel);return group?`チャンネル · ${group.name}`:'チャンネル'}
  if(state.currentView==='playlist')return 'PLAYLIST';
  return 'ASMR LIBRARY';
}

function showPlayerStatus(title,detail=''){
  const box=$('#playerPlaceholder');if(!box)return;
  box.classList.remove('hidden');
  box.querySelector('strong')?.replaceChildren(document.createTextNode(title));
  box.querySelector('span')?.replaceChildren(document.createTextNode(detail));
}
function selectItem(id,{play=false,start=0}={}){
  const item=itemById(id);if(!item)return;
  state.selectedId=id;
  $('#volume').value=item.volume??35;
  if(play){playItem(id,start);return}
  window.asmrtubeYoutubeRuntime?.selectItem?.(item,{start});
  renderSongList();renderSelection();renderBrowsePage();
  diag('library.select',{id:item.id});
}
function renderSelection(){
  const item=itemById(state.selectedId);
  $('#viewEyebrow').textContent=currentViewLabel();
  if(!item){
    $('#nowTitle').textContent='ASMRを選択';$('#nowCreator').textContent='左のライブラリから選んでください';
    $('#topFavBtn').disabled=true;$('#topEditBtn').disabled=true;$('#timestampImportBtn').disabled=true;
    $('#infoCard').innerHTML='<div class="info-empty">ASMRを選ぶと作品情報が表示されます</div>';
    renderTimestamps();
    document.dispatchEvent(new CustomEvent('asmrtube:selection-rendered',{detail:{item:null}}));
    return;
  }
  $('#nowTitle').textContent=item.title;$('#nowCreator').textContent=item.creator||'チャンネル未設定';
  $('#topFavBtn').disabled=false;$('#topEditBtn').disabled=false;$('#timestampImportBtn').disabled=false;
  $('#topFavBtn').textContent=`${item.favorite?'★':'☆'} お気に入り`;
  $('#infoCard').innerHTML=`<div class="info-title-row"><div class="info-title"><h3>${esc(item.title)}</h3><p>${esc(item.creator||'チャンネル未設定')}</p></div><span class="info-rating">${ratingLabel(item.rating)}</span></div><div class="tag-row">${(item.tags||[]).map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')||'<span class="muted small">タグ未設定</span>'}</div><div class="info-actions"><button class="primary-soft" id="infoPlay">▶ 再生</button><button class="ghost-btn" id="infoImport">コメントからタイムスタンプ</button><button class="ghost-btn" id="infoPlaylist">プレイリストへ</button><button class="danger-btn" id="infoDelete">削除</button></div>`;
  $('#infoPlay').onclick=()=>playItem(item.id);
  $('#infoImport').onclick=openTimestampDialog;
  $('#infoPlaylist').onclick=()=>addToPlaylistPrompt(item.id);
  $('#infoDelete').onclick=()=>deleteItem(item.id);
  renderTimestamps();
  document.dispatchEvent(new CustomEvent('asmrtube:selection-rendered',{detail:{item}}));
}

// Fallback renderer. timestamp-ui.js replaces these bindings with the canonical Sound Map renderer.
function renderTimestamps(){
  const item=itemById(state.selectedId),view=$('#timestampView'),rows=item?.timestamps||[];
  $('#timestampCount').textContent=rows.length;
  if(!item||!rows.length){view.className='timestamp-view empty';view.innerHTML='<div class="empty-copy"><strong>タイムスタンプなし</strong><span>コメント欄のタイムスタンプを貼り付けて登録できます。</span></div>';return}
  rows.sort((a,b)=>Number(a.time)-Number(b.time));
  view.className='timestamp-view';
  view.innerHTML=rows.map((row,index)=>`<div class="timestamp-row" data-time="${Number(row.time)||0}"><button class="timestamp-time timestamp-jump" data-time="${Number(row.time)||0}" title="${attr(row.label)}">${fmt(row.time)}</button><button class="timestamp-label timestamp-jump" data-time="${Number(row.time)||0}" title="${attr(row.label)}">${esc(row.label)}</button><button class="timestamp-delete" data-index="${index}" title="削除">×</button></div>`).join('');
  $$('.timestamp-jump').forEach(button=>button.onclick=()=>playItem(item.id,Number(button.dataset.time)));
  $$('.timestamp-delete').forEach(button=>button.onclick=()=>{item.timestamps.splice(Number(button.dataset.index),1);if(save({reason:'timestamp-delete'})){renderTimestamps();toast('タイムスタンプを削除しました')}});
  updateActiveTimestamp(state.player?.getCurrentTime?.()||0);
}
function updateActiveTimestamp(currentTime){
  const rows=$$('.timestamp-row');
  if(!rows.length||state.currentId!==state.selectedId){rows.forEach(row=>row.classList.remove('active'));return}
  let active=-1;rows.forEach((row,index)=>{if(Number(row.dataset.time)<=currentTime)active=index});rows.forEach((row,index)=>row.classList.toggle('active',index===active));
}
function renderAll(){renderChannels();renderPlaylists();renderFilters();renderSongList();renderSelection();renderBrowsePage()}

function openVideoDialog(item=null){
  metadataSeq++;clearTimeout(metadataTimer);
  $('#videoDialogTitle').textContent=item?'ASMRを編集':'ASMRを追加';
  $('#editId').value=item?.id||'';$('#videoUrl').value=item?.url||canonicalYoutubeUrl(item?.videoId)||'';$('#videoTitle').value=item?.title||'';$('#creator').value=item?.creator||'';$('#tags').value=(item?.tags||[]).join(', ');$('#rating').value=String(item?.rating||0);$('#itemVolume').value=String(item?.volume??35);$('#sleepFriendly').checked=!!item?.sleepFriendly;
  setMetadataStatus(item?'URLを変更するとタイトルとチャンネル名を再取得します。':'URLを貼るとタイトルとチャンネル名を自動取得します。');
  $('#videoDialog').showModal();
}
async function saveVideo(event){
  event.preventDefault();
  const url=$('#videoUrl').value.trim(),videoId=ytId(url);if(!videoId)return toast('有効なYouTube URLを入力してください');
  const editId=$('#editId').value,duplicate=state.library.find(item=>item.videoId===videoId&&item.id!==editId);if(duplicate)return toast(`「${duplicate.title}」として登録済みです`);
  if(!$('#videoTitle').value.trim()||!$('#creator').value.trim())await fetchYoutubeMetadata(url,{silent:true});
  const title=$('#videoTitle').value.trim();if(!title)return toast('タイトルを取得できませんでした。タイトルを入力してください');
  const data={url:canonicalYoutubeUrl(videoId),videoId,title:title.slice(0,300),creator:$('#creator').value.trim().slice(0,220),tags:tagList($('#tags').value),rating:Number($('#rating').value),volume:Math.min(100,Math.max(0,Number($('#itemVolume').value)||35)),sleepFriendly:$('#sleepFriendly').checked};
  let changedVideo=false;
  if(editId){
    const item=itemById(editId);if(!item)return toast('編集対象が見つかりません');
    changedVideo=item.videoId!==videoId;
    Object.assign(item,data,{updatedAt:Date.now()});state.selectedId=item.id;
  }else{
    const item={id:uid(),favorite:false,timestamps:[],createdAt:Date.now(),...data};state.library.push(item);state.selectedId=item.id;
  }
  if(!save({reason:editId?'item-edit':'item-create'}))return;
  if(changedVideo)window.asmrtubeYoutubeRuntime?.invalidateItem?.(editId);
  $('#videoDialog').close();renderAll();selectItem(state.selectedId);toast('保存しました');
}
function showUndo(message,onUndo){
  let bar=$('#qualityUndoToast');
  if(!bar){bar=document.createElement('div');bar.id='qualityUndoToast';bar.className='quality-undo-toast';bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');document.body.appendChild(bar)}
  clearTimeout(bar._timer);bar.innerHTML=`<span>${esc(message)}</span><button type="button">元に戻す</button>`;bar.classList.add('show');
  bar.querySelector('button').onclick=()=>{clearTimeout(bar._timer);bar.classList.remove('show');onUndo()};
  bar._timer=setTimeout(()=>bar.classList.remove('show'),8000);
}
function deleteItem(id){
  const item=itemById(id);if(!item||!confirm(`「${item.title}」を削除しますか？`))return;
  try{window.asmrtubeProductShell?.createSnapshot?.('before-delete')}catch{}
  const libraryIndex=state.library.findIndex(value=>value.id===id);
  const memberships=state.playlists.map(playlist=>({playlistId:playlist.id,index:playlist.items.indexOf(id)})).filter(entry=>entry.index>=0);
  const recentIndex=state.recent.indexOf(id),wasSelected=state.selectedId===id,wasCurrent=state.currentId===id;
  const removed=typeof structuredClone==='function'?structuredClone(item):JSON.parse(JSON.stringify(item));
  state.library=state.library.filter(value=>value.id!==id);state.playlists.forEach(playlist=>playlist.items=playlist.items.filter(value=>value!==id));state.recent=state.recent.filter(value=>value!==id);
  if(wasSelected)state.selectedId=null;if(wasCurrent){state.currentId=null;window.asmrtubeYoutubeRuntime?.stopIfCurrent?.(id);resetLoop()}
  if(!save({reason:'item-delete'}))return;
  renderAll();showUndo('ASMRを削除しました',()=>{
    if(state.library.some(value=>value.id===removed.id||value.videoId===removed.videoId))return toast('同じASMRが存在するため復元できません');
    state.library.splice(Math.max(0,Math.min(libraryIndex,state.library.length)),0,removed);
    memberships.forEach(membership=>{const playlist=state.playlists.find(value=>value.id===membership.playlistId);if(playlist)playlist.items.splice(Math.max(0,Math.min(membership.index,playlist.items.length)),0,removed.id)});
    if(recentIndex>=0)state.recent.splice(Math.min(recentIndex,state.recent.length),0,removed.id);
    if(!save({reason:'item-delete-undo'}))return;
    renderAll();if(wasSelected)selectItem(removed.id);toast('削除を元に戻しました');
  });
}
function toggleFavorite(){const item=itemById(state.selectedId);if(!item)return;item.favorite=!item.favorite;if(save({reason:'favorite'}))renderAll()}

function parserApi(){return window.ASMRTubeTimestampParser||null}
function parseTimestampText(text){return parserApi()?.parse(text)||[]}
function guessTags(label,group='',subtitle=''){return parserApi()?.guessTags(label,group,subtitle)||[]}
function openTimestampDialog(){if(!state.selectedId)return;state.parsedTimestamps=[];$('#timestampPaste').value='';$('#timestampPreview').innerHTML='';$('#parseSummary').textContent='';$('#saveTimestampsBtn').disabled=true;$('#timestampDialog').showModal()}
function showTimestampPreview(){
  const rows=state.parsedTimestamps;$('#parseSummary').textContent=`${rows.length}件検出しました`;
  $('#timestampPreview').innerHTML=rows.map((row,index)=>`<div class="preview-row"><input aria-label="時間" data-i="${index}" data-k="time" value="${fmt(row.time)}"><input aria-label="内容" data-i="${index}" data-k="label" value="${attr(row.label)}"></div>`).join('');
  $('#saveTimestampsBtn').disabled=!rows.length;
  $$('#timestampPreview input').forEach(input=>input.onchange=()=>{const index=Number(input.dataset.i);if(input.dataset.k==='time'){const value=parserApi()?.parseTime(input.value)??parseTime(input.value);if(value!=null)state.parsedTimestamps[index].time=value}else{state.parsedTimestamps[index].label=input.value.trim()||'タイムスタンプ';state.parsedTimestamps[index].tags=guessTags(state.parsedTimestamps[index].label,state.parsedTimestamps[index].group||'',state.parsedTimestamps[index].subtitle||'')}});
}
function saveParsedTimestamps(){
  const item=itemById(state.selectedId);if(!item)return;
  const combined=[...(item.timestamps||[])];
  for(const row of state.parsedTimestamps){if(!combined.some(value=>Number(value.time)===Number(row.time)&&String(value.label)===String(row.label)))combined.push({...row})}
  item.timestamps=combined.sort((a,b)=>Number(a.time)-Number(b.time));
  if(!save({reason:'timestamp-import'}))return;
  $('#timestampDialog').close();renderTimestamps();renderFilters();toast('タイムスタンプを追加しました');
}

function markRecent(id){state.recent=[id,...state.recent.filter(value=>value!==id)].slice(0,50);const ok=save({silent:true,reason:'recent'});if(ok)renderCounts();return ok}
async function playItem(id,start=0){
  const item=itemById(id);if(!item)return false;
  state.selectedId=id;$('#volume').value=item.volume??35;renderSongList();renderSelection();
  const runtime=window.asmrtubeYoutubeRuntime;
  if(!runtime){showPlayerStatus('プレイヤーを準備できませんでした','ページを再読み込みしてもう一度試してください。');diag('player.runtime.missing');return false}
  const played=await runtime.playItem(item,start);
  if(played){markRecent(id);diag('player.play',{id:item.id,start:Number(start)||0})}
  return played;
}
function queue(){return filtered()}
function step(dir){const items=queue();if(!items.length)return;let index=items.findIndex(item=>item.id===state.currentId);index=index<0?0:(index+dir+items.length)%items.length;playItem(items[index].id)}
function updatePlayerUi(){
  if(!state.player?.getCurrentTime)return;
  const time=state.player.getCurrentTime()||0,duration=state.player.getDuration()||0;state.duration=duration;$('#timeNow').textContent=fmt(time);$('#timeTotal').textContent=fmt(duration);if(duration)$('#seek').value=Math.round(time/duration*1000);
  if(state.loopA!=null&&state.loopB!=null&&time>=state.loopB)state.player.seekTo(state.loopA,true);
  updateActiveTimestamp(time);
}
function resetLoop(){state.loopA=null;state.loopB=null;$('#loopBtn').textContent='A-B';$('#loopBtn').classList.remove('active');$('#loopBtn').setAttribute('aria-pressed','false');$('#loopStatus').textContent='区間リピート: OFF';$('#loopStatus').classList.remove('active')}
function addToPlaylistPrompt(id){
  if(!state.playlists.length)return toast('先にプレイリストを作成してください');
  const names=state.playlists.map((playlist,index)=>`${index+1}: ${playlist.name}`).join('\n'),number=Number(prompt(`追加先の番号を入力してください\n${names}`)),playlist=state.playlists[number-1];if(!playlist)return;
  if(playlist.items.includes(id))return toast('すでにこのプレイリストに入っています');
  playlist.items.push(id);if(save({reason:'playlist-add'})){renderPlaylists();toast(`${playlist.name}に追加しました`)}
}
function exportJson(){
  const config=window.ASMRTUBE_CONFIG||{};
  const blob=new Blob([JSON.stringify({version:config.schemaVersion||1,appVersion:config.appVersion||null,exportedAt:new Date().toISOString(),library:state.library,playlists:state.playlists,recent:state.recent},null,2)],{type:'application/json'});
  const href=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=href;anchor.download=`asmrtube_backup_${new Date().toISOString().slice(0,10)}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(href),0);
  diag('backup.export',{items:state.library.length});
}
function importJson(file){
  if(!file)return;
  if(file.size>5*1024*1024){toast('JSONファイルが大きすぎます（上限5MB）');diag('import.failure',{reason:'file-too-large',size:file.size});return}
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const prepared=window.ASMRTubeCore.prepareImportedData(JSON.parse(reader.result),{makeId:uid});
      const notes=[prepared.invalid?`無効 ${prepared.invalid}件を除外`:null,prepared.duplicates?`重複 ${prepared.duplicates}件を除外`:null].filter(Boolean).join(' / ');
      if(!confirm(`ASMR ${prepared.library.length}件 / プレイリスト ${prepared.playlists.length}件を読み込みます。\n現在のライブラリは置き換えられます。${notes?`\n${notes}`:''}\n\n続行しますか？`))return;
      try{window.asmrtubeProductShell?.createSnapshot?.('before-import')}catch{}
      window.asmrtubeYoutubeRuntime?.reset?.();
      state.library=prepared.library;state.playlists=prepared.playlists;state.recent=prepared.recent;state.currentId=null;
      state.selectedId=[...state.library].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0]?.id||null;
      if(!save({reason:'import'}))return;
      renderAll();if(state.selectedId)selectItem(state.selectedId);toast(`バックアップを読み込みました（ASMR ${prepared.library.length}件）`);diag('import.success',{items:prepared.library.length,invalid:prepared.invalid,duplicates:prepared.duplicates});
    }catch(error){toast(`読み込みできません: ${error?.message||'対応していないJSONです'}`);diag('import.failure',{message:error?.message||'invalid-json'})}
  };
  reader.onerror=()=>{toast('JSONファイルを読み込めませんでした');diag('import.failure',{reason:'file-read'})};
  reader.readAsText(file);
}

function isInteractiveTarget(target){return !!target?.closest?.('button,a,input,textarea,select,summary,[contenteditable="true"],[role="button"]')}
function setupPlaybackShortcuts(){
  window.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||isInteractiveTarget(event.target)||$('dialog[open]'))return;
    const key=event.key.toLowerCase();
    if(key===' '||key==='k'){event.preventDefault();$('#playBtn')?.click();return}
    if((key==='j'||key==='l')&&state.player?.getCurrentTime){
      event.preventDefault();try{const now=state.player.getCurrentTime()||0,duration=state.player.getDuration()||Infinity;state.player.seekTo(Math.max(0,Math.min(duration,now+(key==='j'?-10:10))),true)}catch{}
    }
  });
}
function setupDialogCloseButtons(){
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-dialog-close]');
    if(!button)return;
    const dialog=button.closest('dialog');
    if(!dialog?.open)return;
    event.preventDefault();
    dialog.close('cancel');
  });
}
function scheduleVolumeSave(){clearTimeout(volumeSaveTimer);volumeSaveTimer=setTimeout(()=>save({silent:true,reason:'volume'}),350)}
function flushVolumeSave(){clearTimeout(volumeSaveTimer);volumeSaveTimer=null;save({silent:true,reason:'volume'})}

$('#addVideoBtn').onclick=()=>openVideoDialog();$('#topAddBtn').onclick=()=>openVideoDialog();$('#emptyAddBtn').onclick=()=>openVideoDialog();$('#videoForm').onsubmit=saveVideo;
$('#videoUrl').addEventListener('input',queueMetadataFetch);$('#videoUrl').addEventListener('paste',()=>setTimeout(queueMetadataFetch,0));$('#metadataRefreshBtn').onclick=()=>fetchYoutubeMetadata($('#videoUrl').value.trim());
$('#topFavBtn').onclick=toggleFavorite;$('#topEditBtn').onclick=()=>{const item=itemById(state.selectedId);if(item)openVideoDialog(item)};
$('#filterBtn').onclick=()=>$('#filters').classList.toggle('hidden');$('#clearFiltersBtn').onclick=()=>{state.filters.clear();renderFilters();renderSongList()};
$('#searchInput').oninput=event=>{state.query=event.target.value.trim();renderSongList()};$('#sortSelect').onchange=()=>{renderSongList();if(!itemById(state.selectedId)){state.selectedId=filtered()[0]?.id||null;renderSelection()}};
$$('.view-btn[data-view]').forEach(button=>button.onclick=()=>{state.currentView=button.dataset.view;state.currentPlaylist=null;state.currentChannel=null;$$('.view-btn').forEach(node=>node.classList.toggle('active',node===button));renderAll()});
$('#timestampImportBtn').onclick=openTimestampDialog;$('#parseTimestampsBtn').onclick=()=>{state.parsedTimestamps=parseTimestampText($('#timestampPaste').value);showTimestampPreview();document.dispatchEvent(new CustomEvent('asmrtube:parser-result',{detail:{rows:state.parsedTimestamps}}));diag('timestamp.parse',{count:state.parsedTimestamps.length})};$('#saveTimestampsBtn').onclick=saveParsedTimestamps;
$('#newPlaylistBtn').onclick=()=>{$('#playlistName').value='';$('#playlistDialog').showModal()};$('#playlistForm').onsubmit=event=>{event.preventDefault();const name=$('#playlistName').value.trim();if(!name)return;state.playlists.push({id:uid(),name:name.slice(0,80),items:[]});if(save({reason:'playlist-create'})){$('#playlistDialog').close();renderPlaylists();toast('プレイリストを作成しました')}};
$('#exportBtn').onclick=exportJson;$('#importInput').onchange=event=>{if(event.target.files[0])importJson(event.target.files[0]);event.target.value=''};
$('#playBtn').onclick=()=>{const item=itemById(state.selectedId);if(!item)return;window.asmrtubeYoutubeRuntime?.toggleSelected?.(item)};
$('#prevBtn').onclick=()=>step(-1);$('#nextBtn').onclick=()=>step(1);
$('#volume').oninput=event=>{const value=Number(event.target.value);window.asmrtubeYoutubeRuntime?.setVolume?.(value);const item=itemById(state.currentId||state.selectedId);if(item){item.volume=value;scheduleVolumeSave()}};$('#volume').onchange=flushVolumeSave;
$('#seek').oninput=event=>{if(state.duration)state.player?.seekTo(Number(event.target.value)/1000*state.duration,true)};
$('#loopBtn').setAttribute('aria-pressed','false');$('#loopBtn').onclick=()=>{if(!state.player||!state.selectedId)return;const time=state.player.getCurrentTime()||0;if(state.loopA==null){state.loopA=time;state.loopB=null;$('#loopBtn').textContent=`A ${fmt(time)}`;$('#loopStatus').textContent=`A: ${fmt(time)} / B: 未設定`;$('#loopStatus').classList.add('active');toast('A地点を設定しました')}else if(state.loopB==null){if(time<=state.loopA)return toast('B地点はAより後にしてください');state.loopB=time;$('#loopBtn').textContent='A-B ON';$('#loopBtn').classList.add('active');$('#loopBtn').setAttribute('aria-pressed','true');$('#loopStatus').textContent=`${fmt(state.loopA)} 〜 ${fmt(state.loopB)}`;toast('区間リピートを開始します')}else{resetLoop();toast('区間リピートを解除しました')}};
$('#sleepBtn').onclick=()=>$('#sleepDialog').showModal();$$('[data-sleep]').forEach(button=>button.onclick=()=>{clearTimeout(state.sleepTimer);state.sleepTimer=null;const min=Number(button.dataset.sleep);if(min){state.sleepTimer=setTimeout(()=>{state.player?.pauseVideo();$('#sleepStatus').textContent='スリープ: 完了';toast('スリープタイマーで停止しました')},min*60000);$('#sleepStatus').textContent=`スリープ: ${min}分`;$('#sleepStatus').classList.add('active');toast(`${min}分後に停止します`)}else{$('#sleepStatus').textContent='スリープ: OFF';$('#sleepStatus').classList.remove('active');toast('スリープタイマーを解除しました')}});
document.addEventListener('asmrtube:appearance-change',event=>{if(event.detail&&Object.prototype.hasOwnProperty.call(event.detail,'showThumbs'))renderSongList()});

load();state.selectedId=filtered()[0]?.id||null;renderAll();setupPlaybackShortcuts();setupDialogCloseButtons();diag('app.ready',{items:state.library.length,selected:!!state.selectedId});
