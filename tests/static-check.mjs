import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const failures=[];
const fail=message=>failures.push(message);
const exists=relative=>fs.existsSync(path.join(root,relative));
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

const html=read('index.html');
const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1]);
for(const ref of refs){
  if(/^(?:https?:|data:|#)/i.test(ref))continue;
  const clean=ref.split(/[?#]/)[0].replace(/^\.\//,'');
  if(clean&&!exists(clean))fail(`index.html reference is missing: ${clean}`);
}

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='.git'||entry.name==='node_modules')continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(entry.name.endsWith('.json')){
      try{JSON.parse(fs.readFileSync(full,'utf8'))}catch(error){fail(`invalid JSON: ${path.relative(root,full)} (${error.message})`)}
    }
  }
}
walk(root);

const required=[
  'app-config.js','diagnostics.js','core-utils.js','timestamp-parser.js','app.js','youtube-runtime.js','timestamp-ui.js','ui-enhancements.js','library-tools.js','appearance.js',
  'styles.css','asmr-overrides.css','ui-base-v2.css','product-v2.css','timestamp-ui.css','quality.css','library-tools.css','theme.css','workspace.css','settings.css',
  'project-meta.json','README.md','PROJECT_LEARNINGS.md','docs/VISUAL_BASELINE.md','作業報告書.md',
  'tests/static-check.mjs','tests/core-utils.test.mjs','tests/timestamp-parser.test.mjs','tests/browser-smoke.html'
];
for(const file of required)if(!exists(file))fail(`required file is missing: ${file}`);
const retired=['app-quality-v21.js','timestamp-polish-v21.js','library-tools-v22.js','quality-v21.css','library-tools-v22.css'];
for(const file of retired)if(exists(file))fail(`retired patch runtime must be removed: ${file}`);

const meta=JSON.parse(read('project-meta.json'));
const config=read('app-config.js'),app=read('app.js'),runtime=read('youtube-runtime.js'),appearance=read('appearance.js'),shell=read('ui-enhancements.js'),libraryTools=read('library-tools.js'),core=read('core-utils.js'),diagnostics=read('diagnostics.js'),timestampUi=read('timestamp-ui.js');
const configString=key=>config.match(new RegExp(`${key}:\\s*['\"]([^'\"]+)['\"]`))?.[1]||null;
const configNumber=key=>{const value=config.match(new RegExp(`${key}:\\s*(\\d+)`))?.[1];return value==null?null:Number(value)};
if(configString('appVersion')!==meta.appVersion)fail(`appVersion mismatch: config=${configString('appVersion')} meta=${meta.appVersion}`);
if(configString('guideVersion')!==meta.guideVersion)fail(`guideVersion mismatch: config=${configString('guideVersion')} meta=${meta.guideVersion}`);
if(configNumber('schemaVersion')!==meta.schemaVersion)fail(`schemaVersion mismatch: config=${configNumber('schemaVersion')} meta=${meta.schemaVersion}`);
if(!html.includes('<title>ASMRTube</title>'))fail('index.html must not hardcode the app version in the title');
if(/ASMRTube v2\.[0-9]/.test([app,runtime,appearance,shell].join('\n')))fail('active runtime still contains a legacy v2 display version');

const scripts=['app-config.js','diagnostics.js','core-utils.js','timestamp-parser.js','app.js','youtube-runtime.js','timestamp-ui.js','ui-enhancements.js','library-tools.js','appearance.js'];
for(const script of scripts)if(!html.includes(`<script src="${script}"></script>`))fail(`canonical runtime is not connected: ${script}`);
for(let i=1;i<scripts.length;i++)if(html.indexOf(scripts[i])<html.indexOf(scripts[i-1]))fail(`runtime order is wrong: ${scripts[i-1]} must load before ${scripts[i]}`);
for(const ref of refs.filter(value=>!value.startsWith('http')))if(/[?&](?:v|b)=/i.test(ref))fail(`local runtime must not use manually maintained cache-busting versions: ${ref}`);

for(const css of ['quality.css','library-tools.css','theme.css','workspace.css','settings.css'])if(!html.includes(`href="${css}"`))fail(`canonical visual layer is not connected: ${css}`);
if(html.indexOf('theme.css')<html.indexOf('library-tools.css'))fail('theme.css must load after compatibility/product/library CSS');
if(html.indexOf('workspace.css')<html.indexOf('theme.css'))fail('workspace.css must load after theme.css');
if(html.indexOf('settings.css')<html.indexOf('workspace.css'))fail('settings.css must load after workspace.css');

if(config.includes('MutationObserver'))fail('app-config.js must remain one-shot and observer-free');
if(config.includes('createElement(\'script\')')||config.includes('youtube-runtime.js'))fail('app-config.js must own metadata only, not runtime loading');
if(appearance.includes('MutationObserver')||shell.includes('MutationObserver'))fail('first-party UI must use explicit events instead of MutationObserver patching');
if(runtime.includes('selectItem=function')||runtime.includes('playItem=async function')||runtime.includes('const baseSelectItem'))fail('YouTube runtime must be an adapter, not a monkey patch');
if(!runtime.includes("script.src='https://www.youtube.com/iframe_api'"))fail('YouTube external API must remain on-demand');
if(html.includes('https://www.youtube.com/iframe_api'))fail('index.html must not eagerly load YouTube iframe API');
if(!app.includes('window.asmrtubeYoutubeRuntime?.selectItem?.'))fail('app selection must delegate to the YouTube adapter');
if(!app.includes('runtime.playItem(item,start)'))fail('app playback must delegate to the YouTube adapter');

if(!app.includes('window.ASMRTubeTimestampParser'))fail('app import flow must use the canonical timestamp parser');
if(/function parseTimestampText\(text\)\{\s*const out=\[\]/.test(app))fail('legacy duplicate timestamp parser remains in app.js');
if(!timestampUi.includes('window.renderTimestamps=renderTimestampsV3'))fail('timestamp-ui must own the canonical renderer');
if(!core.includes('function prepareImportedData'))fail('validated import normalization is missing');
if(!core.includes("host==='youtube.com'||host.endsWith('.youtube.com')"))fail('strict YouTube host validation is missing');
if(!app.includes('ASMRTubeCore.prepareImportedData'))fail('JSON import is not routed through validated normalization');
if(!app.includes('if(file.size>5*1024*1024)'))fail('JSON import file-size guard is missing');

if(!app.includes("asmrtube:save-failed")||!app.includes('restoreDurableState()'))fail('save failure rollback/feedback is missing');
if(!app.includes('scheduleVolumeSave()')||!app.includes('flushVolumeSave()'))fail('volume persistence must be debounced and flushed');
if(!app.includes('invalidateItem?.(editId)'))fail('changing a video URL must invalidate loaded player state');
if(!app.includes("target?.closest?.('button,a,input,textarea,select"))fail('playback shortcuts must ignore focused interactive controls');
if(!app.includes('function thumbnailsEnabled()')||!app.includes("showThumbs!==false"))fail('thumbnail suppression must avoid creating image requests, including first render');
if(!app.includes('function setupDialogCloseButtons()')||!app.includes("[data-dialog-close]"))fail('dialog close controls must bypass form submission/validation');
for(const [name,source] of [['index.html',html],['library-tools.js',libraryTools],['ui-enhancements.js',shell]]){
  if(/<button\s+value=["']cancel["']\s+class=["'](?:icon-btn subtle|ghost-btn|primary-btn)["']/.test(source))fail(`${name} still has a close/cancel button that submits its dialog form`);
}
if(!html.includes('data-view="resume"')||!html.includes('id="countResume"')||!app.includes("state.currentView==='resume'"))fail('resume navigation/view is missing');
if(!libraryTools.includes("document.documentElement.dataset.thumbs!=='0'")||!libraryTools.includes('showThumbs?`<img src='))fail('creator library must honor thumbnail suppression without creating image requests');
if(!shell.includes('PRE_RESTORE_KEY')||!shell.includes('snapshotUndoRestoreBtn'))fail('pre-restore recovery UI is missing');
if(!shell.includes('renderSelection()'))fail('dashboard exit must restore canonical topbar selection');

if(!diagnostics.includes('MAX_EVENTS=120')||!diagnostics.includes("unhandledrejection"))fail('bounded runtime diagnostics/error capture is missing');
if(!diagnostics.includes('asmrtube.diagnostics.v1'))fail('diagnostics storage key is missing');

if(failures.length){console.error('\nASMRTube static check failed:\n');failures.forEach(message=>console.error(`- ${message}`));process.exit(1)}
console.log(`ASMRTube static check passed: ${refs.length} references, canonical runtime ownership, parser/import/storage/security/recovery guards and diagnostics verified.`);
