# 専用サーバーでのSideOnly型解決エラー

## 現在の結論（2026-10-24、ローカルCodex）

AEマルチ環境での生成失敗は、AE v2.5.4に含まれるNGTLibのブロック基底クラスのtooltipメソッドに、専用サーバーに存在しないクライアント型が残ることと整合する。実AE JARとJava 8で型解決失敗を再現した。SRBX側には、ブロックのメソッド一覧を解決させず必要なAPIだけを呼ぶ回避を追加した。**Mod本体の注釈漏れは上流での修正対象**であり、報告は開発者が行う。rtm-ts・参照ツールキット・JAR・SRBXPatchは変更していない。

KaizPatchX 1.10.4の同じクラス階層にはAEと同じtooltip型の問題は見つからなかった。一方、両環境のSRBXカント更新には、サーバーからクライアント専用の再描画フィールドへ代入する箇所があったため、クライアントワールドだけで実行するよう修正した。Kaizの非strict Nashornでは存在しないフィールドへの代入が黙殺されるため、これを今回のクラッシュ原因と断定しない。

## ログと原因の切り分け

- `latest-server.log`の11:20:25と11:20:33に、生成A/Bの線形計算後、`creation exception: java.lang.NoClassDefFoundError: net/minecraft/client/util/ITooltipFlag`、続いて`create_failed`。
- 11:20:44の渡り線も通常レール部分の生成で同じ例外。その後`replacement creation failed: 0`で失敗復元へ進む。同じレール生成経路の問題である。
- クライアントの同時刻には生成失敗のチャット表示があり、ツール切り替えと要求送信はサーバーまで到達している。ネットワーク切断のIOExceptionや、無関係なModのロード警告はこの型解決エラーの根拠に使わない。
- サーバーのパック名は`SuperRailBuilderX-0.4.0.zip`だが、クライアントの検出名は`SuperRailBuilderX-0.3.2.zip`。ファイル名だけで内容を断定しない。再確認時には両側の旧ZIPを除去し、同じ最新開発ZIPへ統一する。これはサーバー内のITooltipFlag欠落とは別の注意点である。

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

専用サーバー実機での修正確認は開発者へ依頼する。AE/Kaizそれぞれで両側を同じ最新開発ZIPへ統一し、次を確認する。

1. 空き場所で生成A/B、長い自動分割レール、片渡り/シーサスを生成する。
2. 既設道床に接する生成、移動・分割・分岐、Undo/失敗復元と再入場後の保持を確認する。
3. 通常/自動分割レールにカントを適用し、接続先・サーバー保存・クライアント表示とUndoを確認する。
4. 異常があれば操作・時刻と`logs/latest-client.log`、`logs/latest-server.log`をこのチャットへ共有する。AEは`creation exception`の欠落型・`path`・`side`を含める。
