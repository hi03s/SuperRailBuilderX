# SuperRailBuilderX

**Release: 0.3.0**

[![Minecraft](https://img.shields.io/badge/Minecraft-1.7.10-62b47a)](https://www.minecraft.net/)
[![KaizPatchX](https://img.shields.io/badge/KaizPatchX-1.10.3%2B-57b57b)](https://github.com/Kai-Z-JP/KaizPatchX)
[![AppleExtended](https://img.shields.io/badge/AppleExtended-v2.5.3-c96f4a)](https://github.com/Kirtmuna/AppleExtended/releases/tag/v2.5.3)
[![Release](https://img.shields.io/badge/release-0.3.0-blue)](https://github.com/hi03s/SuperRailBuilderX/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## 概要

SuperRailBuilderXは、KaizPatchX向けのレール制作支援ツール集です。レールの新規敷設、複線コピー、既設線の分割、端点・線形の移動、カント整形、分岐生成を自動車モデルとして収録しています。地面へ設置して右クリックすると使用できます。

## 重要な注意事項

> [!CAUTION]
> **使用前に、対象ワールドのバックアップを必ず取ってください。**
>
> このパックはレール、道床、RailPositionを撤去・再生成します。不具合や想定外の配置条件により、レールの消失、走行不能、ワールドデータの破損が発生する可能性があります。重要なワールドでバックアップなしに使用しないでください。

このパックの使用によって生じた損害や損失について、作者は責任を負いません。

## 動作環境

- Minecraft 1.7.10
- RealTrainModとKaizPatchX 1.10.4
- またはMinecraft 1.12.2とAppleExtended v2.5.3

主要機能はKaizPatchXとAppleExtended v2.5.3に対応しています。通常RTM 1.7.10およびMinecraft 1.12.2向けの共通コードもビルドされますが、非対応機能はワールドを変更せず安全に停止します。

AppleExtended v2.5.3では、通常・自動分割レールの生成、複線コピー、分割、移動、カント整形、分岐生成とUndoに対応しています。詳細は[AppleExtended target](docs/appleextended-target.md)を参照してください。

## 導入方法

SRBX 0.3.0は完全自由点仕様です。KaizPatchX 1.10.4 / AppleExtended v2.5.3側で対応されるまで、暫定パッチMod **SRBXPatch** を併用してください。JAR内にパックは含まれません。

1. KaizPatchX 1.10.4またはAppleExtended v2.5.3を導入します。
2. [Releases](https://github.com/hi03s/SuperRailBuilderX/releases)のAssetsから、SRBXパックZIPと環境に合うSRBXPatch JARをダウンロードします。
3. SRBXを導入するクライアントとサーバーの両方で、パックZIPとSRBXPatch JARをそれぞれmodsへ配置します。シングルプレイも両方を導入してください。
4. マルチプレイでクライアント側にSRBXパックを導入しない場合、そのクライアントにはSRBXPatchも不要です。サーバー側には導入してください。
5. 起動後、自動車モデル選択画面からSuperRailBuilderXで始まるツールを選びます。

| 環境 | SRBXPatch |
| --- | --- |
| Minecraft 1.7.10 / KaizPatchX 1.10.4 | SRBXPatch-v1.0-1.7.10.jar |
| Minecraft 1.12.2 / AppleExtended v2.5.3 | SRBXPatch-v1.0-1.12.2.jar |

[導入・確認手順](docs/srbx-free-endpoint-mod.md)も参照してください。
## 収録ツール

- **レール生成A** — 2点を選択してレールを新規敷設します。曲線半径、勾配、縦曲線、既設端点への接続に対応します。
- **複線コピーツール** — 既設レールを複数選択し、指定間隔で平行なレールを生成します。
- **線路分割ツール** — 既設レールを指定位置で2本へ分割します。
- **レール移動ツール** — 既設レールの端点移動、単体または複数レールの平行移動を行います。

共通操作は、右クリックが選択・確定、左クリックが1段階戻る、`Enter`が適用、`H`がヘルプ、`Q`が終了です。詳細は[ツール概要・操作ガイド](docs/usage.md)を参照してください。

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

技術仕様と検証資料は[`docs`](docs/)にあります。

## ライセンス

このプロジェクトは[MIT License](LICENSE)で公開されています。

Copyright (c) 2026 ひー@hi03
