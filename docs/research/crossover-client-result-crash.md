# 渡り線生成失敗後のクライアントクラッシュ

## 結論（2026-10-24、ローカルCodex）

**SRBX側の不具合であり、レールモデルの描画スクリプトが直接の原因ではない。** 渡り線ツールの描画コールバックでサーバー結果を処理する際、`null`のレール更新要素から`key`を読んでクラッシュしている。専用サーバーの`ITooltipFlag`欠落とは別の不具合だが、その生成失敗が今回の発火条件になっている。

## ログの根拠

再配置された`logs/latest.log`の11:20:44:

```text
On render script : SuperRailBuilderX_CrossoverBuilder
Script exec error : render in file: minecraft:scripts/superrailbuilderx/render_builder1.js
TypeError: Cannot get property "key" of null
...handleResult(<eval>:60470)
...handleInput(<eval>:60928)
...render(<eval>:61054)
```

ここで描画されているのはSRBXのツール車両である。`RenderVehicleBase`/`RenderWeatherEffectDummy`はその呼出経路で、例外の発生元はSRBXの`handleResult`。レールモデル固有の描画関数で失敗したスタックではない。

## 発生経路

1. 同時刻のサーバーログでは、自由始点の渡り線生成が通常レール部分の生成で失敗し、`single crossover split exception: ...replacement creation failed: 0`からrollbackへ進む。
2. AE用`AppleExtendedRailToolsCompat.rollbackBranch`は、元レールのある生成なら`restoreRecord`の結果を更新対象として送る。自由始点では`record.source`がなく、`restored`は`null`になる。
3. 旧コードはこの場合も`refreshed: [restored]`、つまり`refreshed: [null]`を返していた。サーバーは失敗結果でもクライアントのゴーストを消すため更新データを送る。
4. `render_builder1.handleResult`は各要素が存在する前提で`update.refreshed[i].key`を参照しており、結果チャットの表示・待機解除より前に例外となる。

実際の通信JSON全文はログにないが、このサーバー側構築経路とクライアント結果処理を使い、修正前の実コードで同じnull/key例外を再現した。サーバーの生成失敗は本来エラーメッセージとして処理すべきもので、クライアントクラッシュにする必要はない。

## 修正と波及

- 送信側: 自由始点のrollbackは`refreshed: []`にし、存在しない復元対象を送らない。途中で作成・削除した実レールの`removed`は維持する。元レールの復元がある場合は従来どおり実対象を送る。
- 受信側: 渡り線・分岐・線路分割の更新配列からnullを除外し、nullの配列も空として扱う。有効な削除/再描画と、同じキーの再生成対象をゴースト削除しない規則は維持する。
- 不正なnull要素を無視した場合は`[SuperRailBuilderX client update] ignored null rail entries: tool=...`を出力する。生成失敗の表示と選択の保持を続け、再試行できる状態へ戻す。
- AE/Kaizで共用するクライアントスクリプトの修正であり、両環境に適用される。レールモデル、AE/Kaiz本体、JAR、パッチMod、参照ツールキットは変更しない。

回帰では、自由始点の失敗復元にnull対象が含まれないことと、3ツールの旧形式`refreshed:[null]`/null混在/空配列相当での例外防止・失敗通知・待機解除・選択保持・有効対象更新を確認する。修正前のクライアント回帰はログと同じ例外で失敗した。

## 実機再確認とログ保持

最新開発ZIPを両側へ統一し、自由始点の渡り線で生成失敗になってもクライアントが落ちず、失敗表示後に操作を続けられることを確認する。成功時の表示、既設レール選択からの生成、分岐/分割の失敗とUndoも確認する。

今回の元`logs/latest.log`は、前回失った末尾例外を含む再調査資料として、実機再確認が終わるまで変更せずローカル保持する。Gitへは追加しない。確認終了後に整理する際も、最初の例外から全`Caused by`とSRBXのフレームを確認してから、必要なスタック全体を残す。

以前のクライアントログはGit非追跡だったため、コミットからの復元対象ではなかった。再発防止のため、調査中の別例外を「無関係」と決めて削除しない。
