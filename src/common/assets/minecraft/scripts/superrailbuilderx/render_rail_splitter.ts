import { NGTLog } from "jp.ngt.ngtlib.io";
import { MCWrapperClient, NGTUtilClient } from "jp.ngt.ngtlib.util";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ModelSetVehicle } from "jp.ngt.rtm.modelpack.modelset";
import { ModelObject, Parts, VehiclePartsRenderer } from "jp.ngt.rtm.render";
import { TileEntityLargeRailBase } from "jp.ngt.rtm.rail";
import { RailMap } from "jp.ngt.rtm.rail.util";
import { ICommandSender } from "net.minecraft.command";
import { EntityPlayer } from "net.minecraft.entity.player";
import { WeakHashMap } from "java.util";
import { Keyboard, Mouse } from "org.lwjgl.input";
import { GL11 } from "org.lwjgl.opengl";
import { InputManager } from "../lib_hi03toolkit_1_0/lib_InputManager";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import { NGTOBuilderUtilClient } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtilClient";
import { SRBXApiCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { RailSplitterRequest } from "./server_rail_splitter";

declare const renderer: VehiclePartsRenderer;

const MIN_RAIL_LENGTH = 2;

type Vec3 = [number, number, number];
type SplitTarget = {
	core: [number, number, number];
	railKey: string;
	ratio: number;
	position: Vec3;
	length: number;
};
type SplitterState = {
	selected: SplitTarget | null;
	awaitingResult: boolean;
	pendingAction: "split" | "undo" | null;
};

let keys: InputManager;
let body: Parts;
let hoverCursor: Parts;
let selectedCursor: Parts;
let decimalDot: Parts;
let meter: Parts;
let digits: Parts[];
const states: WeakHashMap<EntityVehicle, SplitterState> = new WeakHashMap();

function init(par1: ModelSetVehicle, par2: ModelObject): void {
	void par1;
	void par2;
	keys = new InputManager();
	keys.setOptionKey(Keyboard.KEY_LCONTROL);
	keys.register("help", Keyboard.KEY_H, false, "ヘルプを表示");
	keys.register("exit", Keyboard.KEY_Q, false, "ツールを終了");
	keys.register("split", Keyboard.KEY_RETURN, false, "選択位置で線路を分割");
	keys.register("undo", Keyboard.KEY_Z, true, "直前の分割を取り消す");
	body = renderer.registerParts(new Parts("body"));
	hoverCursor = renderer.registerParts(new Parts("selectCursor"));
	selectedCursor = renderer.registerParts(new Parts("selectedCursor"));
	decimalDot = renderer.registerParts(new Parts("distancePanel_decimal"));
	meter = renderer.registerParts(new Parts("distancePanel_M"));
	digits = [];
	for (let i = 0; i <= 9; i++)
		digits.push(renderer.registerParts(new Parts(`distancePanel_${i}`)));
}

function getState(entity: EntityVehicle): SplitterState {
	let state = states.get(entity);
	if (!state) {
		state = { selected: null, awaitingResult: false, pendingAction: null };
		states.put(entity, state);
	}
	return state;
}

function railPoint(map: RailMap, split: number, index: number): Vec3 {
	const pos = map.getRailPos(split, index);
	return [pos[1], map.getRailHeight(split, index), pos[0]];
}

function findHoverTarget(
	entity: EntityVehicle,
	partialTicks: number,
): SplitTarget | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return null;
	const world = SRBXApiCompat.getWorld(entity);
	const seen: { [key: string]: boolean } = {};
	let best: SplitTarget | null = null;
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
				const renderSplit = Math.max(
					1,
					Math.floor(map.getLength() * 2),
				);
				const candidateSplit = Math.max(2, renderSplit * 2);
				const minimumIndex =
					Math.floor(
						(MIN_RAIL_LENGTH * candidateSplit) / map.getLength(),
					) + 1;
				const maximumIndex = candidateSplit - minimumIndex;
				if (minimumIndex > maximumIndex) continue;
				let index = map.getNearlestPoint(
					candidateSplit,
					looking.posX,
					looking.posZ,
				);
				index = Math.max(minimumIndex, Math.min(maximumIndex, index));
				const position = railPoint(map, candidateSplit, index);
				const distance =
					Math.pow(position[0] - looking.posX, 2) +
					Math.pow(position[1] - looking.posY, 2) +
					Math.pow(position[2] - looking.posZ, 2);
				if (distance >= bestDistance) continue;
				bestDistance = distance;
				best = {
					core: SRBXApiCompat.getRailCorePos(core),
					railKey,
					ratio: index / candidateSplit,
					position,
					length: map.getLength(),
				};
			}
		}
	}
	return best;
}

function resolveMap(
	entity: EntityVehicle,
	target: SplitTarget,
): RailMap | null {
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
	return SRBXApiCompat.getLogicalRailMap(core);
}

function renderAt(
	entity: EntityVehicle,
	partialTicks: number,
	position: Vec3,
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
	NGTOBuilderUtilClient.renderRailMapHighlight(entity, map, color, alpha);
	GL11.glPopMatrix();
}

function orientPanel(
	entity: EntityVehicle,
	partialTicks: number,
	position: Vec3,
): void {
	const origin = NGTOBuilderUtilClient.getInterpolatedPos(
		entity,
		partialTicks,
	);
	const dx = origin[0] - position[0];
	const dy = origin[1] - position[1];
	const dz = origin[2] - position[2];
	const horizontal = Math.sqrt(dx * dx + dz * dz);
	GL11.glTranslatef(
		position[0] - origin[0],
		position[1] - origin[1] + 0.5,
		position[2] - origin[2],
	);
	GL11.glRotatef((Math.atan2(dx, dz) * 180) / Math.PI + 180, 0, 1, 0);
	GL11.glRotatef((Math.atan2(dy, horizontal) * 180) / Math.PI, 1, 0, 0);
}

function renderLengthPanel(
	entity: EntityVehicle,
	partialTicks: number,
	position: Vec3,
	length: number,
): void {
	const text = Math.max(0, length).toFixed(2);
	const glyphCount = text.length;
	GL11.glPushMatrix();
	GL11.glEnable(GL11.GL_BLEND);
	GL11.glBlendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
	GL11.glColor4f(1, 1, 1, 1);
	orientPanel(entity, partialTicks, position);
	GL11.glTranslatef((glyphCount - 1) / 2, 0, 0);
	for (let i = 0; i < text.length; i++) {
		const char = text.substring(i, i + 1);
		GL11.glPushMatrix();
		GL11.glTranslatef(-i, 0, 0);
		if (char === ".") {
			decimalDot.render(renderer);
		} else {
			digits[Number(char)].render(renderer);
		}
		if (i === text.length - 1) meter.render(renderer);
		GL11.glPopMatrix();
	}
	GL11.glDisable(GL11.GL_BLEND);
	GL11.glPopMatrix();
}

function sendRequest(
	entity: EntityVehicle,
	state: SplitterState,
	request: RailSplitterRequest,
): void {
	const dataMap = entity.getResourceState().getDataMap();
	NGTOBuilderUtil.sendJsonData(dataMap, "railSplitterRequest", request);
	dataMap.setString("railSplitterResult", "waiting", 1);
	state.awaitingResult = true;
	state.pendingAction = request.action;
}

function showHelp(sender: ICommandSender): void {
	NGTLog.sendChatMessage(sender, "--- SuperRailBuilderX 線路分割 ---");
	NGTLog.sendChatMessage(sender, "[右クリック] 分割位置を確定");
	NGTLog.sendChatMessage(sender, "[左クリック] 選択解除");
	NGTLog.sendChatMessage(sender, keys.getDescription("split"));
	NGTLog.sendChatMessage(sender, keys.getDescription("undo"));
	NGTLog.sendChatMessage(sender, keys.getDescription("exit"));
}

function handleResult(
	sender: ICommandSender,
	entity: EntityVehicle,
	state: SplitterState,
): void {
	const dataMap = entity.getResourceState().getDataMap();
	const result = dataMap.getString("railSplitterResult");
	if (!state.awaitingResult || !state.pendingAction) return;
	if (!result || result === "waiting") return;
	const pendingAction = state.pendingAction;
	state.awaitingResult = false;
	if (result === "ok" && pendingAction === "split") {
		NGTLog.sendChatMessage(
			sender,
			"§a[SuperRailBuilderX] 線路を2本に分割しました",
		);
		state.selected = null;
	} else if (result === "undo_ok" && pendingAction === "undo") {
		NGTLog.sendChatMessage(
			sender,
			"§a[SuperRailBuilderX] 分割前の線路を復元しました",
		);
	} else {
		NGTLog.sendChatMessage(
			sender,
			`§c[SuperRailBuilderX] 処理失敗: ${result}`,
		);
	}
	state.pendingAction = null;
	dataMap.setString("railSplitterResult", "", 1);
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
	if (leftClick && !state.awaitingResult) state.selected = null;
	if (rightClick && !state.awaitingResult) {
		const target = findHoverTarget(entity, partialTicks);
		if (target) state.selected = target;
		else
			NGTLog.sendChatMessage(
				sender,
				"§e[SuperRailBuilderX] 分割可能な通常レールが見つかりません",
			);
	}
	if (keys.pressed("split") && !state.awaitingResult && state.selected) {
		sendRequest(entity, state, {
			action: "split",
			core: state.selected.core,
			railKey: state.selected.railKey,
			ratio: state.selected.ratio,
		});
		NGTLog.sendChatMessage(sender, "[SuperRailBuilderX] 線路を分割中...");
	}
	if (
		keys.pressed("undo") &&
		!state.awaitingResult &&
		dataMap.getBoolean("railSplitterCanUndo")
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
	const target = state.selected || findHoverTarget(entity, partialTicks);
	if (target) {
		const map = resolveMap(entity, target);
		if (map) {
			renderRailHighlight(
				entity,
				partialTicks,
				map,
				state.selected ? "00ffff" : "ffff00",
				0.6,
			);
			renderAt(
				entity,
				partialTicks,
				target.position,
				state.selected ? selectedCursor : hoverCursor,
			);
			if (state.selected) {
				const split = 1000000;
				const selectedIndex = Math.round(target.ratio * split);
				renderLengthPanel(
					entity,
					partialTicks,
					railPoint(map, split, Math.round(selectedIndex / 2)),
					target.length * target.ratio,
				);
				renderLengthPanel(
					entity,
					partialTicks,
					railPoint(
						map,
						split,
						Math.round((selectedIndex + split) / 2),
					),
					target.length * (1 - target.ratio),
				);
			}
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
