# Codex・開発者間 引継ぎ帳

このファイルは、ローカルで作業する開発者とChatGPT/Codexの双方向の情報共有に使います。
どちらが更新しても構いません。作業前に読み、作業後に更新してください。

最終更新: 2026-09-02

## 現在の状態

- rtm-ts 0.12.0を使用した初期環境を構築済み。
- kaizpatch、mc1710、mc1122のmulti-target構成を準備済み。
- NGTOBuilder2のツールキット、サンプルスクリプト、暫定モデル・テクスチャを導入済み。
- RailPosition自由化を確認する試験ツールを実装済み。
- RailPosition自由化の調査結果を `docs/rail-position-free-positioning.md` に記録済み。
- `pnpm gen` と全3ターゲットの `pnpm build` が成功する状態を確認済み。
- RailPosition試験ツールへ、候補探索の例外ガード・診断ログと適用後のクライアントRailMap再生成を追加済み。適用直後の描画更新は実機確認済み。
- NGTOBuilder2と同じ共有compatパスによるキャッシュ衝突を避けるため、バージョン差分APIをSuperRailBuilderX固有の `SRBXApiCompat` へ分離・統合済み。NGTOBuilder2併用環境で未定義エラー解消を確認済み。
- `lib_hi03toolkit_1_0` は今後編集しない参照専用領域とし、共通スクリプトは `src/common/assets/minecraft/scripts/superrailbuilderx` に置く方針を恒久化済み。
- 自動分割レールについて、論理端点選択、KaizPatchX標準APIによる可変セクション再生成、同じ接続点にある2本の同時移動まで実機確認済み。
- 通常レール移動後の即時描画、保存、同じ接続点にある2本の同時移動まで実機確認済み。
- 通常レールの移動後曲線へ不足道床TileEntityだけを追加する処理と、分岐器を安全に対象外にするガードを追加済み。移動後レールの走行を実機確認済み。
- 同じ接続端点にある2本の同時移動は回帰修正後の実機確認済み。通常レールの見かけ上の交差は、道床を追加できない障害物を保持したまま移動する方式へ変更（実機再検証待ち）。
- 自動分割レールの交差は、他レールの通常道床との重なり・走行に成功するケースを実機確認済み。他レールコアとの交差を、分割コア配置衝突と曲線途中の交差に分けて扱う試験修正を追加（実機検証待ち）。
- 自動分割レールの端点移動後に、再分割せず単一コアの通常レールとして再生成する別モデル `SuperRailBuilderX_RailPositionNormalTest` を追加済み。ローカルで全ターゲットの生成・ビルド確認済み（実機検証待ち）。
- 最新ログで自動分割・通常レール再生成の共通失敗原因が、手動型付けしたコアの `markDirty` がMinecraft 1.7.10名へ変換されなかったことだと判明し、compatヘルパー経由で `func_70296_d` へ生成されるよう修正済み。
- 複数セクション再生成と通常レール再生成を、ルート上の道床は空気部分だけ追加し、予定セクションコア位置の非コア道床だけをコアへ置換する試験方式へ変更済み（実機検証待ち）。
- レール敷設、自動分割、自由点移動、道床更新、クライアント同期の知見を `docs/rail-generation-and-free-positioning.md` に集約済み。
- 計算系の共通ライブラリ `SRBXMath` を新設。丸め、角度正規化・スナップ、方向変換、距離計算を収容済み。
- レール生成ツール `SuperRailBuilderX_builder1` の基本機能を実装済み。自由点同士と既設端部同士の生成、位置・角度スナップ、破壊的な自動分割敷設、専用1回Undoをローカルビルド確認済み（実機検証待ち）。

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

- 通常レールの不足道床追加後に列車が走行できることは実機確認済み。旧道床は安全優先で削除せず、既存レール道床も上書きしないため、移動量に応じて未使用道床が残る。
- 他レールの非コア道床との重なりは許可する。新しい方式は既存道床を保持するが、予定セクションコア位置だけは既存の非コア道床を破壊的にコアへ置換する。同一ブロックへ複数所有情報を保存できないRTM構造への恒久対応は未設計で、置換された側を含む両レールの走行確認が必要。
- 通常レールの移動先にレールコア・草・カーペット等がある場合は、その障害物を保持して道床追加だけを省略する。見かけ上の交差移動は可能になるが、その座標を列車が通過できる保証はなく実機確認待ち。
- 自動分割レールの新しいセクションコア候補が他レールコアまたは通常ブロックと一致する場合は、1ブロックへ共存できないため `section_core_conflict` で停止する。複数セクションは標準の一括敷設判定を使わず、空気部分だけ道床を追加してセクションを直接構築する試験経路に統一したが、走行を含む実機検証待ち。
- 最新ログには交差試験中に1回 `Rail not found > x:402 z:-159` がある。開発者報告では成功した交差は両線とも正常通過しているため、どの試行・線路で発生したかは未特定。
- 分岐器は専用構造を通常レール処理で変更すると描画が壊れるため対象外にした。全RailPositionと分岐状態を保つ専用移動処理は未実装。
- RailPosition移動後のUndoは未実装。
- 仮のボタンテクスチャは未配置のパスを指定している。
- Prettier 3.9.6ではTypeScript 26ファイルが `pnpm format:check` に失敗する。参照専用ツールキットとNGTOBuilder2サンプルが対象で、今回変更したSuperRailBuilderXファイルは整形済み。全体整形を別作業として行うか判断が必要。
- 通常レール再生成テストモデルは、ログ上の `markDirty` 例外を修正し、`RailMapBasic#setRail` を使わない空気限定道床配置へ変更した。単一コア化、RailProperty・信号・サブレールの保持、失敗時復元、長距離レールの走行を実機確認する必要がある。
- 最新ログ末尾では候補探索に `missingCores=5` が記録された。繰り返した失敗・復元試験の残骸かは未確定のため、バックアップからの新しい試験ワールドまたは再入場後のログでも継続するか確認が必要。
- builder1は生成経路上の全ブロックを道床・コアへ強制置換する。別レールを含む既存構造を走行不能にする可能性があり、生成失敗時も破壊済みブロックを復元しない試験実装のため、バックアップ環境での実機確認が必須。
- builder1のCtrl+Zは直前に生成した論理レールだけを撤去する専用1回Undo。生成時に破壊したブロックや他レールは復元しない。
- builder1の位置0.5ブロックスナップと角度スナップを同時に使う場合、位置格子を優先してアンカー角へ角度スナップを適用するため、自由点同士でも厳密な直線からわずかに曲がる場合がある。SRB3参照後に仕様を再検討する。
- builder1の既設レール端部と空間点を結ぶ生成は仕様策定待ちとして拒否する。選択とプレビューまでは可能。
- builder1のボタンテクスチャは、指示どおり未配置の `textures/superrailbuilderx/button_builder1.png` を仮指定している。

## 次に行うこと

1. 必ずバックアップ済みテストワールドで `SuperRailBuilderX_builder1` を使用し、自由点同士で短いレールと複数チャンクを跨ぐレールを生成する。
2. 手に持ったレールモデルが適用され、短い場合は通常コア、分割が必要な場合は複数セクションコアになり、両方向走行と再入場後の保存が正常か確認する。
3. PのON/OFF、Ctrl+Pの1度・5度・15度、左クリック、C、カーソル・marker0〜7・selectedLineを確認する。
4. 既設レール端部同士を接続し、精密位置、反転direction、アンカー角・勾配、長さ2/3で滑らかにつながり、接続する3本を走行できるか確認する。
5. 既設端部と空間点のEnter生成が安全に拒否されることを確認する。
6. 通常ブロック、別レール道床、別レールコアを横切る生成を試し、強制置換後の新設レール走行と既設側への影響を確認する。
7. Ctrl+Zで直前の生成レールだけが撤去され、生成時の選択が戻り、破壊済みブロックは戻らないことを確認する。
8. 結果と `latest.log` を共有する。`[SuperRailBuilderX builder1]`、例外、`Rail not found` を重点確認する。
9. builder1確認後、従来のRailPositionテストについて `docs/CODEX_HANDOFF.md` 2026-09-01記録の空気限定道床・通常レール再生成項目を継続確認する。

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

- 2026-09-02 ローカルCodex:
  確認してほしいこと: builder1の自由点生成、既設端部同士の接続、スナップ、破壊的交差、専用Undo。
  確認方法: 必ずバックアップ済みテストワールドを使用し、上記「次に行うこと」1〜8と `docs/builder1.md` の実機検証を確認する。
  結果の記入先: 結果をチャットで共有し、`logs/latest.log` を配置する。クラッシュ時はクラッシュログも配置する。

- 2026-09-01 ローカルCodex:
  確認してほしいこと: 通常レール再生成の例外解消と、空気限定道床・予定コア位置だけを置換する自動分割再生成で両線が走行できること。
  確認方法: 道床を破壊的に置換する試験実装のため、必ずバックアップ済みテストワールドを使用する。上記「次に行うこと」1〜6を確認し、`replacedRoadbedsWithCores`、`Rail not found`、`missingCores` の有無を共有する。
  結果の記入先: 結果をチャットで共有し、`latest.log` を配置する（ローカルCodexが内容に応じて改名する）。

## 作業記録

新しい記録を上に追加します。詳細な議論がGitHub Issueにある場合は、要点とリンクだけを記載します。

### 2026-09-02 ローカルCodex — builder1基本機能・SRBX共通基盤

- バージョン差分APIの公開名を `RailPositionCompat` から `SRBXApiCompat` へ変更し、SuperRailBuilderXスクリプトが使うワールド・乗車・アンカー・RailPosition・builder1生成APIを同クラスへ統合。共有参照専用の `lib_hi03toolkit_1_0` は変更していない。
- `SRBXMath` を追加し、0.001/0.5単位丸め、角度正規化・スナップ、8方向変換、3次元・水平距離を共通化。
- 開発者配置の `builder1.mqo` と `builder1.png` を採用し、必要な `body`、カーソル、marker0〜7、selectedLineだけを登録する別モデル `SuperRailBuilderX_builder1` を追加。ボタンは未配置パスを仮指定。
- 右クリック2点選択、左クリック1段階解除、C全解除、Pスナップ、Ctrl+P角度切替、Enter生成、Ctrl+Z専用1回Undo、Hヘルプ、Q終了を実装。
- 自由点同士はアンカーを一直線上の反対向きに設定し、directionを8方向へ設定。既設端部同士は `getNeighborPos()` 側へ端点を反転して既存コアとの直接衝突を避け、精密位置を一致、アンカー角・勾配を反転、水平アンカー長を端部間距離の2/3に設定。
- 手持ちレールのRailPropertyをサーバー側で再取得・複製し、`autoSplit=true` を設定。経路全ブロックを強制的に道床へ置換し、複数セクションは `RailChunkSectioner.split` から直接構築する。経路チャンクは変更前に全件ロード確認する。
- Ctrl+Zは生成コアの論理識別子を再検証して在線中でない直前レールだけを撤去し、クライアント選択を復元する。破壊した元ブロックは復元しない。
- `references/srb3` を追加し、READMEとignore設定以外はGit管理しない参照置き場を用意。基本仕様・危険性・実機検証を `docs/builder1.md` に記録。
- `pnpm gen` は全3ターゲットで成功。`pnpm build` も全3ターゲットで成功し、10アセットを出力。生成JavaScriptの1.7.10マッピング、SRBXApiCompatターゲット選択、builder1出力、JSON解析、変更ファイルのPrettier、`git diff --check` を確認済み。
- 全体の `pnpm format:check` は参照専用ツールキットとNGTOBuilder2サンプルを含む既存26ファイルのみ失敗。今回変更したSuperRailBuilderXファイルは整形済み。
- ゲーム内動作は未検証。破壊的敷設のため、上記手順を必ずバックアップ済みワールドで再デバッグする必要がある。
- 実装コミット: https://github.com/hi03s/SuperRailBuilderX/commit/2d971ab518ebc207fd4f9455658b07f33e8bb1a4
- 同期: `origin/main` へ同期済み。

### 2026-09-01 ローカルCodex — 空気限定道床と通常レール再生成修正

- `logs/latest.log` を確認。自動分割の独自再生成は `TileEntityLargeRailSectionCore.markDirty`、通常レール再生成は `TileEntityLargeRailNormalCore.markDirty` が存在しないという同じ実行時例外で失敗していた。手動型付けした呼び出しがMinecraft 1.7.10名へ変換されていなかったことが原因。
- 基底コア型を受け取るcompatヘルパーへ更新通知を集約し、生成JavaScriptで全呼び出しが `func_70296_d` になるよう修正。
- 複数セクションの自動分割再生成は標準 `BlockMarker.createRail` の一括配置判定を使わず、`RailChunkSectioner.split` の結果から直接構築する経路へ統一。各ルートの道床は空気部分だけ追加し、既存道床・既存ブロックを保持する。
- 予定セクションコア位置にある非コア道床だけはコアへ破壊的に置換し、`replacedRoadbedsWithCores` をログへ記録する。既存コアや通常ブロックとは共存できないため安全停止する。途中失敗時は置換前の道床と所有コア座標を復元してから元レールを再生成する。
- 通常レール生成版も `RailMapBasic#setRail` を廃止し、空気部分への道床追加と単一コアの直接配置へ変更。通常の交差しない移動も止めていた `markDirty` 例外を同時に解消した。
- 調査結果を `docs/rail-position-free-positioning.md` と `docs/rail-generation-and-free-positioning.md` へ追記。ログを `logs/rail-position-air-only-roadbed-normal-rebuild-20260901-175629-client.log` へ改名して保存。
- `pnpm gen` と `pnpm build` はkaizpatch・mc1710・mc1122の全ターゲットで成功。生成JavaScriptのメソッド名・空気限定道床ログ・`setRail` 不使用、変更compatのPrettier、`git diff --check` を確認済み。全体の `pnpm format:check` は31個の既存ファイルのみ失敗。
- ゲーム内動作は未検証。予定コア位置の道床を実際に置換するため、必ずバックアップ済みワールドで上記手順を再デバッグする必要がある。
- 実装コミット: https://github.com/hi03s/SuperRailBuilderX/commit/8d58d5ca14d3bfb9098bb510ce2a230f0955ec83
- 同期: `origin/main` へ同期済み。

### 2026-09-01 ローカルCodex — Web側追加分の受信・ビルド確認

- `origin/main` の4コミット（`f8abaa7`〜`aff9334`）を競合なくfast-forwardで受信。通常レール再生成テストモデル、専用サーバースクリプト、技術資料を引き継いだ。
- `pnpm gen` はkaizpatch・mc1710・mc1122の全ターゲットで成功。
- `pnpm build` は全3ターゲットで成功し、7個のアセットをコピー。新モデルJSON、共通サーバー・レンダースクリプト、各ターゲットのRailPosition compatが `dist` に生成されたことを確認。
- `ModelVehicle_SuperRailBuilderX_RailPositionNormalTest.json` のJSON解析に成功。KaizPatchX生成JavaScriptに通常レール再生成処理が出力されたことを確認。
- `git diff --check` は成功。`pnpm format:check` は32ファイルで失敗し、受信前からの26ファイルに加えて今回変更された6ファイルをローカルのPrettier 3.9.6が要整形と判定した。ビルドには影響せず、今回は機械的な全体整形を実施していない。
- ゲーム内検証は未実施。上記「次に行うこと」4〜6に沿って、単一コア化、走行、再入場後の保持を確認する必要がある。
- 受信基準コミット: https://github.com/hi03s/SuperRailBuilderX/commit/aff9334
- 同期: `origin/main` の最新状態を受信済み。引継ぎ更新も同期する。

### 2026-09-01 Web側Codex — レール生成・自由点移動の技術資料

- KaizPatchX v1.10.3一次ソースと現行compat実装を照合し、`docs/rail-generation-and-free-positioning.md` を追加。
- RailPositionの基準ブロック座標・精密座標・オフセット、RailMapBasic、コアと道床TileEntityの関係を整理。
- 通常レールの直接生成と `BlockMarker.createRail` の違い、`RailProperty.autoSplit`、チャンク境界によるセクション生成を説明。
- 通常レールと自動分割レールそれぞれの自由点移動、道床の差分追加、論理レールの撤去・再生成、失敗時復元を手順化。
- `markDirty`、TileEntityパケット、ブロック更新、クライアントRailMapキャッシュ再生成の役割を整理。
- 接続端点の一括移動、道床所有権、他レールコアとの交差、分岐器、サーバー・クライアント分離、ゲーム内検証項目を記載。
- READMEから技術資料へリンクを追加。
- `git diff --check` に成功。Markdownのみの変更のためビルドは省略。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/5bedb3e397f9d2edf4630ae76df81b55a8e0f1f3
- 同期: `origin/main` へ同期済み。

### 2026-09-01 Web側Codex — 通常レール再生成テストモデル

- 開発者連絡を引き継ぎ、「新しい2点間レールの追加」ではなく、現行ツールで自動分割レールを移動した際の再生成先を単一コア通常レールへ変える依頼であることを確認。
- 現行モデルを維持したまま、別モデル `SuperRailBuilderX_RailPositionNormalTest` と専用サーバースクリプトを追加。
- 端点選択・0.01 m丸め・右クリック2回・Enter適用・左クリック段階解除は現行レンダラを共有する。
- 元が通常レールなら従来の更新処理を使用し、元が自動分割レールなら論理レールを撤去後、`RailMapBasic#setRail` と単一の `largeRailCore0` で通常レールとして再構築する。
- RailPropertyの `autoSplit` が有効でも `BlockMarker.createRail` を通さないため再分割しない。RailProperty、信号、サブレールを新コアへ引き継ぐ。
- 通常レール生成に失敗した場合は、元の論理RailPositionからKaizPatchX標準処理で自動分割レールを復元する。
- 変更ファイルのPrettier確認、JSON解析、`git diff --check` は成功。
- Web作業環境では生成済みマッピングがなく、Gradle配布物の取得制限もあるため `pnpm build` は未実施。ローカルで `pnpm gen`、`pnpm build` と上記「次に行うこと」4〜6の実機確認が必要。
- 実装コミット: https://github.com/hi03s/SuperRailBuilderX/commit/f8abaa7c009dd03e5e2c801af06daf31d1474012
- 同期: `origin/main` へ同期済み。

### 2026-09-01 ローカルCodex — 自動分割レールのコア交差対応

- `logs/latest.log` を確認。自動分割レールの交差は成功例と失敗例があり、成功した交差は開発者確認で両方の線路を正常に通過した。
- 成功例ではセクションコア候補が既存の通常道床 `LRBase` 上にあっても標準再構築が成功。失敗例は `LRBase` ではなく、いずれも他レールの物理コア `LRCore` との1ブロック衝突だった。
- 新しい分割コア自身が他レールコアと衝突する場合は `planned section core conflict` / `section_core_conflict(N)` として安全に停止するよう診断を分離。
- 曲線途中だけが他レールコアを横切る場合は、既存コアを保持してその座標への道床設置を省略し、各セクションを再構築する試験経路を追加。標準構成手順を維持し、標準の一律障害判定のみを置き換える。
- 試験経路の例外・作成失敗時は作成途中の新規セクションコアを除去し、既存の復元処理へ移る。
- ログに1回 `Rail not found > x:402 z:-159` があるが、開発者報告では成功交差を両線とも正常通過しており、発生試行は未特定。
- 調査結果を `docs/rail-position-free-positioning.md` へ追記。ログを `logs/rail-position-section-core-crossing-20260901-015858-client.log` へ改名して保存。
- 翌日にWeb側Codexへ依頼予定の、現行テストツールを基にした通常レール生成版（別の自動車モデルとして新規追加、現行モデルは維持）を開発者連絡欄と次の作業へ記載。
- `pnpm gen` と `pnpm build` はkaizpatch・mc1710・mc1122の全ターゲットで成功。変更TypeScriptのPrettier確認、生成JavaScriptの実行名確認、`git diff --check` も成功。全体の `format:check` は上記26個の既存ファイルのみ失敗。
- ゲーム内で今回のコア交差処理は未検証。バックアップ済みテストワールドで上記手順による再デバッグが必要。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/0aaa0e2e9f084ee4a1a761ba584fb1b46d5caa8c
- 同期: `origin/main` へ同期済み。

### 2026-09-01 ローカルCodex — 交差移動の緩和と自動分割診断

- `logs/latest.log` を確認。接続端点2本の同時移動と、移動後レール上の走行は正常だった。
- 交差・重ね移動の失敗は、草・カーペット・別レールの `LRCore` による `roadbed_conflict` と、自動分割レールの `section_rebuild_failed` に分かれていた。
- 通常レールは障害物を壊さず、その座標への不足道床追加だけを省略して端点・RailMapを移動できるよう変更。省略座標と既存ブロックは `normal roadbed obstacles retained` へ記録する。
- 自動分割レールは物理セクションコアの再配置が必要なため衝突判定を緩和せず、変更後のセクションコア候補座標・既存ブロックを `planned section cores` へ記録する診断を追加。
- 試験後のワールドにあった論理RailPosition未初期化のセクションコアで候補探索例外が繰り返されないよう、`sectioned_uninitialized` として無視するガードを追加。
- 調査結果を `docs/rail-position-free-positioning.md` へ追記。ログを `logs/rail-position-crossing-section-failure-20260901-013727-client.log` へ改名して保存。
- `pnpm gen` と `pnpm build` はkaizpatch・mc1710・mc1122の全ターゲットで成功。変更TypeScriptのPrettier確認と `git diff --check` も成功。全体の `format:check` は上記27個の既存ファイルのみ失敗。
- ゲーム内で今回の交差緩和・追加診断は未検証。上記手順による再デバッグが必要。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/a74667d03c362fb74213b5b10390f1805002fa3e
- 同期: `origin/main` へ同期済み。

### 2026-09-01 ローカルCodex — 重複道床による移動回帰の修正

- `logs/latest.log` を確認。交差・重ね移動では他レールの `LRBase` 29〜62個を `roadbed_conflict` と誤判定していた。
- 同じ端点2本の移動では、1本目が追加した道床2個を2本目の自動分割レールが衝突扱いし、`partial_target_1:roadbed_conflict(2)` になっていた。
- RTM標準の `RailMap.canPlaceRail` と同様に、他レールの非コア道床は重なりを許可するよう修正。レールコアと草などの非レールブロックだけを真の衝突として停止する。
- 分岐器について再確認。`RailPosition#setPosition` は分岐器の端点にも利用できるが、分岐器コアが複数RailMapからなる分岐オブジェクトをキャッシュするため、通常レールと同じ端点更新だけでは再生成されず描画・走行情報が不一致になる。現在の試験ツールには専用再構築を未実装であり、安全のため対象外としている。
- `docs/rail-position-free-positioning.md` へ重複道床の扱いと分岐器が専用対応を要する理由を追記。
- ログを `logs/rail-position-roadbed-conflict-regression-20260901-005513-client.log` へ改名して保存。
- `pnpm build` はkaizpatch・mc1710・mc1122の全ターゲットで成功。Prettier確認と `git diff --check` も成功。
- ゲーム内で回帰修正は未検証。上記手順による再デバッグが必要。
- コミット: https://github.com/hi03s/SuperRailBuilderX/commit/09c7793d4c4615d147e7fbc3aea4ada8f4ad8001
- 同期: `origin/main` へ同期済み。

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
