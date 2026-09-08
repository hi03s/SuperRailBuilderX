# SuperRailBuilderX

**Release: alpha-0.1.0**

[![Minecraft](https://img.shields.io/badge/Minecraft-1.7.10-62b47a)](https://www.minecraft.net/)
[![KaizPatchX](https://img.shields.io/badge/KaizPatchX-1.10.3%2B-57b57b)](https://github.com/Kai-Z-JP/KaizPatchX)
[![AppleExtended](https://img.shields.io/badge/AppleExtended-74fe2ed_experimental-c96f4a)](https://github.com/ringo-1234/AppleExtended/commit/74fe2edd938bacbdb619bc0ccb9542f37857d054)
[![Release](https://img.shields.io/badge/release-alpha--0.1.0-orange)](https://github.com/hi03s/SuperRailBuilderX/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## 概要

SuperRailBuilderXは、KaizPatchX向けのレール制作支援ツール集です。レールの新規敷設、複線コピー、既設線の分割、端点・線形の移動、カント整形、分岐生成を自動車モデルとして収録しています。地面へ設置して右クリックすると使用できます。

本バージョンは開発途中のアルファ版です。

## 重要な注意事項

> [!CAUTION]
> **使用前に、対象ワールドのバックアップを必ず取ってください。**
>
> このパックはレール、道床、RailPositionを撤去・再生成します。不具合や想定外の配置条件により、レールの消失、走行不能、ワールドデータの破損が発生する可能性があります。重要なワールドでバックアップなしに使用しないでください。

このパックの使用によって生じた損害や損失について、作者は責任を負いません。

## 動作環境

- Minecraft 1.7.10
- RealTrainModとKaizPatchX 1.10.3以降

レール生成・移動などの主要機能はKaizPatchX専用です。通常RTM 1.7.10およびMinecraft 1.12.2向けの共通コードもビルドされますが、非対応機能はワールドを変更せず安全に停止します。

AppleExtended `74fe2ed`向け対応は実験段階です。通常レールの端点移動とUndoだけを有効化し、道床再生成を必要とする機能は安全のため無効化しています。詳細は[AppleExtended target](docs/appleextended-target.md)を参照してください。

## 導入方法

1. RealTrainModとKaizPatchXを導入します。
2. [Releases](https://github.com/hi03s/SuperRailBuilderX/releases)から配布パックをダウンロードします。
3. ダウンロードしたパックをMinecraftの`mods`フォルダーへ入れます。
4. 起動後、自動車モデル選択画面から`レール生成A`または`SuperRailBuilderX`で始まるツールを選びます。

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
- AppleExtended固有コード: `src/appleextended`
- multi-target設定: `rtmx.json`

技術仕様と検証資料は[`docs`](docs/)にあります。

## ライセンス

このプロジェクトは[MIT License](LICENSE)で公開されています。

Copyright (c) 2026 ひー@hi03
