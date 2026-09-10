# AppleExtended target

SRBXはAppleExtended commit `ca255fd`を現在の対応基準とする。この版で利用できる`RailPosition.setPosition(x, y, z)`と永続化される`offsetX/Y/Z`を、通常レールの端点移動とUndoに使用する。

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

AE commit `ca255fd`ではJitPack向けpublicationが追加された。2026-09-10のローカル検証でJitPack成果物の解決、AE型スキャン、4ターゲットの`pnpm gen`と`pnpm build`が成功した。初回取得時にJitPackのHTTP 429とタイムアウトが発生したが、再試行で正常に取得できた。

## AE側に必要な追加対応

1. 道床の回収・再配置、RailMap再生成、保存、クライアント同期を一括で行う公開APIを用意する。
2. SRBXで自動分割レールを扱う場合は、論理RailMap、構成セクション一覧、論理レールの削除・再生成APIを用意する。

1がない現在の端点移動はAEのRailPositionとRailMapを直接更新する。大きな移動では既設道床の範囲外へ線形が出る可能性があるため、バックアップ済みワールドで小さいオフセットから検証する。
