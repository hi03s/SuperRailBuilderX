# Codex・開発者間 引継ぎ帳

このファイルは、次の作業に必要な現行情報だけを共有するための短期引継ぎ帳です。詳細な過去記録は `docs/history/` に保存し、通常は読みません。

最終更新: 2026-09-04（Web側Codex）

## 現在の状態

- rtm-ts 0.12.0、`kaizpatch`・`mc1710`・`mc1122`のmulti-target環境を構築済み。
- NGTOBuilder2由来のツールキットは `src/common/assets/minecraft/scripts/lib_hi03toolkit_1_0` に置き、参照専用とする。SuperRailBuilderX固有処理は `superrailbuilderx` ディレクトリと `SRBXApiCompat` に実装する。
- RailPosition自由化試験ツールと、自動分割レールを単一コアの通常レールとして再生成する試験モデルを実装済み。基本的な端点移動・クライアント反映・走行は一部実機確認済み。
- `SuperRailBuilderX_builder1`を実装済み。自由点・既設端接続、曲線半径固定、勾配・縦曲線、複数レール一括Undo、道床・コア保護を備える。-X/-Z道床と勾配・縦曲線は実機確認済み。
- `SuperRailBuilderX_RailSplitter`を実装済み。論理RailMap強調、約0.25 m間隔の候補、予定長表示、手持ちモデルによる2本生成、分割前状態へ戻すUndoを備える。
- `SuperRailBuilderX_DoubleTrackCopy`を実装済み。通常レールの複数選択、カーソル距離に応じた指定間隔の反復複製、水平平行線形、0.5 m端点接続、手持ち/複製元モデル、一括Undoを備える。
- 最新`main`で`pnpm gen`と`pnpm build`が成功し、線路分割ツールを含む全3ターゲットの生成・ビルドを確認済み。
- レール生成・自由点移動の構造は `docs/rail-generation-and-free-positioning.md`、各ツールの仕様と検証方法は下記「関連資料」を参照する。

## 作業中

現在、作業中の項目はありません。

作業を開始する場合だけ、次の形式で1件追記します。完了時に削除し、結果は「直近の完了」に要約します。

```text
- 担当: 人間 / ローカルCodex / Web側Codex
  開始日: YYYY-MM-DD
  内容: 今回の成果物を1〜2文で記載
  主な変更予定: ファイルまたはディレクトリ
```

## 優先確認事項

### 複線コピーツール

- Web側では変更ファイルのPrettier、TypeScript構文変換、JSON解析、`git diff --check`、直線・曲線内外の純粋計算まで確認済み。`pnpm gen`、`pnpm build`、ゲーム内動作は未確認。
- 複数列プレビュー、順不同の連続レール選択、共有端点と0.5 m既設端点への接続、内外曲線長、2 m以下除外、手持ち/複製元モデル、途中失敗ロールバック、一括Undoをバックアップ済みワールドで確認する。
- 実生成はKaizPatchX向け。分岐器は対象外で、mc1710・mc1122の生成処理は既存builder1互換層に従って安全に停止する。

### 線路分割ツール

- 通常レールと自動分割レールについて、論理RailMap全体の強調、約0.25 m候補、長さ表示、手持ちモデルの適用、接続点の両方向走行、保存を確認する。
- 急勾配・縦曲線・カント付きレールで分割前後の形状を比較する。水平線形はDe Casteljau分割だが、縦断とカントはサンプリングによる再構築のため重点確認する。
- 後半生成失敗時のロールバックと、Ctrl+ZによるRailPosition・RailProperty・信号・サブレールの復元を、必ずバックアップ済みワールドで確認する。
- 分岐器は対象外。実処理はKaizPatchXのみ対応し、mc1710・mc1122は`unsupported_target`で停止する。

### 既存ツールの残件

- builder1の縦曲線内部接続を両方向に走行できることと、生成した2本をCtrl+Zで一括撤去できることは個別確認が残っている。
- builder1は破壊的な道床生成を行う。通常道床交差、内部セクションコア移設、既設コア衝突時の安全停止をバックアップ環境で継続確認する。
- RailPosition通常レール再生成モデルは、単一コア化、信号・サブレール保持、失敗時復元、長距離走行の実機確認が残っている。
- RailPosition移動後の専用Undoと、分岐器専用の移動処理は未実装。
- 道床所有権を1ブロックへ複数保存できないRTM構造上、他レールとの交差や障害物上では未使用道床・道床欠落・コア衝突が残る可能性がある。
- `pnpm format:check`は参照専用ツールキットとNGTOBuilder2サンプルの既存ファイルで失敗する。変更対象ファイルだけを個別確認する。
- 各ツールのボタンテクスチャは未配置の仮パスを使用している。

## 次に行うこと

1. 最新`main`で`pnpm gen`と`pnpm build`を実行し、全3ターゲットの型生成・ビルドを確認する。
2. `docs/double-track-copy.md`の実機確認項目をバックアップ済みワールドで実施する。
3. 問題時は、選択順・間隔・複製方向・手持ちアイテム・接続先状態と、`[SuperRailBuilderX double-track-copy]`周辺の必要最小限のログを共有する。

## 双方向連絡

### 開発者からCodexへ

```text
- YYYY-MM-DD 開発者:
  共有・依頼:
  関連ファイルまたはIssue:
```

### Codexから開発者・ローカルCodexへ

- 2026-09-04 Web側Codex:
    - 複線コピーツールを実装コミット `0e2b30e` でGitHubへ同期済み。
    - Web側の静的検証は成功。型生成・ビルド・実機確認は上記「次に行うこと」に従って引き継ぐ。

- 2026-09-03 Web側Codex:
    - 線路分割ツールをコミット `70fe67e` でGitHubへ同期済み。
    - Web側ではTypeScript構文変換、Prettier、JSON解析、`git diff --check`まで成功。
    - `pnpm gen`以降と実機確認は上記「次に行うこと」に従って引き継ぐ。
- 2026-09-03 ローカルCodex:
    - 最新`main`で`pnpm gen`と`pnpm build`が成功。コード修正は不要だった。
    - 検証記録コミット `3de4133` は`origin/main`へ同期済み。
    - 次はバックアップ済みワールドで`docs/rail-splitter.md`の実機確認を行う。

## 直近の完了

- 2026-09-04 Web側Codex: 論理RailMapの複数選択と反復平行生成を行う複線コピーツールを初期実装。詳細は `docs/double-track-copy.md` とコミット `0e2b30e` を参照。
- 2026-09-03 ローカルCodex: 線路分割ツールを含む全3ターゲットのコード生成・ビルドに成功。詳細は `docs/history/CODEX_HISTORY_2026-09.md` とコミット `3de4133` を参照（`origin/main`へ同期済み）。
- 2026-09-03 Web側Codex: 引継ぎ帳を短期情報と月別履歴へ分離し、`AGENTS.md`へコンテキスト・トークン使用量の管理規則を追加。実装コミット `439c456` はGitHubへ同期済み。
- 2026-09-03 Web側Codex: 線路分割ツールを初期実装。詳細は `docs/rail-splitter.md` とコミット `70fe67e` を参照。
- 2026-09-03 ローカルCodex: builder1の-X/-Z道床、勾配、縦曲線が正常に動作することを実機確認。

詳細な作業履歴は `docs/history/CODEX_HISTORY_2026-09.md` に保存しています。過去の原因や判断経緯が必要な場合だけ、対象機能名・エラー名・コミットSHAで検索してください。

## 関連資料

| 対象                   | ファイル                                       |
| ---------------------- | ---------------------------------------------- |
| 複線コピーツール       | `docs/double-track-copy.md`                    |
| 線路分割ツール         | `docs/rail-splitter.md`                        |
| builder1               | `docs/builder1.md`                             |
| RailPosition自由化     | `docs/rail-position-free-positioning.md`       |
| レール生成・道床・同期 | `docs/rail-generation-and-free-positioning.md` |
| multi-target設定       | `rtmx.json`                                    |
| 過去の作業記録         | `docs/history/CODEX_HISTORY_2026-09.md`        |
