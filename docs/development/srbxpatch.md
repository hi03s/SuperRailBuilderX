# SRBXPatchの開発と探索処理

AE本体で独自に再実装するためのアルゴリズム・判定理由・参考値・検証条件は[走行先判定設計](appleextended-rail-resolution-design.md)を参照。

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

## 台車のレール探索と軽量化比較

対象: main（旧専用ブランチの試作を統合） / KaizPatchX v1.10.4。調査日: 2026-10-10。

### 既存実装の役割

SRBXPatchは`EntityBogie#getRail(DDD)`先頭にサーバー限定hookを追加する。元の探索コードを削除しない。

1. 台車のcurrentRailObj/currentRailMap・split/prevPosIndexと移動予測座標を読む。
2. コア/tileとmapの存続を検証する。自由端点付近だけ、端点の接線平面に対して予測位置が内側か判定する。
3. 現map上の前回位置が台車から0.25m以内、予測点が線形から0.125m以内、高さがrailHeight+yOffsetから0.75m以内なら現コアを保持する。
4. 端点を越えた場合や条件不一致はnullを返し、KaizPatchの標準探索へ戻す。

従来は3で`ceil((movement+0.25)*360)`を前回indexの前後に取り、全候補のgetRailPosを反射呼出しして最短距離を求めていた。これは自由点内側で旧道床の所有コアへ戻る問題への対策であり、遷移先のコア探索とは別の仕事である。

KaizPatchの標準順序は、端点越え接続探索 → 予測位置の道床tile/core → 必要時の接続探索。自動分割では隣接セクションを優先する。最後にresetRailObjが選択map・入場index・分岐・onChangeRailを処理する。

一次ソース: [v1.10.4 RailTransitionResolver](https://github.com/Kai-Z-JP/KaizPatchX/blob/v1.10.4/src/main/java/jp/kaiz/kaizpatch/rtm/rail/util/RailTransitionResolver.kt)、[RailPosition](https://github.com/Kai-Z-JP/KaizPatchX/blob/v1.10.4/src/main/java/jp/ngt/rtm/rail/util/RailPosition.java)。

### Directionの背合わせでどこまで分かるか

背合わせ条件は通常`other.direction == ((endpoint.direction+4)&7)`。ただしDirectionは8方向の標識値で、正確な接線はanchorYaw/線形側にある。

標準の隣接セルは`getNeighborPos()`が計算する。X/Zは精密端点座標に`REVISION[direction]`を加えてfloor、YはblockYを使う。単に所有ブロックを1個ずらす計算ではない。

完全自由点ではoffsetにより両端点が同じセル内へ入り得る。さらに道床tileの所有先は旧コアを保持することがあり、自動分割コアは配置競合を避けて別セルへ配置され得る。したがって背合わせだけでは遷移先tile/coreを一意に決められない。精密XYZ・候補mapのcanConnect・分岐/セクションの扱いも必要になる。

KaizPatchは**既にgetNeighborPosのセルを最初に調べる**。見つからない場合だけ接線方向の0.25m刻み/最大2mの候補セルとY候補を調べる。CrossTie併用時はその探索範囲overwriteを維持する。

### 比較と採用結果

同じJava17 JVM・模擬台車/直線mapでwarmup後、50,000回を7回測定し中央値を比較した。旧hookは実装コミットc76801fのソースをそのまま別ClassLoaderで動かす。実MinecraftのTPS測定ではない。

| 比較対象                                   | 旧/標準                                               | 試作/採用                                             | 判断                      |
| ------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------- | ------------------------- |
| 自由端点の内側照合                         | getRailPos 114回、215.344ms                           | 2回、86.453ms                                         | 約60%短縮。採用           |
| 端点から十分離れた台車のhook               | tile/map存続照合を先に実行                            | index/移動量で先に除外。tile読出し0回                 | 採用                      |
| 接続先探索（正しく隣接セルで見つかる場合） | 旧hook＋KaizPatch通常コア探索のJava模擬処理 118.691ms | Direction/精密XYZ照合を追加する反射直接探索 170.934ms | 約44%増。直接探索は不採用 |

接続先比較のJava模擬処理は通常コア・直線・正の終端通過のみを対象とし、チャンク読込はno-op。実際のKotlin実装、CrossTie、ワールドI/Oの速度を表す数字ではない。未検証の実ゲーム優位性を理由に既存探索を置き換えない。

採用版は、前回indexから接線方向の移動量を使って候補indexを1個推定し、getRailPosを照合する。前回位置照合と合わせて2回になる。推定点が予測位置から1/360m以内で高さも合えば現コアを保持する。推定が外れた曲線・不均一なパラメーターのmapでは従来の全候補照合へfallbackする。端点越えでは追加tile探索をせずnativeへ戻す。

Direction直接探索は試作比較用patchとして`mod/benchmarks/direction-prototype.patch`にのみ残す。配布JARには入らない。nativeのgetNeighborPos優先、CrossTie探索範囲、loadChunk redirect、resetRailObjは維持する。

### 再現と検証

採用版実装`3e889f2`は[Actions #38031947718](https://github.com/hi03s/SuperRailBuilderX/actions/runs/38031947718)で全4ターゲットbuild・全回帰・Java行動/バイトコードテストに成功。内包JARとクライアントZIPを再生成し、Java8・依存/テスト/試作非同梱・資産一致を確認済み。

```sh
python3 mod/benchmark.py
```

git・patch・Javaが必要。旧hookと不採用試作を.cache内へ展開/コンパイルし、本番ソースを変更せず比較する。時間は環境・JIT・GCによって変わる。安定した指標はサンプル数とtile読出し回数である。

Java回帰テストは、内側/両方向端点越え、短区間、平行線・高低差・client除外・再生成map・未ロード/置換コアに加え、2サンプル、中央の早期除外、推定が外れた非線形mapでの全候補fallbackを確認する。

実機では従来版/採用版の同じ線路・車両・台車数・速度で、自由点付近と中央部の走行、CrossTieあり/なし、分岐・Undo・サーバーのみMod導入を比較する。未実施のためTPS改善やマルチプレイの実動作保証とは扱わない。

## 通信と実行側

Javaパッチはサーバーワールドだけで動作し、独自通信は追加しない。接続条件はJARなしのクライアントも許可する設計（`acceptableRemoteVersions="*"`）だが、SRBXパックを使うクライアントにもJARを導入する運用を基本とする。シングルプレイは統合サーバーがあるため、そのMinecraftへJARを導入する。JARなしクライアントの接続と実機走行は未検証。
