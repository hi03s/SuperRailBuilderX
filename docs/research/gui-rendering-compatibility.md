# GUIの描画Mod互換性

> 2026-10-23 確認完了: 開発者から全動作の実機確認完了の報告を受領した。本資料中の過去の未確認・確認待ちと確認手順は当時の調査記録であり、現在の動作確認残件ではない。

## Angelica 2.2.34併用時のクラッシュ（2026-10-18）

`crash-2026-10-18_21.14.52-client.txt`では、生成AのGUI属性復元中に`GL13.glMultiTexCoord4f`が`IllegalStateException: Function is not supported`を送出した。Angelica 2.2.34が導入され、スタックにもAngelicaの描画経路がある。Distant Horizonsもログに現れるが、直接例外を起こしているのはSRBXの未対応GL関数呼び出し。

Angelica 2.2.34の公式実装を照合した。

- [GLSMRedirector](https://github.com/GTNewHorizons/Angelica/blob/2.2.34/glsm/src/main/java/com/gtnewhorizons/angelica/glsm/redirect/GLSMRedirector.java): `glMultiTexCoord2f`と`glTexCoord4f`は差し替え対象。`glMultiTexCoord4f`は対象外。
- [GLStateManager](https://github.com/GTNewHorizons/Angelica/blob/2.2.34/glsm/src/main/java/com/gtnewhorizons/angelica/glsm/GLStateManager.java): 基本テクスチャには4成分を保持するが、ライトマップの現在座標を取得するとS/TとR=0/Q=1を返す。`glMultiTexCoord2f`がそのライトマップ座標を復元する。

## SRBX側の対処

共通GUIの復元を次のように変更した。新しいバージョン固有APIやAngelica必須依存は追加していない。

1. 基本テクスチャ（unit 0）は`GL11.glTexCoord4f`で4成分を復元する。
2. R=0/Q=1の通常のライトマップは`GL13.glMultiTexCoord2f`で復元する。Angelicaでは対応済みの差し替え経路を通る。
3. 互換プロファイルで非標準のR/Qが使われている場合は既存の4成分復元を維持する。Angelica 2.2.34のライトマップ取得は常にR=0/Q=1なので、この経路には入らない。

画面の行列・テクスチャ・色・深度等を保存/復元する既存処理と、1.12.2のGlStateManagerキャッシュ同期は維持する。修正対象はSRBXパックであり、SRBXPatch JARは変更していない。

## 検証と残件

4成分multitexture関数が未対応例外を投げる状況をテストで再現し、対応済み関数だけで復元が完了することを確認した。従来の非標準4成分復元、GUIのON/OFF、描画中の例外・GLエラー、繰り返し復元、全ツールGUIとホイール、1.12.2キャッシュ同期も回帰確認した。全4ターゲットbuildとJava8 Nashorn実行は成功。

Angelica入りの実機で、各ツールGUIとTABホイールの開閉後にクラッシュがなく、レール・文字・明るさが正常であることを再確認する。問題が残る場合は操作順と`logs/latest.log`を保存する。生クラッシュレポートは再確認までローカル保持し、Gitには保存しない。
