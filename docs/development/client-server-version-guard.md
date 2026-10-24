# クライアント・サーバーのSRBX版照合

## 判定と動作

`SRBXVersionGuard`を全ターゲットで共用する。SRBXの版文字列と要求プロトコルが完全一致した場合だけ処理する。片側の版が不明でも許可しない。KaizPatchX・AEのModバージョンを判定する機能ではない。

サーバーはツールのDataMapへ`srbxServerVersion`と`srbxServerProtocol`を公開する。クライアントはDataMapごとにUUIDを生成し、`srbxVersionChallenge`へ書く。現在のサーバーが`srbxVersionAck`へ応答したことも照合する。クライアント側のUUIDはWeakHashMapで保持し、保存済みの版広告・応答を新しい接続で再利用しない。旧版から残る`VERSIONS`は照合に使わない。

クライアントの共通ホイール入口で、不一致・確認前の入力とプレビュー処理を止める。Qによる終了と既存のホスト管理は維持する。確認できないまま操作した場合や不一致時は、両側の版と更新案内をチャット/NGTLogへ出し、同じ通知を毎フレーム繰り返さない。

各要求には`srbxVersion`・`srbxProtocol`・`srbxNonce`を付ける。全サーバーツールが呼ぶ`SRBXToolSwitchServer.update`で、業務要求を解釈・実行する前に照合する。nonceはDataMapのchallengeとackの両方に一致する必要がある。8種類の編集要求（Undoを含む）とツール切り替えが対象。切り替えも単なるモデル名ではなく、版付きJSON要求とする。

拒否時は該当要求と前回のクライアント更新情報を消し、対応結果へ`version_mismatch`または`version_unverified`を設定する。ログとチャットへ理由・両側の版を記録し、そのtickの編集処理を終了する。確認済み状態を使い回して後続の版なし要求を許可することはない。

## 適用範囲と更新

新サーバーは旧クライアントの版なし要求を拒否し、新クライアントは応答のない旧サーバーへ編集要求を送らない。両側が旧版の場合に、この保護を後付けすることはできない。同じ版表記のまま作成された過去の開発ZIPも識別できないため、確認時は必ず両側を同じ最新ZIPに交換し再起動する。これは互換性の確認機構で、改造クライアントの認証機構ではない。

リリース時は`SRBX_LOCAL_VERSION`をpackage.json/各VERSIONと揃える。要求の互換性を変えるときは`SRBX_LOCAL_PROTOCOL`も更新する。現在は0.4.0 / protocol 1。rtm-ts・参照ツールキット・Mod/JARの改変は不要。

## 検証

ビルド後に`pnpm test:version-guard`と`pnpm test:input`を実行する。版・プロトコル・nonceの欠落/不一致/誤型、不正JSON、過去応答の持ち越し、全8サーバーから9種の要求を実行前に拒否すること、版定数の整合を検証する。

実機ではAE/Kaizの両側を同じ最新ZIPへ揃えて通常操作/Undo/切り替えを確認する。新サーバー+旧クライアント、新クライアント+旧サーバーでは編集できず、Qで終了できることを確認する。異常時は操作・時刻と`logs/latest-client.log`・`logs/latest-server.log`を提出する。
