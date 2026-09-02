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

const VERSION = "0.1.0";

export type Builder1Request =
	| {
			action: "create";
			start: SRBXBuilderPoint;
			end: SRBXBuilderPoint;
	  }
	| { action: "undo" };

type UndoRecord = {
	core: [number, number, number];
	key: string;
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
		const result = SRBXApiCompat.undoBuilderRail(
			world,
			undo.core[0],
			undo.core[1],
			undo.core[2],
			undo.key,
		);
		if (result === "ok") undoRecords.remove(entity);
		return result === "ok" ? "undo_ok" : result;
	}
	const result = SRBXApiCompat.createBuilderRail(
		world,
		host,
		request.start,
		request.end,
	);
	if (result.status === "ok" && result.undoCore && result.undoKey) {
		undoRecords.put(entity, {
			core: result.undoCore,
			key: result.undoKey,
		});
	}
	return result.status;
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
