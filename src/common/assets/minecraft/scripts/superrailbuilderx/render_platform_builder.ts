import { SRBXPlatformGeometry } from "./SRBXPlatformGeometry";
import { SRBXToolWheel } from "./SRBXToolWheel";
import { SRBXToolGui } from "./SRBXToolGui";
import { ResourceLocation } from "net.minecraft.util";
import { SRBXRailHighlight } from "./SRBXRailHighlight";
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
import { SRBXInputManager as InputManager } from "./SRBXInputManager";
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
	PlatformBuilderPlan,
	PlatformBuilderRequest,
} from "./server_platform_builder";

declare const renderer: VehiclePartsRenderer;
const GUI_TOOL_ICON = new ResourceLocation(
	"minecraft",
	"textures/superrailbuilderx/icon_platform_builder.png",
);

const DEFAULT_SPACING = 2;
const DEFAULT_HEIGHT = 1.5;
const HEIGHT_STEP = 1 / 16;
const SPACING_STEP = 0.1;
const MIN_SPACING = 0.1;
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
	pendingCreateSelection: SelectedRail[] | null;
	lastCreatedSelection: SelectedRail[] | null;
	lockedPlans: PlatformBuilderPlan[];
	placementLocked: boolean;
	spacing: number;
	height: number;
	side: number;
	repeatCount: number;
	keyRepeatAt: { [name: string]: number };
	awaitingResult: boolean;
	pendingAction: "create" | "undo" | null;
	ignoredRailKeys: { [key: string]: boolean };
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
	keys.register("create", Keyboard.KEY_RETURN, false, "組ホームを生成");
	keys.register("clear", Keyboard.KEY_C, false, "選択と状態をリセット");
	keys.register("spacingUp", Keyboard.KEY_RIGHT, false, "間隔+0.1m");
	keys.register("spacingDown", Keyboard.KEY_LEFT, false, "間隔-0.1m");
	keys.register("heightUp", Keyboard.KEY_UP, false, "高さ+1/16m");
	keys.register("heightDown", Keyboard.KEY_DOWN, false, "高さ-1/16m");
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
			pendingCreateSelection: null,
			lastCreatedSelection: null,
			lockedPlans: [],
			placementLocked: false,
			spacing: DEFAULT_SPACING,
			height: DEFAULT_HEIGHT,
			side: 1,
			repeatCount: 0,
			keyRepeatAt: {},
			awaitingResult: false,
			pendingAction: null,
			ignoredRailKeys: {},
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
		stateIgnoredRail(entity, target.railKey) ||
		SRBXApiCompat.getRailPositionCandidateKey(core) !== target.railKey
	)
		return null;
	const map = SRBXApiCompat.getLogicalRailMap(core);
	if (!map) return null;
	const positions = SRBXApiCompat.getEditableRailPositions(core);
	if (!positions || positions.length !== 2 || !positions[0] || !positions[1])
		return null;
	return { target, map, positions };
}

function stateIgnoredRail(entity: EntityVehicle, railKey: string): boolean {
	const state = states.get(entity);
	return !!state && state.ignoredRailKeys[railKey] === true;
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
				if (
					!core ||
					SRBXApiCompat.getRailPositionUnsupportedReason(core)
				)
					continue;
				const positions = SRBXApiCompat.getEditableRailPositions(core);
				if (
					!positions ||
					positions.length !== 2 ||
					!positions[0] ||
					!positions[1]
				)
					continue;
				const railKey = SRBXApiCompat.getRailPositionCandidateKey(core);
				if (seen[railKey] || stateIgnoredRail(entity, railKey))
					continue;
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

function horizontalNormal(yaw: number): [number, number] {
	const radians = (yaw * Math.PI) / 180;
	return [Math.cos(radians), -Math.sin(radians)];
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

function planLength(plan: PlatformBuilderPlan): number {
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
	const yaw = RTMApiCompat.getRailYaw(first.map, split, split / 2);
	const normal = horizontalNormal(yaw);
	const projection =
		(looking.posX - center[0]) * normal[0] +
		(looking.posZ - center[2]) * normal[1];
	if (Math.abs(projection) > 0.05) state.side = projection >= 0 ? 1 : -1;
	state.repeatCount = 1;
}

function buildPlans(
	entity: EntityVehicle,
	partialTicks: number,
	state: CopyState,
): PlatformBuilderPlan[] {
	if (!state.placementLocked) updateSide(entity, partialTicks, state);
	if (!state.repeatCount) return [];
	const plans: PlatformBuilderPlan[] = [];
	for (let i = 0; i < state.selected.length; i++) {
		const resolved = resolveRail(entity, state.selected[i]);
		if (!resolved) continue;
		const pair = SRBXPlatformGeometry.offset(
			resolved.positions[0],
			resolved.positions[1],
			state.spacing * state.side,
			state.height,
		);
		if (!pair) continue;
		const plan: PlatformBuilderPlan = {
			sourceCore: copyTarget(resolved.target).core,
			sourceRailKey: resolved.target.railKey,
			sourceStart: [
				resolved.positions[0].posX,
				resolved.positions[0].posY,
				resolved.positions[0].posZ,
			],
			sourceEnd: [
				resolved.positions[1].posX,
				resolved.positions[1].posY,
				resolved.positions[1].posZ,
			],
			start: pair.start,
			end: pair.end,
		};
		if (planLength(plan) > MIN_RAIL_LENGTH) plans.push(plan);
	}
	SRBXPlatformGeometry.assignOwners(plans);
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
	plan: PlatformBuilderPlan,
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
	SRBXRailHighlight.render(entity, map, color, alpha);
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

function showHelp(sender: ICommandSender): void {
	if (SRBXApiCompat.requiresRailBoundarySnap())
		NGTLog.sendChatMessage(
			sender,
			"接続端点はブロック境界へ合わせます。既設の内部端点への接続はできません。",
		);
	NGTLog.sendChatMessage(sender, "--- SuperRailBuilderX 組ホーム ---");
	NGTLog.sendChatMessage(sender, "[右クリック] レールを選択/選択解除");
	NGTLog.sendChatMessage(sender, "[空間を右クリック] 展開方向を確定");
	NGTLog.sendChatMessage(
		sender,
		"[左クリック] 位置確定/最後の選択を取り消す",
	);
	NGTLog.sendChatMessage(sender, keys.getDescription("spacingUp"));
	NGTLog.sendChatMessage(sender, keys.getDescription("spacingDown"));
	NGTLog.sendChatMessage(sender, keys.getDescription("heightUp"));
	NGTLog.sendChatMessage(sender, keys.getDescription("heightDown"));
	NGTLog.sendChatMessage(
		sender,
		"手持ちのレールモデルで右または左に1列生成します",
	);
	NGTLog.sendChatMessage(sender, keys.getDescription("clear"));
	NGTLog.sendChatMessage(sender, keys.getDescription("create"));
	NGTLog.sendChatMessage(sender, keys.getDescription("undo"));
	NGTLog.sendChatMessage(sender, keys.getDescription("exit"));
	SRBXToolGui.helpFooter(sender);
}

function sendRequest(
	entity: EntityVehicle,
	state: CopyState,
	request: PlatformBuilderRequest,
): void {
	const dataMap = entity.getResourceState().getDataMap();
	NGTOBuilderUtil.sendJsonData(dataMap, "platformBuilderRequest", request);
	dataMap.setString("platformBuilderResult", "waiting", 1);
	state.awaitingResult = true;
	state.pendingAction = request.action;
}

function handleResult(
	sender: ICommandSender,
	entity: EntityVehicle,
	state: CopyState,
): void {
	const dataMap = entity.getResourceState().getDataMap();
	const result = dataMap.getString("platformBuilderResult");
	if (!state.awaitingResult || !state.pendingAction) return;
	if (!result || result === "waiting") return;
	const pendingAction = state.pendingAction;
	state.awaitingResult = false;
	const removed =
		NGTOBuilderUtil.getJsonData<Array<{ core: RailCorePos; key: string }>>(
			dataMap,
			"platformBuilderRemovedRails",
		) || [];
	for (let i = 0; i < removed.length; i++) {
		state.ignoredRailKeys[removed[i].key] = true;
		SRBXApiCompat.removeRailClientGhost(
			SRBXApiCompat.getWorld(entity),
			removed[i].core,
			removed[i].key,
		);
	}
	NGTOBuilderUtil.resetJsonData(dataMap, "platformBuilderRemovedRails");
	if (result === "ok" && pendingAction === "create") {
		state.lastCreatedSelection = state.pendingCreateSelection;
		state.selected = [];
		state.actions = [];
		state.lockedPlans = [];
		state.placementLocked = false;
		state.repeatCount = 0;
		NGTLog.sendChatMessage(
			sender,
			"§a[SuperRailBuilderX] 組ホームを生成しました",
		);
	} else if (result === "undo_ok" && pendingAction === "undo") {
		dataMap.setBoolean("platformBuilderCanUndo", false, 0);
		state.selected = state.lastCreatedSelection
			? state.lastCreatedSelection.map(copyTarget)
			: [];
		state.actions = state.selected.map((target, index) => ({
			type: "select" as "select",
			target: copyTarget(target),
			index,
		}));
		state.lastCreatedSelection = null;
		state.lockedPlans = [];
		state.placementLocked = false;
		state.repeatCount = 0;
		NGTLog.sendChatMessage(
			sender,
			"§a[SuperRailBuilderX] 直前に生成した組ホームを撤去しました",
		);
	} else {
		NGTLog.sendChatMessage(
			sender,
			`§c[SuperRailBuilderX] 処理失敗: ${result}`,
		);
	}
	state.pendingAction = null;
	state.pendingCreateSelection = null;
	dataMap.setString("platformBuilderResult", "", 1);
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
	state.placementLocked = false;
	state.lockedPlans = [];
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
	if (!state.awaitingResult && leftClick) {
		if (state.placementLocked) {
			state.placementLocked = false;
			state.lockedPlans = [];
			NGTLog.sendChatMessage(
				sender,
				"§e[SuperRailBuilderX] 展開方向の確定を解除しました",
			);
		} else undoSelection(state);
	}
	if (!state.awaitingResult && rightClick) {
		const target = findHoverRail(entity, partialTicks);
		if (target) toggleSelection(state, target);
		else if (state.selected.length > 0) {
			state.placementLocked = false;
			const plans = buildPlans(entity, partialTicks, state);
			if (plans.length > 0) {
				state.lockedPlans = plans;
				state.placementLocked = true;
				NGTLog.sendChatMessage(
					sender,
					"§a[SuperRailBuilderX] 展開方向を確定しました。Enterで生成します",
				);
			} else
				NGTLog.sendChatMessage(
					sender,
					"§e[SuperRailBuilderX] 生成可能な2m超の組ホームがありません",
				);
		} else
			NGTLog.sendChatMessage(
				sender,
				"§e[SuperRailBuilderX] 選択可能な通常レールが見つかりません",
			);
	}
	let spacingChanged = false;
	if (!state.awaitingResult && repeatedKey(state, "spacingUp")) {
		state.spacing = SRBXMath.roundToStep(
			Math.min(512, state.spacing + SPACING_STEP),
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
	if (!state.awaitingResult && repeatedKey(state, "heightUp")) {
		state.height = Math.min(
			256,
			SRBXMath.roundToStep(state.height + HEIGHT_STEP, HEIGHT_STEP),
		);
		spacingChanged = true;
	}
	if (!state.awaitingResult && repeatedKey(state, "heightDown")) {
		state.height = Math.max(
			-256,
			SRBXMath.roundToStep(state.height - HEIGHT_STEP, HEIGHT_STEP),
		);
		spacingChanged = true;
	}
	if (spacingChanged) {
		state.placementLocked = false;
		state.lockedPlans = [];
	}
	if (!state.awaitingResult && keys.pressed("clear")) {
		state.selected = [];
		state.actions = [];
		state.spacing = DEFAULT_SPACING;
		state.height = DEFAULT_HEIGHT;
		state.side = 1;
		state.repeatCount = 0;
		state.lockedPlans = [];
		state.placementLocked = false;
		state.keyRepeatAt = {};
	}
	if (
		!state.awaitingResult &&
		keys.pressed("create") &&
		state.selected.length > 0
	) {
		const plans = state.placementLocked ? state.lockedPlans : [];
		if (plans.length === 0)
			NGTLog.sendChatMessage(
				sender,
				"§e[SuperRailBuilderX] 先に空間を右クリックして展開方向を確定してください",
			);
		else {
			state.pendingCreateSelection = state.selected.map(copyTarget);
			sendRequest(entity, state, {
				action: "create",
				plans,
				spacing: state.spacing,
				height: state.height,
				side: state.side,
			});
			NGTLog.sendChatMessage(
				sender,
				"[SuperRailBuilderX] 組ホームを生成中...",
			);
		}
	}
	if (
		!state.awaitingResult &&
		keys.pressed("undo") &&
		dataMap.getBoolean("platformBuilderCanUndo")
	) {
		sendRequest(entity, state, { action: "undo" });
		NGTLog.sendChatMessage(sender, "[SuperRailBuilderX] Undo...");
	}
	handleResult(sender, entity, state);
}

function formatPlatformHeight(height: number): string {
	let value = height.toFixed(4);
	while (value.charAt(value.length - 1) === "0")
		value = value.substring(0, value.length - 1);
	if (value.charAt(value.length - 1) === ".") value += "0";
	return value;
}

function renderToolGui(state: CopyState): void {
	SRBXToolGui.render("組ホーム", GUI_TOOL_ICON, [
		{ iconX: 4, iconY: 2, label: `間隔:${state.spacing.toFixed(1)}m` },
		{
			iconX: 6,
			iconY: 0,
			label: `高さ:${formatPlatformHeight(state.height)}m`,
		},
	]);
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
	if (SRBXToolWheel.update(entity, renderer.currentMatId === 0 && pass === 0))
		return;
	const state = getState(entity);
	const hover = findHoverRail(entity, partialTicks);
	let hoverSelected = false;
	if (hover)
		for (let i = 0; i < state.selected.length; i++)
			if (sameTarget(state.selected[i], hover)) {
				hoverSelected = true;
				break;
			}
	for (let i = 0; i < state.selected.length; i++) {
		const resolved = resolveRail(entity, state.selected[i]);
		if (resolved)
			renderRailHighlight(
				entity,
				partialTicks,
				resolved.map,
				hoverSelected && hover && sameTarget(state.selected[i], hover)
					? "009999"
					: "00ffff",
				0.65,
			);
	}
	if (hover && !hoverSelected) {
		const resolved = resolveRail(entity, hover);
		if (resolved) {
			renderRailHighlight(
				entity,
				partialTicks,
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
	} else if (hover && hoverSelected) {
		const resolved = resolveRail(entity, hover);
		if (resolved) {
			const split = 1000;
			renderCursor(
				entity,
				partialTicks,
				railPoint(resolved.map, split, split / 2),
				selectedCursor,
			);
		}
	}
	if (state.selected.length > 0) {
		const plans = state.placementLocked
			? state.lockedPlans
			: buildPlans(entity, partialTicks, state);
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
	if (!isOpenGUI && renderer.currentMatId === 0 && pass === 0) {
		handleInput(
			host,
			entity,
			partialTicks,
			!prevRight && right,
			!prevLeft && left,
		);
		renderToolGui(state);
	}
}
