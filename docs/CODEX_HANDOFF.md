# 開発者とローカルCodexの引継ぎ帳

最終更新: 2026-10-21（ローカルCodex、main）

## 現在の状態

- SRBX 0.3.1、main。rtm-ts 0.12.0を改造せず、KaizPatch/AE/通常RTM 1.7.10/通常RTM 1.12.2の4ターゲット構成を維持。
- KaizPatchX 1.10.4 / AppleExtended 2.5.3は完全自由点仕様。SRBXパックと対象SRBXPatch JARを併用する。基本はクライアント/サーバー双方へ導入し、SRBX未導入クライアントにはJAR不要。本家対応までの暫定処理。[導入](user-guide/srbx-free-endpoint-mod.md)。
- 生成・移動・分割・複線・カント・分岐・Undoは共通の道床/コア保護を使用。理論両端各1タイルの所有先変更、競合時の逆順→設定上限内の通常生成、撤去前の所有先復元に対応。[道床調査](research/roadbed-ownership-investigation.md)。
- AE重複区間・自動分割境界対策は実機確認済み（2026-10-11）。KaizのCrossTieあり/なしも実機動作を確認済み。[AE対策](research/appleextended-overlap-rail-patch.md)。
- 生成A/BはI/Kで自由始点の選択高さ±1/16m、Ctrlで±1m、Uで地上高延長。Bの長さはJ/Lの長押し加速（初期0.1m/Ctrl10m、最大512m）、半径も加速。ホイールによる長さ変更は廃止。[A](user-guide/builder1.md)・[B](user-guide/builder2.md)。
- 長押し単位は初期値の10倍まで。A/B/分岐の固定半径は1→10m、Ctrlは100m固定。A/Bは接続済み端点を始点/終点から除外、分岐は始点だけ許可。分岐終点は分岐レールの全未接続・水平端部も候補化。実機確認待ち。
- [組ホーム](user-guide/platform-builder.md)を追加。手持ちレール必須、左右1列、間隔2m/高さ1.5mから設定。サーバーで元線形を再検証・再計算し、共通保護とUndoを使用。ホイールは全9ツール。実機確認待ち。
- AEのTAB拒否は非乗車追従へ乗車必須チェックを適用していたことが原因。bb224faでcompat判定と切替後のサーバーホスト引継ぎを修正しpush済み。全4build・入力/GUI/dispatch/AE回帰・Java8ホイール成功、実機再確認待ち。
- [v0.3.1 Draft](https://github.com/hi03s/SuperRailBuilderX/releases/tag/untagged-c0ca067f4b5e8b3bf12f)を作成済み。タグは32e2467。Actions成功、本文一致・draft=true・ZIPと2 JARの添付/ダウンロード検証済み。公開は開発者の手動Publish。[リリース手順](development/releasing.md)。
- artifactsには最新開発版`SuperRailBuilderX-0.3.1.zip`、タグ時点の`SuperRailBuilderX-0.3.1-v0.3.1.zip`、環境別SRBXPatch v1.0 JARだけを保持。今回の新機能は最新開発版のみへ反映し、既存Draft/Assetsは変更しない。
- docsは[user-guide](user-guide/)、[development](development)、[research](research/)、[history](history)へ分類。文書入口は[README](README.md)。logsは原則Git保存しない。

## 作業中

- ローカルCodex: SRBXを0.3.2へ更新し、ビルド・配布ZIP/両SRBXPatch添付と手動Publish用Draftリリースを準備・検証する。

## 優先確認事項
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

- AE中間点分岐の生成・Undo・失敗復元と描画パッチは、開発者から実機解消確認を受領（2026-10-12）。0.3.1へ含める。
- KaizPatch/AEでI/Kの始点高さ限定、Uの地上高延長、BのJ/L/Ctrl/長押し加速・512m上限と半径操作、組ホームの左右・高さ・手持ち必須・生成/Undo、9ツールのホイールを確認する。異常時は操作順とlogs/latest.logを共有する。
- A/Bの接続済み端点除外、分岐の接続済み始点選択と終点除外、分岐レール3端点へのスナップを確認する。分岐の中間点選択・水平制約は維持している。
- AEの分岐補助道床が既設コアと重なる生成失敗を修正。端点の精密座標を保ち、補助所有ブロックだけ近傍の道床範囲内へ移す。生成・再読込・Undoで既設レールが保持されることを確認する。異常時はlogs/latest.logを共有する。
- 道床所有履歴の専用WorldSavedDataへの変更は模擬保存/再読込まで確認済み。生成・接続移動・分割・Undoと再入場後の未選択レール保持を実機確認する。本番サーバーは操作しない。
- 状態GUI、カントの理論レール単位選択/両端適用/0km/h/±50、CTRL中の移動ホバー抑止、分岐スナップは関連回帰成功。未確認の実機条件は操作順とログで確認する。
- SRBX未導入/JARなしクライアント接続は設計上許可するが、実機接続は未確認。
- v0.3.1 Draftの本文/Assets確認後に開発者が手動Publishする。ローカルCodexは公開しない。

## 次に行うこと

1. 最新main ZIPで上記の実機確認を行う。異常時は機能・操作順・時刻とlogs/latest.logを共有する。
2. 確認結果を引継ぎ帳へ反映し、不要になったローカルログを削除する。調査結果は文書へ要約し、生ログをGitへ追加しない。
3. v0.3.1 Draftの本文とAssetsを確認し、開発者が手動Publishを行う。

## 双方向連絡

- 新規リポジトリ/フォーク/Issue/PR/コメント投稿は禁止。既存ブランチ・コミット・push・ビルドだけを行う。
- rtm-ts、参照専用ツールキット、本番サーバーを変更しない。コミットメッセージは日本語。
- ローカルに保持する調査ログは、最新AEログとKaiz保存APIの例外抜粋。解消を確認した分岐クラッシュの旧抜粋は削除。実機再確認後に不要なら削除する。

## 直近の完了
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
