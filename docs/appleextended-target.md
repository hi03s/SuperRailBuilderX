# AppleExtended target

SRBXはAppleExtended commit `b6e0769`を現在の対応基準とする。この版で利用できる`RailPosition.setPosition(x, y, z)`と永続化される`offsetX/Y/Z`を、通常レールの端点移動とUndoに使用する。

## 対応範囲

- 通常レールのRailPosition端点移動、クライアント同期、Undo
- AE固有APIの型生成を検査するcompile-onlyサンプル
- `Loader.isModLoaded("appleextended")`による`mc1122`より優先した実行時選択
- その他の差分がない1.12.2処理は`compatFallbackTarget: "mc1122"`を利用

現時点のAEにはKaizPatchXの自動分割レールAPIがない。通常レール生成、複数レール平行移動、分割、複線コピー、カント整形、分岐生成は、既存の`mc1122`安全スタブへフォールバックして無効のままとする。

## ビルド確認

```sh
pnpm gen
pnpm build
```

`src/appleextended/.../appleextended_build_test.ts`は実行用スクリプトではなく、AEの`setPosition`とoffsetフィールドが型スキャンされたことを確認するサンプルである。

AEターゲットのMCP mappingsは、同じMinecraft 1.12.2環境の`mc1122`ターゲットと同じ`stable/39`を使用する。`snapshot/20171003`ではRetroFuturaGradleの`generateForgeSrgMappings`が、存在しない`joined.exc`と`joined.srg`を入力として要求して停止する。

2026-09-08のローカル検証では、この変更によりMCP mapping生成は通過した。その後、AE commit `b6e0769`のJitPack依存が`No build artifacts found`のため解決できず、`pnpm gen`はAE型スキャン前に停止した。JitPack上ではAE本体のGradleビルドは成功しているが、ルートの`publishToMavenLocal`に公開処理がなく、期待されるMaven成果物が生成されていない。

## AE側に必要な追加対応

1. JitPackから依存解決できるように`maven-publish`とpublicationを設定し、`publishToMavenLocal`でMaven成果物を生成する。
2. 道床の回収・再配置、RailMap再生成、保存、クライアント同期を一括で行う公開APIを用意する。
3. SRBXで自動分割レールを扱う場合は、論理RailMap、構成セクション一覧、論理レールの削除・再生成APIを用意する。

2がない現在の端点移動はAEのRailPositionとRailMapを直接更新する。大きな移動では既設道床の範囲外へ線形が出る可能性があるため、バックアップ済みワールドで小さいオフセットから検証する。
