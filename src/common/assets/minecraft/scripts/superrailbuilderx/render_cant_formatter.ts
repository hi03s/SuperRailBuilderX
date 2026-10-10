import { SRBXToolGui } from "./SRBXToolGui";
import { ResourceLocation } from "net.minecraft.util";
import { SRBXRailHighlight } from "./SRBXRailHighlight";
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
import { SRBXInputManager as InputManager } from "./SRBXInputManager";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import { NGTOBuilderUtilClient } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtilClient";
import { RTMApiCompat } from "@target/assets/minecraft/scripts/lib_hi03toolkit_1_0/lib_RTMApiCompat";
import {
	SRBXApiCompat,
	SRBXCantTarget,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath } from "./SRBXMath";
import { CantFormatterRequest } from "./server_cant_formatter";

declare const renderer: VehiclePartsRenderer;
const GUI_TOOL_ICON = new ResourceLocation(
	"minecraft",
	"textures/superrailbuilderx/icon_cant_formatter.png",
);
type Gauge = { gauge: number; name: string; maxCant: number };
const GAUGES: Gauge[] = [
	{ gauge: 1067, name: "1067mm", maxCant: 105 },
	{ gauge: 1372, name: "1372mm", maxCant: 150 },
	{ gauge: 1435, name: "1435mm (在来線)", maxCant: 150 },
	{ gauge: 1435, name: "1435mm (新幹線)", maxCant: 200 },
	{ gauge: 1000, name: "1000mm (モノレール)", maxCant: 110 },
];
type CantEndpoint = SRBXCantTarget & {
	height: number;
	radius: number;
	sign: number;
};
type Candidate = {
	core: [number, number, number];
	railKey: string;
	position: [number, number, number];
	endpoints: CantEndpoint[];
};
type State = {
	speed: number;
	gaugeIndex: number;
	selected: Candidate[];
	awaiting: boolean;
	pending: "apply" | "undo" | null;
	repeatAt: number;
};
const states: WeakHashMap<EntityVehicle, State> = new WeakHashMap();
let keys: InputManager;
let body: Parts, hoverCursor: Parts, selectedCursor: Parts, cantMM: Parts;
let cantDigits: Parts[] = [];

function init(a: ModelSetVehicle, b: ModelObject): void {
	void a;
	void b;
	keys = new InputManager();
	keys.setOptionKey(Keyboard.KEY_LCONTROL);
	keys.register("help", Keyboard.KEY_H, false, "ヘルプを表示");
	keys.register("exit", Keyboard.KEY_Q, false, "ツールを終了");
	keys.register("apply", Keyboard.KEY_RETURN, false, "カントを適用");
	keys.register("undo", Keyboard.KEY_Z, true, "直前の適用を取り消す");
	body = renderer.registerParts(new Parts("body"));
	hoverCursor = renderer.registerParts(new Parts("selectCursor"));
	selectedCursor = renderer.registerParts(new Parts("selectedCursor"));
	cantMM = renderer.registerParts(new Parts("cantPanel_mm"));
	for (let i = 0; i <= 9; i++) {
		cantDigits.push(renderer.registerParts(new Parts(`cantPanel_${i}`)));
	}
}
function state(entity: EntityVehicle): State {
	let s = states.get(entity);
	if (!s) {
		s = {
			speed: 100,
			gaugeIndex: 0,
			selected: [],
			awaiting: false,
			pending: null,
			repeatAt: 0,
		};
		states.put(entity, s);
	}
	return s;
}
function point(map: RailMap, i: number): [number, number, number] {
	const p = map.getRailPos(1000, i);
	return [p[1], map.getRailHeight(1000, i), p[0]];
}
function railEndpoints(
	core: TileEntityLargeRailCore,
	map: RailMap,
	s: State,
): CantEndpoint[] {
	const positions = SRBXApiCompat.getEditableRailPositions(core);
	if (!positions || positions.length !== 2) return [];
	const length = map.getLength(),
		split = Math.max(2, Math.floor(length * 2));
	const sample = Math.max(1, Math.floor(split * 0.02));
	const endpoints: CantEndpoint[] = [];
	for (let index = 0; index < 2; index++) {
		const rp = positions[index],
			at = index === 0 ? 0 : split;
		const from = Math.max(0, at - sample),
			to = Math.min(split, at + sample);
		const delta = SRBXMath.relativeDegrees(
			RTMApiCompat.getRailYaw(map, split, to),
			RTMApiCompat.getRailYaw(map, split, from),
		);
		const arc = Math.max(0.001, (length * (to - from)) / split);
		const radius =
			Math.abs(delta) < 0.0001
				? Infinity
				: Math.abs(arc / ((delta * Math.PI) / 180));
		const sign = (delta >= 0 ? -1 : 1) * (index === 1 ? -1 : 1);
		endpoints.push({
			core: SRBXApiCompat.getRailCorePos(core),
			railKey: SRBXApiCompat.getRailPositionCandidateKey(core),
			index,
			position: [rp.posX, rp.posY, rp.posZ],
			yaw: SRBXApiCompat.getHorizontalAnchorYaw(rp),
			mode: "edge",
			radius,
			sign,
			height: 0,
			angle: 0,
		});
	}
	updateEndpointCants(endpoints, s);
	return endpoints;
}
function updateEndpointCants(endpoints: CantEndpoint[], s: State): void {
	const gauge = GAUGES[s.gaugeIndex];
	for (let i = 0; i < endpoints.length; i++) {
		const endpoint = endpoints[i];
		endpoint.height = isFinite(endpoint.radius)
			? Math.min(
					gauge.maxCant,
					Math.max(
						0,
						Math.round(
							(gauge.gauge * s.speed * s.speed) /
								(127 * endpoint.radius),
						),
					),
				)
			: 0;
		endpoint.angle =
			((Math.asin(endpoint.height / gauge.gauge) * 180) / Math.PI) *
			endpoint.sign;
	}
}
function candidate(
	entity: EntityVehicle,
	partialTicks: number,
): Candidate | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return null;
	const world = SRBXApiCompat.getWorld(entity),
		seen: { [key: string]: boolean } = {};
	const cores = SRBXApiCompat.getLoadedRailCores(
		world,
		looking.posX,
		looking.posZ,
		48,
	);
	let best: Candidate | null = null,
		bestDistance = 4;
	for (let i = 0; i < cores.length; i++) {
		const core = cores[i];
		if (
			!core ||
			SRBXApiCompat.getRailPositionUnsupportedReason(core) !== ""
		)
			continue;
		const key = SRBXApiCompat.getRailPositionCandidateKey(core);
		if (seen[key]) continue;
		seen[key] = true;
		const map = SRBXApiCompat.getLogicalRailMap(core);
		if (!map) continue;
		const split = Math.max(2, Math.floor(map.getLength() * 2));
		const near = map.getNearlestPoint(split, looking.posX, looking.posZ);
		const position = point(map, Math.round((near / split) * 1000));
		const distance =
			Math.pow(position[0] - looking.posX, 2) +
			Math.pow(position[1] - looking.posY, 2) +
			Math.pow(position[2] - looking.posZ, 2);
		if (distance >= bestDistance) continue;
		const endpoints = railEndpoints(core, map, state(entity));
		if (endpoints.length !== 2) continue;
		bestDistance = distance;
		best = {
			core: SRBXApiCompat.getRailCorePos(core),
			railKey: key,
			position,
			endpoints,
		};
	}
	return best;
}
function renderAt(
	entity: EntityVehicle,
	pt: number,
	p: [number, number, number],
	part: Parts,
) {
	const o = NGTOBuilderUtilClient.getInterpolatedPos(entity, pt);
	GL11.glPushMatrix();
	GL11.glTranslatef(p[0] - o[0], p[1] - o[1], p[2] - o[2]);
	part.render(renderer);
	GL11.glPopMatrix();
}
function panel(
	entity: EntityVehicle,
	pt: number,
	p: [number, number, number],
	value: number,
	digits: Parts[],
	unit: Parts | null,
) {
	const o = NGTOBuilderUtilClient.getInterpolatedPos(entity, pt),
		text = String(Math.max(0, Math.round(value))),
		dx = o[0] - p[0],
		dy = o[1] - p[1],
		dz = o[2] - p[2],
		h = Math.sqrt(dx * dx + dz * dz);
	GL11.glPushMatrix();
	GL11.glEnable(GL11.GL_BLEND);
	GL11.glBlendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
	GL11.glColor4f(1, 1, 1, 1);
	GL11.glTranslatef(p[0] - o[0], p[1] - o[1] + 0.5, p[2] - o[2]);
	GL11.glRotatef((Math.atan2(dx, dz) * 180) / Math.PI + 180, 0, 1, 0);
	GL11.glRotatef((Math.atan2(dy, h) * 180) / Math.PI, 1, 0, 0);
	GL11.glTranslatef((text.length - 1) / 2, 0, 0);
	for (let i = 0; i < text.length; i++) {
		GL11.glPushMatrix();
		GL11.glTranslatef(-i, 0, 0);
		digits[Number(text.substring(i, i + 1))].render(renderer);
		if (i === text.length - 1 && unit) unit.render(renderer);
		GL11.glPopMatrix();
	}
	GL11.glDisable(GL11.GL_BLEND);
	GL11.glPopMatrix();
}
function send(entity: EntityVehicle, s: State, request: CantFormatterRequest) {
	const d = entity.getResourceState().getDataMap();
	NGTOBuilderUtil.sendJsonData(d, "cantFormatterRequest", request);
	d.setString("cantFormatterResult", "waiting", 1);
	s.awaiting = true;
	s.pending = request.action;
}
function result(sender: ICommandSender, entity: EntityVehicle, s: State) {
	const d = entity.getResourceState().getDataMap(),
		r = d.getString("cantFormatterResult");
	if (!s.awaiting || !s.pending || !r || r === "waiting") return;
	s.awaiting = false;
	const updates =
		NGTOBuilderUtil.getJsonData<Array<[number, number, number]>>(
			d,
			"cantFormatterClientUpdate",
		) || [];
	const world = SRBXApiCompat.getWorld(entity),
		freshKeys: { [key: string]: boolean } = {};
	for (let i = 0; i < updates.length; i++) {
		const t = SRBXApiCompat.getTileEntity(
			world,
			updates[i][0],
			updates[i][1],
			updates[i][2],
		);
		if (t instanceof TileEntityLargeRailBase) {
			const c = t.getRailCore();
			if (c) {
				freshKeys[SRBXApiCompat.getRailPositionCandidateKey(c)] = true;
				SRBXApiCompat.refreshRailCoreClient(c);
			}
		}
	}
	const removed =
		NGTOBuilderUtil.getJsonData<
			Array<{ core: [number, number, number]; key: string }>
		>(d, "cantFormatterRemovedRails") || [];
	for (let i = 0; i < removed.length; i++)
		if (!freshKeys[removed[i].key])
			SRBXApiCompat.removeRailClientGhost(
				world,
				removed[i].core,
				removed[i].key,
			);
	NGTOBuilderUtil.resetJsonData(d, "cantFormatterClientUpdate");
	NGTOBuilderUtil.resetJsonData(d, "cantFormatterRemovedRails");
	NGTLog.sendChatMessage(
		sender,
		r === "ok"
			? "§a[SuperRailBuilderX] カントを適用しました"
			: r === "undo_ok"
				? "§a[SuperRailBuilderX] カントを元に戻しました"
				: `§c[SuperRailBuilderX] 処理失敗: ${r}`,
	);
	if (r === "ok") s.selected = [];
	s.pending = null;
	d.setString("cantFormatterResult", "", 1);
}
function help(sender: ICommandSender) {
	if (SRBXApiCompat.requiresRailBoundarySnap())
		NGTLog.sendChatMessage(
			sender,
			"接続端点はブロック境界へ合わせます。既設の内部端点への接続はできません。",
		);
	NGTLog.sendChatMessage(sender, "--- SuperRailBuilderX カント整形 ---");
	NGTLog.sendChatMessage(sender, "[↑] 設計速度を1km/h増加（長押し可）");
	NGTLog.sendChatMessage(sender, "[↓] 設計速度を1km/h減少（最低0km/h）");
	NGTLog.sendChatMessage(sender, "[Ctrl+↑] 設計速度を50km/h増加（長押し可）");
	NGTLog.sendChatMessage(
		sender,
		"[Ctrl+↓] 設計速度を50km/h減少（最低0km/h）",
	);
	NGTLog.sendChatMessage(
		sender,
		"[Ctrl+←] 前のレール種類へ変更（チャット表示）",
	);
	NGTLog.sendChatMessage(
		sender,
		"[Ctrl+→] 次のレール種類へ変更（チャット表示）",
	);
	NGTLog.sendChatMessage(
		sender,
		"上限: 1067mm=105mm / 1372mm=150mm / 1435mm (在来線)=150mm",
	);
	NGTLog.sendChatMessage(
		sender,
		"上限: 1435mm (新幹線)=200mm / 1000mm (モノレール)=110mm",
	);
	NGTLog.sendChatMessage(
		sender,
		"[右クリック] 論理レールを選択/解除（両端にカント適用）",
	);
	NGTLog.sendChatMessage(sender, "[左クリック] 最後に選択したレールを解除");
	NGTLog.sendChatMessage(sender, keys.getDescription("apply"));
	NGTLog.sendChatMessage(sender, keys.getDescription("undo"));
	NGTLog.sendChatMessage(sender, keys.getDescription("exit"));
	SRBXToolGui.helpFooter(sender);
}
function recalculateSelected(s: State): void {
	for (let i = 0; i < s.selected.length; i++)
		updateEndpointCants(s.selected[i].endpoints, s);
}
function input(
	host: EntityPlayer,
	entity: EntityVehicle,
	pt: number,
	right: boolean,
	left: boolean,
) {
	const s = state(entity),
		sender = host as unknown as ICommandSender,
		d = entity.getResourceState().getDataMap();
	if (keys.pressed("help")) help(sender);
	if (keys.down("exit")) d.setBoolean("isEndEdit", true, 1);
	const now = Date.now(),
		up = Keyboard.isKeyDown(Keyboard.KEY_UP),
		down = Keyboard.isKeyDown(Keyboard.KEY_DOWN);
	if ((up || down) && now >= s.repeatAt) {
		s.speed = Math.max(
			0,
			Math.min(
				999,
				s.speed +
					(up ? 1 : -1) *
						(Keyboard.isKeyDown(Keyboard.KEY_LCONTROL) ? 50 : 1),
			),
		);
		recalculateSelected(s);
		s.repeatAt = now + (s.repeatAt === 0 ? 350 : 75);
	}
	if (!up && !down) s.repeatAt = 0;
	if (
		Keyboard.isKeyDown(Keyboard.KEY_LCONTROL) &&
		(Keyboard.isKeyDown(Keyboard.KEY_LEFT) ||
			Keyboard.isKeyDown(Keyboard.KEY_RIGHT)) &&
		!d.getBoolean("cantGaugeKey")
	) {
		d.setBoolean("cantGaugeKey", true, 0);
		s.gaugeIndex =
			(s.gaugeIndex +
				(Keyboard.isKeyDown(Keyboard.KEY_RIGHT)
					? 1
					: GAUGES.length - 1)) %
			GAUGES.length;
		const g = GAUGES[s.gaugeIndex];
		recalculateSelected(s);
		NGTLog.sendChatMessage(
			sender,
			`[SuperRailBuilderX] レール種類: ${g.name} / 最大カント: ${g.maxCant}mm`,
		);
	}
	if (
		!Keyboard.isKeyDown(Keyboard.KEY_LEFT) &&
		!Keyboard.isKeyDown(Keyboard.KEY_RIGHT)
	)
		d.setBoolean("cantGaugeKey", false, 0);
	if (left && !s.awaiting) s.selected.pop();
	if (right && !s.awaiting) {
		const c = candidate(entity, pt);
		if (c) {
			let found = -1;
			for (let i = 0; i < s.selected.length; i++)
				if (s.selected[i].railKey === c.railKey) found = i;
			if (found >= 0) s.selected.splice(found, 1);
			else s.selected.push(c);
		}
	}
	if (keys.pressed("apply") && !s.awaiting && s.selected.length) {
		const targets: SRBXCantTarget[] = [];
		for (let i = 0; i < s.selected.length; i++)
			for (let j = 0; j < s.selected[i].endpoints.length; j++)
				targets.push(s.selected[i].endpoints[j]);
		send(entity, s, { action: "apply", targets });
	}
	if (
		keys.pressed("undo") &&
		!s.awaiting &&
		d.getBoolean("cantFormatterCanUndo")
	)
		send(entity, s, { action: "undo" });
	result(sender, entity, s);
}

function renderRailHighlight(
	entity: EntityVehicle,
	pt: number,
	map: RailMap,
	color: string,
): void {
	const origin = NGTOBuilderUtilClient.getInterpolatedPos(entity, pt);
	GL11.glPushMatrix();
	GL11.glTranslatef(-origin[0], -origin[1], -origin[2]);
	SRBXRailHighlight.render(entity, map, color, 0.65);
	GL11.glPopMatrix();
}

function collectAffectedRails(
	entity: EntityVehicle,
	target: Candidate,
	result: { [key: string]: RailMap },
): void {
	const world = SRBXApiCompat.getWorld(entity);
	for (let e = 0; e < target.endpoints.length; e++) {
		const position = target.endpoints[e].position;
		const cores = SRBXApiCompat.getLoadedRailCores(
			world,
			position[0],
			position[2],
			48,
		);
		for (let i = 0; i < cores.length; i++) {
			const core = cores[i];
			if (
				!core ||
				SRBXApiCompat.getRailPositionUnsupportedReason(core) !== ""
			)
				continue;
			const key = SRBXApiCompat.getRailPositionCandidateKey(core);
			if (result[key]) continue;
			const positions = SRBXApiCompat.getEditableRailPositions(core),
				map = SRBXApiCompat.getLogicalRailMap(core);
			if (!positions || !map) continue;
			for (let j = 0; j < positions.length; j++)
				if (
					Math.abs(positions[j].posX - position[0]) <= 0.001 &&
					Math.abs(positions[j].posY - position[1]) <= 0.001 &&
					Math.abs(positions[j].posZ - position[2]) <= 0.001
				)
					result[key] = map;
		}
	}
}
function renderToolGui(s: State): void {
	SRBXToolGui.render("カント整形", GUI_TOOL_ICON, [
		{ iconX: 5, iconY: 0, label: `設計速度:${s.speed}km/h` },
		{ iconX: 4, iconY: 2, label: `種類:${GAUGES[s.gaugeIndex].name}` },
	]);
}

function render(entity: EntityVehicle, pass: number, pt: number): void {
	if (!entity) {
		body.render(renderer);
		return;
	}
	body.render(renderer);
	const d = entity.getResourceState().getDataMap(),
		world = SRBXApiCompat.getWorld(entity),
		player = MCWrapperClient.getPlayer(),
		id = d.getString("hostPlayerEntityId"),
		host = id
			? (world.getEntityByID(Number(id)) as unknown as EntityPlayer)
			: null;
	if (!host || host !== player) return;
	SRBXApiCompat.doFollowing(entity, host);
	const s = state(entity),
		hover = candidate(entity, pt);
	const selected: { [key: string]: RailMap } = {},
		affected: { [key: string]: RailMap } = {};
	for (let i = 0; i < s.selected.length; i++) {
		const target = s.selected[i];
		const core = SRBXApiCompat.getTileEntity(
			world,
			target.core[0],
			target.core[1],
			target.core[2],
		);
		if (core instanceof TileEntityLargeRailBase) {
			const logical = core.getRailCore();
			if (
				logical &&
				SRBXApiCompat.getRailPositionCandidateKey(logical) ===
					target.railKey
			) {
				const map = SRBXApiCompat.getLogicalRailMap(logical);
				if (map) selected[target.railKey] = map;
			}
		}
		collectAffectedRails(entity, target, affected);
		for (let j = 0; j < target.endpoints.length; j++) {
			const end = target.endpoints[j];
			renderAt(entity, pt, end.position, selectedCursor);
			panel(entity, pt, end.position, end.height, cantDigits, cantMM);
		}
	}
	const affectedKeys = Object.keys(affected);
	for (let i = 0; i < affectedKeys.length; i++) {
		const key = affectedKeys[i];
		if (!selected[key] && (!hover || hover.railKey !== key))
			renderRailHighlight(entity, pt, affected[key], "99ff00");
	}
	const selectedKeys = Object.keys(selected);
	for (let i = 0; i < selectedKeys.length; i++)
		if (!hover || hover.railKey !== selectedKeys[i])
			renderRailHighlight(
				entity,
				pt,
				selected[selectedKeys[i]],
				"00ffff",
			);
	if (hover) {
		const tile = SRBXApiCompat.getTileEntity(
			world,
			hover.core[0],
			hover.core[1],
			hover.core[2],
		);
		const core =
			tile instanceof TileEntityLargeRailBase ? tile.getRailCore() : null;
		const map = core ? SRBXApiCompat.getLogicalRailMap(core) : null;
		if (map) renderRailHighlight(entity, pt, map, "ffff00");
		renderAt(entity, pt, hover.position, hoverCursor);
	}

	const gui = NGTUtilClient.getMinecraft().currentScreen !== null,
		left = Mouse.isButtonDown(0),
		right = Mouse.isButtonDown(1),
		pl = d.getBoolean("prevIsLeftClick"),
		pr = d.getBoolean("prevIsRightClick");
	if (left !== pl) d.setBoolean("prevIsLeftClick", left, 0);
	if (right !== pr) d.setBoolean("prevIsRightClick", right, 0);
	if (renderer.currentMatId === 0 && pass === 0) keys.update();
	if (!gui && renderer.currentMatId === 0 && pass === 0) {
		input(host, entity, pt, !pr && right, !pl && left);
		renderToolGui(s);
	}
}
