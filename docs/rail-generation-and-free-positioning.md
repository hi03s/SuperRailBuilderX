# KaizPatchXのレール生成・RailPosition自由点移動

## 1. この文書の目的

この文書は、SuperRailBuilderXの試験実装とKaizPatchX v1.10.3の一次ソースから得られた、次の処理に関する知見をまとめたものです。

- スクリプトから通常レールを敷設する方法
- KaizPatchXの自動分割レールが生成される仕組み
- `RailPosition#setPosition` による自由点移動
- RailPosition移動後にRailMapと道床を更新する必要性
- 自動分割レールの端点を変更する際の撤去・再生成
- サーバーでの変更を保存し、クライアント描画へ反映する方法
- 交差、接続点、チャンク、分岐器に関する制約

対象は主にMinecraft 1.7.10向けKaizPatchX v1.10.3です。通常RTMや1.12.2ターゲットには存在しないAPIがあるため、実装では必ずtarget別compat層を使用してください。

## 2. レールを構成する主要要素

### 2.1 RailPosition

`RailPosition` は曲線端点の位置と向きを保持します。重要な座標は2系統あります。

| データ                               | 意味                                   |
| ------------------------------------ | -------------------------------------- |
| `blockX / blockY / blockZ`           | RailPositionを所有する基準ブロック座標 |
| `posX / posY / posZ`                 | 曲線計算に使われる精密なワールド座標   |
| `offsetX / offsetY / offsetZ`        | 標準位置から精密座標までの差分         |
| `direction`                          | 基準となる8方向                        |
| `anchorYaw / anchorPitch`            | 曲線端の接線方向                       |
| `anchorLengthHorizontal / Vertical`  | 曲線制御点の長さ                       |
| `cantCenter / cantEdge / cantRandom` | カントに関する値                       |

`setPosition(x, y, z)` は `blockX/Y/Z` を変更しません。ブロック座標と方向から求まる標準位置との差をオフセットへ保存し、`init()`で`posX/Y/Z`を再計算します。

```ts
railPosition.setPosition(worldX, worldY, worldZ);
```

オフセットはNBTの `OffsetX / OffsetY / OffsetZ` に保存されます。したがって、正しくコアをdirty状態にして保存すればワールド再読込後も自由点は維持されます。

### 2.2 RailMapBasic

`RailMapBasic` は始点・終点のRailPositionからベジェ曲線を構築し、次の処理に使われます。

- 曲線上の座標、高さ、Yaw、Pitch、Rollの計算
- レール描画
- 列車の走行位置計算
- 必要な道床ブロック座標の算出
- 道床TileEntityの配置・撤去

RailPositionだけを書き換えても、コアが保持しているRailMapキャッシュは古いままです。通常レールでは `setRailPositions()` の後に `createRailMap()` を呼び、キャッシュを再生成します。

### 2.3 コアと道床TileEntity

通常レールは、おおむね次の構造です。

- 1個の `TileEntityLargeRailCore`
- 曲線に沿って配置される複数の `TileEntityLargeRailBase`
- 各道床TileEntityが保持する、所有コアの始点座標

列車は見た目のRailMapだけをたどるのではありません。走行位置にある道床TileEntityから所有コアを取得し、そのRailMapを参照します。そのため、曲線だけを移動して新しい経路上に道床が存在しないと、途中で `Rail not found` になります。

## 3. 通常レールの生成

KaizPatchX標準の通常レール生成は、概ね次の順序です。

1. 始点・終点のRailPositionを用意する。
2. `RailMapBasic` を生成する。
3. `canPlaceRail()` で配置可能性を検査する。
4. `RailMapBasic#setRail()` で道床を配置する。
5. 始点ブロックへ `RTMRail.largeRailCore0` を配置する。
6. コアへRailPosition、RailProperty、始点座標、RailMapバージョンを設定する。
7. RailMapを生成し、保存・同期する。

概念コードは次のようになります。

```ts
const railMap = new RailMapBasic(
	start,
	end,
	RailMapBasic.fixRTMRailMapVersionCurrent,
);

railMap.setRail(
	world,
	RTMRail.largeRailBase0,
	start.blockX,
	start.blockY,
	start.blockZ,
	property,
);

world.setBlock(
	start.blockX,
	start.blockY,
	start.blockZ,
	RTMRail.largeRailCore0,
	0,
	2,
);

const core = world.getTileEntity(
	start.blockX,
	start.blockY,
	start.blockZ,
) as TileEntityLargeRailCore;

core.setRailPositions([start, end]);
core.setProperty(property);
core.setStartPoint(start.blockX, start.blockY, start.blockZ);
core.createRailMap();
core.markDirty();
```

実際のrtm-tsではJavaの `RailPosition[]` が必要になるため、通常のTypeScript配列ではなく `java.lang.reflect.Array.newInstance()` などでJava配列を作る必要があります。

### 3.1 RailProperty.autoSplitの影響

`BlockMarker.createRail()` は、2点の通常レールを生成する内部で `property.autoSplit` を確認します。自動分割が有効で、`RailChunkSectioner.split()` の結果が複数区間なら、単一コアではなく自動分割レールを生成します。

つまり、次の2つは同じ結果になりません。

| 生成方法                               | `autoSplit=true` の結果          |
| -------------------------------------- | -------------------------------- |
| `BlockMarker.createRail()`             | 必要に応じて自動分割される       |
| `RailMapBasic#setRail()`とコア直接設置 | 分割処理を通らず通常レールになる |

SuperRailBuilderXの通常レール再生成テストでは、後者を使用してSuperRailBuilder3に近い単一コアレールを生成しています。

## 4. 自動分割レールの生成

### 4.1 分割位置の決定

`RailChunkSectioner` は論理RailMapを1 mあたり4サンプル程度で走査し、通過チャンクが変わる境界を探します。境界付近の曲線上に新しいRailPositionを作り、チャンクごとの連続区間へ分割します。

境界RailPositionには次の値が設定されます。

- 曲線上の精密座標
- 曲線のYaw、Pitch、Roll
- 元RailPositionから引き継いだ幅・高さ制限とカント
- 中間コアを置くブロック座標

区間終端側では方向とYawを180度反転させ、次区間の始端と同じ精密座標を共有するRailPositionを作ります。

### 4.2 セクションの生成

自動分割レールでは、各区間について次の処理を行います。

1. 論理RailMap全体を元に `RailMapSection` を作る。
2. 各セクションの道床を配置する。
3. セクション始点にメタデータ1の `largeRailCore0` を配置する。
4. `TileEntityLargeRailSectionCore` へグループ情報を設定する。
5. RailProperty、始点、RailMapバージョンを設定する。
6. セクション用RailMapを生成して保存する。

各セクションコアは次の情報を持ちます。

- グループUUID
- 論理レール全体の始点・終点
- 自分のセクション始点・終点
- 論理曲線上で担当する開始比率・終了比率
- グループに属する全コア座標

`getLogicalRailPositions()` は内部データのコピーを返します。返されたRailPositionへ `setPosition()` を呼ぶだけでは、セクションコア内部の論理情報は変更されません。

## 5. 通常レールの自由点移動

通常レールはコアが論理レール全体を直接保持しているため、比較的単純に更新できます。

1. `getRailPositions()` から対象端点を取得する。
2. 選択時の元座標と現在座標が一致するか確認する。
3. `setPosition()` で精密座標を変更する。
4. `setRailPositions()` と `createRailMap()` を呼ぶ。
5. 新しいRailMapに必要な道床を補う。
6. 保存・サーバーからクライアントへの同期を行う。

```ts
const positions = core.getRailPositions();
positions[index].setPosition(x, y, z);
core.setRailPositions(positions);
core.createRailMap();
addMissingRoadbed(core);
core.markDirty();
NGTUtil.sendPacketToClient(core);
world.markBlockForUpdate(coreX, coreY, coreZ);
```

### 5.1 不足道床の追加

新しいRailMapから `getRailBlockList(property)` を取得し、各座標を調べます。

- 空気またはレールマーカーなら新しい道床を配置する。
- 既存の別レール道床は上書きしない。
- レールコアや通常ブロックがある場合は、そのブロックを保持して道床追加を省略する。
- 移動前の旧道床は、安全のため自動削除しない。

旧道床を削除するには「その道床が移動対象だけに所有されている」ことを判定する必要があります。RTMの道床は所有コア座標を1個しか保持できず、複数レールが重なる状況では単純な差分削除が他レールを壊す可能性があります。

## 6. 自動分割レールの自由点移動

自動分割レールでは、1個のセクションだけを変更してはいけません。論理端点の移動によって曲線が通過するチャンクが変わり、必要なセクション数やコア位置も変化するためです。

安全側の処理順序は次のとおりです。

1. グループUUIDで同じ論理レールを識別する。
2. 論理RailPositionと全コア座標を取得する。
3. 全コアがロード済みで同じグループに属することを確認する。
4. `isLogicalRailOccupied()` で、どのセクションにも列車がいないことを確認する。
5. RailPosition、RailProperty、信号、サブレールを退避する。
6. 移動後のRailPositionと道床・新コア位置を事前検証する。
7. `breakLogicalRail()` で論理レール全体を撤去する。
8. 移動後RailPositionからレール全体を再生成する。
9. 信号とサブレールを新しいコアへ戻す。
10. 失敗時は退避したRailPositionから元のレールを復元する。

標準の再生成に `BlockMarker.createRail()` を使うと、`autoSplit`と新しい曲線に基づいてセクション数が再計算されます。SuperRailBuilderXの交差試験経路では、標準の一律障害判定と道床所有情報の上書きを避けるため、`RailChunkSectioner.split()` の結果から各セクションを直接構成します。曲線途中の道床は空気位置だけへ配置し、新しいセクションコア予定位置にある通常道床だけをコアへ置換します。

### 6.1 単一コア通常レールとして再生成する場合

自動分割レールを通常レールへ変換する場合は、撤去後に `BlockMarker.createRail()` を呼びません。道床候補のうち空気位置だけを加算配置し、始点へ通常コアを直接設置します。

これによりRailPropertyの `autoSplit` が有効でも単一コアになります。ただし、自動分割が避けていた次の問題が戻る可能性があります。

- コアのあるチャンクが未ロードだと、遠方セクションで所有コアを取得できない。
- 長距離レールの描画・走行・チャンク管理が単一コアへ集中する。
- コア位置から遠い道床の同期やロード順の影響を受ける。

## 7. クライアントへの反映

レール変更はサーバー側で行います。サーバー側で正しく保存できても、クライアントに古いRailMapキャッシュが残ると、再入場まで見た目が変わらないことがあります。

### 7.1 サーバー側で必要な処理

```ts
core.createRailMap();
core.markDirty();
NGTUtil.sendPacketToClient(core);
world.markBlockForUpdate(coreX, coreY, coreZ);
```

| 処理                   | 目的                               |
| ---------------------- | ---------------------------------- |
| `createRailMap()`      | サーバー側の曲線キャッシュを再生成 |
| `markDirty()`          | TileEntityを保存対象にする         |
| `sendPacketToClient()` | 更新NBTをクライアントへ送信        |
| `markBlockForUpdate()` | ブロック更新・再描画を促す         |

### 7.2 クライアント側のRailMap再生成

通常レールでは、NBT受信後も既存RailMapが残るケースに備え、成功応答を受けたクライアント側で対象RailPositionを更新し、`createRailMap()`と再描画フラグを設定する方法が有効でした。

```ts
positions[index].setPosition(x, y, z);
core.setRailPositions(positions);
core.createRailMap();
core.shouldRerenderRail = true;
world.markBlockForUpdate(coreX, coreY, coreZ);
```

自動分割レールの再生成では古いコア自体が撤去されるため、古いJavaオブジェクトへクライアント更新を適用してはいけません。新規コアのブロック更新・TileEntity同期を利用します。

## 8. 接続点を複数レールで共有する場合

同じ精密座標に複数レール端点がある場合、1本だけ動かすと接続が切れます。SuperRailBuilderXでは1 mm以内の端点を同じ接続点としてまとめ、1回の要求で同じ移動先へ送ります。

サーバーは適用前に全対象を検証します。

- 全端点が同じ元座標にあるか
- 対象レールがまだ存在するか
- RailPositionが選択後に変更されていないか
- 全セクションがロード済みか
- 列車が在線していないか
- 道床や新コア位置に致命的な衝突がないか

全対象を先に検証してから順番に適用しても、適用中に予期しない例外が起きる可能性は残ります。途中失敗は `partial_target_...` として、何本目まで適用したかをログへ残す必要があります。

## 9. 交差とブロック所有権

### 9.1 道床同士の重なり

RTM標準の `canPlaceRail()` は非コア道床との重なりを許可します。ただし、同じブロックにTileEntityを2個保存することはできないため、後から配置した道床が所有コア情報を上書きする場合があります。

試験実装では曲線途中の既存道床を保持し、新しい道床は空気位置だけへ置きます。これにより重なった道床の所有コア情報を変更しません。一方、新しいセクションコアの予定位置に既存道床がある場合は、その道床をコアへ置換しなければ自動分割構造を成立させられません。この置換は交差相手の道床を1ブロック失わせる破壊的変更なので、バックアップ済みワールドで両方の線路を走行確認する必要があります。

### 9.2 コア同士の衝突

新しいセクションコア位置が他レールコアと一致する場合、両方を同じブロックへ置けません。この場合は既存レールを壊さず、生成を停止する必要があります。

曲線途中が他レールコアを横切るだけなら、既存コアを保持し、その座標への道床配置を省略する試験実装は可能です。ただし、交差位置で対象レールの所有道床がなくなるため、必ず双方向走行で確認してください。

builder1の追加調査では、既設コアを先に空気化する方式は`BlockLargeRailBase#breakBlock`から論理レール全体の`breakLogicalRail()`を呼ぶため、交差相手を高い確率で破壊することを確認しました。RTM標準マーカーの`RailMap#canPlaceRail`はクリエイティブでも通常道床との重なりだけを許可し、コアは配置不可とします。また`RailMap#breakRail`は他レール所有の道床を撤去対象から除外します。builder1もこの境界へ合わせ、通常道床交差は許可し、既設コア交差は破壊せず停止します。

`RailMap#createRailList`は道床幅方向を`sin(yaw ± 90°)`と`cos(yaw ± 90°)`で求め、そのままブロック座標へ切り捨てます。直角方向で0になるはずの成分に浮動小数点の負の極小値が残ると、整数境界上のサンプルだけ隣ブロックへ落ちます。実機では+X/+Zが正常でも-X/-Zで片側が凹凸になる方向依存として現れました。外部ツール側で道床を直接配置する場合は、三角関数値の0・±1近傍を厳密値へ正規化してから切り捨てる必要があります。

さらにRTM標準処理は、始終端の隣接ブロックと一致する中心ブロックだけを道床候補から除外します。負方向の整数境界では、同じ長手方向サンプルから列挙された幅方向の側方ブロックだけが残り、起点側が凹型に見えることがあります。外部ツールで対称な道床を作る場合は、中心座標が端部隣接ブロックと一致するサンプルについて幅方向の列挙全体を省く必要があります。

builder1の縦曲線は、既設端の勾配、自由端の目標勾配、設定半径から円弧の水平・垂直変位を前向きに求めます。自由端のY座標を先に目標勾配の直線上へ置いてから両端を通る円を逆算すると、指定20‰に対して端部が約40‰になるなど、弦勾配と接線勾配を混同する結果になります。目標勾配へ到達する円弧長が経路内に収まる場合だけその位置で分割し、残りを目標勾配の直線にします。距離不足なら同じ半径で到達可能な勾配を求め、円弧1本だけを生成します。

自動分割では、`RailChunkSectioner`がチャンク境界直後の中心線ブロックをセクションコア候補にしますが、ワールド上の占有状態は考慮しません。builder1は内部コア候補が既設道床なら、同じチャンク・同じ区間の空いている経路ブロックへ候補を移します。空き候補がない場合は既設レールを壊さず停止します。さらに全区間の道床を先に設置すると、重複道床の所有座標が別区間へ上書きされる場合があります。道床をコア化する直前に所有座標を自分自身へ戻さないと、`breakBlock`が生成途中の別セクションコアを取得し、新設レール全体を撤去することがあります。

## 10. 分岐器を通常レールと同じ方法で変更できない理由

分岐器は3個以上のRailPositionと複数の `RailMapSwitch` を持ちます。`TileEntityLargeRailSwitchCore` は分岐状態と複数の曲線をまとめたオブジェクトをキャッシュします。

通常レール用の `setRailPositions()` と `createRailMap()` だけでは、保存されたRailPosition、表示曲線、走行曲線、分岐状態が一致しない可能性があります。分岐器を自由点移動へ対応させるには、全RailPosition、全RailMap、分岐状態、道床を一体で再構築する専用処理が必要です。

## 11. サーバー・クライアント分離

推奨する責務分担は次のとおりです。

| クライアント             | サーバー                          |
| ------------------------ | --------------------------------- |
| 視線判定                 | 対象コアの再取得                  |
| 候補端点の探索・表示     | 元座標と対象状態の再検証          |
| 右・左クリックの段階管理 | RailPosition・RailMap・道床の変更 |
| 0.01 m丸めとプレビュー   | 保存、パケット送信、結果返却      |
| Enterで要求送信          | 失敗時の復元と診断ログ            |

クライアントから送られたコア座標、端点番号、元座標、移動先をそのまま信用してはいけません。適用時点でワールドからコアを再取得し、対象が選択時から変化していないことを確認します。

## 12. 推奨する実装・検証手順

### マーカー座標・方向と設置結果の検証

SRB3の実装では、精密なレール端点とマーカーブロックの表示位置を分離しています。方向マーカーは`blockX + 0.5`、`blockZ + 0.5`を基準に描画します。既設端部へ接続するときは、精密端点基準の`getNeighborPos()`ではなく、元RailPositionの`blockX/Z + 0.5 + REVISION[direction] × 2`を切り捨てて接続ブロックを求めます。精密端点のY座標には通常レール高の1/16ブロックを加えます。

自由点は標準REVISION位置からオフセットされ得るため、REVISIONの単純逆算では所有ブロックを一意に決められません。確定した精密端点からdirectionのアンカー方向へ微小量進めた座標を切り捨て、レールが入る側を選びます。これにより、辺では隣接2ブロック、角では進行象限に応じた候補を選択できます。

RTM/NGTLibのYawは0度が+Z、90度が+Xです。水平ベクトルからは`atan2(dx, dz)`で求め、アンカーベクトルは`x = sin(yaw)`、`z = cos(yaw)`の規約で構築します。プレビューを実レールと一致させるには、直線補間ではなく両RailPositionのYaw・Pitch・アンカー長から3次ベジェ制御点を作ります。

SRB3の既設端部同士接続は、弦長の2/3を仮アンカー長にしたベジェを一度作り、その近似曲線長の1/3を両端の最終アンカー長にします。既設端部と自由点では、固定端接線と端点間弦からアンカー交点を求め、中心角と半径から`radius × 4/3 × tan(angle/4)`で正円近似ベジェのアンカー長を決めます。

Minecraft 1.7.10の`World#setBlock`のboolean戻り値だけでは、目的ブロックとTileEntityが存在するかを確定できません。同じ状態への設定などで`false`になっても目的状態が既に成立している場合があります。破壊的な生成では、呼び出し後にブロックまたはTileEntityを再取得して型と状態を検証します。

### 実装時

1. RailPositionをNBT経由でコピーし、元データを直接壊さず移動後曲線を試算する。
2. 道床とコア位置の衝突を、撤去前に検証する。
3. 通常レールと自動分割レールを別経路にする。
4. 自動分割レールでは全グループコアのロードと在線を確認する。
5. 変更するワールド処理をサーバースクリプトに限定する。
6. `try/finally`で要求データを必ず消費し、例外の毎tick再実行を防ぐ。
7. 再生成前に、復元に必要なRailPositionとRailPropertyを退避する。
8. 保存処理とクライアント同期を両方行う。

### ゲーム内検証

1. バックアップ済みテストワールドを使用する。
2. 通常レールを小さく移動し、即時描画と再入場後の保存を確認する。
3. 移動後曲線全体を双方向に走行する。
4. 自動分割レールでセクション数が増える移動と減る移動を試す。
5. 同じ接続点を共有する2本を同時移動する。
6. 別レール道床との重なり、別レールコアとの交差を分けて試す。
7. 在線中の移動が拒否されることを確認する。
8. 意図的に生成失敗させ、元レールが復元されることを確認する。
9. `latest.log` の `Rail not found`、`partial_target`、再構築ログを確認する。

## 13. SuperRailBuilderX内の参照先

| 内容                               | ファイル                                                       |
| ---------------------------------- | -------------------------------------------------------------- |
| クライアント操作・候補探索・描画   | `render_rail_position_test.ts`                                 |
| 自動分割再生成版サーバー           | `server_rail_position_test.ts`                                 |
| 通常レール再生成版サーバー         | `server_rail_position_normal_test.ts`                          |
| バージョン差分・KaizPatchX固有処理 | `src/kaizpatch/.../SRBXApiCompat.compat.ts`                    |
| 他ターゲットの安全な無効化         | `src/mc1710/...`、`src/mc1122/...`                             |
| 調査・試験結果                     | `docs/rail-position-free-positioning.md`                       |
| レール生成ツール                   | `render_builder1.ts`、`server_builder1.ts`、`docs/builder1.md` |

## 14. 一次ソース

- [KaizPatchX RailPosition.java](https://github.com/Kai-Z-JP/KaizPatchX/blob/master/src/main/java/jp/ngt/rtm/rail/util/RailPosition.java)
- [KaizPatchX RailMap.java](https://github.com/Kai-Z-JP/KaizPatchX/blob/master/src/main/java/jp/ngt/rtm/rail/util/RailMap.java)
- [KaizPatchX BlockMarker.java](https://github.com/Kai-Z-JP/KaizPatchX/blob/master/src/main/java/jp/ngt/rtm/rail/BlockMarker.java)
- [KaizPatchX TileEntityLargeRailSectionCore.kt](https://github.com/Kai-Z-JP/KaizPatchX/blob/master/src/main/java/jp/kaiz/kaizpatch/rtm/rail/TileEntityLargeRailSectionCore.kt)
- [KaizPatchX RailChunkSectioner.kt](https://github.com/Kai-Z-JP/KaizPatchX/blob/master/src/main/java/jp/kaiz/kaizpatch/rtm/rail/util/RailChunkSectioner.kt)
- [KaizPatchX v1.10.2 release](https://github.com/Kai-Z-JP/KaizPatchX/releases/tag/v1.10.2)
