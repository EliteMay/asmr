// ASMRTube timestamp parser — multi-stage parser for diverse YouTube timestamp/comment formats.
(function(){
  'use strict';

  const PARENT_MARKERS=new Set(['▷','▶','►','▸','▹','▻','➤','➜','⏵']);
  const CHILD_MARKERS=new Set(['┗','└','├','↳','↪','╰','┖','┕']);
  let lastStats={total:0,groups:0,parents:0,children:0,bilingual:0,urlDerived:0,inferred:0};

  function normalizeSource(value){
    return String(value||'')
      .replace(/\r\n?/g,'\n')
      .replace(/\\&/g,'&')
      .replace(/(?<=\d)：(?=\d)/g,':')
      .replace(/\u00a0/g,' ');
  }
  function parseFlexibleTime(value){
    const s=String(value||'').trim().toLowerCase();
    if(!s)return null;
    if(/^\d+(?:\.\d+)?s?$/.test(s))return Math.floor(parseFloat(s));
    const unit=s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if(unit&&(unit[1]||unit[2]||unit[3]))return Number(unit[1]||0)*3600+Number(unit[2]||0)*60+Number(unit[3]||0);
    const parts=s.split(':').map(Number);
    if(parts.some(Number.isNaN))return null;
    if(parts.length===2){if(parts[1]>=60)return null;return parts[0]*60+parts[1]}
    if(parts.length===3){if(parts[1]>=60||parts[2]>=60)return null;return parts[0]*3600+parts[1]*60+parts[2]}
    return null;
  }
  function isEmojiUrl(url){return /(?:yt3\.googleusercontent\.com|youtube\.com\/s\/gaming\/emoji)/i.test(String(url||''))}
  function markdownToText(value){
    return String(value||'').replace(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,(all,text,url)=>{
      if(isEmojiUrl(url))return ` ⟪EMOJI:${text}⟫ `;
      return text;
    });
  }
  function cleanText(value,{keepEmojiFallback=true}={}){
    let s=markdownToText(value);
    const emoji=[];
    s=s.replace(/⟪EMOJI:([^⟫]*)⟫/g,(_,name)=>{if(String(name).trim())emoji.push(String(name).trim());return ' '});
    s=s.replace(/https?:\/\/\S+/g,' ')
      .replace(/^[\s>・•●○■□★☆◆◇▼▽#]+/,'')
      .replace(/^[-–—―｜|:：]+\s*/,'')
      .replace(/\s*[-–—―｜|]+$/,'')
      .replace(/[ \t\u3000]+/g,' ')
      .trim();
    s=s.replace(/^□+/,'').replace(/□{2,}/g,'').trim();
    if(!s&&keepEmojiFallback&&emoji.length)s=emoji.join(' ');
    return s;
  }
  function cleanHeading(value){
    const s=cleanText(value).replace(/[：:]$/,'').trim();
    if(!s||s.length>48)return '';
    if(/タイムスタンプ|timestamp|チャプター|chapter|コメント|comment/i.test(s))return '';
    if(/^\d+(?::\d+){1,2}$/.test(s))return '';
    if(/^[\d\s👍❤♥♡□]+$/.test(s))return '';
    if(/[。！？!?]$/.test(s)&&s.length>14)return '';
    return s;
  }
  function isChildLabel(label){
    const s=cleanText(label);
    if(!s||s.length>18)return false;
    return /^(右|左|右耳|左耳|両耳|両方|左右|交互|R|L|right|left|開始|start|前半|後半|奥|手前|浅め|深め|高速|低速|強め|弱め|片耳|両側|正面|真横)$/i.test(s);
  }
  function splitBilingual(label){
    const s=String(label||'').trim(),jp=/[\u3040-\u30ff\u3400-\u9fff]/;
    if(!jp.test(s))return {label:s,subtitle:''};
    for(let i=1;i<s.length;i++){
      if(!/[A-Za-z]/.test(s[i]))continue;
      const left=s.slice(0,i).trim(),right=s.slice(i).trim();
      if(!jp.test(left)||right.length<4)continue;
      if(!/^[A-Za-z][A-Za-z0-9 +/&'’.,!?()\-]*$/.test(right))continue;
      if(/^w+$/i.test(right))continue;
      return {label:left,subtitle:right};
    }
    return {label:s,subtitle:''};
  }
  function timestampTags(label,group='',subtitle=''){
    const source=`${group} ${label} ${subtitle}`.trim(),tags=[];
    const add=t=>{if(!tags.includes(t))tags.push(t)};
    const rules=[
      [/耳かき|耳掻き|ear\s*(?:pick|cleaning)/i,'耳かき'],[/綿棒|cotton\s*swab/i,'綿棒'],[/指耳かき/,'指耳かき'],[/梵天|ぼんてん|fluffy\s*ear\s*pick/i,'梵天'],
      [/囁|ささやき|whisper/i,'囁き'],[/吐息|breath/i,'吐息'],[/耳ふ[ー～ぅう]|耳吹|ear\s*blow/i,'耳ふー'],[/オノマトペ|onomatopoeia/i,'オノマトペ'],
      [/タッピング|tapping/i,'タッピング'],[/マッサージ|massage/i,'マッサージ'],[/添い寝/,'添い寝'],[/睡眠|sleep/i,'睡眠'],[/耳塞ぎ|ear\s*cupping/i,'耳塞ぎ'],[/心音|heartbeat/i,'心音'],[/リップ音|lip\s*sound|mouth\s*sound/i,'リップ音'],
      [/(^|[\s　・／/()])右(?:耳)?($|[\s　・／/()])/,'右耳'],[/(^|[\s　・／/()])左(?:耳)?($|[\s　・／/()])/,'左耳'],[/両耳|両方|両側/,'両耳'],[/交互/,'交互']
    ];
    rules.forEach(([re,tag])=>{if(re.test(source))add(tag)});
    return tags;
  }
  function markerBefore(source,index){
    const pre=source.slice(Math.max(0,index-10),index);
    const m=pre.match(/(┗|└|├|↳|↪|╰|┖|┕|▷|▶|►|▸|▹|▻|➤|➜|⏵)\s*$/);
    if(!m)return {marker:'',type:'none',start:index};
    const marker=m[1];
    return {marker,type:PARENT_MARKERS.has(marker)?'parent':CHILD_MARKERS.has(marker)?'child':'none',start:index-m[0].length};
  }
  function findVisibleTimestampTokens(source){
    const time='\\d{1,3}:\\d{2}(?::\\d{2})?';
    const re=new RegExp(`\\[(${time})\\]\\((https?:\\/\\/[^)]+)\\)|([\\(【\\[]?)(${time})([\\)】\\]]?)`,'g');
    const tokens=[];let m;
    while((m=re.exec(source))){
      const timeText=m[1]||m[4],seconds=parseFlexibleTime(timeText);
      if(seconds==null)continue;
      const rawStart=m.index,before=source[rawStart-1]||'';
      if(!m[1]&&/[A-Za-z0-9?&=/#]/.test(before))continue;
      const mark=markerBefore(source,rawStart);
      tokens.push({token:timeText,time:seconds,start:mark.start,timeStart:rawStart,end:re.lastIndex,marker:mark.marker,markerType:mark.type,mode:m[1]?'markdown':'bare'});
    }
    return tokens;
  }
  function urlTime(url){
    try{
      const u=new URL(url);
      let value=u.searchParams.get('t')||u.searchParams.get('start');
      if(!value&&u.hash){const hm=u.hash.match(/(?:^#|[?&])t=([^&]+)/);value=hm?.[1]||''}
      return parseFlexibleTime(value);
    }catch{return null}
  }
  function findUrlTimestampTokens(source){
    const re=/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s)]+|youtu\.be\/[^\s)]+)/gi;
    const out=[];let m;
    while((m=re.exec(source))){
      const time=urlTime(m[0]);if(time==null)continue;
      const mark=markerBefore(source,m.index);
      out.push({token:String(time),time,start:mark.start,timeStart:m.index,end:re.lastIndex,marker:mark.marker,markerType:mark.type,mode:'url'});
    }
    return out;
  }
  function splitSegment(segment){
    return markdownToText(segment).replace(/\r/g,'').split(/\n+|[ \t\u3000]{2,}/).map(v=>cleanText(v)).filter(Boolean);
  }
  function prefixHeading(prefix){
    const pieces=splitSegment(prefix);if(!pieces.length)return '';
    return cleanHeading(pieces[pieces.length-1]);
  }
  function makeEntries(source,tokens){
    return tokens.map((token,i)=>{
      const next=tokens[i+1],segment=source.slice(token.end,next?next.start:source.length),pieces=splitSegment(segment);
      const explicitLabel=cleanText(pieces[0]||''),cleaned=explicitLabel||'タイムスタンプ',bi=splitBilingual(cleaned);
      const candidate=pieces.length>=2?cleanHeading(pieces[pieces.length-1]):'';
      return {...token,label:bi.label||'タイムスタンプ',subtitle:bi.subtitle,candidate,hasExplicitLabel:!!explicitLabel};
    });
  }
  function dedupe(rows){
    const sorted=[...rows].sort((a,b)=>a.time-b.time),out=[];
    const norm=s=>String(s||'').toLowerCase().replace(/[\s　・,，.。!！?？()（）「」『』\-–—―｜|/／]+/g,'');
    for(const row of sorted){
      const same=out.find(x=>Math.abs(Number(x.time)-Number(row.time))<=1&&norm(x.label)===norm(row.label)&&String(x.group||'')===String(row.group||'')&&String(x.role||'')===String(row.role||''));
      if(!same){out.push(row);continue}
      if((row.confidence||0)>(same.confidence||0))Object.assign(same,row);
    }
    return out;
  }
  function parseTimestampText(text){
    const source=normalizeSource(text);
    let tokens=findVisibleTimestampTokens(source);
    if(!tokens.length)tokens=findUrlTimestampTokens(source);
    if(!tokens.length){lastStats={total:0,groups:0,parents:0,children:0,bilingual:0,urlDerived:0,inferred:0};return []}

    const entries=makeEntries(source,tokens),out=[];
    let section='',sectionKind='',activeParent=null,lastNonChild=null;
    const firstPrefix=prefixHeading(source.slice(0,tokens[0].start));
    if(firstPrefix){
      if(entries[0]?.markerType==='parent'||entries[0]?.markerType==='child'){section=firstPrefix;sectionKind='explicit'}
      else if(isChildLabel(entries[0]?.label)){section=firstPrefix;sectionKind='side'}
    }

    for(let i=0;i<entries.length;i++){
      const entry=entries[i],next=entries[i+1];
      if(entry.mode==='bare'&&!entry.hasExplicitLabel)continue;
      let role='item',group='',parentTime=null,parentLabel='',inferred=false;
      if(sectionKind==='side'&&!isChildLabel(entry.label)&&entry.markerType==='none'){section='';sectionKind='';activeParent=null}
      if(entry.markerType==='parent'){role='parent';group=sectionKind==='explicit'?section:''}
      else if(entry.markerType==='child'){
        role='child';group=section;
        const parent=activeParent||lastNonChild;
        if(parent){parentTime=parent.time;parentLabel=parent.label}
      }else if(sectionKind==='side'&&section&&isChildLabel(entry.label)){role='child';group=section;inferred=true}
      else if(sectionKind==='explicit'&&section)group=section;

      const confidence=entry.mode==='url'?0.72:entry.markerType!=='none'?0.99:inferred?0.84:0.94;
      const row={
        time:entry.time,label:entry.label,tags:timestampTags(entry.label,group,entry.subtitle),group,role,
        depth:role==='child'&&parentTime!=null?1:0,confidence,
        sourceStyle:entry.markerType!=='none'?entry.markerType:entry.mode
      };
      if(entry.subtitle)row.subtitle=entry.subtitle;
      if(parentTime!=null){row.parentTime=parentTime;row.parentLabel=parentLabel}
      out.push(row);

      if(role==='parent')activeParent=row;
      else if(role==='item'){activeParent=null;lastNonChild=row}
      if(role==='parent')lastNonChild=row;

      if(entry.candidate&&next){
        if(next.markerType==='parent'||next.markerType==='child'){section=entry.candidate;sectionKind='explicit';activeParent=null}
        else if(next.markerType==='none'&&isChildLabel(next.label)){section=entry.candidate;sectionKind='side';activeParent=null}
      }else if(sectionKind==='side'){
        const nextContinues=!!next&&next.markerType==='none'&&isChildLabel(next.label);
        if(!nextContinues){section='';sectionKind='';activeParent=null}
      }
    }

    const rows=dedupe(out);
    lastStats={
      total:rows.length,
      groups:new Set(rows.map(r=>r.group).filter(Boolean)).size,
      parents:rows.filter(r=>r.role==='parent').length,
      children:rows.filter(r=>r.role==='child').length,
      bilingual:rows.filter(r=>r.subtitle).length,
      urlDerived:rows.filter(r=>r.sourceStyle==='url').length,
      inferred:rows.filter(r=>(r.confidence||0)<0.9).length
    };
    return rows;
  }
  function stats(){return {...lastStats}}

  window.ASMRTubeTimestampParser=Object.freeze({
    parse:parseTimestampText,
    guessTags:timestampTags,
    parseTime:parseFlexibleTime,
    splitBilingual,
    stats
  });

  // Compatibility read API used by the existing product-shell insights UI.
  window.getTimestampParseStats=stats;
})();
