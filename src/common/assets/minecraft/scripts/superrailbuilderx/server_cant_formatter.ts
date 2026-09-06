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
	SRBXCantTarget,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";

const VERSION = "alpha-0.1.0";
export type CantFormatterRequest =
	{ action: "apply"; targets: SRBXCantTarget[] } | { action: "undo" };
const hosts: WeakHashMap<Entity, EntityPlayer> = new WeakHashMap();
const undoTokens: WeakHashMap<EntityVehicle, string> = new WeakHashMap();

function process(entity: EntityVehicle, request: CantFormatterRequest): string {
	const world = SRBXApiCompat.getWorld(entity);
	if (!request || (request.action !== "apply" && request.action !== "undo"))
		return "invalid_request";
	if (request.action === "undo") {
		const token = undoTokens.get(entity);
		if (!token) return "nothing_to_undo";
		const status = SRBXApiCompat.undoRailCants(world, token);
		if (status === "undo_ok") undoTokens.remove(entity);
		return status;
	}
	const result = SRBXApiCompat.applyRailCants(world, request.targets);
	if (result.status === "ok" && result.undoToken)
		undoTokens.put(entity, result.undoToken);
	return result.status;
}

function onUpdate(entity: EntityVehicle, scriptExecuter: ScriptExecuter): void {
	void scriptExecuter;
	entity.rotationYaw = 0;
	const dataMap = entity.getResourceState().getDataMap();
	let host = hosts.get(entity);
	const rider = SRBXApiCompat.getRider(entity) as unknown as EntityPlayer;
	const riding = SRBXApiCompat.getRidingEntity(entity);
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
		} else if (riding instanceof EntityPlayer) {
			host = riding;
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
	const canUndo = undoTokens.get(entity) !== null;
	if (dataMap.getBoolean("cantFormatterCanUndo") !== canUndo)
		dataMap.setBoolean("cantFormatterCanUndo", canUndo, 1);
	const request = NGTOBuilderUtil.getJsonData<CantFormatterRequest>(
		dataMap,
		"cantFormatterRequest",
	);
	if (!request) return;
	try {
		const status = process(entity, request);
		NGTOBuilderUtil.sendJsonData(
			dataMap,
			"cantFormatterClientUpdate",
			SRBXApiCompat.consumeLastCantClientUpdate(),
		);
		dataMap.setString("cantFormatterResult", status, 1);
		dataMap.setBoolean(
			"cantFormatterCanUndo",
			undoTokens.get(entity) !== null,
			1,
		);
		NGTLog.debug(
			`[SuperRailBuilderX cant] action=${request.action}, result=${status}`,
		);
	} catch (error) {
		ErrorLogger.log("SuperRailBuilderX cant", "processRequest", error, {
			action: request.action,
		});
		dataMap.setString("cantFormatterResult", "internal_error", 1);
	} finally {
		NGTOBuilderUtil.resetJsonData(dataMap, "cantFormatterRequest");
	}
}
