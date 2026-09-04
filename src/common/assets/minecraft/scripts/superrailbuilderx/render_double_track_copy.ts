import { NGTLog } from "jp.ngt.ngtlib.io";
import { MCWrapperClient, NGTUtilClient } from "jp.ngt.ngtlib.util";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ModelSetVehicle } from "jp.ngt.rtm.modelpack.modelset";
import { ModelObject, Parts, VehiclePartsRenderer } from "jp.ngt.rtm.render";
import { TileEntityLargeRailBase } from "jp.ngt.rtm.rail";
import { RailMap, RailPosition } from "jp.ngt.rtm.rail.util";
import { ICommandSender } from "net.minecraft.command";
import { EntityPlayer } from "net.minecraft.entity.player";
import { System } from "java.lang";
import { WeakHashMap } from "java.util";
import { Keyboard, Mouse } from "org.lwjgl.input";
import { GL11 } from "org.lwjgl.opengl";
import { InputManager } from "../lib_hi03toolkit_1_0/lib_InputManager";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import { NGTOBuilderUtilClient } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtilClient";
import {
	RailCorePos,
	SRBXApiCompat,
	SRBXBuilderPoint,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath, SRBXVec3 } from "./SRBXMath";
import {
	DoubleTrackCopyPlan,
	DoubleTrackCopyRequest,
} from "./server_double_track_copy";

declare const renderer: VehiclePartsRenderer;

const DEFAULT_SPACING = 4;
const SPACING_STEP = 0.1;
const MIN_SPACING = 0.1;
const SNAP_RADIUS = 0.5;
const MIN_RAIL_LENGTH = 2;
const SELECTED_LINE_MODEL_LENGTH = 0.6225;
const KEY_REPEAT_DELAY_MS = 350;
const KEY_REPEAT_INTERVAL_MS = 75;

type SelectedRail = { core: RailCorePos; railKey: string };
type SelectionAction = {
	type: "select" | "deselect";
	target: SelectedRail;
	index: number;
};
type ResolvedRail = {
	target: SelectedRail;
	map: RailMap;
	positions: JavaObjectArray<RailPosition>;
};
type CopyState = {
	selected: SelectedRail[];
	actions: SelectionAction[];
	spacing: number;
	side: number;
	repeatCount: number;
	keyRepeatAt: { [name: string]: number };
	awaitingResult: boolean;
	pendingAction: "create" | "undo" | null;
};

let keys: InputManager;
let body: Parts;
let selectCursor: Parts;
let selectedCursor: Parts;
let selectedLine: Parts;
const states: WeakHashMap<EntityVehicle, CopyState> = new WeakHashMap();

function init(par1: ModelSetVehicle, par2: ModelObject): void {
	void par1;
	void par2;
	keys = new InputManager();
	keys.setOptionKey(Keyboard.KEY_LCONTROL);
	keys.register("help", Keyboard.KEY_H, false, "ヘルプを表示");
	keys.register("exit", Keyboard.KEY_Q, false, "ツールを終了");
	keys.register("create", Keyboard.KEY_RETURN, false, "複線を生成");
	keys.register("clear", Keyboard.KEY_C, false, "選択と状態をリセット");
	keys.register("spacingUp", Keyboard.KEY_RIGHT, false, "間隔+0.1m");
	keys.register("spacingDown", Keyboard.KEY_LEFT, false, "間隔-0.1m");
	keys.register("undo", Keyboard.KEY_Z, true, "直前の生成を取り消す");
	body = renderer.registerParts(new Parts("body"));
	selectCursor = renderer.registerParts(new Parts("selectCursor"));
	selectedCursor = renderer.registerParts(new Parts("selectedCursor"));
	selectedLine = renderer.registerParts(new Parts("selectedLine"));
}

function getState(entity: EntityVehicle): CopyState {
	let state = states.get(entity);
	if (!state) {
		state = {
			selected: [],
			actions: [],
			spacing: DEFAULT_SPACING,
			side: 1,
			repeatCount: 0,
			keyRepeatAt: {},
			awaitingResult: false,
			pendingAction: null,
		};
		states.put(entity, state);
	}
	return state;
}

function copyTarget(target: SelectedRail): SelectedRail {
	return {
		core: [target.core[0], target.core[1], target.core[2]],
		railKey: target.railKey,
	};
}

function sameTarget(a: SelectedRail, b: SelectedRail): boolean {
	return a.railKey === b.railKey;
}

function resolveRail(
	entity: EntityVehicle,
	target: SelectedRail,
): ResolvedRail | null {
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
	if (!map) return null;
	const positions = SRBXApiCompat.getEditableRailPositions(core);
	if (!positions || positions.length !== 2) return null;
	return { target, map, positions };
}

function railPoint(map: RailMap, split: number, index: number): SRBXVec3 {
	const pos = map.getRailPos(split, index);
	return [pos[1], map.getRailHeight(split, index), pos[0]];
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
	for (let dx = -1; dx <= 1; dx++) {
		for (let dy = -1; dy <= 1; dy++) {
			for (let dz = -1; dz <= 1; dz++) {
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
				const map = SRBXApiCompat.getLogicalRailMap(core);
				if (!map) continue;
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
				best = { core: SRBXApiCompat.getRailCorePos(core), railKey };
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
		cantEdge: SRBXApiCompat.getRailPositionCantEdge(rp),
		cantCenter: SRBXApiCompat.getRailPositionCantCenter(rp),
		cantRandom: SRBXApiCompat.getRailPositionCantRandom(rp),
	};
}

function horizontalNormal(yaw: number): [number, number] {
	const radians = (yaw * Math.PI) / 180;
	return [Math.cos(radians), -Math.sin(radians)];
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

function defaultOwnerBlock(point: SRBXBuilderPoint): RailCorePos {
	const direction = SRBXMath.directionFromYaw(point.anchorYaw);
	const radians = (direction * 45 * Math.PI) / 180;
	return [
		Math.floor(point.position[0] + Math.sin(radians) * 0.000001),
		Math.floor(point.position[1] - 1 / 16 + 0.000001),
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

function connectOwner(point: SRBXBuilderPoint): RailCorePos {
	const owner = point.ownerBlock || defaultOwnerBlock(point);
	const direction = SRBXMath.directionFromYaw(point.anchorYaw);
	const revision = RailPosition.REVISION[direction];
	return [
		Math.floor(owner[0] + 0.5 + revision[0] * 2),
		owner[1],
		Math.floor(owner[2] + 0.5 + revision[1] * 2),
	];
}

function connectionCandidate(
	entity: EntityVehicle,
	point: SRBXBuilderPoint,
	excluded: { [key: string]: boolean },
): SRBXBuilderPoint | null {
	const world = SRBXApiCompat.getWorld(entity);
	const center = point.position;
	const seen: { [key: string]: boolean } = {};
	let best: SRBXBuilderPoint | null = null;
	let bestDistance = SNAP_RADIUS * SNAP_RADIUS;
	for (
		let x = Math.floor(center[0]) - 1;
		x <= Math.floor(center[0]) + 1;
		x++
	) {
		for (
			let y = Math.floor(center[1]) - 1;
			y <= Math.floor(center[1]) + 1;
			y++
		) {
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
				if (seen[railKey] || excluded[railKey]) continue;
				seen[railKey] = true;
				if (!SRBXApiCompat.getLogicalRailMap(core)) continue;
				const positions = SRBXApiCompat.getEditableRailPositions(core);
				const corePos = SRBXApiCompat.getRailCorePos(core);
				for (let index = 0; index < positions.length; index++) {
					const rp = positions[index] as RailPosition;
					const dx = rp.posX - center[0];
					const dy = rp.posY - center[1];
					const dz = rp.posZ - center[2];
					const distance = dx * dx + dy * dy + dz * dz;
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
		}
	}
	return best;
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

function planLength(plan: DoubleTrackCopyPlan): number {
	return SRBXMath.cubicBezierLength(
		plan.start.position,
		controlPoint(plan.start),
		controlPoint(plan.end),
		plan.end.position,
	);
}

function updateSide(
	entity: EntityVehicle,
	partialTicks: number,
	state: CopyState,
): void {
	state.repeatCount = 0;
	if (state.selected.length === 0) return;
	const first = resolveRail(entity, state.selected[0]);
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!first || !looking) return;
	const split = 1000;
	const center = railPoint(first.map, split, split / 2);
	const yaw = first.map.getRailYaw(split, split / 2);
	const normal = horizontalNormal(yaw);
	const projection =
		(looking.posX - center[0]) * normal[0] +
		(looking.posZ - center[2]) * normal[1];
	if (Math.abs(projection) > 0.05) state.side = projection >= 0 ? 1 : -1;
	state.repeatCount = Math.floor(Math.abs(projection) / state.spacing);
}

function buildPlans(
	entity: EntityVehicle,
	partialTicks: number,
	state: CopyState,
): DoubleTrackCopyPlan[] {
	updateSide(entity, partialTicks, state);
	const plans: DoubleTrackCopyPlan[] = [];
	const excluded: { [key: string]: boolean } = {};
	for (let i = 0; i < state.selected.length; i++)
		excluded[state.selected[i].railKey] = true;
	for (let repeat = 1; repeat <= state.repeatCount; repeat++) {
		for (let i = 0; i < state.selected.length; i++) {
			const resolved = resolveRail(entity, state.selected[i]);
			if (!resolved) continue;
			const sourceStart = sourcePoint(resolved.positions[0]);
			const sourceEnd = sourcePoint(resolved.positions[1]);
			const distance = state.spacing * state.side * repeat;
			let start = offsetPoint(
				sourceStart,
				sourceStart.anchorYaw,
				distance,
			);
			let end = offsetPoint(
				sourceEnd,
				SRBXMath.normalizeDegrees(sourceEnd.anchorYaw + 180),
				distance,
			);
			const sourceChord = SRBXMath.horizontalDistance(
				sourceStart.position,
				sourceEnd.position,
			);
			const offsetChord = SRBXMath.horizontalDistance(
				start.position,
				end.position,
			);
			const anchorScale =
				sourceChord > 0.001 ? offsetChord / sourceChord : 1;
			start.anchorLength *= anchorScale;
			end.anchorLength *= anchorScale;
			if (start.anchorLengthVertical !== undefined)
				start.anchorLengthVertical *= anchorScale;
			if (end.anchorLengthVertical !== undefined)
				end.anchorLengthVertical *= anchorScale;
			start = connectionCandidate(entity, start, excluded) || start;
			end = connectionCandidate(entity, end, excluded) || end;
			const plan = {
				sourceCore: copyTarget(resolved.target).core,
				sourceRailKey: resolved.target.railKey,
				sourceStart: [
					sourceStart.position[0],
					sourceStart.position[1],
					sourceStart.position[2],
				] as RailCorePos,
				sourceEnd: [
					sourceEnd.position[0],
					sourceEnd.position[1],
					sourceEnd.position[2],
				] as RailCorePos,
				start,
				end,
			};
			if (planLength(plan) > MIN_RAIL_LENGTH) plans.push(plan);
		}
	}
	const freePoints: SRBXBuilderPoint[] = [];
	for (let i = 0; i < plans.length; i++) {
		if (plans[i].start.kind === "free") {
			setDefaultOwner(plans[i].start);
			freePoints.push(plans[i].start);
		}
		if (plans[i].end.kind === "free") {
			setDefaultOwner(plans[i].end);
			freePoints.push(plans[i].end);
		}
	}
	const paired: boolean[] = [];
	for (let i = 0; i < freePoints.length; i++) {
		if (paired[i]) continue;
		for (let j = i + 1; j < freePoints.length; j++) {
			if (paired[j]) continue;
			if (
				SRBXMath.distance(
					freePoints[i].position,
					freePoints[j].position,
				) > 0.01
			)
				continue;
			freePoints[j].ownerBlock = connectOwner(freePoints[i]);
			freePoints[j].markerPosition = [
				freePoints[j].ownerBlock![0] + 0.5,
				freePoints[j].position[1],
				freePoints[j].ownerBlock![2] + 0.5,
			];
			paired[i] = true;
			paired[j] = true;
			break;
		}
	}
	return plans;
}

function renderLine(
	entity: EntityVehicle,
	partialTicks: number,
	start: SRBXVec3,
	end: SRBXVec3,
): void {
	const entityPos = NGTOBuilderUtilClient.getInterpolatedPos(
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
		(start[0] + end[0]) / 2 - entityPos[0],
		(start[1] + end[1]) / 2 - entityPos[1],
		(start[2] + end[2]) / 2 - entityPos[2],
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

function renderPlan(
	entity: EntityVehicle,
	partialTicks: number,
	plan: DoubleTrackCopyPlan,
): void {
	const startControl = controlPoint(plan.start);
	const endControl = controlPoint(plan.end);
	const split = Math.max(8, Math.min(128, Math.ceil(planLength(plan) * 2)));
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
}

function renderCursor(
	entity: EntityVehicle,
	partialTicks: number,
	position: SRBXVec3,
	part: Parts,
): void {
	const origin = NGTOBuilderUtilClient.getInterpolatedPos(
		entity,
		partialTicks,
	);
	GL11.glPushMatrix();
	GL11.glTranslatef(
		position[0] - origin[0],
		position[1] - origin[1],
		position[2] - origin[2],
	);
	part.render(renderer);
	GL11.glPopMatrix();
}

function repeatedKey(state: CopyState, name: string): boolean {
	if (!keys.down(name)) {
		delete state.keyRepeatAt[name];
		return false;
	}
	const now = System.currentTimeMillis();
	if (keys.pressed(name)) {
		state.keyRepeatAt[name] = now + KEY_REPEAT_DELAY_MS;
		return true;
	}
	const next = state.keyRepeatAt[name];
	if (next === undefined || now < next) return false;
	state.keyRepeatAt[name] = now + KEY_REPEAT_INTERVAL_MS;
	return true;
}

function showSpacing(sender: ICommandSender, state: CopyState): void {
	NGTLog.sendChatMessage(
		sender,
		`[SuperRailBuilderX] 複線間隔: ${state.spacing.toFixed(1)} m`,
	);
}

function showHelp(sender: ICommandSender): void {
	NGTLog.sendChatMessage(sender, "--- SuperRailBuilderX 複線コピー ---");
	NGTLog.sendChatMessage(sender, "[右クリック] レールを選択/選択解除");
	NGTLog.sendChatMessage(sender, "[左クリック] 最後の選択操作を取り消す");
	NGTLog.sendChatMessage(sender, keys.getDescription("spacingUp"));
	NGTLog.sendChatMessage(sender, keys.getDescription("spacingDown"));
	NGTLog.sendChatMessage(sender, keys.getDescription("clear"));
	NGTLog.sendChatMessage(sender, keys.getDescription("create"));
	NGTLog.sendChatMessage(sender, keys.getDescription("undo"));
	NGTLog.sendChatMessage(sender, keys.getDescription("exit"));
}

function sendRequest(
	entity: EntityVehicle,
	state: CopyState,
	request: DoubleTrackCopyRequest,
): void {
	const dataMap = entity.getResourceState().getDataMap();
	NGTOBuilderUtil.sendJsonData(dataMap, "doubleTrackCopyRequest", request);
	dataMap.setString("doubleTrackCopyResult", "waiting", 1);
	state.awaitingResult = true;
	state.pendingAction = request.action;
}

function handleResult(
	sender: ICommandSender,
	entity: EntityVehicle,
	state: CopyState,
): void {
	const dataMap = entity.getResourceState().getDataMap();
	const result = dataMap.getString("doubleTrackCopyResult");
	if (!result || result === "waiting") return;
	if (result === "ok") {
		state.selected = [];
		state.actions = [];
		NGTLog.sendChatMessage(
			sender,
			"§a[SuperRailBuilderX] 複線を生成しました",
		);
	} else if (result === "undo_ok") {
		NGTLog.sendChatMessage(
			sender,
			"§a[SuperRailBuilderX] 直前に生成した複線を撤去しました",
		);
	} else {
		NGTLog.sendChatMessage(
			sender,
			`§c[SuperRailBuilderX] 処理失敗: ${result}`,
		);
	}
	state.awaitingResult = false;
	state.pendingAction = null;
	dataMap.setString("doubleTrackCopyResult", "", 1);
}

function undoSelection(state: CopyState): void {
	const action = state.actions.pop();
	if (!action) return;
	if (action.type === "select") {
		let index = -1;
		for (let i = 0; i < state.selected.length; i++)
			if (sameTarget(state.selected[i], action.target)) {
				index = i;
				break;
			}
		if (index >= 0) state.selected.splice(index, 1);
	} else {
		state.selected.splice(
			Math.min(action.index, state.selected.length),
			0,
			copyTarget(action.target),
		);
	}
}

function toggleSelection(state: CopyState, target: SelectedRail): void {
	let index = -1;
	for (let i = 0; i < state.selected.length; i++)
		if (sameTarget(state.selected[i], target)) {
			index = i;
			break;
		}
	if (index >= 0) {
		const removed = state.selected.splice(index, 1)[0];
		state.actions.push({
			type: "deselect",
			target: copyTarget(removed),
			index,
		});
	} else {
		state.selected.push(copyTarget(target));
		state.actions.push({
			type: "select",
			target: copyTarget(target),
			index: state.selected.length - 1,
		});
	}
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
	if (!state.awaitingResult && leftClick) undoSelection(state);
	if (!state.awaitingResult && rightClick) {
		const target = findHoverRail(entity, partialTicks);
		if (target) toggleSelection(state, target);
		else
			NGTLog.sendChatMessage(
				sender,
				"§e[SuperRailBuilderX] 選択可能な通常レールが見つかりません",
			);
	}
	let spacingChanged = false;
	if (!state.awaitingResult && repeatedKey(state, "spacingUp")) {
		state.spacing = SRBXMath.roundToStep(
			state.spacing + SPACING_STEP,
			SPACING_STEP,
		);
		spacingChanged = true;
	}
	if (!state.awaitingResult && repeatedKey(state, "spacingDown")) {
		state.spacing = Math.max(
			MIN_SPACING,
			SRBXMath.roundToStep(state.spacing - SPACING_STEP, SPACING_STEP),
		);
		spacingChanged = true;
	}
	if (spacingChanged) showSpacing(sender, state);
	if (!state.awaitingResult && keys.pressed("clear")) {
		state.selected = [];
		state.actions = [];
		state.spacing = DEFAULT_SPACING;
		state.side = 1;
		state.repeatCount = 0;
		state.keyRepeatAt = {};
		showSpacing(sender, state);
	}
	if (
		!state.awaitingResult &&
		keys.pressed("create") &&
		state.selected.length > 0
	) {
		const plans = buildPlans(entity, partialTicks, state);
		if (plans.length === 0)
			NGTLog.sendChatMessage(
				sender,
				"§e[SuperRailBuilderX] 生成可能な2m超の複線がありません",
			);
		else {
			sendRequest(entity, state, { action: "create", plans });
			NGTLog.sendChatMessage(
				sender,
				"[SuperRailBuilderX] 複線を生成中...",
			);
		}
	}
	if (
		!state.awaitingResult &&
		keys.pressed("undo") &&
		dataMap.getBoolean("doubleTrackCopyCanUndo")
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
	for (let i = 0; i < state.selected.length; i++) {
		const resolved = resolveRail(entity, state.selected[i]);
		if (resolved)
			NGTOBuilderUtilClient.renderRailMapHighlight(
				entity,
				resolved.map,
				"00ffff",
				0.65,
			);
	}
	const hover = findHoverRail(entity, partialTicks);
	let hoverSelected = false;
	if (hover)
		for (let i = 0; i < state.selected.length; i++)
			if (sameTarget(state.selected[i], hover)) {
				hoverSelected = true;
				break;
			}
	if (hover && !hoverSelected) {
		const resolved = resolveRail(entity, hover);
		if (resolved) {
			NGTOBuilderUtilClient.renderRailMapHighlight(
				entity,
				resolved.map,
				"ffff00",
				0.6,
			);
			const split = 1000;
			renderCursor(
				entity,
				partialTicks,
				railPoint(resolved.map, split, split / 2),
				selectCursor,
			);
		}
	}
	if (state.selected.length > 0) {
		const plans = buildPlans(entity, partialTicks, state);
		for (let i = 0; i < plans.length; i++) {
			renderPlan(entity, partialTicks, plans[i]);
			renderCursor(
				entity,
				partialTicks,
				plans[i].start.position,
				selectedCursor,
			);
			renderCursor(
				entity,
				partialTicks,
				plans[i].end.position,
				selectedCursor,
			);
		}
	}
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
