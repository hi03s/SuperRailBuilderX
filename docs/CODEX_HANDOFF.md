# 開発者とローカルCodexの引継ぎ帳

最終更新: 2026-10-24（ローカルCodex、main）

## 現在の状態

- SRBX **0.4.0**。KaizPatchX 1.10.4+ / AppleExtended v2.5.4+を対象とし、rtm-ts 0.12.0未改変の4ターゲット構成を維持。
- **2026-10-23までの動作確認完了報告は受領済み。10/24に新規報告された専用サーバー条件は別途再確認が必要。** 生成A/B・複線コピー・組ホーム・分割・移動・カント・分岐・渡り線の9ツール、Undo、表示/再入場、走行、GUI/操作・ホイール、パッチなし運用を含む。
- AEの分岐生成、根元移動、即時表示と旧コア再利用の修正、Kaiz接続カントとUndoの修正も実機確認済み。[AE対応](development/appleextended-target.md)・[カント調査](research/cant-curve-rendering.md)。
- AE向け実装はv2.5.4以降専用で、**v2.5.3以前とは互換性なし**。パッケージ名・Mod IDを移行済み。README/同梱readme/リリース本文へ案内。
- 両環境ともSRBXPatchなしでツールを使用可能。AE2.5.4以降は走行補正も本体対応でパッチ不要。Kaizの自由端点走行補正には任意のSRBXPatch v1.0を使用。[任意パッチ](development/srbxpatch.md)。
- 渡り線生成Undo・分岐全体の平行移動は対象外。過去の変形レール/空コアの自動修復は行わない。上流由来の既知の形状判定/描画問題は[報告資料](research/kaizpatch-crossover-and-render-errors.md)を保持し、SRBXPatchへ用途外機能は追加しない。
- 0.4.0の変更は0.3.2以降のパッチ任意化・AE2.5.4移行・分岐/移動/表示・接続カント/Undo修正・説明書整理。[リリース本文](../release-notes.md)。NGTOBuilder2併用時は2.3.2へ更新する。[Issue #3調査](research/issue3-multiplayer-tool-crash.md)。
- 0.4.0は**Draft本文更新済み・開発者の手動Publish報告待ち**。対象は78ca1fc、タグv0.4.0。開発者からActions完了の報告を受領し、追加依頼で本文をv0.3.2と同じ3章の利用者向け構成へ統一した。未公開状態・タグ・添付物は維持。定期的な生成待ち・完了確認は行わない。[手順](development/releasing.md)。
- artifactsの最新開発版SuperRailBuilderX-0.4.0.zipは専用サーバー回避を反映（132ファイル/348137 bytes、distとの全件SHA一致・最新VERSION/readme・XCF/JAR/class非同梱）。配布用SuperRailBuilderX-v0.4.0.zipは以前の346826 bytesを保持し、両JARとともに未変更。旧開発0.3.2 ZIPは削除、過去配布ZIP/両v1.0 JARは保持・未変更。
- 通常型生成はJitPack v2.5.4 POM timeoutの既知制約あり。ローカルは公式AE2.5.4 dev JARと既存scannerで型生成済み。4ターゲットbuildと回帰成功。全体formatには既存未変更19ファイルの警告があり、変更分の確認は成功。詳細はAE資料へ集約。
- docs/user-guideは9ツールの説明書だけを配置。開発資料/調査/過去記録は各専用ディレクトリへ分類。[文書入口](README.md)。

- 2026-10-24のAE専用サーバー生成失敗は、NGTLibのtooltipに残るclient型をNashornが解決することが原因。実JAR/Java8で再現し、SRBXの公開API限定呼び出し・metadata取得回避を追加。AE/Kaizのカント再描画フィールドもclient側へ限定。全4build・関連回帰・開発ZIP更新済み、専用サーバー実機再確認待ち。[上流報告・手順](research/dedicated-server-side-api.md)。

- 再提出latest.logの11:20:44クラッシュはレールモデルではなくSRBXの渡り線handleResultのnull.key参照。AE自由生成rollbackがrefreshed:[null]を送る不具合を修正し、渡り線/分岐/分割の受信側もガード。旧コードで再現→修正後回帰・全4build成功、開発ZIPへ反映、実機再確認待ち。[原因と手順](research/crossover-client-result-crash.md)。

## 作業中

- 2026-10-23 ローカルCodex: 0.4.0のローカル準備・タグpush・Draft本文整理済み。作業を一旦停止し、開発者の手動Publish報告を待つ。

## 優先確認事項

- 渡り線の自由生成が失敗してもクライアントが落ちず、失敗表示→再試行できることを最新開発ZIPで確認する。元logs/latest.logは全スタックを含めて未変更で保持し、再確認完了後に整理する。レールモデルの描画スクリプトは今回の直接原因ではない。

- AE/Kaizの専用サーバーで両側を同じ最新開発ZIPへ統一し、生成A/B・自動分割・渡り線・既設道床接続・移動/分割/分岐・カント/Undo・再入場を確認する。AEのclientログ検出名は旧0.3.2、serverは0.4.0だったため旧ZIP残存にも注意。異常時は操作/時刻とlogs/latest-client.log・latest-server.log（creation exceptionの欠落型/path/sideを含む）を共有する。
- AE側のBlockContainerCustom/BlockCustom.addInformationにSideOnly漏れを確認。SRBX回避は実装済みだが、上流の恒久修正は開発者から報告する。Kaizに同じtooltip問題は見つからず、render fieldガードのみ追加。
- 開発者がActions結果・0.4.0 Draft本文/Assetsを確認し、手動Publishを報告する。報告を受けて作業完了とする。ローカルCodexは待機・定期確認・公開操作を行わない。

## 次に行うこと

1. 最新開発ZIPで専用サーバーを再確認する。今回の修正は0.4.0の配布用ZIP/Draft Assets/タグには反映していないため、公開・追加リリースの判断は開発者が行う。手動Publish報告待ちの状態は維持する。
2. 新しい不具合があれば操作順・時刻と新しいログで調査を開始する。過去の確認手順を未完了として再掲しない。

## 双方向連絡

- 新規リポジトリ/フォーク/Issue/PR/コメント投稿は禁止。既存ブランチ・コミット・push・ビルドと、今回依頼された手動Publish用リリース準備を行う。
- rtm-ts、参照専用ツールキット、本番サーバー、Mod/JARのソースを変更しない。コミットメッセージは日本語。
- 実機確認は開発者が実施し、ローカルCodexはビルド・回帰・配布物確認を担当。生ログはGitへ保存しない。今回の専用サーバーログは関連SRBX行とパック検出名だけの抜粋をローカル保持し、PC情報・ユーザー名・無関係なModログは削除する。
- ユーザー作業中のbutton_template.xcf変更とgui_base.xcfは保持し、コミット/配布物へ含めない。

## 直近の完了

- 2026-10-24 ローカルCodex: 渡り線失敗後のクライアントnull.keyクラッシュをSRBXの送受信処理と特定・修正。3ツールのnull混在回帰/AE自由rollback/全4buildと関連回帰成功、開発ZIP更新。元ログは保持、実機再確認待ち。開始記録a554960。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-24 ローカルCodex: AE専用サーバーのITooltipFlag欠落を実JARで再現し、SRBXの限定公開API呼出/metadata取得と両版カントのsideガードを修正。全4build・Java8/関連回帰成功、開発ZIP更新、実機再確認と上流報告待ち。開始記録fcb4ffe。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-23 ローカルCodex: 追加依頼により0.4.0 Draft本文をv0.3.2と同じ3章へ統一し、開発情報を削除。ローカル本文とGitHub本文の一致・未公開/タグ/添付物の保持を確認、ビルド/Actions再実行なし。開始記録b23a37f。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-23 ローカルCodex: 開発者の全動作実機確認完了を反映。0.4.0のVERSION・案内・本文とZIPを準備し、AE旧版非互換とパッチ不要を明記。全4build・関連10スクリプト・変更分整形・ZIP照合成功。開始記録9b5b132。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-23 ローカルCodex: Kaiz接続カント/UndoとAE旧コア再利用を修正（e02eb6f）。その前のAE分岐生成/根元移動/表示修正（2bec4d7）、パッチ任意化/AE2.5.4移行（eccb70f）も実機確認済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

## 関連資料

- [利用者向け説明書](README.md#利用者向け)・[リリース手順](development/releasing.md)
- [共通レール生成](development/rail-generation-and-free-positioning.md)・[SRBXPatch開発](development/srbxpatch.md)
- [自由端点/台車遷移](research/rail-transition-research.md)・[道床/CrossTie](research/roadbed-ownership-investigation.md)
- [10月履歴](history/CODEX_HISTORY_2026-10.md)・[9月履歴](history/CODEX_HISTORY_2026-09.md)
