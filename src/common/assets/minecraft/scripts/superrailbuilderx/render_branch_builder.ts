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
	SRBXBranchRequest,
	SRBXBuilderPoint,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath, SRBXVec3 } from "./SRBXMath";
import { BranchBuilderRequest } from "./server_branch_builder";

declare const renderer: VehiclePartsRenderer;
const MIN_LENGTH = 3,
	MAX_RADIUS = 10000,
	DEFAULT_HEIGHT = 1 / 16;
type SplitTarget = {
	core: [number, number, number];
	railKey: string;
	ratio: number;
	position: SRBXVec3;
	yaw: number;
	length: number;
	endpoint: SRBXBuilderPoint | null;
};
type BranchClientUpdate = {
	removed: Array<{ core: [number, number, number]; key: string }>;
	refreshed: Array<{ core: [number, number, number]; key: string }>;
};
type State = {
	split: SplitTarget | null;
	end: SRBXBuilderPoint | null;
	snap: boolean;
	snapIndex: number;
	locked: boolean;
	radius: number;
	repeat: { [k: string]: number };
	awaiting: boolean;
	pending: "create" | "undo" | null;
	ignored: { [k: string]: boolean };
};
const states: WeakHashMap<EntityVehicle, State> = new WeakHashMap();
const snapAngles = [1, 5, 15, 45];
let keys: InputManager,
	body: Parts,
	hoverCursor: Parts,
	selectedCursor: Parts,
	line: Parts,
	curveRadius: Parts,
	curveLeft: Parts,
	curveRight: Parts,
	curveMeter: Parts,
	curveInfinity: Parts;
let markers: Parts[] = [];
let curveDigits: Parts[] = [];
function init(a: ModelSetVehicle, b: ModelObject): void {
	void a;
	void b;
	keys = new InputManager();
	keys.setOptionKey(Keyboard.KEY_LCONTROL);
	keys.register("help", Keyboard.KEY_H, false, "ヘルプを表示");
	keys.register("exit", Keyboard.KEY_Q, false, "ツールを終了");
	keys.register("build", Keyboard.KEY_RETURN, false, "分岐レールを生成");
	keys.register("undo", Keyboard.KEY_Z, true, "直前の生成を取り消す");
	keys.register("snap", Keyboard.KEY_P, false, "スナップ切替");
	keys.register("snapAngle", Keyboard.KEY_P, true, "スナップ角度変更");
	keys.register("radius", Keyboard.KEY_O, false, "曲線半径固定切替");
	body = renderer.registerParts(new Parts("body"));
	hoverCursor = renderer.registerParts(new Parts("selectCursor"));
	selectedCursor = renderer.registerParts(new Parts("selectedCursor"));
	line = renderer.registerParts(new Parts("selectedLine"));
	curveRadius = renderer.registerParts(new Parts("curvePanel_Radius"));
	curveLeft = renderer.registerParts(new Parts("curvePanel_L"));
	curveRight = renderer.registerParts(new Parts("curvePanel_R"));
	curveMeter = renderer.registerParts(new Parts("curvePanel_m"));
	curveInfinity = renderer.registerParts(new Parts("curvePanel_infinity"));
	for (let i = 0; i < 8; i++)
		markers.push(renderer.registerParts(new Parts(`marker${i}`)));
	for (let i = 0; i <= 9; i++)
		curveDigits.push(renderer.registerParts(new Parts(`curvePanel_${i}`)));
}
function getState(e: EntityVehicle): State {
	let s = states.get(e);
	if (!s) {
		s = {
			split: null,
			end: null,
			snap: false,
			snapIndex: 1,
			locked: false,
			radius: MAX_RADIUS,
			repeat: {},
			awaiting: false,
			pending: null,
			ignored: {},
		};
		states.put(e, s);
	}
	return s;
}
function railPoint(map: RailMap, split: number, index: number): SRBXVec3 {
	const p = map.getRailPos(split, index);
	return [p[1], map.getRailHeight(split, index), p[0]];
}
function findSplit(e: EntityVehicle, pt: number): SplitTarget | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(pt);
	if (!looking) return null;
	const world = SRBXApiCompat.getWorld(e),
		seen: { [k: string]: boolean } = {};
	let best: SplitTarget | null = null,
		dist = 2.25;
	for (let dx = -2; dx <= 2; dx++)
		for (let dy = -2; dy <= 2; dy++)
			for (let dz = -2; dz <= 2; dz++) {
				const tile = SRBXApiCompat.getTileEntity(
					world,
					Math.floor(looking.posX) + dx,
					Math.floor(looking.posY) + dy,
					Math.floor(looking.posZ) + dz,
				);
				if (!(tile instanceof TileEntityLargeRailBase)) continue;
				const core = tile.getRailCore();
				if (
					!core ||
					SRBXApiCompat.getRailPositionUnsupportedReason(core) !== ""
				)
					continue;
				const key = SRBXApiCompat.getRailPositionCandidateKey(core);
				if (seen[key] || getState(e).ignored[key]) continue;
				seen[key] = true;
				const map = SRBXApiCompat.getLogicalRailMap(core);
				if (!map) continue;
				if (
					Math.abs(RTMApiCompat.getRailPitch(map, 1000, 0)) > 0.001 ||
					Math.abs(RTMApiCompat.getRailPitch(map, 1000, 500)) >
						0.001 ||
					Math.abs(RTMApiCompat.getRailPitch(map, 1000, 1000)) > 0.001
				)
					continue;
				const rps = SRBXApiCompat.getEditableRailPositions(core);
				if (
					Math.abs(SRBXApiCompat.getRailPositionAnchorPitch(rps[0])) >
						0.001 ||
					Math.abs(SRBXApiCompat.getRailPositionAnchorPitch(rps[1])) >
						0.001
				)
					continue;
				const split = Math.max(2, Math.floor(map.getLength() * 2)),
					min =
						Math.floor((MIN_LENGTH * split) / map.getLength()) + 1,
					max = split - min;
				const corePos = SRBXApiCompat.getRailCorePos(core);
				const consider = (
					index: number,
					pos: SRBXVec3,
					endpoint: SRBXBuilderPoint | null,
					directionPoint?: SRBXVec3,
				) => {
					let d =
						Math.pow(pos[0] - looking.posX, 2) +
						Math.pow(pos[1] - looking.posY, 2) +
						Math.pow(pos[2] - looking.posZ, 2);
					if (directionPoint)
						d +=
							0.1 *
							(Math.pow(directionPoint[0] - looking.posX, 2) +
								Math.pow(directionPoint[1] - looking.posY, 2) +
								Math.pow(directionPoint[2] - looking.posZ, 2));
					if (d >= dist) return;
					dist = d;
					best = {
						core: corePos,
						railKey: key,
						ratio: index / split,
						position: pos,
						yaw: endpoint
							? endpoint.anchorYaw
							: RTMApiCompat.getRailYaw(
									map,
									1000000,
									Math.round((index / split) * 1000000),
								),
						length: map.getLength(),
						endpoint,
					};
				};
				if (map.getLength() > 6 && min <= max) {
					const index = Math.max(
						min,
						Math.min(
							max,
							map.getNearlestPoint(
								split,
								looking.posX,
								looking.posZ,
							),
						),
					);
					const pos = railPoint(map, split, index);
					pos[1] -= Math.abs(
						Math.sin(
							(RTMApiCompat.getCant(map, split, index) *
								Math.PI) /
								180,
						) * 1.5,
					);
					consider(index, pos, null);
				}
				for (let index = 0; index < 2; index++) {
					const rp = rps[index] as RailPosition;
					const endpoint: SRBXBuilderPoint = {
						kind: "rail",
						position: [rp.posX, rp.posY, rp.posZ],
						direction: rp.direction,
						anchorYaw: SRBXApiCompat.getHorizontalAnchorYaw(rp),
						anchorPitch:
							SRBXApiCompat.getRailPositionAnchorPitch(rp),
						anchorLength:
							SRBXApiCompat.getHorizontalAnchorLength(rp),
						markerPosition:
							SRBXApiCompat.getRailPositionConnectionMarkerPosition(
								rp,
							),
						core: corePos,
						index,
					};
					consider(
						index === 0 ? 0 : split,
						endpoint.position,
						endpoint,
						railPoint(map, split, index === 0 ? 1 : split - 1),
					);
				}
			}
	return best;
}
function findEndpoint(e: EntityVehicle, pt: number): SRBXBuilderPoint | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(pt);
	if (!looking) return null;
	const world = SRBXApiCompat.getWorld(e),
		seen: { [k: string]: boolean } = {};
	let best: SRBXBuilderPoint | null = null,
		dist = 4;
	for (
		let x = Math.floor(looking.posX) - 2;
		x <= Math.floor(looking.posX) + 2;
		x++
	)
		for (
			let y = Math.floor(looking.posY) - 2;
			y <= Math.floor(looking.posY) + 2;
			y++
		)
			for (
				let z = Math.floor(looking.posZ) - 2;
				z <= Math.floor(looking.posZ) + 2;
				z++
			) {
				const tile = SRBXApiCompat.getTileEntity(world, x, y, z);
				if (!(tile instanceof TileEntityLargeRailBase)) continue;
				const core = tile.getRailCore();
				if (
					!core ||
					SRBXApiCompat.getRailPositionUnsupportedReason(core) !== ""
				)
					continue;
				const key = SRBXApiCompat.getRailPositionCandidateKey(core);
				if (
					seen[key] ||
					(getState(e).split && key === getState(e).split!.railKey)
				)
					continue;
				seen[key] = true;
				const map = SRBXApiCompat.getLogicalRailMap(core);
				if (
					!map ||
					Math.abs(RTMApiCompat.getRailPitch(map, 1000, 0)) > 0.001 ||
					Math.abs(RTMApiCompat.getRailPitch(map, 1000, 500)) >
						0.001 ||
					Math.abs(RTMApiCompat.getRailPitch(map, 1000, 1000)) > 0.001
				)
					continue;
				const rps = SRBXApiCompat.getEditableRailPositions(core);
				for (let i = 0; i < 2; i++) {
					const rp = rps[i] as RailPosition;
					if (
						Math.abs(SRBXApiCompat.getRailPositionAnchorPitch(rp)) >
						0.001
					)
						continue;
					const d =
						Math.pow(rp.posX - looking.posX, 2) +
						Math.pow(rp.posY - looking.posY, 2) +
						Math.pow(rp.posZ - looking.posZ, 2);
					if (d < dist) {
						dist = d;
						best = {
							kind: "rail",
							position: [rp.posX, rp.posY, rp.posZ],
							direction: (rp.direction + 4) & 7,
							anchorYaw: SRBXMath.normalizeDegrees(
								SRBXApiCompat.getHorizontalAnchorYaw(rp) + 180,
							),
							anchorPitch:
								-SRBXApiCompat.getRailPositionAnchorPitch(rp),
							anchorLength: 0,
							markerPosition:
								SRBXApiCompat.getRailPositionConnectionMarkerPosition(
									rp,
								),
							core: SRBXApiCompat.getRailCorePos(core),
							index: i,
						};
					}
				}
			}
	return best;
}
function freePoint(
	e: EntityVehicle,
	pt: number,
	s: State,
): SRBXBuilderPoint | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(pt);
	if (!looking) return null;
	let p: SRBXVec3 = [
		looking.posX,
		looking.posY + DEFAULT_HEIGHT,
		looking.posZ,
	];
	if (s.snap) {
		const yaw = SRBXMath.snapDegrees(
				SRBXMath.horizontalYaw(s.split!.position, p),
				snapAngles[s.snapIndex],
			),
			distance = SRBXMath.roundToStep(
				SRBXMath.horizontalDistance(s.split!.position, p),
				0.5,
			);
		p = SRBXMath.pointAtYawPitchDistance(
			s.split!.position,
			yaw,
			0,
			distance,
		);
		p[1] = Math.round(p[1] * 2) / 2 + DEFAULT_HEIGHT;
	}
	if (s.locked && s.radius < MAX_RADIUS) {
		const direct = SRBXMath.horizontalYaw(s.split!.position, p),
			base = bestRootYaw(s.split!, p),
			side = SRBXMath.relativeDegrees(direct, base) <= 0 ? 1 : -1;
		p = SRBXMath.continueCircularCurve(
			s.split!.position,
			base,
			s.radius * side,
			SRBXMath.horizontalDistance(s.split!.position, p),
		).position;
	}
	const yaw = SRBXMath.horizontalYaw(s.split!.position, p);
	return {
		kind: "free",
		position: p,
		direction: SRBXMath.directionFromYaw(yaw + 180),
		anchorYaw: SRBXMath.normalizeDegrees(yaw + 180),
		anchorPitch: 0,
		anchorLength: 0,
		markerPosition: [
			Math.floor(p[0]) + 0.5,
			Math.floor(p[1]) + DEFAULT_HEIGHT,
			Math.floor(p[2]) + 0.5,
		],
	};
}
function hoverEnd(e: EntityVehicle, pt: number, s: State) {
	return findEndpoint(e, pt) || freePoint(e, pt, s);
}
function bestRootYaw(split: SplitTarget, end: SRBXVec3): number {
	if (split.endpoint) return split.endpoint.anchorYaw;
	const direct = SRBXMath.horizontalYaw(split.position, end),
		a = split.yaw,
		b = SRBXMath.normalizeDegrees(split.yaw + 180);
	return Math.abs(SRBXMath.relativeDegrees(direct, a)) <=
		Math.abs(SRBXMath.relativeDegrees(direct, b))
		? a
		: b;
}
function plan(
	s: State,
	endSource: SRBXBuilderPoint,
): [SRBXBuilderPoint, SRBXBuilderPoint] {
	const end = {
			...endSource,
			position: endSource.position.slice() as SRBXVec3,
			markerPosition: endSource.markerPosition.slice() as SRBXVec3,
		},
		rootYaw = bestRootYaw(s.split!, end.position),
		preserveRoot = !!s.split!.endpoint,
		root: SRBXBuilderPoint = s.split!.endpoint
			? {
					...s.split!.endpoint!,
					position: s.split!.endpoint!.position.slice() as SRBXVec3,
					markerPosition:
						s.split!.endpoint!.markerPosition.slice() as SRBXVec3,
				}
			: {
					kind: "free",
					position: s.split!.position.slice() as SRBXVec3,
					direction: SRBXMath.directionFromYaw(rootYaw),
					anchorYaw: rootYaw,
					anchorPitch: 0,
					anchorLength: 0,
					markerPosition: s.split!.position.slice() as SRBXVec3,
				};
	if (s.locked && s.radius < MAX_RADIUS && end.kind === "free") {
		const direct = SRBXMath.horizontalYaw(root.position, end.position),
			sign = SRBXMath.relativeDegrees(direct, rootYaw) <= 0 ? 1 : -1,
			r = s.radius * sign,
			chord = SRBXMath.horizontalDistance(root.position, end.position),
			angle =
				(2 * Math.asin(Math.min(1, chord / (2 * s.radius))) * 180) /
				Math.PI;
		const circularLength = SRBXMath.circularAnchorLength(r, angle);
		if (!preserveRoot) root.anchorLength = circularLength;
		end.anchorYaw = SRBXMath.normalizeDegrees(rootYaw - angle * sign + 180);
		end.direction = SRBXMath.directionFromYaw(end.anchorYaw);
		end.anchorLength = circularLength;
	} else if (end.kind === "rail") {
		const length = SRBXMath.fixedPairAnchorLength(
			root.position,
			root.anchorYaw,
			0,
			end.position,
			end.anchorYaw,
			end.anchorPitch,
		);
		if (!preserveRoot) root.anchorLength = length;
		end.anchorLength = length;
	} else {
		const c = SRBXMath.circularConnection(
			root.position,
			root.anchorYaw,
			0,
			end.position,
		);
		if (!preserveRoot) root.anchorLength = c.anchorLength;
		end.anchorYaw = c.freeYaw;
		end.anchorPitch = c.freePitch;
		end.direction = SRBXMath.directionFromYaw(end.anchorYaw);
		end.anchorLength = c.anchorLength;
	}
	return [root, end];
}
function renderAt(e: EntityVehicle, pt: number, p: SRBXVec3, part: Parts) {
	const o = NGTOBuilderUtilClient.getInterpolatedPos(e, pt);
	GL11.glPushMatrix();
	GL11.glTranslatef(p[0] - o[0], p[1] - o[1], p[2] - o[2]);
	part.render(renderer);
	GL11.glPopMatrix();
}
function segment(e: EntityVehicle, pt: number, a: SRBXVec3, b: SRBXVec3) {
	const len = SRBXMath.distance(a, b);
	if (len < 0.001) return;
	const o = NGTOBuilderUtilClient.getInterpolatedPos(e, pt),
		dx = b[0] - a[0],
		dy = b[1] - a[1],
		dz = b[2] - a[2];
	GL11.glPushMatrix();
	GL11.glTranslatef(
		(a[0] + b[0]) / 2 - o[0],
		(a[1] + b[1]) / 2 - o[1],
		(a[2] + b[2]) / 2 - o[2],
	);
	GL11.glRotatef((Math.atan2(dx, dz) * 180) / Math.PI, 0, 1, 0);
	GL11.glRotatef(
		(-Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * 180) / Math.PI,
		1,
		0,
		0,
	);
	GL11.glScalef(1, 1, len / 2);
	line.render(renderer);
	GL11.glPopMatrix();
}
function preview(
	e: EntityVehicle,
	pt: number,
	a: SRBXBuilderPoint,
	b: SRBXBuilderPoint,
) {
	const c0 = SRBXMath.pointAtYawPitchDistance(
			a.position,
			a.anchorYaw,
			a.anchorPitch,
			a.anchorLength,
		),
		c1 = SRBXMath.pointAtYawPitchDistance(
			b.position,
			b.anchorYaw,
			b.anchorPitch,
			b.anchorLength,
		);
	let previous = a.position;
	for (let i = 1; i <= 48; i++) {
		const p = SRBXMath.cubicBezierPoint(
			a.position,
			c0,
			c1,
			b.position,
			i / 48,
		);
		segment(e, pt, previous, p);
		previous = p;
	}
}
function radiusPanel(
	e: EntityVehicle,
	pt: number,
	p: SRBXVec3,
	radius: number,
): void {
	const o = NGTOBuilderUtilClient.getInterpolatedPos(e, pt),
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
	if (!isFinite(radius) || Math.abs(radius) >= MAX_RADIUS) {
		curveRadius.render(renderer);
		curveInfinity.render(renderer);
		curveMeter.render(renderer);
	} else {
		const text = String(Math.floor(Math.abs(radius)));
		GL11.glTranslatef((text.length - 1) / 2, 0, 0);
		for (let i = 0; i < text.length; i++) {
			GL11.glPushMatrix();
			GL11.glTranslatef(-i, 0, 0);
			curveDigits[Number(text.substring(i, i + 1))].render(renderer);
			if (i === 0) {
				curveRadius.render(renderer);
				if (radius > 0) curveRight.render(renderer);
				if (radius < 0) curveLeft.render(renderer);
			}
			if (i === text.length - 1) curveMeter.render(renderer);
			GL11.glPopMatrix();
		}
	}
	GL11.glDisable(GL11.GL_BLEND);
	GL11.glPopMatrix();
}
function repeat(s: State, name: string, key: number, delta: number) {
	const now = Date.now();
	if (!Keyboard.isKeyDown(key)) {
		delete s.repeat[name];
		return false;
	}
	if (s.repeat[name] === undefined) {
		s.repeat[name] = now + 350;
		return true;
	}
	if (now < s.repeat[name]) return false;
	s.repeat[name] = now + 75;
	return true;
}
function send(e: EntityVehicle, s: State, r: BranchBuilderRequest) {
	const d = e.getResourceState().getDataMap();
	NGTOBuilderUtil.sendJsonData(d, "branchBuilderRequest", r);
	d.setString("branchBuilderResult", "waiting", 1);
	s.awaiting = true;
	s.pending = r.action;
}
function handleResult(sender: ICommandSender, e: EntityVehicle, s: State) {
	const d = e.getResourceState().getDataMap(),
		r = d.getString("branchBuilderResult");
	if (!s.awaiting || !s.pending || !r || r === "waiting") return;
	s.awaiting = false;
	const u = NGTOBuilderUtil.getJsonData<BranchClientUpdate>(
		d,
		"branchBuilderClientUpdate",
	);
	if (u) {
		const world = SRBXApiCompat.getWorld(e),
			fresh: { [k: string]: boolean } = {};
		for (let i = 0; i < u.refreshed.length; i++)
			fresh[u.refreshed[i].key] = true;
		for (let i = 0; i < u.removed.length; i++) {
			if (!fresh[u.removed[i].key]) {
				s.ignored[u.removed[i].key] = true;
				SRBXApiCompat.removeRailClientGhost(
					world,
					u.removed[i].core,
					u.removed[i].key,
				);
			}
		}
		for (let i = 0; i < u.refreshed.length; i++) {
			delete s.ignored[u.refreshed[i].key];
			const t = SRBXApiCompat.getTileEntity(
				world,
				u.refreshed[i].core[0],
				u.refreshed[i].core[1],
				u.refreshed[i].core[2],
			);
			if (t instanceof TileEntityLargeRailBase) {
				const c = t.getRailCore();
				if (c) SRBXApiCompat.refreshRailCoreClient(c);
			}
		}
	}
	NGTLog.sendChatMessage(
		sender,
		r === "ok"
			? "§a[SuperRailBuilderX] 分岐レールを生成しました"
			: r === "undo_ok"
				? "§a[SuperRailBuilderX] 分岐生成前へ戻しました"
				: `§c[SuperRailBuilderX] 処理失敗: ${r}`,
	);
	if (r === "ok") {
		s.split = null;
		s.end = null;
	}
	s.pending = null;
	d.setString("branchBuilderResult", "", 1);
}
function help(sender: ICommandSender) {
	NGTLog.sendChatMessage(sender, "--- SuperRailBuilderX 分岐生成 ---");
	NGTLog.sendChatMessage(
		sender,
		"[右クリック] 分割点→自由点/別レール端点を選択",
	);
	NGTLog.sendChatMessage(
		sender,
		"[左クリック] 1段階戻る / [P, Ctrl+P] スナップ設定",
	);
	NGTLog.sendChatMessage(
		sender,
		"[O] 半径固定 / [←→, Ctrl+←→] 半径を1m/100m変更",
	);
	NGTLog.sendChatMessage(sender, keys.getDescription("build"));
	NGTLog.sendChatMessage(sender, keys.getDescription("undo"));
}
function input(
	host: EntityPlayer,
	e: EntityVehicle,
	pt: number,
	right: boolean,
	left: boolean,
) {
	const s = getState(e),
		sender = host as unknown as ICommandSender,
		d = e.getResourceState().getDataMap();
	if (keys.pressed("help")) help(sender);
	if (keys.down("exit")) d.setBoolean("isEndEdit", true, 1);
	if (keys.pressed("snap")) {
		s.snap = !s.snap;
		NGTLog.sendChatMessage(
			sender,
			`[SuperRailBuilderX] スナップ: ${s.snap ? "ON" : "OFF"}`,
		);
	}
	if (keys.pressed("snapAngle")) {
		s.snapIndex = (s.snapIndex + 1) % snapAngles.length;
		NGTLog.sendChatMessage(
			sender,
			`[SuperRailBuilderX] 角度スナップ: ${snapAngles[s.snapIndex]}度`,
		);
	}
	if (keys.pressed("radius")) {
		if (!s.locked && s.split) {
			const hover = s.end || hoverEnd(e, pt, s);
			if (hover) {
				const pair = plan(s, hover);
				const c0 = SRBXMath.pointAtYawPitchDistance(
					pair[0].position,
					pair[0].anchorYaw,
					pair[0].anchorPitch,
					pair[0].anchorLength,
				);
				const c1 = SRBXMath.pointAtYawPitchDistance(
					pair[1].position,
					pair[1].anchorYaw,
					pair[1].anchorPitch,
					pair[1].anchorLength,
				);
				const radius = SRBXMath.approximateBezierRadius(
					pair[0].position,
					c0,
					c1,
					pair[1].position,
				);
				s.radius = isFinite(radius)
					? Math.max(
							1,
							Math.min(MAX_RADIUS, Math.round(Math.abs(radius))),
						)
					: MAX_RADIUS;
			}
		}
		s.locked = !s.locked;
	}
	const ctrl = Keyboard.isKeyDown(Keyboard.KEY_LCONTROL);
	if (repeat(s, "left", Keyboard.KEY_LEFT, -1))
		s.radius = Math.max(
			1,
			Math.min(MAX_RADIUS, s.radius - (ctrl ? 100 : 1)),
		);
	if (repeat(s, "right", Keyboard.KEY_RIGHT, 1))
		s.radius = Math.max(
			1,
			Math.min(MAX_RADIUS, s.radius + (ctrl ? 100 : 1)),
		);
	if (left && !s.awaiting) {
		if (s.end) s.end = null;
		else s.split = null;
	}
	if (right && !s.awaiting) {
		if (!s.split) s.split = findSplit(e, pt);
		else if (!s.end) s.end = hoverEnd(e, pt, s);
	}
	if (keys.pressed("build") && !s.awaiting && s.split && s.end) {
		const p = plan(s, s.end),
			request: SRBXBranchRequest = {
				core: s.split.core,
				railKey: s.split.railKey,
				ratio: s.split.ratio,
				branchStart: p[0],
				branchEnd: p[1],
			};
		send(e, s, { action: "create", plan: request });
	}
	if (
		keys.pressed("undo") &&
		!s.awaiting &&
		d.getBoolean("branchBuilderCanUndo")
	)
		send(e, s, { action: "undo" });
	handleResult(sender, e, s);
}
function render(e: EntityVehicle, pass: number, pt: number): void {
	if (!e) {
		body.render(renderer);
		return;
	}
	body.render(renderer);
	const d = e.getResourceState().getDataMap(),
		world = SRBXApiCompat.getWorld(e),
		player = MCWrapperClient.getPlayer(),
		id = d.getString("hostPlayerEntityId"),
		host = id
			? (world.getEntityByID(Number(id)) as unknown as EntityPlayer)
			: null;
	if (!host || host !== player) return;
	SRBXApiCompat.doFollowing(e, host);
	const s = getState(e),
		split = s.split || findSplit(e, pt);
	if (split) {
		const tile = SRBXApiCompat.getTileEntity(
			world,
			split.core[0],
			split.core[1],
			split.core[2],
		);
		if (tile instanceof TileEntityLargeRailBase) {
			const core = tile.getRailCore(),
				map = core ? SRBXApiCompat.getLogicalRailMap(core) : null;
			if (map) {
				const o = NGTOBuilderUtilClient.getInterpolatedPos(e, pt);
				GL11.glPushMatrix();
				GL11.glTranslatef(-o[0], -o[1], -o[2]);
				NGTOBuilderUtilClient.renderRailMapHighlight(
					e,
					map,
					s.split ? "00ffff" : "ffff00",
					0.6,
				);
				GL11.glPopMatrix();
			}
		}
		renderAt(e, pt, split.position, s.split ? selectedCursor : hoverCursor);
	}
	if (s.split) {
		const end = s.end || hoverEnd(e, pt, s);
		if (end) {
			const p = plan(s, end);
			renderAt(e, pt, end.position, s.end ? selectedCursor : hoverCursor);
			renderAt(e, pt, end.markerPosition, markers[end.direction & 7]);
			preview(e, pt, p[0], p[1]);
			const displayedRadius = s.locked
				? s.radius
				: p[0].curveRadius === undefined
					? SRBXMath.approximateBezierRadius(
							p[0].position,
							SRBXMath.pointAtYawPitchDistance(
								p[0].position,
								p[0].anchorYaw,
								p[0].anchorPitch,
								p[0].anchorLength,
							),
							SRBXMath.pointAtYawPitchDistance(
								p[1].position,
								p[1].anchorYaw,
								p[1].anchorPitch,
								p[1].anchorLength,
							),
							p[1].position,
						)
					: p[0].curveRadius;
			radiusPanel(
				e,
				pt,
				[
					(p[0].position[0] + p[1].position[0]) / 2,
					(p[0].position[1] + p[1].position[1]) / 2,
					(p[0].position[2] + p[1].position[2]) / 2,
				],
				displayedRadius,
			);
		}
	}
	const gui = NGTUtilClient.getMinecraft().currentScreen !== null,
		left = Mouse.isButtonDown(0),
		right = Mouse.isButtonDown(1),
		pl = d.getBoolean("prevIsLeftClick"),
		pr = d.getBoolean("prevIsRightClick");
	if (left !== pl) d.setBoolean("prevIsLeftClick", left, 0);
	if (right !== pr) d.setBoolean("prevIsRightClick", right, 0);
	if (renderer.currentMatId === 0 && pass === 0) keys.update();
	if (!gui && renderer.currentMatId === 0 && pass === 0)
		input(host, e, pt, !pr && right, !pl && left);
}
