import { NGTLog } from "jp.ngt.ngtlib.io";
import { MCWrapperClient, NGTUtilClient } from "jp.ngt.ngtlib.util";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ModelSetVehicle } from "jp.ngt.rtm.modelpack.modelset";
import { ModelObject, Parts, VehiclePartsRenderer } from "jp.ngt.rtm.render";
import {
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
} from "jp.ngt.rtm.rail";
import { RailMap, RailPosition } from "jp.ngt.rtm.rail.util";
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
import {
	RailCorePos,
	SRBXApiCompat,
	SRBXBuilderPoint,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath, SRBXVec3 } from "./SRBXMath";
import {
	RailPositionConnectedMove,
	RailPositionMoveRequest,
	RailPositionParallelMoveRequest,
} from "./server_rail_mover";

declare const renderer: VehiclePartsRenderer;

const VERSION = "alpha-0.1.0";
const SEARCH_RADIUS = 1.05;
const CONNECTED_ENDPOINT_TOLERANCE = 0.001;
const NORMAL_RAIL_HEIGHT = 1 / 16;
const SNAP_STEP = 0.1;
const PARALLEL_MIN_OFFSET = 0.05;
const ENDPOINT_SNAP_RADIUS = 0.5;
const HOVER_BLOCK_RADIUS = 2;
const SELECTED_LINE_MODEL_LENGTH = 0.6225;

type Candidate = {
	core: TileEntityLargeRailCore;
	railKey: string;
	coreX: number;
	coreY: number;
	coreZ: number;
	index: number;
	position: [number, number, number];
};

type SelectedEndpoint = {
	candidates: Candidate[];
	position: [number, number, number];
};

type SelectedRail = { core: RailCorePos; railKey: string };
type ResolvedRail = {
	target: SelectedRail;
	map: RailMap;
	positions: JavaObjectArray<RailPosition>;
};
type ParallelPlan = {
	target: SelectedRail;
	originalStart: RailCorePos;
	originalEnd: RailCorePos;
	originalStartPoint: SRBXBuilderPoint;
	originalEndPoint: SRBXBuilderPoint;
	start: SRBXBuilderPoint;
	end: SRBXBuilderPoint;
	offset: number;
};

type EditorState = {
	stage: number;
	selected: SelectedEndpoint | null;
	selectedRails: SelectedRail[];
	destination: [number, number, number] | null;
	parallelPlans: ParallelPlan[];
	awaitingResult: boolean;
	pendingAction: "move" | "undo" | null;
	snapEnabled: boolean;
	ignoredRailKeys: { [key: string]: boolean };
};

type CandidateScanDiagnostics = {
	railTiles: number;
	uniqueCores: number;
	missingCores: number;
	unsupportedCores: number;
	sectionedCores: number;
	switchCores: number;
	invalidPositions: number;
	outOfRangePositions: number;
	errors: number;
};

function sameRail(a: SelectedRail, b: SelectedRail): boolean {
	return a.railKey === b.railKey;
}

function toggleRailSelection(
	entity: EntityVehicle,
	state: EditorState,
	target: SelectedRail,
): "added" | "removed" | "not_connected" {
	for (let i = 0; i < state.selectedRails.length; i++)
		if (sameRail(state.selectedRails[i], target)) {
			state.selectedRails.splice(i, 1);
			return "removed";
		}
	if (state.selectedRails.length > 0) {
		const targetRail = resolveRail(entity, target);
		if (!targetRail) return "not_connected";
		let connected = false;
		for (let i = 0; i < state.selectedRails.length && !connected; i++) {
			const selectedRail = resolveRail(entity, state.selectedRails[i]);
			if (!selectedRail) continue;
			for (let a = 0; a < targetRail.positions.length && !connected; a++)
				for (let b = 0; b < selectedRail.positions.length; b++) {
					const targetPosition = targetRail.positions[a];
					const selectedPosition = selectedRail.positions[b];
					if (
						Math.abs(targetPosition.posX - selectedPosition.posX) <=
							CONNECTED_ENDPOINT_TOLERANCE &&
						Math.abs(targetPosition.posY - selectedPosition.posY) <=
							CONNECTED_ENDPOINT_TOLERANCE &&
						Math.abs(targetPosition.posZ - selectedPosition.posZ) <=
							CONNECTED_ENDPOINT_TOLERANCE
					) {
						connected = true;
						break;
					}
				}
		}
		if (!connected) return "not_connected";
	}
	state.selectedRails.push({
		core: [target.core[0], target.core[1], target.core[2]],
		railKey: target.railKey,
	});
	return "added";
}

let keys: InputManager;
let body: Parts;
let point: Parts;
let selectedPoint: Parts;
let selectedLine: Parts;
const states: WeakHashMap<EntityVehicle, EditorState> = new WeakHashMap();
const loggedCandidateErrors: { [key: string]: boolean } = {};
let lastCandidateScanDiagnostics: CandidateScanDiagnostics | null = null;

function init(par1: ModelSetVehicle, par2: ModelObject): void {
	keys = new InputManager();
	keys.setOptionKey(Keyboard.KEY_LCONTROL);
	keys.register("help", Keyboard.KEY_H, false, "ヘルプを表示");
	keys.register("exit", Keyboard.KEY_Q, false, "ツールを終了");
	keys.register("apply", Keyboard.KEY_RETURN, false, "移動を適用");
	keys.register("snap", Keyboard.KEY_P, false, "0.1mスナップ切替");
	keys.register("undo", Keyboard.KEY_Z, true, "直前の移動を取り消す");
	body = renderer.registerParts(new Parts("body"));
	point = renderer.registerParts(new Parts("selectCursor"));
	selectedPoint = renderer.registerParts(new Parts("selectedCursor"));
	selectedLine = renderer.registerParts(new Parts("selectedLine"));
}

function getState(entity: EntityVehicle): EditorState {
	let state = states.get(entity);
	if (!state) {
		state = {
			stage: 0,
			selected: null,
			selectedRails: [],
			destination: null,
			parallelPlans: [],
			awaitingResult: false,
			pendingAction: null,
			snapEnabled: false,
			ignoredRailKeys: {},
		};
		states.put(entity, state);
	}
	return state;
}

function roundCentimeter(value: number): number {
	return Math.round(value * 100) / 100;
}

function roundSnap(value: number): number {
	return Math.round(value / SNAP_STEP) * SNAP_STEP;
}

function getRailBaseHeightAt(
	entity: EntityVehicle,
	x: number,
	y: number,
	z: number,
): number | null {
	const world = SRBXApiCompat.getWorld(entity);
	let bestHeight: number | null = null;
	let bestDistance = 2.25;
	const seen: { [key: string]: boolean } = {};
	for (let dy = -1; dy <= 1; dy++) {
		const tile = SRBXApiCompat.getTileEntity(world, x, y + dy, z);
		if (!(tile instanceof TileEntityLargeRailBase)) continue;
		const core = tile.getRailCore();
		if (!core) continue;
		const railKey = SRBXApiCompat.getRailPositionCandidateKey(core);
		if (seen[railKey]) continue;
		seen[railKey] = true;
		if (SRBXApiCompat.getRailPositionUnsupportedReason(core) !== "")
			continue;
		const map = SRBXApiCompat.getLogicalRailMap(core);
		if (!map) continue;
		const split = Math.max(
			8,
			Math.min(512, Math.ceil(map.getLength() * 4)),
		);
		const index = map.getNearlestPoint(split, x, z);
		const railPos = map.getRailPos(split, index);
		const railHeight = map.getRailHeight(split, index);
		const distance =
			Math.pow(railPos[1] - x, 2) +
			Math.pow(railHeight - y, 2) +
			Math.pow(railPos[0] - z, 2);
		if (distance >= bestDistance) continue;
		const cant = RTMApiCompat.getCant(map, split, index);
		bestDistance = distance;
		bestHeight =
			railHeight - Math.abs(Math.sin((cant * Math.PI) / 180) * 1.5);
	}
	return bestHeight;
}

function getDestination(
	entity: EntityVehicle,
	partialTicks: number,
	snapEnabled: boolean,
): [number, number, number] | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return null;
	const railHeight = getRailBaseHeightAt(
		entity,
		looking.posX,
		looking.posY,
		looking.posZ,
	);
	const roundHorizontal = snapEnabled ? roundSnap : roundCentimeter;
	return [
		roundHorizontal(looking.posX),
		railHeight === null
			? (snapEnabled
					? roundSnap(looking.posY)
					: roundCentimeter(looking.posY)) + NORMAL_RAIL_HEIGHT
			: railHeight,
		roundHorizontal(looking.posZ),
	];
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
	ErrorLogger.log(
		"SuperRailBuilderX RailPosition candidate scan",
		phase,
		error,
		{
			x,
			y,
			z,
		},
	);
}

function logCandidateScan(
	looking: { posX: number; posY: number; posZ: number },
	diagnostics: CandidateScanDiagnostics,
	candidateCount: number,
): void {
	NGTLog.debug(
		`[SuperRailBuilderX RailPosition] candidate scan: look=${looking.posX.toFixed(3)},${looking.posY.toFixed(3)},${looking.posZ.toFixed(3)}, candidates=${candidateCount}, railTiles=${diagnostics.railTiles}, uniqueCores=${diagnostics.uniqueCores}, missingCores=${diagnostics.missingCores}, unsupportedCores=${diagnostics.unsupportedCores}, sectionedCores=${diagnostics.sectionedCores}, switchCores=${diagnostics.switchCores}, invalidPositions=${diagnostics.invalidPositions}, outOfRangePositions=${diagnostics.outOfRangePositions}, errors=${diagnostics.errors}`,
	);
}

function logUnsupportedCore(
	corePos: [number, number, number],
	reason: string,
): void {
	NGTLog.debug(
		`[SuperRailBuilderX RailPosition] unsupported core: core=${corePos[0]},${corePos[1]},${corePos[2]}, reason=${reason}`,
	);
}

function findCandidates(
	entity: EntityVehicle,
	partialTicks: number,
	logDiagnostics = false,
): Candidate[] {
	lastCandidateScanDiagnostics = null;
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return [];
	const world = SRBXApiCompat.getWorld(entity);
	const candidates: Candidate[] = [];
	const seen: { [key: string]: boolean } = {};
	const diagnostics: CandidateScanDiagnostics = {
		railTiles: 0,
		uniqueCores: 0,
		missingCores: 0,
		unsupportedCores: 0,
		sectionedCores: 0,
		switchCores: 0,
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
					const tile = SRBXApiCompat.getTileEntity(world, x, y, z);
					if (!(tile instanceof TileEntityLargeRailBase)) continue;
					diagnostics.railTiles++;
					phase = "getRailCore";
					const core = tile.getRailCore();
					if (!core) {
						diagnostics.missingCores++;
						continue;
					}
					phase = "getRailCorePos";
					const corePos = SRBXApiCompat.getRailCorePos(core);
					phase = "getRailPositionCandidateKey";
					const coreKey =
						SRBXApiCompat.getRailPositionCandidateKey(core);
					if (seen[coreKey]) continue;
					seen[coreKey] = true;
					diagnostics.uniqueCores++;
					phase = "getRailPositionUnsupportedReason";
					const unsupportedReason =
						SRBXApiCompat.getRailPositionUnsupportedReason(core);
					if (unsupportedReason !== "") {
						diagnostics.unsupportedCores++;
						if (unsupportedReason.indexOf("sectioned(") === 0)
							diagnostics.sectionedCores++;
						if (unsupportedReason === "switch")
							diagnostics.switchCores++;
						if (logDiagnostics)
							logUnsupportedCore(corePos, unsupportedReason);
						continue;
					}
					phase = "getEditableRailPositions";
					const positions =
						SRBXApiCompat.getEditableRailPositions(core);
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
						if (
							Math.sqrt(dx * dx + dy * dy + dz * dz) >
							SEARCH_RADIUS
						) {
							diagnostics.outOfRangePositions++;
							continue;
						}
						candidates.push({
							core,
							railKey: coreKey,
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
	lastCandidateScanDiagnostics = diagnostics;
	if (logDiagnostics)
		logCandidateScan(looking, diagnostics, candidates.length);
	return candidates;
}

function nearestCandidate(
	candidates: Candidate[],
	partialTicks: number,
): SelectedEndpoint | null {
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
	const connected: Candidate[] = [];
	const seen: { [key: string]: boolean } = {};
	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i];
		if (
			Math.abs(candidate.position[0] - nearest.position[0]) >
				CONNECTED_ENDPOINT_TOLERANCE ||
			Math.abs(candidate.position[1] - nearest.position[1]) >
				CONNECTED_ENDPOINT_TOLERANCE ||
			Math.abs(candidate.position[2] - nearest.position[2]) >
				CONNECTED_ENDPOINT_TOLERANCE
		)
			continue;
		const key = `${candidate.railKey}:${candidate.index}`;
		if (seen[key]) continue;
		seen[key] = true;
		connected.push(candidate);
	}
	return { candidates: connected, position: nearest.position };
}

function railPoint(map: RailMap, split: number, index: number): SRBXVec3 {
	const pos = map.getRailPos(split, index);
	return [pos[1], map.getRailHeight(split, index), pos[0]];
}

function resolveRail(
	entity: EntityVehicle,
	target: SelectedRail,
): ResolvedRail | null {
	if (getState(entity).ignoredRailKeys[target.railKey]) return null;
	const world = SRBXApiCompat.getWorld(entity);
	const tile = SRBXApiCompat.getTileEntity(
		world,
		target.core[0],
		target.core[1],
		target.core[2],
	);
	if (!(tile instanceof TileEntityLargeRailBase)) return null;
	const core = tile.getRailCore();
	if (
		!core ||
		SRBXApiCompat.getRailPositionCandidateKey(core) !== target.railKey
	)
		return null;
	const map = SRBXApiCompat.getLogicalRailMap(core);
	const positions = SRBXApiCompat.getEditableRailPositions(core);
	if (!map || !positions || positions.length !== 2) return null;
	return { target, map, positions };
}

function findHoverRail(
	entity: EntityVehicle,
	partialTicks: number,
): SelectedRail | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return null;
	const world = SRBXApiCompat.getWorld(entity);
	const seen: { [key: string]: boolean } = {};
	let best: SelectedRail | null = null;
	let bestDistance = 2.25;
	for (let dx = -HOVER_BLOCK_RADIUS; dx <= HOVER_BLOCK_RADIUS; dx++) {
		for (let dy = -1; dy <= 1; dy++) {
			for (let dz = -HOVER_BLOCK_RADIUS; dz <= HOVER_BLOCK_RADIUS; dz++) {
				const tile = SRBXApiCompat.getTileEntity(
					world,
					looking.posX + dx,
					looking.posY + dy,
					looking.posZ + dz,
				);
				if (!(tile instanceof TileEntityLargeRailBase)) continue;
				const core = tile.getRailCore();
				if (!core) continue;
				const railKey = SRBXApiCompat.getRailPositionCandidateKey(core);
				if (seen[railKey]) continue;
				seen[railKey] = true;
				if (getState(entity).ignoredRailKeys[railKey]) continue;
				if (SRBXApiCompat.getRailPositionUnsupportedReason(core) !== "")
					continue;
				const map = SRBXApiCompat.getLogicalRailMap(core);
				const positions = SRBXApiCompat.getEditableRailPositions(core);
				if (!map || !positions || positions.length !== 2) continue;
				const split = Math.max(
					8,
					Math.min(256, Math.ceil(map.getLength() * 4)),
				);
				const index = map.getNearlestPoint(
					split,
					looking.posX,
					looking.posZ,
				);
				const position = railPoint(map, split, index);
				const distance =
					Math.pow(position[0] - looking.posX, 2) +
					Math.pow(position[1] - looking.posY, 2) +
					Math.pow(position[2] - looking.posZ, 2);
				if (distance >= bestDistance) continue;
				bestDistance = distance;
				best = {
					core: SRBXApiCompat.getRailCorePos(core),
					railKey,
				};
			}
		}
	}
	return best;
}

function sourcePoint(rp: RailPosition): SRBXBuilderPoint {
	return {
		kind: "free",
		position: [rp.posX, rp.posY, rp.posZ],
		direction: rp.direction,
		anchorYaw: SRBXApiCompat.getHorizontalAnchorYaw(rp),
		anchorPitch: SRBXApiCompat.getRailPositionAnchorPitch(rp),
		anchorLength: SRBXApiCompat.getHorizontalAnchorLength(rp),
		anchorLengthVertical: SRBXApiCompat.getVerticalAnchorLength(rp),
		markerPosition: [rp.posX, rp.posY, rp.posZ],
		ownerBlock: [rp.blockX, rp.blockY, rp.blockZ],
		cantEdge: SRBXApiCompat.getRailPositionCantEdge(rp),
		cantCenter: SRBXApiCompat.getRailPositionCantCenter(rp),
		cantRandom: SRBXApiCompat.getRailPositionCantRandom(rp),
	};
}

function connectedEndpointMoves(
	entity: EntityVehicle,
	target: SelectedRail,
	plan: ParallelPlan,
	excludedRailKeys?: { [key: string]: boolean },
): RailPositionConnectedMove[] {
	const world = SRBXApiCompat.getWorld(entity);
	const result: RailPositionConnectedMove[] = [];
	const seen: { [key: string]: boolean } = {};
	const endpoints: Array<{
		position: SRBXVec3;
		destination: RailCorePos;
	}> = [
		{ position: plan.originalStart, destination: plan.start.position },
		{ position: plan.originalEnd, destination: plan.end.position },
	];
	for (
		let endpointIndex = 0;
		endpointIndex < endpoints.length;
		endpointIndex++
	) {
		const endpoint = endpoints[endpointIndex];
		for (
			let x = Math.floor(endpoint.position[0]) - 1;
			x <= Math.floor(endpoint.position[0]) + 1;
			x++
		)
			for (
				let y = Math.floor(endpoint.position[1]) - 1;
				y <= Math.floor(endpoint.position[1]) + 1;
				y++
			)
				for (
					let z = Math.floor(endpoint.position[2]) - 1;
					z <= Math.floor(endpoint.position[2]) + 1;
					z++
				) {
					const tile = SRBXApiCompat.getTileEntity(world, x, y, z);
					if (!(tile instanceof TileEntityLargeRailBase)) continue;
					const core = tile.getRailCore();
					if (!core) continue;
					const railKey =
						SRBXApiCompat.getRailPositionCandidateKey(core);
					if (
						railKey === target.railKey ||
						(excludedRailKeys && excludedRailKeys[railKey])
					)
						continue;
					if (
						SRBXApiCompat.getRailPositionUnsupportedReason(core) !==
						""
					)
						continue;
					const positions =
						SRBXApiCompat.getEditableRailPositions(core);
					const corePos = SRBXApiCompat.getRailCorePos(core);
					for (let index = 0; index < positions.length; index++) {
						const rp = positions[index] as RailPosition;
						if (
							Math.abs(rp.posX - endpoint.position[0]) >
								CONNECTED_ENDPOINT_TOLERANCE ||
							Math.abs(rp.posY - endpoint.position[1]) >
								CONNECTED_ENDPOINT_TOLERANCE ||
							Math.abs(rp.posZ - endpoint.position[2]) >
								CONNECTED_ENDPOINT_TOLERANCE
						)
							continue;
						const key = `${railKey}:${index}`;
						if (seen[key]) continue;
						seen[key] = true;
						result.push({
							target: {
								core: corePos,
								index,
								original: [rp.posX, rp.posY, rp.posZ],
							},
							destination: endpoint.destination,
						});
					}
				}
	}
	return result;
}

function parallelRequest(
	entity: EntityVehicle,
	plan: ParallelPlan,
	excludedRailKeys: { [key: string]: boolean },
): RailPositionParallelMoveRequest {
	return {
		action: "move",
		mode: "parallel",
		core: plan.target.core,
		railKey: plan.target.railKey,
		originalStart: plan.originalStart,
		originalEnd: plan.originalEnd,
		originalStartPoint: plan.originalStartPoint,
		originalEndPoint: plan.originalEndPoint,
		start: plan.start,
		end: plan.end,
		connectedMoves: connectedEndpointMoves(
			entity,
			plan.target,
			plan,
			excludedRailKeys,
		),
	};
}

function horizontalNormal(yaw: number): [number, number] {
	const radians = (yaw * Math.PI) / 180;
	return [Math.cos(radians), -Math.sin(radians)];
}

function defaultOwnerBlock(point: SRBXBuilderPoint): RailCorePos {
	const direction = SRBXMath.directionFromYaw(point.anchorYaw);
	const radians = (direction * 45 * Math.PI) / 180;
	return [
		Math.floor(point.position[0] + Math.sin(radians) * 0.000001),
		Math.floor(point.position[1] - NORMAL_RAIL_HEIGHT + 0.000001),
		Math.floor(point.position[2] + Math.cos(radians) * 0.000001),
	];
}

function setDefaultOwner(point: SRBXBuilderPoint): void {
	point.direction = SRBXMath.directionFromYaw(point.anchorYaw);
	point.ownerBlock = defaultOwnerBlock(point);
	point.markerPosition = [
		point.ownerBlock[0] + 0.5,
		point.position[1],
		point.ownerBlock[2] + 0.5,
	];
}

function offsetPoint(
	point: SRBXBuilderPoint,
	pathYaw: number,
	distance: number,
): SRBXBuilderPoint {
	const normal = horizontalNormal(pathYaw);
	const position = SRBXMath.roundPosition(
		[
			point.position[0] + normal[0] * distance,
			point.position[1],
			point.position[2] + normal[1] * distance,
		],
		0.001,
	);
	return {
		kind: "free",
		position,
		direction: SRBXMath.directionFromYaw(point.anchorYaw),
		anchorYaw: point.anchorYaw,
		anchorPitch: point.anchorPitch,
		anchorLength: point.anchorLength,
		anchorLengthVertical: point.anchorLengthVertical,
		markerPosition: [position[0], position[1], position[2]],
		cantEdge: point.cantEdge,
		cantCenter: point.cantCenter,
		cantRandom: point.cantRandom,
	};
}

function connectionCandidate(
	entity: EntityVehicle,
	point: SRBXBuilderPoint,
	excludedRailKey: string,
): SRBXBuilderPoint | null {
	const world = SRBXApiCompat.getWorld(entity);
	const center = point.position;
	const seen: { [key: string]: boolean } = {};
	let best: SRBXBuilderPoint | null = null;
	let bestDistance = ENDPOINT_SNAP_RADIUS * ENDPOINT_SNAP_RADIUS;
	for (let x = Math.floor(center[0]) - 1; x <= Math.floor(center[0]) + 1; x++)
		for (
			let y = Math.floor(center[1]) - 1;
			y <= Math.floor(center[1]) + 1;
			y++
		)
			for (
				let z = Math.floor(center[2]) - 1;
				z <= Math.floor(center[2]) + 1;
				z++
			) {
				const tile = SRBXApiCompat.getTileEntity(world, x, y, z);
				if (!(tile instanceof TileEntityLargeRailBase)) continue;
				const core = tile.getRailCore();
				if (!core) continue;
				const railKey = SRBXApiCompat.getRailPositionCandidateKey(core);
				if (railKey === excludedRailKey || seen[railKey]) continue;
				seen[railKey] = true;
				if (SRBXApiCompat.getRailPositionUnsupportedReason(core) !== "")
					continue;
				const positions = SRBXApiCompat.getEditableRailPositions(core);
				const corePos = SRBXApiCompat.getRailCorePos(core);
				for (let index = 0; index < positions.length; index++) {
					const rp = positions[index] as RailPosition;
					const distance =
						Math.pow(rp.posX - center[0], 2) +
						Math.pow(rp.posY - center[1], 2) +
						Math.pow(rp.posZ - center[2], 2);
					if (distance > bestDistance) continue;
					bestDistance = distance;
					best = {
						kind: "rail",
						position: [rp.posX, rp.posY, rp.posZ],
						direction: (rp.direction + 4) & 7,
						anchorYaw: SRBXMath.normalizeDegrees(
							SRBXApiCompat.getHorizontalAnchorYaw(rp) + 180,
						),
						anchorPitch:
							-SRBXApiCompat.getRailPositionAnchorPitch(rp),
						anchorLength: point.anchorLength,
						anchorLengthVertical: point.anchorLengthVertical,
						markerPosition:
							SRBXApiCompat.getRailPositionConnectionMarkerPosition(
								rp,
							),
						core: corePos,
						index,
						cantEdge: -SRBXApiCompat.getRailPositionCantEdge(rp),
						cantCenter: point.cantCenter,
						cantRandom: point.cantRandom,
					};
				}
			}
	return best;
}

function staysBeforeCurveCenter(
	start: SRBXBuilderPoint,
	end: SRBXBuilderPoint,
	distance: number,
): boolean {
	const offsetStart = offsetPoint(start, start.anchorYaw, distance);
	const offsetEnd = offsetPoint(
		end,
		SRBXMath.normalizeDegrees(end.anchorYaw + 180),
		distance,
	);
	const sourceX = end.position[0] - start.position[0];
	const sourceZ = end.position[2] - start.position[2];
	const offsetX = offsetEnd.position[0] - offsetStart.position[0];
	const offsetZ = offsetEnd.position[2] - offsetStart.position[2];
	const sourceLengthSquared = sourceX * sourceX + sourceZ * sourceZ;
	return (
		sourceLengthSquared > 0.000001 &&
		sourceX * offsetX + sourceZ * offsetZ > sourceLengthSquared * 0.01
	);
}

function buildParallelPlan(
	entity: EntityVehicle,
	partialTicks: number,
	state: EditorState,
	target?: SelectedRail,
	fixedOffset?: number,
): ParallelPlan | null {
	const selected = target || state.selectedRails[0];
	if (!selected) return null;
	const resolved = resolveRail(entity, selected);
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!resolved || !looking) return null;
	const split = 1000;
	const center = railPoint(resolved.map, split, split / 2);
	const yaw = RTMApiCompat.getRailYaw(resolved.map, split, split / 2);
	const normal = horizontalNormal(yaw);
	let offset =
		fixedOffset === undefined
			? (looking.posX - center[0]) * normal[0] +
				(looking.posZ - center[2]) * normal[1]
			: fixedOffset;
	if (fixedOffset === undefined)
		offset = state.snapEnabled
			? roundSnap(offset)
			: roundCentimeter(offset);
	if (Math.abs(offset) < PARALLEL_MIN_OFFSET) return null;
	const sourceStart = sourcePoint(resolved.positions[0]);
	const sourceEnd = sourcePoint(resolved.positions[1]);
	if (!staysBeforeCurveCenter(sourceStart, sourceEnd, offset)) return null;
	let start = offsetPoint(sourceStart, sourceStart.anchorYaw, offset);
	let end = offsetPoint(
		sourceEnd,
		SRBXMath.normalizeDegrees(sourceEnd.anchorYaw + 180),
		offset,
	);
	const startConnection = connectionCandidate(
		entity,
		start,
		resolved.target.railKey,
	);
	const endConnection = connectionCandidate(
		entity,
		end,
		resolved.target.railKey,
	);
	if (startConnection && !endConnection) {
		const delta: SRBXVec3 = [
			startConnection.position[0] - start.position[0],
			startConnection.position[1] - start.position[1],
			startConnection.position[2] - start.position[2],
		];
		start = startConnection;
		end.position = SRBXMath.roundPosition(
			[
				end.position[0] + delta[0],
				end.position[1] + delta[1],
				end.position[2] + delta[2],
			],
			0.001,
		);
	} else if (!startConnection && endConnection) {
		const delta: SRBXVec3 = [
			endConnection.position[0] - end.position[0],
			endConnection.position[1] - end.position[1],
			endConnection.position[2] - end.position[2],
		];
		end = endConnection;
		start.position = SRBXMath.roundPosition(
			[
				start.position[0] + delta[0],
				start.position[1] + delta[1],
				start.position[2] + delta[2],
			],
			0.001,
		);
	} else {
		if (startConnection) start = startConnection;
		if (endConnection) end = endConnection;
	}
	const sourceChord = SRBXMath.horizontalDistance(
		sourceStart.position,
		sourceEnd.position,
	);
	const offsetChord = SRBXMath.horizontalDistance(
		start.position,
		end.position,
	);
	const anchorScale = sourceChord > 0.001 ? offsetChord / sourceChord : 1;
	start.anchorLength *= anchorScale;
	end.anchorLength *= anchorScale;
	if (start.anchorLengthVertical !== undefined)
		start.anchorLengthVertical *= anchorScale;
	if (end.anchorLengthVertical !== undefined)
		end.anchorLengthVertical *= anchorScale;
	if (start.kind === "free") setDefaultOwner(start);
	if (end.kind === "free") setDefaultOwner(end);
	return {
		target: {
			core: [
				resolved.target.core[0],
				resolved.target.core[1],
				resolved.target.core[2],
			],
			railKey: resolved.target.railKey,
		},
		originalStart: sourceStart.position,
		originalEnd: sourceEnd.position,
		originalStartPoint: sourceStart,
		originalEndPoint: sourceEnd,
		start,
		end,
		offset,
	};
}

function buildParallelPlans(
	entity: EntityVehicle,
	partialTicks: number,
	state: EditorState,
): ParallelPlan[] {
	if (state.selectedRails.length === 0) return [];
	const first = buildParallelPlan(
		entity,
		partialTicks,
		state,
		state.selectedRails[0],
	);
	if (!first) return [];
	const result = [first];
	for (let i = 1; i < state.selectedRails.length; i++) {
		const plan = buildParallelPlan(
			entity,
			partialTicks,
			state,
			state.selectedRails[i],
			first.offset,
		);
		if (!plan) return [];
		result.push(plan);
	}
	return result;
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

function controlPoint(point: SRBXBuilderPoint): SRBXVec3 {
	const horizontal = SRBXMath.pointAtYawPitchDistance(
		point.position,
		point.anchorYaw,
		0,
		point.anchorLength,
	);
	const verticalLength =
		point.anchorLengthVertical === undefined
			? point.anchorLength
			: point.anchorLengthVertical;
	return [
		horizontal[0],
		point.position[1] +
			Math.sin((point.anchorPitch * Math.PI) / 180) * verticalLength,
		horizontal[2],
	];
}

function renderLine(
	entity: EntityVehicle,
	partialTicks: number,
	start: SRBXVec3,
	end: SRBXVec3,
): void {
	const origin = NGTOBuilderUtilClient.getInterpolatedPos(
		entity,
		partialTicks,
	);
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const dz = end[2] - start[2];
	const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
	if (length <= 0.0001) return;
	GL11.glPushMatrix();
	GL11.glTranslatef(
		(start[0] + end[0]) / 2 - origin[0],
		(start[1] + end[1]) / 2 - origin[1],
		(start[2] + end[2]) / 2 - origin[2],
	);
	GL11.glRotatef((Math.atan2(dx, dz) * 180) / Math.PI, 0, 1, 0);
	GL11.glRotatef(
		(-Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * 180) / Math.PI,
		1,
		0,
		0,
	);
	GL11.glScalef(1, 1, length / SELECTED_LINE_MODEL_LENGTH);
	selectedLine.render(renderer);
	GL11.glPopMatrix();
}

function renderParallelPlan(
	entity: EntityVehicle,
	partialTicks: number,
	plan: ParallelPlan,
): void {
	const startControl = controlPoint(plan.start);
	const endControl = controlPoint(plan.end);
	const length = SRBXMath.cubicBezierLength(
		plan.start.position,
		startControl,
		endControl,
		plan.end.position,
	);
	const split = Math.max(8, Math.min(128, Math.ceil(length * 2)));
	let previous = plan.start.position;
	for (let i = 1; i <= split; i++) {
		const current = SRBXMath.cubicBezierPoint(
			plan.start.position,
			startControl,
			endControl,
			plan.end.position,
			i / split,
		);
		renderLine(entity, partialTicks, previous, current);
		previous = current;
	}
	renderMarker(entity, partialTicks, plan.start.position, selectedPoint);
	renderMarker(entity, partialTicks, plan.end.position, selectedPoint);
}

function renderRailHighlight(
	entity: EntityVehicle,
	partialTicks: number,
	map: RailMap,
	color: string,
	alpha: number,
): void {
	const origin = NGTOBuilderUtilClient.getInterpolatedPos(
		entity,
		partialTicks,
	);
	GL11.glPushMatrix();
	GL11.glTranslatef(-origin[0], -origin[1], -origin[2]);
	NGTOBuilderUtilClient.renderRailMapHighlight(entity, map, color, alpha);
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
		NGTLog.sendChatMessage(
			sender,
			"--- SuperRailBuilderX レール移動ツール ---",
		);
		NGTLog.sendChatMessage(
			sender,
			"[右クリック] 端点を選択: 片側端点を移動",
		);
		NGTLog.sendChatMessage(
			sender,
			"[右クリック] レール中央を選択/解除: 複数レールを平行移動",
		);
		NGTLog.sendChatMessage(sender, "[右クリック] 移動先を固定");
		NGTLog.sendChatMessage(sender, "[左クリック] 1段階戻る");
		NGTLog.sendChatMessage(sender, keys.getDescription("snap"));
		NGTLog.sendChatMessage(sender, keys.getDescription("apply"));
		NGTLog.sendChatMessage(sender, keys.getDescription("undo"));
		NGTLog.sendChatMessage(sender, keys.getDescription("exit"));
	}
	if (keys.down("exit")) dataMap.setBoolean("isEndEdit", true, 1);
	if (keys.pressed("snap")) {
		state.snapEnabled = !state.snapEnabled;
		if (state.stage === 2) {
			state.stage = 1;
			state.destination = null;
			state.parallelPlans = [];
		}
		NGTLog.sendChatMessage(
			sender,
			`[SuperRailBuilderX] 0.1mスナップ: ${state.snapEnabled ? "ON" : "OFF"}`,
		);
	}
	if (leftClick) {
		if (state.stage === 2) {
			state.stage = 1;
			state.destination = null;
			state.parallelPlans = [];
		} else if (state.stage === 1) {
			if (state.selected) {
				state.selected = null;
				state.stage = 0;
			} else {
				state.selectedRails.pop();
				if (state.selectedRails.length === 0) state.stage = 0;
			}
		}
	}
	if (rightClick && state.stage === 0) {
		const endpoint = nearestCandidate(
			findCandidates(entity, partialTicks, true),
			partialTicks,
		);
		if (endpoint) {
			state.selected = endpoint;
			state.selectedRails = [];
			state.stage = 1;
		} else {
			const rail = findHoverRail(entity, partialTicks);
			if (rail) {
				toggleRailSelection(entity, state, rail);
				state.selected = null;
				state.stage = state.selectedRails.length > 0 ? 1 : 0;
			} else {
				const switchRail =
					lastCandidateScanDiagnostics &&
					lastCandidateScanDiagnostics.switchCores > 0;
				NGTLog.sendChatMessage(
					sender,
					switchRail
						? "§e[SuperRailBuilderX] 分岐器は移動できません"
						: "§e[SuperRailBuilderX] 移動可能なレールが見つかりません",
				);
			}
		}
	} else if (rightClick && state.stage === 1) {
		if (state.selected) {
			state.destination = getDestination(
				entity,
				partialTicks,
				state.snapEnabled,
			);
			if (state.destination) state.stage = 2;
		} else if (state.selectedRails.length > 0) {
			const rail = findHoverRail(entity, partialTicks);
			if (rail) {
				const selection = toggleRailSelection(entity, state, rail);
				if (selection === "not_connected")
					NGTLog.sendChatMessage(
						sender,
						"§e[SuperRailBuilderX] 選択済みレールへ接続するレールだけを追加できます",
					);
				if (state.selectedRails.length === 0) state.stage = 0;
			} else {
				state.parallelPlans = buildParallelPlans(
					entity,
					partialTicks,
					state,
				);
				if (state.parallelPlans.length === state.selectedRails.length)
					state.stage = 2;
				else
					NGTLog.sendChatMessage(
						sender,
						"§e[SuperRailBuilderX] 選択中に平行移動できないレールがあります",
					);
			}
		}
	}
	if (keys.pressed("apply") && state.stage === 2) {
		let request: RailPositionMoveRequest | null = null;
		if (state.selected && state.destination)
			request = {
				mode: "endpoint",
				targets: state.selected.candidates.map((candidate) => ({
					core: [candidate.coreX, candidate.coreY, candidate.coreZ],
					index: candidate.index,
					original: candidate.position,
				})),
				destination: state.destination,
			};
		else if (state.parallelPlans.length > 0) {
			const excluded: { [key: string]: boolean } = {};
			for (let i = 0; i < state.selectedRails.length; i++)
				excluded[state.selectedRails[i].railKey] = true;
			const plans = state.parallelPlans.map((plan) =>
				parallelRequest(entity, plan, excluded),
			);
			const connectedSeen: { [key: string]: boolean } = {};
			for (let i = 0; i < plans.length; i++) {
				const moves = plans[i].connectedMoves || [];
				plans[i].connectedMoves = moves.filter((move) => {
					const key = `${move.target.core[0]},${move.target.core[1]},${move.target.core[2]}:${move.target.index}`;
					if (connectedSeen[key]) return false;
					connectedSeen[key] = true;
					return true;
				});
			}
			request = {
				action: "move",
				mode: "parallel_multi",
				plans,
			};
		}
		if (!request) return;
		NGTOBuilderUtil.sendJsonData(dataMap, "railPositionMove", request);
		dataMap.setString("applyResult", "waiting", 1);
		state.awaitingResult = true;
		state.pendingAction = "move";
		NGTLog.sendChatMessage(sender, "[SuperRailBuilderX] 移動・再生成中...");
	}
	const result = dataMap.getString("applyResult");
	if (state.awaitingResult && result !== "" && result !== "waiting") {
		state.awaitingResult = false;
		const updatedCores =
			NGTOBuilderUtil.getJsonData<Array<[number, number, number]>>(
				dataMap,
				"railPositionUpdatedCores",
			) || [];
		const refreshed: { [key: string]: boolean } = {};
		const world = SRBXApiCompat.getWorld(entity);
		for (let i = 0; i < updatedCores.length; i++) {
			const pos = updatedCores[i];
			const tile = SRBXApiCompat.getTileEntity(
				world,
				pos[0],
				pos[1],
				pos[2],
			);
			if (!(tile instanceof TileEntityLargeRailBase)) continue;
			const core = tile.getRailCore();
			if (!core) continue;
			const key = SRBXApiCompat.getRailPositionCandidateKey(core);
			refreshed[key] = true;
			delete state.ignoredRailKeys[key];
			SRBXApiCompat.refreshRailCoreClient(core);
		}
		const removed =
			NGTOBuilderUtil.getJsonData<
				Array<{ core: RailCorePos; key: string }>
			>(dataMap, "railPositionRemovedRails") || [];
		for (let i = 0; i < removed.length; i++)
			if (!refreshed[removed[i].key]) {
				state.ignoredRailKeys[removed[i].key] = true;
				SRBXApiCompat.removeRailClientGhost(
					world,
					removed[i].core,
					removed[i].key,
				);
			}
		NGTOBuilderUtil.resetJsonData(dataMap, "railPositionUpdatedCores");
		NGTOBuilderUtil.resetJsonData(dataMap, "railPositionRemovedRails");
		if (result === "undo_ok" && state.pendingAction === "undo") {
			NGTLog.sendChatMessage(
				sender,
				"§a[SuperRailBuilderX] 移動前の状態へ戻しました",
			);
			state.stage = 0;
			state.selected = null;
			state.selectedRails = [];
			state.destination = null;
			state.parallelPlans = [];
		} else if (
			result === "ok" ||
			result === "ok_sectioned" ||
			result === "ok_normal_crossing"
		) {
			NGTLog.sendChatMessage(
				sender,
				"§a[SuperRailBuilderX] 移動・再生成しました",
			);
			if (result === "ok_normal_crossing")
				NGTLog.sendChatMessage(
					sender,
					"§e[SuperRailBuilderX] セクションコアを安全に配置できないため通常レールとして生成しました",
				);
			state.stage = 0;
			state.selected = null;
			state.selectedRails = [];
			state.destination = null;
			state.parallelPlans = [];
		} else {
			NGTLog.sendChatMessage(
				sender,
				`§c[SuperRailBuilderX] 適用失敗: ${result}`,
			);
		}
		state.pendingAction = null;
		dataMap.setString("applyResult", "", 1);
	}
	if (keys.pressed("undo") && !state.awaitingResult) {
		NGTOBuilderUtil.sendJsonData(dataMap, "railPositionMove", {
			action: "undo",
		} as RailPositionMoveRequest);
		dataMap.setString("applyResult", "waiting", 1);
		state.awaitingResult = true;
		state.pendingAction = "undo";
		NGTLog.sendChatMessage(sender, "[SuperRailBuilderX] Undo...");
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
	const world = SRBXApiCompat.getWorld(entity);
	const player = MCWrapperClient.getPlayer();
	const hostId = dataMap.getString("hostPlayerEntityId");
	const host = hostId
		? (world.getEntityByID(Number(hostId)) as unknown as EntityPlayer)
		: null;
	if (!host || host !== player) return;
	SRBXApiCompat.doFollowing(entity, host);
	const state = getState(entity);
	const candidates =
		!state.awaitingResult && state.stage === 0
			? findCandidates(entity, partialTicks)
			: [];
	for (let i = 0; i < candidates.length; i++)
		renderMarker(entity, partialTicks, candidates[i].position, point);
	const hoverRail =
		!state.awaitingResult && state.stage <= 1 && !state.selected
			? findHoverRail(entity, partialTicks)
			: null;
	let hoverSelected = false;
	if (hoverRail)
		for (let i = 0; i < state.selectedRails.length; i++)
			if (sameRail(state.selectedRails[i], hoverRail)) {
				hoverSelected = true;
				break;
			}
	if (state.selected)
		renderMarker(
			entity,
			partialTicks,
			state.selected.position,
			selectedPoint,
		);
	for (
		let i = 0;
		!state.awaitingResult && i < state.selectedRails.length;
		i++
	) {
		const resolved = resolveRail(entity, state.selectedRails[i]);
		if (resolved)
			renderRailHighlight(
				entity,
				partialTicks,
				resolved.map,
				hoverSelected &&
					hoverRail &&
					sameRail(state.selectedRails[i], hoverRail)
					? "009999"
					: "00ffff",
				0.65,
			);
	}
	if (hoverRail && !hoverSelected && candidates.length === 0) {
		const resolved = resolveRail(entity, hoverRail);
		if (resolved)
			renderRailHighlight(
				entity,
				partialTicks,
				resolved.map,
				"ffff00",
				0.6,
			);
	}
	const endpointPreview =
		!state.awaitingResult && state.selected && state.stage === 1
			? getDestination(entity, partialTicks, state.snapEnabled)
			: state.destination;
	if (endpointPreview)
		renderMarker(entity, partialTicks, endpointPreview, point);
	const parallelPreview =
		!state.awaitingResult && state.selectedRails.length > 0
			? state.stage === 1
				? buildParallelPlans(entity, partialTicks, state)
				: state.parallelPlans
			: [];
	for (let i = 0; i < parallelPreview.length; i++)
		renderParallelPlan(entity, partialTicks, parallelPreview[i]);
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
