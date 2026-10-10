# Codex・開発者間 引継ぎ帳

このファイルは、次の作業に必要な現行情報だけを共有するための短期引継ぎ帳です。詳細な過去記録は `docs/history/` に保存し、通常は読みません。

最終更新: 2026-10-10（Web側Codex）

## 現在の状態

- 実験ブランチ`feature/kaizpatch-free-endpoint-mod`: KaizPatchX 1.10.4専用のサーバーcoremod＋SRBX内包JARとクライアント用ZIPを生成済み。実装`c76801f2a69d4c8f762e2b4ac7a890bffb0dc78c`はGitHubへ同期済み。[Actions #38008868160](https://github.com/hi03s/SuperRailBuilderX/actions/runs/38008868160)で全4build・全回帰・Java単体テスト成功。[導入/実機確認](srbx-free-endpoint-mod.md)。以下のmain側既存状態とは区別する。

- rtm-ts 0.12.0、`kaizpatch`・`mc1710`・`appleextended`・`mc1122`のmulti-target環境を構築済み。AEは正式版`v2.5.3`基準。JitPack取得が復旧し、未改造rtm-tsの標準手順で全4ターゲットの型生成・ビルド成功。
- NGTOBuilder2由来のツールキットは `src/common/assets/minecraft/scripts/lib_hi03toolkit_1_0` に置き、参照専用とする。SuperRailBuilderX固有処理は `superrailbuilderx` ディレクトリと `SRBXApiCompat` に実装する。
- 正式版`SuperRailBuilderX_RailMover`は通常・自動分割レールとも元状態を退避し、builder1と同じ衝突判定・道床生成規則で再生成する。論理RailMapの複数選択・一括平行移動・一括Undoと、KaizPatchX分岐レールの端点移動に対応し、ホバーは現在のコアとRailPositionから再構築する。
- `SuperRailBuilderX_builder1`を実装済み。JSON識別名はbuilder1を維持し、文書・ヘルプでは`レール生成A`と表記する。自由点・通常/分岐レール端点接続、曲線半径固定、勾配・縦曲線、複数レール一括Undo、道床・コア保護を備える。
- `SuperRailBuilderX_RailSplitter`を実装済み。論理RailMap強調、レールパーツ描画位置と同じ約0.5 m間隔の候補、予定長表示、手持ちモデルによる2本生成、分割前状態へ戻すUndoを備える。分割後の両区間を3 m超に制限し、分割不可レールは赤表示する。
- `SuperRailBuilderX_DoubleTrackCopy`を実装済み。通常レールの複数選択、カーソル距離に応じた指定間隔の反復複製、水平平行線形、0.5 m端点接続、手持ち/複製元モデル、一括Undoを備える。
- `SuperRailBuilderX_CantFormatter`を実装済み。端点・中央への10 mスナップ、任意点分割、未選択分割候補の黄色表示、選択済み変更対象の水色表示、共有端点の連続適用、複数回の適用を遡るUndoに対応する。
- `SuperRailBuilderX_BranchBuilder`を実装済み。中央の約0.5 m候補、接続/未接続の正確な端点を根元とする単純分岐、共有端点両側の強調と分岐先カーソル方向によるベース選択、接続部カント0化とUndoに対応する。
- AppleExtended v2.5.3対応をmainへ統合済み。開発者から概ね不具合解消の報告を受領（2026-10-04）。通常/自動分割レールの生成・複線・分割・移動・カント・分岐・Undoを補完し、KaizPatchの既存処理を維持。
- builder1のチャンク境界交差・候補表示・Iキー地上高合わせ、複線コピーの生成、分割パネル・縦勾配・カント、レール移動の基本操作・接続・回り込み防止・三線軌条の相互走行は実機確認済み。
- `v0.2.0`を2026-10-04に[正式公開](https://github.com/hi03s/SuperRailBuilderX/releases/tag/v0.2.0)。タグは`1c73128`。Actions生成ZIP（88ファイル、全4ターゲット）を検証済み。
- `v*`タグpushで型生成・multi-targetビルド・ZIP付きDraft Releaseを作成。Java 25、生成前のGradle cacheキーはpnpm-lock.yaml/rtmx.jsonを使用。公開はDraft確認後に手動実行する。
- レール生成・自由点移動の構造は `docs/rail-generation-and-free-positioning.md`、各ツールの仕様と検証方法は下記「関連資料」を参照する。
- `AGENTS.md`へ、親モデルを途中変更するのではなく、限定作業だけを軽量・バランス型サブエージェントへ委譲するモデル運用規則を追加済み。
- KaizPatchX / AppleExtended向けの分岐レール描画runtime compatibility patchを`main`へ統合済み。KaizPatchXの描画は実機確認済みで、AppleExtended確認待ちのため`fix/rail-render-offset-compat-patch`は保持する。通常RTMはno-op。

## 作業中

- Web側Codex: 台車探索の比較・軽量化を実装、ビルド検証中。Direction直接探索の反射試作は模擬測定で遅く不採用。端点内側の2サンプル照合と中央の早期除外を採用。[比較結果](rail-lookup-performance.md)。

## 優先確認事項

### 完全自由点サーバーMod（専用ブランチ）

- JARはサーバーmodsへ、クライアントは同版モデルパックZIPを導入。既存SRBXとの重複導入を避ける。Javaパッチをクライアント必須にしない構成だが、実際の接続・走行・ツール操作は未検証。
- CrossTieの対象callsite/探索overwriteを保持する実装と実KaizPatchのバイトコード検証は済み。併用時の起動・両方向微速通過・分岐・Undoは実機未検証。AE Javaパッチは保留。
- 現mapへの誤復帰を抑えるパッチであり、nativeが接続先を発見できない配置や同セルのコア競合、極短区間の多重通過は保証しない。詳細は[srbx-free-endpoint-mod.md](srbx-free-endpoint-mod.md)。

### 分岐レール描画compatibility patch

- 修正版ZIPでAEのモデル構築が成功し、`[SRBX rail patch] source prepared: function serialization`と`completed`（`failed=0`）を確認する。KaizPatchXでもoffsetあり/なし分岐の描画を再確認する。
- AppleExtendedで通常レール、offsetなし分岐、offsetあり分岐を表示し、offsetあり分岐の根元～中央と中央～終端がともにRailMapへ一致し、他2ケースの描画が変化しないことを確認する。
- `exclude.json`へ実在するrenderer script pathを一時指定し`skipped: excluded`になること、AppleExtendedではモデルパックreload後に新しいEngineへ再適用されることを確認する。

### 共通の走行遷移

- KaizPatch/AEの全6ツールへブロック境界端点・面に応じたdirection/ownerを適用。円弧交点、縦曲線共有点、接続移動とUndoを対応。ビルド/回帰テスト成功、両Modの低速走行実機確認待ち。[実装・検証手順](rail-boundary-endpoints.md)。既存線の自動一括修正はしない。
- 内側自由端点ではAE停止/位置補正、Kaiz新旧map往復を確認済み。Kaiz [Issue #534](https://github.com/Kai-Z-JP/KaizPatchX/issues/534)は端点のブロック端保証をスクリプト責務と回答。[Kaiz報告](kaizpatch-free-endpoint-transition-report.md)・[AE報告](appleextended-free-endpoint-transition-report.md)。
- [自由化の導入意図](rail-position-free-endpoint-intent.md): Kaizはチャンク境界上の精密分割点を扱う目的でoffset/setPositionを追加し、導入時からブロック端保証は設定側の責務。AEの導入も座標/保存/描画対応で、任意点走行接続保証は確認できない。
- [遷移パッチ実現性](free-endpoint-transition-patch-feasibility.md): Java探索の直接差替えは補助Mod/coremod候補。mainは追加JARなしの境界端点制約を維持。今回の完全自由点は専用ブランチのサーバーModとして検証する。
- デバッグ車両 `SuperRailBuilderX_TrainDebug` はAE/KaizPatchX 1.10.4の読み込み・走行ログ取得を確認済み。[走行診断](train-debug-vehicle.md)。
- KaizPatch/AEのSRBX敷設は既存通常道床を保持。標準マーカーは同じ通常道床の所有先を変更する。[道床の比較](roadbed-ownership-investigation.md)。AEログは当初敷設の履歴なし。Kaiz追加ログでは新短区間のadded=0/retained=0と接続セルの旧所有先保持を確認。

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

- 開発者から概ね不具合解消の報告を受領しmainへ統合。個別の全ケース確認済みとは扱わず、今後の再発時は操作順・時刻とlogs/latest.logを確認する。
- 接続cantEdge反転・論理線形ハイライトはKaizPatch/AEで適用。旧コアのブロック/tile一括掃除はAEのみ。接続移動/Undo/走行は今後も継続確認する。
- Section生成にコア配置競合があれば保護道床への代替配置、部分生成なしなら通常生成へfallback。失敗診断はsection creation failed/section owner relocation blockedを参照する。

## 次に行うこと

1. 専用ブランチのJAR/ZIPで、サーバーのみMod導入・CrossTieあり/なし・内部自由端点の両方向微速走行を確認する（srbx-free-endpoint-mod.md）。
2. KaizPatch/AEで境界端点の接続を新規生成し、デバッグ車両の両方向低速走行・移動・Undoを確認する（rail-boundary-endpoints.md）。
3. AppleExtended v2.5.3で分岐描画patchのBootstrapログとoffsetあり/なし描画を確認する。
4. レール移動・カント任意点分割・分岐Undoと、AE自動分割レールの生成・分割・分岐・走行・Undoをバックアップ済みワールドで確認する。
5. 不具合時は機能名・操作順・時刻と`[SuperRailBuilderX`または`[SRBX rail patch]`を含むログを共有する。

## 双方向連絡

### 開発者からCodexへ

```text
- YYYY-MM-DD 開発者:
  共有・依頼:
  関連ファイルまたはIssue:
```

### Codexから開発者・ローカルCodexへ

- 2026-10-10 Web側Codex: 完全自由点Modは専用ブランチでビルド完了、実機確認待ち。main/AEの境界ポリシーは変更しない。新規repo・fork・Issue・PR・コメントは禁止（開発者指示）。実機確認は[srbx-free-endpoint-mod.md](srbx-free-endpoint-mod.md)を参照。

## 直近の完了

- 2026-10-10 Web側Codex: 完全自由点サーバーMod＋SRBX内包JAR/クライアントZIP生成、全4build/回帰成功。`c76801f`を専用ブランチへpush済み。成果物のJava8/manifest/依存クラス非同梱/102資産の一致も確認。詳細は[10月履歴](history/CODEX_HISTORY_2026-10.md)・[導入手順](srbx-free-endpoint-mod.md)。

- 2026-10-10 ローカルCodex: 全6ツールのKaizPatch/AE境界端点・接続方向・owner・Undo復元を実装。全4build/回帰成功、修正版ZIP生成。実装`f8ecee4`をorigin/mainへpush済み。実機走行確認待ち。詳細は[10月履歴](history/CODEX_HISTORY_2026-10.md)・[確認手順](rail-boundary-endpoints.md)。

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
