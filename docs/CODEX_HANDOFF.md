# Codex・開発者間 引継ぎ帳

このファイルは、ローカルで作業する開発者とChatGPT/Codexの双方向の情報共有に使います。
どちらが更新しても構いません。作業前に読み、作業後に更新してください。

最終更新: 2026-08-31

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
- 自動分割レールについて、グループUUIDで物理コアを論理レール単位にまとめ、共通の論理端点2個を選択する処理と、KaizPatchX標準APIによる再分割処理を追加済み（実機検証待ち）。

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

- 自動分割レールの論理端点選択と再分割処理を追加済み。レールブロックを一度撤去して作り直すため、初回はバックアップ済みテストワールドで実機検証が必要。
- 再分割前に全グループコアのロード状態と在線を検証し、元端点を退避する。再配置失敗時には元形状を復元するが、ゲーム内で成功経路・復元経路とも未検証。
- RailPositionを大きく移動した場合に必要となるレール構成ブロックの再配置方法は未実装。
- RailPosition移動後のUndoは未実装。
- 仮のボタンテクスチャは未配置のパスを指定している。
- Prettier 3.9.6では既存のTypeScript 28ファイルが `pnpm format:check` に失敗する。全体整形を別作業として行うか判断が必要。

## 次に行うこと

1. バックアップ済みテストワールドでレールマーカー設置レールの論理端点が表示・選択できることを確認する。
2. 端点を小さく移動し、セクション群が再生成され、即時描画・再入場後の形状・レール情報が維持されることを確認する。
3. ログの `oldGroupCores`・`newGroupCores` とエラーを確認し、その後スナップや接続成立判定の仕様を決める。

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

- 2026-08-31 ローカルCodex:
  確認してほしいこと: 自動分割レールの論理端点を選択・移動でき、セクション数が固定値に依存せず再計算されること。
  確認方法: 必ずバックアップ済みテストワールドを使用する。レールマーカー設置レールの端点を選択し、まず0.25m程度移動してEnterで適用する。即時描画と再入場後の形状を確認し、問題がなければ反対側端点も試す。
  結果の記入先: 結果をチャットで共有し、`latest.log` を `logs/rail-position-section-rebuild-YYYYMMDD-HHMM-client.log` として配置する。

## 作業記録

新しい記録を上に追加します。詳細な議論がGitHub Issueにある場合は、要点とリンクだけを記載します。

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
- コミット: 未コミット
- 同期: 未実施。

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
