# 接続カント・道床所有先と低速遷移の調査

2026-10-09 ローカルCodex。対象: KaizPatchX v1.10.3 / AppleExtended v2.5.3。

## 標準マーカー敷設の規則

ローカルに取得済みの公式JAR/一次ソースを確認した。Mod本体、rtm-ts、標準マーカーの処理は変更していない。

| 処理 | KaizPatchX | AppleExtended |
| --- | --- | --- |
| 同じ種類の通常道床と重複 | 通常道床を配置し、setStartPointを新コア座標へ更新 | 同左 |
| 別種類のBlockLargeRailBase（コア/分岐道床など）と重複 | 道床配置段階では保持 | 同左 |
| コア配置 | 道床配置後、始点へコアを設置して自己所有にする | 同左。自動分割は各Sectionの始点にmetadata 1のコア |
| 配置可否 | 非コア道床は許可、既存コアは非Creativeで拒否。Creativeは障害物拒否を迂回 | 同左 |
| 地形コピー | LINE2マーカー時に実行。既存道床へのコピーは省略 | prepareBaseBlocksで実行。既存道床へのコピーは省略 |

一次ソースの根拠:

- KaizPatchX-v1.10.3.jar: RailMap.lambda$setRail$0のbytecode offset 30–41（別種類の道床を省略）、44–84（配置/setStartPoint）。BlockMarker.createRail0の68–87（道床）、90–108（コア）、156–170（自己所有）。TileEntityLargeRailBase.setStartPointの0–20はstartPoint配列への代入。
- Kaiz RailMap.canPlaceRailの100–123はコア不可判定、126–127はCreative時の拒否迂回。prepareBaseBlocksの10–38はLINE2判定、setBaseBlockの362–367は既存道床への地形コピー回避。
- AE v2.5.3 RailMap.placeRailBlocksの89–100（別種類を省略）、103–139（配置/setStartPoint）。BlockMarker.createNormalRailの道床配置→コア設置→自己所有設定、およびcreateSectionedRailの各Section敷設を確認。
- AE RailMap.setBaseBlockの259–272（コピー元からマーカー/道床を除外）、299–313（コピー先道床を保持）。

同じ通常道床ブロックの外観が変わらなくても、所有する論理レールは変わる。低速で片方向だけ引っかかる症状との因果は未確定。

## SRBXで変更した規則

- KaizPatchの生成Aも、接続端点のdirection/yawを180度反転するときcantEdgeを反転する。cantCenterと既設RPは維持する。
- KaizPatchのレール選択ハイライトはAEと同じ論理RailMapの色付き線を描く。自動分割単位やモデルスクリプトの判定に依存しない。
- 通常道床の敷設では既存のレールブロックを保持し、setBlock/setStartPointを呼ばない。終端、所有先不明、tile欠損でも保持し、移動時のoverwrite指定も通常道床の上書きを許可しない。
- コア配置は別工程で、必要な通常道床→コア置換は従来の配置検証を経て許可する。既存コアを通常道床に置換しない。コア配置先の保護規則は維持する。
- Kaizの生成A/複線/分割/移動/Undoで使う共通敷設を変更。既存のair-only/additive経路も既存通常道床を上書きしないことを確認。
- AEの既存道床と重なる通常生成はSRBX側で敷設/コア初期化する。Section（通常配置と代替配置）/分岐も保持判定付き敷設へ変更。既存道床に重ならない通常生成はネイティブ経路を維持する。
- AEの既存所有先退避はownerlessも含みコアを除外する。復元は実際に所有先が変わった場合だけ行い、コアへ昇格したtileに旧所有先を戻さない。

変更前に生成したレールの所有先やカントを自動修復する処理ではない。調査は新しく生成した接続で行う。

## 比較手順

1. バックアップした同じワールド条件で、直線/曲線、カント正負、短い通常レール/チャンクをまたぐ自動分割レールの接続を作る。生成順A→BとB→Aをそれぞれ試す。
2. SRBX生成Aと標準マーカー生成を別の同条件地点で比較する。標準マーカーは上記のネイティブ規則のまま。
3. 同じ車両・低速で接続点を双方向に走行し、通常速度でも確認する。引っかかる進行方向、速度、座標、生成順、操作時刻を記録する。
4. 生成/複線/分割/移動/Undo後に、既設側が消失せず再入場後も所有先・走行状態が保持されることを確認する。
5. logs/latest.logを格納する。[SuperRailBuilderX roadbed]のadded/retained/owner/samples、[SuperRailBuilderX transition]の接続端点/所有先と、失敗した操作の前後を使って判断する。

保持により重複ブロックは既設側の所有先だけを持つため、症状が残る/逆方向へ移る可能性もある。精密端点・接続ブロック・探索順も併せて切り分ける。今回Minecraft実機の走行確認は未実施。
