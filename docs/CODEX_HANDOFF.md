# Codex・開発者間 引継ぎ帳

このファイルは、次の作業に必要な現行情報だけを共有するための短期引継ぎ帳です。詳細な過去記録は `docs/history/` に保存し、通常は読みません。

最終更新: 2026-10-11（ローカルCodex、main）

## 現在の状態

- 現在main。KaizPatch/AE実機確認済みbuilder1 GUIを791d2a5で統合してpush済み。feature/builder1-guiはローカル/リモートとも削除済み。距離/ブロックスナップと「直線」表示をmainへ追加。
- 状態GUIをSRBXToolGuiへ共通化し、全6ツールへ実装。分割2区間長（ホバー対応）、移動スナップ状態、複線間隔、カント速度/種類、分岐半径/新線長を表示。複線間隔チャットのみ廃止。[GUI仕様](tool-gui.md)。
- 全6ツールにTABホイールを追加。6区画リングをマウス/←→で選択し、左クリック/TAB解除で確定、ESC取消。中央へ戻すと現在ツールが選ばれ切り替えない。切り替え後の押しっぱなし入力も抑止する。[仕様・確認手順](tool-wheel.md)。

- Web側試作（`462fdb1`まで）をmainへ統合。KaizPatch/AEの全6ツールは完全自由点仕様へ戻し、暫定SRBXPatchを別途導入する。[導入/実機確認](srbx-free-endpoint-mod.md)。
- 配布物はパックZIP、SRBXPatch-v1.0-1.7.10.jar（Kaiz 1.10.4）、SRBXPatch-v1.0-1.12.2.jar（AE 2.5.3）。デバッグ車両の登録JSONを除去し、資産/診断スクリプトは保持。

- rtm-ts 0.12.0、`kaizpatch`・`mc1710`・`appleextended`・`mc1122`のmulti-target環境を構築済み。AEは正式版`v2.5.3`基準。JitPack取得が復旧し、未改造rtm-tsの標準手順で全4ターゲットの型生成・ビルド成功。
- NGTOBuilder2由来のツールキットは `src/common/assets/minecraft/scripts/lib_hi03toolkit_1_0` に置き、参照専用とする。SuperRailBuilderX固有処理は `superrailbuilderx` ディレクトリと `SRBXApiCompat` に実装する。
- 正式版`SuperRailBuilderX_RailMover`は通常・自動分割レールとも元状態を退避し、builder1と同じ衝突判定・道床生成規則で再生成する。論理RailMapの複数選択・一括平行移動・一括Undoと、KaizPatchX分岐レールの端点移動に対応し、ホバーは現在のコアとRailPositionから再構築する。
- `SuperRailBuilderX_builder1`を実装済み。JSON識別名はbuilder1を維持し、文書・ヘルプでは`レール生成A`と表記する。自由点・通常/分岐レール端点接続、曲線半径固定、勾配・縦曲線、複数レール一括Undo、道床・コア保護を備える。
- `SuperRailBuilderX_RailSplitter`を実装済み。論理RailMap強調、レールパーツ描画位置と同じ約0.5 m間隔の候補、予定長表示、手持ちモデルによる2本生成、分割前状態へ戻すUndoを備える。分割後の両区間を3 m超に制限し、分割不可レールは赤表示する。
- `SuperRailBuilderX_DoubleTrackCopy`を実装済み。通常レールの複数選択、カーソル距離に応じた指定間隔の反復複製、水平平行線形、0.5 m端点接続、手持ち/複製元モデル、一括Undoを備える。
- `SuperRailBuilderX_CantFormatter`は論理RailMap単位で選択し両端へ適用する。分割/選択カーソルを廃止し、接続する影響対象は黄緑、未選択ホバーは黄色、選択済みホバーは暗い水色。速度0で水平化、Ctrl+↑↓で±50 km/h。複数回の適用を遡るUndoに対応する。
- `SuperRailBuilderX_BranchBuilder`を実装済み。中央の約0.5 m候補、接続/未接続の正確な端点を根元とする単純分岐、共有端点両側の強調と分岐先カーソル方向によるベース選択、接続部カント0化とUndoに対応する。
- AppleExtended v2.5.3対応をmainへ統合済み。開発者から概ね不具合解消の報告を受領（2026-10-04）。通常/自動分割レールの生成・複線・分割・移動・カント・分岐・Undoを補完し、KaizPatchの既存処理を維持。
- builder1のチャンク境界交差・候補表示・Iキー地上高合わせ、複線コピーの生成、分割パネル・縦勾配・カント、レール移動の基本操作・接続・回り込み防止・三線軌条の相互走行は実機確認済み。
- `v0.2.0`を2026-10-04に[正式公開](https://github.com/hi03s/SuperRailBuilderX/releases/tag/v0.2.0)。タグは`1c73128`。Actions生成ZIP（88ファイル、全4ターゲット）を検証済み。
- `v*`タグpushで型生成・multi-targetビルド・ZIPと2 JAR付きDraft Releaseを作成。Java 25、生成前のGradle cacheキーはpnpm-lock.yaml/rtmx.jsonを使用。公開はDraft確認後に手動実行する。
- レール生成・自由点移動の構造は `docs/rail-generation-and-free-positioning.md`、各ツールの仕様と検証方法は下記「関連資料」を参照する。
- `AGENTS.md`へ、親モデルを途中変更するのではなく、限定作業だけを軽量・バランス型サブエージェントへ委譲するモデル運用規則を追加済み。
- KaizPatchX / AppleExtended向けの分岐レール描画runtime compatibility patchを`main`へ統合済み。KaizPatchXの描画は実機確認済みで、AppleExtended確認待ち。統合済み描画修正ブランチは整理済み。通常RTMはno-op。

## 作業中

- ローカルCodex: ホイールの選択文字色が次のアイコンへ残る不具合を修正・検証する。

## 優先確認事項

- ホイールで選択名の黄色が次のアイコンへ残る実機報告を受け、各アイコン描画前に白色へ戻すよう修正。更新ZIPで全6項目の色をKaizPatch/AEで再確認する。全4build、GUI回帰、旧Java 8u51のGL模擬検証は成功。リング・左クリック・中央で変更なし・押しっぱなし抑止とマルチプレイのリスト非表示も継続確認する。[手順](tool-wheel.md)。

- 今回のカント選択変更、CTRL中の移動ホバー抑止、分岐スナップ、ヘルプ改行は実機未確認。全4build・回帰テスト・旧Java 8u51 GUI（GL模擬）は成功。更新ZIPでKaizPatch/AEを確認し、異常時は操作順とlogs/latest.logを共有する。

- 更新main ZIPで全6ツールの状態GUIをKaizPatch/AEで確認する。全4build/全回帰/旧Java 8u51による全ツールGUI検証済み（GL模擬）、実GPU/実ワールドは未検証。分割ホバー/選択長、移動ON/OFF、複線チャット廃止、カントの種類チャット継続、分岐半径/長さとレール描画を確認。異常時はツール名/操作とlogs/latest.logを共有。[手順](tool-gui.md)。

- KaizPatch/AEで既存GUIの実機確認を受領してmainへ統合済み。新しい距離/ブロックスナップ、ツール名の影付き白文字、「直線」表示は実機確認待ち。PでOFF→距離→ブロック、Ctrl+Pは距離の角度設定。main ZIPを置換して再起動し、自由点/既設端接続とGUI切替を確認する。異常時は操作手順とlogs/latest.logを共有。[仕様/手順](builder1.md)。

- CrossTie Alpha14のレール分割警告は新規TEへの未読込診断の誤検出と判断。ログ内の分割6回は成功、SRBX変更不要。[調査](crosstie-split-diagnostic.md)。本番サーバーは操作しない。

### 完全自由点とSRBXPatch

- 開発者がKaizPatchのCrossTieあり/なしで動作を確認（2026-10-10）。AEは起動時に大文字依存IDで停止したためrequired-after:rtmへ修正しJARを再生成。Java挙動/実AE ASM/依存ID一致テスト成功、修正版の起動・走行再確認待ち。JARなしクライアント接続は未検証。
- JARはサーバーmods、パックZIPはサーバー/クライアントへ。旧SRBXMod内包版を置き換える。未有効時の書き込みはsrbxpatch_requiredで拒否。
- Kaizは現在map保持＋native遷移、AEは現在map保持＋精密接続探索。両方向微速通過・分岐・移動・Undoを実機確認する。同セルコア競合/極短区間の多重通過は保証外。[制限・手順](srbx-free-endpoint-mod.md)。

### 分岐レール描画compatibility patch

- 修正版ZIPでAEのモデル構築が成功し、`[SRBX rail patch] source prepared: function serialization`と`completed`（`failed=0`）を確認する。KaizPatchXでもoffsetあり/なし分岐の描画を再確認する。
- AppleExtendedで通常レール、offsetなし分岐、offsetあり分岐を表示し、offsetあり分岐の根元～中央と中央～終端がともにRailMapへ一致し、他2ケースの描画が変化しないことを確認する。
- `exclude.json`へ実在するrenderer script pathを一時指定し`skipped: excluded`になること、AppleExtendedではモデルパックreload後に新しいEngineへ再適用されることを確認する。

### 共通の走行遷移

- 境界端点制約は撤回。境界上の点はnative direction/ownerを維持し、内部点は元の精密座標を使う。既存線の自動一括変換はしない。[境界試作記録](rail-boundary-endpoints.md)。
- 内側自由端点ではAE停止/位置補正、Kaiz新旧map往復を確認済み。Kaiz [Issue #534](https://github.com/Kai-Z-JP/KaizPatchX/issues/534)は端点のブロック端保証をスクリプト責務と回答。[Kaiz報告](kaizpatch-free-endpoint-transition-report.md)・[AE報告](appleextended-free-endpoint-transition-report.md)。
- [自由化の導入意図](rail-position-free-endpoint-intent.md): Kaizはチャンク境界上の精密分割点を扱う目的でoffset/setPositionを追加し、導入時からブロック端保証は設定側の責務。AEの導入も座標/保存/描画対応で、任意点走行接続保証は確認できない。
- [遷移パッチ実現性](free-endpoint-transition-patch-feasibility.md)の検討を経て、mainでも両版SRBXPatchを併用する方針へ変更済み。
- デバッグ車両の登録JSONは除去済み。実機検証は通常車両を使用する。[保存した診断資産](train-debug-vehicle.md)。
- KaizPatch/AEのSRBX敷設は既存通常道床を保持。標準マーカーは同じ通常道床の所有先を変更する。[道床の比較](roadbed-ownership-investigation.md)。AEログは当初敷設の履歴なし。Kaiz追加ログでは新短区間のadded=0/retained=0と接続セルの旧所有先保持を確認。

### レール移動ツール

- 平行移動・端点移動・Undo後も、前後の接続レールを含むホバー強調が現在の線形で表示されることを確認する。
- KaizPatchX分岐レールの根元・本線端・側線端を移動でき、接続レールとの同時移動、走行、Undoで分岐全体が正しく再構築されることを確認する。分岐全体の平行移動は未対応。

### カント整形

- 論理レールを選択すると分割せず両端と接続先へカントを適用し、速度0では水平化、Ctrl+↑↓では±50 km/hになることを確認する。
- 選択済みは水色、接続する影響対象は黄緑、未選択ホバーは黄色、選択済みホバーは暗い水色となり、カーソルがなくても解除できることを確認する。適用・Undo後も現在の線形で表示されることを確認する。

### 分岐生成

- 分岐化後に新しく接する既設レールもカント0となり、Undoで元へ戻ることを確認する。
- 端点・中央の分岐生成後にUndoしてもワールドから切断されず、エラーなく元レールへ戻ることを確認する。

### AppleExtended

- 開発者から概ね不具合解消の報告を受領しmainへ統合。個別の全ケース確認済みとは扱わず、今後の再発時は操作順・時刻とlogs/latest.logを確認する。
- 接続cantEdge反転・論理線形ハイライトはKaizPatch/AEで適用。旧コアのブロック/tile一括掃除はAEのみ。接続移動/Undo/走行は今後も継続確認する。
- Section生成にコア配置競合があれば保護道床への代替配置、部分生成なしなら通常生成へfallback。失敗診断はsection creation failed/section owner relocation blockedを参照する。

## 次に行うこと

1. 更新main ZIPで全6ツールのTABホイール（リング/左クリック/中央で変更なし/TAB解除/ESC/マルチプレイリスト）、カント解除色とカーソル非表示を確認する（tool-wheel.md）。Pの3種類切替/ブロック格子/影付き文字も継続確認し、暫定SRBXPatchは継続導入する。
2. KaizPatch/AEで自由端点の接続を新規生成し、通常車両の両方向低速走行・移動・Undoを確認する（srbx-free-endpoint-mod.md）。
3. AppleExtended v2.5.3で分岐描画patchのBootstrapログとoffsetあり/なし描画を確認する。
4. レール移動のCTRL中ホバー抑止、カントのレール単位選択/両端適用/速度0/±50/Undo、分岐の3種スナップとGUIをKaizPatch/AEで確認する。全6ツールのHヘルプの行分けと末尾のスクロール案内も確認する。
5. 不具合時は機能名・操作順・時刻と`[SuperRailBuilderX`または`[SRBX rail patch]`を含むログを共有する。

## 双方向連絡

### 開発者からCodexへ

```text
- YYYY-MM-DD 開発者:
  共有・依頼:
  関連ファイルまたはIssue:
```

### Codexから開発者・ローカルCodexへ

- 2026-10-10 ローカルCodex: 開発者の新方針でmain/AEも自由点へ統一しSRBXPatchを分離。新規repo/fork/Issue/PR/コメント禁止は継続。実機確認は[srbx-free-endpoint-mod.md](srbx-free-endpoint-mod.md)。

## 直近の完了

- 2026-10-11 ローカルCodex: ホイールの左クリック決定、6区画リング、中央で変更なしを実装。全4build・入力/GUI・旧Java検証成功、ZIP更新、実機未確認。[10月履歴](history/CODEX_HISTORY_2026-10.md)。[d51c996](https://github.com/hi03s/SuperRailBuilderX/commit/d51c996)をorigin/mainへpush済み。

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
