# 正式リリース手順

GitHub Actionsは、`v`から始まるタグがpushされたときだけモデルパックをビルドし、配布ZIPを添付したDraft Releaseを作成します。Releaseの公開は自動化していません。

## リリースする

1. 前回のリリースタグ以降の変更を確認し、リポジトリルートの`release-notes.md`を更新する。
2. `release-notes.md`を含むリリース対象の変更をmainへcommit・pushする。
3. mainのリリース対象コミットへ`vX.Y.Z`形式のタグを付ける。
4. `git push origin vX.Y.Z`でタグをpushする。
5. GitHub Actionsの「Build draft release」が成功したことを確認する。
6. GitHub上でDraft Releaseの本文と添付ZIPを確認し、問題がなければ手動でPublishする。

`release-notes.md`はActionsで自動生成しません。リリース準備のたびに、前回のリリース以降の実装・修正だけが記載されていることを確認してください。

## 再実行

同じタグのDraft Releaseが存在する場合、workflowは本文とタイトルを更新し、同名のZIPを置き換えます。公開済みReleaseが存在する場合は、安全のため変更せず失敗します。

## タグを誤ってpushした場合

workflowが実行中なら、まずGitHub Actions上で停止します。Draft Releaseが作成済みならGitHub上で削除し、誤ったリモートタグを`git push origin --delete vX.Y.Z`、ローカルタグを`git tag -d vX.Y.Z`で削除してください。修正をmainへ反映した後、正しいコミットへタグを付け直してpushします。公開済みReleaseのタグは移動せず、別バージョンとして修正リリースを作成してください。
