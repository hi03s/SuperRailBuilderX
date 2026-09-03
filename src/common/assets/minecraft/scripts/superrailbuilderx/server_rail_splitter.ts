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
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";

const VERSION = "0.1.0";

export type RailSplitterRequest =
	| {
			action: "split";
			core: RailCorePos;
			railKey: string;
			ratio: number;
	  }
	| { action: "undo" };

const hosts: WeakHashMap<Entity, EntityPlayer> = new WeakHashMap();
const undoTokens: WeakHashMap<EntityVehicle, string> = new WeakHashMap();

function processRequest(
	entity: EntityVehicle,
	host: EntityPlayer,
	request: RailSplitterRequest,
): string {
	const world = SRBXApiCompat.getWorld(entity);
	if (!request || (request.action !== "split" && request.action !== "undo"))
		return "invalid_request";
	if (request.action === "undo") {
		const token = undoTokens.get(entity);
		if (!token) return "nothing_to_undo";
		const result = SRBXApiCompat.undoSplitBuilderRail(world, token);
		if (result === "undo_ok") undoTokens.remove(entity);
		return result;
	}
	const result = SRBXApiCompat.splitBuilderRail(
		world,
		host,
		request.core,
		request.railKey,
		request.ratio,
	);
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
	const canUndo = undoTokens.get(entity) !== null;
	if (dataMap.getBoolean("railSplitterCanUndo") !== canUndo)
		dataMap.setBoolean("railSplitterCanUndo", canUndo, 1);
	const request = NGTOBuilderUtil.getJsonData<RailSplitterRequest>(
		dataMap,
		"railSplitterRequest",
	);
	if (!request) return;
	try {
		const result = processRequest(entity, host, request);
		dataMap.setString("railSplitterResult", result, 1);
		const updatedCanUndo = undoTokens.get(entity) !== null;
		if (dataMap.getBoolean("railSplitterCanUndo") !== updatedCanUndo)
			dataMap.setBoolean("railSplitterCanUndo", updatedCanUndo, 1);
		NGTLog.debug(
			`[SuperRailBuilderX splitter] request completed: action=${request.action}, result=${result}`,
		);
	} catch (error) {
		ErrorLogger.log("SuperRailBuilderX splitter", "processRequest", error, {
			action: request.action,
		});
		dataMap.setString("railSplitterResult", "internal_error", 1);
	} finally {
		NGTOBuilderUtil.resetJsonData(dataMap, "railSplitterRequest");
	}
}
