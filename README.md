# ASMRTube v3.0.1

YouTube上のASMRを自分用に整理・再生し、コメント欄にある多様なタイムスタンプを再利用するための静的Webアプリです。

GitHub Pagesだけで動作し、YouTube Data APIキーは不要です。

- Adopted Guide: `web-project-guide` v1.11.0
- Profiles: `STATIC + DATA + MEDIA + TOOL`
- Visual Direction: `ASMR Media Deck`
- Visual Status: Candidate / User review pending

## v3 Visual

```text
Library rail
→ ASMR Media Deck
→ Sound Map / Timestamps
```

### Library rail

- YouTube作品をタイトル・チャンネル・タグ・評価で整理
- 登録済みのチャンネル名から自動でチャンネル別ライブラリを生成
- Search / View / Channel / Tag / Playlist / Libraryを分けて表示
- LyricTubeで有効だった「分類を左Railから直接選ぶ」構造だけを再利用し、チャンネル・タグを件数付きで選択可能にする
- 選択中作品はAccent line + Surface差で表示
- 「サムネイル非表示」時は画像要素自体を生成せず、不要な画像通信を避ける

### ASMR Media Deck

Player / Transport / Seek / Volumeを1つの再生Deckとして扱います。
YouTube IFrame APIは初期表示では読み込まず、実際に再生を要求したときだけ読み込みます。

### Sound Map

タイムスタンプは長いASMRから聴きたい音を探すNavigationとして扱います。

- 見出し / すべて
- 親 / 子
- 再生中Highlight
- コメントから取込
- 保存済みタイムスタンプ編集

コメント取込は `timestamp-parser.js` の単一Parserを正式経路として使います。

## 設定

Sidebar下の `設定` から独立ページを開きます。

### カラーテーマ

- Moon Violet
- Soft Rose
- Deep Ocean
- Quiet Forest
- Warm Lamp
- Graphite

ThemeはBackground / Surface / Selected state / Player control / Range / Timestamp / Focus stateへ連動します。

### 表示設定

- 明るさ 30〜100%
- コンパクト表示
- サムネイル表示 / 非表示
- 動きを減らす
- 起動時に概要表示

設定は `asmrtube.settings.v1` に保存し、Library dataとは分離します。

## 目的

- ASMRをタイトル・チャンネル・タグ・評価で整理する
- YouTubeコメント欄のタイムスタンプを人ごとの書き方の違いごと吸収する
- 長いASMRから目的の場面へすぐ移動する
- 気に入った区間や前回の再生位置を残す
- チャンネル単位でライブラリを絞り込み、同じチャンネルの作品をまとめて見返せるようにする
- 誤削除・壊れたJSON・保存データ破損へ備える
- GitHub Pagesで軽く、個人利用しやすい状態を維持する

## 崩してはいけない仕様

- YouTube IFrame Playerによる再生
- GitHub Pagesだけで動作する静的構成
- YouTube Data APIキー不要
- ライブラリ保存キー `asmrtube.library.v1`
- 表示設定キー `asmrtube.settings.v1`
- タイムスタンプ表示キー `asmrtube.timestamp.view.v1`
- JSON書き出し / 読み込み
- YouTube動画IDによる重複登録防止
- LyricTube保存データへ干渉しない
- 旧 `{time,label,group,tags}` タイムスタンプを読める
- v1.9以降の汎用タイムスタンプ解析
- 続きから再生 / お気に入り区間 / チャンネル / タイムスタンプ編集

## 保存データ

```text
Library:        asmrtube.library.v1
Settings:       asmrtube.settings.v1
Timestamp view: asmrtube.timestamp.view.v1
Snapshot:       asmrtube.snapshot.v1
Before restore: asmrtube.snapshot.beforeRestore.v1
Diagnostics:    asmrtube.diagnostics.v1
```

Schema Versionは `1` のままです。

Runtime Diagnosticsはローカル専用で、直近120イベントまでを保持します。入力本文、Cookie、Token、認証情報は記録対象にしません。

## Runtime

正式RuntimeはVersion付きPatchを重ねず、次の安定Pathを `index.html` から読み込みます。

```text
app-config.js        Version / Build / Schema metadata
diagnostics.js       Local bounded diagnostics
core-utils.js        YouTube URL / Import validation
timestamp-parser.js  Canonical timestamp parser
app.js               Application state / library UI
youtube-runtime.js   YouTube provider adapter
timestamp-ui.js      Canonical Sound Map renderer
ui-enhancements.js   Help / Data recovery / Dashboard / Mobile shell
library-tools.js     Resume / favorite sections / creator / timestamp editor
appearance.js        Theme / display settings / media ambience
```

`app-quality-v21.js`、`timestamp-polish-v21.js`、`library-tools-v22.js` 等のVersion別Patch Runtimeは本番から退役済みです。現在機能は上記Canonical Runtimeへ統合します。

## データ保護

- `save()` はStorage write失敗を成功扱いせず、最後に保存できた状態へ戻す
- JSON Importは現在データを置換する前に型・件数・ID・YouTube動画ID・参照を検証する
- Import JSON由来の任意HTMLや任意FieldをDOMへ引き継がない
- Import / Delete / Restore前にローカルSnapshotを利用する
- Snapshot Restore後は `asmrtube.snapshot.beforeRestore.v1` から復元前状態へ戻せる
- 重要なデータはJSON Exportを独立Backupとして使用する

## Tests / CI

```text
tests/
├ browser-smoke.html
├ core-utils.test.mjs
├ static-check.mjs
├ timestamp-cases.json
├ timestamp-parser.test.html
└ timestamp-parser.test.mjs
```

GitHub Actions: `.github/workflows/quality-check.yml`

確認対象:

- JavaScript syntax / JSON parse
- index.html local reference
- App / Guide / Schema Version整合
- Canonical Runtime接続とLegacy Patch不在
- Timestamp Parser regression
- YouTube URL / Import validation
- Storage / Recovery / Diagnostics guard
- Headless Chromeによる主要導線Smoke
  - Library render / item select
  - Settings open / close
  - Canonical timestamp import
  - Dashboard exit topbar restore
  - Thumbnail-off image suppression
  - チャンネル自動分類 / チャンネル絞り込み
  - タグ自動分類 / タグ絞り込み
  - Sidebar単一スクロール領域
  - Focused buttonのSpaceキー非横取り

## Visual Source of Truth

```text
theme.css       Color / Surface / Accent tokens
workspace.css   Library / Media Deck / Sound Map composition
settings.css    Dedicated settings page
```

Visual判断・不採用理由・変更条件は `docs/VISUAL_BASELINE.md` と `PROJECT_LEARNINGS.md` を確認してください。

## 現在の確認状態

- Implemented: Yes
- Library Schema change: No
- Existing storage key change: No
- Static / Unit / Browser Smoke: CIで確認
- Mobile real-device: Not verified
- User-facing Visual: User review pending

User-facing Visualは、実際のGitHub Pages画面を見てユーザー確認されるまでは完成扱いにしません。
