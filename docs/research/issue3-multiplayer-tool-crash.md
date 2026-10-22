# Issue #3: マルチプレイでツール起動時にクラッシュする報告

調査日: 2026-10-22、担当: ローカルCodex。
対象: [Issue #3](https://github.com/hi03s/SuperRailBuilderX/issues/3)と添付クラッシュレポート。

## 現在の判断と対応

まず同居している旧NGTOBuilder2.1を削除し、[NGTOBuilder2 2.3.2](https://github.com/hi03s/NGTOBuilder2/releases/tag/v2.3.2)へ置き換えて再確認する。
旧版の共有ツールキットがSRBX側より優先して読み込まれると、SRBXのカーソル描画で必要な関数がなくなり、報告に一致するTypeErrorを説明できる。
NGTOBuilder2 2.3.2の配布ZIPには当該関数が含まれ、未変更のSRBX 0.3.2のカーソル描画との組み合わせをJava 8で検証できた。
報告者の環境で実際に選択されたリソースと、更新後の実機解消は未確認である。

開発者の追加指示に従い、更新案内を優先する。SRBX専用ヘルパーへ移す試作は取り下げ、SRBXのソース・配布ZIPは変更しない。rtm-ts・参照専用ツールキット・JAR・パッチModも変更しない。

## 根拠

- 報告環境はSRBX 0.3.2、Minecraft 1.12.2、AppleExtended 2.5.3、マルチプレイ。
- クラッシュレポートのモデルパック一覧に`NGTOBuilder2.1.zip`と`SuperRailBuilderX-v0.3.2.zip`が同居している。
- 例外は`Rendering entity in world` → `render_builder1.js` → `renderAt` → `TypeError: Cannot call undefined`。サーバーのワールド変更処理ではない。
- 未変更のSRBX 0.3.2の`renderAt`は、冒頭で`NGTOBuilderUtilClient.getInterpolatedPos(entity, partialTicks)`を呼ぶ。その後はGL行列操作とParts描画を行う。
- 参照用ローカル旧1.12版NGTOBuilder2の`lib_NGTOBuilderUtilClient.ts`には`getInterpolatedPos`がない。SRBXと同じ`minecraft:scripts/lib_hi03toolkit_1_0/lib_NGTOBuilderUtilClient.js`というリソース名を使用する。
- AE 2.5.3の`ModelPackManager.loadScript`のバイトコードを参照し、includeをリソース名から読み込み、スクリプト文字列へ展開することを確認した。JARの書き換えは行っていない。
- GitHubの最新正式版はNGTOBuilder2 2.3.2。ローカル配布ZIPのSHA-256が公開Assetのdigestと一致したため、そのZIPを展開して関数の存在を確認した。
  - SHA-256: `dcf71383ef17bd66c9c21547ae1a5cd0304573990cecaf514bf02f1dcef14f98`

## 検証結果

- Java 8 Nashornで配布済みSRBX 0.3.2の`renderAt`をそのまま実行した。補間関数のない旧APIを模した状態ではTypeErrorを再現した。
- 同じ実行環境に、NGTOBuilder2 2.3.2の配布ZIPから取得した補間関数を設定すると、同じ`renderAt`が成功した。移動中の座標補間・原点変換とParts描画の実行も確認した。
- これは抽出した描画関数の検証であり、報告者の全パック構成やMinecraft上のマルチプレイを再現した試験ではない。クラッシュレポートの展開後行番号だけから、報告者が読み込んだ関数を確定したわけではない。
- 試作したSRBX専用実装では全4ターゲットbuild・GUI回帰・dispatch/描画互換回帰が成功したが、更新案内を優先するためコードは取り下げた。最終成果物は調査文書のみ。
- クラッシュ添付は調査用`.cache/issue3/`へ取得し、Gitには含めない。IDEで開かれていた`logs/latest.log`は別件のAE生成ログで、今回のクラッシュを示すものではないため変更・削除していない。

## 開発者から報告者へ案内する手順

1. サーバーと参加クライアントのMinecraftを終了する。
2. NGTOBuilder2.1の旧ZIPを取り除き、NGTOBuilder2 2.3.2のZIPへ置き換える。旧版・展開済みフォルダー・別名コピーを併存させない。まずサーバーと報告者のクライアント双方を揃える。
3. SRBXは0.3.2、AEは2.5.3を維持し、再起動してサーバーへ参加する。
4. 生成Aを設置・右クリックし、視線先カーソル、右クリック選択、左クリックで戻る、Q終了を確認する。続いて他のSRBXツールの起動・カーソル描画も確認する。
5. 更新だけで解消すれば、旧NGTOBuilder2との共有リソース競合として結果を引継ぎ帳へ反映する。

再発時は、起動からクラッシュまでの新しいクライアント`latest.log`とクラッシュレポート、サーバー/クライアント双方のNGTOBuilder2・SRBXの正確なZIP名、操作順と時刻を開発者へ提出してもらう。開発者は調査用ファイルをローカルの`logs/`へ格納してこのチャットで知らせる。生ログをGitやIssueコメントへ自動投稿しない。

新しいレポートでも同じ未定義関数が残る場合は、別パックによる同名ツールキットの供給を再調査する。まずローカルの試験環境でNGTOBuilder2とSRBXだけに絞り、本番サーバーのワールドを変更しない。
