# ASMRTube Project Learnings

この文書は、日々の変更履歴ではなく、今後のASMRTube修正で再利用価値が高い判断・失敗・成功を残す長期メモです。

## L-005 localStorage全体保存では別タブの古いStateをそのままCommitしない

### Context

ASMRTubeは `library / playlists / recent` を1つの `asmrtube.library.v1` JSONへまとめて保存する。再生履歴・音量・続き位置のような軽い更新でもJSON全体を書き戻すため、複数タブを開いたまま片方だけ更新すると、もう片方の古いMemory Stateが後から全体を上書きし得る。

### Expected / Actual

- **Expected:** 別タブで追加・編集したASMRを、古いタブの履歴更新や音量保存で消さない
- **Actual:** 旧実装は保存前のCurrent Storage比較も `storage` event同期もなく、最後に書いたタブのSnapshotが無条件で正本になった

### Prevention

- `storage` eventで外部タブの更新をMemoryへ反映する
- 保存直前にCurrent StorageとLast Durable Rawを比較し、不一致なら古いStateを無条件Commitしない
- Canonical write後に読戻し一致を確認する
- 主保存キーとは別の復旧コピーを保持し、欠落・破損時に自動復旧する
- 明示的な削除 / Import以外で全ライブラリが突然0件になるCommitを拒否する

### Regression Guard

Browser Smokeで2タブを開き、片方でASMR追加 → もう片方へ同期 → もう片方で保存しても追加ASMRが残ることを確認する。さらに主保存キー削除 / 壊れたJSONから復旧コピーで再読込できることを確認する。

---

## L-004 Version別Patchの存在と正式Runtime接続を別物として扱う

- **Date:** 2026-09-13
- **Type:** Architecture / Reliability / Security / Testing
- **Guide candidate:** no — `web-project-guide` の F-001 / F-004 / F-008 / F-012 と Architecture / Maintenanceへ既に一般化済み

### Symptom

v3として見えるサイトの内部では、`app.js` の旧Timestamp Parser、`app-quality-v21.js`、`timestamp-polish-v21.js`、`library-tools-v22.js`、v2 Product Shell等が読み込み順で同じ責務を上書きしていた。

その結果、Repositoryには高機能な`timestamp-parser.js`が存在してもコメント取込Buttonは旧Parserを呼び、Version表示も複数Scriptがv2.xへ書き換え得る状態だった。Static Checkは「Fileが接続されていること」を確認していたが、実際の操作がCanonical実装へ到達することまでは保証していなかった。

同時にJSON Importは外部DataのID / videoIdを十分に正規化せずDOM属性へ流し得て、Storage write失敗もUserへ成功と誤認させる余地があった。

### Expected / Actual

- **Expected:** FactごとにOwnerが1つあり、UI操作はCanonical Parser / Player Adapter / Storage Contractを通る
- **Actual:** 後続PatchがGlobal関数を上書きし、どの実装が実際に使われるかがLoad order依存だった

### Trigger / Detection

- Current `index.html` Runtime順と各ScriptのGlobal再定義を突合
- Parser test page / CI wiringを確認
- Import → render、save failure、keyboard shortcut、dashboard exit等をCode pathで追跡

### Root Cause

過去の小改善をVersion別Patchとして追加し続け、正式Ownerへ統合・Retireする工程が不足していた。またStatic Validationが「存在 / 読込」中心で、主要User FlowのBehavioral Oracleを持っていなかった。

### Final Fix

- App Version / Build / Schemaは`app-config.js`だけを正本にする
- Timestamp Importは`timestamp-parser.js`だけをParser Ownerにする
- YouTubeは`youtube-runtime.js`をAdapterとして公開し、`selectItem / playItem`のMonkey Patchを廃止
- `app-quality-v21.js / timestamp-polish-v21.js / library-tools-v22.js`等のVersion別Patch Runtimeを削除し、正式`app.js / timestamp-ui.js / library-tools.js`へ統合
- JSON Importを`core-utils.js`のvalidate / normalize経路へ限定
- Storage write failureを成功扱いせずLast Durable Stateへ戻す
- `MutationObserver`で自前DOMを後付けせず、明示Eventへ接続
- Node regression test + Headless Chrome smokeをCIへ追加し、実操作がCanonical経路へ到達することを確認
- Local bounded Runtime Diagnosticsを追加

### Affected files / systems

`index.html`, `app-config.js`, `app.js`, `core-utils.js`, `diagnostics.js`, `youtube-runtime.js`, `ui-enhancements.js`, `appearance.js`, `library-tools.js`, `timestamp-parser.js`, Tests / CI / Documentation

### Cost / Severity

High。Parser機能欠落、Storage durability、Import security、Version drift、回帰検出不足が同じArchitecture debtから派生していた。

### Regression Guard

- `tests/static-check.mjs` がLegacy Patch Runtimeの再混入とMonkey Patch / Observer再導入をFailにする
- `tests/timestamp-parser.test.mjs` がParserケースをNode上で検証する
- `tests/core-utils.test.mjs` がYouTube URL / Import sanitizationを検証する
- `tests/browser-smoke.html` がLibrary / Settings / Parser / Dashboard / Thumbnail-off / Keyboard flowを実Browserで通す

### Prevention

- 「Fileを作った」「index.htmlから読んだ」をFeature完成の証拠にしない
- 同じ責務のVersion別Scriptを次の標準修正経路にしない
- first-party DOMはRenderer / Event Contractで更新し、MutationObserver Patchを常設しない
- External / Imported Dataはvalidate → normalize → commit後にのみCanonical Dataへ入れる
- Static CheckとBrowser Behaviorを役割分担させる

---

## L-003 Startup observerは自分が変更するDOMを監視しない

- **Date:** 2026-09-13
- **Type:** Reliability / Runtime
- **Guide candidate:** yes — parser startupとMutationObserverの組み合わせで再発し得る

### Symptom

GitHub Pagesで画面自体は表示されるが、Chromeのタブが読み込み完了にならず、再読み込みやDevTools Consoleの入力も反応しにくい状態が継続した。

Chrome Task ManagerではASMRTubeタブのCPUが100%を大きく超える一方、Networkは0だった。

### Root Cause

`app-config.js` がDocument全体を `childList + subtree` で監視する `MutationObserver` を起動し、Observer callback内の `applyVersion()` が `document.title` を毎回書き換えていた。

`app.js` が初期DOMを更新した時点では `.sidebar-version strong` がまだ作られていないためObserverは解除されず、`document.title` の更新が次のMutationを発生させる自己再発火経路になった。これによりMain ThreadがMutation microtask処理に占有され、後続Scriptのparser進行や通常操作が阻害される可能性があった。

前回のYouTube IFrame API対策はNetwork依存をCritical Pathから外す改善としては有効だったが、このCPU loopは別原因だった。

### Final Fix

- `app-config.js` のDocument-wide `MutationObserver` を削除
- Version表示は `DOMContentLoaded` 後のone-shot処理に限定
- YouTube IFrame APIをCritical Pathから外す方針を維持
- Buildを `20260913-1` へ更新
- **2026-09-13追記:** L-004でLocal Adapter自体は通常Runtimeへ統合し、外部YouTube IFrame APIだけをOn-demand loadする構造へ整理した

### Regression Guard

`tests/static-check.mjs` で次を検査する。

- `app-config.js` に `new MutationObserver` を再導入しない
- Startup処理が `DOMContentLoaded` のone-shot経路を維持する
- YouTube IFrame APIは引き続き初期HTMLへ直結しない

### Prevention

- Startup metadata更新のためにDocument全体を監視しない
- Observer callbackから、同じObserver対象へ継続的にDOM mutationを発生させない
- 「タブが読み込み中」の原因調査ではNetwork pendingだけでなくCPU / Main Threadも確認する
- External dependency仮説で直した後も、実ブラウザ症状が消えたことをCompletion条件にする

---

## L-002 Media hierarchyとVisual austerityを混同しない

- **Date:** 2026-09-01
- **Type:** Visual / Product Design
- **Guide candidate:** yes — Validated Directionを別Projectへ適用するときの失敗例として再利用価値あり

### Context

v2.4では、ユーザー評価済みLyricTubeの `VD-001 LyricTube Media Workspace` を参考に、ASMRTubeを高密度Library / Player / TimestampのMedia Workspaceへ整理した。

構造上の意図は妥当だったが、実装ではLyricTube側の「Gradient / Shadow / Cardを減らす」判断まで強く移植し、ASMRTube固有のVisual materialや雰囲気まで弱めた。

ユーザー確認では「シンプルになっただけ」と評価され、全体評価は **40 / 100**。v2.4 Visual Candidateは採用しない。

さらに確認すると、Repositoryに存在する `ui-enhancements.js / timestamp-ui.js / app-config.js` が当時の `index.html` から正式Runtimeへ接続されておらず、作成済みUIが実サイトで働かない構造的Regressionもあった。

### Decision

Media Workspaceの基本Hierarchyは残してよいが、**Visual identityはASMRTubeのContent / Taskから作る**。

v3では次をSignatureにする。

```text
Library rail
→ ASMR Media Deck
→ Sound Map / Timestamps
```

- 選択中YouTubeサムネイルをPlayer周辺の弱いAmbient visualとして利用する
- Player、再生操作、Seek、Volumeを1つのMedia Deckとして扱う
- TimestampはLyricsの代用品ではなく「音の場所を探すSound Map」として扱う
- Themeをユーザー選択可能にし、AccentだけでなくBackground / Surface / Selected stateも連動させる
- Card / Shadow / Gradientは全面禁止せず、Media focusや独立Surfaceなど意味がある場所で使う
- 「シンプルにした量」を品質指標にしない

### Regression guard

- `theme.css / workspace.css / settings.css` をv3 Visual Source of Truthとして明示する
- `tests/static-check.mjs` でCSSのLoad orderを確認する
- `app-config.js / timestamp-ui.js / ui-enhancements.js / appearance.js` 等の正式Runtime接続をCIで確認する
- 設定Themeは既存 `asmrtube.settings.v1` 内の任意項目とし、Library Schemaへ混ぜない
- User-facing UIの大変更は、Static ValidationだけでVisual完成扱いにしない

### Do not do

- User Validatedな別Projectの「減らしたもの」まで、そのまま成功要因だと決めつけない
- `minimal / simple / clean` をVisual品質そのものとして扱わない
- Repositoryにファイルが存在するだけで実装済みと扱わない。`index.html` のRuntime Pathまで確認する
- 色違いだけで新しいDesign Directionを作ったことにしない

---

## L-001 Media workspaceではPlayerとTimelineを主役にする

- **Date:** 2026-08-31
- **Type:** Visual / Architecture
- **Guide candidate:** no — `web-project-guide` の `VD-001 LyricTube Media Workspace` に既に一般化済み
- **Status:** Partially superseded by L-002

### Context

ASMRTube v2.0ではLyricTube、Lineup Lab、VReviewの見た目を組み合わせ、Gradient背景、Dashboard Hero、Stat Card、複数のCard surfaceを追加した。

機能整理には役立ったが、ASMRを日常的に「選ぶ → 再生する → タイムスタンプへ飛ぶ」という主要Taskに対しては、補助UIのVisual weightがPlayer / Timestampと競合しやすかった。

### Decision

ASMRTubeは `MEDIA + TOOL` として、LyricTubeでユーザー評価済みの `VD-001 LyricTube Media Workspace` をVisual Referenceとして使う。

```text
Library rail
→ Player / current ASMR
→ Timestamp reading surface
```

再利用するのは具体的な色や幅ではなく、次の構造。

- 左Libraryを高密度だが明確なRailにする
- Playerを最も強いSurfaceにする
- TimestampをLyrics同様のReading Surfaceとして扱う
- Transport / Volume / Item info等は同じ強さのCard群にせずSection / Dividerで整理する
- Active stateは大きなAccent塗りよりSurface差 + Accent lineを優先する
- Gradient / Glow / ShadowはHierarchyの代わりに使わない

### Revision after v2.4 user review

L-001の「Hierarchy」の判断は維持するが、「LyricTubeの装飾削減もASMRTubeに適する」という解釈は撤回する。

ASMRTubeではASMR Artwork / Theme / Player deck等、TaskとContentに由来するVisual identityを別途持たせる。

### Regression guard

- Visualを意味のある範囲で変更した場合は、最終状態を実ブラウザまたはScreenshotで確認する。確認できない場合は作業報告へ `Visual: Not verified` と記録する
- 見た目を合わせるためにStorage key / Timestamp schema / Player behaviorを変更しない
