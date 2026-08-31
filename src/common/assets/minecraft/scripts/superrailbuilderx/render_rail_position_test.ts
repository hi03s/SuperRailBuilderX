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
import { InputManager } from "../lib_hi03toolkit_1_0/lib_InputManager";
import { ErrorLogger } from "../lib_hi03toolkit_1_0/lib_ErrorLogger";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import { NGTOBuilderUtilClient } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtilClient";
import { RTMApiCompat } from "@target/assets/minecraft/scripts/lib_hi03toolkit_1_0/lib_RTMApiCompat";
import { RailPositionCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/RailPositionCompat";
import { RailPositionMoveRequest } from "./server_rail_position_test";

declare const renderer: VehiclePartsRenderer;

const VERSION = "0.1.0";
const SEARCH_RADIUS = 1.05;

type Candidate = {
	core: TileEntityLargeRailCore;
	coreX: number;
	coreY: number;
	coreZ: number;
	index: number;
	position: [number, number, number];
};

type EditorState = {
	stage: number;
	selected: Candidate | null;
	destination: [number, number, number] | null;
};

type CandidateScanDiagnostics = {
	railTiles: number;
	uniqueCores: number;
	missingCores: number;
	unsupportedCores: number;
	invalidPositions: number;
	outOfRangePositions: number;
	errors: number;
};

let keys: InputManager;
let body: Parts;
let point: Parts;
let selectedPoint: Parts;
const states: WeakHashMap<EntityVehicle, EditorState> = new WeakHashMap();
const loggedCandidateErrors: { [key: string]: boolean } = {};

function init(par1: ModelSetVehicle, par2: ModelObject): void {
	keys = new InputManager();
	keys.register("help", Keyboard.KEY_H, false, "ヘルプを表示");
	keys.register("exit", Keyboard.KEY_Q, false, "ツールを終了");
	keys.register("apply", Keyboard.KEY_RETURN, false, "移動を適用");
	body = renderer.registerParts(new Parts("body"));
	point = renderer.registerParts(new Parts("point"));
	selectedPoint = renderer.registerParts(new Parts("selected"));
}

function getState(entity: EntityVehicle): EditorState {
	let state = states.get(entity);
	if (!state) {
		state = { stage: 0, selected: null, destination: null };
		states.put(entity, state);
	}
	return state;
}

function roundCentimeter(value: number): number {
	return Math.round(value * 100) / 100;
}

function getDestination(partialTicks: number): [number, number, number] | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	return looking
		? [
				roundCentimeter(looking.posX),
				roundCentimeter(looking.posY),
				roundCentimeter(looking.posZ),
			]
		: null;
}

function logCandidateErrorOnce(
	phase: string,
	x: number,
	y: number,
	z: number,
	error: unknown,
): void {
	const key = `${phase}:${x},${y},${z}`;
	if (loggedCandidateErrors[key]) return;
	loggedCandidateErrors[key] = true;
	ErrorLogger.log("SuperRailBuilderX RailPosition candidate scan", phase, error, {
		x,
		y,
		z,
	});
}

function logCandidateScan(
	looking: { posX: number; posY: number; posZ: number },
	diagnostics: CandidateScanDiagnostics,
	candidateCount: number,
): void {
	NGTLog.debug(
		`[SuperRailBuilderX RailPosition] candidate scan: look=${looking.posX.toFixed(3)},${looking.posY.toFixed(3)},${looking.posZ.toFixed(3)}, candidates=${candidateCount}, railTiles=${diagnostics.railTiles}, uniqueCores=${diagnostics.uniqueCores}, missingCores=${diagnostics.missingCores}, unsupportedCores=${diagnostics.unsupportedCores}, invalidPositions=${diagnostics.invalidPositions}, outOfRangePositions=${diagnostics.outOfRangePositions}, errors=${diagnostics.errors}`,
	);
}

function findCandidates(
	entity: EntityVehicle,
	partialTicks: number,
	logDiagnostics = false,
): Candidate[] {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return [];
	const world = RTMApiCompat.getWorld(entity);
	const candidates: Candidate[] = [];
	const seen: { [key: string]: boolean } = {};
	const diagnostics: CandidateScanDiagnostics = {
		railTiles: 0,
		uniqueCores: 0,
		missingCores: 0,
		unsupportedCores: 0,
		invalidPositions: 0,
		outOfRangePositions: 0,
		errors: 0,
	};
	const centerX = Math.floor(looking.posX);
	const centerY = Math.floor(looking.posY);
	const centerZ = Math.floor(looking.posZ);
	for (let x = centerX - 2; x <= centerX + 2; x++) {
		for (let y = centerY - 2; y <= centerY + 2; y++) {
			for (let z = centerZ - 2; z <= centerZ + 2; z++) {
				let phase = "getTileEntity";
				try {
					const tile = RTMApiCompat.getTileEntity(world, x, y, z);
					if (!(tile instanceof TileEntityLargeRailBase)) continue;
					diagnostics.railTiles++;
					phase = "getRailCore";
					const core = tile.getRailCore();
					if (!core) {
						diagnostics.missingCores++;
						continue;
					}
					phase = "getRailCorePos";
					const corePos = RailPositionCompat.getRailCorePos(core);
					const coreKey = `${corePos[0]},${corePos[1]},${corePos[2]}`;
					if (seen[coreKey]) continue;
					seen[coreKey] = true;
					diagnostics.uniqueCores++;
					phase = "canMoveRailPosition";
					if (!RailPositionCompat.canMoveRailPosition(core)) {
						diagnostics.unsupportedCores++;
						continue;
					}
					phase = "getRailPositions";
					const positions = core.getRailPositions();
					if (!positions || positions.length === 0) {
						diagnostics.invalidPositions++;
						continue;
					}
					for (let index = 0; index < positions.length; index++) {
						phase = `readRailPosition[${index}]`;
						const rp = positions[index] as RailPosition;
						if (!rp) {
							diagnostics.invalidPositions++;
							continue;
						}
						const dx = rp.posX - looking.posX;
						const dy = rp.posY - looking.posY;
						const dz = rp.posZ - looking.posZ;
						if (Math.sqrt(dx * dx + dy * dy + dz * dz) > SEARCH_RADIUS) {
							diagnostics.outOfRangePositions++;
							continue;
						}
						candidates.push({
							core,
							coreX: corePos[0],
							coreY: corePos[1],
							coreZ: corePos[2],
							index,
							position: [rp.posX, rp.posY, rp.posZ],
						});
					}
				} catch (error) {
					diagnostics.errors++;
					logCandidateErrorOnce(phase, x, y, z, error);
				}
			}
		}
	}
	if (logDiagnostics) logCandidateScan(looking, diagnostics, candidates.length);
	return candidates;
}

function nearestCandidate(
	candidates: Candidate[],
	partialTicks: number,
): Candidate | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking || candidates.length === 0) return null;
	let nearest = candidates[0];
	let nearestDistance = Number.MAX_VALUE;
	for (let i = 0; i < candidates.length; i++) {
		const pos = candidates[i].position;
		const distance =
			Math.pow(pos[0] - looking.posX, 2) +
			Math.pow(pos[1] - looking.posY, 2) +
			Math.pow(pos[2] - looking.posZ, 2);
		if (distance < nearestDistance) {
			nearest = candidates[i];
			nearestDistance = distance;
		}
	}
	return nearest;
}

function renderMarker(
	entity: EntityVehicle,
	partialTicks: number,
	pos: [number, number, number],
	parts: Parts,
): void {
	const entityPos = NGTOBuilderUtilClient.getInterpolatedPos(
		entity,
		partialTicks,
	);
	GL11.glPushMatrix();
	GL11.glTranslatef(
		pos[0] - entityPos[0],
		pos[1] - entityPos[1],
		pos[2] - entityPos[2],
	);
	parts.render(renderer);
	GL11.glPopMatrix();
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
	if (keys.pressed("help")) {
		NGTLog.sendChatMessage(sender, "--- RailPosition自由化テスト ---");
		NGTLog.sendChatMessage(sender, "[右クリック] 接続点/移動先を確定");
		NGTLog.sendChatMessage(sender, "[左クリック] 1段階戻る");
		NGTLog.sendChatMessage(sender, keys.getDescription("apply"));
		NGTLog.sendChatMessage(sender, keys.getDescription("exit"));
	}
	if (keys.down("exit")) dataMap.setBoolean("isEndEdit", true, 1);
	if (leftClick) {
		if (state.stage === 2) {
			state.stage = 1;
			state.destination = null;
		} else if (state.stage === 1) {
			state.stage = 0;
			state.selected = null;
		}
	}
	if (rightClick && state.stage === 0) {
		state.selected = nearestCandidate(
			findCandidates(entity, partialTicks, true),
			partialTicks,
		);
		if (state.selected) {
			state.stage = 1;
		} else {
			NGTLog.sendChatMessage(
				sender,
				"§e[SuperRailBuilderX] 候補がありません。latest.logのcandidate scanを確認してください",
			);
		}
	} else if (rightClick && state.stage === 1) {
		state.destination = getDestination(partialTicks);
		if (state.destination) state.stage = 2;
	}
	if (
		keys.pressed("apply") &&
		state.stage === 2 &&
		state.selected &&
		state.destination
	) {
		const request: RailPositionMoveRequest = {
			core: [
				state.selected.coreX,
				state.selected.coreY,
				state.selected.coreZ,
			],
			index: state.selected.index,
			original: state.selected.position,
			destination: state.destination,
		};
		NGTOBuilderUtil.sendJsonData(dataMap, "railPositionMove", request);
		dataMap.setString("applyResult", "waiting", 1);
		NGTLog.sendChatMessage(sender, "[SuperRailBuilderX] 移動を適用中...");
	}
	const result = dataMap.getString("applyResult");
	if (result !== "" && result !== "waiting") {
		if (result === "ok") {
			if (state.selected && state.destination) {
				try {
					RailPositionCompat.refreshRailPositionClient(
						state.selected.core,
						state.selected.index,
						state.destination[0],
						state.destination[1],
						state.destination[2],
					);
				} catch (error) {
					ErrorLogger.log(
						"SuperRailBuilderX RailPosition apply",
						"refreshRailPositionClient",
						error,
						{
							coreX: state.selected.coreX,
							coreY: state.selected.coreY,
							coreZ: state.selected.coreZ,
							index: state.selected.index,
						},
					);
				}
			}
			NGTLog.sendChatMessage(
				sender,
				"§a[SuperRailBuilderX] 移動しました",
			);
			state.stage = 0;
			state.selected = null;
			state.destination = null;
		} else {
			NGTLog.sendChatMessage(
				sender,
				`§c[SuperRailBuilderX] 適用失敗: ${result}`,
			);
		}
		dataMap.setString("applyResult", "", 1);
	}
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
	const world = RTMApiCompat.getWorld(entity);
	const player = MCWrapperClient.getPlayer();
	const hostId = dataMap.getString("hostPlayerEntityId");
	const host = hostId
		? (world.getEntityByID(Number(hostId)) as unknown as EntityPlayer)
		: null;
	if (!host || host !== player) return;
	RTMApiCompat.doFollowing(entity, host);
	const state = getState(entity);
	const candidates =
		state.stage === 0 ? findCandidates(entity, partialTicks) : [];
	for (let i = 0; i < candidates.length; i++)
		renderMarker(entity, partialTicks, candidates[i].position, point);
	if (state.selected)
		renderMarker(
			entity,
			partialTicks,
			state.selected.position,
			selectedPoint,
		);
	const preview =
		state.stage === 1 ? getDestination(partialTicks) : state.destination;
	if (preview) renderMarker(entity, partialTicks, preview, point);
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
