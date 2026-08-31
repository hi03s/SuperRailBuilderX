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

## 作業中

現在、共有されている作業中項目はありません。

作業を始める人またはCodexは、作業環境を識別できる担当名で次の形式により追記してください。

```text
- 担当: 人間 / ローカルCodex / その他の環境を識別できる名前
  開始日: YYYY-MM-DD
  内容: 作業内容
  変更予定: 主に変更するファイル
```

## 未解決・確認待ち

- RailPosition試験ツールは、実際のKaizPatchX環境での動作確認が必要。
- 自動分割された `TileEntityLargeRailSectionCore` の編集は、初版では対象外。
- RailPositionを大きく移動した場合に必要となるレール構成ブロックの再配置方法は未実装。
- RailPosition移動後のUndoは未実装。
- 仮のボタンテクスチャは未配置のパスを指定している。
- Prettier 3.9.6では既存のTypeScript 28ファイルが `pnpm format:check` に失敗する。全体整形を別作業として行うか判断が必要。

## 次に行うこと

1. ゲーム内で通常レール端点の探索、選択、移動先確定、Enter適用を確認する。
2. エラーや想定外の挙動があれば、ログと再現手順をこのファイルかGitHub Issueへ記録する。
3. 試験結果をもとに、スナップや接続成立判定の仕様を決める。

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

## 作業記録

新しい記録を上に追加します。詳細な議論がGitHub Issueにある場合は、要点とリンクだけを記載します。

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
