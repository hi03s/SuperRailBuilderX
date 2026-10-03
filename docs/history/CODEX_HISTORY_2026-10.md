# Codex作業履歴 2026-10

## 2026-10-03 ローカルCodex: AE v2.5.3対応とmain統合

- feature/appleextended-compatでAE正式タグv2.5.3（6f74d99）を従来基準9df86c2と比較。生成・論理レール・移設・NBT APIのシグネチャは維持され、最小Section長2 mとポイント転換APIが追加されている。
- AE依存をcom.github.Kirtmuna:AppleExtended:v2.5.3へ更新。JitPackの正式タグ取得はタイムアウトしたため、標準手順のpnpm genは未完了。開発者から制作者へ報告予定。
- 当初、公式dev JARとGroovy 2.4.15から型生成するrtm-tsのローカルパッチを作成したが、開発者の「rtm-ts側には手を出さない」指示に従い撤回。追加ダウンロード処理・pnpmパッチ・依存設定を除去し、pnpm install --frozen-lockfileで未改造のrtm-ts 0.12.0へ復元した。コミット4335698のパッチは最終状態に残さない。
- 最新origin/main（bd32599）をmerge commit cdca589で統合。競合は双方の履歴・Git除外を維持し、AEのSection移動ガードとmainのswitch_unsupported理由コードを併存させた。
- 検証済み: pnpm install --frozen-lockfile、公式dev JARによる全4ターゲット型生成、パッチ撤回後のpnpm build（common・kaizpatch・mc1710・appleextended・mc1122）、pnpm test:rail-patch、変更対象Prettier、git diff --check、origin/main包含確認。
- pnpm format:checkは既存16ファイルの整形差分で失敗。参照専用ツールキットを含むため一括整形は行わない。
- 未検証: JitPack経由でのv2.5.3型生成と新規環境構築、Minecraft実機の描画・生成・分割・分岐・走行・Undo。ビルドには公式dev JARから一時生成した型定義を使用した。JAR・型定義・生ログはGitへ追加しない。
- 次: JitPack復旧後にpnpm genとpnpm buildを標準手順で確認し、AE描画patchを実機確認する。Section group移設APIは引き続き存在しないため、自動分割レール移動は未対応。
- 撤回・検証記録コミット87d1947までorigin/feature/appleextended-compatへpush・同期済み。

## 2026-10-03 ローカルCodex: JitPack復旧後の標準ビルド再検証

- 同じcom.github.Kirtmuna:AppleExtended:v2.5.3のPOM取得を再確認し、約0.4秒でHTTP 200を確認。
- 未改造rtm-ts 0.12.0でpnpm genを実行し、JitPackからv2.5.3依存を取得できた。全4ターゲットの型生成・common API生成に成功。
- その型定義でpnpm build（common・kaizpatch・mc1710・appleextended・mc1122）とpnpm test:rail-patchに成功。公式dev JARを追加するローカルパッチや取得処理は使っていない。
- 当初のJitPackタイムアウトと標準型生成未確認は解消。Minecraft実機検証は未実施。新しいPCへのインストールそのものは未検証。
- 引継ぎ帳とAE機能資料を現在の検証結果へ更新。調査用ログはGitへ追加せず削除した。
- 検証記録56182c4をorigin/feature/appleextended-compatへpush・同期済み。

## 2026-10-03 ローカルCodex: AEモデル構築クラッシュとKaizPatchXへの影響確認

- 開発者提供のcrash-2026-10-03_17.47.46-client.txtを例外・SRBX識別子で絞り込んだ。モデル構築中のrender_builder1.jsでRAIL_RENDER_PATCH_SOURCEのエスケープが消失し、NashornのExpected ; but found undefinedとなっていた。
- 原因特定のため、配布JSとAE/KaizPatchX JARのModelPackManager.loadScriptバイトコードを比較。AE v2.5.3はMatcher.replaceFirstへinclude本文をそのまま渡すが、KaizPatchX v1.10.3はMatcher.quoteReplacementで保護する。
- 開発者指示に従いKaizPatchXへの影響を確認してから判断。共通patch_sourceの文字列埋込みを関数toStringへ変更し、描画補正計算は維持。再適用防止フラグは対象Engineのグローバルへ保存する。除外パスの正規表現も同様に壊れるため文字コード92のsplit/joinへ置換。
- 配布JSを両include方式で再帰展開する構文回帰テストを追加。全renderエントリ、Windows除外パス、offsetあり/なし、通常レール、再適用防止、GL復元を検証。旧テストはTS本文だけを評価し、配布JS読込での破損を検出できなかったため、実際のビルド済みJSを評価するよう変更した。
- bootstrapと対象Engineの既存例外ガードを維持し、NGTLogへsource prepared: function serializationとコード長の診断を追加。モデル構築段階の構文エラーはcatchで防げないため、includeで壊れない生成形式で対処する。
- 検証済み: pnpm build（全4ターゲット）、pnpm test:rail-patch、変更対象Prettier、git diff --check、pnpm exec rtmx zip（83ファイル）。rtm-ts・参照専用ツールキットは変更していない。動的な対象Engine用関数にはanyのためRTM002警告が出るが、既存のAPI名を維持した配布JSでテスト成功。
- 生クラッシュログはGit除外。最小抜粋をlogs/appleextended-rail-patch-include-crash-20261003.logに保存し、ローカルパス・PC情報・無関係なMod情報を除去した。
- 未検証: Minecraft実機のAE起動とKaizPatchX描画再確認。artifacts/SuperRailBuilderX-alpha-0.1.0.zipへ置き換え、AEモデル構築成功、source prepared: function serialization、completedのfailed=0、offsetあり/なし分岐描画を確認する。不具合時は時刻・操作とlogs/latest.log内の[SRBX rail patch]出力および例外前後をlogsへ格納して共有してもらう。
- 修正コミット3ed8919をorigin/feature/appleextended-compatへpush・同期済み。

## 2026-10-03 ローカルCodex: pnpm zipのRTM002警告解消

- patch_source.tsの動的Engine向けany宣言と引数の暗黙anyが、rtm-tsのSRG変換判定でRTM002を出していた。commonと4ターゲットのビルドで合計65件発生。
- RailPatchPosition・RailPatchTile・RailPatchRenderer・RailMapRenderer・RailPatchGLの構造型を定義し、Javaクラスをimportせず対象Engineの既存API名を維持する。シリアライズする関数の引数にも型を明示した。rtm-tsと参照専用ツールキットは変更していない。
- 検証済み: pnpm zip（全4ターゲットビルド、警告・エラー0件、83ファイルのZIP生成）、pnpm test:rail-patch（KaizPatchX/AE両include方式・描画補正・再適用防止・GL復元）、対象Prettier、git diff --check。
- 変更前後の配布patch_source.jsを評価し、RAIL_RENDER_PATCH_SOURCE文字列が完全一致することを確認。型宣言のみの変更で、対象Engineへ評価させるコードは変わらない。
- 未検証: Minecraft実機での起動・描画再確認は前項の確認待ちを維持。
- 修正コミットdcb52b4をorigin/feature/appleextended-compatへpush・同期済み。

## 2026-10-03 ローカルCodex: AE生成unsupportedのMod ID判定修正

- 開発者提供latest.logから、18:45:17の生成A要求が例外ではなくresult=unsupportedで終了したことを確認。[SRBX rail patch]のBootstrapログも存在しなかった。
- AE v2.5.3の実機Mod一覧はapplelib@2.5.3。公式dev JARのAppleLib @Mod(modid="applelib")でも確認した。rtmx.jsonは存在しないappleextended IDを判定していたため、mc1122のunsupported生成APIとno-op描画patch platformへフォールバックしていた。
- runtimeDispatchをLoader.isModLoaded('applelib')へ修正。AEをmc1122より優先し、KaizPatchX/mc1710の優先順位は維持。rtm-tsとツールキットは変更しない。
- ビルド済みSRBXApiCompatと描画patch platformのdispatch関数に対する回帰テストを追加。実際のapplelibだけがロードされたAE、通常mc1122、通常mc1710、KaizPatchXとKaizPatchX優先を確認した。pnpm test:runtime-dispatchから実行可能。
- 検証済み: pnpm zip（全4ターゲット、警告・エラー0件、83ファイル）、runtime dispatchテスト、pnpm test:rail-patch、対象Prettier、git diff --check。
- 生latest.logは引き続きGit除外。必要な生成結果とMod識別をlogs/appleextended-generation-unsupported-20261003.logへ抜粋し、PC・パス・他Mod情報を除去した。
- 未検証: 実機でAE APIによる生成成功。修正版artifacts/SuperRailBuilderX-alpha-0.1.0.zipを導入し、生成Aの通常/自動分割レール生成とUndo、[SRBX rail patch] bootstrap/completed（failed=0）を確認する。失敗時は操作時刻とlogs/latest.logの[SuperRailBuilderX builder1]・[SRBX rail patch]・例外前後をlogsへ格納して共有してもらう。
- 修正コミット49126a6をorigin/feature/appleextended-compatへpush・同期済み。

## 2026-10-03 ローカルCodex: AE生成結果・論理ホバー・nullクラッシュ・bootstrap修正

- latest.logの対象ログと例外に絞り、生成Aはcreate_failed、分割描画はmc1122側getLogicalRailMapでnull.length、bootstrapはaddScheduledTask is not a functionと特定。生ログはGitへ追加せず必要部分をlogs/appleextended-generation-hover-retest-20261003.logへ保存した。
- AE v2.5.3公式BlockMarker.javaを確認。公開createRailは内部生成結果を捨てて末尾で常にfalseを返す。SRBXはこれを失敗と扱っていた。生成前後のコアを比較し、新規コアが確認できた場合だけ成功・Undo登録する方式へ変更。未生成や同じ既存コアは失敗のままとし、[SuperRailBuilderX AE] creation confirmed/not confirmedとapiResultを診断出力する。
- AE SRBXApiCompatにgetLogicalRailMap overrideがなく、mc1122の個別物理RailMapへフォールバックしていた。AEの論理端点からのRailMapへ委譲するoverrideを追加。nullコア・配列・端点ではnullを返す。mc1122の既存処理にもgetAllRailMapsのnullガードを追加した。KaizPatchXの実装は変更していない。
- 描画patchのタスク登録はany引数でオーバーロードを特定できずMCP名が残っていた。既存のjava.util.concurrent.Callable型を明示し、Minecraft.func_152343_aとして出力されることを確認。Runnableのスキャン追加はThreadの既存呼出に影響するため採用せず、元のスキャン範囲を維持した。rtm-ts・ツールキットは未変更。
- 配布JavaScriptの回帰テストpnpm test:appleextendedを追加。false戻り値＋新規コアを成功とし、未生成・既存コアのままは失敗、各Sectionから論理端点の全体Map取得、null端点ガード、SRG名でのタスク登録を確認。
- 検証済み: pnpm gen、pnpm zip（全4ターゲット、警告・エラー0件、83ファイル）、pnpm test:appleextended、pnpm test:runtime-dispatch、pnpm test:rail-patch、対象Prettier、git diff --check。
- 未検証: 実機の通常/自動分割生成とUndo、分割ホバー全体表示・分割とUndo、ワールド終了時の描画、[SRBX rail patch] completed（failed=0）。生成済みでも失敗表示だった旧テストのレールは自動削除・復元しない。
- 再確認手順: バックアップ済みワールドでartifacts/SuperRailBuilderX-alpha-0.1.0.zipへ交換し、上記を確認。問題が残る場合は操作時刻とlogs/latest.logの[SuperRailBuilderX AE]・[SuperRailBuilderX builder1]・[SRBX rail patch]・例外前後をlogsへ格納して共有してもらう。
- 修正コミット25609e2をorigin/feature/appleextended-compatへpush・同期済み。

## 2026-10-03 ローカルCodex: AE生成・選択・Undoと論理レール移動修正

- 開発者の19:12～19:15のlatest.logをSRBXログで絞り込み、必要部分を`logs/appleextended-tool-selection-generation-20261003.log`へ抜粋。生ログとユーザーのgui_base.xcfは追加しない。描画patchはpatched=167/failed=0だった。
- 生成・分割・複線コピーの成功確認がAEの実際のコア所有端点と不一致。AEはblockY同値で2番目を選ぶため、その規則でコア/Undoキーを取得するよう修正。
- builderA/分岐/カント/移動が共用する選択理由でSectionを拒否していた。論理端点で選択を許可し、switch理由を共通仕様へ統一。実装範囲を移動まで広げたのは、関連調査でAEの全体移動がmc1122のunsupported stubへ落ちることが判明したため。
- 移動は通常/Sectionの論理レール全体を再生成する固有helperで実装。変更前のキー/端点/占有/全group member存在/所有端点を検証、モデル/信号/サブレールを保持し、失敗時は元状態へ復元。Section単体のrelocateRailは使わない。分岐レール自体の移動は未対応。
- Undo要求がログに無く入力原因は未確定。共有toolkitを変更せずSRBX固有InputManagerで左右Ctrlを許可し、クライアントCanUndoフラグのゲートを除去してサーバーに最終判定させる。分割/カントUndoは全対象を破壊・更新前に検証する。
- 実行済み: pnpm zip（全4ターゲット、警告0）、test:appleextended（生成所有端点/論理選択/移動成功・復元成功/復元失敗/欠損group/占有・変更拒否/Undo全対象事前検証）、test:input（左右Ctrl・押下瞬間）、test:rail-patch、test:runtime-dispatch、変更TSのPrettier確認、git diff --check。
- pnpm format:checkは今回未変更の既存9ファイルの整形差分で失敗。今回変更TSは整形確認成功。rtm-tsと参照toolkitは変更していない。
- 未実施: Minecraft/AE/KaizPatchX実機再検証。バックアップ済みワールドで各ツールの選択→適用→左右Ctrl+Z、移動失敗復元、走行・再ログインを確認。失敗時は機能・操作順・時刻とlogs/latest.logを提出し、AE move診断を含め調べる。以前の失敗生成でUndo記録がないレールは新しいUndo入力だけで復元できない。
