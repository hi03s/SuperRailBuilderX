# Codex作業履歴 2026-10

## 2026-10-03 ローカルCodex: AE v2.5.3対応とmain統合

- AE正式タグv2.5.3（6f74d99）を従来基準9df86c2と比較。生成・論理レール・移設・NBT APIのシグネチャは維持され、最小Section長2 mとポイント転換APIが追加されている。
- JitPackの新旧座標は取得タイムアウト。公式dev JARへ切り替え、Groovy 2.4.15とともにSHA-256を確認してキャッシュする前処理を追加。
- rtm-ts 0.12.0へscan.extraJarsのpnpmパッチを追加。MCP名の公式dev JARを標準依存より先にロードし、AEの型定義を生成する。JARはGit・配布物へ同梱しない。
- AE対応単体でpnpm genとpnpm buildが全4ターゲット成功。実機検証は未実施。Section group移設APIは引き続き存在しないため、自動分割レール移動のガードを維持する。
