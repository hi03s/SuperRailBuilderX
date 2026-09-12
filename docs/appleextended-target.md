# AppleExtended target

SRBXはAppleExtended commit `ca255fd`を現在の対応基準とする。AE固有処理は`src/appleextended/assets/minecraft/scripts/superrailbuilderx`へ隔離し、AE本体に同等APIが追加されたものから削除する。

## 結論

- AEにはKaizPatchXの自動分割レール（論理RailMap、Section core、分割計画・再構築API）がない。
- AEでSRBXが新設するレールは、AE側に自動分割が実装されるまで常に通常レールとする。
- 通常レール生成はRTM 1.12.2の`BlockMarker.createRail(...)`で実装できるため、SRBX側の一時compatで補完する。
- RailPosition自由座標はAEの`setPosition(x, y, z)`と永続化される`offsetX/Y/Z`を使う。
- 自動分割構造の読み書きが必要な処理は、推測で代替せず安全に無効化する。

## KaizPatchXにありAEにない処理

| 分類 | KaizPatchX | AppleExtended `ca255fd` | SRBXでの扱い |
| --- | --- | --- | --- |
| 自由端点 | `RailPosition#setPosition` | `setPosition`と`offsetX/Y/Z`あり | AE APIを直接使用 |
| 自動分割判定 | `RailProperty.autoSplit` | 対応する公開機能なし | AEでは設定せず通常レール固定 |
| 分割計画 | `RailChunkSectioner.split(...)` | クラス/APIなし | 使用しない |
| Section core | `TileEntityLargeRailSectionCore` | クラス/APIなし | 作成・判定しない |
| 論理レール | `getLogicalRailPositions`、Section group/core一覧 | 対応APIなし | 通常レールの`getRailPositions`と単一RailMapだけ扱う |
| 論理レール占有判定 | `isLogicalRailOccupied` | 対応APIなし | 通常レールの`isTrainOnRail`を使用 |
| レール設定型 | `RailProperty` | `ResourceStateRail` | AE compat内で変換境界を吸収 |
| レールブロック名 | `largeRailBase0` / `largeRailCore0` | `largeRailBase` / `largeRailCore` | AEの標準生成APIへ委譲 |
| ワールド座標API | 1.7.10の`x,y,z`引数 | 1.12.2の`BlockPos`中心 | AE compat内で`BlockPos`化 |
| RPのNBT復元 | `readFromNBT(nbt)` | `readFromNBT(nbt, destination)` | AE compat内でcloneを実装 |

KaizPatchX版`SRBXApiCompat`には、上記のほか、道床衝突検査、Section core位置調整、複数Sectionの生成・撤去・Undo、論理レール単位の同期処理がある。これらは自動分割構造と密結合しているためAEへそのまま移植できない。

## SRBX側の一時互換モジュール

`AppleExtendedRailCompat.ts`は、AE本体に不足するが標準RTM APIの組み合わせで安全に補える処理を置く場所とする。現時点では次を実装する。

- builder1／複線コピーが呼ぶ`createBuilderRail`を通常レール生成へ接続する。
- 自由点または既設レール端点からAE形式の`RailPosition`を作る。
- 手持ちレール、複製元レール、接続先レール、fallbackの順序を尊重して`ResourceStateRail`を選ぶ。
- `BlockMarker.createRail(...)`へ生成を委譲し、AE標準の道床・コア配置規則を使う。
- 生成直後のcore座標と識別キーを返し、`RailMap.breakRail(...)`によるUndoを提供する。
- 複製元の座標・識別キーが変化していた場合は生成を拒否する。

このモジュールではKaizPatchXのクラス名を参照しない。AE側に同等の公開APIが追加された際は、対応メソッドの呼び出し先をAE APIへ置き換え、不要になった補完コードを同じ変更で削除する。

## 対応範囲

- 通常レールのRailPosition端点移動、クライアント同期、Undo
- レール生成Aの通常レール生成とUndo
- `createBuilderRail`を共有する通常レール複製経路
- AE固有APIの型生成を検査するcompile-onlyサンプル
- `Loader.isModLoaded("appleextended")`による`mc1122`より優先した実行時選択
- その他の差分がない1.12.2処理は`compatFallbackTarget: "mc1122"`を利用

## 未対応

- 既設レールを撤去・再生成する複数レール平行移動
- レール分割と分岐生成
- 自動分割Section NBTを更新するカント整形
- 自動分割レールの選択、生成、削除、Undo

これらは現在`mc1122`安全スタブへフォールバックし、ワールドを書き換えず`unsupported_target`等を返す。通常レールだけで安全に実装できる処理は、今後も`AppleExtendedRailCompat.ts`へ追加する。

## ビルド確認

```sh
pnpm gen
pnpm build
```

`src/appleextended/.../appleextended_build_test.ts`は実行用スクリプトではなく、AEの`setPosition`とoffsetフィールドが型スキャンされたことを確認するサンプルである。

AEターゲットのMCP mappingsは、同じMinecraft 1.12.2環境の`mc1122`ターゲットと同じ`stable/39`を使用する。`snapshot/20171003`ではRetroFuturaGradleの`generateForgeSrgMappings`が、存在しない`joined.exc`と`joined.srg`を入力として要求して停止する。

AE commit `ca255fd`ではJitPack向けpublicationが追加された。2026-09-10のローカル検証でJitPack成果物の解決、AE型スキャン、4ターゲットの`pnpm gen`と`pnpm build`が成功した。初回取得時にJitPackのHTTP 429とタイムアウトが発生した場合は再試行する。

## AE側に追加されれば削除できる補完

1. 通常レールを、任意の自由座標RailPositionとモデル状態から検証付きで生成・Undoする公開API。
2. 道床の回収・再配置、RailMap再生成、保存、クライアント同期を一括で行う公開API。
3. 論理RailMap、構成Section一覧、論理レールの占有判定・削除・再生成API。

2がない現在の端点移動はAEのRailPositionとRailMapを直接更新する。大きな移動では既設道床の範囲外へ線形が出る可能性があるため、バックアップ済みワールドで小さいオフセットから検証する。
