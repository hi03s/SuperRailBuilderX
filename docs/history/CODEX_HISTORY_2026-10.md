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
