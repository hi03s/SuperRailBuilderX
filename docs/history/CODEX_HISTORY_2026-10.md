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

## 2026-10-03 ローカルCodex: AE既設道床保護・カント/分岐・空Undo修正

- 19:37～19:42 latest.logを必要範囲へ絞り、生成・分割/移動Undo成功、空Undo、複線一部失敗、カントsetTag TypeError、分岐BlockMarker:296 NPEを確認。`logs/appleextended-roadbed-cant-branch-retest-20261003.log`へ抜粋し、生ログは追加しない。
- 未選択接続レール消失のため調査を広げ、AE公式v2.5.3ソース/dev JARでBlockLargeRailBase.breakBlockが元コア.breakLogicalRailを呼ぶことを確認。Section所有位置に他レールの道床があると新コアへの置換が他レールを削除する。全Section所有位置を事前検査し、競合時はモデルを複製して通常生成へフォールバック。通常所有位置も保護し、同高の空いている反対端点を使える場合だけ変更し、両端とも競合なら生成前拒否。
- AE標準配置は同一baseブロックでもsetStartPointを変更するため、既設道床所有先を退避・finally復元する共通保護helperを追加。分割/Undo/移動/複線/分岐でも共通生成経由で保護する。複線の成功確認は論理RPではなくRailChunkSectionerの実際の最初の所有位置を使う。
- カントsetTagの第2引数にNBTBaseを指定し、生成JSのfunc_74782_a変換を確認。単なるNBTTagCompound変数注釈/引数castでは変換されず、新しいSRGのみのテストが検出した。
- 分岐はfinal switchType代入が無効となりRailMakerが種別判定不能、public marker APIのnull playerへ到達していた。SwitchType NBTから再生成し、線形/配置/既設道床所有位置を事前検証して公開APIで生成。protected fixRTMRailMapVersionとRP/Stateを正規NBTで初期化し、直接フィールド代入をしない。
- 空Undo要求は前回除去した可否フラグのゲートを全6ツールへ戻し、単回Undo成功時にクライアントもfalseへ更新。カント複数Undoの残履歴はサーバー判定のまま。左右Ctrl対応を維持する。
- 実行済み: pnpm zip（全4ターゲット、警告0、87ファイル）、test:appleextended（既設道床競合/実Section所有位置/両端保護時非破壊拒否/成功と例外時の道床所有復元、SRG-only NBT、final/protected Javaフィールド、分岐事前拒否/生成、既存選択/移動/復元/Undo検証）、test:input、test:rail-patch、test:runtime-dispatch、変更TSのPrettier確認とgit diff --check。全体整形は前回確認済みの未変更9ファイル差分が残るため再実行しない。
- 未実施: Minecraft/AE/KaizPatchX実機再検証。バックアップワールドで接続レール分割→Undoと未選択レール保護、複線複数生成、カント適用→複数Undo、中央/端点分岐→Undo、空履歴Ctrl+Z無反応を確認。旧版で既に消失したレールをこのコード変更だけで復元することはできない。失敗時は操作順・時刻とlogs/latest.logを共有する。rtm-ts・参照toolkitは未変更。

## 2026-10-03 ローカルCodex: 接続カント・複線失敗・Sectionゴースト再修正

- 20:07～20:14 latest.logをSRBX関連へ絞り、logs/appleextended-connected-cant-copy-ghost-20261003.logへ抜粋。中央カントinvalid_endpoint、分岐Undoのundo_cant_restore_failed→undo_rail_changed、複線create_failed、接続移動Undoのrail_overlap、一部移動move_failed_rolled_backを確認。無関係なfixrtm/テクスチャ/advancementエラーは抜粋しない。
- 接続カント探索でcore参照を比較すると同じgroupの別Sectionを他レールと扱い、自分へ逆符号のカントを再適用する。論理キーで自グループを除外し、ロード済み論理端点を重複除外して探索、yawから符号を決める。centerモードを追加し、端点処理の再計算で明示中央カントを上書きしない。
- 分岐で自グループを外部カント退避に含めない。Undoで外部カント復元対象も削除前に検証し、変更/占有時に破壊せず再試行可能とする。
- 複線のネイティブSectionコア未生成理由は未確定。予定Section所有ブロックすべてに生きた所有コアがない場合だけ、モデルを複製してautoSplit=falseで1回再試行。部分生成や既設レールがあれば再試行しない。owner座標/partial/creative診断を追加。元モデル・既設道床/コア保護を維持する。
- 旧代表コアが新groupへ置換されると旧位置だけを見たghost除去が早期returnする。クライアント限定でロード済み現存Sectionを旧論理キーにより探索し、置換された新group/無効な旧tile参照を削除しない。world.loadedTileEntityListは型を通じfield_147482_gへ変換する。
- 移動失敗時のrollbackも新group identityになる。共通moverで更新コアがある失敗の旧キー除去を通知し、Undo記録を復元後のキーへ更新、クライアントの古い選択を解除する。他ターゲットでワールド変更前に拒否し更新コアなしのケースには影響しない。rail_overlap保護は解除していない。
- 実行済み: pnpm zip（全4ターゲット・警告0・87ファイル）、test:appleextended（7スイート: 接続同向/逆向・論理重複除外・中央・全Section NBT伝播・部分生成時非破壊拒否・通常再試行・置換代表位置ゴースト・サーバー除去抑止・rollback同期/Undo再試行を含む）、test:input、test:rail-patch、test:runtime-dispatch、変更TS/テスト/package.jsonのPrettier確認、git diff --check。生成JSのfield_147482_g/func_175625_s変換を確認。全体format:checkは未変更の既知9ファイル差分があり再実行しない。Minecraft/AE/KaizPatchX実機は未実施。バックアップ済みAEワールドで接続カント両側/中央→Undo、複線複数コピー→Undo、接続2本移動→Undo、一部失敗後の再選択・再Undo・ゴースト・再ログイン/走行を確認する。失敗時は操作順/時刻とlogs/latest.logを格納する。rtm-tsと参照toolkitは未変更。
- コミット `8b83fc2` を `origin/feature/appleextended-compat` へpush済み。HEADとoriginの差分0/0を確認。ユーザーの未追跡gui_base.xcfを保持。

## 2026-10-04 ローカルCodex: 接続端部移動の片側失敗修正

- 00:32～00:33 latest.logからSRBX移動/生成の必要箇所だけlogs/appleextended-connected-endpoint-move-20261004.logへ抜粋。targets=2の最初はtarget_0:rail_overlap、次は先行レール再生成後partial_target_1:rail_overlap、Undoもundo_0:rail_overlap。独立した複数平行移動とUndoは成功しており、接続点の判定へ調査を絞った。前回の複線通常生成再試行は同ログで成功確認。
- AE移動は両論理端点ブロックのgetRailCoreが他レールなら拒否していた。接続端点のbaseは先行レールが所有するため、実際のコアを別位置へ安全配置できる場合も片側を拒否する。これはUndo時も同じ。
- 既存createFromPositionsのSection所有位置/通常所有位置/同高反対端点選択をplanCreationへ抽出し、移動前判定にも使用。削除予定の自グループだけキーで無視し、他グループのコア・道床を保護。生成直前は無視なしで再検証し、Section所有先競合なら通常生成へ切替、両候補とも塞がっていれば元レール削除前に拒否。共通mover・KaizPatchX・rtm-ts・参照toolkitは変更しない。
- 実行済み: pnpm zip（全4ターゲット・警告0・87ファイル）、test:appleextended（8スイート）、test:input、test:rail-patch、test:runtime-dispatch、変更TS/テスト/package.jsonのPrettier確認、git diff --check。新回帰テストはbuiltの実配置計画と移動helperを組み合わせ、共有端点2本の順次移動、逆順Undo、先行道床所有維持、通常生成fallback、配置候補2か所が他レール所有の場合の非破壊拒否を検証。
- 未実施: Minecraft/AE/KaizPatchX実機。バックアップ済みワールドで今回の同じ接続端部を選択→移動→Undo、再移動、再ログイン/走行を確認。失敗時は操作順・時刻とlogs/latest.logを格納。新診断placement blocked before removalが出れば実際の保護配置拒否を調べる。ユーザーgui_base.xcfと生ログを追加しない。
- 修正コミット`a9df8bb`を`origin/feature/appleextended-compat`へpush済み。HEAD/origin差分0/0を確認。

## 2026-10-04 ローカルCodex: 両端所有先競合・クライアントSectionゴースト

- 00:46～00:47 latest.logをlogs/appleextended-endpoint-owner-client-ghost-20261004.logへ最小抜粋。接続2本移動/Undo成功も確認したが、00:46:27で両コア候補が保護対象となりpartial_target_1:rail_overlap、00:47:19一括Undoもrail_overlap。別操作のrail_not_foundはクライアント旧Section残存との関連を疑い、再入場で消えるという実機報告に合わせて描画参照/packet順を調べた。
- 両端候補が塞がる場合だけ、AppleExtendedSectionPlacementCompatで既存のRailChunkSectioner区間に属する道床の空き・ロード済み座標を選ぶ。物理Section.startRPの所有ブロックを移しsetPositionで精密座標を保持、論理RP/区間ratioは変更しない。公式v2.5.3/dev JARのRailMapSection.getRailPosがsource+ratioへ委譲することと、BlockMarkerのSection生成手順を確認し公開APIで補完。正常な従来経路は維持する。
- 全物理配置先とmap.canPlaceRailを書込み前に再検証、所有座標を重複排除。NBTでprotected version/モデル/physical RPを初期化しconfigureRailSectionでUUID/論理RP/全コア一覧を設定。共有道床所有先はfinally復元。途中失敗なら今回の未完成コアだけ除去し、全コア初期化成功後にpacketを送る。空きなしは診断して元レール削除前に拒否。
- 独立したghost調査/実装をサブエージェントへ委譲、親が統合確認。AEのクライアント掃除でbreakLogicalRailを使わず、旧keyの現存tileのみremoveTileEntity、切離し参照はinvalidateで公式GL削除処理を実行。WeakHashMapで同参照の重複解放を抑止し、group座標からloaded一覧未反映tileも調べる。後着旧packetを100tickまで再確認し、掃除件数だけNGT診断する。新keyとサーバーは変更しない。
- needsRailClientGhostRetry compat hookを追加し、AEのsection keyのみ再確認を許可。KaizPatchX/mc1710/mc1122はfalseで従来cleanupの頻度/動作を維持。共通rendererだけに期限付きqueueを追加。rtm-ts/参照toolkitは未変更。
- 実行済み: pnpm zip（全4ターゲット・警告0・88ファイル）、test:appleextended（9スイート: 両端保護でもSection内代替配置・論理RP/ratio維持・SRG-only NBT・全配置事前検証・初期化失敗時非破壊cleanup/packet抑止、chunk/loadedずれ・stale GL解放・後着旧packet・new group保護・server no-opを含む）、test:input、test:rail-patch、test:runtime-dispatch、変更TS/テスト/package.jsonのPrettier、git diff --check。全体format:checkは既知の未変更差分があり再実行しない。
- 未実施: Minecraft/AE/KaizPatchX実機。バックアップワールドで失敗した端点移動→Undo、接続2本・一括移動、再入場せずghost消失、再ログイン/走行・モデル/カント保持を確認。失敗時は操作順/時刻とlogs/latest.log、新診断section owners relocated/section owner relocation blocked/client ghost cleanupを提出。実機でのghost原因特定は診断による再確認が必要。ユーザーgui_base.xcfと生ログは追加しない。
- 修正コミット`1090f35`を`origin/feature/appleextended-compat`へpush、HEAD/origin差分0/0を確認。

## 2026-10-04 ローカルCodex: 移動後クラッシュ・生成A接続カント反転

- latest.logの02:37:07移動/02:37:10 Undoはサーバーresult=ok/undo_ok。その直後にChunk.func_186033_a NPEとRailPartsRendererBase.shouldRenderObject NPEでRailMover描画クラッシュ。必要箇所をlogs/appleextended-move-chunk-highlight-crash-20261004.logへ抜粋。Undo自体のサーバー失敗はこの操作では記録されていない。
- 前回のtile-only ghost掃除はコアブロックを残して未初期化tileを再作成可能にしていた。旧key/同一参照の確認を維持し、AEクライアントでsetBlockToAirに変更。公式v2.5.3 BlockRail.breakBlockはisRemoteで論理全体削除を抑止するため、他グループの道床へ連鎖しない。チャンク例外との因果は実機再確認が必要。
- v2.5.3 JARのshouldRenderObjectはモデルスクリプト戻り値をBoolean.booleanValueに変換するためnullでNPE。AEの論理mapと物理Section所有先の違いもあるため、参照toolkitを編集せずSRBXRailHighlightで論理線形を直接描画。移動/分割/複線/カント/分岐の同じ呼出しを統一。AEでは色付き線の強調表示になり、GL属性/begin/endは例外時も復元。KaizPatch/他2ターゲットはcompat=falseで従来のモデルハイライトへ委譲。
- AE RailMapBasic.getRailRollは開始cantEdge/終了-cantEdgeを使う。生成Aの接続RPでyaw/directionを反転するときcantEdgeも反転し、既設RPは変更しない。cantCenter/KaizPatchの接続変換/rtm-tsは変更しない。開始/終了の既設端点と新規開始/終了側、正負/0カントの物理roll連続性を回帰検証。
- 実行済み: pnpm zip（全4ターゲット・警告0・89ファイル）、test:appleextended 10スイート、test:input/test:rail-patch/test:runtime-dispatch、変更ファイルPrettier、git diff --check。ghostテストはtile-only除去禁止と旧ブロック除去/新コア保護を追加。highlightテストはAE callback不使用・論理全長・GL復元・診断抑制・従来renderer委譲を検証。
- 未実施: AE/KaizPatchのMinecraft実機。移動→Undo→再移動、ghost/チャンク例外、正負カントの端点接続を再確認し、操作時刻とlogs/latest.logを提出。KaizPatchの端点接続と従来ハイライトも確認する。
- 修正コミット`4bf5aaf`を`origin/feature/appleextended-compat`へpush済み。引継ぎ帳へ同期結果を反映。

## 2026-10-04 ローカルCodex: main統合・0.2.0設定

- 開発者から概ね不具合解消の報告とmain統合・0.2.0設定の依頼を受領。origin/mainとの差分を取得し、feature/appleextended-compatをmainへno-ffマージ（a769e94）、競合なし。ユーザー未追跡gui_base.xcfを保持。
- package.json=0.2.0、rtmx配布名SuperRailBuilderX-0.2.0、7箇所のツールVERSION、README/usage/同梱readmeの表記を更新。古いAE実験対象/端点移動のみという説明を現行対応に修正。release-notes.mdへv2.5.3の生成・論理Section編集・Undo・接続カント/クラッシュ修正を記載。rtm-ts/参照toolkit未変更。
- 実行済み: pnpm zip（全4ターゲット、警告0、89ファイル）、test:appleextended 10スイートとtest:input/test:rail-patch/test:runtime-dispatch、変更TS/JSONのPrettier確認・git diff --check、ZIP内バージョン確認。
- 今回未実施: Minecraft実機。開発者の概ね解消という報告を記録し、個別全ケースの確認完了とは扱わない。今回の依頼はバージョン設定とmain統合のため、v0.2.0タグ作成/Release公開は実施しない。正式配布時はdocs/releasing.mdの手順を使用する。
- main統合a769e94・0.2.0設定10a7955をorigin/mainへpush済み、差分0/0。引継ぎ記録も同期する。

## 2026-10-04 ローカルCodex: v0.2.0リリース実行

- ユーザーから公開までの指示を受領。mainの検証済み0.2.0へannotated tagを作成・pushし、リリースActionsを起動。ローカルghは未導入のため既存Git認証をGitHub APIに使用（認証情報は出力/保存しない）。
- 初回Actionsは生成前にGradleファイルがないためsetup-java cacheで失敗。cache-dependency-pathをpnpm-lock.yaml/rtmx.jsonへ指定（9c6c14b）。次はgtnhgradle 2.0.24がJVM 25必須のためJava 17で失敗し、Java 25へ変更（1c73128）。未公開タグはdocs/releasing.mdに従って修正コミットへ付け直し、公開済みタグには触れない。rtm-ts本体未変更。
- 成功run https://github.com/hi03s/SuperRailBuilderX/actions/runs/37143858616 で型生成・ビルド・ZIP生成・Draft作成まで全ステップ成功。最終v0.2.0タグは1c73128、未公開時のみ付け直した。
- Draft id 402638176の本文をrelease-notes.mdと照合。添付SuperRailBuilderX-0.2.0-v0.2.0.zip（226672 bytes、88ファイル）を取得し、readme=0.2.0と4ターゲット収録、SHA-256 de25d9efb8cf9e597f84f87331934fd3668338724d2232223d73c85eb369bcdfを検証。ローカルのユーザー未追跡XCFは配布へ含まれない。
- 2026-10-04 03:30 JST、Releaseをdraft=false/make_latest=trueで公開し、タグから取得可能な正式Releaseを確認: https://github.com/hi03s/SuperRailBuilderX/releases/tag/v0.2.0 。実機再テストは今回未実施（直前の回帰13スイート成功・開発者の概ね不具合解消報告を継承）。設定修正コミットはorigin/mainへpush済み、完了記録も同期する。

## 2026-10-09 ローカルCodex: KaizPatch接続カント・両環境道床保持

- KaizPatchの生成Aで接続カント反転を再現する実機報告を受領。複製した接続RPのcantEdgeをyaw/direction反転と同時に反転し、既設RP/cantCenterを維持。usesGeometryRailHighlightをtrueとしAEと同じ論理線形描画に統一。
- Kaiz共通道床配置は既存Base tile/BlockLargeRailBaseなら無条件skip。終端・所有先なし・tile欠損・overwriteForeign指定も保持。コア設置は別工程。AEは保持付き道床placement helperを追加し、重なる通常生成/Section/分岐を適用。通常コアはNBTでversion/State/RPを初期化し、失敗時は作成したコアだけ除去。Section ownersはJava int[]で格納。capture/restoreは非コアだけ、実変更時のみ同期。
- 独立したネイティブマーカー比較とKaiz実装/新規VM回帰をサブエージェントへ委譲し、親がAE実装・統合・差分確認。一次ソース/JARでは両環境とも同じ通常道床を再配置して所有先を新コアへ更新し、別種類のレールブロックは道床工程で保持。prepareBaseBlocksの地形コピーも既存道床は保持。Creativeはnative canPlaceRailの障害物拒否を迂回するため旧資料を訂正。調査詳細/根拠/比較手順はdocs/roadbed-ownership-investigation.md。
- 実行済み: pnpm zip（全4ターゲット・警告0）、test:appleextended 11スイート/test:kaizpatch/test:input/test:rail-patch/test:runtime-dispatch計15スイート、変更ソース/テスト整形確認、git diff --check。実機未実施。低速片方向引っかかりと所有先上書きの因果は未確定で、新規敷設の生成順・双方向低速/通常速度・標準マーカー対照・移動/Undoを比較しlogs/latest.log提出を依頼。
- rtm-ts/参照toolkit/Mod本体/標準マーカー/公開Releaseは変更しない。ユーザーXCFを保持し、リリースタグ作成/Publishは実行しない。
- 修正コミットab806d8をorigin/mainへpush済み、HEAD/origin差分0/0。引継ぎ帳へ同期結果を反映。

## 2026-10-09 ローカルCodex: 走行デバッグ車両

- 依頼: logs/latest.logを受領。生成ツールでは走行中の台車を観測できないため、SRBXパックに検証用列車を用意する。
- 最新ログはhold_rail_item後の生成成功2件を確認。roadbed/transition/走行中の台車情報はなく、低速片方向の停止原因は未確定。必要なSRBX行だけ logs/rail-transition-before-debug-vehicle-20261009.logへ抜粋。生ログは未追加。
- ModelTrain_SuperRailBuilderX_TrainDebug.json、小型車体/台車MQOとserver_TrainDebugを追加。単車EC、台車間隔2.5 m、最高速度P1～P5=約1/2/5/10/20 km/h。加速度は標準値0.001736で、標準惰行抵抗0.0002を下回らないよう確認。既存テクスチャを共用。
- KaizPatchX v1.10.3/AE v2.5.3の公式JARでprivate currentRailObj/currentRailMap/split/prevPosIndexを確認。台車取得APIは欠落時生成を伴うため、controller.bogiesも読み取りreflectionで参照し、台車/レールの更新APIを呼ばない。通常RTMでは内部診断を無効化し車体のみ記録。rtm-tsと参照ツールキットは未変更。
- サーバーonUpdateの当tick編成移動前に車体速度/ノッチ/方向/位置と前後台車実追従状態・道床所有先を記録。通常10 tick、停止100 tick、遷移は即時。力行中40 tickの微小移動時に直前20 tickの履歴を一度出力。ログ例外は抑制・復帰でき、クライアントでは実行しない。停止判定はブレーキ緩解待ち等も含む可能性がある。
- 検証済み: pnpm zip（全4target、警告0）、test:train-debug、test:appleextended（11件）、test:kaizpatch、test:input、test:rail-patch、test:runtime-dispatch、対象Prettier/diff check。新規テストは台車生成API未使用、実追従フィールド、ログ頻度・履歴上限、前台車欠落時の後台車番号、クライアント除外、例外抑制/復帰、モデル参照を検証。
- ZIP再梱包は100ファイル。開発者の未追跡gui_base.xcfはソースに保持し、配布用distコピーだけ除外。公開済みRelease/タグは変更しない。
- 未実施: Minecraft実機のモデル表示/設置/運転、KaizPatch/AEで接続部双方向低速走行。docs/train-debug-vehicle.mdの手順でlogs/latest.logを再提出する。
- 同期: 実装コミット `652be14` をorigin/mainへpush済み。コミット記録を引継ぎ帳へ反映して文書同期する。

## 2026-10-10 ローカルCodex: デバッグ車両モデル構築クラッシュ

- logs/latest.logのModelConstructingException: SuperRailBuilderX_TrainDebugを調査。原因はModelObject.getMaterials:284 → ModelPackManager.getResource:306のnull参照。例外と関連スタックだけlogs/train-debug-model-materials-crash-20261010.logへ抜粋し、ローカルパスを除去。
- 公式AE JARの行番号/bytecodeからgetMaterials:284が材質一覧空のdefault参照であることを確認。PolygonModelのコンストラクタからinitが呼ばれ、MqoModel.currentType=-1代入はsuperから戻った後。Sceneの無い今回MQOでは初期mode=0のままMaterialブロックが無視され、材質空/default未設定でNPEになっていた。KaizPatchXも同じ初期化順。
- train_debug.mqo/train_debug_bogie.mqoへSceneブロックを追加。AEのtextures第三要素は配列長3未満で空文字列へfallbackするため、省略は原因ではない。不透明モデルのJSONは維持。rtm-ts/参照ツールキット/車両走行処理は未変更。
- test:train-debugに外部ネイティブ初期解析状態に基づくMQO材質抽出・JSONとの解決/ファイル確認、Scene除去時の失敗再現を追加。以前のファイル存在確認だけでは材質欠落を検出できなかったため補完。
- 検証済み: pnpm zip（全4target、警告0）、test:train-debug、対象Prettier、diff check、配布ZIP再梱包100ファイル。開発者のgui_base.xcfはソースに保持し、distコピーのみ配布から除外。実機モデルローダーでの再起動/表示/設置/走行は未実施。docs/train-debug-vehicle.mdの手順で再確認しlogs/latest.logを共有する。
- 同期: 修正コミット `b822958` をorigin/mainへpush済み。SHA/同期結果を引継ぎ帳へ記録。

## 2026-10-10 ローカルCodex: AE方向別走行遷移の責任切り分け

- 依頼: logs/latest.logを受領。A方向で低速停止、逆方向Bで台車切替時に微小加速/瞬間移動。追加指示はSRBX側なら修正、AE側なら制作者へ対応依頼を検討すること。
- AE id=123はtick506～538でP2/約2 km/hなのに車体不変、先頭旧map index=0。速度0.201352 m/tickで次コアへ移行。id=151はtick390→391の速度0.028520一定で車体約0.21960 m変位（通常移動より約0.19108 m超過）。後台車もtick474でbufが精密端点へ約0.08744 m投影されている。関連train-debug/nearbyだけlogs/appleextended-directional-transition-20261010.logへ抜粋。
- 接続点(1405.85950,4.06250,-1600.85950)は旧コアのブロック内部。公式AE v2.5.3のEntityBogie.updateBogiePos/resetRailObj/getRail、Base.getRailFromCoordinates、RailMapの最近傍処理を確認。予測点のfloor X/Zにある単一道床の所有コアを先に選び、map端へ投影するため、小移動でセルを出られない方向は端に戻り、逆方向は精密端点より早く切替先の端へ飛ぶ。45度直線のセル境界まで約0.198697 m（約14.31 km/h）という見積もりが通過速度と整合。
- 限定readonlyのnative API評価をselection_auditへ委譲し、同じ責任境界を確認。ブロック内部自由端点を任意精度のまま低速走行可能にするにはAE側の探索対応が必要。setPositionの接続保証範囲は未確定なのでAE契約違反とは断定せず、制約/対応可否相談としてdocs/appleextended-free-endpoint-transition-report.mdを用意。道床所有先を変更するだけでは双方向を保証できない。
- SRBX側回避は接続両側の座標を境界に合わせる/自由端点を制限する仕様変更であり、現時点では特定敷設処理の誤りだけが原因とは確認できない。精密線形・保存ワールドを自動変更しない。Mod/rtm-ts/車両挙動コードも未変更。作者への送信は行わず開発者用相談文を作成。
- 確認済み: ログ抽出・座標/1 tick変位/セル境界距離の計算、公式JAR bytecodeと探索/投影の照合、差分/個人情報除去確認。コード変更なしにつきビルド/既存テスト再実行なし。デバッグ車両のAEモデル読み込みと走行ログ取得は今回の実機ログで確認。未実施: 標準マーカー＋offsetによる同状態再現、境界接続との対照、KaizPatch同条件の実機比較。
- 同期: 調査コミット `c7c62ea` をorigin/mainへpush済み。SHA/同期結果を引継ぎ帳へ記録。

## 2026-10-10 ローカルCodex: KaizPatchX 1.10.4走行遷移の比較調査

- 依頼: logs/fml-client-latest.logを受領し、AEと同原因か、KaizPatch制作者への相談が必要か調査。ログ宣言と実使用JARから実行版1.10.4を確認。型生成/過去の道床規則調査のv1.10.3とは区別した。
- 接続点(-709.8595,4.0625,31.8595)、旧所有床(-710,4,31)、新短区間0.19871 m。id410082のtick410～496全87tickで新旧コアが交互に切り替わり、旧コアへ戻るたび旧終端へ投影。tick497で次区間へ抜ける。逆方向id505263のtick347→348は速度減少で車体変位約0.188196 m、501→502は速度一定0.015416 m/tickで約0.106285 m変位。
- 実インストールJARを読取専用で調査キャッシュへコピーし、javapでEntityBogie/RailTransitionResolverを確認。findCrossedConnectedCore→床探索getRailFromCoordinates→keepCurrentSectionCoreの探索順と、別論理グループでは現在コアを保持しないことが往復の説明に整合。resetRailObjのcanConnectとfindConnectedEntryIndex/map投影も照合。これはAEの端点探索なしとは異なる1.10.4の挙動で、Kaiz制作者への対応可否相談資料をdocs/kaizpatch-free-endpoint-transition-report.mdに準備。作者への送信はしていない。
- SRBX自由端点/極短自動分割が再現条件だが、特定敷設ミスとは確認できず、Mod側サポート範囲も未確定。既存精密線形、道床所有先、車両、rtm-ts、Modを自動変更しない。関連ログ54行をlogs/kaizpatch-104-transition-oscillation-20261010.logへ抜粋し、原本を.gitignoreへ追加。ユーザー所有gui_base.xcfは保持・未追加。
- 実施: 全tick/座標/単tick変位計算、生成/床所有ログと実JAR探索順の照合、ログ匿名化/差分確認。提出実機ログによりKaizのモデル読み込みと台車診断取得も確認。未実施: SRBX非経由の同配置対照、境界接続比較、修正版での再走行。ソース変更なしのためビルド/テスト再実行なし。
- 同期: 調査コミット `aec3501` をorigin/mainへpush済み。同期結果を引継ぎ帳へ記録。

## 2026-10-10 ローカルCodex: KaizPatch位置変更後の再検証

- 差替logs/fml-client-latest.logを受領。実行版1.10.4、接続点(-713.8595,4.0625,27.8595)、旧床所有コア(-705,4,18)。接続先区間が0.19871 mから5.85585 mへ変わってもid485199のtick441～531全91tickで先頭の新旧コア往復を確認。極短区間は必要条件ではない。
- tick531は新map36/2108でも旧床所有先、532は同じ新map72/2108で床が新コア(-715,4,28)を指し往復が停止。前回の「短区間を抜ければ通過」は観測ケースに限定し、次区間を越えず床所有先が変わっても通過できることを資料に補足。探索とコア保持の競合という説明は実装/追加ログに整合。
- 逆向きは362→365約0.26667 m/3tick、445→448約0.17918 m/3tick。端への切替は確認できるが途中2tickが未記録なので単tick位置飛び量は断定しない。
- 実施: 189フレームの対象限定解析、91tick連続性/交互切替検証、map長・index・床所有先比較、3tick変位計算、匿名化51行抜粋/差分確認。SRBX非経由の対照、境界接続/通常レール比較は未実施。ソース変更なしにつきビルド/テスト再実行なし。Mod/rtm-ts/車両/ワールドの変更はなし。相談資料とlogs/kaizpatch-long-section-transition-20261010.logを保存し、原本とユーザー所有xcfは追加しない。
- 同期: 追加調査コミット `b866e2c` をorigin/mainへpush済み。同期記録を引継ぎ帳へ反映。

## 2026-10-10 ローカルCodex: Issue #534の責務判断と独自パッチ検討

- 開発者からKaiz制作者の見解とSRBXからのパッチ実現性検討依頼を受領。GitHub公開APIでIssue #534/comment6086321090を確認。制作者はブロック端への曲線端点配置をスクリプト側の責務とし、今回配置は遷移不可が正しいという見解。原因観測は維持し、Kaiz側の修正依頼という結論をSRBXの生成条件対応へ変更。AEへは同見解を適用しない。
- 現行ScriptEngine.evalの描画関数差替え、専用車両onUpdateの読取り範囲、実Kaiz JARのprivate getRail/resetRailObj・final/static resolver・controller/setBogieを確認。既存描画方式ではJava探索を直接差替え不可。パック単独の台車/controller置換は広い車両処理互換性が未成立。探索hook用の別途coremodが有力で、追加JARなしなら標準境界配置による自由端点制限が候補。
- docs/free-endpoint-transition-patch-feasibility.mdに対象別のhook案、候補比較、台車単位のmap保持/実端点越え/残距離/分岐経路の設計条件を記録。床所有先の動的変更や毎tickのフィールド補正は汎用対処に採用しない。配布形態・対象限定方法・仕様判断待ち。
- 実施: Issue本文/制作者コメントの一次情報確認、既存TS/実Java bytecodeの照合、資料/リンク/差分確認。未実施: 実装、クラス変換、台車差替え、全実機パッチ試験。コード/rtm-ts/Mod/ワールドは未変更、資料のみにつきビルド/テスト再実行なし。
- 同期: 実現性調査コミット `fe3218e` をorigin/mainへpush済み。同期結果を引継ぎ帳へ記録。

## 2026-10-10 ローカルCodex: RailPosition自由化の実装経緯/意図

- 依頼: 自由端点で走行接続可能と思っていたため、導入経緯と意図を実装から推定。Kaiz公式履歴でa8664a7（JST 7/18）を確認。continuous sampling/ChunkSectioner/MapSectionとoffset/setPosition/NBTを同時追加。初回Javadocとv1.10.2公開説明の両方に、ブロック端保証は設定側の責務と記載。
- 区間を元曲線へ委譲して勾配/カント/接線を維持し、チャンク境界上の面中央ではない任意座標を表すためのAPIと推定。ブロック座標/所有/同一性が分離されたままで、canConnectの幾何一致だけでは台車探索を保証しない。resolverは7/26追加、8/31内部section往復/境界探索修正という後続履歴を確認。1.10.4新設という解釈はしない。
- AE 74fe2ed（9/8）はRailPositionとRailPartsRendererBaseのみ変更。offset/NBTと描画原点へ対応し、台車探索は同commit未変更。Kaizと同構造だが直接移植や作者の全意図は断定しない。
- docs/rail-position-free-endpoint-intent.mdへ事実/推定/一次リンクを整理。既存自由化文書の「端点一致なら前方探索で対処」という広い解釈を修正。SRBXの自由端点走行を保証する解釈は導入説明より広かったことを明記。
- 実施: 公式commit/release/APIで導入・後続差分、該当ソースとAE実JARの照合、資料/リンク/差分確認。未実施: 作者への追加問い合わせ、新規実機対照。コード変更なしのためビルド/テスト再実行なし。Mod/rtm-ts/既存ワールドを変更せずユーザー所有xcfは未追加。
- 同期: 導入経緯調査コミット `7342ba2` をorigin/mainへpush済み。同期結果を引継ぎ帳へ記録。

## 2026-10-10 ローカルCodex: KaizPatch/AEの境界端点配置

- 依頼: 内側自由端点の遷移問題に対し、ブロック縁上へ配置可能か検討し全生成/整形ツールへ対応。全6ツールと両compatに境界条件を実装。精密anchorYawを保持し、ownerは内向き接線側、native directionは横切る面に合わせる。円弧/分割は元曲線の境界交点、共有移動/縦曲線は同一共有点を使う。縦曲線補正で厳密な半径は変わり得ることを文書化。
- 非境界の既設接続/カント/分割/分岐は破壊前に拒否。移動Undoと内部rollbackは保存座標・方向・ownerを維持。既存ワールド一括変更なし、rtm-ts/共有toolkit変更なし、ユーザーxcfは未追加。
- 実施: 全4ターゲットbuild warning 0、boundary幾何/所有/円弧/縦共有点、AE11本、Kaiz、描画patch/include展開、dispatch、入力、デバッグ車両の回帰検証。target→common helperは@common importとし配布include参照も検証。変更TSの整形確認。全体format:checkは既存未変更ファイルの整形違反が残る。
- 未実施: Minecraftでの両方向低速走行、全ツール操作とUndo実機検証。手順/限界はdocs/rail-boundary-endpoints.md。修正版ZIP artifacts/SuperRailBuilderX-0.2.0.zipを101ファイルで生成し、4ターゲット・helper・include138参照・ユーザーgui_base.xcf除外を確認。SHA256 FEB08D6EA9962FAA49866A147875E2267F3BDD2001FD2C8008A8CB6E2F93831C。同期結果は完了後記録する。

- 最終レビュー: endpoint Undoのサーバー記録へoriginalPointを追加し、変更前owner/directionをKaiz通常/分岐とAEへ渡して復元。AEの公開compat経由で復元flag/snapshotが届く回帰ケースも追加。縦区間長は共有点snap前に保存してアンカー比補正し、短区間のクライアント配列参照を防止。追加修正後もbuild/境界/AE11本/Kaiz/描画/include/入力等が成功。

- 同期: 実装コミット `f8ecee4` をorigin/mainへpush成功。引継ぎ帳は現行状態と実機確認待ちへ更新。

## 2026-10-10 Web側Codex: 完全自由点サーバーModの実験ブランチ

- main `01e5197`から`feature/kaizpatch-free-endpoint-mod`を作成。AEは保留。新repo/fork/Issue/PR/commentを行わないユーザー制約をAGENTS.mdへ追記。
- KaizPatchX 1.10.4のEntityBogie#getRail先頭へ、存続する現在mapの自由端点内側・線形近傍でのみ現在コアを維持するASM hookを実装。端点越え・未対応条件はnativeへ戻す。元呼出し・frameとCrossTieの探索overwrite/チャンクredirectを保持。
- FMLサーバーMod（クライアント任意）、SRBX資産内包JAR、JavaパッチなしのクライアントZIP、固定依存SHA検証・Java8バイトコードの再現可能ビルドを追加。
- KaizPatch compatだけ境界snapを解除。hook能力を確認できない生成・移動・分割・カント・分岐はワールド変更前に拒否。AEは境界制約のまま。
- ローカルでJava単体の行動テスト、合成クラスの-Xverify:all、実KaizPatchX 1.10.4 getRailのASM BasicVerifierとnative呼出し保持検証に成功。Prettier/diff確認済み。ローカルpnpm genはJavaからGradle配布サイトへ到達できず、既存GitHub Actionsで内包ビルドを検証中。
- 実機走行、CrossTie併用、JavaModなしクライアントの接続は未実施。詳細と確認手順は`srbx-free-endpoint-mod.md`。
- 引継ぎ帳の9月完了連絡は9月履歴へ移管し105行へ整理。

## 2026-10-10 Web側Codex: 完全自由点Modのビルド完了

- 実装`c76801f2a69d4c8f762e2b4ac7a890bffb0dc78c`を専用ブランチへ同期済み。Actions #38008868160成功: 全4型生成/build、既存回帰、Javaパッチ行動/ASMテスト、クライアントZIPとSRBX内包JARを生成。
- Java.lang.Objectのscanner宣言に依存した型エラーはClass.forNameで解消。境界端点はnative directionを保持し、内部自由点は接線方向を使用。生成API型のcacheをビルド失敗前に保存し、再生成コストを削減。
- Artifacts #11652378368を取得し、manifest、Java8 major52、依存/テストクラス非同梱、102個の資産とクライアントZIPのバイト一致を検証。JAR SHA256: 941ad37c8d6cfe98d0a038d7120e4e59155604bea144e365423b2740dd9de6dd。
- 実機起動/走行・CrossTie併用・JavaModなしクライアント接続は未実施。確認手順とパッチの限界をsrbx-free-endpoint-mod.mdへ記載し、短期引継ぎ帳を更新。main/AEは変更せず、新repo/fork/Issue/PR/comment/Releaseは作成していない。

## 2026-10-10 Web側Codex: 台車探索方式の比較と軽量化

- 既存hookは遷移先探索ではなく自由点内側の現コア保持と説明。KaizPatch v1.10.4はgetNeighborPosを既に最優先に探索。Directionの背合わせだけでは自由点/旧道床所有/セクション配置から遷移先を一意決定できない。
- 同JVMの旧hookとの模擬比較で内側照合を114サンプル→2へ削減、中央値215.344ms→86.453ms（50,000回×7）。中央部はtile読出し前に除外。投影が外れたmapでは元の全候補照合へ戻す。
- Direction＋精密XYZの反射直接探索はnative通常探索のJava模擬より118.691ms→170.934msと遅く不採用。実MC/Kotlin/CrossTie/チャンクI/Oの速度ではない。試作はbenchmarksのpatchに限定し配布クラスへ入れない。
- mod/benchmark.pyで旧実装と試作を.cacheへ展開して再比較できる。採用コードはnative/CrossTieの隣接セル優先・探索範囲・loadChunk・resetRailObjを維持。
- Java回帰で2サンプル、中央早期除外、非線形mapの全照合fallbackと従来ケースを検証。資料はrail-lookup-performance.md。実機TPS測定は未実施。

- 採用版`3e889f29227d064e1001dfafc3ce57461241f6d3`を専用ブランチへpush済み。Actions #38031947718成功（生成型cache利用、全4build/回帰、Javaテスト、JAR/ZIP生成）。実KaizPatchX v1.10.4のBasicVerifier/native呼出し保持も再確認。Artifacts #11662501365のJava8/依存・テスト・試作非同梱/資産一致を検証。新JAR SHA256: 2db3255f39d7d51c551729993f43422ebf4273476a9e8253e6621939287df423。実機の走行/TPS/CrossTie併用は未検証。

## 2026-10-10 ローカルCodex: 自由点へ統一、SRBXPatchを分離して両版生成

- Web側feature/kaizpatch-free-endpoint-modの最新462fdb1までを確認し、mainへfast-forward統合。開発者の新方針に従い、Kaiz/AE全6ツールから境界スナップ制約を外した。共有自由点ポリシーは精密座標と分割比率を維持し、実際の境界上ではnative direction/ownerを維持する。接続移動/Undoの所有座標復元も保持。
- SRBXModをjp.hi03.srbxpatch/SRBXPatch（Mod版1.0）へ改名し、Javaパッチとモデルパックを分離。rtmxのパック名は通常名SuperRailBuilderX-0.2.0へ戻した。両版ともサーバー限定・独自通信なし・クライアントJAR必須にしない設計。パッチ有効化を確認できないサーバーのツール書き込みはsrbxpatch_requiredで拒否。
- KaizはWeb側の現map保持/軽量化とnative接続探索を維持。AEは現map保持、端点越え後のロード済み周辺道床探索を追加。精密端点、高さ、進行方向、現在位置/前回sample、分岐active経路、生存状態を検証し、候補競合や非対応条件はnativeへ戻す。変換は既存命令/frames/callsiteを保持。クラス単位の反射キャッシュだけを使用。
- デバッグ車両の登録JSONのみ除去。MQO/テクスチャ/診断スクリプトは保存。ユーザーの未追跡gui_base.xcfはソースから削除せず、今回の配布ZIPへ混入させないため生成コピーだけ除外。
- 検証済み: pnpm build全4ターゲット（warningなし）、rail-patch/runtime-dispatch/appleextended/input/kaizpatch/rail-boundary/free-endpoint/train-debug回帰全成功。変更TS/CJSのPrettier確認成功。workflow YAMLを構文解析し、diff --check成功。全体format:checkは既知の未変更ファイルの違反があるため完了扱いにしない。
- Java: 両版の挙動テスト、実KaizPatchX 1.10.4/AE 2.5.3へのASM BasicVerifier/native call保持検証に成功。異常bytecode無効化・冪等変換・client除外・切断/高低差/再生成map・AE逆方向/active分岐/競合/stale位置を確認。Java8 major52、資産/依存/テスト非同梱、テストあり/なし出力一致を検証。
- 成果物: SRBXPatch-v1.0-1.7.10.jar SHA256 f6490d1acad0b948b96bd4e20d2ac86e4ba05bf6e12cd1886338f4a67099a886、SRBXPatch-v1.0-1.12.2.jar SHA256 1e523739f9eba6c776512de7f2c43344c256331cd142c4c7d6d782ec2bc51f55。SuperRailBuilderX-0.2.0.zipは101ファイル、include参照欠落なし、JSON除去/再利用資産保持を確認。ZIP SHA256 438859bacd644cd7cf5aa236a2b1f666cddd263972d11039679434ee203dacb1。
- CIはmain/専用ブランチで独立ZIP＋2 JARを生成。タグworkflowも3配布物をDraftへ添付し、既存公開Release変更拒否と手動Publishを維持。今回はタグ/Release/Publishを実行しない。rtm-ts/共有ツールキットは変更しない。
- 未実施: Minecraft起動/両方向低速走行、CrossTie併用、JARなしクライアント接続、実機全ツール/Undo。通常車両での確認手順とログ提出先をdocs/srbx-free-endpoint-mod.mdへ記載。同セルコア競合、複数極短区間の1 Tick通過、Kaiz nativeが見つけられない配置、AE周辺探索範囲外の候補は保証外。
- 同期: 実装c04e530をorigin/mainへpush成功（01e5197→c04e530）。引継ぎ同期記録を追記後、既存feature/kaizpatch-free-endpoint-modもmainへfast-forwardして両ブランチを同期する。

## 2026-10-10 ローカルCodex: AE起動停止のMod依存ID修正

- 開発者よりKaizPatchのCrossTieあり/なしでの動作確認を受領。全個別操作/サーバーのみJAR構成の検証完了とは推定しない。
- AE latest.logのFML依存宣言解析エラーとMissingModsExceptionを確認。SRBXPatchがrequired-after:RTMと宣言し、Forge 1.12.2が小文字modid必須として起動停止していた。実AE 2.5.3のRTMCoreのMod注釈はrtm。AEだけrequired-after:rtmへ修正し、Kaiz側は変更しない。
- Javaテストへ成果物のMod注釈、lowercase依存ID、実AE modidとの一致、クライアント任意導入設定の検証を追加。対象1.12.2ビルド、挙動/実AE ASM検証成功。SRBXPatch-v1.0-1.12.2.jarを再生成、SHA256 eb148069ec39843c3b81a1dc3e96a37e5731f1648f941aed21905964bb7f48ec。
- パック/TypeScript/Kaiz JARは変更なしのため再ビルド不要。rawログはGitへ入れず、必要診断のみlogs/srbxpatch-ae-dependency-startup-failure-20261010.logへ抜粋し個人パス/無関係Modログを除外。AE本体のmulti-release module-info読込警告等もあるが、今回の直接停止原因はSRBXPatch依存宣言。第三者Modは変更しない。
- 未実施: 修正版AEのMinecraft起動/自由点両方向微速走行。旧JAR置換とhook installed確認、問題時logs/latest.log提出を依頼する。
- 同期: 修正e240d3aをorigin/mainへpush成功。同期記録を含め既存自由点ブランチもfast-forwardで更新する。

## 2026-10-10 ローカルCodex: 終了ブランチ整理、CrossTie分割診断、GUI最新化

- mainに全コミットが含まれることを確認し、feature/appleextended-compat（77139ef）、feature/kaizpatch-free-endpoint-mod（2defa0c）、fix/rail-render-offset-compat-patch（08756a7）をremote/localで削除。GUIブランチは未統合コミットがあるので保持。
- 保存済みfml-server-latest - コピー.logをcp932で解析。CrossTie Alpha14のNBT未読込警告26件、分割6回はいずれもresult=ok。公開Alpha14タグcf3ce92の診断とSRBX生成/同期コードを照合し、新規setter初期化TEのreadFromNBT未通過による誤検出と判断。SRBX変更不要。詳細docs/crosstie-split-diagnostic.mdと個人情報除去済み抜粋へ保存。生サーバーログはignoreへ追加。
- 本番サーバーへ接続/変更/再起動/テストは一切行わない。必要な再読込/走行試験は本番以外のバックアップワールドで行う手順を残す。
- CI対象の削除済み自由点ブランチをGUIブランチへ置換し、GUIでも最新mainの回帰と配布物ビルドを行う。
- main検証/同期: pnpm test:kaizpatch、diff --check成功。調査45a941fをorigin/mainへpush済み。GUIのビルド結果/同期は同ブランチの続きに記録する。
- GUI: feature/builder1-guiのGUIコミットを保持してmain a1afeabをmerge。競合はdocs/CODEX_HANDOFF.mdだけで、最新main状態にGUI仕様/検証項目を足して解消。render_builder1.tsは自動統合され、最新入力/自由点/描画compatを保持。
- GUI検証: pnpm build全4ターゲット（warningなし）、rail-patch/runtime-dispatch/appleextended/input/kaizpatch/rail-boundary/free-endpoint/train-debug全成功、render_builder1.tsのPrettier確認成功。GUIテクスチャとrenderToolGuiが入ったZIP102ファイル、include欠落なし、不要JSON/gui_base.xcfなし。既存main ZIPを保持し、GUI成果物はSuperRailBuilderX-0.2.0-builder1-gui.zipへ別名保存。
- 未実施: GUIの画面/スケール/色/透過/3D表示の実機再確認、本番での実行。既存mainの両ModはJava変更なしで再利用する。ユーザーの未追跡gui_base.xcfは保持しGitへ追加しない。
- GUI同期: merge df0d3d8をorigin/feature/builder1-guiへpush成功（963f30e→df0d3d8）。整形後に全4build/ZIPを再生成し、最終GUI ZIP SHA256 9e75847362539aa34b77035aa43b68261357a0be595bd04a3661e341daf5b84d。現在のチェックアウトはGUIブランチ。本番未操作。

## 2026-10-10 ローカルCodex: builder1 GUIの空色描画とワールド霧の分離

- references/picの2026-10-10_22.37.02.png/22.37.07.pngを視認。上端/右端/枠の形で空色が表示され、昼と夕方の背景色に追従。GUI色だけ失われ深度形状が残る症状を確認。
- renderToolGuiは視点z=-1001の2D投影で描画し、GL_FOGを継承したままだった。ワールド霧によるRGBの空色置換を有力原因と判断し、GUI描画中だけGL_FOGを無効化。既存GL_ENABLE_BITとfinallyのglPopAttribで元の霧状態を復元。ワールド深度や既存の透明破棄/最前面深度仕様は変更しない。
- 初回のみ[SuperRailBuilderX GUI] fog isolatedにworldFog/guiFog/サイズを出力。実機でworldFog=true/guiFog=falseを確認でき、再発時の調査材料にする。診断はクライアント描画スクリプト内。サーバー/Javaパッチ/共有ツールキットは変更なし。
- 検証済み: pnpm build全4ターゲット（warningなし）、rail-patch/runtime-dispatch回帰、対象TSのPrettier/diff --check。生成JSのrenderToolGuiをローカル模擬GL状態で実行し、初期霧ON/OFF各ケースと描画例外時も色描画中の霧OFF・終了時の元霧/texture unit/属性/行列復元を確認。これは実GPUの画像検証ではない。
- 更新SuperRailBuilderX-0.2.0-builder1-gui.zipは102ファイル、霧無効化/診断ログを確認。不要debug JSON/ユーザーgui_base.xcfは非同梱。main ZIPと両SRBXPatch JARは維持。ユーザーの画像/xcfは未追跡のまま保持し、Gitへ追加しない。
- 未実施: 修正後Minecraft実機の昼/夕方GUI色・文字・透明部分、ツール終了後のワールド描画。更新ZIPへ置換し確認、再発時は画像とlogs/latest.log（fog isolatedを含む）を提出する手順をdocs/builder1.mdへ追記。
- 同期: 修正1cdd292をorigin/feature/builder1-guiへpush成功。更新GUI ZIP SHA256 791d5792a383d22fa6bf971402f85d13817acbcb29eb7d7a5511d038a568ea81。

## 2026-10-10 ローカルCodex: builder1 GUI状態アイコン/数値

- 開発者より霧修正後のGUI描画成功を受領。ユーザー更新gui_base.pngを確認し、状態OFF(3,0)/ON(3,1)/情報背景(3,2)とグリッド(4,0)/カーブ(4,1)/レール長(4,2)を使用。
- 右端16 px列に大アイコン枠直下y=32/48/64で背景→アイコンを重ねる。白文字をアイコン左4 pxへ右寄せ。スナップON時だけ角度、半径固定ON時だけ固定半径（MAX設定は既存仕様の∞）、選択1点以上で長さ小数2桁mを表示する。
- renderBezierSegmentが実際に描画した3D折線長を返し、縦曲線の複数区間をrenderBezierで合計する。追加のRailMap構築や重い再サンプルを行わず、1点＋hover/2点の既存プレビュー長を再利用。概算長であり、線形候補なしは0.00 m。既存ワールド書込やサーバー/Javaパッチは変更しない。
- 検証済み: 全4ターゲットpnpm build（warningなし）、対象TS Prettier、runtime-dispatch、diff --check。生成JSを模擬GUI/GLで実行し、3行の背景/アイコンUV・座標、ON/OFF条件、0/1/2点の文字条件、小数2桁、白色/右寄せを確認。更新PNGのZIP内内容一致、102ファイル、xcf非同梱を確認。
- 未実施: 状態表示の実GPU/実機切替とカーソル追従、曲線/勾配長の表示確認。更新SuperRailBuilderX-0.2.0-builder1-gui.zipで確認する。ユーザーPNG更新をコミットに含め、未追跡xcf/参照画像は保持し追加しない。main ZIP/両Modは維持。
- 同期: 状態表示8eb593dをorigin/feature/builder1-guiへpush成功。更新GUI ZIP SHA256 ee59308b8f27f24fa561cf4423a3224924097a59c0eb152598271d3cc33a9fdb。

## 2026-10-10 ローカルCodex: GUI GLスタック破損対策

- 開発者からPost renderのGL 1284 Stack underflow大量発生とレール描画異常の報告。保存済みlatest.logは以前のAE起動ログで、今回のエラーはユーザー提示文を根拠に調査。生ログは追加しない。
- GUIがRTM描画の内側で投影/テクスチャ行列をPushしていた。容量の小さいスタックが満杯の場合、Push失敗後のPopがホスト側の行列を取り除き、後続描画のunderflow/異常につながる可能性がある。実機スタック深度は未取得なので、報告されたエラーの原因確定とは区別する。
- GUIの全行列Push/Popを再利用FloatBufferへの保存/glLoadMatrix復元へ置換。文字描画用texture0行列を単位行列とし、最後に元の行列/モード/active textureを戻す。現在色も属性退避へ追加し、属性スタックに2段の空きがない場合はGUIを描かない。共有ツールキット/rtm-ts/サーバー/Javaパッチは変更なし。
- 検証済み: 全4ターゲットpnpm build、対象TS/テストのPrettier、diff --check、rail-patch/runtime-dispatch。pnpm test:guiを追加し、ホスト行列スタックが満杯の条件、通常描画、タイル/文字描画例外、属性容量不足での見送り、元行列/モード/texture unit/霧復元、白い右寄せ数値を確認。CI回帰へ追加。実GLドライバーを実行するテストではない。
- 更新GUI ZIPは102ファイル、ユーザーgui_base.xcf非同梱。main ZIP/両SRBXPatch JARは保持。GUI ZIP SHA256 6660e237771c414396087bfeffb4a210810babe9bfb54eec9cd45abd32d715aa。
- 未実施: Minecraft実機でのGLエラー解消とレール描画。更新ZIPを導入し、GUI状態表示/レールプレビュー/ツール切替・終了を確認。再発時は操作手順とlogs/latest.log（fog isolatedを含む）を共有する。
- 同期: 修正ef1f3ccをorigin/feature/builder1-guiへpush成功。

## 2026-10-10 ローカルCodex: GUI GL 1284再発の段階別診断

- 開発者よりGUI表示中だけGL 1284が継続するとの報告。latest.logの23:49:22でfog isolated直後からPost renderの1284が連続することを確認。前回の行列Push/Pop撤去だけでは解消せず、実機の破損箇所は未確定。
- 必要なGUI初回ログと最初のGLエラー2回のみlogs/builder1-gui-stack-underflow-20261010.logへ抜粋。生ログ、PC情報、ユーザー名、ローカルパス、無関係なMod出力は追加しない。
- OpenGLの属性スタックは全テクスチャユニット共通なので、texture0/lightmapの2段退避を1段へ整理。これは不要な複雑さの除去であり、2段使用が実機エラー原因だったとは断定しない。
- build=gui-gl-state-v2を追加。GUI入場前、属性退避、行列設定、属性設定、背景/状態アイコン、ツールアイコン、タイトル、各状態文字、行列復元、属性復元でglGetErrorを確認。検出段階/コード/各行列・属性スタック深度/active textureを出力し、状態復元後にGUIだけを停止する。初回にはGUI入口/出口のGL状態も記録する。入場前エラーはGUI以前の描画として区別。
- GLエラーを記録して消費するため、Post renderが止まるだけでは解消と扱わない。GUI表示継続かつdisabled診断なしが再検証条件。停止後はパック再読込/ゲーム再起動が必要。共有ツールキット/rtm-ts/サーバー/Javaパッチは変更なし。
- 検証済み: 全4ターゲットbuild、GUI回帰（入場/タイル/文字/復元のGL 1284注入、段階識別、GUI停止、再描画抑止、行列/モード/霧/active texture/両ユニットの有効状態復元）、runtime-dispatch/rail-patch、対象TS/テストPrettier、diff --check。
- 未実施: 実GPU上の原因特定とエラー解消。更新GUI ZIPでゲームを再起動し、build=gui-gl-state-v2が出ることを確認してレール生成Aを使用。GUIが消える場合も操作手順とlogs/latest.logを共有してもらう。前回版のfogログと新しい診断を区別できる。
- 配布物: 更新GUI ZIP102ファイル、gui_base.xcf非同梱、段階別診断/属性1段退避をZIP内でも確認。SHA256 c3b281c7b125e3fd909b901a9051889396fb02824145ae3867d15a3da082cc93。main ZIP/両SRBXPatch JARは保持。
- 同期: 診断/停止処理076cd30をorigin/feature/builder1-guiへpush成功。

## 2026-10-11 ローカルCodex: GUI属性スタックを撤去

- v2でGUIが消えた実機ログを受領。00:05:55に初回入口/出口の行列・属性深度は一致した後、restore-attributesで1284が3件、属性深度0を確認。アイコン/文字/行列復元のエラーは記録されていないため、glPopAttribを含む属性復元段階へ原因を絞った。復元が追加実行される実行環境側の経緯までは未確定。
- 関連GUI診断5行だけをlogs/builder1-gui-attribute-restore-underflow-20261011.logへ保存。生ログ、ユーザー/PC情報、無関係な出力は追加しない。
- GUIのglPushAttrib/glPopAttribを完全撤去。行列と同様に有効状態・アルファ/深度条件・RGB/alpha別ブレンド係数・色/書込マスク・両テクスチャユニットの有効状態/バインド/環境/座標を個別保存/復元する。複数回復元してもホストのスタックを消費しない。GLエラー診断/GUI停止は保持し、識別子をgui-gl-state-v3へ変更。
- SRBXApiCompat.syncGuiGLStateと型宣言を追加。Kaiz/通常1.7.10はキャッシュ同期不要、AE/通常1.12.2はGlStateManagerの有効状態/条件/色/テクスチャキャッシュを元状態へ同期し、後続レール描画が古いキャッシュに基づいて状態変更を省略しないようにする。バージョン固有APIはcompat内に限定。共有ツールキット/rtm-ts/サーバーワールド/Java Modは変更なし。
- 検証済み: 全4ターゲットbuild（最終版warningなし）、test:gui（GUIにネイティブスタック操作がないこと、全変更属性の復元、スタック満杯でも表示、複数回復元、描画例外、GLエラー注入と停止、1.12.2両ターゲットのSRG名/キャッシュ復元）、runtime-dispatch/rail-patch/kaizpatch/appleextended、変更TS/テストPrettier、diff --check。
- 更新GUI ZIP102ファイルでv3/スタック操作不在/gui_base.xcf非同梱を確認。SHA256 d21cb0fe103aa2e0ccfd2a96cebd6074d9ad209ba27be14fd603536c7d113ee9。main ZIP/両SRBXPatch JARは保持。
- 未実施: 修正後の実GPU上のGUI継続とGLエラー/レール異常の解消。ZIPを置換してゲームを再起動し、v3診断と状態表示、レールプレビュー、ツール切替/終了を確認する。GUI消失/描画異常が再発した場合は操作手順とlogs/latest.logを共有する。
- 同期: 修正e7bb487をorigin/feature/builder1-guiへpush成功。

## 2026-10-11 ローカルCodex: グリッドOFF数値/プレビュー半径/影文字

- 開発者よりv3のGLエラー解消を受領。最新ログで入口/出口一致とGL ERROR/1284/disabled不在を確認。関連GUI2行をlogs/builder1-gui-stack-free-success-20261011.logへ抜粋し、生ログは追加しない。
- グリッドOFFで角度の空行をcontinueすると数値が見えなくなる件を調査。ゲーム同梱Java 8u51のjjsで、try/finally内ループのcontinueが途中でもfinallyを実行することを再現（通常は終了時1回だが、空行1件で途中/終了の2回復元）。以前の複数glPopAttribによる1284とも整合する。数値ループをcontinueなしの条件ブロックへ変更し、後続数値の描画前にGUI投影が戻る問題を回避。
- 半径固定OFFで1点＋hover/2点選択の線形がある場合、既存プレビューのstart.curveRadiusを再利用して半径の絶対値を整数m表示、直線は∞。選択なし/線形なしは非固定半径を隠し、固定ONの設定半径表示は維持。新たなRailMap生成やワールド書込なし。
- ツール名/状態数値をMinecraft標準の影付き文字へ変更。1.7.10と1.12.2でshadowメソッドのSRG名が異なるためSRBXApiCompat.drawGuiTextWithShadowを全ターゲットへ追加し、対象バージョンのAPIを呼ぶ。
- 検証済み: 全4ターゲットbuild（warningなし）、test:gui（OFF非固定半径/長さと状態復元、全4のshadow SRG名、既存GLガード）、runtime-dispatch/rail-patch、変更ファイル整形/diff --check。ゲーム実Java 8u51で生成GUIを実行するbuilder1_gui_nashorn.test.jsを追加し、OFF固定/非固定・1/2点・直線∞・ON未選択・影文字とGUI投影維持/終了時復元を確認。GL呼出は模擬、実GPU画像の検証ではない。旧jjsのためこのJSだけPrettier --trailing-comma noneを使用する。
- 更新GUI ZIP102ファイル、影/プレビュー半径/空行回避とgui_base.xcf非同梱を確認。SHA256 b60502f2e60bfd1229c1a60c12a05410eef7294600668127aa2e5a849bdd0a2b。main ZIP/両SRBXPatch JAR、ユーザー参照画像/xcfは保持。
- 未実施: 更新後実機でのOFF数値、選択途中/2点の非固定半径、直線∞、文字影の見え方。ZIPを置換してゲームを再起動し、状態切替/カーソル追従を確認する。再発時は操作手順とlogs/latest.logを共有する。
- 同期: 修正ce7099cをorigin/feature/builder1-guiへpush成功。

## 2026-10-11 ローカルCodex: GUIのmain統合・距離/ブロックスナップ

- 開発者よりAEでのGUI確認完了を受領。タイトルを影付き白文字へ変更した4c29b21を含むGUIブランチを791d2a5でmainへ統合してpushし、feature/builder1-guiをローカル/リモートとも削除。CIのpush対象から終了ブランチを除去。
- mainでPの切替をOFF→距離→ブロック→OFFへ変更。距離は従来のON（自由始点の0.5 m格子、自由終点の角度/3D距離スナップ）を維持。ブロックは視線座標をワールド基準の0.5 mへ丸め、角度/距離/既設端部勾配によるカーソル補正をしない。Yは高さオフセット込み支持面を丸めて通常レール高1/16 mを加える。選択済み既設端部は移動しない。半径固定/縦曲線整形は従来どおり別途適用。
- GUIでブロックモードは「ブロック」、固定/非固定の無限大半径は「直線」と表示。状態文字のcontinue回避とスタック非使用の復元は維持。
- 検証済み: 全4ターゲットbuild（warningなし）、全package回帰スクリプト、ゲーム同梱Java 8u51の生成GUIテスト。新しい座標テストで負座標/始点非依存/角度非依存/既設勾配非依存/高さオフセット/従来距離・OFFとP循環/選択解除/リセット・Undo維持を確認。Node/旧NashornのGUI検証で「ブロック」「直線」と投影復元を確認。GL呼出は模擬。
- 変更TS/テストのPrettierとdiff --check成功。全体format:checkは未変更46ファイルの既存整形警告で失敗し、無関係な整形は実施しない。
- main ZIPを更新（102ファイル、gui_base.xcf非同梱、生成スクリプトの新モード/表記を確認）。SHA256 9e5bb2ad913b9be9d5a2d65dc969d8075b577b5c2b72b914250f41d3c34e40e9。旧GUI ZIPは過去の検証用であり、今回はartifacts/SuperRailBuilderX-0.2.0.zipを使用する。
- 未実施: 新規モード/白文字/直線表示の実GPU・実ワールド検証。main ZIPを置換してゲームを再起動し、Pで3種類切替、自由点同士/既設端接続、Ctrl+P非依存、影と状態表示を確認する。異常時は操作手順とlogs/latest.logを共有する。
- 同期: 実装1def6f8をorigin/mainへpush成功。main統合とGUIブランチ削除もリモートへ反映済み。

## 2026-10-11 ローカルCodex: 全ツールの状態GUI

- レール生成Aの実機確認済みGUIをSRBXToolGuiへ移設し、全6ツールで共用する。霧隔離、行列/属性の個別復元、AE/1.12.2のキャッシュ同期、GLエラー停止、旧Nashornのcontinue回避を維持。診断へtool名を追加。ツール固有の設定文字/アイコン/ON・OFFを行配列で渡す。
- 線路分割は右端にレールアイコン2行を追加。候補カーソルが表示されるホバー中/選択後に論理RailMap長×分割比率で両区間長を小数2桁m表示し、無効候補/対象なしは空欄。線路移動は0.1 mスナップのグリッドON/OFFのみ。
- 複線コピーは現在の間隔を小数1桁でGUI表示し、間隔変更/リセットのチャットを廃止。カント整形は速度アイコン(5,0)に設計速度、レールアイコンに種類（在来線/新幹線の区別込み）を表示し、種類変更チャットは維持。開発者更新済みgui_base.pngを使用し、編集用xcf/参照画像は追加しない。
- 分岐生成はレール生成Aと同様に固定ONなら設定半径、OFFでプレビューがあれば近似半径を表示し、無限大は「直線」。起点選択中の新線長を描画済み48分割の3D折線から集計する。終点候補なしは0.00 m、起点未選択は空欄。元レール側の残存区間は含めない。GUIによるRailMap新規作成/ワールド書込なし。
- 検証済み: 全4ターゲットbuild（warningなし）、全package回帰スクリプト、変更TS/テスト整形、diff --check。test:guiは共通描画の全GL状態復元/エラー停止/アイコン座標/白文字、各ツールの表示値、実renderでの分割ホバー/選択/無効候補/描画pass・Minecraft画面条件、分岐の実プレビュー3D長を検証。実Java 8u51で全6ツールの生成アダプターと共通GUIの文字/空行/投影維持を実行し成功（GLは模擬）。
- main ZIPを更新し、共通GUIと全6ツールの呼出、gui_base.xcf非同梱を確認（103ファイル）。SHA256 d584a613d1d2385d3991fc30dc9caddb6cf343bd22c418ef7ac1aef6ef9cf678。
- 未実施: KaizPatch/AEでの実GPU・実ワールド表示確認。更新ZIPへ置換して再起動し、全ツールの設定変更/選択/解除、別画面開閉、ツール切替/終了、GLエラーとレール描画の正常性を確認する。異常時はツール名、操作、logs/latest.logを共有。[共通GUI仕様/手順](../tool-gui.md)。
- 同期: 実装9a1f77aをorigin/mainへpush成功。完了項目を引継ぎ帳の作業中から除去。

## 2026-10-11 ローカルCodex: カントのレール単位選択と操作・ヘルプ改善

- 線路移動はCTRL中に未選択レールのホバーと端点候補を隠す。選択済みレールの強調は維持する。
- カント整形は理論レール単位で選択し、両端を整形する。任意点分割を廃止し、接続する未選択の影響対象を黄緑、ホバーを黄色優先で描画する。カーソル先の速度数字を廃止し、GUIだけに速度を表示。最低0 km/hで水平化、Ctrl+↑↓で±50 km/h、通常↑↓は±1 km/h。速度0を経由してもカント方向を保持する。
- サーバーは選択レールごとの両端の組を検証し、旧分割・中央・片端だけのリクエストを拒否する。適用前の座標/対象検証と接続先への伝播は既存compatを継続使用。Undo失敗時は履歴を保持して再試行できる。
- 分岐生成にレール生成Aと同じOFF→距離→ブロックのスナップを追加。距離は角度1/5/15度と3D距離0.5 m、ブロックはワールド座標0.5 m格子に通常レール高1/16 mを加える。GUIをグリッド/半径/長さの3行へ統一する。
- 全6ツールのHヘルプを1行1キー/機能へ整理し、末尾へチャットを開いてスクロールする案内を追加。今後のコミットを日本語とする指示をAGENTS.mdへ反映。
- 検証済み: 全4ターゲットbuild（warningなし）、全package回帰スクリプト、新規rail_tool_controlsテスト（論理選択/両端/速度0と±50/影響色/サーバー拒否とUndo再試行/分岐座標/CTRLホバー/全ヘルプ）、GUI行テスト、ゲーム同梱Java 8u51の全ツール生成GUI（GL模擬）、変更ソースのPrettier、diff --check。
- ZIPを更新し103ファイル、共通GUI/新しい生成スクリプト、gui_base.xcf非同梱を確認。SHA256 241cb65d7ffd1ae3f6221c437500104cbcdf9cfba9d09528e480657952256479。編集用xcfと参照画像、生ログは追加しない。
- 未実施: KaizPatch/AEの実GPU・実ワールド。更新ZIPへ置換して再起動し、レール選択/解除、両端と接続先のカント/水平化/Undo、移動CTRL、分岐スナップとGUI、Hヘルプを確認する。異常時はツール名、操作順、logs/latest.logを共有する。本番サーバーは操作していない。
- 同期: 実装25ad162をorigin/mainへpush成功。完了した作業中項目を削除し、実機確認を優先確認事項へ残した。

## 2026-10-11 ローカルCodex: カント解除表示とTABツールホイール

- カント整形で選択済みレールをホバーすると線路移動と同じ暗い水色009999で解除を示す。未選択は黄色優先、接続影響対象は黄緑を継続。選択カーソルの部品登録/描画を除去し、両端カントmmパネルは維持する。
- 全6ツールにTAB長押しホイールを追加。真上から時計回りに生成A/分割/移動/複線/カント/分岐。専用GuiScreenの上に暗い背景、アイコン/名前を表示し、マウス方向と←→で選択、TAB解除で確定、ESCで取消。ゲームは一時停止しない。中心付近/静止マウスではキー選択を維持する。通常ツール入力とプレビューを停止し、ボタン/矢印を離すまでの抑止をDataMap経由で新モデルにも引き継ぐ。
- モデル切り替えは全サーバースクリプトから共通処理へ渡し、6モデルの許可リスト、所有プレイヤーと騎乗関係、モデル存在、生成/移動/Undo要求との競合を検証する。Kaiz/1.7はsetModelNameとモデル更新、AE/1.12はResourceState.setResourceNameと同期をcompatに分離。エンティティを保持するためレールへの書き込みはない。
- 標準画面を開く際のキー解除でプレイヤーリスト入力を抑える構成で、表示が残っても画面はHUDより上に描画する。実マルチプレイでの非表示は未確認。キー設定やrtm-ts/共有ツールキットは変更しない。
- 共通GUIのスタックを使わない状態保存/復元を利用する。矩形はGlStateManagerのキャッシュとアイコン色/Blendを乱さないよう、GUI内で直接描画して白色/テクスチャを復元。GUI/ホイール失敗時は閉じて診断を出す。新しいヘルプ案内とdocs/tool-wheel.mdを追加。
- 検証済み: 全4build（warningなし）、全package回帰、マウス/キー/解除/ESC/処理中/所有者/モデル不足/例外/新モデルの押しっぱなし/6ツールへの組込テスト、カント解除色/カーソル除去、ホイール6アイコン/名前/GL全状態復元、変更TS/テスト整形、diff --check。ゲーム同梱Java 8u51で全ツール/ホイールのGUI（GL模擬）と、検証用Javaクラスに対する実Java.extendのSRGコールバック/非停止/矢印/解除を確認。実Minecraft画面の試験とは区別する。
- 更新ZIP106ファイル、ホイール/サーバー処理/ツール定義の同梱とxcf非同梱を確認。SHA256 3e27e070cebe6195535594993d4d6693afa4384f99f659347153234013c1e65e。ユーザーの編集用xcf/参照画像、生ログは追加しない。
- 未実施: KaizPatch/AEの実GPU/実画面/マルチプレイ。更新ZIPへ置換して再起動し、カント解除色/カーソル非表示、各ツールでTABを開き配置/暗い背景/マウス/←→/解除/ESC/クリック抑止/生成・適用・Undo、リスト表示を確認。異常時は操作順とlogs/latest.logを共有する。本番サーバーは操作していない。
- 同期: 実装d2d8237をorigin/mainへpush成功。完了した作業中項目を削除し、実機・マルチプレイ確認を引継ぎへ残した。

## 2026-10-11 ローカルCodex: ホイールの左クリック決定と中央取消リング

- 四角形背景を6区画のリングへ変更し、内外円と放射状の仕切り、各ツールのアイコン/名前を描画。中央はリング背景を描かず「変更なし」と表示する。
- 描画とマウス判定は同じ内径を使用する。中央へカーソルを戻すと使用中のツールへ戻る。左クリックは最新のクリック座標で決定し、中央なら変更せず閉じる。右クリックは決定しない。
- TAB解除での決定、ESC取消、矢印操作を維持。左クリック後の重複決定、TAB押下継続中の再表示、切り替え直後の誤クリックを抑止する。
- 検証済み: pnpm build（全4ターゲット）、pnpm test:input、pnpm test:gui。Java 8u51でGUIのGL模擬復元と実際のJava.extend/SRGクリックコールバック・座標フィールドを検証。リング頂点の内外径と画面サイズ別の中央判定も確認。
- 実GPU、実Minecraft画面、KaizPatch/AE実機、マルチプレイのリスト非表示は未検証。更新ZIPでリング・左クリック・中央取消・押しっぱなし動作を確認し、不具合時は操作手順とlogs/latest.logを共有する（docs/tool-wheel.md）。
- ZIP更新: artifacts/SuperRailBuilderX-0.2.0.zip（106ファイル）、SHA256: 9732C8C5D7DAAAE2AD6536D09DEEEE9AFD3E9F44465B0356A84A717C22116B1A。ユーザーのgui_base.xcfは変更せず、生成先コピーのみZIPから除外。従来のbutton_template.xcfは維持。
- 同期: d51c996（ホイールを中央取消付きリングへ変更し左クリック決定を追加）をorigin/mainへpush完了。

## 2026-10-11 ローカルCodex: ホイールアイコンへの文字色残留を修正

- 実機報告: 選択中ツールの次のアイコンが黄色に変色する。選択名を黄色で描くFontRendererがGL色を残し、その直後のアイコンに乗算されることが原因。
- 共通のdrawToolGuiIconで各アイコン描画前にglColor4f(1, 1, 1, 1)を設定し、テクスチャ本来の色を使う。選択名/区画の強調は維持し、既存のGL保存復元・スタック不使用方針も維持。
- 回帰テストの文字描画をGL色が残る挙動へ変更し、ホイール6アイコンすべてが白色で描画されることを検証。pnpm build（全4ターゲット）、pnpm test:gui、Java 8u51のbuilder1_gui_nashorn.test.jsが成功。差分/整形確認済み。実GPUでの修正版確認は未実施。
- ZIPを106ファイルで更新。SHA256: 4F082E69C3A9CB2AFE041799D10D7C39744D720A990E327A231F111F5BF29179。KaizPatch/AEで6項目を順に選択して次アイコンの変色がないことを確認し、異常時は選択ツールとlogs/latest.logを共有する。
