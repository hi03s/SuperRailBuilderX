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

const VERSION = "0.2.0";
export type CantFormatterRequest =
	{ action: "apply"; targets: SRBXCantTarget[] } | { action: "undo" };
const hosts: WeakHashMap<Entity, EntityPlayer> = new WeakHashMap();
type CantUndo = { cantToken: string };
const undoRecords: WeakHashMap<EntityVehicle, CantUndo[]> = new WeakHashMap();
type ClientUpdate = {
	refreshed: Array<[number, number, number]>;
	removed: Array<{ core: [number, number, number]; key: string }>;
};

function appendUniqueCore(
	target: Array<[number, number, number]>,
	value: [number, number, number],
): void {
	for (let i = 0; i < target.length; i++)
		if (
			target[i][0] === value[0] &&
			target[i][1] === value[1] &&
			target[i][2] === value[2]
		)
			return;
	target.push(value);
}

function appendCantUpdate(target: ClientUpdate): void {
	const refreshed = SRBXApiCompat.consumeLastCantClientUpdate();
	for (let i = 0; i < refreshed.length; i++)
		appendUniqueCore(target.refreshed, refreshed[i]);
}

function process(
	entity: EntityVehicle,
	player: EntityPlayer,
	request: CantFormatterRequest,
): { status: string; update: ClientUpdate } {
	void player;
	const world = SRBXApiCompat.getWorld(entity);
	const update: ClientUpdate = { refreshed: [], removed: [] };
	if (!request || (request.action !== "apply" && request.action !== "undo"))
		return { status: "invalid_request", update };
	if (request.action === "undo") {
		const stack = undoRecords.get(entity);
		if (!stack || stack.length === 0)
			return { status: "nothing_to_undo", update };
		const record = stack[stack.length - 1];
		const cantStatus = SRBXApiCompat.undoRailCants(world, record.cantToken);
		appendCantUpdate(update);
		if (cantStatus !== "undo_ok") return { status: cantStatus, update };
		stack.pop();
		if (stack.length === 0) undoRecords.remove(entity);
		return { status: "undo_ok", update };
	}
	if (!request.targets || request.targets.length === 0)
		return { status: "no_selection", update };
	const pairs: { [key: string]: number } = {};
	for (let i = 0; i < request.targets.length; i++) {
		const target = request.targets[i];
		if (
			!target ||
			target.mode !== "edge" ||
			(target.index !== 0 && target.index !== 1)
		)
			return { status: "invalid_endpoint", update };
		const key = target.railKey;
		if ((pairs[key] || 0) & (1 << target.index))
			return { status: "invalid_endpoint", update };
		pairs[key] = (pairs[key] || 0) | (1 << target.index);
	}
	const railKeys = Object.keys(pairs);
	for (let i = 0; i < railKeys.length; i++)
		if (pairs[railKeys[i]] !== 3)
			return { status: "invalid_endpoint", update };
	const targets = request.targets;
	const result = SRBXApiCompat.applyRailCants(world, targets);
	appendCantUpdate(update);
	if (result.status === "ok" && result.undoToken) {
		let stack = undoRecords.get(entity);
		if (!stack) {
			stack = [];
			undoRecords.put(entity, stack);
		}
		stack.push({ cantToken: result.undoToken });
	}
	return { status: result.status, update };
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
	const undoStack = undoRecords.get(entity),
		canUndo = undoStack !== null && undoStack.length > 0;
	if (dataMap.getBoolean("cantFormatterCanUndo") !== canUndo)
		dataMap.setBoolean("cantFormatterCanUndo", canUndo, 1);
	const request = NGTOBuilderUtil.getJsonData<CantFormatterRequest>(
		dataMap,
		"cantFormatterRequest",
	);
	if (!request) return;
	try {
		const result = process(entity, host, request),
			remainingUndo = undoRecords.get(entity);
		NGTOBuilderUtil.sendJsonData(
			dataMap,
			"cantFormatterClientUpdate",
			result.update.refreshed,
		);
		NGTOBuilderUtil.sendJsonData(
			dataMap,
			"cantFormatterRemovedRails",
			result.update.removed,
		);
		dataMap.setString("cantFormatterResult", result.status, 1);
		dataMap.setBoolean(
			"cantFormatterCanUndo",
			remainingUndo !== null && remainingUndo.length > 0,
			1,
		);
		NGTLog.debug(
			`[SuperRailBuilderX cant] action=${request.action}, result=${result.status}`,
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
