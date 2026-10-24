# 開発者とローカルCodexの引継ぎ帳

最終更新: 2026-10-24（ローカルCodex、main）

## 現在の状態

- SRBX **1.0.0**。KaizPatchX 1.10.4+ / AppleExtended v2.5.4+、rtm-ts 0.12.0未改変の4ターゲット構成。AE v2.5.3以前とは互換性なし。
- **2026-10-24、開発者から全問題の解決・実機確認完了の報告を受領済み。** AE/Kaizのシングル・マルチ、生成・分割・移動・接続カント/Undo・表示/再入場・ツール切り替え・版照合を含み、過去の再確認事項は完了扱い。
- AE専用サーバーのITooltipFlag、Kaiz切り替えのIModelNGT、渡り線失敗後のnull参照をSRBX側で回避・修正。上流報告用の原因は[専用サーバー調査](research/dedicated-server-side-api.md)と[渡り線調査](research/crossover-client-result-crash.md)へ集約。Mod/JAR・参照ツールキット・SRBXPatchは未改変。
- 全9ツールで両側の版/プロトコル/接続応答を照合し、不一致・確認不能なら編集/Undo/切り替えを停止。起動直後の応答待ちは無通知、Q終了は維持。[設計](development/client-server-version-guard.md)。
- 両環境ともツールはパッチなしで使用可能。AEは走行補正も本体対応でパッチ不要。Kaizの自由端点走行補正には任意のSRBXPatch v1.0を使用。[任意パッチ](development/srbxpatch.md)。
- 渡り線生成Undo・分岐全体の平行移動・既存の変形レール/空コアの自動修復は対象外。上流の既知の形状判定/描画問題は[報告資料](research/kaizpatch-crossover-and-render-errors.md)を保持し、パッチへ用途外機能は追加しない。
- v0.4.0はGitHubで公開済みと確認。1.0.0本文は0.4.0以降の変更だけを、前回同様「追加・操作変更」「主な不具合修正」「配布物・導入方法」の3章へ整理。[本文](../release-notes.md)。
- ローカル成果物はSuperRailBuilderX-1.0.0.zipと配布用SuperRailBuilderX-v1.0.0.zip（134ファイル/351723 bytes、同一SHA、全件dist一致、XCF/JAR/class非同梱）。旧開発0.4.0 ZIPは削除。過去配布ZIPと両v1.0パッチJARは未変更。
- 全4build、関連14テストスクリプト群、Java8/Nashorn、変更分Prettier・ZIP照合成功。通常型生成のJitPack POM timeoutは既知制約のため再試行せず、既存の正規生成済み型を使用。全体formatには以前から未変更19ファイルの警告あり。
- docs/user-guideは9ツールの説明書だけを配置。[文書入口](README.md)。

## 作業中

- 2026-10-24 ローカルCodex: **Actions起動済み・開発者の手動Publish報告待ち**。対象タグ`v1.0.0`。[リリースActions](https://github.com/hi03s/SuperRailBuilderX/actions/workflows/release.yml?query=branch%3Av1.0.0)。起動確認後は生成待ち・進捗取得・Draft/Assets確認を行わず停止する。開始記録8cbe948。

## 優先確認事項

- 開発者が1.0.0のActions結果・Draft本文とZIP/任意Kaiz JARを確認し、手動Publishを報告する。報告を受けてリリース作業を完了とする。実機の確認事項は残っていない。
- AE/Kaiz本体のSideOnly型宣言に関する上流連絡は開発者に任せる。SRBXの回避は実機確認済みで、リリースの阻害事項ではない。

## 次に行うこと

1. 開発者から手動Publishの報告を受けたら1.0.0の公開完了を記録する。Actions失敗や追加確認の依頼があった場合だけ調査を再開する。
2. 新しい不具合は操作順・時刻と新しいログで調査する。完了済みの実機確認を未完了として再掲しない。

## 双方向連絡

- 新規リポジトリ/フォーク/Issue/PR/コメント投稿は禁止。既存ブランチのcommit/push/buildと、依頼された手動Publish用のリリース準備を行う。
- rtm-ts、参照専用ツールキット、本番サーバー、Mod/JAR・パッチソースを変更しない。コミットメッセージは日本語。
- 実機確認は開発者、ビルド・回帰・配布物確認はローカルCodexが担当。生ログはGitへ保存しない。報告に必要なスタックを確認した上で整理する。
- ユーザー作業中のbutton_template.xcf変更とgui_base.xcfは保持し、コミット/配布物へ含めない。

## 直近の完了

- 2026-10-24 ローカルCodex: 全問題の実機確認完了と0.4.0公開済みを反映し、1.0.0の版表記・利用者向け本文・成果物を準備。全4build/関連回帰/ZIP照合成功。タグpush・Actions起動確認で停止し、手動Publish報告待ち。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

## 関連資料

- [利用者向け説明書](README.md#利用者向け)・[リリース手順](development/releasing.md)
- [共通レール生成](development/rail-generation-and-free-positioning.md)・[SRBXPatch開発](development/srbxpatch.md)
- [自由端点/台車遷移](research/rail-transition-research.md)・[道床/CrossTie](research/roadbed-ownership-investigation.md)
- [10月履歴](history/CODEX_HISTORY_2026-10.md)・[9月履歴](history/CODEX_HISTORY_2026-09.md)
