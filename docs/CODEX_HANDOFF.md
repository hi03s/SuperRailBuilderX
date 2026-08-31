# Codex・開発者間 引継ぎ帳

このファイルは、ローカルで作業する開発者とChatGPT/Codexの双方向の情報共有に使います。
どちらが更新しても構いません。作業前に読み、作業後に更新してください。

最終更新: 2026-09-01

## 現在の状態

- rtm-ts 0.12.0を使用した初期環境を構築済み。
- kaizpatch、mc1710、mc1122のmulti-target構成を準備済み。
- NGTOBuilder2のツールキット、サンプルスクリプト、暫定モデル・テクスチャを導入済み。
- RailPosition自由化を確認する試験ツールを実装済み。
- RailPosition自由化の調査結果を `docs/rail-position-free-positioning.md` に記録済み。
- `pnpm gen` と全3ターゲットの `pnpm build` が成功する状態を確認済み。
- RailPosition試験ツールへ、候補探索の例外ガード・診断ログと適用後のクライアントRailMap再生成を追加済み。適用直後の描画更新は実機確認済み。
- NGTOBuilder2と同じ共有compatパスによるキャッシュ衝突を避けるため、RailPosition専用APIをSuperRailBuilderX固有compatへ分離済み。NGTOBuilder2併用環境で未定義エラー解消を確認済み。
- `lib_hi03toolkit_1_0` は今後編集しない参照専用領域とし、共通スクリプトは `src/common/assets/minecraft/scripts/superrailbuilderx` に置く方針を恒久化済み。
- 自動分割レールについて、論理端点選択、KaizPatchX標準APIによる可変セクション再生成、同じ接続点にある2本の同時移動まで実機確認済み。
- 通常レール移動後の即時描画、保存、同じ接続点にある2本の同時移動まで実機確認済み。
- 通常レールの移動後曲線へ不足道床TileEntityだけを追加する処理と、分岐器を安全に対象外にするガードを追加済み（実機検証待ち）。

## 作業中

なし。

作業を始める人またはCodexは、作業環境を識別できる担当名で次の形式により追記してください。

```text
- 担当: 人間 / ローカルCodex / その他の環境を識別できる名前
  開始日: YYYY-MM-DD
  内容: 作業内容
  変更予定: 主に変更するファイル
```

## 未解決・確認待ち

- 通常レールの不足道床を追加する処理は実機未検証。旧道床は安全優先で削除せず、既存レール道床も上書きしないため、移動量に応じて未使用道床が残る。
- 自動分割レールの移動先が他レール道床や障害物と重なる場合は、既存レール破壊を避けるため `roadbed_conflict(N)` で停止する。同一ブロックへ複数の道床所有コアを保存できないRTM構造への恒久対応は未設計。
- 分岐器は専用構造を通常レール処理で変更すると描画が壊れるため対象外にした。全RailPositionと分岐状態を保つ専用移動処理は未実装。
- RailPosition移動後のUndoは未実装。
- 仮のボタンテクスチャは未配置のパスを指定している。
- Prettier 3.9.6では既存のTypeScript 28ファイルが `pnpm format:check` に失敗する。全体整形を別作業として行うか判断が必要。

## 次に行うこと

1. バックアップ済みテストワールドで通常レールを旧道床範囲外へ動かし、ログに `additive roadbed update: added=... removed=0` が出ることと、列車が `Rail not found` で停止せず走行することを確認する。
2. 分岐器の端点を選ぼうとし、移動候補にならずチャットに対象外表示が出ることを確認する。既に描画が壊れた分岐器は元RailPositionを復元できないため、バックアップ復元または分岐器再設置が必要。
3. 前回失敗した移動先を再試行し、失敗時は `roadbed conflict` の件数・座標・ブロック名、成功時は道床と走行を確認する。

## 開発者からCodexへの連絡欄

ここには、ローカル作業で分かったことや、次回Codexへ依頼したいことを書いてください。
Codexは内容を確認後、処理済みの項目を作業記録へ移すか、回答を追記します。

```text
- YYYY-MM-DD 開発者:
  依頼・共有内容:
  関連ファイルまたはIssue:
```

## Codexから開発者への連絡欄

ここには、実機確認を依頼したい内容、判断が必要な仕様、ローカル環境でのみ可能な検証を書きます。

```text
- YYYY-MM-DD ローカルCodex / その他の環境を識別できる名前:
  確認してほしいこと:
  確認方法:
  結果の記入先:
```

- 2026-09-01 ローカルCodex:
  確認してほしいこと: 通常レールの不足道床追加で範囲外走行が可能になること、分岐器が選択対象外になること、前回の失敗位置で衝突理由が取得できること。
  確認方法: 必ずバックアップ済みテストワールドを使用する。上記「次に行うこと」の順に確認し、`Rail not found`、`roadbed_conflict`、分岐器の描画変化の有無を共有する。
  結果の記入先: 結果をチャットで共有し、`latest.log` を配置する（ローカルCodexが内容に応じて改名する）。

## 作業記録

新しい記録を上に追加します。詳細な議論がGitHub Issueにある場合は、要点とリンクだけを記載します。

### 2026-09-01 ローカルCodex — 道床追加・分岐器ガード・移動先衝突診断

- 実機で通常レール、自動分割レール、同じ接続点にある2本の同時移動が正常に動作したことを確認。
- `logs/latest.log` で自動分割再構築の失敗と復元成功を確認。1件は2本目で失敗する `partial_target_1:section_rebuild_failed` だったが、従来ログでは衝突座標までは特定できなかった。
- KaizPatchX v1.10.3一次ソースを確認。列車は走行位置下の `TileEntityLargeRailBase` から所有コアを取得するため、RailMapだけを移動すると旧道床範囲外で `Rail not found` になる。
- 通常レールでは変更後RailMapから不足道床を計算し、空気・マーカー部分へ加算的に設置する処理を追加。旧道床・既存ブロック・他レール道床は削除も上書きもしない。
- 全対象の移動後道床範囲を適用前に検証。自動分割再構築が他レール道床や障害物を上書きする場合は `roadbed_conflict(N)` で停止し、最大8件の座標とブロック名をログへ出す。2本目の既知衝突なら1本目を動かす前に停止できる。
- 分岐器は3個以上のRailPositionと複数RailMapを持つ専用構造であるため、通常レール処理から除外し、専用対応まで選択不可とした。
- 同じサーバー結果を描画パスごとに3回チャット表示していた処理を、要求ごとに1回だけ処理するよう修正。
- 調査内容を `docs/rail-position-free-positioning.md` へ追記。ログを `logs/rail-position-roadbed-switch-retest-20260831-234758-client.log` へ改名して保存。
- `pnpm build` はkaizpatch・mc1710・mc1122の全ターゲットで成功。変更ファイルのPrettier確認と `git diff --check` も成功。
- ゲーム内で新しい道床追加・分岐器ガード・衝突診断は未検証。上記手順による再デバッグが必要。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/228f970da3c1a4bbc854b32194bfe3adede685ed
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — 自動分割例外修正・接続端点同時移動

- `logs/latest.log` を確認し、自動分割レールの検証時に `TileEntityLargeRailSectionCore` へ未変換名 `getWorldObj` を呼んで例外になっていたことを特定。例外は再構築開始前に発生しており、要求がリセットされないため毎tick繰り返されていた。
- 基本コア型を受け取るcompatヘルパーへワールド取得を集約し、生成後KaizPatchXスクリプトで `func_145831_w()` に変換されることを確認。
- 同じ精密座標（許容差1 mm）を共有する端点候補を接続点としてまとめ、1回の要求ですべて同じ移動先へ送るよう変更。ログでは同じ接続点で `candidates=2, uniqueCores=2` が記録されていた。
- サーバー側で対象数、同一元座標、端点の未変更、全セクションのロード・同一グループ・在線状態を全対象について事前検証してから順次適用するよう変更。適用途中の失敗は `partial_target_...` と適用済み件数をログへ残す。
- 適用処理を `try/finally` で保護し、例外時も要求を消費して毎tickの再実行を防止。
- 調査結果と接続端点の扱いを `docs/rail-position-free-positioning.md` へ追記。ログを `logs/rail-position-section-error-connected-endpoint-20260831-221005-client.log` へ改名して保存。
- `pnpm build` はkaizpatch・mc1710・mc1122の全ターゲットで成功。変更ファイルのPrettier確認と `git diff --check` も成功。
- ゲーム内検証は未実施。上記の「次に行うこと」に沿った再デバッグが必要。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/25f5778f0177a73e49bbd0284ce358ca99562c86
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — 自動分割レールの論理端点・再分割対応

- 診断ログで、対象レールが論理端点2個とセクションコア3個を持つ1グループであることを確認。始点・中間・終点付近のどのコアからも同じ構成を取得できた。
- KaizPatchX 1.10.3の実装を確認。始点・中間・終点コアはすべて同じ `TileEntityLargeRailSectionCore` と共通メタデータで配置され、端部はクラスやメタデータでは区別できない。コア数は跨ぐチャンクに応じて可変。
- 候補探索をグループUUIDで重複排除し、各コア共通の `getLogicalRailPositions()` が返す論理始点・終点を候補にするよう変更。
- 適用時はグループ座標リスト全件のロード・同一グループ判定と在線確認を行い、論理端点・レールプロパティ・信号・サブレールを退避するよう実装。
- KaizPatchX標準の `breakLogicalRail()` と `BlockMarker.createRail()` で変更後の曲線を再生成し、チャンク境界に応じてセクション数を再計算する処理を追加。失敗時には元端点から復元する。
- `docs/rail-position-free-positioning.md` へ自動分割構造、端部判定、可変セクション数、再構築手順と安全上の注意を追記。
- ログを `logs/rail-position-section-diagnostic-20260831-214139-client.log` へ改名して保存。
- `pnpm build` はkaizpatch・mc1710・mc1122の全ターゲットで成功。
- ゲーム内検証は未実施。レールを一度撤去・再配置する試験機能のため、バックアップ済みテストワールドで上記手順による再デバッグが必要。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/957ba58d54e49eb633de66a5700a765af938c272
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — レールマーカー設置レールの対象外診断

- `logs/latest.log` を確認。レールマーカー設置レールでは `uniqueCores=2, unsupportedCores=2, errors=0`、SRB3生成レールでは `unsupportedCores=0, candidates=1` だった。
- KaizPatchX 1.10.3の `TileEntityLargeRailSectionCore` を確認。レールマーカー設置レールは自動分割セクションで、`getLogicalRailPositions()` がコピーを返すため、通常レール用の更新処理をそのまま適用できないことを再確認。
- 対象外コアの理由、グループコア数、論理端点数を `unsupported core` として出力する診断をSuperRailBuilderX固有compatへ追加。
- 自動分割レールだけが見つかった場合、汎用の候補なし案内ではなく、現在選択対象外であることをチャットに明示するよう変更。
- 適用直後のレール描画更新が正常になったという実機結果を反映。
- ログを `logs/rail-position-retest2-20260831-211401-client.log` へ改名して保存。
- `pnpm build` はkaizpatch・mc1710・mc1122の全ターゲットで成功。
- ゲーム内での新しい診断表示は未検証。上記連絡欄の手順で再確認が必要。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/623bd590021f469837f4707a4f94477b04c937fc
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — ツールキットを参照専用化

- `src/common/assets/minecraft/scripts/lib_hi03toolkit_1_0` 内は今後編集・機能追加しないルールを `AGENTS.md` へ追加。
- SuperRailBuilderXの共通スクリプトは `src/common/assets/minecraft/scripts/superrailbuilderx` に格納し、ツールキット拡張も固有ラッパーとして実装する方針を追加。
- multi-target固有compatのみ、各ターゲットの同名 `superrailbuilderx` ディレクトリへ実装を置く例外を明記。
- 検証: `git diff --check` を実施。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/2b37c97fc04eeb34cea3c6f3caff26fe0a57cb59
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — NGTOBuilder2とのcompat衝突回避

- `logs/latest.log` を確認し、探索したレールタイル15件すべてが `getRailCorePos` 呼び出し時の `TypeError: Cannot call undefined` で失敗していることを特定。
- `lib_hi03toolkit_1_0/lib_RTMApiCompat` はNGTOBuilder2と同じパス・RTMXキャッシュ識別子を共有するため、NGTOBuilder2側の旧compatが先に初期化されるとSuperRailBuilderX追加メソッドが存在しない。ログの一律エラーと一致するため、これを原因と判断。
- RailPosition固有APIを `scripts/superrailbuilderx/RailPositionCompat` へ分離し、呼び出し元も固有compatへ変更。共有ツールキットcompatにはプロジェクト固有APIを残さない構成にした。
- ログを `logs/rail-position-retest-20260831-205024-client.log` へ改名して保存。
- `pnpm build` はkaizpatch・mc1710・mc1122の全ターゲットで成功。生成物が共有compatと異なる `scripts_superrailbuilderx_RailPositionCompat_1suqebq` を使い、KaizPatchX実装に対象メソッドが含まれることも確認。
- ゲーム内再検証は未実施。NGTOBuilder2を導入したまま上記の連絡欄に沿って再デバッグが必要。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/cbc49b6bb6634f64ad30607a493f4a7e394ff084
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — 実機フィードバック対応と診断強化

- 実機フィードバック受領時は、修正可能箇所を実装し、追加調査箇所にはガードと診断ログを用意して再デバッグを依頼する流れを `AGENTS.md` へ追加。
- セクションレール判定をJavaクラス名のリフレクションから `instanceof` 判定へ変更。
- 候補探索をブロック単位の `try/catch` で保護し、例外フェーズ・座標・スタックを `ErrorLogger` 経由で一度だけ出力するよう変更。
- 右クリック時に候補探索の集計を `NGTLog.debug` へ出力し、候補なしの場合はチャットへログ確認案内を表示。
- 適用成功後、クライアント側でもRailPositionを更新してRailMapを再生成し、`shouldRerenderRail` を有効化する処理を追加。
- `pnpm build` はkaizpatch・mc1710・mc1122の全ターゲットで成功。
- ゲーム内再検証は未実施。上記の連絡欄に再デバッグ手順を記載。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/4caaad5b0434b84870d6d4951c2ff59b6a5c124e
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — RailPosition試験ツールの実機フィードバック調査

- 開発者から、レール端の選択可否に差があること、適用直後は変化せず再入場後に移動が反映されることの報告を受領。
- `logs/crash-2026-08-31_19.12.16-client.txt` を確認。Minecraft 1.7.10、KaizPatchX 1.10.3で、描画中の `findCandidates` から `TypeError: Cannot call undefined` が発生している。
- クラッシュ行番号は展開後スクリプトの `findCandidates` 関数先頭に対応し、ログだけでは関数内のどのJava API呼び出しが未定義だったか確定できない。
- サーバー側は変更をNBTへ保存できている。一方、受信時の既存RailMapキャッシュが古いまま再利用されるため、再入場まで描画へ反映されない可能性が高い。
- コード修正とゲーム内再検証は未実施。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/daad112b597aaf19fca242f644b9354a8f770052
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — 作業環境の識別表記を追加

- このPC環境のCodexは、担当名・作業記録見出し・連絡欄の署名を「ローカルCodex」とするルールを `AGENTS.md` へ追加。
- この環境で作成した既存の作業記録3件を「Codex」から「ローカルCodex」へ変更。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/442174425c987df75458718ab79aff942b9660b6
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — コミット・同期運用の明文化

- 変更作業は、ユーザーから明示的に止められていない限り、検証と差分確認後にコミットする方針を `AGENTS.md` へ追加。
- コミット後は現在のブランチをリモートへpushし、同期結果を引継ぎ帳へ残す方針を追加。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/71844d445c1d38ec2ce90d35f38c829f1c4ce6ef
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — 生成・ビルド検証とmulti-target互換修正

- `pnpm gen` を実行し、kaizpatch・mc1710・mc1122の型定義とマッピング生成が成功。
- 共通コードにあった1.7.10専用の `xCoord` 参照をcompat層へ移し、mc1122では `getPos()` を使用するよう修正。
- KaizPatchの自動分割レール判定で、Javaオブジェクトの `getClass()` を明示的な補助型経由で呼ぶよう修正。
- `pnpm build` は全3ターゲットで成功。
- `pnpm format:check` は失敗。今回の変更前のHEAD版でも再現し、Prettier 3.9.6が既存のTypeScript 28ファイルを要整形と判定する。
- ゲーム内動作確認は未実施。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/b6fba9f28e454268178fd6da38389657387cdbcc
- 同期: `origin/main` へ同期済み。

### 2026-08-31 ローカルCodex — RailPosition試験ツール

- 視線位置の周囲から通常レールの端点を検索する処理を追加。
- 右クリック2回、Enter適用、左クリックで段階解除する操作を追加。
- 移動先を0.01 m単位へ丸める処理を追加。
- サーバー側で対象と元座標を再検証してから `setPosition` を呼ぶ構成にした。
- KaizPatchX以外と自動分割レールでは安全に無効化する方針とした。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/a38775600321aa91da6ea392994de69abea97252
- `pnpm format:check` とJSON検証は成功。
- `pnpm gen` は作業環境からGradle配布物へ接続できず未完了。

### 記録テンプレート

```text
### YYYY-MM-DD 名前 — 作業名

- 実施内容:
- 変更ファイル:
- 検証済み:
- 未検証・注意点:
- コミットまたはIssue:
- 次の担当者への連絡:
```
