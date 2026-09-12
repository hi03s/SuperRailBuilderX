import { NGTLog } from "jp.ngt.ngtlib.io";
import { MCWrapperClient, NGTUtilClient } from "jp.ngt.ngtlib.util";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ModelSetVehicle } from "jp.ngt.rtm.modelpack.modelset";
import { ModelObject, Parts, VehiclePartsRenderer } from "jp.ngt.rtm.render";
import { TileEntityLargeRailBase } from "jp.ngt.rtm.rail";
import { RailMap, RailPosition } from "jp.ngt.rtm.rail.util";
import { ICommandSender } from "net.minecraft.command";
import { EntityPlayer } from "net.minecraft.entity.player";
import { WeakHashMap } from "java.util";
import { Keyboard, Mouse } from "org.lwjgl.input";
import { GL11 } from "org.lwjgl.opengl";
import { InputManager } from "../lib_hi03toolkit_1_0/lib_InputManager";
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
type Gauge = { gauge: number; name: string; maxCant: number };
const GAUGES: Gauge[] = [
	{ gauge: 1067, name: "1067mm", maxCant: 105 },
	{ gauge: 1372, name: "1372mm", maxCant: 150 },
	{ gauge: 1435, name: "1435mm (在来線)", maxCant: 150 },
	{ gauge: 1435, name: "1435mm (新幹線)", maxCant: 200 },
	{ gauge: 1000, name: "1000mm (モノレール)", maxCant: 110 },
];
type Candidate = SRBXCantTarget & {
	height: number;
	radius: number;
	mode: "edge" | "center" | "split";
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
let cantDigits: Parts[] = [],
	curveDigits: Parts[] = [];

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
		curveDigits.push(renderer.registerParts(new Parts(`curvePanel_${i}`)));
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
function candidate(
	entity: EntityVehicle,
	partialTicks: number,
): Candidate | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return null;
	const world = SRBXApiCompat.getWorld(entity);
	const seen: { [k: string]: boolean } = {};
	let best: Candidate | null = null,
		bestD = 4;
	const endpointCandidates: Candidate[] = [],
		loadedCores = SRBXApiCompat.getLoadedRailCores(
			world,
			looking.posX,
			looking.posZ,
			48,
		);
	for (let loadedIndex = 0; loadedIndex < loadedCores.length; loadedIndex++) {
		const core = loadedCores[loadedIndex];
		if (
			!core ||
			SRBXApiCompat.getRailPositionUnsupportedReason(core) !== ""
		)
			continue;
		const railKey = SRBXApiCompat.getRailPositionCandidateKey(core);
		if (seen[railKey]) continue;
		seen[railKey] = true;
		const map = SRBXApiCompat.getLogicalRailMap(core);
		if (!map) continue;
		const rps = SRBXApiCompat.getEditableRailPositions(core),
			length = map.getLength(),
			split = Math.max(2, Math.floor(length * 2)),
			corePos = SRBXApiCompat.getRailCorePos(core),
			g = GAUGES[state(entity).gaugeIndex],
			near = map.getNearlestPoint(split, looking.posX, looking.posZ),
			ratio = near / split,
			nearPosition = point(map, Math.round(ratio * 1000)),
			railDistance =
				Math.pow(nearPosition[0] - looking.posX, 2) +
				Math.pow(nearPosition[1] - looking.posY, 2) +
				Math.pow(nearPosition[2] - looking.posZ, 2),
			startDistance = length * ratio,
			endDistance = length * (1 - ratio),
			centerDistance = Math.abs(length * (ratio - 0.5));
		if (railDistance >= 4) continue;
		let mode: "edge" | "center" | "split" = "split",
			targetIndex = near,
			targetRatio = ratio,
			targetPosition = nearPosition,
			targetEnd = -1;
		if (
			startDistance <= 10 &&
			startDistance <= endDistance &&
			startDistance <= centerDistance
		) {
			mode = "edge";
			targetIndex = 0;
			targetRatio = 0;
			targetPosition = [rps[0].posX, rps[0].posY, rps[0].posZ];
			targetEnd = 0;
		} else if (endDistance <= 10 && endDistance <= centerDistance) {
			mode = "edge";
			targetIndex = split;
			targetRatio = 1;
			targetPosition = [rps[1].posX, rps[1].posY, rps[1].posZ];
			targetEnd = 1;
		} else if (centerDistance <= 10) {
			mode = "center";
			targetIndex = Math.floor(split / 2);
			targetRatio = 0.5;
			targetPosition = point(map, 500);
		}
		const consider = (
			index: number,
			ratio: number,
			position: [number, number, number],
			directionPoint?: [number, number, number],
		) => {
			void directionPoint;
			const d =
				Math.pow(position[0] - looking.posX, 2) +
				Math.pow(position[1] - looking.posY, 2) +
				Math.pow(position[2] - looking.posZ, 2);
			const sample = Math.max(1, Math.floor(split * 0.02)),
				aIndex = Math.max(0, index - sample),
				bIndex = Math.min(split, index + sample),
				a = RTMApiCompat.getRailYaw(map, split, aIndex),
				b = RTMApiCompat.getRailYaw(map, split, bIndex),
				delta = SRBXMath.relativeDegrees(b, a),
				arc = Math.max(0.001, (length * (bIndex - aIndex)) / split),
				radius =
					Math.abs(delta) < 0.0001
						? Infinity
						: Math.abs(arc / ((delta * Math.PI) / 180)),
				height = isFinite(radius)
					? Math.min(
							g.maxCant,
							Math.max(
								0,
								Math.round(
									(g.gauge *
										state(entity).speed *
										state(entity).speed) /
										(127 * radius),
								),
							),
						)
					: 0,
				physicalAngle =
					((Math.asin(height / g.gauge) * 180) / Math.PI) *
					(delta >= 0 ? -1 : 1),
				angle =
					mode === "edge" && index === split
						? -physicalAngle
						: physicalAngle;
			const candidate: Candidate = {
				core: corePos,
				railKey,
				index: mode === "edge" ? targetEnd : -1,
				position,
				angle,
				height,
				radius,
				mode,
				ratio,
				yaw:
					mode === "edge"
						? SRBXApiCompat.getHorizontalAnchorYaw(rps[targetEnd])
						: RTMApiCompat.getRailYaw(map, split, index),
			};
			if (mode === "edge") endpointCandidates.push(candidate);
			if (d >= bestD) return;
			bestD = d;
			best = candidate;
		};
		const directionSample = Math.max(
			1,
			Math.min(
				999,
				Math.round((Math.min(10, length * 0.25) * 1000) / length),
			),
		);
		consider(
			targetIndex,
			targetRatio,
			targetPosition,
			targetEnd < 0
				? undefined
				: point(
						map,
						targetEnd === 0
							? directionSample
							: 1000 - directionSample,
					),
		);
	}
	if (best && best.mode === "edge") {
		let endpointBest = best;
		for (let i = 0; i < endpointCandidates.length; i++) {
			const candidate = endpointCandidates[i];
			if (
				Math.abs(candidate.position[0] - best.position[0]) <= 0.001 &&
				Math.abs(candidate.position[1] - best.position[1]) <= 0.001 &&
				Math.abs(candidate.position[2] - best.position[2]) <= 0.001 &&
				candidate.height > endpointBest.height
			)
				endpointBest = candidate;
		}
		return endpointBest;
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
	NGTLog.sendChatMessage(sender, "--- SuperRailBuilderX カント整形 ---");
	NGTLog.sendChatMessage(
		sender,
		"[↑/↓] 設計速度を1km/h変更（長押し可・画面表示のみ）",
	);
	NGTLog.sendChatMessage(
		sender,
		"[Ctrl+←/→] レール種類を変更（チャット表示）",
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
		"[右クリック] 端点・中央・離れたレール上を複数選択 / [左クリック] 1点戻る",
	);
	NGTLog.sendChatMessage(sender, keys.getDescription("apply"));
	NGTLog.sendChatMessage(sender, keys.getDescription("undo"));
}
function recalculateSelected(s: State): void {
	const gauge = GAUGES[s.gaugeIndex];
	for (let i = 0; i < s.selected.length; i++) {
		const target = s.selected[i];
		const sign = target.angle < 0 ? -1 : 1;
		target.height = isFinite(target.radius)
			? Math.min(
					gauge.maxCant,
					Math.max(
						0,
						Math.round(
							(gauge.gauge * s.speed * s.speed) /
								(127 * target.radius),
						),
					),
				)
			: 0;
		target.angle =
			((Math.asin(target.height / gauge.gauge) * 180) / Math.PI) * sign;
	}
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
	if (
		!Keyboard.isKeyDown(Keyboard.KEY_LCONTROL) &&
		(up || down) &&
		now >= s.repeatAt
	) {
		s.speed = Math.max(1, Math.min(999, s.speed + (up ? 1 : -1)));
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
			NGTLog.debug(
				`[SuperRailBuilderX cant] selected: railKey=${c.railKey}, mode=${c.mode}, ratio=${c.ratio}, radius=${c.radius}, height=${c.height}, angle=${c.angle}, yaw=${c.yaw}`,
			);
			const k = `${c.railKey}:${c.mode}:${Math.round((c.ratio || 0) * 1000000)}`;
			let found = -1;
			for (let i = 0; i < s.selected.length; i++)
				if (
					`${s.selected[i].railKey}:${s.selected[i].mode}:${Math.round((s.selected[i].ratio || 0) * 1000000)}` ===
					k
				)
					found = i;
			if (found >= 0) s.selected.splice(found, 1);
			else s.selected.push(c);
		}
	}
	if (keys.pressed("apply") && !s.awaiting && s.selected.length)
		send(entity, s, { action: "apply", targets: s.selected });
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
	NGTOBuilderUtilClient.renderRailMapHighlight(entity, map, color, 0.65);
	GL11.glPopMatrix();
}

function collectAffectedRails(
	entity: EntityVehicle,
	target: Candidate,
	result: { [key: string]: RailMap },
): void {
	const world = SRBXApiCompat.getWorld(entity),
		seen: { [key: string]: boolean } = {};
	for (let dx = -2; dx <= 2; dx++)
		for (let dy = -2; dy <= 2; dy++)
			for (let dz = -2; dz <= 2; dz++) {
				const tile = SRBXApiCompat.getTileEntity(
					world,
					Math.floor(target.position[0]) + dx,
					Math.floor(target.position[1]) + dy,
					Math.floor(target.position[2]) + dz,
				);
				if (!(tile instanceof TileEntityLargeRailBase)) continue;
				const core = tile.getRailCore();
				if (!core) continue;
				const key = SRBXApiCompat.getRailPositionCandidateKey(core);
				if (seen[key]) continue;
				const positions = SRBXApiCompat.getEditableRailPositions(core),
					map = SRBXApiCompat.getLogicalRailMap(core);
				if (!positions || !map) continue;
				let affected = key === target.railKey;
				if (!affected && target.mode === "edge")
					for (let i = 0; i < positions.length; i++)
						if (
							Math.abs(positions[i].posX - target.position[0]) <=
								0.001 &&
							Math.abs(positions[i].posY - target.position[1]) <=
								0.001 &&
							Math.abs(positions[i].posZ - target.position[2]) <=
								0.001
						)
							affected = true;
				if (!affected) continue;
				seen[key] = true;
				result[key] = map;
			}
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
		hover = candidate(entity, pt),
		affected: { [key: string]: RailMap } = {};
	for (let i = 0; i < s.selected.length; i++)
		collectAffectedRails(entity, s.selected[i], affected);
	const affectedKeys = Object.keys(affected);
	for (let i = 0; i < affectedKeys.length; i++)
		renderRailHighlight(entity, pt, affected[affectedKeys[i]], "00ffff");
	if (hover && hover.mode === "split" && !affected[hover.railKey]) {
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
	}
	if (hover) renderAt(entity, pt, hover.position, hoverCursor);
	for (let i = 0; i < s.selected.length; i++) {
		renderAt(entity, pt, s.selected[i].position, selectedCursor);
		panel(
			entity,
			pt,
			s.selected[i].position,
			s.selected[i].height,
			cantDigits,
			cantMM,
		);
	}
	const look = NGTOBuilderUtilClient.getLookingPos(pt);
	if (look)
		panel(
			entity,
			pt,
			[look.posX, look.posY + 1, look.posZ],
			s.speed,
			curveDigits,
			null,
		);
	const gui = NGTUtilClient.getMinecraft().currentScreen !== null,
		left = Mouse.isButtonDown(0),
		right = Mouse.isButtonDown(1),
		pl = d.getBoolean("prevIsLeftClick"),
		pr = d.getBoolean("prevIsRightClick");
	if (left !== pl) d.setBoolean("prevIsLeftClick", left, 0);
	if (right !== pr) d.setBoolean("prevIsRightClick", right, 0);
	if (renderer.currentMatId === 0 && pass === 0) keys.update();
	if (!gui && renderer.currentMatId === 0 && pass === 0)
		input(host, entity, pt, !pr && right, !pl && left);
}
