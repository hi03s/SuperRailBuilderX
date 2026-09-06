# Codex・開発者間 引継ぎ帳

このファイルは、次の作業に必要な現行情報だけを共有するための短期引継ぎ帳です。詳細な過去記録は `docs/history/` に保存し、通常は読みません。

最終更新: 2026-09-06（ローカルCodex）

## 現在の状態

- rtm-ts 0.12.0、`kaizpatch`・`mc1710`・`mc1122`のmulti-target環境を構築済み。
- NGTOBuilder2由来のツールキットは `src/common/assets/minecraft/scripts/lib_hi03toolkit_1_0` に置き、参照専用とする。SuperRailBuilderX固有処理は `superrailbuilderx` ディレクトリと `SRBXApiCompat` に実装する。
- RailPosition移動ツールは通常・自動分割レールとも元状態を退避し、builder1と同じ衝突判定・道床生成規則で再生成する方式へ統合済み。旧`RailPositionNormalTest`は削除した。
- `SuperRailBuilderX_builder1`を実装済み。自由点・既設端接続、曲線半径固定、勾配・縦曲線、複数レール一括Undo、道床・コア保護を備える。-X/-Z道床と勾配・縦曲線は実機確認済み。
- `SuperRailBuilderX_RailSplitter`を実装済み。論理RailMap強調、約0.25 m間隔の候補、予定長表示、手持ちモデルによる2本生成、分割前状態へ戻すUndoを備える。
- `SuperRailBuilderX_DoubleTrackCopy`を実装済み。通常レールの複数選択、カーソル距離に応じた指定間隔の反復複製、水平平行線形、0.5 m端点接続、手持ち/複製元モデル、一括Undoを備える。
- 実装コミット`e40f361`で`pnpm gen`と`pnpm build`が成功し、全3ターゲットの生成・ビルドを確認済み。
- 2026-09-06の実機確認を反映し、両ツールの強調表示、複線Undo時の選択復元、分割元モデル継承、距離パネル、分割最小長を修正。全3ターゲットの生成・ビルド確認済み。
- builder1のチャンク境界付近のセクションコア交差生成・走行、通常交差通知・64 m制限・単一マーカー、複線コピーの位置固定操作・Undo選択復元・左クリック、分割パネル・縦勾配・カント精度は実機確認済み。2026-09-06の追加修正は実機再確認待ち。
- レール生成・自由点移動の構造は `docs/rail-generation-and-free-positioning.md`、各ツールの仕様と検証方法は下記「関連資料」を参照する。

## 作業中

作業を開始する場合だけ、次の形式で1件追記します。完了時に削除し、結果は「直近の完了」に要約します。

```text
- 担当: 人間 / ローカルCodex / Web側Codex
  開始日: YYYY-MM-DD
  内容: 今回の成果物を1〜2文で記載
  主な変更予定: ファイルまたはディレクトリ
```

## 優先確認事項

### 共通の走行遷移

- 分割・複製・builder1生成レールで低速遷移不能を再現したら、進行方向・速度・おおよその時刻を控え、`[SuperRailBuilderX transition]`を含むログを共有する。

### 複線コピーツール

- 生成後にUndoし、復元された選択から再度プレビュー・生成しても端部方向が崩れず、削除済みレールの強調表示・選択・端点吸着が発生しないことを確認する。
- 曲線内側で視線を曲率中心より先へ動かし、中心を越えて回り込む列がプレビュー・生成されないことを確認する。

### 線路分割ツール

- 全長6 m以下のレールに候補・強調表示が出ず分割できないことと、6 mを超えるレールを繰り返し分割しても失敗・二重生成しないことを確認する。

### builder1

- スナップON時、`selectCursorMarker`が選択ブロックと水平周囲8ブロックの合計9か所へ表示されることを確認する。

### RailPosition移動ツール

- 地面では通常レール高の1/16 m上、別レール上ではそのレール高へ移動先が合うことを確認する。
- builder1と同じモデル・テクスチャで表示され、Pキーで水平0.1 mスナップをON/OFFできることを確認する。
- 片側端点を移動してから反対側端点を移動した際、再入場せずレール描画が更新されることを確認する。

## 次に行うこと

1. 上記「優先確認事項」をバックアップ済みワールドで実機確認する。
2. 不具合を再現した場合は、機能名・操作順・おおよその時刻と`logs/latest.log`を共有する。

## 双方向連絡

### 開発者からCodexへ

```text
- YYYY-MM-DD 開発者:
  共有・依頼:
  関連ファイルまたはIssue:
```

### Codexから開発者・ローカルCodexへ

- 2026-09-06 ローカルCodex:
    - 複線Undoゴーストと曲率中心越え、全長6 m以下の再分割、builder1の3×3マーカー、RailPosition移動の高さ・外観・Pスナップ・描画同期を修正した。
    - 生ログは除外し、必要箇所だけ`logs/rail-tools-retest-20260906-4.log`へ保存した。実装コミット`e40f361`は`origin/main`へ同期済み。

- 2026-09-06 ローカルCodex:
    - 追加実機ログから複線コピーの曲率中心越え、分割時の内部/接続先コア衝突、カント高さ二重加算を特定して修正した。builder1へ通常交差の64 m制限・チャット表示・スナップマーカーを追加し、RailPosition移動をbuilder1生成規則へ統合した。
    - 生ログは除外し、必要箇所だけ`logs/rail-tools-retest-20260906-3.log`へ保存した。実装コミット`eeb7988`は`origin/main`へ同期済み。

- 2026-09-06 ローカルCodex:
    - 実機結果を受領し、強調表示・複線Undo選択・分割モデル/距離/最小長を修正。生成衝突、低速遷移、Undo失敗の診断を追加した。
    - 生ログは必要箇所だけ `logs/rail-tools-retest-20260906-client.log` へ抜粋した。上記「次に行うこと」をバックアップ済みワールドで再確認する。
    - 修正コミット `74c287f` は`origin/main`へ同期済み。

- 2026-09-04 Web側Codex:
    - 複線コピーツールを実装コミット `0e2b30e` でGitHubへ同期済み。
    - Web側の静的検証は成功。型生成・ビルド・実機確認は上記「次に行うこと」に従って引き継ぐ。
- 2026-09-04 ローカルCodex:
    - `pnpm gen`は成功。mc1710にない`RailMap#getRailYaw`の直接呼び出しを既存compat経由へ修正し、`pnpm build`も全3ターゲットで成功した。
    - 修正コミット `d8fe798` は`origin/main`へ同期済み。
    - 次はバックアップ済みワールドで`docs/double-track-copy.md`の実機確認を行う。

- 2026-09-03 Web側Codex:
    - 線路分割ツールをコミット `70fe67e` でGitHubへ同期済み。
    - Web側ではTypeScript構文変換、Prettier、JSON解析、`git diff --check`まで成功。
    - `pnpm gen`以降と実機確認は上記「次に行うこと」に従って引き継ぐ。
- 2026-09-03 ローカルCodex:
    - 最新`main`で`pnpm gen`と`pnpm build`が成功。コード修正は不要だった。
    - 検証記録コミット `3de4133` は`origin/main`へ同期済み。
    - 次はバックアップ済みワールドで`docs/rail-splitter.md`の実機確認を行う。

## 直近の完了

- 2026-09-06 ローカルCodex: 複線Undo・短レール分割・builder1マーカー・RailPosition表示同期を修正。詳細は`docs/history/CODEX_HISTORY_2026-09.md`とコミット`e40f361`を参照（`origin/main`へ同期済み）。
- 2026-09-06 ローカルCodex: 複線コピー・分割・builder1・RailPosition移動の追加実機不具合を修正し、旧NormalTestを削除。詳細は`docs/history/CODEX_HISTORY_2026-09.md`とコミット`eeb7988`を参照（`origin/main`へ同期済み）。
- 2026-09-06 ローカルCodex: チャンク境界交差、複線コピーの段階操作・Undo同期、分割パネル透明描画を修正。詳細は `docs/history/CODEX_HISTORY_2026-09.md` とコミット `377a859` を参照（`origin/main`へ同期済み）。
- 2026-09-06 ローカルCodex: 両ツールの実機フィードバックを反映し、生成失敗と低速遷移の診断を追加。詳細は `docs/history/CODEX_HISTORY_2026-09.md` とコミット `74c287f` を参照（`origin/main`へ同期済み）。
- 2026-09-04 ローカルCodex: 複線コピーツールのmulti-targetビルドエラーを修正し、全3ターゲットの生成・ビルドに成功。詳細は `docs/history/CODEX_HISTORY_2026-09.md` とコミット `d8fe798` を参照（`origin/main`へ同期済み）。
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
