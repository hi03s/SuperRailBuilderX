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
