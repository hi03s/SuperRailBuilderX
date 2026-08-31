//importのパスはプロジェクトの構成に合わせて適切に変更してください
import { NGTLog } from "jp.ngt.ngtlib.io";
import { MCWrapperClient, NGTUtilClient } from "jp.ngt.ngtlib.util";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ModelSetVehicle } from "jp.ngt.rtm.modelpack.modelset";
import { ModelObject, Parts, VehiclePartsRenderer } from "jp.ngt.rtm.render";
import { ICommandSender } from "net.minecraft.command";
import { EntityPlayer } from "net.minecraft.entity.player";
import { Keyboard, Mouse } from "org.lwjgl.input";
import {
	NGTOBuilderUtilClient,
	Pos,
} from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtilClient";
import { PositionCollector } from "../lib_hi03toolkit_1_0/lib_PositionCollector";
import { RTMApiCompat } from "@target/assets/minecraft/scripts/lib_hi03toolkit_1_0/lib_RTMApiCompat";
import { GL11 } from "org.lwjgl.opengl";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import { InputManager } from "../lib_hi03toolkit_1_0/lib_InputManager";
import { ReceiveData_test } from "./server_sampleScript";
declare const renderer: VehiclePartsRenderer;

//#################################
//##  hi03式エディターツール v1.0  ##
//#################################
/*
NGTO BuilderやSuperRailBuilder3のような自動車モデル型のエディターツールの雛形です
キー入力はクライアント側で行い、ブロック変更などのワールド処理はサーバー側が担当します
不要なコメントアウトはすべて消してください
テスト用の機能が記述されているので、不要な部分は消してください
*/

//バージョンチェック
//クライアント側とバージョンチェックを行います ※一致していなくても利用自体はできます
const Version = "2.3";

//#################
//##  初期化処理  ##
//#################

//## グローバル変数として使うための準備 ##
let keyManager: InputManager;
let collector: PositionCollector;
function init(par1: ModelSetVehicle, par2: ModelObject): void {
	keyManager = new InputManager();

	//###################
	//##  ユーザー設定  ##
	//###################
	keyManager.setOptionKey(Keyboard.KEY_LCONTROL); //オプションキーに使用するキー
	keyManager.register("showHelp", Keyboard.KEY_H, false, `ヘルプを表示`);
	keyManager.register("endEdit", Keyboard.KEY_Q, false, `ツールを終了`);
	keyManager.register("build", Keyboard.KEY_RETURN, false, `生成する`);
	keyManager.register(
		"cancelBuild",
		Keyboard.KEY_BACK,
		true,
		`生成を中止する`,
	);
	keyManager.register("undo", Keyboard.KEY_Z, true, `Undo`);

	//keyManager.registerの書き方
	//keyManager.register("ID", キーコード, オプションキーを使用するかどうか, "説明文");

	//-------------------
	//--  ユーザー設定  --
	//-------------------

	collector = new PositionCollector(); //座標を収集するためのクラスのインスタンスを作成
	initParts();
}

//###################
//##  キー入力処理  ##
//###################
function keyInput(
	hostPlayer: EntityPlayer,
	entity: EntityVehicle,
	isRightClick: boolean,
	isLeftClick: boolean,
): void {
	const sender = hostPlayer as unknown as ICommandSender;
	const dataMap = entity.getResourceState().getDataMap();

	//keyManagerの使い方
	//keyManager.pressed("ID")で、IDに登録したキーが押された瞬間を検知できます
	//keyManager.down("ID")で、IDに登録したキーが押されている間を検知できます
	//keyManager.held("ID", ミリ秒)で、IDに登録したキーが指定した時間押されている間を検知できます
	//keyManager.released("ID")で、IDに登録したキーが離された瞬間を検知できます

	//ヘルプ表示
	if (keyManager.pressed("showHelp")) {
		NGTLog.sendChatMessage(
			sender,
			`---NGTO Builder2 テスト機能 操作方法---`,
		);
		NGTLog.sendChatMessage(sender, keyManager.getDescription("endEdit"));
		NGTLog.sendChatMessage(sender, keyManager.getDescription("build"));
		NGTLog.sendChatMessage(
			sender,
			keyManager.getDescription("cancelBuild"),
		);
		NGTLog.sendChatMessage(sender, keyManager.getDescription("undo"));
		NGTLog.sendChatMessage(sender, `[右クリック] 座標を選択`);
		NGTLog.sendChatMessage(sender, `[左クリック] 最後の選択を解除`);
		NGTLog.sendChatMessage(
			sender,
			`[NGTO Builder2] チャット欄を開き、上へスクロールするとすべての操作説明を確認できます。`,
		);
	}

	//ツールを終了
	if (keyManager.down("endEdit")) {
		dataMap.setBoolean("isEndEdit", true, 1);
	}

	//生成する
	const isBuilding = dataMap.getBoolean("isBuilding");
	const isUndo = dataMap.getBoolean("isUndo");
	if (
		keyManager.pressed("build") &&
		collector.size(entity) > 0 &&
		!isBuilding &&
		!isUndo
	) {
		dataMap.setBoolean("isBuilding", true, 1);
		//送り先のReceiveData_testの型に合わせてデータを送る ※ここでは座標の配列を送っています
		const sendData: ReceiveData_test = {
			pos: collector.getAll(entity) as Pos[],
		};
		NGTOBuilderUtil.sendJsonData(dataMap, "sendData", sendData);
		NGTLog.sendChatMessage(sender, `[NGTO Builder2] 生成中...`);
	}

	//生成を中止する
	if (keyManager.pressed("cancelBuild") && isBuilding) {
		NGTLog.sendChatMessage(sender, `[NGTO Builder2] 生成を中止`);
		dataMap.setBoolean("cancelBuild", true, 1);
	}

	//Undo
	const canUndo = dataMap.getBoolean("canUndo");
	if (keyManager.pressed("undo") && canUndo && !isBuilding && !isUndo) {
		dataMap.setBoolean("isUndo", true, 1);
		NGTLog.sendChatMessage(sender, "[NGTO Builder2] Undo...");
	}
}

//#################
//##  パーツ登録  ##
//#################

//## グローバル変数として使うための準備 ##
let body: Parts;
let point: Parts;
let selected: Parts;
function initParts(): void {
	//## 描画パーツの設定 ##
	body = renderer.registerParts(new Parts("body")); //本体の描画に使用するパーツ
	point = renderer.registerParts(new Parts("point")); //カーソルの描画に使用するパーツ
	selected = renderer.registerParts(new Parts("selected")); //選択済み座標の描画に使用するパーツ
}

//############
//##  描画  ##
//############
//使用中のプレイヤーでの描画
function renderForToolUser(
	entity: EntityVehicle,
	pass: number,
	par3: number,
): void {
	const dataMap = entity.getResourceState().getDataMap();
	const lookingPos = NGTOBuilderUtilClient.getLookingPos(par3);
	const [posX, posY, posZ] = NGTOBuilderUtilClient.getInterpolatedPos(
		entity,
		par3,
	);
	const player = MCWrapperClient.getPlayer();
	const isBuilding = dataMap.getBoolean("isBuilding");
	const isUndo = dataMap.getBoolean("isUndo");

	//本体
	body.render(renderer);

	//カーソル
	if (lookingPos) {
		GL11.glPushMatrix();
		GL11.glTranslatef(
			lookingPos.blockX + 0.5,
			lookingPos.blockY + 0.5,
			lookingPos.blockZ + 0.5,
		);
		GL11.glTranslatef(-posX, -posY, -posZ);
		point.render(renderer);
		GL11.glPopMatrix();
	}

	//選択済み座標
	const posList = collector.getAll(entity); //選択されている座標のリストを取得
	for (let i = 0; i < posList.length; i++) {
		const pos = posList[i];
		GL11.glPushMatrix();
		GL11.glTranslatef(pos[0] + 0.5, pos[1] + 0.5, pos[2] + 0.5);
		GL11.glTranslatef(-posX, -posY, -posZ);
		selected.render(renderer);
		GL11.glPopMatrix();
	}
}

//他のプレイヤーでの描画
function renderForOtherUser(
	entity: EntityVehicle,
	pass: number,
	par3: number,
): void {
	//※他のプレイヤーには選択用のカーソルや選択済み座標は見せない想定なので、ここでは本体のみ描画しています

	//本体
	body.render(renderer);
}

//モデル選択画面での描画
function renderInMenu(): void {
	body.render(renderer);
}

//#################################
//#################################
function render(entity: EntityVehicle, pass: number, par3: number): void {
	if (!entity) {
		renderInMenu();
		return;
	}
	const dataMap = entity.getResourceState().getDataMap();
	const isOpenGUI = NGTUtilClient.getMinecraft().currentScreen !== null;
	const world = RTMApiCompat.getWorld(entity);
	const player = MCWrapperClient.getPlayer();
	const hostPlayerEntityId = dataMap.getString("hostPlayerEntityId");
	let hostPlayer = null;
	if (hostPlayerEntityId !== "")
		hostPlayer = world.getEntityByID(
			Number(hostPlayerEntityId),
		) as unknown as EntityPlayer;
	const prevIsLeftClick = dataMap.getBoolean("prevIsLeftClick");
	const prevIsRightClick = dataMap.getBoolean("prevIsRightClick");
	if (hostPlayer === null) {
		dataMap.setBoolean("showHelpMessage", false, 0);
		if (!prevIsLeftClick) dataMap.setBoolean("prevIsLeftClick", true, 0);
		if (!prevIsRightClick) dataMap.setBoolean("prevIsRightClick", true, 0);
		renderForOtherUser(entity, pass, par3);
		return;
	}
	const sender = hostPlayer as unknown as ICommandSender;
	const isLeftClick = Mouse.isButtonDown(0);
	const isRightClick = Mouse.isButtonDown(1);
	const VERSIONS_server = dataMap.getString("VERSIONS");
	const isVersionChecked = dataMap.getBoolean("isVersionChecked");
	RTMApiCompat.doFollowing(entity, hostPlayer); //1.12用
	if (hostPlayer && hostPlayer === player) {
		if (isLeftClick !== prevIsLeftClick)
			dataMap.setBoolean("prevIsLeftClick", isLeftClick, 0);
		if (isRightClick !== prevIsRightClick)
			dataMap.setBoolean("prevIsRightClick", isRightClick, 0);
		if (renderer.currentMatId === 0 && pass === 0) keyManager.update();
		if (
			VERSIONS_server !== "" &&
			VERSIONS_server != Version &&
			!isVersionChecked
		) {
			dataMap.setBoolean("isVersionChecked", true, 0);
			NGTLog.sendChatMessage(sender, `§cVersions don't match!`);
			NGTLog.sendChatMessage(sender, `§cClient: ${Version}`);
			NGTLog.sendChatMessage(sender, `§cServer: ${VERSIONS_server}`);
		}
		const showHelpMessage = dataMap.getBoolean("showHelpMessage");
		if (!showHelpMessage) {
			dataMap.setBoolean("showHelpMessage", true, 0);
			NGTLog.sendChatMessage(
				sender,
				keyManager.getDescription("showHelp"),
			);
		}
		if (!isOpenGUI && pass === 0 && renderer.currentMatId === 0)
			keyInput(
				hostPlayer,
				entity,
				!prevIsRightClick && isRightClick,
				!prevIsLeftClick && isLeftClick,
			);
		renderForToolUser(entity, pass, par3);
	}
}
