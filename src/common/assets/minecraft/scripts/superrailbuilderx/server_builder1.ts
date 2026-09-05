import { NGTLog } from "jp.ngt.ngtlib.io";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ScriptExecuter } from "jp.ngt.rtm.modelpack";
import { Entity } from "net.minecraft.entity";
import { EntityPlayer } from "net.minecraft.entity.player";
import { WeakHashMap } from "java.util";
import { ErrorLogger } from "../lib_hi03toolkit_1_0/lib_ErrorLogger";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import {
	SRBXApiCompat,
	SRBXBuilderPoint,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath } from "./SRBXMath";

const VERSION = "0.1.0";

export type Builder1Request =
	| {
			action: "create";
			start: SRBXBuilderPoint;
			end: SRBXBuilderPoint;
	  }
	| { action: "undo" };

type UndoRecord = {
	rails: Array<{
		core: [number, number, number];
		key: string;
	}>;
};

const hosts: WeakHashMap<Entity, EntityPlayer> = new WeakHashMap();
const undoRecords: WeakHashMap<EntityVehicle, UndoRecord> = new WeakHashMap();

function processRequest(
	entity: EntityVehicle,
	host: EntityPlayer,
	request: Builder1Request,
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
	const dataMap = entity.getResourceState().getDataMap();
	dataMap.setBoolean("builder1CreatedAsNormalCrossing", false, 1);
	const segments = SRBXMath.planVerticalRailSegments(
		request.start,
		request.end,
	);
	segments.sort((a, b) => {
		const aMinimumY = Math.min(a[0].position[1], a[1].position[1]);
		const bMinimumY = Math.min(b[0].position[1], b[1].position[1]);
		return aMinimumY - bMinimumY;
	});
	let verticalProfile = "default";
	for (let i = 0; i < segments.length; i++) {
		verticalProfile =
			segments[i][0].verticalProfile ||
			segments[i][1].verticalProfile ||
			verticalProfile;
	}
	NGTLog.debug(
		`[SuperRailBuilderX builder1] vertical profile plan: type=${verticalProfile}, logicalRails=${segments.length}, radius=${request.start.verticalCurveRadius || request.end.verticalCurveRadius || "default"}`,
	);
	const created: Array<{
		core: [number, number, number];
		key: string;
	}> = [];
	let createdAsNormalCrossing = false;
	for (let i = 0; i < segments.length; i++) {
		const result = SRBXApiCompat.createBuilderRail(
			world,
			host,
			segments[i][0],
			segments[i][1],
			created.map((rail) => rail.key),
		);
		if (result.status !== "ok" || !result.undoCore || !result.undoKey) {
			for (let rollback = created.length - 1; rollback >= 0; rollback--) {
				const rail = created[rollback];
				SRBXApiCompat.undoBuilderRail(
					world,
					rail.core[0],
					rail.core[1],
					rail.core[2],
					rail.key,
				);
			}
			return result.status;
		}
		created.push({ core: result.undoCore, key: result.undoKey });
		if (result.createdAsNormalCrossing) createdAsNormalCrossing = true;
	}
	undoRecords.put(entity, { rails: created });
	dataMap.setBoolean(
		"builder1CreatedAsNormalCrossing",
		createdAsNormalCrossing,
		1,
	);
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
	if (dataMap.getBoolean("builder1CanUndo") !== canUndo)
		dataMap.setBoolean("builder1CanUndo", canUndo, 1);
	const request = NGTOBuilderUtil.getJsonData<Builder1Request>(
		dataMap,
		"builder1Request",
	);
	if (!request) return;
	try {
		const result = processRequest(entity, host, request);
		dataMap.setString("builder1Result", result, 1);
		const updatedCanUndo = undoRecords.get(entity) !== null;
		if (dataMap.getBoolean("builder1CanUndo") !== updatedCanUndo)
			dataMap.setBoolean("builder1CanUndo", updatedCanUndo, 1);
		NGTLog.debug(
			`[SuperRailBuilderX builder1] request completed: action=${request.action}, result=${result}`,
		);
	} catch (error) {
		ErrorLogger.log("SuperRailBuilderX builder1", "processRequest", error, {
			action: request.action,
		});
		dataMap.setString("builder1Result", "internal_error", 1);
	} finally {
		NGTOBuilderUtil.resetJsonData(dataMap, "builder1Request");
	}
}
