# Codex・開発者間 引継ぎ帳

このファイルは、次の作業に必要な現行情報だけを共有するための短期引継ぎ帳です。詳細な過去記録は `docs/history/` に保存し、通常は読みません。

最終更新: 2026-09-13（ローカルCodex）

## 現在の状態

- rtm-ts 0.12.0、`kaizpatch`・`mc1710`・`appleextended`・`mc1122`のmulti-target環境を構築済み。AEは`ca255fd`基準の実験対応で、全ターゲットの生成・ビルドを確認済み。
- NGTOBuilder2由来のツールキットは `src/common/assets/minecraft/scripts/lib_hi03toolkit_1_0` に置き、参照専用とする。SuperRailBuilderX固有処理は `superrailbuilderx` ディレクトリと `SRBXApiCompat` に実装する。
- 正式版`SuperRailBuilderX_RailMover`は通常・自動分割レールとも元状態を退避し、builder1と同じ衝突判定・道床生成規則で再生成する。論理RailMapの複数選択・一括平行移動・一括Undoと、KaizPatchX分岐レールの端点移動に対応し、ホバーは現在のコアとRailPositionから再構築する。
- `SuperRailBuilderX_builder1`を実装済み。JSON識別名はbuilder1を維持し、文書・ヘルプでは`レール生成A`と表記する。自由点・通常/分岐レール端点接続、曲線半径固定、勾配・縦曲線、複数レール一括Undo、道床・コア保護を備える。
- `SuperRailBuilderX_RailSplitter`を実装済み。論理RailMap強調、レールパーツ描画位置と同じ約0.5 m間隔の候補、予定長表示、手持ちモデルによる2本生成、分割前状態へ戻すUndoを備える。分割後の両区間を3 m超に制限し、分割不可レールは赤表示する。
- `SuperRailBuilderX_DoubleTrackCopy`を実装済み。通常レールの複数選択、カーソル距離に応じた指定間隔の反復複製、水平平行線形、0.5 m端点接続、手持ち/複製元モデル、一括Undoを備える。
- `SuperRailBuilderX_CantFormatter`を実装済み。端点・中央への10 mスナップ、任意点分割、未選択分割候補の黄色表示、選択済み変更対象の水色表示、共有端点の連続適用、複数回の適用を遡るUndoに対応する。
- `SuperRailBuilderX_BranchBuilder`を実装済み。中央の約0.5 m候補、接続/未接続の正確な端点を根元とする単純分岐、共有端点両側の強調と分岐先カーソル方向によるベース選択、接続部カント0化とUndoに対応する。
- AppleExtended実験対応をmainへ統合済み。通常レール端点移動・同期・Undoだけを有効化し、道床再生成を必要とする機能は安全に無効化する。
- builder1のチャンク境界交差・候補表示・Iキー地上高合わせ、複線コピーの生成、分割パネル・縦勾配・カント、レール移動の基本操作・接続・回り込み防止・三線軌条の相互走行は実機確認済み。
- `alpha-0.1.0`の配布設定、README、統合操作ガイド、同梱readme.txt・LICENSEを整備済み。配布ZIPは`SuperRailBuilderX-alpha-0.1.0.zip`として生成できる。
- `v*`タグpush時に型定義生成・multi-targetビルド・ZIP生成を行い、`release-notes.md`を本文とするDraft Releaseを作成するGitHub Actionsを整備済み。公開はGitHub上で手動実施する。
- レール生成・自由点移動の構造は `docs/rail-generation-and-free-positioning.md`、各ツールの仕様と検証方法は下記「関連資料」を参照する。
- `AGENTS.md`へ、親モデルを途中変更するのではなく、限定作業だけを軽量・バランス型サブエージェントへ委譲するモデル運用規則を追加済み。
- KaizPatchX / AppleExtended向けの分岐レール描画runtime compatibility patchを`main`へ統合済み。KaizPatchXの描画は実機確認済みで、AppleExtended確認待ちのため`fix/rail-render-offset-compat-patch`は保持する。通常RTMはno-op。

## 作業中

- なし。

## 優先確認事項

### 分岐レール描画compatibility patch

- AppleExtendedで起動時ログの`[SRBX rail patch] completed`を確認し、`failed=0`であることを確認する。
- AppleExtendedで通常レール、offsetなし分岐、offsetあり分岐を表示し、offsetあり分岐の根元～中央と中央～終端がともにRailMapへ一致し、他2ケースの描画が変化しないことを確認する。
- `exclude.json`へ実在するrenderer script pathを一時指定し`skipped: excluded`になること、AppleExtendedではモデルパックreload後に新しいEngineへ再適用されることを確認する。

### 共通の走行遷移

- 分割・複製・builder1生成レールで低速遷移不能を再現したら、進行方向・速度・おおよその時刻を控え、`[SuperRailBuilderX transition]`を含むログを共有する。

### レール移動ツール

- 平行移動・端点移動・Undo後も、前後の接続レールを含むホバー強調が現在の線形で表示されることを確認する。
- KaizPatchX分岐レールの根元・本線端・側線端を移動でき、接続レールとの同時移動、走行、Undoで分岐全体が正しく再構築されることを確認する。分岐全体の平行移動は未対応。

### カント整形

- カント付きレールの端部・中央から10 m以上離れた任意位置で、分割とカント適用が成功することを確認する。
- 適用・Undo後の水色/黄色ハイライトが、変更前ではなく現在の線形で表示されることを確認する。

### 分岐生成

- 分岐化後に新しく接する既設レールもカント0となり、Undoで元へ戻ることを確認する。
- 端点・中央の分岐生成後にUndoしてもワールドから切断されず、エラーなく元レールへ戻ることを確認する。

### AppleExtended

- バックアップ済みワールドで通常レールの小さい端点オフセット、再ログイン後の永続化、描画、走行、Ctrl+Zを確認する。大移動は道床範囲外になるため未対応。

## 次に行うこと

1. AppleExtendedで分岐レール描画compatibility patchのBootstrapログとoffsetあり/なし描画を確認する。
2. 優先確認事項のレール移動、カント整形、分岐生成をバックアップ済みワールドで再確認する。
3. AE環境で通常レール端点移動・永続化・描画・走行・Undoを確認する。
4. 既存の「優先確認事項」も確認し、不具合時は機能名・操作順・時刻と`logs/latest.log`を共有する。

## 双方向連絡

### 開発者からCodexへ

```text
- YYYY-MM-DD 開発者:
  共有・依頼:
  関連ファイルまたはIssue:
```

- 2026-09-06 hi03:
    - usage.mdの文章を修正。

### Codexから開発者・ローカルCodexへ

- 2026-09-06 ローカルCodex:
    - 分割失敗を、前半終端道床と後半通常コアが共有分割点の同一ブロックを使う`section_core_conflict`と特定し、共有点だけを安全にコアへ置換するよう修正した。builder1の複数勾配区間にも接続先モデルを引き継ぎ、端点ホバーは`snapCursorMarker`へ変更した。
    - レール移動へ前後接続端点の連動、片側接続時の形状維持、両側接続優先、Ctrl+Z Undoを追加した。生ログは除外し、必要箇所だけ`logs/rail-tools-retest-20260906-7.log`へ保存した。実装コミット`5eea584`は`origin/main`へ同期済み。

- 2026-09-06 Web側Codex:
    - Work側とVS Code側のモデル運用を公式資料で確認し、軽量モデルへの委譲が総使用量を減らす場合だけ利用する規則を`AGENTS.md`へ追加した。

- 2026-09-06 ローカルCodex:
    - ログから、複線・builder1の失敗は接続マーカーではなく、直前レールの通常コアと次レールの内部セクションコア候補が同じブロックを要求したことが原因と特定し、64 m以下では通常レールへ切り替えるよう修正した。
    - builder1の候補マーカー・接続先モデル継承・Iキー±1ブロック探索と、レール移動の端部2 m道床保護・単一RailMap平行移動を実装した。生ログは除外し、必要箇所だけ`logs/rail-tools-retest-20260906-6.log`へ保存した。実装コミット`7434eec`は`origin/main`へ同期済み。

- 2026-09-06 ローカルCodex:
    - 複線生成失敗、短区間分割・Undo失敗をログから修正し、builder1の実視点マーカーとIキー地上高合わせを追加した。RailPosition検証ツールは正式なレール移動ツールへ改名し、重複道床の所有規則を反映した。
    - 生ログは除外し、必要箇所だけ`logs/rail-tools-retest-20260906-5.log`へ保存した。実装コミット`85e3572`は`origin/main`へ同期済み。

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

- 2026-09-13 ローカルCodex: 分岐描画patchを`main`へfast-forward統合し、KaizPatchX実機確認済み・AppleExtended確認待ちとして修正ブランチを保持。包含確認済みの`feature/appleextended`はローカル・リモートから削除。詳細は月別履歴とコミット`08756a7`を参照。

- 2026-09-13 ローカルCodex: レール移動/分岐Undoの論理レール再解決、現行セクションコアからのハイライト、カント任意点分割、KaizPatchX分岐端点移動を修正。詳細は月別履歴とコミット`41a13ad`を参照（引継ぎ更新`bd939ec`とともに`origin/main`へ同期済み）。

詳細な作業履歴は `docs/history/CODEX_HISTORY_2026-09.md` に保存しています。過去の原因や判断経緯が必要な場合だけ、対象機能名・エラー名・コミットSHAで検索してください。

## 関連資料

| 対象                   | ファイル                                       |
| ---------------------- | ---------------------------------------------- |
| 複線コピーツール       | `docs/double-track-copy.md`                    |
| 線路分割ツール         | `docs/rail-splitter.md`                        |
| カント整形ツール       | `docs/cant-formatter.md`                       |
| 分岐生成ツール         | `docs/branch-builder.md`                       |
| builder1               | `docs/builder1.md`                             |
| RailPosition自由化     | `docs/rail-position-free-positioning.md`       |
| レール生成・道床・同期 | `docs/rail-generation-and-free-positioning.md` |
| multi-target設定       | `rtmx.json`                                    |
| 正式リリース手順       | `docs/releasing.md`                            |
| 過去の作業記録         | `docs/history/CODEX_HISTORY_2026-09.md`        |
