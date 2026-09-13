# AppleExtended target

SRBXはAppleExtended commit `9df86c2`を対応基準とする。AE固有処理は`src/appleextended/assets/minecraft/scripts/superrailbuilderx`へ隔離し、AE本体に同等APIが追加されたものから削除する。

## 最新AEで利用する機能

2026-09-13時点のAEには、以前の基準`ca255fd`以降に次が追加された。

- `ResourceStateRail.autoSplit`と、`BlockMarker.createRail(...)`によるチャンク単位の自動分割生成
- `TileEntityLargeRailSectionCore`、`RailChunkSectioner`、`RailSection`
- `getLogicalRailPositions`、`getRailGroupCorePositions`、`isSameLogicalRail`
- `isLogicalRailOccupied`、`breakLogicalRail`
- 通常レールの端点と道床を更新する`relocateRail`

このため、レール生成A・複線コピー・分割・分岐で新設するレールはAEの`autoSplit`設定を尊重する。短区間や競合回避のため共有側が`forceNormal`を指定した場合だけ、複製したモデル状態の`autoSplit`を無効にする。

## KaizPatchXとの差分とSRBX側の補完

| 分類 | 最新AppleExtended | SRBXでの扱い |
| --- | --- | --- |
| 自由端点 | `setPosition`とoffset NBTあり | AE APIを使用 |
| 自動分割・論理レール | AE本体に実装済み | AE APIへ委譲 |
| 論理レール削除・占有判定 | AE本体に実装済み | AE APIへ委譲 |
| 通常レール移設 | `relocateRail`あり | AE APIへ委譲 |
| 分割レール移設 | group全体を移設する公開APIなし | 破損防止のため無効化 |
| 任意位置分割・分岐生成 | SRBX相当の高水準APIなし | AE compatで論理端点から撤去・再生成 |
| カント整形 | RailPositionのカント値あり | AE compatで論理端点を更新し、Section group全体へ同期 |
| レール設定型 | `ResourceStateRail` | compat境界で扱う |
| RPのNBT復元 | `readFromNBT(nbt, destination)` | compatでcloneする |

## 一時互換モジュール

- `AppleExtendedRailCompat.ts`: 論理レール識別、端点解決、モデル状態の複製、AE標準生成、論理レールUndoを担当する。
- `AppleExtendedRailToolsCompat.ts`: 任意位置分割、中央・端点分岐、カント整形と各Undoを担当する。
- `SRBXApiCompat.compat.ts`: 共通ツールとAE APIの境界を担当する。

分割・分岐は変更前の論理RailPosition、モデル、信号、サブレールを退避し、途中失敗時とUndo時に再生成する。生成先は最新AEの自動分割機構へ委譲する。カント整形はSection coreの物理端点を直接上書きせず、全group coreの`RailSection` NBTに同じ論理端点を書き戻してRailMapを再構築する。

## 対応範囲と制限

対応範囲:

- 通常レールの端点移動、クライアント同期、Undo
- レール生成A、複線コピー、自動分割生成、Undo
- 通常・自動分割レールの分割、中央/端点分岐、カント整形とUndo
- `Loader.isModLoaded("appleextended")`による`mc1122`より優先した実行時選択
- その他の差分がない1.12.2処理の`compatFallbackTarget: "mc1122"`利用

未対応:

- 自動分割レールの端点移動と複数レール平行移動。AEの`relocateRail`はSection group向けにoverrideされていないため、通常コアだけに使用する。

Minecraft実機では、生成・分割・分岐後にチャンク境界をまたぐSectionが一つの論理レールとして選択・走行・Undoできること、カント適用が全Sectionへ反映されることを確認する。

## ビルド確認

```sh
pnpm gen
pnpm build
```

AEターゲットのMCP mappingsは`stable/39`を使用する。`9df86c2`への更新後、2026-09-13に4ターゲットの型生成とビルドが成功した。JitPackの初回取得でHTTP 429やタイムアウトが発生した場合は再試行する。

## AE側に追加されれば削除できる補完

1. 任意位置分割・分岐・Undoを扱う公開API。
2. 論理RailPositionのカント更新とSection group同期を一括で行う公開API。
3. Section group全体の端点・道床を安全に移設する`relocateRail`相当API。
