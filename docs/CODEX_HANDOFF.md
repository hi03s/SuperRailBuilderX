# 開発者とローカルCodexの引継ぎ帳

最終更新: 2026-10-12（ローカルCodex、main）

## 現在の状態

- SRBX 0.3.0、main。rtm-ts 0.12.0を改造せず、KaizPatch/AE/通常RTM 1.7.10/通常RTM 1.12.2の4ターゲット構成を維持。
- KaizPatchX 1.10.4 / AppleExtended 2.5.3は完全自由点仕様。SRBXパックと対象SRBXPatch JARを併用する。基本はクライアント/サーバー双方へ導入し、SRBX未導入クライアントにはJAR不要。本家対応までの暫定処理。[導入](user-guide/srbx-free-endpoint-mod.md)。
- 生成・移動・分割・複線・カント・分岐・Undoは共通の道床/コア保護を使用。理論両端各1タイルの所有先変更、競合時の逆順→設定上限内の通常生成、撤去前の所有先復元に対応。[道床調査](research/roadbed-ownership-investigation.md)。
- AE重複区間・自動分割境界対策は実機確認済み（2026-10-11）。KaizのCrossTieあり/なしも実機動作を確認済み。[AE対策](research/appleextended-overlap-rail-patch.md)。
- 生成Aの自由点間はカーソルXZと目標勾配から高さを決める。Bは始点・半径・長さから終点を計算（初期40m、ホイール±1m/Ctrl±10m、J/K±0.1m）。勾配/縦曲線GUI、7ツールのホイール、AE日本語ヘルプを追加。実機確認待ち。[A](user-guide/builder1.md)・[B](user-guide/builder2.md)。
- AEのTAB拒否は非乗車追従へ乗車必須チェックを適用していたことが原因。bb224faでcompat判定と切替後のサーバーホスト引継ぎを修正しpush済み。全4build・入力/GUI/dispatch/AE回帰・Java8ホイール成功、実機再確認待ち。
- [v0.3.0 Draft](https://github.com/hi03s/SuperRailBuilderX/releases/tag/untagged-ade4983c2b433faa8c63)は未公開。タグ228e407のパックと2 JARを添付済み。公開は開発者の手動Publish。後続mainの変更は既存Draft/タグ/Assetsへ反映していない。[リリース手順](development/releasing.md)。
- artifactsには最新mainパック`SuperRailBuilderX-0.3.0.zip`、タグ時点の`SuperRailBuilderX-0.3.0-v0.3.0.zip`、環境別SRBXPatch JARだけを保持。テスト生成物は.cacheへ移動。
- docsは[user-guide](user-guide/)、[development](development)、[research](research/)、[history](history)へ分類。文書入口は[README](README.md)。logsは原則Git保存しない。

## 作業中

- なし。

## 優先確認事項

- 最新AEログでは端点ガードとモデル切替は正常。中間点分岐の仮分割コア競合、置換レールの外部カントUndo誤登録、失敗復元時のクライアント同期を修正。最新ZIPで両方向の分岐生成・両側保持・Undo・生成失敗後の復元を確認する。描画パッチのSMP空一覧も修正し、`local rail registry: models=N`と`completed: patched=..., failed=...`を確認する。異常時はlogs/latest.logを共有する。
- KaizPatch/AEで生成Aの自由点勾配と既設接続、BのL/R/長さ/スナップ/生成/Undo、7ツールのホイールと日本語ヘルプを確認する。
- 道床所有履歴の専用WorldSavedDataへの変更は模擬保存/再読込まで確認済み。生成・接続移動・分割・Undoと再入場後の未選択レール保持を実機確認する。本番サーバーは操作しない。
- 状態GUI、カントの理論レール単位選択/両端適用/0km/h/±50、CTRL中の移動ホバー抑止、分岐スナップは関連回帰成功。未確認の実機条件は操作順とログで確認する。
- SRBX未導入/JARなしクライアント接続は設計上許可するが、実機接続は未確認。
- v0.3.0 Draftの本文/Assets確認後に開発者が手動Publishする。ローカルCodexは公開しない。

## 次に行うこと

1. 最新main ZIPで上記の実機確認を行う。異常時は機能・操作順・時刻とlogs/latest.logを共有する。
2. 確認結果を引継ぎ帳へ反映し、不要になったローカルログを削除する。調査結果は文書へ要約し、生ログをGitへ追加しない。
3. リリースするコード範囲を確認し、手動Publishを行う。

## 双方向連絡

- 新規リポジトリ/フォーク/Issue/PR/コメント投稿は禁止。既存ブランチ・コミット・push・ビルドだけを行う。
- rtm-ts、参照専用ツールキット、本番サーバーを変更しない。コミットメッセージは日本語。
- ローカルに保持する調査ログは、最新AEログとKaiz保存APIの例外抜粋。解消を確認した分岐クラッシュの旧抜粋は削除。実機再確認後に不要なら削除する。

## 直近の完了

- 2026-10-12 ローカルCodex: AE中間点分岐の生成順序・Undo対象・失敗時再描画と描画パッチ列挙先を修正。全4build・関連回帰成功、最新ZIP更新、実機再確認待ち。[244e4e2](https://github.com/hi03s/SuperRailBuilderX/commit/244e4e2)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: AE分岐描画の未初期化端点ガードと描画パッチ待機条件を修正。全4build・関連回帰成功、実機再確認待ち。[2d4a57b](https://github.com/hi03s/SuperRailBuilderX/commit/2d4a57b)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: 成果物を4ファイルへ整理し、不要ログ58件を削除。logsはGit追跡から除外。文書分類・調査統合・説明書の利用者向け整理とリンク検証を完了。[0824ed2](https://github.com/hi03s/SuperRailBuilderX/commit/0824ed2)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: AEの非乗車TAB切替とホスト引継ぎをbb224faで修正・push済み。実機再確認待ち。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

## 関連資料

- [利用者向け説明書](README.md#利用者向け)
- [共通レール生成](development/rail-generation-and-free-positioning.md)・[SRBXPatch開発](development/srbxpatch.md)
- [自由端点/台車遷移の統合調査](research/rail-transition-research.md)・[道床/CrossTie](research/roadbed-ownership-investigation.md)
- [10月履歴](history/CODEX_HISTORY_2026-10.md)・[9月履歴](history/CODEX_HISTORY_2026-09.md)
