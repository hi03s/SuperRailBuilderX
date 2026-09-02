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
import { System } from "java.lang";
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
const DEFAULT_RAIL_HEIGHT = 1 / 16;
const MAX_CURVE_RADIUS = 10000;
const DEFAULT_VERTICAL_CURVE_RADIUS = 1000;
const VERTICAL_CURVE_RADIUS_STEP = 1000;
const KEY_REPEAT_DELAY_MS = 350;
const KEY_REPEAT_INTERVAL_MS = 75;

type BuilderState = {
	selected: SRBXBuilderPoint[];
	lastBuiltSelection: SRBXBuilderPoint[] | null;
	snapEnabled: boolean;
	snapAngleIndex: number;
	heightOffsetSixteenths: number;
	curveRadiusLocked: boolean;
	curveRadius: number;
	curveStartYaw: number | null;
	curveKeepSelectedEndpoints: boolean;
	slopePermil: number | null;
	verticalCurveRadius: number;
	keyRepeatAt: { [name: string]: number };
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
let cantLine: Parts;
let directionMarkers: Parts[];
let curvePanelRadius: Parts;
let curvePanelLeft: Parts;
let curvePanelRight: Parts;
let curvePanelMeter: Parts;
let curvePanelInfinity: Parts;
let curvePanelDigits: Parts[];
let slopePanelSlope: Parts;
let slopePanelPermil: Parts;
let slopePanelDigits: Parts[];
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
	keys.register("reset", Keyboard.KEY_C, true, "全状態をリセット");
	keys.register("snap", Keyboard.KEY_P, false, "スナップON/OFF");
	keys.register("snapAngle", Keyboard.KEY_P, true, "スナップ角度を変更");
	keys.register("radiusLock", Keyboard.KEY_O, false, "曲線半径固定ON/OFF");
	keys.register("radiusIncrease", Keyboard.KEY_RIGHT, false, "曲線半径+1m");
	keys.register("radiusDecrease", Keyboard.KEY_LEFT, false, "曲線半径-1m");
	keys.register(
		"radiusIncreaseFast",
		Keyboard.KEY_RIGHT,
		true,
		"曲線半径+100m",
	);
	keys.register(
		"radiusDecreaseFast",
		Keyboard.KEY_LEFT,
		true,
		"曲線半径-100m",
	);
	keys.register("heightUp", Keyboard.KEY_UP, false, "高さ/勾配を増加");
	keys.register("heightDown", Keyboard.KEY_DOWN, false, "高さ/勾配を減少");
	keys.register(
		"heightUpFine",
		Keyboard.KEY_UP,
		true,
		"高さ/縦曲線半径を細かく変更",
	);
	keys.register(
		"heightDownFine",
		Keyboard.KEY_DOWN,
		true,
		"高さ/縦曲線半径を細かく変更",
	);
	keys.register("heightReset", Keyboard.KEY_F, false, "空中高さをリセット");
	keys.register("undo", Keyboard.KEY_Z, true, "直前の生成を取り消す");
	body = renderer.registerParts(new Parts("body"));
	selectCursor = renderer.registerParts(new Parts("selectCursor"));
	selectCursorMarker = renderer.registerParts(
		new Parts("selectCursorMarker"),
	);
	selectedCursor = renderer.registerParts(new Parts("selectedCursor"));
	selectedLine = renderer.registerParts(new Parts("selectedLine"));
	cantLine = renderer.registerParts(new Parts("cantLine"));
	directionMarkers = [];
	for (let i = 0; i < 8; i++)
		directionMarkers.push(renderer.registerParts(new Parts(`marker${i}`)));
	curvePanelRadius = renderer.registerParts(new Parts("curvePanel_Radius"));
	curvePanelLeft = renderer.registerParts(new Parts("curvePanel_L"));
	curvePanelRight = renderer.registerParts(new Parts("curvePanel_R"));
	curvePanelMeter = renderer.registerParts(new Parts("curvePanel_m"));
	curvePanelInfinity = renderer.registerParts(
		new Parts("curvePanel_infinity"),
	);
	curvePanelDigits = [];
	slopePanelDigits = [];
	for (let i = 0; i <= 9; i++) {
		curvePanelDigits.push(
			renderer.registerParts(new Parts(`curvePanel_${i}`)),
		);
		slopePanelDigits.push(
			renderer.registerParts(new Parts(`slopePanel_${i}`)),
		);
	}
	slopePanelSlope = renderer.registerParts(new Parts("slopePanel_slope"));
	slopePanelPermil = renderer.registerParts(new Parts("slopePanel_permil"));
}

function createDefaultState(): BuilderState {
	return {
		selected: [],
		lastBuiltSelection: null,
		snapEnabled: false,
		snapAngleIndex: 1,
		heightOffsetSixteenths: 0,
		curveRadiusLocked: false,
		curveRadius: MAX_CURVE_RADIUS,
		curveStartYaw: null,
		curveKeepSelectedEndpoints: false,
		slopePermil: null,
		verticalCurveRadius: DEFAULT_VERTICAL_CURVE_RADIUS,
		keyRepeatAt: {},
		awaitingResult: false,
		pendingAction: null,
	};
}

function getState(entity: EntityVehicle): BuilderState {
	let state = states.get(entity);
	if (!state) {
		state = createDefaultState();
		states.put(entity, state);
	}
	return state;
}

function resetState(state: BuilderState): void {
	const reset = createDefaultState();
	const lastBuiltSelection = state.lastBuiltSelection;
	state.selected = reset.selected;
	state.lastBuiltSelection = lastBuiltSelection;
	state.snapEnabled = reset.snapEnabled;
	state.snapAngleIndex = reset.snapAngleIndex;
	state.heightOffsetSixteenths = reset.heightOffsetSixteenths;
	state.curveRadiusLocked = reset.curveRadiusLocked;
	state.curveRadius = reset.curveRadius;
	state.curveStartYaw = reset.curveStartYaw;
	state.curveKeepSelectedEndpoints = reset.curveKeepSelectedEndpoints;
	state.slopePermil = reset.slopePermil;
	state.verticalCurveRadius = reset.verticalCurveRadius;
	state.keyRepeatAt = reset.keyRepeatAt;
	state.awaitingResult = reset.awaitingResult;
	state.pendingAction = reset.pendingAction;
}

function copyPoint(point: SRBXBuilderPoint): SRBXBuilderPoint {
	return {
		kind: point.kind,
		position: [point.position[0], point.position[1], point.position[2]],
		direction: point.direction,
		anchorYaw: point.anchorYaw,
		anchorPitch: point.anchorPitch,
		anchorLength: point.anchorLength,
		anchorLengthVertical: point.anchorLengthVertical,
		markerPosition: [
			point.markerPosition[0],
			point.markerPosition[1],
			point.markerPosition[2],
		],
		curveRadius: point.curveRadius,
		ownerBlock: point.ownerBlock
			? [point.ownerBlock[0], point.ownerBlock[1], point.ownerBlock[2]]
			: undefined,
		slopeTarget: point.slopeTarget,
		verticalCurveRadius: point.verticalCurveRadius,
		verticalProfile: point.verticalProfile,
		core: point.core
			? [point.core[0], point.core[1], point.core[2]]
			: undefined,
		index: point.index,
	};
}

function getFreeCursorPosition(
	partialTicks: number,
	state: BuilderState,
): SRBXVec3 | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return null;
	const raw = [
		looking.posX,
		looking.posY + DEFAULT_RAIL_HEIGHT,
		looking.posZ,
	] as SRBXVec3;
	let result: SRBXVec3;
	if (!state.snapEnabled) result = SRBXMath.roundPosition(raw, 0.001);
	else {
		const start = state.selected.length > 0 ? state.selected[0] : null;
		if (!start || start.kind !== "free") {
			result = SRBXMath.roundPosition(
				[looking.posX, looking.posY, looking.posZ],
				0.5,
			);
			result[1] += DEFAULT_RAIL_HEIGHT;
		} else {
			const distance = SRBXMath.distance(start.position, raw);
			if (distance < 0.001) result = copyPoint(start).position;
			else {
				const horizontal = SRBXMath.horizontalDistance(
					start.position,
					raw,
				);
				const pitch =
					(Math.atan2(raw[1] - start.position[1], horizontal) * 180) /
					Math.PI;
				const yaw = SRBXMath.snapDegrees(
					SRBXMath.horizontalYaw(start.position, raw),
					snapAngles[state.snapAngleIndex],
				);
				result = SRBXMath.pointAtYawPitchDistance(
					start.position,
					yaw,
					pitch,
					SRBXMath.roundToStep(distance, 0.5),
				);
			}
		}
	}
	const start = state.selected.length === 1 ? state.selected[0] : null;
	if (start && start.kind === "rail") {
		const horizontal = SRBXMath.horizontalDistance(start.position, result);
		result[1] =
			start.position[1] +
			horizontal * Math.tan((start.anchorPitch * Math.PI) / 180);
	} else {
		result[1] += state.heightOffsetSixteenths / 16;
	}
	return SRBXMath.roundPosition(result, 0.0005);
}

function freeMarkerPosition(position: SRBXVec3): SRBXVec3 {
	return [
		Math.floor(position[0]) + 0.5,
		Math.floor(position[1]) + DEFAULT_RAIL_HEIGHT,
		Math.floor(position[2]) + 0.5,
	];
}

function markerPositionForDirection(
	position: SRBXVec3,
	direction: number,
): SRBXVec3 {
	return SRBXMath.markerBlockDisplayPosition(
		position,
		direction,
		DEFAULT_RAIL_HEIGHT,
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
									anchorLength: 0,
									markerPosition:
										SRBXApiCompat.getRailPositionConnectionMarkerPosition(
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
	const position = getFreeCursorPosition(partialTicks, state);
	if (!position) return null;
	if (
		state.curveRadiusLocked &&
		!state.curveKeepSelectedEndpoints &&
		state.selected.length === 1
	) {
		const start = state.selected[0];
		const directYaw = SRBXMath.horizontalYaw(start.position, position);
		const startYaw =
			start.kind === "rail"
				? start.anchorYaw
				: state.curveStartYaw === null
					? directYaw
					: state.curveStartYaw;
		const side =
			SRBXMath.relativeDegrees(directYaw, startYaw) <= 0 ? 1 : -1;
		const curve = SRBXMath.continueCircularCurve(
			start.position,
			startYaw,
			state.curveRadius * side,
			SRBXMath.horizontalDistance(start.position, position),
		);
		position[0] = curve.position[0];
		position[2] = curve.position[2];
	}
	return {
		kind: "free",
		position,
		direction: 0,
		anchorYaw: 0,
		anchorPitch: 0,
		anchorLength: 0,
		markerPosition: freeMarkerPosition(position),
	};
}

function orientPair(
	startSource: SRBXBuilderPoint,
	endSource: SRBXBuilderPoint,
	state?: BuilderState,
): [SRBXBuilderPoint, SRBXBuilderPoint] {
	const start = copyPoint(startSource);
	const end = copyPoint(endSource);
	start.curveRadius = undefined;
	end.curveRadius = undefined;
	if (start.kind === "free" && end.kind === "free") {
		const yaw = SRBXMath.horizontalYaw(start.position, end.position);
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
		start.anchorLength =
			SRBXMath.distance(start.position, end.position) / 3;
		end.anchorLength = start.anchorLength;
		start.markerPosition = markerPositionForDirection(
			start.position,
			start.direction,
		);
		end.markerPosition = markerPositionForDirection(
			end.position,
			end.direction,
		);
		if (
			state &&
			state.curveRadiusLocked &&
			!state.curveKeepSelectedEndpoints &&
			state.curveRadius < MAX_CURVE_RADIUS &&
			state.curveStartYaw !== null
		) {
			const directYaw = SRBXMath.horizontalYaw(
				start.position,
				end.position,
			);
			const radiusSign =
				SRBXMath.relativeDegrees(directYaw, state.curveStartYaw) <= 0
					? 1
					: -1;
			const radius = state.curveRadius * radiusSign;
			const chord = SRBXMath.horizontalDistance(
				start.position,
				end.position,
			);
			const angle =
				(2 *
					Math.asin(Math.min(1, chord / (2 * state.curveRadius))) *
					180) /
				Math.PI;
			start.anchorYaw = state.curveStartYaw;
			end.anchorYaw = SRBXMath.normalizeDegrees(
				state.curveStartYaw - angle * radiusSign + 180,
			);
			start.direction = SRBXMath.directionFromYaw(start.anchorYaw);
			end.direction = SRBXMath.directionFromYaw(end.anchorYaw);
			start.anchorLength = SRBXMath.circularAnchorLength(radius, angle);
			end.anchorLength = start.anchorLength;
			start.curveRadius = radius;
			start.markerPosition = markerPositionForDirection(
				start.position,
				start.direction,
			);
			end.markerPosition = markerPositionForDirection(
				end.position,
				end.direction,
			);
		}
	} else if (start.kind === "rail" && end.kind === "rail") {
		start.anchorLength = SRBXMath.fixedPairAnchorLength(
			start.position,
			start.anchorYaw,
			start.anchorPitch,
			end.position,
			end.anchorYaw,
			end.anchorPitch,
		);
		end.anchorLength = start.anchorLength;
		const startControl = SRBXMath.pointAtYawPitchDistance(
			start.position,
			start.anchorYaw,
			start.anchorPitch,
			start.anchorLength,
		);
		const endControl = SRBXMath.pointAtYawPitchDistance(
			end.position,
			end.anchorYaw,
			end.anchorPitch,
			end.anchorLength,
		);
		const radius = SRBXMath.approximateBezierRadius(
			start.position,
			startControl,
			endControl,
			end.position,
		);
		if (isFinite(radius)) start.curveRadius = radius;
	} else {
		const fixed = start.kind === "rail" ? start : end;
		const free = start.kind === "free" ? start : end;
		const circular = SRBXMath.circularConnection(
			fixed.position,
			fixed.anchorYaw,
			fixed.anchorPitch,
			free.position,
		);
		fixed.anchorLength = circular.anchorLength;
		free.anchorYaw = circular.freeYaw;
		free.anchorPitch = circular.freePitch;
		free.anchorLength = circular.anchorLength;
		free.direction = SRBXMath.directionFromYaw(free.anchorYaw);
		free.markerPosition = markerPositionForDirection(
			free.position,
			free.direction,
		);
		if (isFinite(circular.radius))
			start.curveRadius =
				fixed === start ? circular.radius : -circular.radius;
	}
	if (state && state.slopePermil !== null) {
		const pitch = SRBXMath.pitchFromPermil(state.slopePermil);
		if (start.kind === "rail" && end.kind === "free") {
			end.anchorPitch = -pitch;
			end.slopeTarget = true;
			end.verticalCurveRadius = state.verticalCurveRadius;
		}
		if (start.kind === "free" && end.kind === "rail") {
			start.anchorPitch = pitch;
			start.slopeTarget = true;
			start.verticalCurveRadius = state.verticalCurveRadius;
		}
		const verticalSegments = SRBXMath.planVerticalRailSegments(start, end);
		return [
			verticalSegments[0][0],
			verticalSegments[verticalSegments.length - 1][1],
		];
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
	renderAt(
		entity,
		partialTicks,
		point.markerPosition,
		directionMarkers[direction],
	);
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

function renderBezierSegment(
	entity: EntityVehicle,
	partialTicks: number,
	start: SRBXBuilderPoint,
	end: SRBXBuilderPoint,
): void {
	const startHorizontalControl = SRBXMath.pointAtYawPitchDistance(
		start.position,
		start.anchorYaw,
		0,
		start.anchorLength,
	);
	const endHorizontalControl = SRBXMath.pointAtYawPitchDistance(
		end.position,
		end.anchorYaw,
		0,
		end.anchorLength,
	);
	const startVerticalLength =
		start.anchorLengthVertical === undefined
			? start.anchorLength
			: start.anchorLengthVertical;
	const endVerticalLength =
		end.anchorLengthVertical === undefined
			? end.anchorLength
			: end.anchorLengthVertical;
	const startControl: SRBXVec3 = [
		startHorizontalControl[0],
		start.position[1] +
			Math.sin((start.anchorPitch * Math.PI) / 180) * startVerticalLength,
		startHorizontalControl[2],
	];
	const endControl: SRBXVec3 = [
		endHorizontalControl[0],
		end.position[1] +
			Math.sin((end.anchorPitch * Math.PI) / 180) * endVerticalLength,
		endHorizontalControl[2],
	];
	const split = Math.max(
		8,
		Math.min(
			96,
			Math.ceil(SRBXMath.distance(start.position, end.position) * 2),
		),
	);
	let previous = start.position;
	for (let i = 1; i <= split; i++) {
		const current = SRBXMath.cubicBezierPoint(
			start.position,
			startControl,
			endControl,
			end.position,
			i / split,
		);
		renderLine(entity, partialTicks, previous, current);
		previous = current;
	}
}

function renderBezier(
	entity: EntityVehicle,
	partialTicks: number,
	start: SRBXBuilderPoint,
	end: SRBXBuilderPoint,
): void {
	const segments = SRBXMath.planVerticalRailSegments(start, end);
	for (let i = 0; i < segments.length; i++)
		renderBezierSegment(
			entity,
			partialTicks,
			segments[i][0],
			segments[i][1],
		);
	if (segments.length > 1) {
		const split = segments[0][1];
		const entityPosition = NGTOBuilderUtilClient.getInterpolatedPos(
			entity,
			partialTicks,
		);
		GL11.glPushMatrix();
		GL11.glTranslatef(
			split.position[0] - entityPosition[0],
			split.position[1] - entityPosition[1],
			split.position[2] - entityPosition[2],
		);
		GL11.glRotatef(split.anchorYaw, 0, 1, 0);
		cantLine.render(renderer);
		GL11.glPopMatrix();
	}
}

function orientPanelToPlayer(
	entity: EntityVehicle,
	partialTicks: number,
	position: SRBXVec3,
): void {
	const entityPosition = NGTOBuilderUtilClient.getInterpolatedPos(
		entity,
		partialTicks,
	);
	const horizontal = SRBXMath.horizontalDistance(position, entityPosition);
	const pitch =
		(Math.atan2(entityPosition[1] - position[1], horizontal) * 180) /
		Math.PI;
	GL11.glTranslatef(
		position[0] - entityPosition[0],
		position[1] - entityPosition[1],
		position[2] - entityPosition[2],
	);
	GL11.glRotatef(
		SRBXMath.horizontalYaw(position, entityPosition) + 180,
		0,
		1,
		0,
	);
	GL11.glRotatef(pitch, 1, 0, 0);
}

function renderRadiusPanelAt(
	entity: EntityVehicle,
	partialTicks: number,
	position: SRBXVec3,
	radius: number,
): void {
	GL11.glPushMatrix();
	orientPanelToPlayer(entity, partialTicks, position);
	if (!isFinite(radius) || Math.abs(radius) >= MAX_CURVE_RADIUS) {
		curvePanelRadius.render(renderer);
		curvePanelInfinity.render(renderer);
		curvePanelMeter.render(renderer);
		GL11.glPopMatrix();
		return;
	}
	const digits = String(Math.floor(Math.abs(radius)));
	GL11.glTranslatef((digits.length - 1) / 2, 0, 0);
	for (let i = 0; i < digits.length; i++) {
		const digit = Number(digits.substring(i, i + 1));
		GL11.glPushMatrix();
		GL11.glTranslatef(-i, 0, 0);
		curvePanelDigits[digit].render(renderer);
		if (i === 0) {
			curvePanelRadius.render(renderer);
			if (radius > 0) curvePanelRight.render(renderer);
			if (radius < 0) curvePanelLeft.render(renderer);
		}
		if (i === digits.length - 1) curvePanelMeter.render(renderer);
		GL11.glPopMatrix();
	}
	GL11.glPopMatrix();
}

function renderCurveRadius(
	entity: EntityVehicle,
	partialTicks: number,
	start: SRBXBuilderPoint,
	end: SRBXBuilderPoint,
): void {
	const radius = start.curveRadius;
	if (radius === undefined || !isFinite(radius)) return;
	const startControl = SRBXMath.pointAtYawPitchDistance(
		start.position,
		start.anchorYaw,
		start.anchorPitch,
		start.anchorLength,
	);
	const endControl = SRBXMath.pointAtYawPitchDistance(
		end.position,
		end.anchorYaw,
		end.anchorPitch,
		end.anchorLength,
	);
	const panelPosition = SRBXMath.cubicBezierPoint(
		start.position,
		startControl,
		endControl,
		end.position,
		0.5,
	);
	renderRadiusPanelAt(entity, partialTicks, panelPosition, radius);
}

function renderSlopePanelAt(
	entity: EntityVehicle,
	partialTicks: number,
	point: SRBXBuilderPoint,
): void {
	const digits = String(
		Math.round(Math.abs(SRBXMath.permilFromPitch(point.anchorPitch))),
	);
	GL11.glPushMatrix();
	orientPanelToPlayer(entity, partialTicks, point.position);
	GL11.glTranslatef((digits.length - 1) / 2, 1, 0);
	for (let i = 0; i < digits.length; i++) {
		const digit = Number(digits.substring(i, i + 1));
		GL11.glPushMatrix();
		GL11.glTranslatef(-i, 0, 0);
		slopePanelDigits[digit].render(renderer);
		if (i === 0) slopePanelSlope.render(renderer);
		if (i === digits.length - 1) slopePanelPermil.render(renderer);
		GL11.glPopMatrix();
	}
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
	NGTLog.sendChatMessage(sender, keys.getDescription("reset"));
	NGTLog.sendChatMessage(sender, keys.getDescription("snap"));
	NGTLog.sendChatMessage(sender, keys.getDescription("snapAngle"));
	NGTLog.sendChatMessage(sender, keys.getDescription("radiusLock"));
	NGTLog.sendChatMessage(sender, "[←/→] 固定半径を1m変更");
	NGTLog.sendChatMessage(sender, "[Ctrl+←/→] 固定半径を100m変更");
	NGTLog.sendChatMessage(sender, "[↑/↓] 高さを1mまたは目標勾配を1‰変更");
	NGTLog.sendChatMessage(
		sender,
		"[Ctrl+↑/↓] 高さを1/16mまたは縦曲線半径を1000m変更",
	);
	NGTLog.sendChatMessage(sender, keys.getDescription("heightReset"));
	NGTLog.sendChatMessage(sender, keys.getDescription("undo"));
	NGTLog.sendChatMessage(sender, keys.getDescription("exit"));
}

function resultMessage(result: string): string {
	if (result === "hold_rail_item") return "レールを手に持ってください";
	if (result === "rail_endpoint_changed")
		return "選択した既設レール端部が変更されています";
	if (result === "rail_occupied") return "対象レールに列車が在線しています";
	if (result === "rail_core_conflict")
		return "生成経路が既設レールコアと重なっています";
	if (result === "section_core_conflict")
		return "セクションコアを安全に配置できる空き位置がありません";
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
		state.curveKeepSelectedEndpoints = false;
		state.curveStartYaw = null;
		state.slopePermil = null;
		NGTLog.sendChatMessage(
			sender,
			"§a[SuperRailBuilderX] レールを生成しました",
		);
	} else if (result === "undo_ok" && state.pendingAction === "undo") {
		state.selected = state.lastBuiltSelection
			? state.lastBuiltSelection.map(copyPoint)
			: [];
		state.lastBuiltSelection = null;
		state.curveKeepSelectedEndpoints = state.curveRadiusLocked;
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

function repeatedKey(state: BuilderState, name: string): boolean {
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

function getRadiusPreviewPair(
	entity: EntityVehicle,
	partialTicks: number,
	state: BuilderState,
): [SRBXBuilderPoint, SRBXBuilderPoint] | null {
	if (state.selected.length === 2)
		return orientPair(state.selected[0], state.selected[1]);
	if (state.selected.length !== 1) return null;
	const hover = getHoverPoint(entity, partialTicks, state);
	return hover ? orientPair(state.selected[0], hover) : null;
}

function initializeCurveStartYaw(
	entity: EntityVehicle,
	partialTicks: number,
	state: BuilderState,
): void {
	if (state.curveStartYaw !== null || state.selected.length !== 1) return;
	const start = state.selected[0];
	if (start.kind === "rail") {
		state.curveStartYaw = start.anchorYaw;
		return;
	}
	const hover = getHoverPoint(entity, partialTicks, state);
	if (hover)
		state.curveStartYaw = SRBXMath.horizontalYaw(
			start.position,
			hover.position,
		);
}

function changeCurveRadius(
	entity: EntityVehicle,
	partialTicks: number,
	state: BuilderState,
	delta: number,
): void {
	if (!state.curveRadiusLocked) return;
	initializeCurveStartYaw(entity, partialTicks, state);
	state.curveRadius = Math.max(
		1,
		Math.min(MAX_CURVE_RADIUS, state.curveRadius + delta),
	);
}

function hasSlopeAdjustment(state: BuilderState): boolean {
	if (state.selected.length === 1) return state.selected[0].kind === "rail";
	return (
		state.selected.length === 2 &&
		state.selected[0].kind !== state.selected[1].kind
	);
}

function hasSelectedRail(state: BuilderState): boolean {
	for (let i = 0; i < state.selected.length; i++)
		if (state.selected[i].kind === "rail") return true;
	return false;
}

function changeHeightOrSlope(
	sender: ICommandSender,
	state: BuilderState,
	direction: number,
	fine: boolean,
): void {
	if (hasSelectedRail(state)) {
		if (fine) {
			state.verticalCurveRadius = Math.max(
				DEFAULT_VERTICAL_CURVE_RADIUS,
				state.verticalCurveRadius +
					direction * VERTICAL_CURVE_RADIUS_STEP,
			);
			NGTLog.sendChatMessage(
				sender,
				`[SuperRailBuilderX] 縦曲線半径: ${state.verticalCurveRadius}m`,
			);
		} else if (hasSlopeAdjustment(state)) {
			if (state.slopePermil === null) state.slopePermil = 0;
			state.slopePermil += direction;
		}
		return;
	}
	state.heightOffsetSixteenths += direction * (fine ? 1 : 16);
	NGTLog.sendChatMessage(
		sender,
		`[SuperRailBuilderX] 高さオフセット: ${state.heightOffsetSixteenths}/16m (${state.heightOffsetSixteenths / 16}m)`,
	);
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
	if (keys.pressed("reset") && !state.awaitingResult) {
		resetState(state);
		NGTLog.sendChatMessage(
			sender,
			"§a[SuperRailBuilderX] 選択設定を完全リセットしました（Undoは維持）",
		);
	}
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
	if (keys.pressed("radiusLock") && !state.awaitingResult) {
		if (state.curveRadiusLocked) {
			state.curveRadiusLocked = false;
			state.curveKeepSelectedEndpoints = false;
			state.curveStartYaw = null;
		} else {
			const pair = getRadiusPreviewPair(entity, partialTicks, state);
			const displayedRadius = pair ? pair[0].curveRadius : undefined;
			state.curveRadius =
				displayedRadius !== undefined && isFinite(displayedRadius)
					? Math.max(
							1,
							Math.min(
								MAX_CURVE_RADIUS,
								Math.round(Math.abs(displayedRadius)),
							),
						)
					: MAX_CURVE_RADIUS;
			state.curveRadiusLocked = true;
			state.curveKeepSelectedEndpoints = state.selected.length === 2;
			if (pair) state.curveStartYaw = pair[0].anchorYaw;
		}
	}
	if (repeatedKey(state, "radiusIncrease"))
		changeCurveRadius(entity, partialTicks, state, 1);
	if (repeatedKey(state, "radiusDecrease"))
		changeCurveRadius(entity, partialTicks, state, -1);
	if (repeatedKey(state, "radiusIncreaseFast"))
		changeCurveRadius(entity, partialTicks, state, 100);
	if (repeatedKey(state, "radiusDecreaseFast"))
		changeCurveRadius(entity, partialTicks, state, -100);
	if (repeatedKey(state, "heightUp"))
		changeHeightOrSlope(sender, state, 1, false);
	if (repeatedKey(state, "heightDown"))
		changeHeightOrSlope(sender, state, -1, false);
	if (repeatedKey(state, "heightUpFine"))
		changeHeightOrSlope(sender, state, 1, true);
	if (repeatedKey(state, "heightDownFine"))
		changeHeightOrSlope(sender, state, -1, true);
	if (keys.pressed("heightReset") && !hasSelectedRail(state)) {
		state.heightOffsetSixteenths = 0;
		NGTLog.sendChatMessage(
			sender,
			"[SuperRailBuilderX] 高さオフセット: 0/16m (0m)",
		);
	}
	if (keys.pressed("clear") && !state.awaitingResult) {
		state.selected = [];
		state.curveKeepSelectedEndpoints = false;
		state.curveStartYaw = null;
	}
	if (leftClick && !state.awaitingResult && state.selected.length > 0) {
		state.selected.pop();
		state.curveKeepSelectedEndpoints = false;
		if (state.selected.length === 0) state.curveStartYaw = null;
	}
	if (rightClick && !state.awaitingResult && state.selected.length < 2) {
		const point = getHoverPoint(entity, partialTicks, state);
		if (point) {
			state.selected.push(copyPoint(point));
			if (state.selected.length === 1) {
				state.curveKeepSelectedEndpoints = false;
				state.curveStartYaw =
					point.kind === "rail"
						? point.anchorYaw
						: state.curveRadiusLocked &&
							  state.curveRadius < MAX_CURVE_RADIUS
							? SRBXMath.normalizeDegrees(-host.rotationYaw)
							: null;
				state.slopePermil =
					point.kind === "rail"
						? Math.round(
								SRBXMath.permilFromPitch(point.anchorPitch),
							)
						: null;
			} else if (
				state.selected[0].kind === "free" &&
				point.kind === "rail"
			) {
				state.slopePermil = Math.round(
					SRBXMath.permilFromPitch(-point.anchorPitch),
				);
			}
		}
	}
	if (
		keys.pressed("build") &&
		!state.awaitingResult &&
		state.selected.length === 2
	) {
		const pair = orientPair(state.selected[0], state.selected[1], state);
		state.selected = [copyPoint(pair[0]), copyPoint(pair[1])];
		sendRequest(entity, state, {
			action: "create",
			start: pair[0],
			end: pair[1],
		});
		NGTLog.sendChatMessage(sender, "[SuperRailBuilderX] レール生成中...");
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
		const displayHover =
			state.selected.length === 1 && displayPoints.length === 2
				? displayPoints[1]
				: hover;
		renderAt(entity, partialTicks, displayHover.position, selectCursor);
		if (hover.kind === "rail")
			renderAt(
				entity,
				partialTicks,
				displayHover.markerPosition,
				selectCursorMarker,
			);
	}
	for (let i = 0; i < state.selected.length; i++)
		renderSelectedPoint(entity, partialTicks, displayPoints[i]);
	if (state.selected.length >= 1 && displayPoints.length >= 2)
		renderBezier(entity, partialTicks, displayPoints[0], displayPoints[1]);
	if (state.selected.length >= 1 && displayPoints.length >= 2)
		renderCurveRadius(
			entity,
			partialTicks,
			displayPoints[0],
			displayPoints[1],
		);
	if (displayPoints.length >= 2) {
		renderSlopePanelAt(entity, partialTicks, displayPoints[0]);
		renderSlopePanelAt(entity, partialTicks, displayPoints[1]);
	}
	if (state.curveRadiusLocked) {
		const radiusPanelPosition = getFreeCursorPosition(partialTicks, state);
		if (radiusPanelPosition)
			renderRadiusPanelAt(
				entity,
				partialTicks,
				radiusPanelPosition,
				state.curveRadius,
			);
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
