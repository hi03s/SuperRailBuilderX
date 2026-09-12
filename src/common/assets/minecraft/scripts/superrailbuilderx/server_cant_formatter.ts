import { NGTLog } from "jp.ngt.ngtlib.io";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ScriptExecuter } from "jp.ngt.rtm.modelpack";
import { TileEntityLargeRailBase } from "jp.ngt.rtm.rail";
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
type CantUndo = { cantToken: string | null; splitTokens: string[] };
const undoRecords: WeakHashMap<EntityVehicle, CantUndo> = new WeakHashMap();
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

function appendSplitUpdate(target: ClientUpdate): void {
	const update = SRBXApiCompat.consumeLastSplitClientUpdate();
	if (!update) return;
	for (let i = 0; i < update.refreshed.length; i++)
		appendUniqueCore(target.refreshed, update.refreshed[i].core);
	for (let i = 0; i < update.removed.length; i++)
		target.removed.push(update.removed[i]);
}

function appendCantUpdate(target: ClientUpdate): void {
	const refreshed = SRBXApiCompat.consumeLastCantClientUpdate();
	for (let i = 0; i < refreshed.length; i++)
		appendUniqueCore(target.refreshed, refreshed[i]);
}

function resolveSplitEndpoint(
	entity: EntityVehicle,
	target: SRBXCantTarget,
	update: ClientUpdate,
): SRBXCantTarget | null {
	const world = SRBXApiCompat.getWorld(entity);
	for (let i = 0; i < update.refreshed.length; i++) {
		const pos = update.refreshed[i],
			tile = SRBXApiCompat.getTileEntity(world, pos[0], pos[1], pos[2]);
		if (!(tile instanceof TileEntityLargeRailBase)) continue;
		const core = tile.getRailCore();
		if (
			!core ||
			SRBXApiCompat.getRailPositionUnsupportedReason(core) !== ""
		)
			continue;
		const positions = SRBXApiCompat.getEditableRailPositions(core),
			map = SRBXApiCompat.getLogicalRailMap(core);
		if (!positions || positions.length !== 2 || !map) continue;
		for (let index = 0; index < positions.length; index++) {
			const rp = positions[index];
			if (
				Math.abs(rp.posX - target.position[0]) > 0.001 ||
				Math.abs(rp.posY - target.position[1]) > 0.001 ||
				Math.abs(rp.posZ - target.position[2]) > 0.001
			)
				continue;
			const endpointYaw = SRBXApiCompat.getHorizontalAnchorYaw(rp),
				delta =
					target.yaw === undefined
						? 0
						: Math.abs(
								((endpointYaw - target.yaw + 540) % 360) - 180,
							);
			return {
				core: SRBXApiCompat.getRailCorePos(core),
				railKey: SRBXApiCompat.getRailPositionCandidateKey(core),
				index,
				position: target.position,
				angle: delta > 90 ? -target.angle : target.angle,
				mode: "edge",
			};
		}
	}
	return null;
}

function rollbackSplits(
	world: any,
	player: EntityPlayer,
	tokens: string[],
	update: ClientUpdate,
): void {
	for (let i = tokens.length - 1; i >= 0; i--) {
		SRBXApiCompat.undoSplitBuilderRail(world, player, tokens[i]);
		appendSplitUpdate(update);
	}
}

function process(
	entity: EntityVehicle,
	player: EntityPlayer,
	request: CantFormatterRequest,
): { status: string; update: ClientUpdate } {
	const world = SRBXApiCompat.getWorld(entity);
	const update: ClientUpdate = { refreshed: [], removed: [] };
	if (!request || (request.action !== "apply" && request.action !== "undo"))
		return { status: "invalid_request", update };
	if (request.action === "undo") {
		const record = undoRecords.get(entity);
		if (!record) return { status: "nothing_to_undo", update };
		if (record.cantToken) {
			const cantStatus = SRBXApiCompat.undoRailCants(
				world,
				record.cantToken,
			);
			appendCantUpdate(update);
			if (cantStatus !== "undo_ok") return { status: cantStatus, update };
			record.cantToken = null;
		}
		while (record.splitTokens.length > 0) {
			const token = record.splitTokens[record.splitTokens.length - 1];
			const splitStatus = SRBXApiCompat.undoSplitBuilderRail(
				world,
				player,
				token,
			);
			appendSplitUpdate(update);
			if (splitStatus !== "undo_ok")
				return { status: splitStatus, update };
			record.splitTokens.pop();
		}
		undoRecords.remove(entity);
		return { status: "undo_ok", update };
	}
	const splitTokens: string[] = [],
		targets: SRBXCantTarget[] = [];
	for (let i = 0; i < request.targets.length; i++) {
		const target = request.targets[i];
		if (target.mode !== "split") {
			targets.push(target);
			continue;
		}
		if (target.ratio === undefined) {
			rollbackSplits(world, player, splitTokens, update);
			return { status: "invalid_split", update };
		}
		const split = SRBXApiCompat.splitBuilderRail(
			world,
			player,
			target.core,
			target.railKey,
			target.ratio,
		);
		appendSplitUpdate(update);
		if (split.status !== "ok" || !split.undoToken) {
			rollbackSplits(world, player, splitTokens, update);
			return { status: `split_${split.status}`, update };
		}
		splitTokens.push(split.undoToken);
		const endpoint = resolveSplitEndpoint(entity, target, update);
		if (!endpoint) {
			rollbackSplits(world, player, splitTokens, update);
			return { status: "split_endpoint_not_found", update };
		}
		targets.push(endpoint);
	}
	const result = SRBXApiCompat.applyRailCants(world, targets);
	appendCantUpdate(update);
	if (result.status === "ok" && result.undoToken)
		undoRecords.put(entity, { cantToken: result.undoToken, splitTokens });
	else if (result.status !== "ok")
		rollbackSplits(world, player, splitTokens, update);
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
	const canUndo = undoRecords.get(entity) !== null;
	if (dataMap.getBoolean("cantFormatterCanUndo") !== canUndo)
		dataMap.setBoolean("cantFormatterCanUndo", canUndo, 1);
	const request = NGTOBuilderUtil.getJsonData<CantFormatterRequest>(
		dataMap,
		"cantFormatterRequest",
	);
	if (!request) return;
	try {
		const result = process(entity, host, request);
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
			undoRecords.get(entity) !== null,
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
