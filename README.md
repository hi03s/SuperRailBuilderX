# SuperRailBuilderX

**Release: 1.0.0**

[![KaizPatchX](https://img.shields.io/badge/KaizPatchX-1.10.4%2B-57b57b)](https://github.com/Kai-Z-JP/KaizPatchX)
[![AppleExtended](https://img.shields.io/badge/AppleExtended-v2.5.4%2B-c96f4a)](https://github.com/Kirtmuna/AppleExtended/releases/tag/v2.5.4)
[![Release](https://img.shields.io/badge/release-1.0.0-blue)](https://github.com/hi03s/SuperRailBuilderX/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## 概要

SuperRailBuilderXは、KaizPatchXとAppleExtended向けのレール制作支援ツール集です。レールの新規敷設、複線コピー、組ホーム、既設線の分割、端点・線形の移動、カント整形、分岐・渡り線生成を行う9ツールを自動車モデルとして収録しています。地面へ設置して右クリックすると使用できます。

## 重要な注意事項

> [!CAUTION]
> **使用前に、対象ワールドのバックアップを必ず取ってください。**
>
> このパックはレール、道床、RailPositionを撤去・再生成します。不具合や想定外の配置条件により、レールの消失、走行不能、ワールドデータの破損が発生する可能性があります。重要なワールドでバックアップなしに使用しないでください。

このパックの使用によって生じた損害や損失について、作者は責任を負いません。

## 動作環境

- KaizPatchX 1.10.4+
- AppleExtended v2.5.4+

## 導入方法

**SRBX 1.0.0のAE向け実装はAppleExtended v2.5.4以降専用です。v2.5.3以前とは互換性がありません。AEを更新し、旧SRBXパックを削除してから1.0.0へ置き換えてください。**

1. 使用するKaizPatchXまたはAppleExtendedを導入します。
2. [Releases](https://github.com/hi03s/SuperRailBuilderX/releases)からSRBXパックZIPをダウンロードし、クライアントとサーバーの`mods`へ配置します。シングルプレイでは使用する環境の`mods`へ配置します。
3. KaizPatchXで自由端点の走行補正を使う場合は、SRBXPatchをクライアントとサーバーの両方へ追加します。ツールはパッチ未導入でも使用できます。
4. 起動後、自動車モデル選択画面からSuperRailBuilderXで始まるツールを選びます。

マルチプレイでは両側の旧パックを削除し、同じ最新のSRBXパックへ揃えてください。バージョンが不一致、または相手側のバージョンを確認できない場合は、編集・Undo・ツール切り替えを停止します。`Q`で終了できます。

| 環境                  | SRBXPatch                                                     |
| --------------------- | ------------------------------------------------------------- |
| KaizPatchX 1.10.4+    | 任意：自由端点の走行補正には`SRBXPatch-v1.0-1.7.10.jar`を使用 |
| AppleExtended v2.5.4+ | 不要                                                          |

[AppleExtended v2.5.4](https://github.com/Kirtmuna/AppleExtended/releases/tag/v2.5.4)では自由端点のレール遷移修正が本体へ取り込まれたため、SRBXPatchは不要です。

SRBXは両環境ともパッチなしでツールを実行できます。自由端点をまたぐ列車の走行は、使用するMod本体または追加した走行補正に依存します。

## 収録ツール

| ツール                                             | 機能                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| [レール生成A](docs/user-guide/builder1.md)         | 始点と終点を選び、曲線・勾配・縦曲線を含むレールを敷設します。             |
| [レール生成B](docs/user-guide/builder2.md)         | 始点を選び、設定した長さ・半径・勾配でレールを敷設します。                 |
| [複線コピー](docs/user-guide/double-track-copy.md) | 既設レールを選び、指定間隔で平行なレールを生成します。                     |
| [組ホーム](docs/user-guide/platform-builder.md)    | 線路に沿って左右どちらか1列へ、指定間隔・高さで手持ちモデルを敷設します。  |
| [線路分割](docs/user-guide/rail-splitter.md)       | 既設レールを指定位置で分割します。片渡り・シーサスの分岐にも対応します。   |
| [レール移動](docs/user-guide/rail-mover.md)        | 既設レールの端点移動や、単体・複数レールの平行移動を行います。             |
| [カント整形](docs/user-guide/cant-formatter.md)    | 設計速度と軌間からカントを計算し、選択したレールへ適用します。             |
| [分岐生成](docs/user-guide/branch-builder.md)      | 既設レールの途中から自由点や別レールの端点へ分岐を生成します。             |
| [渡り線生成](docs/user-guide/crossover-builder.md) | 自由始点や既設レールを基準に、片渡り線・シーサスクロッシングを生成します。 |

共通操作は、右クリックが選択・確定、左クリックが1段階戻る、`Enter`が適用、`H`がヘルプ、`Q`が終了です。`Tab`でツール切り替えホイールを開きます。各ツールの操作と制限は、上表の説明書を参照してください。

## 開発

```bash
pnpm install
pnpm gen
pnpm build
pnpm zip
```

- 共通コード: `src/common`
- KaizPatchX固有コード: `src/kaizpatch`
- multi-target設定: `rtmx.json`

説明書・開発手順・調査資料は[文書案内](docs/README.md)にあります。

## ライセンス

このプロジェクトは[MIT License](LICENSE)で公開されています。

Copyright (c) 2026 ひー@hi03
