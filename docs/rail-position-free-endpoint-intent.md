# RailPosition端点自由化の経緯と意図

2026-10-10 ローカルCodex。公式導入差分・公開説明・後続差分と実使用JARを照合。日付はJST。作者の内心は推定として区別する。

## 結論

Kaizの実装からは、**ブロック面中央に固定された従来端点を、ブロック境界上の任意の曲線位置へ置けるようにし、チャンク分割しても元の形状を保つ**ことが導入目的として強く読み取れる。導入時のコメントとリリース説明に、端点のブロック端配置は設定側が保証する条件が明記されている。ブロック内部の任意点で独立レール同士の低速走行接続まで保証するAPIではない。

AEの導入差分も精密座標・保存・描画への対応であり、台車の探索処理は同時変更されていない。Kaizと同じoffset算出構造だが、差分の類似だけで移植の経路・作者の意図を確定しない。AEの任意自由端点走行を保証する明示的な説明は今回の一次資料では確認できない。

## 導入と後続変更

| 日付 | 一次資料 | 確認できた変更 |
| --- | --- | --- |
| 2026-07-18 | [Kaiz a8664a7](https://github.com/Kai-Z-JP/KaizPatchX/commit/a8664a71e31de617e35eddeda3b49b86446f4075) | continuous rail section sampling。RailChunkSectioner/RailMapSection、曲線の連続ratioサンプルと、RailPosition.offset/setPosition/NBT保存を同時追加 |
| 2026-07-26 | [Kaiz 502c694](https://github.com/Kai-Z-JP/KaizPatchX/commit/502c694e469ce5be349c1a320473be605bfbcd2c) | RailTransitionResolver追加。床探索でレールが見つからない場合に、現在端点の隣接/進行方向から接続コアを補完 |
| 2026-08-31 | [Kaiz 419d92a](https://github.com/Kai-Z-JP/KaizPatchX/commit/419d92a81be574439de74051517a58457442abdf) | 低速のsection境界往復対策。同論理レールの別コアを床探索した場合に現在コアを保持する条件を追加 |
| 2026-08-31 | [v1.10.2公開説明](https://github.com/Kai-Z-JP/KaizPatchX/releases/tag/v1.10.2) | チャンク自動分割と端点自由化を公開。setPositionの利用例としてRailChunkSectionerを提示し、ブロック端の保証はスクリプト側の責務と明記 |
| 2026-08-31 | [Kaiz 6e79ea8](https://github.com/Kai-Z-JP/KaizPatchX/commit/6e79ea8ad33b18a745ab7bd0461561dabde89272) | 端点越えの優先探索、実出口yawでの前方探索、接続先入口index補正を追加 |
| 2026-09-08 | [AE 74fe2ed](https://github.com/Kirtmuna/AppleExtended/commit/74fe2edd938bacbdb619bc0ccb9542f37857d054) | freed boundaryPoint。RailPositionのoffset/setPosition/NBTとRailPartsRendererBaseの精密原点を変更。EntityBogie/床探索の変更はこのcommitに含まれない |

コミットのauthor dateを示す。全変更の作成時刻・マージ時刻や、採用動機の全容を表すものではない。Kaizの遷移補完は1.10.4で初めて追加されたものではなく、上記の後続履歴を持つ。今回の不具合調査で確認した実行版が1.10.4。

## 自由化が必要だった場面

RailChunkSectioner.findBoundariesは曲線が別チャンクへ入る場所をサンプルと二分探索で求める。findCoreBlockで新チャンク内の所有コアブロックを決め、createBoundaryRPで元曲線の正確な位置・高さ・yaw/pitch/cantをRailPositionへ設定する。その最後にsetPositionを呼ぶ。終端側は方向を反転し、同じ精密位置へ再設定する。

例えばチャンク境界x=16で曲線がz=10.37を通る場合、その点はブロック境界上でも、従来マーカーの面中央の位置とは一致しない。これは説明用の例であり、今回実機の座標ではない。面中央へ丸めると元曲線との位置/接線がずれるため、面上の任意位置を表せることに意味がある。

RailMapSectionは端点から曲線を新しく作り直す代わりに、元RailMapBasicのratio区間へ位置・高さ・yaw/pitch/rollを委譲する。導入コメントにも元曲線を維持する目的が記されている。したがってAPI追加と連続サンプル・section proxyの同時変更は、**内部分割の幾何的連続性を保つ**という解釈を裏付ける。

## 自由化された範囲と残った前提

- setPositionは標準位置との差分offsetX/Y/Zを計算しinitする。blockX/Y/Zや道床の所有先を自動移設する処理ではない。
- offsetはNBTへ保存する。これは再読込後も端点形状を維持するための仕組みで、接続先グラフの追加ではない。
- 導入時offsetのJavadocは、中間レール等でブロック端の任意座標を使う場面を挙げ、境界条件の検証を設定側へ求めている。v1.10.2の公開説明にも同条件がある。Issue #534だけで後から付いた条件ではない。
- 導入時RailPosition.equalsはblockX/Y/Zの一致、getNeighborPosはposX/ZとdirectionのREVISIONから床座標を求める従来構造。精密座標を保存できても、接続・同一性・所有の全処理が自由座標のみに移行したわけではない。
- 導入時RailMap.canConnectは幾何端点のX/Z比較を行う。この判定で接続可能でも、台車の床探索がそのmapを選ぶことまで保証しない。API/描画/幾何判定/走行遷移は別の段階。
- Kaizの内部sectionは同じ論理レールに属し、後続修正はその内部遷移を特別に保護している。SRBX生成の別論理レール同士の接続では同じ保護条件にならず、今回の往復が残る。

## 意図の推定と確定できない点

**根拠の強い推定:** 当初はチャンク境界での連続分割に必要な精密端点表現を導入し、その低水準APIをスクリプトにも公開した。従来のブロック端接続規則を守ったまま、面中央への拘束を緩める拡張と読むのが自然。

**確認できない推定:** 任意位置の外部レール接続を将来目標としていたか、AEがKaizから直接移植したか。これらは今回のコミット差分だけでは断定できない。

[Issue #534の回答](https://github.com/Kai-Z-JP/KaizPatchX/issues/534#issuecomment-6086321090)は導入時の条件と整合する。Kaizの現行サポート範囲はブロック内部の独立レール接続を保証する前提ではない。AEの制作者見解は別途確認が必要。

SRBXではsetPositionで形状を作れること・幾何端点が一致することから走行接続可能性を広く解釈していた。今後は標準の境界条件を満たす生成仕様か、[独自遷移パッチ](free-endpoint-transition-patch-feasibility.md)で拡張する仕様を選ぶ必要がある。既存線形を自動変更しない。

## 検証範囲

確認済み: RailPosition該当ファイルの公開履歴、導入commitの全変更ファイル一覧/関連差分、Kaizのsection生成と後続resolver差分、公式v1.10.2説明、AE導入の2ファイル差分、AE実JARのoffset/equals。ソースコード変更なし。作者への追加問い合わせ・境界端点の新規実機試験は未実施。
