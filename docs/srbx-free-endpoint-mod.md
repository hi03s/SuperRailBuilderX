# SRBXMod: KaizPatch完全自由点の実験ブランチ

対象: Minecraft 1.7.10 / Forge 10.13.4.1614 / KaizPatchX 1.10.4。
ブランチ: `feature/kaizpatch-free-endpoint-mod`。AEの走行パッチは保留。

## 配布と導入

`SRBXMod-0.1.0-experimental.jar`はサーバーcoremodとSRBXモデルパックを内包する。
サーバーのmodsへ導入する。既存SRBXパックと同時導入しない。
クライアントにSRBXModのJavaパッチは必須ではない（FMLの`acceptableRemoteVersions="*"`、独自パケットなし）。
描画・ツール操作にはクライアント側にも同版のSRBXモデルパック資産が必要。JavaパッチなしのZIPは`pnpm zip`で生成できる。
シングルプレイでは統合サーバー側だけが補正される。

## 仕組みとCrossTie互換性

`EntityBogie.getRail(DDD)`の先頭へ小さなhookを追加する。現在コアとmapが存続し、予測位置が現在mapの端点内側・線形近傍にある場合だけ現在コアを維持する。
端点を越えた場合はKaizPatchの`findCrossedConnectedCore`・分岐選択・セクション接続・`resetRailObj`へ戻す。道床所有先、台車フィールド、パケット、コントローラーを上書きしない。
削除・再生成済みmap、未ロードコア、遠い線形、異なる高さ、非有限座標、未対応バイトコードでは標準処理へ戻る。

CrossTie commit `cf3ce92`を調査した。`EntityBogieChunkCacheMixin`のloadChunk redirect、`EntityBogiePhysicsMixin`のジョイント音、`RailTransitionSearchRangeMixin`の探索範囲overwriteを削除・置換しない。
元getRail全体と既存stack-map frameを保持し、専用の早期returnだけ追加する。CrossTie同時導入の実機検証は別途必要。

SRBXのKaizPatch側だけ自由点ポリシーを使い、端点・分割点を境界へ丸めない。AEの境界制約は維持する。
サーバーでhook有効化を確認できない場合は自由点の生成・移動・分割・カント・分岐適用を`srbxmod_required`で拒否する。
既存ワールドの端点を一括変換しない。

## ビルド

```sh
pnpm install --frozen-lockfile
pnpm gen
pnpm build
python3 mod/build.py --test
pnpm zip
```

`.npmrc`のgradle-java-homeを実在するJDKへ設定するか、`npm_config_gradle_java_home`で上書きする。
Javaパッチだけの検証は`python3 mod/build.py --core-only --test`。core-only JARにはSRBX資産がなく、配布用JARとは区別する。
ビルドはJDKのjavac（なければ固定版ECJ）とSHA-256検証済みForge/LaunchWrapper/ASM依存を使い、Java 8バイトコードを出力する。依存ModのクラスはJARへ同梱しない。
GitHub Actions `free-endpoint-mod.yml`は対象コードのブランチpushまたは手動実行で全ターゲット生成・ビルド・回帰・内包JAR・クライアントZIPを生成する。
実KaizPatch JARの変換検証は`python3 mod/build.py --core-only --test --kaizpatch-jar /path/to/KaizPatchX.jar`で行う。

## 実機確認

1. バックアップ済みワールドでSRBXからブロック内側の共有端点を作り、座標が境界へ丸められないことを確認する。
2. 起動ログの`[SRBXMod] KaizPatch EntityBogie hook installed`を確認する。
3. 旧道床を共有する自由点を両方向に微速で通過し、旧mapへの往復が止まることをデバッグ車両ログで確認する。
4. 停止・後退、0.20m/5.86m区間、曲線、勾配、カント、分岐切替、交差、複数列車、再ログイン・チャンク再読込、移動・分割・Undoを確認する。
5. CrossTieなし/ありを比較する。サーバーのみModを入れ、クライアントはモデルパックZIPだけで接続・走行・ツールを確認する。

このパッチは現在mapへの誤った戻りを抑える。KaizPatchが接続先自体を見つけられない配置、同ブロック内でのコア配置競合、複数の極短区間を一tickで越える問題まで保証するものではない。実機ログを基に追加対応する。
