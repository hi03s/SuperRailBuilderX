# AppleExtended target

> 2026-10-23 確認完了: 開発者から全動作の実機確認完了の報告を受領した。本資料中の過去の未確認・確認待ちと確認手順は当時の調査記録であり、現在の動作確認残件ではない。

SRBXはAppleExtended正式リリース`v2.5.4`を対応基準とする。AE固有処理は`src/appleextended/assets/minecraft/scripts/superrailbuilderx`へ隔離し、AE本体に同等APIが追加されたものから削除する。

## 2026-10-23 分岐修正の波及確認

根元所有位置の退避は生成・移動前検証・失敗復元・Undoの共通経路を確認した。移動前検証では削除予定の自分の旧コアを無視するが、退避先候補だけは一律に既存コアを拒否しており、唯一の候補が旧コアだと`rail_overlap`になる不一致を追加修正した。候補にも同じ障害判定を適用し、他レールのコア保護・同一高さ・2.5m未満・線形内の制約は維持する。回帰では旧コア再利用、他コア拒否、通常生成の既存コア拒否と入力不変を確認した。

finalな`switchType`への直接代入は残っていない。所有位置退避はNBT複製で精密座標・方向・役割・カントを保持し、再生成とUndoも同じ経路を使用する。旧`switchObj`と`openedRails`の破棄は移動・分割・カントの共通クライアント更新から呼ばれ、遅延NBT再受信も再更新する。全4buildとAE/Kaiz・道床/遷移の回帰成功、実機も開発者の全動作確認完了報告を受領済み。既存コア近くの生成・根元/端部移動・即時表示・Undo・レバー位置の確認事項は完了とする。

## AE2.5.4への移行

- [公式リリース](https://github.com/Kirtmuna/AppleExtended/releases/tag/v2.5.4)で、`jp.apple`配下のクラスが`jp.apple.appleextended`へ移動した。SRBXが使用する`TileEntityLargeRailSectionCore`、`RailChunkSectioner`、`RailMapSection`のimportを変更した。`jp.ngt`配下は今回のパッケージ変更の対象外である。
- [Mod IDの定義](https://github.com/Kirtmuna/AppleExtended/blob/v2.5.4/gradle.properties)も`applelib`から`appleextended`へ変わった。旧判定ではAEが通常RTM用ターゲットへ落ちるため、`rtmx.json`の実行時dispatchを新Mod IDへ変更した。KaizPatchXの優先順位と通常RTMへのfallbackは維持する。
- 型生成の依存タグとscan対象パッケージも更新する。旧AE2.5.3との併用・互換性維持を目的とした動的な旧パッケージ参照は追加しない。
- Java側のSRBXPatch検出と、未導入時の編集拒否を廃止した。生成・移動・分割・カント・分岐・渡り線はパッチなしで通常の検証へ進む。座標・対象キー・在線・ロード状態・既設コア/道床の保護は維持する。
- AE2.5.4は自由端点の走行補正を本体へ取り込んだ。SRBXパック側の描画互換処理は別の処理なので維持し、暫定JavaパッチやMod本体は変更しない。

### 移行時の検証

2026-10-23、全4ターゲットのbuildと、AE/Kaiz・GUI・入力・組ホーム・道床/遷移・自由端点・dispatch・レール描画/境界の回帰が成功した。Javaパッチを仮定するテストfixtureを取り除き、未導入時も生成/編集へ進むこと、形状不正と在線時の拒否、AEの新パッケージだけを持つfixtureでの動作を確認した。実Minecraft上の操作・走行は未確認である。

通常の型生成はJitPackのv2.5.4 POM取得がread timeoutになったため、同じ処理を繰り返さず公式リリースの`AppleExtended-forge1.12.2-2.5.4-dev.jar`で検証した。公開digestと一致するSHA-256は`120e26f6625f1466aa58deed74389230cf7d08fc3368761f36f20da909a974c0`。既存1.12.2のscanner classpathから旧AE JARをこのJARへ差し替え、`groovy-all-2.4.15.jar`を補い、rtm-ts既存scannerでAE型とマッピングを生成した。ARIS依存のATSクラスとLWJGLのASM依存クラス計7件はskipされたが、SRBXで使用するクラスは生成・型チェックできた。rtm-tsやJARの中身は変更していない。再現用のclasspathとスクリプトはローカル`.cache/ae254-scanner-paths.json`、`.cache/ae254-generate-from-release.cjs`へ保持する。

## 最新AEで利用する機能

AE v2.5.3には、初期基準`ca255fd`以降に次が追加された。従来基準`9df86c2`から既存の生成・論理レール・移設・NBT APIのシグネチャ変更はなく、SRBXの補完処理は継続利用できる。自動分割には最小Section長2 mの制限が追加され、ポイント転換APIも追加された。

- `ResourceStateRail.autoSplit`と、`BlockMarker.createRail(...)`によるチャンク単位の自動分割生成
- `TileEntityLargeRailSectionCore`、`RailChunkSectioner`、`RailSection`
- `getLogicalRailPositions`、`getRailGroupCorePositions`、`isSameLogicalRail`
- `isLogicalRailOccupied`、`breakLogicalRail`
- 通常レールの端点と道床を更新する`relocateRail`

このため、レール生成A・複線コピー・分割・分岐で新設するレールはAEの`autoSplit`設定を尊重する。短区間や競合回避のため共有側が`forceNormal`を指定した場合だけ、複製したモデル状態の`autoSplit`を無効にする。

## KaizPatchXとの差分とSRBX側の補完

| 分類                     | 最新AppleExtended               | SRBXでの扱い                                          |
| ------------------------ | ------------------------------- | ----------------------------------------------------- |
| 自由端点                 | `setPosition`とoffset NBTあり   | AE APIを使用                                          |
| 自動分割・論理レール     | AE本体に実装済み                | AE APIへ委譲                                          |
| 論理レール削除・占有判定 | AE本体に実装済み                | AE APIへ委譲                                          |
| 通常レール移設           | `relocateRail`あり              | 元状態を退避して論理レールを撤去・再生成              |
| 分割レール移設           | group全体を移設する公開APIなし  | 全memberの存在・占有を検証し、group全体を撤去・再生成 |
| 任意位置分割・分岐生成   | SRBX相当の高水準APIなし         | AE compatで論理端点から撤去・再生成                   |
| カント整形               | RailPositionのカント値あり      | AE compatで論理端点を更新し、Section group全体へ同期  |
| レール設定型             | `ResourceStateRail`             | compat境界で扱う                                      |
| RPのNBT復元              | `readFromNBT(nbt, destination)` | compatでcloneする                                     |

## 一時互換モジュール

- `AppleExtendedRailCompat.ts`: 論理レール識別、端点解決、モデル状態の複製、AE標準生成、論理レールUndoを担当する。
- `AppleExtendedRailToolsCompat.ts`: 任意位置分割、中央・端点分岐、カント整形と各Undoを担当する。
- `AppleExtendedRailMoveCompat.ts`: 通常・自動分割レールの端点/全体移動、元状態退避、失敗時復元と更新コア通知を担当する。
- `AppleExtendedRailProtection.ts`: 生成前の既設道床の所有先を退避し、生成・失敗後にも所有先を維持する。既設道床を新コアへ置換するとAEの`breakBlock`が元の論理レールを削除するため、コア所有ブロックは別途保護する。
- `AppleExtendedSwitchCompat.ts`: 分岐線形を事前検証し、公開配置・NBT APIで生成する。`BlockMarker`のnull player失敗経路とprotectedフィールドへの代入を使わない。
- `SRBXApiCompat.compat.ts`: 共通ツールとAE APIの境界を担当する。

分割・分岐は変更前の論理RailPosition、モデル、信号、サブレールを退避し、途中失敗時とUndo時に再生成する。生成先は最新AEの自動分割機構へ委譲する。カント整形はSection coreの物理端点を直接上書きせず、全group coreの`RailSection` NBTに同じ論理端点を書き戻してRailMapを再構築する。

AE v2.5.3の標準include読込はJava正規表現の置換文字列を保護せず、バックスラッシュを消費する。描画patchは関数の`toString()`からコードを生成し、除外パスは文字コード92のsplit/joinで正規化する。KaizPatchXは置換文字列を保護するが、両方式で同じ補正動作となることを配布JSのテストで確認する。

### モデル構築後の描画パッチ適用

AEでは`ModelPackManager.modelConstructed`による全体構築完了を待ち、描画器を持つ各モデルのスクリプトへパッチを適用する。`getModelList`はSMP時にサーバー許可一覧を返し、起動時は空になるため使用しない。公開`allModelSetMap`のModelRail親タイプからreadLock下でローカルモデルのスナップショットを取得し、ロック解除後にパッチする。ダミーや構築失敗モデルは描画器を持たないことがあるため、全モデルの描画器を待機条件に含めない。描画器なしはモデル名付きで個別スキップし、`local rail registry: models=N`と`[SRBX rail patch] completed: patched=..., failed=...`を出力する。

待機条件と列挙先の変更後の実機適用は再確認が必要。経緯は[10月履歴](../history/CODEX_HISTORY_2026-10.md)に記載する。

### 中間点からの分岐生成と復元

分岐の補助端点の所有ブロックが既設コアと重なる場合は、精密端点座標と根元の所有ブロックを維持し、補助端点の所有ブロックだけを同じ高さ・近傍2.5m以内の生成道床範囲内へ移す。移設先は他端点の予約ブロックと既設コアを避け、NBTへ保存して再読込・位置更新でも保持する。道床範囲内に限定することでネイティブUndoの撤去対象に含める。安全な位置がなければ配置前に拒否する。

中間点の分岐では分割後の形状だけを計算し、分岐レールを先に生成してから残りの通常・自動分割レールを生成する。仮分割レールを両側へ敷設して片側を撤去する方式は、残す側のコアが分岐コア位置を塞ぐため使用しない。外部接続のカント退避は元レールが存在する間に行い、置換レールを外部接続のUndo対象へ含めない。

失敗時の復元は置換対象全体のキー・占有を確認し、撤去失敗を無視しない。元レールの再生成によりSection UUIDが変わるため、失敗応答でも撤去したグループと復元したグループをクライアントへ通知する。通常の線路分割も同じ復元処理を使用する。

### 分岐候補の未初期化コア

`getLogicalRailPositions()`は未初期化コアで`null`を返す場合がある。分岐生成の候補探索・端点強調は配列と両端の存在を確認し、未準備コアをスキップする。`[SuperRailBuilderX branch] unready rail skipped`は処理段階ごとに1回だけ記録し、後続フレームで初期化が完了したコアは再び対象にする。

### 既設端点からの分岐生成と分岐移動（2026-10-23）

実機ログの01:07:24/01:07:47の`switch_create_failed`は、分岐rootの所有ブロックが既設の別コアと競合していた。直後の2点レール生成成功は元線路の復元であり、分岐の生成成功ではない。既設コアは保持し、rootも補助端点と同様に同じ高さ・道床範囲内・距離2.5m未満の空き所有ブロックへ退避する。精密端点・方向・分岐の役割は維持する。空き位置がなければ生成を拒否し、元レールの復元へ進む。

AEの`RailPosition.switchType`はJavaのfinalフィールドである。移動先の自由点へ後から代入すると、根元の役割が0のままになり`RailMaker.getSwitch()`がnullを返す。移動先NBTの`SwitchType`を元端点の役割に設定してからRailPositionを作り直す。これにより根元と他端部の移動・Undoで役割を維持する。形状が成立しない場合は撤去前に拒否し、`[SuperRailBuilderX AE move] switch validation failed`へ段階・キー・端点番号・所有/精密座標・役割・向きを記録する。

またAE2.5.4の`TileEntityLargeRailSwitchCore.readRailData`は新しいRailPositionを読み込んでもprivateな`switchObj`を残し、`createRailMap`も非nullなら再構築しない。SRBXのクライアント更新時に`switchObj`と`openedRails`をクリアしてから再構築し、レールと道床の再描画を要求する。既存の遅延NBT再更新も同じ経路を使う。キャッシュ処理に失敗した場合は描画呼出しへ例外を伝播させず、`[SuperRailBuilderX AE] client rail refresh failed`を1回出力する。JARやMod側へは修正を追加しない。

01:06:20/24/28の`rail_not_found`は、要求座標・キーが旧ログにないため原因未確定である。既存処理は指定座標だけでなくロード済みコアの同一キーも探索しているため、キー不一致を無視した救済は行わない。新しい`[SuperRailBuilderX RailPosition] core resolution failed`へ要求座標/キー・実コアキー・ロード済み候補を出力する。候補scanの`sectionedCores=0`はAEではsectionの不在を証明しない。

実機再確認は、問題が出た既設端点から分岐生成→既設保持→根元/他端部移動→再入場前の表示と道床→Undo→再生成の順に行う。所有ブロックを退避した場合、レバーの参照位置も退避先へ移るため転換操作も確認する。移動失敗が残る場合は操作・時刻と新しい`logs/latest.log`を開発者へ共有し、上記3診断接頭辞を含む箇所を比較する。全4buildと関連回帰による模擬検証と、実Minecraft上の再確認を区別する。

## 対応範囲と制限

対応範囲:

- 通常・自動分割レールの端点/全体移動、クライアント同期、Undo（実機確認済み）
- レール生成A、複線コピー、自動分割生成、Undo
- 通常・自動分割レールの分割、中央/端点分岐、カント整形とUndo
- `Loader.isModLoaded("appleextended")`による`mc1122`より優先した実行時選択
- その他の差分がない1.12.2処理の`compatFallbackTarget: "mc1122"`利用

未対応:

- 分岐レール自体の移動。通常・自動分割レールの移動ではSectionの物理`relocateRail`を使わず、論理レール全体を再生成する。変更前に端点・キー・占有・group memberを確認し、失敗時は元の端点・モデル・信号・サブレールを復元する。

2026-10-03の再テストで、生成コアの確認位置がAEと一致しない問題を修正した。AEは2端点の`blockY`が等しい場合に2番目をコア所有端点に選ぶ。生成・分割・複製・復元はこの同じ規則でコアとUndoキーを取得する。Sectionの選択は論理端点を使用し、builderAの分岐端点選択用の理由コードも共通APIに合わせる。

Undo入力は左右Ctrlに対応するSRBX固有ラッパーを使い、履歴の可否フラグがfalseなら要求を送らない。単回Undoの成功時はクライアントでも即座にフラグを下げ、カントの複数履歴はサーバーの残履歴判定を維持する。サーバーのUndo記録を最終判定にし、分割・カントUndoは全対象の変更・占有を先に検証する。19:38～19:39の実機ログで分割/移動Undo成功を確認済み。

19:37～19:42の再テストを受け、自動分割の生成確認は`RailChunkSectioner`が決めた実際の最初のコア位置を使う。Sectionコア所有位置が既設の道床/コアと競合する場合は、モデルを複製して通常レールへフォールバックし、通常コアの所有位置も保護する。両端とも保護対象で安全なコア位置を選べない場合は生成前に拒否し、`creation blocked`を出す。道床所有先の退避は全生成・分割・復元・移動・分岐に適用する。

カントの`NBTTagCompound#setTag`は第2引数を`NBTBase`として渡し、配布JSがSRGメソッドへ変換されることを検証する。分岐の`RailPosition.switchType`はJava finalフィールドのため、`SwitchType` NBTから再生成する。分岐コアのprotectedなバージョンは正規NBTで初期化する。

Minecraft実機では、生成・分割・分岐後にチャンク境界をまたぐSectionが一つの論理レールとして選択・走行・Undoできること、カント適用が全Sectionへ反映されることを確認する。

## ビルド確認

```sh
pnpm gen
pnpm build
```

AEターゲットのMCP mappingsは`stable/39`を使用し、依存は`com.github.Kirtmuna:AppleExtended:v2.5.3`とする。rtm-ts 0.12.0は改造・パッチせず使用する。2026-10-03にJitPack取得が復旧し、標準の`pnpm gen`と`pnpm build`が全4ターゲットで成功した。描画patchの`pnpm test:rail-patch`も成功。型定義・JARはGitへ追加しない。Minecraft実機検証は別途必要。

## AE側に追加されれば削除できる補完

1. 任意位置分割・分岐・Undoを扱う公開API。
2. 論理RailPositionのカント更新とSection group同期を一括で行う公開API。
3. Section group全体の端点・道床を安全に移設する`relocateRail`相当API。
