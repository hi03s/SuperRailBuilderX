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

const VERSION = "0.1.0";
const MAX_COPY_RAILS = 128;
const MIN_RAIL_LENGTH = 2;

export type DoubleTrackCopyPlan = {
	sourceCore: RailCorePos;
	sourceRailKey: string;
	sourceStart: RailCorePos;
	sourceEnd: RailCorePos;
	start: SRBXBuilderPoint;
	end: SRBXBuilderPoint;
};

export type DoubleTrackCopyRequest =
	{ action: "create"; plans: DoubleTrackCopyPlan[] } | { action: "undo" };

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

function plannedLength(plan: DoubleTrackCopyPlan): number {
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
): void {
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
			`[SuperRailBuilderX double-track-copy] rollback: index=${i}, core=${rail.core[0]},${rail.core[1]},${rail.core[2]}, key=${rail.key}, result=${result}`,
		);
	}
}

function processRequest(
	entity: EntityVehicle,
	host: EntityPlayer,
	request: DoubleTrackCopyRequest,
): string {
	const world = SRBXApiCompat.getWorld(entity);
	if (!request || (request.action !== "create" && request.action !== "undo"))
		return "invalid_request";
	if (request.action === "undo") {
		const undo = undoRecords.get(entity);
		if (!undo) return "nothing_to_undo";
		for (let i = undo.rails.length - 1; i >= 0; i--) {
			const rail = undo.rails[i];
			const result = SRBXApiCompat.undoBuilderRail(
				world,
				rail.core[0],
				rail.core[1],
				rail.core[2],
				rail.key,
			);
			if (result !== "ok") return result;
		}
		undoRecords.remove(entity);
		return "undo_ok";
	}
	if (
		!request.plans ||
		request.plans.length === 0 ||
		request.plans.length > MAX_COPY_RAILS
	)
		return "invalid_plan_count";
	for (let i = 0; i < request.plans.length; i++)
		if (plannedLength(request.plans[i]) <= MIN_RAIL_LENGTH)
			return "rail_too_short";
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
		);
		if (result.status !== "ok" || !result.undoCore || !result.undoKey) {
			NGTLog.debug(
				`[SuperRailBuilderX double-track-copy] creation failed: plan=${i + 1}/${request.plans.length}, sourceKey=${plan.sourceRailKey}, sourceCore=${plan.sourceCore[0]},${plan.sourceCore[1]},${plan.sourceCore[2]}, start=${plan.start.position[0]},${plan.start.position[1]},${plan.start.position[2]}, end=${plan.end.position[0]},${plan.end.position[1]},${plan.end.position[2]}, created=${created.length}, result=${result.status}`,
			);
			rollback(world, created);
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
	let host = hosts.get(entity);
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
	const canUndo = undoRecords.get(entity) !== null;
	if (dataMap.getBoolean("doubleTrackCopyCanUndo") !== canUndo)
		dataMap.setBoolean("doubleTrackCopyCanUndo", canUndo, 1);
	const request = NGTOBuilderUtil.getJsonData<DoubleTrackCopyRequest>(
		dataMap,
		"doubleTrackCopyRequest",
	);
	if (!request) return;
	try {
		const result = processRequest(entity, host, request);
		dataMap.setString("doubleTrackCopyResult", result, 1);
		const updatedCanUndo = undoRecords.get(entity) !== null;
		if (dataMap.getBoolean("doubleTrackCopyCanUndo") !== updatedCanUndo)
			dataMap.setBoolean("doubleTrackCopyCanUndo", updatedCanUndo, 1);
		NGTLog.debug(
			`[SuperRailBuilderX double-track-copy] request completed: action=${request.action}, result=${result}`,
		);
	} catch (error) {
		ErrorLogger.log(
			"SuperRailBuilderX double-track-copy",
			"processRequest",
			error,
			{ action: request.action },
		);
		dataMap.setString("doubleTrackCopyResult", "internal_error", 1);
	} finally {
		NGTOBuilderUtil.resetJsonData(dataMap, "doubleTrackCopyRequest");
	}
}
