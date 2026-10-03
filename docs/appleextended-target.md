# AppleExtended target

SRBXはAppleExtended正式リリース`v2.5.3`（タグcommit `6f74d99`）を対応基準とする。AE固有処理は`src/appleextended/assets/minecraft/scripts/superrailbuilderx`へ隔離し、AE本体に同等APIが追加されたものから削除する。

## 最新AEで利用する機能

AE v2.5.3には、初期基準`ca255fd`以降に次が追加された。従来基準`9df86c2`から既存の生成・論理レール・移設・NBT APIのシグネチャ変更はなく、SRBXの補完処理は継続利用できる。自動分割には最小Section長2 mの制限が追加され、ポイント転換APIも追加された。

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

AE v2.5.3の標準include読込はJava正規表現の置換文字列を保護せず、バックスラッシュを消費する。描画patchは関数の`toString()`からコードを生成し、除外パスは文字コード92のsplit/joinで正規化する。KaizPatchXは置換文字列を保護するが、両方式で同じ補正動作となることを配布JSのテストで確認する。

## 対応範囲と制限

対応範囲:

- 通常レールの端点移動、クライアント同期、Undo
- レール生成A、複線コピー、自動分割生成、Undo
- 通常・自動分割レールの分割、中央/端点分岐、カント整形とUndo
- `Loader.isModLoaded("applelib")`による`mc1122`より優先した実行時選択
- その他の差分がない1.12.2処理の`compatFallbackTarget: "mc1122"`利用

未対応:

- 自動分割レールの端点移動と複数レール平行移動。AEの`relocateRail`はSection group向けにoverrideされていないため、通常コアだけに使用する。

Minecraft実機では、生成・分割・分岐後にチャンク境界をまたぐSectionが一つの論理レールとして選択・走行・Undoできること、カント適用が全Sectionへ反映されることを確認する。

## ビルド確認

```sh
pnpm gen
pnpm build
```

AEターゲットのMCP mappingsは`stable/39`を使用し、依存は`com.github.Kirtmuna:AppleExtended:v2.5.3`とする。rtm-ts 0.12.0は改造・パッチせず使用する。2026-10-03にJitPack取得が復旧し、標準の`pnpm gen`と`pnpm build`が全4ターゲットで成功した。描画patchの`pnpm test:rail-patch`も成功。型定義・JARはGitへ追加しない。Minecraft実機検証は別途必要。

## AE側に追加されれば削除できる補完

1. 任意位置分割・分岐・Undoを扱う公開API。
2. 論理RailPositionのカント更新とSection group同期を一括で行う公開API。
3. Section group全体の端点・道床を安全に移設する`relocateRail`相当API。
