# クライアント・サーバーのSRBX版照合

## 判定と動作

`SRBXVersionGuard`を全ターゲットで共用する。SRBXの版文字列と要求プロトコルが完全一致した場合だけ処理する。片側の版が不明でも許可しない。KaizPatchX・AEのModバージョンを判定する機能ではない。

サーバーはツールのDataMapへ`srbxServerVersion`と`srbxServerProtocol`を公開する。クライアントはDataMapごとにUUIDを生成し、`srbxVersionChallenge`へ書く。現在のサーバーが`srbxVersionAck`へ応答したことも照合する。クライアント側のUUIDはWeakHashMapで保持し、保存済みの版広告・応答を新しい接続で再利用しない。旧版から残る`VERSIONS`は照合に使わない。

クライアントの共通ホイール入口で、不一致・確認前の入力とプレビュー処理を止める。Qによる終了と既存のホスト管理は維持する。新しいchallengeへの応答前は`pending`とし、起動・ツール切り替え直後の操作でエラーを通知しない。Javaの単調時計`System.nanoTime()`で開始から5秒を経過しても応答がなければ`version_unverified`となり、操作時に両側の版と接続確認案内をチャット/NGTLogへ出す。後から応答が届けば通常操作へ復帰する。

版/プロトコルの不一致は、新しい応答を受け取ってから`version_mismatch`と判定する。サーバーは版・プロトコルを公開した後にackを送ることで、古い広告だけによる判定を避ける。待機・タイムアウトによって編集許可の条件を緩和することはない。同じエラー通知を毎フレーム繰り返さない。

各要求には`srbxVersion`・`srbxProtocol`・`srbxNonce`を付ける。全サーバーツールが呼ぶ`SRBXToolSwitchServer.update`で、業務要求を解釈・実行する前に照合する。nonceはDataMapのchallengeとackの両方に一致する必要がある。8種類の編集要求（Undoを含む）とツール切り替えが対象。切り替えも単なるモデル名ではなく、版付きJSON要求とする。

拒否時は該当要求と前回のクライアント更新情報を消し、対応結果へ`version_mismatch`または`version_unverified`を設定する。ログとチャットへ理由・両側の版を記録し、そのtickの編集処理を終了する。確認済み状態を使い回して後続の版なし要求を許可することはない。

## 適用範囲と更新

新サーバーは旧クライアントの版なし要求を拒否し、新クライアントは応答のない旧サーバーへ編集要求を送らない。両側が旧版の場合に、この保護を後付けすることはできない。同じ版表記のまま作成された過去の開発ZIPも識別できないため、確認時は必ず両側を同じ最新ZIPに交換し再起動する。これは互換性の確認機構で、改造クライアントの認証機構ではない。

リリース時は`SRBX_LOCAL_VERSION`をpackage.json/各VERSIONと揃える。要求の互換性を変えるときは`SRBX_LOCAL_PROTOCOL`も更新する。現在は1.0.0 / protocol 1。rtm-ts・参照ツールキット・Mod/JARの改変は不要。

## 検証

2026-10-24、開発者から全問題の解決と実機確認完了の報告を受領。版不一致の拒否、同期待ち誤通知とKaizマルチの切り替えを含む確認事項は完了扱いとする。以下は今後の回帰確認手順として残す。

ビルド後に`pnpm test:version-guard`と`pnpm test:input`を実行する。版・プロトコル・nonceの欠落/不一致/誤型、不正JSON、過去応答の持ち越し、全8サーバーから9種の要求を実行前に拒否すること、版定数の整合を検証する。同期回帰はクライアントとサーバーを別DataMap/別VMに分け、50ms/300msの片道待機を模擬する。起動・切り替え直後の通知なし、応答前の送信拒否、5秒の境界、タイムアウト後の復帰、実不一致の拒否と通知、版広告より後のackを検証する。環境名はタイミング想定であり、AE/Kaiz実機テストの代用ではない。

### 2026-10-24の誤通知修正

提出clientログの13:40:20・13:40:29・13:40:51には、`client=0.4.0/1, server=0.4.0/1`で確認不能の通知がある。その後は生成・分割・移動などの成功が記録され、対応serverログにも生成成功がある。実際の版不一致ではなく、新しいnonceの応答待ちを即座に`version_unverified`として通知したものと整合する。

旧回帰は同じDataMap上でpublishを即時実行しており、通常の非同期往復と起動入力を検証できていなかった。現在は待機状態を区別し、上記の別DataMap同期回帰を追加した。全9ツールで共通処理を使うKaizPatchにも同じ条件が波及するため、両環境へ共通修正を適用する。Mod/JAR・参照ツールキットの変更は不要。

### include展開との互換性とCI

通常CIの[run 40063901380](https://github.com/hi03s/SuperRailBuilderX/actions/runs/40063901380)はビルド成功後、`test:rail-patch`の`unescaped Java replacement group reference`で失敗した。版照合の結果キー変換に使った正規表現の末尾記号が、RTMのinclude展開時のJava置換文字列として解釈されるためだった。SRBX側をsubstringと連結へ変更し、元のキー変換結果と拒否条件を維持した。読込実装や回帰テストの制約を緩める対処はしない。

全rendererのネストしたinclude展開を検証する`test:rail-patch`は継続必須。CIへ`test:version-guard`と、Java 8を使う`test:dedicated-server`・`test:model-lookup`を追加した。Java 25が必要な型生成とパッチビルドの後にJava 8へ切り替える。これは通常main CIの修正で、公開待ちDraft/タグ/Assetsの再生成ではない。

実機ではAE/Kaizの両側を同じ最新ZIPへ揃えて通常操作/Undo/切り替えを確認する。新サーバー+旧クライアント、新クライアント+旧サーバーでは編集できず、Qで終了できることを確認する。異常時は操作・時刻と`logs/latest-client.log`・`logs/latest-server.log`を提出する。
