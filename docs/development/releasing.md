# 正式リリース手順

GitHub Actionsは、`v`から始まるタグがpushされたときだけモデルパックと任意導入のKaiz用SRBXPatchをビルドし、ZIPと1 JARを添付したDraft Releaseを作成します。Releaseの公開は自動化していません。

## リリースする

1. package.json、rtmx.jsonのパック名、ツール内VERSION、READMEのバージョンを揃える。前回のリリースタグ以降の変更を確認し、リポジトリルートの`release-notes.md`を更新する。
2. `release-notes.md`を含むリリース対象の変更をmainへcommit・pushする。
3. mainのリリース対象コミットへ`vX.Y.Z`形式のタグを付ける。
4. `git push origin vX.Y.Z`でタグをpushする。
5. ローカルCodexはGitHub Actionsの「Build draft release」の起動を確認し、タグとActions URLを伝えて一旦作業を止める。GitHub側の生成待ち・進捗の繰り返し取得・Draft/Assets確認は行わない。
6. 開発者がActions結果、Draft Releaseの本文と添付ZIP・Kaiz用JARを確認し、手動でPublishする。
7. 開発者から手動Publishの報告を受けて、リリース作業を完了扱いにする。失敗や追加確認の依頼があった場合だけローカルCodexが調査を再開する。

`release-notes.md`はActionsで自動生成しません。リリース準備のたびに、前回のリリース以降の実装・修正だけが記載されていることを確認してください。

## 再実行

同じタグのDraft Releaseが存在する場合、workflowは本文とタイトルを更新し、同名のZIP・Kaiz用JARを置き換えます。公開済みReleaseが存在する場合は、安全のため変更せず失敗します。

## タグを誤ってpushした場合

workflowが実行中なら、まずGitHub Actions上で停止します。Draft Releaseが作成済みならGitHub上で削除し、誤ったリモートタグを`git push origin --delete vX.Y.Z`、ローカルタグを`git tag -d vX.Y.Z`で削除してください。修正をmainへ反映した後、正しいコミットへタグを付け直してpushします。公開済みReleaseのタグは移動せず、別バージョンとして修正リリースを作成してください。

0.4.0以降のAssetsはパックZIPと任意導入のKaiz用SRBXPatch 1.7.10 JAR。AE v2.5.4以降はパッチ不要のためAE用旧JARは添付しない。本文にAE v2.5.3以前との非互換、パックの両側導入、Kaizの走行補正用JARは任意で使用時は両側導入、SRBX未導入クライアントにはJAR不要を明記する。Draftを確認し、公開は手動Publishで行う。

配布ZIP名は`SuperRailBuilderX-vX.Y.Z.zip`。ローカルの開発ZIPは`SuperRailBuilderX-X.Y.Z.zip`として区別する。XCF編集データはソースに残し、配布ZIPからは除外する。
