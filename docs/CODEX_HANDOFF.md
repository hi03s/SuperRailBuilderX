# 開発者とローカルCodexの引継ぎ帳

最終更新: 2026-10-23（ローカルCodex、main）

## 現在の状態

- SRBX 0.3.2、main。rtm-ts 0.12.0を改造せず、KaizPatch/AE/通常RTM 1.7.10/通常RTM 1.12.2の4ターゲット構成を維持。
- 現行ソースは1.7.10/1.12両環境でSRBXPatchなしのツール動作へ対応。完全自由点と既存保護は維持し、走行補正はMod本体/任意パッチへ任せる。AE基準は2.5.4で新パッケージ・新Mod IDへ移行済み。最新開発ZIPへ反映済み、公開済み0.3.2 ZIPは未変更。[AE対応と検証](development/appleextended-target.md)・[任意パッチ](development/srbxpatch.md)。
- 生成・移動・分割・複線・カント・分岐・Undoは共通の道床/コア保護を使用。理論両端各1タイルの所有先変更、競合時の逆順→設定上限内の通常生成、撤去前の所有先復元に対応。[道床調査](research/roadbed-ownership-investigation.md)。
- AE重複区間・自動分割境界対策は実機確認済み（2026-10-11）。KaizのCrossTieあり/なしも実機動作を確認済み。[AE対策](research/appleextended-overlap-rail-patch.md)。
- AE分岐生成のroot所有コア競合、分岐根元移動のfinal switchType代入、NBT受信後の旧switchObj保持を修正。精密座標と既設保護を維持し、段階診断/キャッシュ例外ガードを追加。最新開発ZIPへ反映、実機再確認待ち。[原因・手順](development/appleextended-target.md)。
- 生成A/BはI/Kで自由始点の選択高さ±1/16m、Ctrlで±1m、Uで地上高延長。Bの長さはJ/Lの長押し加速（初期0.1m/Ctrl10m、最大512m）、半径も加速。ホイールによる長さ変更は廃止。[A](user-guide/builder1.md)・[B](user-guide/builder2.md)。
- 長押し単位は初期値の10倍まで。A/B/分岐の固定半径は1→10m、Ctrlは100m固定。A/Bは接続済み端点を始点/終点から除外、分岐は始点だけ許可。分岐終点は分岐レールの全未接続・水平端部も候補化。実機確認待ち。
- [組ホーム](user-guide/platform-builder.md)を追加。手持ちレール必須、左右1列、間隔2m/高さ1.5mから設定。サーバーで元線形を再検証・再計算し、共通保護とUndoを使用。ホイールは全9ツール。実機確認待ち。
- AEのTAB拒否は非乗車追従へ乗車必須チェックを適用していたことが原因。bb224faでcompat判定と切替後のサーバーホスト引継ぎを修正しpush済み。全4build・入力/GUI/dispatch/AE回帰・Java8ホイール成功、実機再確認待ち。
- v0.3.1は公開済み（GitHub APIで確認）。v0.3.2は本終了コミットへタグを付け、ActionsでZIP＋両SRBXPatch付きDraftを準備する。公開は開発者の手動Publish。[リリース手順](development/releasing.md)。
- artifactsは開発版`SuperRailBuilderX-0.3.2.zip`（2026-10-23、パッチ非依存化/AE2.5.4/分岐生成・移動・表示/Kaiz接続カントの修正を反映）、配布版`SuperRailBuilderX-v0.3.2.zip`、環境別SRBXPatch v1.0 JARの4ファイル。配布版ZIPと両JARは保持し、既存リリースは変更しない。実機確認が必要な本体変更は開発ZIP生成まで行う。
- docsは[user-guide](user-guide/)、[development](development)、[research](research/)、[history](history)へ分類。user-guideは9ツールの説明書だけを配置し、共通4章へ統一。導入・動作環境はトップREADME/同梱readme、内部仕様は開発資料へ集約。文書入口は[README](README.md)。logsは原則Git保存しない。

- Kaizカントの接続探索を強調表示と同じ端点照合へ統一し、Undoの全対象事前検証を追加。分岐/渡り線の共有経路とAE修正の波及も点検し、AE移動前検証の旧コア再利用拒否を修正。全4build・関連回帰成功、最新開発ZIPで実機確認待ち。[カント調査](research/cant-curve-rendering.md)。

## 作業中

- なし。

## 優先確認事項
- Kaizで問題のカント選択を再実行し、強調された接続レールの端部/中央、適用→Undo、再入場前後を確認する。分岐/渡り線の接続側平坦化と失敗復元も確認。再発時は選択順・時刻とlogs/latest.log（cant/affected rails/cant-profile）を共有する。AEでは移動元の旧コアを退避先に再利用するケースも確認する。
- 今回AEログの01:07:24/47はroot所有位置と既設コア競合、01:10:31は根元のfinal switchTypeを変更できない不具合。所有位置退避とNBT再構成、表示キャッシュ更新を修正。最新開発ZIPで同じ端点から生成→根元/他端部移動→再入場前の形状・道床→Undo・再生成を確認し、退避先のレバー転換も確認する。01:06:20/24/28のrail_not_foundは要求キーが旧ログにないため未確定。再発時は操作/時刻と新しいlogs/latest.log（core resolution failed/switch validation failed/client rail refresh failed行を含む）を共有する。全4build/関連回帰/ZIP確認成功、実機未確認。
- パッチなしの実機確認待ち。最新開発ZIPをKaizPatchX 1.10.4/AE2.5.4へ導入し、SRBXPatch JARを外した試験環境で起動・各ツールの生成/編集/Undo・再入場後・AEの自由端点遷移を確認する。Kaizの走行補正は任意SRBXPatchへ依存し得る。全4build/関連回帰成功、通常型生成はJitPack timeoutのため公式AE2.5.4 dev JARで検証済み。今回ZIP内スクリプト/readmeと不要データ除外も確認。再発時はツール・操作順・時刻とlogs/latest.logを共有。配布版ZIP/JAR・リリースは未更新。
- リポジトリ全体のformat:checkは既存・今回未変更の19ファイルで警告。今回変更したソース/テスト/設定のPrettier確認と差分確認は成功。無関係な整形変更は行っていない。
- [Issue #3](https://github.com/hi03s/SuperRailBuilderX/issues/3): 旧NGTOBuilder2.1の共有ツールキットには描画補間関数がなく、報告のTypeErrorを説明できる。開発者指示でNGTOBuilder2 2.3.2への更新案内を優先する。公開ZIPのSHA一致・関数存在と、未変更SRBX0.3.2描画のJava8失敗/更新後成功を確認。両側の旧ZIPを除去・最新版へ置換して再起動する。報告環境のリソース選択・実機解消は未確認。再発時は両側ZIP名と新規クライアントログ/クラレポを受領。SRBXコード・rtm-ts・JAR・パッチModは変更なし。[調査・手順](research/issue3-multiplayer-tool-crash.md)。
- AEの既設端点接続生成で元線の制御長を流用しプレビューとずれる不具合を修正。要求された水平/垂直制御長を使う。Kaizには同じ欠落なし（接続長大曲線の回帰追加）。自動分割のネイティブ生成で全コア未生成の場合だけ、論理曲線を保つ手動配置へ1回再試行し、部分コアがある場合は停止する。未読込区間は変更前に拒否・診断。全4build・AE/Kaiz/GUI/遷移/dispatch成功、最新ZIPで新規の長大カーブ・分割/Undo・再入場後と元分岐保持を確認する。既存の変形レールは自動修復しない。再発時は操作/時刻とlogs/latest.logを共有する。
- AEの渡り線通常レール欠落は、通常コアへ分岐用NBTを書いていたSRBX不具合を修正（StartRP/EndRPへ変更）。空形状検知・撤去/道床復元を追加。core_conflictにはY丸めによる計画コア逆転対策と段階診断を追加したが、現ログだけでは全競合の原因は断定できない。全4build・AE/Kaiz/GUI/遷移/dispatch成功。最新開発ZIPで空き場所へ片渡り/シーサスを再生成し、全通常区間の描画・走行・再入場前後を確認する。既存の空コアは自動復元しない。再発時は形状/操作/時刻とlogs/latest.log（crossover core conflict行を含む）を共有する。
- 渡り線の既設選択はKaizの水平判定API不足を修正。normal_core_changedは水平曲線のY丸め差による生成順逆転が原因で、1e-9m以下では計画順を維持する。全ツールの半径操作はCtrl時の長押し加速を廃止（100m固定、通常1→10mは維持）。全4build・GUI/入力/Kaiz/AE/道床・遷移/dispatch/Java8回帰成功。最新開発ZIPで既設選択・最小30m・曲線シーサス生成とCtrl長押しを実機確認する。SRBXPatchは変更しない。
- 渡り線生成は最小30m、初期60m。生成後Undoをクライアント/サーバーで無効化し、失敗時復元は維持。片渡りは分岐2本＋通常2本、シーサスは約3等分して分岐4本＋通常4本を直接生成し、既存4点シーサスの線路分割も同じ構成へ対応。中央斜線は直線で交差し、通常部分は自動分割しない。全4build・両版/GUI/入力/dispatch/遷移/Java8回帰成功、実機未確認。両環境で各形状・前後接続カーブ・失敗時保持・中央交差の全経路双方向走行・再入場前後を確認する。生成Undo不可、線路分割Undoは維持。[説明書](user-guide/crossover-builder.md)。
- SRBXPatchは車両の自由点接続・レール遷移に限定し、明示指示なしに別機能を追加しない（AGENTS.mdへ反映）。一時追加した形状判定補正・描画ガードは撤回し、1.7.10 JARも追加前へ復元済み。追加版を導入した場合はartifactsの同名JARへ戻してMinecraftを再起動する。
- Kaizの片渡りinvalid_switch_layout（交差判定の内積誤用）と終了時クラッシュ（isSwitchRailのnull map参照）は未修正。開発者から上流へ連絡する。[報告用資料・再現座標](research/kaizpatch-crossover-and-render-errors.md)。SRBXPatchへの再追加は行わない。
- SRBXパック側の補助所有位置競合は今回ログの21:34:24に既設コアを保持した移設・生成成功、21:34:28にUndo成功を確認。この修正は維持し、形状・接続・走行の実機確認を続ける。
- 最新開発ZIPで通常レールと接続した分岐端部の移動・Undo・再入場前後の座標一致を確認する。Kaizでは所有ブロック変更後の精密座標再設定漏れを修正。Kaiz/AEの片渡り4点分岐の固定中点分割（分岐2本＋通常2本）とUndo・失敗時の元形状保持も確認する。曲線側線の中点・接線を保つ形状調整は開発者了承済み。シーサス分割も分岐4本＋通常4本へ対応。異常時は操作・時刻とlogs/latest.logを共有する。

- 今回ログのKaiz分岐移動は、接続レールの先行生成によるowner競合、分岐Map版指定順序と旧キャッシュを修正。最新開発ZIPで単独/通常レール接続の端部移動後、再入場前から形状・道床が一致すること、失敗時復元・Undoを実機確認する。渡り線Cの全設定初期化、複線コピーと同じ強調表示、(6,2)アイコンと左右複線の短縮名も確認。異常時は操作・時刻とlogs/latest.log。

- KaizPatch/AEで[渡り線生成](user-guide/crossover-builder.md)の6形状、自由始点/既設基準線、端部吸着、生成失敗時の元レール保持を実機確認する（生成Undoは無効）。分岐端部の移動/Undo（全体の平行移動は不可）、始点高さアイコン、左端3枚時計枠も確認する。異常時は操作順・時刻とlogs/latest.logを共有する。
- 複線コピーの吸着端カントもコピー元優先へ変更（接続先と意図的に不一致可）。サーバーで元レールを再検証・再取得。他ツールの端部継承は維持。GUIツール名は4枚枠、左上時計HH:mmは左端3枚枠へ中央揃え。生成A/B/渡り線に始点高さアイコンを表示。全4build/関連回帰/Java8成功、実機では吸着先と異なるカントの生成・Undo、時計・枠を確認する。
- Angelica 2.2.34併用時のGUI復元クラッシュを修正。基本テクスチャをglTexCoord4f、通常ライトマップをglMultiTexCoord2fで復元し未対応の4fを回避。全4build・GUI回帰・Java8成功。最新開発ZIPでGUI/TAB開閉後のクラッシュ・明るさ・レール描画を実機確認する。[詳細](research/gui-rendering-compatibility.md)。
- [Issue #2](https://github.com/hi03s/SuperRailBuilderX/issues/2): 始点吸着時にコピー元の中央/ランダムカントを接続先から継承してしまうSRBX不具合を両版で確認・修正。描画優先の前判断を変更。全4build/関連回帰成功。実機ではカント付きカーブをカントなし直線の端へ始点吸着してコピーし、中央が元値を保つこととUndoを確認する。ログ対象キーも追加。[時系列・再現手順](research/cant-curve-rendering.md)。
- Issue #2のコピー4本は始終点Pitch=0、3本は同じ高さ、残り1本は0.5mmの丸め差だけ。先日の縦曲線再分割バグとの直接関連を示す根拠はない。開発者の水平カント付き複線テストでは非再現。元レールの生成履歴と対象モデルの切り分けを続ける。
- 生成Aの0‰/非0‰の水平曲線、向きが逆の接続レールの複線コピー、生成Bの左右方向と直線停止を修正。全4build・関連回帰成功。最新開発ZIPでKaizPatch/AEの生成・UndoとBの押し直しを実機確認する。異常時は操作・時刻とlogs/latest.logを共有する。

- AE中間点分岐の生成・Undo・失敗復元と描画パッチは、開発者から実機解消確認を受領（2026-10-12）。0.3.1に収録済み。
- KaizPatch/AEでI/Kの始点高さ限定、Uの地上高延長、BのJ/L/Ctrl/長押し加速・512m上限と半径操作、組ホームの左右・高さ・手持ち必須・生成/Undo、9ツールのホイールを確認する。異常時は操作順とlogs/latest.logを共有する。
- A/Bの接続済み端点除外、分岐の接続済み始点選択と終点除外、分岐レール3端点へのスナップを確認する。分岐の中間点選択・水平制約は維持している。
- AEの分岐補助道床が既設コアと重なる生成失敗を修正。端点の精密座標を保ち、補助所有ブロックだけ近傍の道床範囲内へ移す。生成・再読込・Undoで既設レールが保持されることを確認する。異常時はlogs/latest.logを共有する。
- 道床所有履歴の専用WorldSavedDataへの変更は模擬保存/再読込まで確認済み。生成・接続移動・分割・Undoと再入場後の未選択レール保持を実機確認する。本番サーバーは操作しない。
- 状態GUI、カントの理論レール単位選択/両端適用/0km/h/±50、CTRL中の移動ホバー抑止、分岐スナップは関連回帰成功。未確認の実機条件は操作順とログで確認する。
- SRBX未導入/JARなしクライアント接続は設計上許可するが、実機接続は未確認。
- v0.3.2のActions結果とDraft本文/ZIP＋2 JARを確認し、開発者が手動Publishする。タグpush後の検証結果・Draft URLは最終報告で伝え、記録だけの追加コミットは作らない。ローカルCodexは公開しない。

## 次に行うこと

1. 最新開発ZIPでKaiz接続カントの適用/UndoとAE分岐生成・根元移動・即時表示とrail_not_foundの再発有無を確認する。異常時は機能・操作順・時刻と新しいlogs/latest.logを共有する。パッチなし実機確認と次回リリース準備も継続し、JitPack復旧時は通常型生成を確認する。
2. 確認結果を引継ぎ帳へ反映し、不要になったローカルログを削除する。調査結果は文書へ要約し、生ログをGitへ追加しない。
3. v0.3.2 Draftの本文とAssets・実機確認状況を確認し、開発者が手動Publishを行う。

## 双方向連絡

- 新規リポジトリ/フォーク/Issue/PR/コメント投稿は禁止。既存ブランチ・コミット・push・ビルドだけを行う。
- rtm-ts、参照専用ツールキット、本番サーバーを変更しない。コミットメッセージは日本語。
- ローカルに保持する調査ログは、今回のKaizカントに必要な32行へ整理したlogs/latest.logとKaiz保存APIの例外抜粋。生ログのPC情報・無関係なMod出力は保持しない。実機再確認後に不要なら削除する。

## 直近の完了
- 2026-10-23 ローカルCodex: Kaiz接続カント探索とUndo途中復元を修正。AE直前修正の波及点検で旧コア退避先の過剰拒否も修正。全4build・関連回帰成功、開発ZIP132ファイル照合済み、実機未確認。開始記録ac4d748。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-23 ローカルCodex: AE分岐のroot所有位置競合、根元移動のfinalフィールド誤代入、旧分岐キャッシュ保持を修正。rail_not_foundは厳格照合を維持して診断追加。全4build/関連回帰成功・開発ZIP更新、実機再確認待ち。開始記録d733aa1。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-23 ローカルCodex: 実機確認が必要な本体変更は開発ZIP生成まで行う方針をAGENTS.mdへ記録。全4build/ZIP生成と格納132ファイルの要点を確認し、パッチ非依存化/AE2.5.4対応の開発ZIPを更新。配布版ZIP/両JARはハッシュ保持、実機未確認。開始記録b946bbb。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-23 ローカルCodex: 両版15か所のJavaパッチ必須判定を廃止、AE2.5.4のパッケージ/Mod IDと型生成基準を移行。公式JARでの型生成・全4build・関連回帰成功、実機未確認。配布ZIP/JAR・リリース未変更。開始記録978ef47。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-23 ローカルCodex: README/同梱readmeをAE2.5.4のパッチ不要・2環境表記・全9ツールへ更新。9説明書を統一し指定4文書を削除、内部仕様とリンクを整理。文書検証のみ、ビルド・リリースなし、パック反映は次回。開始記録965f3ed。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-22 ローカルCodex: Issue #3の旧NGTOBuilder2共有API競合を調査し、2.3.2更新案内を整理。Java8で未変更SRBX描画の失敗/更新後成功を確認、実機未確認。試作修正は取り下げ文書のみ。開始記録d18cfda。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-21 ローカルCodex: SRBX0.3.2へ更新し、配布ZIP・0.3.1以降の本文・両v1.0 JARを準備。全4build・関連回帰・実バイトコード検証成功。終了コミットへv0.3.2タグを付け、Draft/AssetsをActionsで作成・確認する（結果は最終報告）。開始記録0021aa8。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-21 ローカルCodex: AE接続生成の制御長反映漏れと長大セクション失敗時の再生成経路を修正。Kaiz同種問題なし、回帰を追加。全4build・関連回帰成功、開発ZIP更新、実機未確認。開始記録4e905b3。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-21 ローカルCodex: AE通常レールのNBT形式を修正し、空形状の成功扱いを防止。コア計画のY丸め差対策・競合段階診断を追加。全4build・関連回帰成功、開発ZIP更新、実機再確認待ち。開始記録1a09e3d。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-21 ローカルCodex: 渡り線既設選択を復旧、最小30m、水平曲線のY丸め差によるコア逆転を修正。全ツールCtrl半径の長押し加速を廃止。全4build・関連回帰・Java8成功、開発ZIP更新、実機未確認。開始記録9c7dc4d。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-20 ローカルCodex: 渡り線最小20m・生成Undo無効化、シーサスの8本構成による直接生成/線路分割を実装。全4build・関連回帰・Java8成功、開発ZIP更新、実機走行未確認。開始記録7bd0346、終了コミットは本記録と変更をまとめてpushする。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-20 ローカルCodex: 接続カーブからの片渡り生成で既設コアに重なる新設コア所有位置を安全な外端付近へ移す修正。両環境で端点精度・既設保持・Undo/配置不可拒否の回帰と全4build成功、開発ZIP更新、実機未確認。開始記録1463356。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-20 ローカルCodex: Kaiz/AEの片渡りを分割状態で直接生成し、既存分割の配置/復元を共用。初期長60mとプレビューを反映。全4build/GUI/入力/dispatch/AE/Kaiz/遷移/Java8成功、開発ZIP更新、実機未確認。開始記録201dea0。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-20 ローカルCodex: 開発者指示によりSRBXPatchの形状判定補正・描画ガードを撤回し、追加前のソース/JARへ復元。両JARの既存Java8/実バイトコード検証成功。用途制限をAGENTS.mdへ記載し、上流報告用資料を整理。開始記録bc3ab86。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-20 ローカルCodex: 1作業を開始・終了の2コミットにまとめる運用へ変更。結果・履歴は終了コミットへ集約し、自己SHA/同期結果の追記だけの追加コミットは廃止。今回の開始記録は7098c24。文書差分・リンクを確認し、文書のみのためビルド未実施。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-20 ローカルCodex: 既設レールから渡り線生成時の補助所有位置競合を修正し、未特定の直線レイアウト拒否へ診断出力を追加。全4build/GUI/AE/Kaiz/遷移/dispatch成功、開発ZIP更新。[62de82a](https://github.com/hi03s/SuperRailBuilderX/commit/62de82a)をorigin/mainへpush・同期済み。実機再確認と直線側の追加ログ待ち。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-20 ローカルCodex: AGENTS.mdに着手前の開始記録コミット・pushと、終了結果の別コミット・pushを必須化。今回も開始記録[7933e23](https://github.com/hi03s/SuperRailBuilderX/commit/7933e23)を先にpushしてから編集した。終了コミット0cfac7eをorigin/mainへpush・同期済み。文書差分・リンク確認、ビルドは文書のみのため未実施。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-19 ローカルCodex: 接続分岐移動の所有位置変更後NBT座標ずれを修正し、Kaiz/AEの片渡り4点分岐の固定中点分割・生成復元/Undoを追加。全4build・関連回帰・Java8成功、開発ZIP更新、実機未確認。[b0ca61f](https://github.com/hi03s/SuperRailBuilderX/commit/b0ca61f)をorigin/mainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-19 ローカルCodex: 渡り線の強調/C/形状GUIを修正し、Kaiz分岐のMap版・キャッシュ・残存道床と接続端部移動の順序/失敗復元/遅延再描画を対処。全4build/関連回帰/Java8成功、開発ZIP更新、実機未確認。[011532d](https://github.com/hi03s/SuperRailBuilderX/commit/011532d)をorigin/mainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-19 ローカルCodex: 渡り線生成6形状・既設基準線/吸着/Undo、両版分岐端点移動、始点高さアイコンと3枚時計枠を実装。全4build/関連回帰/Java8成功、開発ZIP更新、実機未確認。[a5474a3](https://github.com/hi03s/SuperRailBuilderX/commit/a5474a3)をorigin/mainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-18 ローカルCodex: コピー元の端部カント保持とGUI文字枠/PC時計を実装。全4build/関連回帰/Java8成功、ZIP更新、実機未確認。[750e10d](https://github.com/hi03s/SuperRailBuilderX/commit/750e10d)をorigin/mainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-18 ローカルCodex: 吸着時の中央/ランダムカント継承漏れを両版で修正。全4build/関連回帰成功、時系列/実機手順を追記、ZIP更新。Issue実機確認待ち。[2ae0fe5](https://github.com/hi03s/SuperRailBuilderX/commit/2ae0fe5)をorigin/mainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-18 ローカルCodex: AngelicaのGUI復元クラッシュを修正し、Issue #2の複製は実質水平と再確認。全4build/GUI/Java8成功、開発ZIP更新、実機確認待ち。[87d60f1](https://github.com/hi03s/SuperRailBuilderX/commit/87d60f1)をorigin/mainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-18 ローカルCodex: Issue #2の原因候補を整理し、モデル名・カント値・分割境界診断を追加。全4build/関連回帰成功、開発ZIP更新。実機未確認。[fb4e4f0](https://github.com/hi03s/SuperRailBuilderX/commit/fb4e4f0)をorigin/mainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。
- 2026-10-14 ローカルCodex: 縦曲線の再分割・複線コピーの逆向き接続・生成Bの左右を修正し直線停止を追加。全4build・回帰成功、開発ZIP更新、実機未確認。[cd3caf7](https://github.com/hi03s/SuperRailBuilderX/commit/cd3caf7)はorigin/mainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: AE分岐の補助端点と既設コアの競合を、精密座標を保った所有ブロック移設で修正。全4build・関連回帰成功、実機の生成/再読込/Undo確認待ち。[08bf7ba](https://github.com/hi03s/SuperRailBuilderX/commit/08bf7ba)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: 分岐の接続済み始点選択を復元し、終点探索を分岐レール全端部へ対応。A/Bの接続済み除外は維持。全4build・関連回帰成功、実機確認待ち。[7d91e48](https://github.com/hi03s/SuperRailBuilderX/commit/7d91e48)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: 長押し単位の10倍上限・A/分岐半径加速、接続端点候補除外と分岐終点操作を実装。全4build・関連回帰成功、開発ZIP更新、実機確認待ち。[681f94b](https://github.com/hi03s/SuperRailBuilderX/commit/681f94b)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: [AE側での独自再実装用設計資料](development/appleextended-rail-resolution-design.md)を作成。ソース照合・リンク/文書検証済み、コード変更なし・ビルド/実機未実施。[01fb43f](https://github.com/hi03s/SuperRailBuilderX/commit/01fb43f)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: 始点高さと生成Bの長押し/U延長、組ホームと8ツールのホイールを実装。全4build・関連回帰・Java8 GUI成功、実機確認待ち。[a00395a](https://github.com/hi03s/SuperRailBuilderX/commit/a00395a)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: SRBX 0.3.1へ更新し、ZIPと2 JAR付きDraftを準備。ローカル回帰と両Actions成功、未公開・本文・添付検証済み。[32e2467](https://github.com/hi03s/SuperRailBuilderX/commit/32e2467)とv0.3.1タグはpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: AE中間点分岐の生成順序・Undo対象・失敗時再描画と描画パッチ列挙先を修正。全4build・関連回帰成功、最新ZIP更新、実機再確認待ち。[244e4e2](https://github.com/hi03s/SuperRailBuilderX/commit/244e4e2)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: AE分岐描画の未初期化端点ガードと描画パッチ待機条件を修正。全4build・関連回帰成功、実機再確認待ち。[2d4a57b](https://github.com/hi03s/SuperRailBuilderX/commit/2d4a57b)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: 成果物を4ファイルへ整理し、不要ログ58件を削除。logsはGit追跡から除外。文書分類・調査統合・説明書の利用者向け整理とリンク検証を完了。[0824ed2](https://github.com/hi03s/SuperRailBuilderX/commit/0824ed2)はmainへpush・同期済み。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

- 2026-10-12 ローカルCodex: AEの非乗車TAB切替とホスト引継ぎをbb224faで修正・push済み。実機再確認待ち。[10月履歴](history/CODEX_HISTORY_2026-10.md)。

## 関連資料

- [利用者向け説明書](README.md#利用者向け)
- [共通レール生成](development/rail-generation-and-free-positioning.md)・[SRBXPatch開発](development/srbxpatch.md)
- [自由端点/台車遷移の統合調査](research/rail-transition-research.md)・[道床/CrossTie](research/roadbed-ownership-investigation.md)
- [10月履歴](history/CODEX_HISTORY_2026-10.md)・[9月履歴](history/CODEX_HISTORY_2026-09.md)
