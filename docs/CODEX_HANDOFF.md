# 開発者とローカルCodexの引継ぎ帳

最終更新: 2026-10-23（ローカルCodex、main）

## 現在の状態

- SRBX **0.4.0**。KaizPatchX 1.10.4+ / AppleExtended v2.5.4+を対象とし、rtm-ts 0.12.0未改変の4ターゲット構成を維持。
- **開発者から全動作の実機確認完了報告を受領（2026-10-23）。従来の動作確認事項はすべて確認済み。** 生成A/B・複線コピー・組ホーム・分割・移動・カント・分岐・渡り線の9ツール、Undo、表示/再入場、走行、GUI/操作・ホイール、パッチなし運用を含む。
- AEの分岐生成、根元移動、即時表示と旧コア再利用の修正、Kaiz接続カントとUndoの修正も実機確認済み。[AE対応](development/appleextended-target.md)・[カント調査](research/cant-curve-rendering.md)。
- AE向け実装はv2.5.4以降専用で、**v2.5.3以前とは互換性なし**。パッケージ名・Mod IDを移行済み。README/同梱readme/リリース本文へ案内。
- 両環境ともSRBXPatchなしでツールを使用可能。AE2.5.4以降は走行補正も本体対応でパッチ不要。Kaizの自由端点走行補正には任意のSRBXPatch v1.0を使用。[任意パッチ](development/srbxpatch.md)。
- 渡り線生成Undo・分岐全体の平行移動は対象外。過去の変形レール/空コアの自動修復は行わない。上流由来の既知の形状判定/描画問題は[報告資料](research/kaizpatch-crossover-and-render-errors.md)を保持し、SRBXPatchへ用途外機能は追加しない。
- 0.4.0の変更は0.3.2以降のパッチ任意化・AE2.5.4移行・分岐/移動/表示・接続カント/Undo修正・説明書整理。[リリース本文](../release-notes.md)。NGTOBuilder2併用時は2.3.2へ更新する。[Issue #3調査](research/issue3-multiplayer-tool-crash.md)。
- 0.4.0は**Actions起動済み・開発者の手動Publish報告待ち**。対象は78ca1fc、タグv0.4.0。[リリースActions](https://github.com/hi03s/SuperRailBuilderX/actions/runs/39832788933)でDraftとパックZIP＋Kaiz用任意JARを準備する。AE用旧JARは添付しない。以後の生成待ち・完了/Draft/Assets確認はローカルCodexでは行わない。[手順](development/releasing.md)。
- artifactsの最新パックは開発版SuperRailBuilderX-0.4.0.zipと配布用SuperRailBuilderX-v0.4.0.zip。132ファイル/346826 bytes、distとの全件SHA一致・最新VERSION/readme・XCF/JAR/class非同梱を確認。旧開発0.3.2 ZIPは削除、過去配布ZIP/両v1.0 JARは保持・未変更。
- 通常型生成はJitPack v2.5.4 POM timeoutの既知制約あり。ローカルは公式AE2.5.4 dev JARと既存scannerで型生成済み。4ターゲットbuildと回帰成功。全体formatには既存未変更19ファイルの警告があり、変更分の確認は成功。詳細はAE資料へ集約。
- docs/user-guideは9ツールの説明書だけを配置。開発資料/調査/過去記録は各専用ディレクトリへ分類。[文書入口](README.md)。

## 作業中

- 2026-10-23 ローカルCodex: 0.4.0のローカル準備・タグpush・Actions起動確認済み。作業を一旦停止し、開発者の手動Publish報告を待つ。

## 優先確認事項

- **動作確認事項はすべて確認済み。** 開発者の実機完了報告に基づき、従来の再確認待ち一覧を解消した。
- 開発者がActions結果・0.4.0 Draft本文/Assetsを確認し、手動Publishを報告する。報告を受けて作業完了とする。ローカルCodexは待機・定期確認・公開操作を行わない。

## 次に行うこと

1. 開発者の手動Publish報告を受けて0.4.0の作業中項目を完了へ更新する。失敗や追加確認の依頼があった場合だけ調査を再開する。
2. 新しい不具合があれば操作順・時刻と新しいログで調査を開始する。過去の確認手順を未完了として再掲しない。

## 双方向連絡

- 新規リポジトリ/フォーク/Issue/PR/コメント投稿は禁止。既存ブランチ・コミット・push・ビルドと、今回依頼された手動Publish用リリース準備を行う。
- rtm-ts、参照専用ツールキット、本番サーバー、Mod/JARのソースを変更しない。コミットメッセージは日本語。
- 実機確認は開発者が実施し、ローカルCodexはビルド・回帰・配布物確認を担当。生ログはGitへ保存しない。今回確認済みとなったカントログ抜粋は不要になったため削除する。
- ユーザー作業中のbutton_template.xcf変更とgui_base.xcfは保持し、コミット/配布物へ含めない。

## 直近の完了

- 2026-10-23 ローカルCodex: 開発者の全動作実機確認完了を反映。0.4.0のVERSION・案内・本文とZIPを準備し、AE旧版非互換とパッチ不要を明記。全4build・関連10スクリプト・変更分整形・ZIP照合成功。開始記録9b5b132。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-23 ローカルCodex: Kaiz接続カント/UndoとAE旧コア再利用を修正（e02eb6f）。その前のAE分岐生成/根元移動/表示修正（2bec4d7）、パッチ任意化/AE2.5.4移行（eccb70f）も実機確認済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

## 関連資料

- [利用者向け説明書](README.md#利用者向け)・[リリース手順](development/releasing.md)
- [共通レール生成](development/rail-generation-and-free-positioning.md)・[SRBXPatch開発](development/srbxpatch.md)
- [自由端点/台車遷移](research/rail-transition-research.md)・[道床/CrossTie](research/roadbed-ownership-investigation.md)
- [10月履歴](history/CODEX_HISTORY_2026-10.md)・[9月履歴](history/CODEX_HISTORY_2026-09.md)
