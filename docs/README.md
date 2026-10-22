# 文書案内

## ツール説明書

- 導入方法・動作環境は[トップREADME](../README.md)を参照してください。
- [レール生成A](user-guide/builder1.md)・[レール生成B](user-guide/builder2.md)
- [線路分割](user-guide/rail-splitter.md)・[複線コピー](user-guide/double-track-copy.md)
- [レール移動](user-guide/rail-mover.md)
- [組ホーム](user-guide/platform-builder.md)
- [渡り線生成](user-guide/crossover-builder.md)
- [カント整形](user-guide/cant-formatter.md)・[分岐生成](user-guide/branch-builder.md)

## 開発と調査

- [現在の状態・残件](CODEX_HANDOFF.md)
- [正式リリース手順](development/releasing.md)
- [AEターゲット](development/appleextended-target.md)
- [共通のレール生成と自由点処理](development/rail-generation-and-free-positioning.md)
- [各ツールの実装情報](development/rail-tool-implementation.md)
- [SRBXPatchの実装・ビルド・探索性能](development/srbxpatch.md)
- [AE側での再実装用：自由端点・重複レールの走行先判定設計](development/appleextended-rail-resolution-design.md)
- [自由端点・台車遷移・実装意図の統合調査](research/rail-transition-research.md)
- [道床所有先・保存API・CrossTie診断](research/roadbed-ownership-investigation.md)
- [AEの重複区間と自動分割境界](research/appleextended-overlap-rail-patch.md)
- [カント付きカーブの段差・描画の乱れ（Issue #2）](research/cant-curve-rendering.md)
- [GUIの描画Mod互換性](research/gui-rendering-compatibility.md)
- [Issue #3: 旧NGTOBuilder2同居時のツール起動クラッシュ](research/issue3-multiplayer-tool-crash.md)
- [KaizPatchの片渡り判定・ワールド終了時描画の不具合](research/kaizpatch-crossover-and-render-errors.md)
- [作業履歴](history)

`user-guide/`には各ツールの説明書だけを配置します。各説明書は「使い方」「操作」「設定と動作」「制限」の順に揃えています。内部仕様は開発資料、調査結果・実機確認は調査資料と引継ぎ帳へ記載します。
