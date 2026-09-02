import { NGTLog } from "jp.ngt.ngtlib.io";
import { MCWrapperClient, NGTUtilClient } from "jp.ngt.ngtlib.util";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ModelSetVehicle } from "jp.ngt.rtm.modelpack.modelset";
import { ModelObject, Parts, VehiclePartsRenderer } from "jp.ngt.rtm.render";
import {
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
} from "jp.ngt.rtm.rail";
import { RailPosition } from "jp.ngt.rtm.rail.util";
import { ICommandSender } from "net.minecraft.command";
import { EntityPlayer } from "net.minecraft.entity.player";
import { WeakHashMap } from "java.util";
import { Keyboard, Mouse } from "org.lwjgl.input";
import { GL11 } from "org.lwjgl.opengl";
import { ErrorLogger } from "../lib_hi03toolkit_1_0/lib_ErrorLogger";
import { InputManager } from "../lib_hi03toolkit_1_0/lib_InputManager";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import { NGTOBuilderUtilClient } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtilClient";
import {
	SRBXApiCompat,
	SRBXBuilderPoint,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath, SRBXVec3 } from "./SRBXMath";
import { Builder1Request } from "./server_builder1";

declare const renderer: VehiclePartsRenderer;

const ENDPOINT_SEARCH_RADIUS = 0.8;
const SELECTED_LINE_MODEL_LENGTH = 0.6225;

type BuilderState = {
	selected: SRBXBuilderPoint[];
	lastBuiltSelection: SRBXBuilderPoint[] | null;
	snapEnabled: boolean;
	snapAngleIndex: number;
	awaitingResult: boolean;
	pendingAction: "create" | "undo" | null;
};

type RailCandidate = {
	point: SRBXBuilderPoint;
	distanceSquared: number;
};

let keys: InputManager;
let body: Parts;
let selectCursor: Parts;
let selectCursorMarker: Parts;
let selectedCursor: Parts;
let selectedLine: Parts;
let directionMarkers: Parts[];
const snapAngles = [1, 5, 15];
const states: WeakHashMap<EntityVehicle, BuilderState> = new WeakHashMap();
const loggedScanErrors: { [key: string]: boolean } = {};

function init(par1: ModelSetVehicle, par2: ModelObject): void {
	void par1;
	void par2;
	keys = new InputManager();
	keys.setOptionKey(Keyboard.KEY_LCONTROL);
	keys.register("help", Keyboard.KEY_H, false, "ヘルプを表示");
	keys.register("exit", Keyboard.KEY_Q, false, "ツールを終了");
	keys.register("build", Keyboard.KEY_RETURN, false, "レールを生成");
	keys.register("clear", Keyboard.KEY_C, false, "選択を全解除");
	keys.register("snap", Keyboard.KEY_P, false, "スナップON/OFF");
	keys.register("snapAngle", Keyboard.KEY_P, true, "スナップ角度を変更");
	keys.register("undo", Keyboard.KEY_Z, true, "直前の生成を取り消す");
	body = renderer.registerParts(new Parts("body"));
	selectCursor = renderer.registerParts(new Parts("selectCursor"));
	selectCursorMarker = renderer.registerParts(
		new Parts("selectCursorMarker"),
	);
	selectedCursor = renderer.registerParts(new Parts("selectedCursor"));
	selectedLine = renderer.registerParts(new Parts("selectedLine"));
	directionMarkers = [];
	for (let i = 0; i < 8; i++)
		directionMarkers.push(renderer.registerParts(new Parts(`marker${i}`)));
}

function getState(entity: EntityVehicle): BuilderState {
	let state = states.get(entity);
	if (!state) {
		state = {
			selected: [],
			lastBuiltSelection: null,
			snapEnabled: false,
			snapAngleIndex: 1,
			awaitingResult: false,
			pendingAction: null,
		};
		states.put(entity, state);
	}
	return state;
}

function copyPoint(point: SRBXBuilderPoint): SRBXBuilderPoint {
	return {
		kind: point.kind,
		position: [point.position[0], point.position[1], point.position[2]],
		direction: point.direction,
		anchorYaw: point.anchorYaw,
		anchorPitch: point.anchorPitch,
		core: point.core
			? [point.core[0], point.core[1], point.core[2]]
			: undefined,
		index: point.index,
	};
}

function getCursorPosition(
	partialTicks: number,
	snapEnabled: boolean,
): SRBXVec3 | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return null;
	return SRBXMath.roundPosition(
		[looking.posX, looking.posY, looking.posZ],
		snapEnabled ? 0.5 : 0.001,
	);
}

function logScanErrorOnce(
	phase: string,
	x: number,
	y: number,
	z: number,
	error: unknown,
): void {
	const key = `${phase}:${x},${y},${z}`;
	if (loggedScanErrors[key]) return;
	loggedScanErrors[key] = true;
	ErrorLogger.log("SuperRailBuilderX builder1", phase, error, { x, y, z });
}

function findRailCandidate(
	entity: EntityVehicle,
	partialTicks: number,
): SRBXBuilderPoint | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return null;
	const world = SRBXApiCompat.getWorld(entity);
	const seen: { [key: string]: boolean } = {};
	let nearest: RailCandidate | null = null;
	const centerX = Math.floor(looking.posX);
	const centerY = Math.floor(looking.posY);
	const centerZ = Math.floor(looking.posZ);
	for (let x = centerX - 2; x <= centerX + 2; x++) {
		for (let y = centerY - 2; y <= centerY + 2; y++) {
			for (let z = centerZ - 2; z <= centerZ + 2; z++) {
				let phase = "getTileEntity";
				try {
					const tile = SRBXApiCompat.getTileEntity(world, x, y, z);
					if (!(tile instanceof TileEntityLargeRailBase)) continue;
					phase = "getRailCore";
					const core = tile.getRailCore();
					if (!core) continue;
					phase = "getRailPositionCandidateKey";
					const railKey =
						SRBXApiCompat.getRailPositionCandidateKey(core);
					if (seen[railKey]) continue;
					seen[railKey] = true;
					phase = "getRailPositionUnsupportedReason";
					if (
						SRBXApiCompat.getRailPositionUnsupportedReason(core) !==
						""
					)
						continue;
					phase = "getEditableRailPositions";
					const positions =
						SRBXApiCompat.getEditableRailPositions(core);
					const corePos = SRBXApiCompat.getRailCorePos(core);
					for (let index = 0; index < positions.length; index++) {
						const rp = positions[index] as RailPosition;
						const dx = rp.posX - looking.posX;
						const dy = rp.posY - looking.posY;
						const dz = rp.posZ - looking.posZ;
						const distanceSquared = dx * dx + dy * dy + dz * dz;
						if (
							distanceSquared >
							ENDPOINT_SEARCH_RADIUS * ENDPOINT_SEARCH_RADIUS
						)
							continue;
						if (
							!nearest ||
							distanceSquared < nearest.distanceSquared
						) {
							nearest = {
								distanceSquared,
								point: {
									kind: "rail",
									position: [rp.posX, rp.posY, rp.posZ],
									direction: (rp.direction + 4) & 7,
									anchorYaw: SRBXMath.normalizeDegrees(
										SRBXApiCompat.getHorizontalAnchorYaw(
											rp,
										) + 180,
									),
									anchorPitch:
										-SRBXApiCompat.getRailPositionAnchorPitch(
											rp,
										),
									core: corePos,
									index,
								},
							};
						}
					}
				} catch (error) {
					logScanErrorOnce(phase, x, y, z, error);
				}
			}
		}
	}
	return nearest ? nearest.point : null;
}

function getHoverPoint(
	entity: EntityVehicle,
	partialTicks: number,
	state: BuilderState,
): SRBXBuilderPoint | null {
	const rail = findRailCandidate(entity, partialTicks);
	if (rail) return rail;
	const position = getCursorPosition(partialTicks, state.snapEnabled);
	if (!position) return null;
	return {
		kind: "free",
		position,
		direction: 0,
		anchorYaw: 0,
		anchorPitch: 0,
	};
}

function orientPair(
	startSource: SRBXBuilderPoint,
	endSource: SRBXBuilderPoint,
	state: BuilderState,
): [SRBXBuilderPoint, SRBXBuilderPoint] {
	const start = copyPoint(startSource);
	const end = copyPoint(endSource);
	if (start.kind === "free" && end.kind === "free") {
		let yaw = SRBXMath.horizontalYaw(start.position, end.position);
		if (state.snapEnabled)
			yaw = SRBXMath.snapDegrees(yaw, snapAngles[state.snapAngleIndex]);
		const horizontal = SRBXMath.horizontalDistance(
			start.position,
			end.position,
		);
		const pitch =
			(Math.atan2(end.position[1] - start.position[1], horizontal) *
				180) /
			Math.PI;
		start.anchorYaw = yaw;
		start.anchorPitch = pitch;
		start.direction = SRBXMath.directionFromYaw(yaw);
		end.anchorYaw = SRBXMath.normalizeDegrees(yaw + 180);
		end.anchorPitch = -pitch;
		end.direction = SRBXMath.directionFromYaw(end.anchorYaw);
	}
	return [start, end];
}

function renderAt(
	entity: EntityVehicle,
	partialTicks: number,
	position: SRBXVec3,
	parts: Parts,
): void {
	const entityPos = NGTOBuilderUtilClient.getInterpolatedPos(
		entity,
		partialTicks,
	);
	GL11.glPushMatrix();
	GL11.glTranslatef(
		position[0] - entityPos[0],
		position[1] - entityPos[1],
		position[2] - entityPos[2],
	);
	parts.render(renderer);
	GL11.glPopMatrix();
}

function renderSelectedPoint(
	entity: EntityVehicle,
	partialTicks: number,
	point: SRBXBuilderPoint,
): void {
	renderAt(entity, partialTicks, point.position, selectedCursor);
	const direction = point.direction & 7;
	renderAt(entity, partialTicks, point.position, directionMarkers[direction]);
}

function renderLine(
	entity: EntityVehicle,
	partialTicks: number,
	start: SRBXVec3,
	end: SRBXVec3,
): void {
	const length = SRBXMath.distance(start, end);
	if (length < 0.001) return;
	const entityPos = NGTOBuilderUtilClient.getInterpolatedPos(
		entity,
		partialTicks,
	);
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const dz = end[2] - start[2];
	const horizontal = Math.sqrt(dx * dx + dz * dz);
	const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
	const pitch = (-Math.atan2(dy, horizontal) * 180) / Math.PI;
	GL11.glPushMatrix();
	GL11.glTranslatef(
		(start[0] + end[0]) / 2 - entityPos[0],
		(start[1] + end[1]) / 2 - entityPos[1],
		(start[2] + end[2]) / 2 - entityPos[2],
	);
	GL11.glRotatef(yaw, 0, 1, 0);
	GL11.glRotatef(pitch, 1, 0, 0);
	GL11.glScalef(1, 1, length / SELECTED_LINE_MODEL_LENGTH);
	selectedLine.render(renderer);
	GL11.glPopMatrix();
}

function sendRequest(
	entity: EntityVehicle,
	state: BuilderState,
	request: Builder1Request,
): void {
	const dataMap = entity.getResourceState().getDataMap();
	NGTOBuilderUtil.sendJsonData(dataMap, "builder1Request", request);
	dataMap.setString("builder1Result", "waiting", 1);
	state.awaitingResult = true;
	state.pendingAction = request.action;
}

function showHelp(sender: ICommandSender): void {
	NGTLog.sendChatMessage(sender, "--- SuperRailBuilderX builder1 ---");
	NGTLog.sendChatMessage(sender, "[右クリック] 始点→終点を選択");
	NGTLog.sendChatMessage(sender, "[左クリック] 最後の選択を解除");
	NGTLog.sendChatMessage(sender, keys.getDescription("build"));
	NGTLog.sendChatMessage(sender, keys.getDescription("clear"));
	NGTLog.sendChatMessage(sender, keys.getDescription("snap"));
	NGTLog.sendChatMessage(sender, keys.getDescription("snapAngle"));
	NGTLog.sendChatMessage(sender, keys.getDescription("undo"));
	NGTLog.sendChatMessage(sender, keys.getDescription("exit"));
}

function resultMessage(result: string): string {
	if (result === "hold_rail_item") return "レールを手に持ってください";
	if (result === "rail_to_free_not_implemented")
		return "既設レール端部と空間点を結ぶ生成は未実装です";
	if (result === "rail_endpoint_changed")
		return "選択した既設レール端部が変更されています";
	if (result === "rail_occupied")
		return "列車が在線しているため取り消せません";
	if (result === "nothing_to_undo") return "取り消せる生成がありません";
	return result;
}

function handleResult(
	sender: ICommandSender,
	entity: EntityVehicle,
	state: BuilderState,
): void {
	if (!state.awaitingResult) return;
	const dataMap = entity.getResourceState().getDataMap();
	const result = dataMap.getString("builder1Result");
	if (result === "" || result === "waiting") return;
	state.awaitingResult = false;
	if (result === "ok" && state.pendingAction === "create") {
		state.lastBuiltSelection = state.selected.map(copyPoint);
		state.selected = [];
		NGTLog.sendChatMessage(
			sender,
			"§a[SuperRailBuilderX] レールを生成しました",
		);
	} else if (result === "undo_ok" && state.pendingAction === "undo") {
		state.selected = state.lastBuiltSelection
			? state.lastBuiltSelection.map(copyPoint)
			: [];
		state.lastBuiltSelection = null;
		NGTLog.sendChatMessage(
			sender,
			"§a[SuperRailBuilderX] 直前の生成を取り消しました",
		);
	} else {
		NGTLog.sendChatMessage(
			sender,
			`§c[SuperRailBuilderX] 処理失敗: ${resultMessage(result)}`,
		);
	}
	state.pendingAction = null;
	dataMap.setString("builder1Result", "", 1);
}

function handleInput(
	host: EntityPlayer,
	entity: EntityVehicle,
	partialTicks: number,
	rightClick: boolean,
	leftClick: boolean,
): void {
	const sender = host as unknown as ICommandSender;
	const dataMap = entity.getResourceState().getDataMap();
	const state = getState(entity);
	if (keys.pressed("help")) showHelp(sender);
	if (keys.down("exit")) dataMap.setBoolean("isEndEdit", true, 1);
	if (keys.pressed("snap")) {
		state.snapEnabled = !state.snapEnabled;
		NGTLog.sendChatMessage(
			sender,
			`[SuperRailBuilderX] スナップ: ${state.snapEnabled ? "ON" : "OFF"}`,
		);
	}
	if (keys.pressed("snapAngle")) {
		state.snapAngleIndex = (state.snapAngleIndex + 1) % snapAngles.length;
		NGTLog.sendChatMessage(
			sender,
			`[SuperRailBuilderX] 角度スナップ: ${snapAngles[state.snapAngleIndex]}度`,
		);
	}
	if (keys.pressed("clear") && !state.awaitingResult) state.selected = [];
	if (leftClick && !state.awaitingResult && state.selected.length > 0)
		state.selected.pop();
	if (rightClick && !state.awaitingResult && state.selected.length < 2) {
		const point = getHoverPoint(entity, partialTicks, state);
		if (point) state.selected.push(copyPoint(point));
	}
	if (
		keys.pressed("build") &&
		!state.awaitingResult &&
		state.selected.length === 2
	) {
		const pair = orientPair(state.selected[0], state.selected[1], state);
		state.selected = [copyPoint(pair[0]), copyPoint(pair[1])];
		if (pair[0].kind !== pair[1].kind) {
			NGTLog.sendChatMessage(
				sender,
				"§e[SuperRailBuilderX] 既設端部と空間点を結ぶ生成は今後実装します",
			);
		} else {
			sendRequest(entity, state, {
				action: "create",
				start: pair[0],
				end: pair[1],
			});
			NGTLog.sendChatMessage(
				sender,
				"[SuperRailBuilderX] レール生成中...",
			);
		}
	}
	if (
		keys.pressed("undo") &&
		!state.awaitingResult &&
		dataMap.getBoolean("builder1CanUndo")
	) {
		sendRequest(entity, state, { action: "undo" });
		NGTLog.sendChatMessage(sender, "[SuperRailBuilderX] Undo...");
	}
	handleResult(sender, entity, state);
}

function render(
	entity: EntityVehicle,
	pass: number,
	partialTicks: number,
): void {
	if (!entity) {
		body.render(renderer);
		return;
	}
	body.render(renderer);
	const dataMap = entity.getResourceState().getDataMap();
	const world = SRBXApiCompat.getWorld(entity);
	const player = MCWrapperClient.getPlayer();
	const hostId = dataMap.getString("hostPlayerEntityId");
	const host = hostId
		? (world.getEntityByID(Number(hostId)) as unknown as EntityPlayer)
		: null;
	if (!host || host !== player) return;
	SRBXApiCompat.doFollowing(entity, host);
	const state = getState(entity);
	const hover =
		state.selected.length < 2
			? getHoverPoint(entity, partialTicks, state)
			: null;
	let displayPoints = state.selected.map(copyPoint);
	if (displayPoints.length === 1 && hover)
		displayPoints = orientPair(displayPoints[0], hover, state);
	else if (displayPoints.length === 2)
		displayPoints = orientPair(displayPoints[0], displayPoints[1], state);
	if (hover) {
		renderAt(entity, partialTicks, hover.position, selectCursor);
		renderAt(entity, partialTicks, hover.position, selectCursorMarker);
	}
	for (let i = 0; i < state.selected.length; i++)
		renderSelectedPoint(entity, partialTicks, displayPoints[i]);
	if (state.selected.length >= 1 && displayPoints.length >= 2)
		renderLine(
			entity,
			partialTicks,
			displayPoints[0].position,
			displayPoints[1].position,
		);
	const isOpenGUI = NGTUtilClient.getMinecraft().currentScreen !== null;
	const left = Mouse.isButtonDown(0);
	const right = Mouse.isButtonDown(1);
	const prevLeft = dataMap.getBoolean("prevIsLeftClick");
	const prevRight = dataMap.getBoolean("prevIsRightClick");
	if (left !== prevLeft) dataMap.setBoolean("prevIsLeftClick", left, 0);
	if (right !== prevRight) dataMap.setBoolean("prevIsRightClick", right, 0);
	if (renderer.currentMatId === 0 && pass === 0) keys.update();
	if (!isOpenGUI && renderer.currentMatId === 0 && pass === 0)
		handleInput(
			host,
			entity,
			partialTicks,
			!prevRight && right,
			!prevLeft && left,
		);
}
