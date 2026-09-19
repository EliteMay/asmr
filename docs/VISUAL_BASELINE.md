# ASMRTube Visual Baseline

## Current Status

- Candidate date: 2026-09-01
- App Version: `3.0.0`
- Design Direction: **ASMR Media Deck**
- Guide: `web-project-guide` v1.11.0
- Project shape: `STATIC + DATA + MEDIA + TOOL`
- Validation state: **Implementation in progress / User visual validation pending**

この文書はv3以降のVisual比較基準です。

ユーザーがGitHub Pages上の実画面を確認し、Visual Directionを肯定するまでは **User Validated** へ昇格しません。

## Rejected Candidate: v2.4

v2.4は `VD-001 LyricTube Media Workspace` を強く参考にしたCandidateでした。

ユーザー確認結果:

- 「シンプルになっただけ」と評価
- 全体評価 **40 / 100**
- 基礎から考え直す方針へ変更

したがってv2.4はVisual Baselineとして採用しません。

失敗の詳細は `PROJECT_LEARNINGS.md` の `L-002` を正本とします。

## v3 Design Concept

**ASMRを選んだ瞬間、その作品が画面の中心になる個人用Media Deck。**

```text
Library rail
→ ASMR Media Deck
→ Sound Map / Timestamps
```

LyricTubeから再利用するのは「LibraryとMediaと補助情報の役割を明確にする」というHierarchyだけです。

ASMRTube固有のIdentityは次で作ります。

- 選択中ASMRのYouTube Artwork
- Player中心のMedia Deck
- 音の場所を探すSound Map
- 寝る前に使いやすいDark theme
- ユーザー選択可能な複数Palette

## Canonical Visual Files

| Role | Source of Truth |
|---|---|
| Theme tokens / palette | `theme.css` |
| Media Deck / Library / Sound Map composition | `workspace.css` |
| Dedicated settings page | `settings.css` |
| Theme / brightness / display behavior | `appearance.js` |
| Timestamp interaction hierarchy | `timestamp-ui.js` / `timestamp-ui.css` |
| Legacy compatibility | `styles.css` / `asmr-overrides.css` / `ui-base-v2.css` / `product-v2.css` |
| Feature-specific compatibility | `quality.css` / `library-tools.css` |

v3 Visual Source of TruthはLegacy CSSより後に読み込みます。

## Visual Invariants

### 1. Media is the focal point

- YouTube PlayerがFirst ViewのPrimary contentであること。
- Player / Transport / Seek / Volumeを別々の無関係なCardへ分裂させないこと。
- 選択中ArtworkはMedia contextとして使い、本文可読性を妨げる強さにしないこと。

### 2. Library remains practical

- Search / View / Playlist / Libraryの区別が一目で分かること。
- サムネイルが視覚的な探索を助けること。
- Active itemは色だけでなくSurface / Border / Accent lineでも区別すること。
- Compact modeでもタイトルと配信者を識別できること。

### 3. Sound Map is navigation, not decoration

- Timestamp panelは目的の音へ移動するためのNavigation surfaceとして扱う。
- 現在位置、見出し、親子関係が読めること。
- `見出し / すべて` を正式Runtimeで提供すること。
- 長いTimestamp一覧でもPlayerより強いVisual weightにしないこと。

### 4. Theme system

最低限次のThemeを選択可能にする。

- Moon Violet
- Soft Rose
- Deep Ocean
- Quiet Forest
- Warm Lamp
- Graphite

ThemeはAccentだけでなく、Page background / Sidebar / Surface / Selected stateへ連動する。

Theme変更で `asmrtube.library.v1` を書き換えない。

### 5. Dedicated settings page

設定は主要なProduct機能として独立Pageを持つ。

最低限:

- Color theme
- Brightness
- Compact display
- Thumbnail visibility
- Reduced motion
- Start dashboard
- Data management入口
- Help入口

### 6. Effects policy

Gradient / Shadow / Blur / Rounded Surfaceを全面禁止しない。

使用目的を限定する。

- Artwork blur: 選択中Media context
- Player shadow: Primary media surfaceのElevation
- Accent glow: 局所的なSelected / Focus補助
- Rounded surface: Media Deck / Settings card等、独立SurfaceのShape language

Hierarchyの代わりにEffectを大量追加しない。

### 7. Responsive

- Desktop: Library + Media Deck + Sound Mapを同時に把握できること。
- Narrow desktop: Player幅を優先し、Sound Mapを過度に狭くしないこと。
- Mobile: Sidebar drawer + `Player → Info → Sound Map` の順に再構成すること。
- 320px級の幅で意図しない全体横スクロールを出さないこと。

## Runtime Invariants

Visual fileが存在するだけで完成扱いしません。

`index.html` から最低限次を正式に読み込むこと。

```text
app-config.js
diagnostics.js
core-utils.js
timestamp-parser.js
app.js
youtube-runtime.js
timestamp-ui.js
ui-enhancements.js
library-tools.js
appearance.js
```

`tests/static-check.mjs` でRuntime PathとLoad orderをGuardします。

## Validation Gate

v3をVisual完成扱いするには次が必要です。

1. JavaScript / JSON / Static Validation成功
2. GitHub Pages deployment成功
3. First Viewを実ブラウザまたはScreenshotで確認
4. Player / Library / TimestampのHierarchy確認
5. 設定ページで複数Themeが切り替わることを確認
6. Theme変更後のReloadでも設定が残ることを確認
7. Mobileまたは狭いViewportで主要操作が消えないことを確認
8. ユーザー評価

現時点でUser visual validationがないため、このBaselineは **Candidate** です。
