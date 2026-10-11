# SRBXPatch: 自由端点接続の暫定サーバーパッチ

mainはKaizPatch/AEとも完全自由点仕様を使用する。生成・複線・分割・移動・カント整形・分岐生成で端点をブロック境界へ丸めない。本家の走行接続対応まで、SRBXパックと独立したSRBXPatchを併用する。

## 配布と導入

| 環境 | パッチMod |
| --- | --- |
| Minecraft 1.7.10 / KaizPatchX 1.10.4 | `SRBXPatch-v1.0-1.7.10.jar` |
| Minecraft 1.12.2 / AppleExtended 2.5.3 | `SRBXPatch-v1.0-1.12.2.jar` |

対象JARをサーバーの`mods`へ入れ、SRBXモデルパックZIPを従来どおりサーバーとクライアントへ別途導入する。JARにはパック資産を含めない。旧試作`SRBXMod-0.1.0-experimental.jar`を置き換え、パックを重複配置しない。

Javaパッチはサーバーワールドだけで動作し、独自通信は追加しない。クライアントへのJAR導入を必須にしない設計（`acceptableRemoteVersions="*"`）。シングルプレイは統合サーバーがあるため、そのMinecraftへJARを導入する。JARなしクライアントの接続と実機走行は未検証。

通常RTM向けmc1710/mc1122は変更しない。KaizPatch/AE向けはサーバーでパッチの有効化を確認できない場合、生成・移動・分割・カント・分岐の書き込みを`srbxpatch_required`で拒否する。既存線を自動変換しない。

## 仕組みと制限

`EntityBogie.getRail(DDD)`先頭へhookを加え、元の命令・呼び出し・stack-map frameを保持する。クライアント、未対応バイトコード、不正状態、曖昧な候補は標準処理へ戻す。反射情報だけをクラス単位でキャッシュし、world/core/map/台車はキャッシュしない。

- KaizPatch: 生存する現在mapの端点内側・線形近傍では現在コアを保持し、旧道床への誤復帰を抑える。端点越えはnativeの接続探索・分岐選択・セクション接続・resetRailObjへ委譲する。CrossTieが対象とするcallsiteを保持するが、併用実機確認は必要。
- AE: 生存する現在mapの線形上では途中の重複区間も含めて現在コアを保持する。自動分割の内部境界は同一グループの隣接コアを優先し、それ以外の境界端点越えは標準処理へ戻し、内部自由端点越え後はロード済み周辺道床から候補を探し、精密端点（XZ差1 mm以内/Y差3 cm以内）、進行方向、予測位置、分岐の選択中経路を検証する。遷移自体は既存resetRailObjへ返し、残りの移動予測を標準処理へ渡す。

削除/再生成済みmap、未ロードコア、前回サンプルから離れた台車、不正な高さ・座標を対象にしない。同一セルのコア競合、複数の極短区間を1 Tickで越える場合は保証しない。Kaizのnative探索で発見できない配置、AEの周辺探索範囲に次コアの道床がない配置も対象外。実機走行に基づく判定条件調整が必要。

## ビルドと検証

```sh
pnpm install --frozen-lockfile
pnpm gen
pnpm build
python3 mod/build.py --target all --test
pnpm exec rtmx zip
```

Gradle用JDKは`.npmrc`または`npm_config_gradle_java_home`で指定する。Javaビルドはjavac（なければ固定版ECJ）とSHA-256検証付きForge/LaunchWrapper/ASM依存を使い、Java 8形式を出力する。依存Modやテストクラスは同梱しない。`--target 1.7.10`/`--target 1.12.2`で片方を選べる。旧`--core-only`は互換引数として受け付けるが、常にパッチのみのJARになる。

実際の対象JARへの変換検証:

```sh
python3 mod/build.py --test --kaizpatch-jar /path/to/KaizPatchX.jar --appleextended-jar /path/to/AppleExtended.jar
```

ローカルでは全4build、スクリプト回帰、両Java挙動テスト、実Kaiz 1.10.4/AE 2.5.3へのASM BasicVerifier検証に成功。Java8形式、資産/依存/テスト非同梱、テストあり/なしビルドの再現性も確認済み。GitHub Actionsはmain/GUIブランチpushでZIPと2 JARを生成し、タグのworkflowは3ファイルをDraftへ添付する。Publishは手動。

## 実機確認

1. バックアップ済みワールドで新版ZIPと対象JARを導入し、起動ログの`[SRBXPatch]`とhook installedを確認する。
2. ブロック内側の共有端点を作り、座標が境界へ丸められないこと、全6ツールの適用/Undoを確認する。
3. 通常車両で旧道床を共有する接続を両方向から微速通過し、停止/引き戻し/瞬間的加速がないか確認する。
4. 停止/後退、短区間、曲線、勾配、カント、分岐切替、複数車両、再ログイン、チャンク再読込を確認する。
5. KaizではCrossTieなし/ありを比較する。サーバーだけJAR、クライアントはZIPだけの接続と操作も確認する。

問題時は操作順、時刻、方向、接続座標とlogs/latest.log（Kaizはlogs/fml-client-latest.log）、専用サーバーログを共有する。デバッグ車両の登録JSONは除去済みで、モデル/テクスチャ/診断スクリプトは再利用用に残している。

## 実機フィードバック（2026-10-10）

開発者がKaizPatchでCrossTieあり/なしの動作を確認。個別の全試験項目やJARなしクライアント接続が完了したとは扱わない。

AEはSRBXPatchの大文字依存宣言required-after:RTMがForge 1.12.2に拒否され、Mod初期化前に停止。実AEのRTMCore注釈のmodid=rtmを確認し、AE側だけrequired-after:rtmへ修正した。JavaテストにMod注釈と実AE依存IDの一致検証を追加し、挙動/変換検証も成功。Kaiz 1.7.10側の依存宣言は維持。

修正版SRBXPatch-v1.0-1.12.2.jarのSHA256はeb148069ec39843c3b81a1dc3e96a37e5731f1648f941aed21905964bb7f48ec。同名旧JARを置き換え、AE起動ログのhook installedと両方向微速走行を再確認し、問題時はlogs/latest.logを共有する。パックZIPとKaiz JARは今回変更していない。


2026-10-11: AE重複区間の吸着抑止を試作しJARを更新。実機確認待ち。[仕様・制約・診断・確認手順](appleextended-overlap-rail-patch.md)。
