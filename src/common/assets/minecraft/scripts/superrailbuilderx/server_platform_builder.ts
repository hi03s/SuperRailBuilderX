import { SRBXPlatformGeometry } from "./SRBXPlatformGeometry";
import { TileEntityLargeRailBase } from "jp.ngt.rtm.rail";
import { SRBXToolSwitchServer } from "./SRBXToolSwitchServer";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ScriptExecuter } from "jp.ngt.rtm.modelpack";
import { Entity } from "net.minecraft.entity";
import { EntityPlayer } from "net.minecraft.entity.player";
import { WeakHashMap } from "java.util";
import { ErrorLogger } from "../lib_hi03toolkit_1_0/lib_ErrorLogger";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import {
	RailCorePos,
	SRBXApiCompat,
	SRBXBuilderPoint,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath } from "./SRBXMath";

const VERSION = "0.3.2";
const MAX_COPY_RAILS = 128;
const MIN_RAIL_LENGTH = 2;

export type PlatformBuilderPlan = {
	sourceCore: RailCorePos;
	sourceRailKey: string;
	sourceStart: RailCorePos;
	sourceEnd: RailCorePos;
	start: SRBXBuilderPoint;
	end: SRBXBuilderPoint;
};

export type PlatformBuilderRequest =
	| {
			action: "create";
			plans: PlatformBuilderPlan[];
			spacing: number;
			height: number;
			side: number;
	  }
	| { action: "undo" };

type CreatedRail = { core: RailCorePos; key: string };
type UndoRecord = { rails: CreatedRail[] };

const hosts: WeakHashMap<Entity, EntityPlayer> = new WeakHashMap();
const undoRecords: WeakHashMap<EntityVehicle, UndoRecord> = new WeakHashMap();

function pointControl(point: SRBXBuilderPoint): RailCorePos {
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

function plannedLength(plan: PlatformBuilderPlan): number {
	return SRBXMath.cubicBezierLength(
		plan.start.position,
		pointControl(plan.start),
		pointControl(plan.end),
		plan.end.position,
	);
}

function rollback(
	world: net.minecraft.world.World,
	created: CreatedRail[],
): string {
	for (let i = created.length - 1; i >= 0; i--) {
		const rail = created[i];
		const result = SRBXApiCompat.undoBuilderRail(
			world,
			rail.core[0],
			rail.core[1],
			rail.core[2],
			rail.key,
		);
		NGTLog.debug(
			`[SuperRailBuilderX platform-builder] rollback: index=${i}, core=${rail.core[0]},${rail.core[1]},${rail.core[2]}, key=${rail.key}, result=${result}`,
		);
		if (result !== "ok") return result;
		created.splice(i, 1);
	}
	return "ok";
}

function processRequest(
	entity: EntityVehicle,
	host: EntityPlayer,
	request: PlatformBuilderRequest,
): string {
	const world = SRBXApiCompat.getWorld(entity);
	if (!request || (request.action !== "create" && request.action !== "undo"))
		return "invalid_request";
	if (request.action === "undo") {
		const undo = undoRecords.get(entity);
		if (!undo) return "nothing_to_undo";
		const removed: CreatedRail[] = [];
		for (let i = undo.rails.length - 1; i >= 0; i--) {
			const rail = undo.rails[i];
			const result = SRBXApiCompat.undoBuilderRail(
				world,
				rail.core[0],
				rail.core[1],
				rail.core[2],
				rail.key,
			);
			if (result !== "ok") {
				NGTOBuilderUtil.sendJsonData(
					entity.getResourceState().getDataMap(),
					"platformBuilderRemovedRails",
					removed,
				);
				return result;
			}
			removed.push(rail);
			undo.rails.splice(i, 1);
		}
		NGTOBuilderUtil.sendJsonData(
			entity.getResourceState().getDataMap(),
			"platformBuilderRemovedRails",
			removed,
		);
		undoRecords.remove(entity);
		return "undo_ok";
	}
	if (
		!request.plans ||
		request.plans.length === 0 ||
		request.plans.length > MAX_COPY_RAILS
	)
		return "invalid_plan_count";
	if (
		typeof request.spacing !== "number" ||
		typeof request.height !== "number" ||
		!isFinite(request.spacing) ||
		request.spacing < 0.1 ||
		request.spacing > 512 ||
		!isFinite(request.height) ||
		Math.abs(request.height) > 256 ||
		(request.side !== 1 && request.side !== -1)
	)
		return "invalid_platform_settings";
	const seen: { [key: string]: boolean } = {};
	const plans: PlatformBuilderPlan[] = [];
	for (let i = 0; i < request.plans.length; i++) {
		const source = request.plans[i];
		if (
			!source ||
			!source.sourceCore ||
			source.sourceCore.length !== 3 ||
			source.sourceCore.some(
				(coordinate) =>
					typeof coordinate !== "number" ||
					!isFinite(coordinate) ||
					Math.floor(coordinate) !== coordinate,
			) ||
			!source.sourceRailKey ||
			seen[source.sourceRailKey]
		)
			return "invalid_source_rail";
		seen[source.sourceRailKey] = true;
		const tile = SRBXApiCompat.getTileEntity(
			world,
			source.sourceCore[0],
			source.sourceCore[1],
			source.sourceCore[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase))
			return "source_rail_changed";
		const core = tile.getRailCore();
		if (
			!core ||
			SRBXApiCompat.getRailPositionCandidateKey(core) !==
				source.sourceRailKey ||
			SRBXApiCompat.getRailPositionUnsupportedReason(core)
		)
			return "source_rail_changed";
		const rp = SRBXApiCompat.getEditableRailPositions(core);
		if (!rp || rp.length !== 2 || !rp[0] || !rp[1])
			return "source_rail_changed";
		const close = (a: RailCorePos, b: RailCorePos): boolean =>
			!!a && a.length === 3 && SRBXMath.distance(a, b) < 0.01;
		const sourceStart: RailCorePos = [rp[0].posX, rp[0].posY, rp[0].posZ],
			sourceEnd: RailCorePos = [rp[1].posX, rp[1].posY, rp[1].posZ];
		if (
			!close(source.sourceStart, sourceStart) ||
			!close(source.sourceEnd, sourceEnd)
		)
			return "source_rail_changed";
		const pair = SRBXPlatformGeometry.offset(
			rp[0],
			rp[1],
			request.spacing * request.side,
			request.height,
		);
		if (!pair) return "invalid_platform_offset";
		const plan: PlatformBuilderPlan = {
			sourceCore: source.sourceCore,
			sourceRailKey: source.sourceRailKey,
			sourceStart,
			sourceEnd,
			start: pair.start,
			end: pair.end,
		};
		if (plannedLength(plan) <= MIN_RAIL_LENGTH) return "rail_too_short";
		plans.push(plan);
	}
	SRBXPlatformGeometry.assignOwners(plans);
	request.plans = plans;
	const sourceKeys = request.plans.map((plan) => plan.sourceRailKey);
	const created: CreatedRail[] = [];
	for (let i = 0; i < request.plans.length; i++) {
		const plan = request.plans[i];
		const result = SRBXApiCompat.createBuilderRail(
			world,
			host,
			plan.start,
			plan.end,
			sourceKeys.concat(created.map((rail) => rail.key)),
			{
				core: plan.sourceCore,
				railKey: plan.sourceRailKey,
				startPosition: plan.sourceStart,
				endPosition: plan.sourceEnd,
			},
			undefined,
			false,
			false,
			false,
			undefined,
			undefined,
			false,
			true,
		);
		if (result.status !== "ok" || !result.undoCore || !result.undoKey) {
			NGTLog.debug(
				`[SuperRailBuilderX platform-builder] creation failed: plan=${i + 1}/${request.plans.length}, sourceKey=${plan.sourceRailKey}, sourceCore=${plan.sourceCore[0]},${plan.sourceCore[1]},${plan.sourceCore[2]}, start=${plan.start.position[0]},${plan.start.position[1]},${plan.start.position[2]}, end=${plan.end.position[0]},${plan.end.position[1]},${plan.end.position[2]}, created=${created.length}, result=${result.status}`,
			);
			const rollbackStatus = rollback(world, created);
			if (created.length) {
				undoRecords.put(entity, { rails: created });
				return `rollback_failed:${rollbackStatus}`;
			}
			return result.status;
		}
		created.push({ core: result.undoCore, key: result.undoKey });
	}
	undoRecords.put(entity, { rails: created });
	return "ok";
}

function onUpdate(entity: EntityVehicle, scriptExecuter: ScriptExecuter): void {
	void scriptExecuter;
	entity.rotationYaw = 0;
	const dataMap = entity.getResourceState().getDataMap();
	let host = hosts.get(entity) || SRBXToolSwitchServer.restoreHost(entity);
	if (host) hosts.put(entity, host);
	const rider = SRBXApiCompat.getRider(entity) as unknown as EntityPlayer;
	const ridingEntity = SRBXApiCompat.getRidingEntity(entity);
	if (dataMap.getString("VERSIONS") === "")
		dataMap.setString("VERSIONS", VERSION, 1);
	if (!host) {
		if (rider) {
			host = rider;
			hosts.put(entity, host);
			dataMap.setString(
				"hostPlayerEntityId",
				String(host.getEntityId()),
				1,
			);
			SRBXApiCompat.dismountPlayer(entity);
			SRBXApiCompat.startRiding(entity, host);
		} else if (ridingEntity instanceof EntityPlayer) {
			host = ridingEntity;
			hosts.put(entity, host);
			dataMap.setString(
				"hostPlayerEntityId",
				String(host.getEntityId()),
				1,
			);
		}
		return;
	}
	SRBXApiCompat.doFollowing(entity, host);
	if (rider) {
		SRBXApiCompat.dismountPlayer(entity);
		dataMap.setBoolean("isEndEdit", true, 1);
	}
	if (dataMap.getBoolean("isEndEdit")) {
		entity.setDead();
		return;
	}
	if (SRBXToolSwitchServer.update(entity, host)) return;
	const canUndo = undoRecords.get(entity) !== null;
	if (dataMap.getBoolean("platformBuilderCanUndo") !== canUndo)
		dataMap.setBoolean("platformBuilderCanUndo", canUndo, 1);
	const request = NGTOBuilderUtil.getJsonData<PlatformBuilderRequest>(
		dataMap,
		"platformBuilderRequest",
	);
	if (!request) return;
	try {
		const result = processRequest(entity, host, request);
		dataMap.setString("platformBuilderResult", result, 1);
		const updatedCanUndo = undoRecords.get(entity) !== null;
		if (dataMap.getBoolean("platformBuilderCanUndo") !== updatedCanUndo)
			dataMap.setBoolean("platformBuilderCanUndo", updatedCanUndo, 1);
		NGTLog.debug(
			`[SuperRailBuilderX platform-builder] request completed: action=${request.action}, result=${result}`,
		);
	} catch (error) {
		ErrorLogger.log(
			"SuperRailBuilderX platform-builder",
			"processRequest",
			error,
			{ action: request.action },
		);
		dataMap.setString("platformBuilderResult", "internal_error", 1);
	} finally {
		NGTOBuilderUtil.resetJsonData(dataMap, "platformBuilderRequest");
	}
}
