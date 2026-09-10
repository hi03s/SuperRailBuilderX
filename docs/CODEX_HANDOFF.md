# Codex・開発者間 引継ぎ帳

このファイルは、次の作業に必要な現行情報だけを共有するための短期引継ぎ帳です。詳細な過去記録は `docs/history/` に保存し、通常は読みません。

最終更新: 2026-09-10（ローカルCodex）

## 現在の状態

- rtm-ts 0.12.0、`kaizpatch`・`mc1710`・`appleextended`・`mc1122`のmulti-target環境を構築済み。AEは`ca255fd`基準の実験対応で、全ターゲットの生成・ビルドを確認済み。
- NGTOBuilder2由来のツールキットは `src/common/assets/minecraft/scripts/lib_hi03toolkit_1_0` に置き、参照専用とする。SuperRailBuilderX固有処理は `superrailbuilderx` ディレクトリと `SRBXApiCompat` に実装する。
- 正式版`SuperRailBuilderX_RailMover`は通常・自動分割レールとも元状態を退避し、builder1と同じ衝突判定・道床生成規則で再生成する。論理RailMapの複数選択・一括平行移動・一括Undoに対応する。
- `SuperRailBuilderX_builder1`を実装済み。JSON識別名はbuilder1を維持し、文書・ヘルプでは`レール生成A`と表記する。自由点・通常/分岐レール端点接続、曲線半径固定、勾配・縦曲線、複数レール一括Undo、道床・コア保護を備える。
- `SuperRailBuilderX_RailSplitter`を実装済み。論理RailMap強調、レールパーツ描画位置と同じ約0.5 m間隔の候補、予定長表示、手持ちモデルによる2本生成、分割前状態へ戻すUndoを備える。分割後の両区間を3 m超に制限し、分割不可レールは赤表示する。
- `SuperRailBuilderX_DoubleTrackCopy`を実装済み。通常レールの複数選択、カーソル距離に応じた指定間隔の反復複製、水平平行線形、0.5 m端点接続、手持ち/複製元モデル、一括Undoを備える。
- `SuperRailBuilderX_CantFormatter`を実装済み。共有端点は接続する両レールへ反対符号で適用し、自動分割コアはSection NBTを実行時MCP名で更新する。
- `SuperRailBuilderX_BranchBuilder`を実装済み。中央の約0.5 m候補または正確な端点を根元とする単純分岐、接続部カントの0化とUndoに対応する。
- AppleExtended実験対応をmainへ統合済み。通常レール端点移動・同期・Undoだけを有効化し、道床再生成を必要とする機能は安全に無効化する。
- builder1のチャンク境界交差・候補表示・Iキー地上高合わせ、複線コピーの生成、分割パネル・縦勾配・カント、レール移動の基本操作・接続・回り込み防止・三線軌条の相互走行は実機確認済み。
- `alpha-0.1.0`の配布設定、README、統合操作ガイド、同梱readme.txt・LICENSEを整備済み。配布ZIPは`SuperRailBuilderX-alpha-0.1.0.zip`として生成できる。
- レール生成・自由点移動の構造は `docs/rail-generation-and-free-positioning.md`、各ツールの仕様と検証方法は下記「関連資料」を参照する。
- `AGENTS.md`へ、親モデルを途中変更するのではなく、限定作業だけを軽量・バランス型サブエージェントへ委譲するモデル運用規則を追加済み。

## 作業中

- なし。

## 優先確認事項

### 共通の走行遷移

- 分割・複製・builder1生成レールで低速遷移不能を再現したら、進行方向・速度・おおよその時刻を控え、`[SuperRailBuilderX transition]`を含むログを共有する。

### レール移動ツール

- 通常の端点移動、単体・複数平行移動をそれぞれCtrl+Zで取り消し、チャット応答があり、レール・連動端点・描画・走行が移動前へ戻ることを確認する。
- 2本目以降は選択済みレールへ接続するレールだけを追加でき、非接続レールはチャット通知付きで拒否されることを確認する。選択済みレールのホバー色が複線コピーツールと同じ暗い水色になることも確認する。
- 端点・平行移動中に旧線形の強調が残らず、移動後も接続する前後レールのゴーストハイライトが出ないことを確認する。
- 初期化されていない自動分割コア付近を移動先としてホバーしても、`getLogicalRailPositions(...) must not be null`でクラッシュしないことを確認する。

### レール生成A

- JSONの内部識別名と自動車モデル選択画面は`SuperRailBuilderX_builder1`を維持し、README・操作ガイド・ヘルプでは機能名`レール生成A`を使う。
- 分岐レールの各端点を始点・終点に選択し、元の分岐を壊さず新設レールが接続・走行できることを確認する。

### カント整形・分岐生成

- カント整形を共有端点へ1回適用し、接続する両レールが反対符号で同じ方向へ傾くこと、自動更新された相手もUndoで戻ることを確認する。
- 分岐生成で中央候補と正確な端点を根元とする分岐、元本線形状、モデル、分岐切替、両経路走行、道床、接続部カント0化・Undoを確認する。
- KaizPatchXの`LibRenderRail.js`は自由配置された分岐根元オフセットを二重加算しており、標準モデルの根元～中央だけRailMap/台車位置からずれる。共通描画スクリプトを上流で修正後に再確認する。
- 勾配・縦曲線・既存分岐・在線・短レールの中央分割が安全に拒否され、短レールでも端点起点は生成できることを確認する。
- 分割・分岐の約0.5 m候補がレールパーツ描画位置と一致し、生成後の接続点を低速で双方向に通過できることを重点確認する。

### AppleExtended

- AE `ca255fd`のJitPack成果物を利用し、`stable/39`で4ターゲットの`pnpm gen`と`pnpm build`が成功することを確認済み。JitPack初回取得時はHTTP 429やタイムアウトが発生する場合があるため、その場合は再試行する。
- バックアップ済みワールドで通常レールの小さい端点オフセット、再ログイン後の永続化、描画、走行、Ctrl+Zを確認する。大移動は道床範囲外になるため未対応。

## 次に行うこと

1. 修正したbuilder1分岐端点、カント整形、分岐生成を各資料に従ってバックアップ済みワールドで再確認する。
2. AE環境で通常レール端点移動・永続化・描画・走行・Undoを確認する。
3. 既存の「優先確認事項」も確認し、不具合時は機能名・操作順・時刻と`logs/latest.log`を共有する。

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

- 2026-09-10 ローカルCodex: AppleExtended `ca255fd`のJitPack公開対応を確認し、AEターゲットをmainへ再統合。4ターゲットの生成・ビルド成功。詳細は月別履歴とマージコミット`de3c3cb`を参照（`origin/main`へ同期済み）。
- 2026-09-09 ローカルCodex: カントの曲率符号と共有端点両側反映、分岐生成の端点起点を元レール全線形を保持する単純分岐へ修正。詳細は月別履歴とコミット`b2bf9db`を参照（`origin/main`へ同期済み）。
- 2026-09-08 ローカルCodex: builder1の分岐端点接続、カントSection NBT更新、分岐生成の端点起点・接続部カント解除/Undoを修正。描画ずれはKaizPatchX共通スクリプトの二重オフセットと特定。詳細は月別履歴とコミット`ae697dd`を参照（`origin/main`へ同期済み）。
- 2026-09-08 ローカルCodex: AE対応を`feature/appleextended`へ退避してmainから除外し、カントSection NBT例外、分岐描画、分割精度、builder1識別名を修正。詳細は月別履歴とコミット`ef99a59`・`a92fcdb`を参照（`origin/main`へ同期済み）。
- 2026-09-08 ローカルCodex: AEのMCP設定を`stable/39`へ修正してmapping生成通過を確認。残る阻害はAEのJitPack成果物未公開。詳細は月別履歴とコミット`40ff327`を参照（`origin/feature/appleextended`へ同期済み）。
- 2026-09-08 ローカルCodex: AE依存を最新`b6e0769`へ更新して生成・ビルドを再試行。JitPack阻害の解消と新しいMCP mapping生成阻害を確認。詳細は月別履歴とコミット`f8b4753`を参照（`origin/feature/appleextended`へ同期済み）。
- 2026-09-08 Web側Codex: AppleExtended `74fe2ed`向けmulti-target、通常レール端点移動・同期・Undo、compile-onlyサンプルを実装。詳細は`docs/appleextended-target.md`とコミット`ea55874`を参照（`origin/main`へ同期済み）。
- 2026-09-07 ローカルCodex: カント整形と分岐生成ツール、両ツールのUndo・multi-targetスタブ・操作資料を実装。詳細は`docs/history/CODEX_HISTORY_2026-09.md`とコミット`51f855d`を参照（`origin/main`へ同期済み）。
- 2026-09-07 ローカルCodex: レール移動のクラッシュ、Ctrl+Z入力、接続レール限定選択、暗色ホバー・旧強調表示を修正し、builder1をレール生成Aへ改名。詳細は`docs/history/CODEX_HISTORY_2026-09.md`とコミット`667481b`を参照（`origin/main`へ同期済み）。
- 2026-09-07 hi03: usage.mdの文章修正。
- 2026-09-07 ローカルCodex: alpha-0.1.0のバージョン設定、README・統合操作ガイド・同梱文書、更新テクスチャを配布ZIPへ反映。詳細は`docs/history/CODEX_HISTORY_2026-09.md`とコミット`4ab0aa6`を参照（`origin/main`へ同期済み）。
- 2026-09-07 ローカルCodex: 専用アセット、分割3 m制限・赤表示、レール移動の複数選択・Undo・描画同期を実装し、サンプルを削除。詳細は`docs/history/CODEX_HISTORY_2026-09.md`とコミット`7850dc9`を参照（`origin/main`へ同期済み）。
- 2026-09-06 ローカルCodex: 分割点コア衝突、builder1の勾配時モデル継承・端点表示、レール移動の連動端点・片側補正・Undoを修正。詳細は`docs/history/CODEX_HISTORY_2026-09.md`とコミット`5eea584`を参照（`origin/main`へ同期済み）。
- 2026-09-06 Web側Codex: トークン節約を目的としたモデル・サブエージェント使い分け規則を`AGENTS.md`へ追加。
- 2026-09-06 ローカルCodex: レール生成の内部コア衝突、builder1の候補表示・モデル継承・高さ探索、レール移動の道床回帰と平行移動を修正。詳細は`docs/history/CODEX_HISTORY_2026-09.md`とコミット`7434eec`を参照（`origin/main`へ同期済み）。
- 2026-09-06 ローカルCodex: 複線・分割の再失敗を修正し、builder1の地上高合わせと正式レール移動ツールを実装。詳細は`docs/history/CODEX_HISTORY_2026-09.md`とコミット`85e3572`を参照（`origin/main`へ同期済み）。

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
| 過去の作業記録         | `docs/history/CODEX_HISTORY_2026-09.md`        |
