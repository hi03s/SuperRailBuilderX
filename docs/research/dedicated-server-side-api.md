# 専用サーバーでのSideOnly型解決エラー

## 現在の結論（2026-10-24、ローカルCodex）

**実機確認済み：2026-10-24、開発者からAE/Kaizのシングル・マルチを含む全問題の解決報告を受領。SRBX側の修正確認は完了した。以下の再確認手順は今後の回帰用であり、未完了事項ではない。**

AEマルチ環境での生成失敗は、AE v2.5.4に含まれるNGTLibのブロック基底クラスのtooltipメソッドに、専用サーバーに存在しないクライアント型が残ることと整合する。実AE JARとJava 8で型解決失敗を再現した。SRBX側には、ブロックのメソッド一覧を解決させず必要なAPIだけを呼ぶ回避を追加した。**Mod本体の注釈漏れは上流での修正対象**であり、報告は開発者が行う。rtm-ts・参照ツールキット・JAR・SRBXPatchは変更していない。

KaizPatchX 1.10.4の同じクラス階層にはAEと同じtooltip型の問題は見つからなかった。一方、両環境のSRBXカント更新には、サーバーからクライアント専用の再描画フィールドへ代入する箇所があったため、クライアントワールドだけで実行するよう修正した。Kaizの非strict Nashornでは存在しないフィールドへの代入が黙殺されるため、これを今回のクラッシュ原因と断定しない。

その後のKaizマルチ再確認では、**ツール切り替えがModelPackManager内のIModelNGT型解決で失敗する別件**が見つかった。下記のとおりSRBXのKaiz/通常1.7.10側へ公開MethodHandlesによる回避を追加した。tooltip問題がないという先の判断は、モデル管理APIの安全性を保証するものではない。

## Kaizマルチのツール切り替え失敗

提出された`fml-server-latest.log`の13:50:14・13:50:20・13:50:22・13:50:27に、`[SuperRailBuilderX wheel] switch failed: java.lang.NoClassDefFoundError: jp/ngt/ngtlib/renderer/model/IModelNGT`と`result=internal_error`がある。所有者/騎乗者は一致し、生成要求は成功しているため、ホイール要求の未送信や版照合による拒否ではない。

KaizPatchX 1.10.4の実JARの`ModelPackManager`には、`setModelFile(String,IModelNGT)`・`getModelFile(String)`・`loadModel(...)`があり、前2者にはclient限定注釈がない。SRBXの切り替え前の`ModelPackManager.INSTANCE.getModelSet(...)`をNashornが解決すると、無関係な描画用メソッドの型も列挙され、専用サーバーで欠落する。モデル管理クラス自身の宣言なので、`getDeclaredMethod`でも全宣言型の解決が発生して回避できない。

SRBXは共通ヘルパー`SRBXServerModelLookup`を用意し、Kaizと通常1.7.10のcompatから呼ぶ。Java標準の`MethodHandles.publicLookup()`で、公開`INSTANCE`フィールド、`getModelSet(String,String):ModelSetBase`、`ModelSetBase.isDummy():boolean`の正確なシグネチャだけを解決する。private API・`setAccessible`・クライアント型の追加は使わない。元と同じモデル種別・名前で検索し、null/ダミーならモデル名を変更しない。有効時の`setModelName`と`getModelSet`による更新は既存のまま維持する。

AEは1.12系の`getResourceSet`を使い、提出済みAEログでも切り替え成功があるため、このKaiz向け検索経路は適用しない。AE v2.5.4の`loadModel`にはclient注釈があることも確認した。1.7.10の全9ツール・シングル/マルチへ共通で適用される。Mod/JAR・参照ツールキット・rtm-ts・SRBXPatchは変更しない。

`pnpm test:model-lookup '<JDK 8 home>'`は、managerとModelSetBase自身にclient型メソッドを持つfixtureを使い、その型を拒否するClassLoader/Java 8/Nashornで旧アクセスの失敗と新ヘルパーの成功を確認する。null/不明/ダミー/有効モデル、ハンドルキャッシュ、ネイティブ例外の伝播と、生成済みKaiz/1.7.10 compatの切り替え順・失敗時無変更も検証する。実機では両側最新ZIPで生成A→B→分割など複数方向の切り替え、切り替え後の操作とQ終了を確認する。再発時は操作・時刻と両側ログを提出する。

上流報告は開発者が行う。報告対象はKaizPatchX 1.10.4のモデル管理クラスに残るclient専用型のメソッド宣言であり、専用サーバーでのNashornアクセス時にも型解決できる宣言へ整理してもらいたい。SRBXでの回避は実機確認済み。

## ログと原因の切り分け

- `latest-server.log`の11:20:25と11:20:33に、生成A/Bの線形計算後、`creation exception: java.lang.NoClassDefFoundError: net/minecraft/client/util/ITooltipFlag`、続いて`create_failed`。
- 11:20:44の渡り線も通常レール部分の生成で同じ例外。その後`replacement creation failed: 0`で失敗復元へ進む。同じレール生成経路の問題である。
- クライアントの同時刻には生成失敗のチャット表示があり、ツール切り替えと要求送信はサーバーまで到達している。ネットワーク切断のIOExceptionや、無関係なModのロード警告はこの型解決エラーの根拠に使わない。
- サーバーのパック名は`SuperRailBuilderX-0.4.0.zip`だが、クライアントの検出名は`SuperRailBuilderX-0.3.2.zip`。ファイル名だけで内容を断定しない。再確認時には両側の旧ZIPを除去し、同じ最新開発ZIPへ統一する。これはサーバー内のITooltipFlag欠落とは別の注意点である。

## SRBXの版不一致による影響（2026-10-24追記）

開発者から、当時はクライアント0.3.2・サーバー0.4.0であったと確認された。履歴の`v0.3.2`と`v0.4.0`を比較した結果、次の2件の原因判断は維持できる。

- ITooltipFlagの型解決失敗はサーバー内で発生し、実AE JAR/Java 8の単体再現でもクライアントを必要としない。両タグとも問題のBlockMarkerへの直接アクセスを持つ。版を揃えても上流の注釈漏れは解消しない。
- [渡り線のnull.keyクラッシュ](crossover-client-result-crash.md)は、両タグとも自由生成の失敗復元が`refreshed:[null]`を返し、受信側がnullを参照する組み合わせだった。render_builder1の差分はなく、server_crossover_builderの変更はVERSIONだけ、共通プランに差分はない。AEツール互換層の差分もパッケージ移行で、この送受信形式は変わっていない。

ただし、0.3.2クライアントは旧AEパッケージを参照するため、別の不具合が混在する可能性はあった。上記2件の原因確認だけのためのログ再採取は不要とし、最新ZIPを両側へ入れ直した機能確認を依頼した。この確認は2026-10-24の開発者報告で完了。今後再発した場合だけ、操作・時刻と両側のログを採取する。

SRBXへ[版照合と要求拒否](../development/client-server-version-guard.md)を追加した。旧版には照合機能がないため、導入時は両側を最新へ更新する。同じ0.4.0表記の旧開発ZIPも混在させない。

## AE上流への報告用要点

対象: AppleExtended v2.5.4のNGTLib同梱クラス。

```java
jp.ngt.ngtlib.block.BlockContainerCustom
jp.ngt.ngtlib.block.BlockCustom

public void addInformation(
    net.minecraft.item.ItemStack stack,
    net.minecraft.world.World world,
    java.util.List<String> tooltip,
    net.minecraft.client.util.ITooltipFlag advanced
)
```

両クラスのこのメソッドには、実dev JARのバイトコード上で`@SideOnly(Side.CLIENT)`がない。`BlockMarker`は`BlockContainerCustomWithMeta`→`BlockContainerCustom`を継承する。`BlockLargeRailBase`も同じtooltip型の影響を受ける。

専用サーバーでclient型をロードできない状態では、`Class.forName(..., false, loader)`でブロッククラス自体を取得できても、`Class#getMethods()`による継承メソッドの列挙で`ITooltipFlag`が解決されて失敗する。Nashornの`BlockMarker.createRail(...)`への通常アクセスも、Javaのメンバー解決で同じ列挙を行い失敗する。tooltipを直接呼ぶ必要はない。シングルプレイではclient型が存在するため、この条件を検出できない。

上流へは、両メソッドに適切なクライアント側注釈を付け、**専用サーバーでSideOnly除去後の型に対するリフレクション/Nashornアクセス**も確認してもらいたい。クライアント型をサーバーへ追加する対処や、SRBXPatchによる修正は行わない。他のスクリプトが同じブロック型へアクセスする場合にも波及し得る。

## SRBX側の修正と範囲

- AEの通常/自動分割生成は、`Class.forName`と`getDeclaredMethod`で公開static `BlockMarker.createRail(World,int,int,int,List,ResourceStateRail,boolean,boolean)`だけを取得して呼ぶ。継承クラスの全メソッド列挙を避ける。private APIや`setAccessible`は使わず、AE本来の配置・検証処理を維持する。
- 既設道床をコアへ昇格させる通常・自動分割・分岐配置では、ブロックインスタンスの`getMetaFromState`をスクリプトから直接呼ばない。vanillaの`Block.getStateId(state)`を経由し、`(stateId >>> 12) & 15`で元のmetadataを取得する。Minecraft 1.12.2の実バイトコードと同じ形式で、道床復元用情報を保持する。
- AEとKaizのカント更新/Undo/分岐接続側平坦化では、`shouldRerenderRail`の代入を`world.isRemote`で制限する。RailMap再構築・dirty・パケット送信・ブロック同期はサーバーでも維持する。
- 生成例外には既存の`creation exception`へ`path`と`side`を追加し、native/分岐/道床保持/Section保持のどの経路で失敗したかを確認できるようにする。

同じ生成を使う移動・分割・複線・組ホーム・分岐・渡り線・Undo/失敗復元にも回避が適用される。別の上流APIに残るclient型参照をすべて保証する修正ではない。再発時は最初の欠落クラス名と`path`を調べる。

## 検証と実機再確認

Java 8の恒久回帰は次で実行する。

```powershell
pnpm build
node tests/srbx_patch/dedicated_server_interop.test.cjs '<JDK 8 home>'
```

このテストはclient型を拒否するClassLoaderで、通常Nashornアクセスの失敗と、**生成済みSRBXの実際の限定呼び出し関数**の成功を検証する。8引数・オブジェクト同一性・整数/boolean・true/false・メソッドキャッシュ・native例外伝播を含む。

追加のローカル実JAR検証では、既存JARを読取専用でロードし、SideOnlyメンバーをメモリ内だけで除去した。実BlockMarker/BlockLargeRailBaseの`getMethods()`失敗と、BlockMarkerの限定メソッド取得成功を確認した。再現ソースとjavap抜粋は`.cache/dedicated-server/`へ保存。JARファイルは改変していない。

専用サーバー実機での修正確認は開発者報告で完了。今後の回帰では、AE/Kaizそれぞれで両側を同じ最新ZIPへ統一し、次を確認する。

1. 空き場所で生成A/B、長い自動分割レール、片渡り/シーサスを生成する。
2. 既設道床に接する生成、移動・分割・分岐、Undo/失敗復元と再入場後の保持を確認する。
3. 通常/自動分割レールにカントを適用し、接続先・サーバー保存・クライアント表示とUndoを確認する。
4. 異常があれば操作・時刻と`logs/latest-client.log`、`logs/latest-server.log`をこのチャットへ共有する。AEは`creation exception`の欠落型・`path`・`side`を含める。
