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
| 通常レール移設 | `relocateRail`あり | 元状態を退避して論理レールを撤去・再生成 |
| 分割レール移設 | group全体を移設する公開APIなし | 全memberの存在・占有を検証し、group全体を撤去・再生成 |
| 任意位置分割・分岐生成 | SRBX相当の高水準APIなし | AE compatで論理端点から撤去・再生成 |
| カント整形 | RailPositionのカント値あり | AE compatで論理端点を更新し、Section group全体へ同期 |
| レール設定型 | `ResourceStateRail` | compat境界で扱う |
| RPのNBT復元 | `readFromNBT(nbt, destination)` | compatでcloneする |

## 一時互換モジュール

- `AppleExtendedRailCompat.ts`: 論理レール識別、端点解決、モデル状態の複製、AE標準生成、論理レールUndoを担当する。
- `AppleExtendedRailToolsCompat.ts`: 任意位置分割、中央・端点分岐、カント整形と各Undoを担当する。
- `AppleExtendedRailMoveCompat.ts`: 通常・自動分割レールの端点/全体移動、元状態退避、失敗時復元と更新コア通知を担当する。
- `AppleExtendedRailProtection.ts`: 生成前の既設道床の所有先を退避し、生成・失敗後にも所有先を維持する。既設道床を新コアへ置換するとAEの`breakBlock`が元の論理レールを削除するため、コア所有ブロックは別途保護する。
- `AppleExtendedSwitchCompat.ts`: 分岐線形を事前検証し、公開配置・NBT APIで生成する。`BlockMarker`のnull player失敗経路とprotectedフィールドへの代入を使わない。
- `SRBXApiCompat.compat.ts`: 共通ツールとAE APIの境界を担当する。

分割・分岐は変更前の論理RailPosition、モデル、信号、サブレールを退避し、途中失敗時とUndo時に再生成する。生成先は最新AEの自動分割機構へ委譲する。カント整形はSection coreの物理端点を直接上書きせず、全group coreの`RailSection` NBTに同じ論理端点を書き戻してRailMapを再構築する。

AE v2.5.3の標準include読込はJava正規表現の置換文字列を保護せず、バックスラッシュを消費する。描画patchは関数の`toString()`からコードを生成し、除外パスは文字コード92のsplit/joinで正規化する。KaizPatchXは置換文字列を保護するが、両方式で同じ補正動作となることを配布JSのテストで確認する。

## 対応範囲と制限

対応範囲:

- 通常・自動分割レールの端点/全体移動、クライアント同期、Undo（実機再検証待ち）
- レール生成A、複線コピー、自動分割生成、Undo
- 通常・自動分割レールの分割、中央/端点分岐、カント整形とUndo
- `Loader.isModLoaded("applelib")`による`mc1122`より優先した実行時選択
- その他の差分がない1.12.2処理の`compatFallbackTarget: "mc1122"`利用

未対応:

- 分岐レール自体の移動。通常・自動分割レールの移動ではSectionの物理`relocateRail`を使わず、論理レール全体を再生成する。変更前に端点・キー・占有・group memberを確認し、失敗時は元の端点・モデル・信号・サブレールを復元する。

2026-10-03の再テストで、生成コアの確認位置がAEと一致しない問題を修正した。AEは2端点の`blockY`が等しい場合に2番目をコア所有端点に選ぶ。生成・分割・複製・復元はこの同じ規則でコアとUndoキーを取得する。Sectionの選択は論理端点を使用し、builderAの分岐端点選択用の理由コードも共通APIに合わせる。

Undo入力は左右Ctrlに対応するSRBX固有ラッパーを使い、履歴の可否フラグがfalseなら要求を送らない。単回Undoの成功時はクライアントでも即座にフラグを下げ、カントの複数履歴はサーバーの残履歴判定を維持する。サーバーのUndo記録を最終判定にし、分割・カントUndoは全対象の変更・占有を先に検証する。19:38～19:39の実機ログで分割/移動Undo成功を確認済み。

19:37～19:42の再テストを受け、自動分割の生成確認は`RailChunkSectioner`が決めた実際の最初のコア位置を使う。Sectionコア所有位置が既設の道床/コアと競合する場合は、モデルを複製して通常レールへフォールバックし、通常コアの所有位置も保護する。両端とも保護対象で安全なコア位置を選べない場合は生成前に拒否し、`creation blocked`を出す。道床所有先の退避は全生成・分割・復元・移動・分岐に適用する。

カントの`NBTTagCompound#setTag`は第2引数を`NBTBase`として渡し、配布JSがSRGメソッドへ変換されることを検証する。分岐の`RailPosition.switchType`はJava finalフィールドのため、`SwitchType` NBTから再生成する。分岐コアのprotectedなバージョンは正規NBTで初期化する。

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
