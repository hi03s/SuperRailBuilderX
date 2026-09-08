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

AE commit `b6e0769`では従来のJitPack成果物なしの問題を通過できる。ただし2026-09-08のローカル検証では、`pnpm gen`がRetroFuturaGradleの`generateForgeSrgMappings`で、MCP snapshot `20171003`の`joined.exc`と`joined.srg`が存在しないため停止した。その結果AE typings・mappingsが生成されず、続く`pnpm build`も`generated/appleextended/mappings/mcp-to-srg.json`不在で失敗する。

## AE側に必要な追加対応

1. RetroFuturaGradleのタスク依存関係または対応Gradle構成を調整し、MCP snapshot `20171003`の`joined.exc`と`joined.srg`を`generateForgeSrgMappings`より前に生成する。
2. 道床の回収・再配置、RailMap再生成、保存、クライアント同期を一括で行う公開APIを用意する。
3. SRBXで自動分割レールを扱う場合は、論理RailMap、構成セクション一覧、論理レールの削除・再生成APIを用意する。

2がない現在の端点移動はAEのRailPositionとRailMapを直接更新する。大きな移動では既設道床の範囲外へ線形が出る可能性があるため、バックアップ済みワールドで小さいオフセットから検証する。
