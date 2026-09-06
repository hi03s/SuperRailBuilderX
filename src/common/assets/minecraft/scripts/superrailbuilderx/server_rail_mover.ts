import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ScriptExecuter } from "jp.ngt.rtm.modelpack";
import {
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
} from "jp.ngt.rtm.rail";
import { Entity } from "net.minecraft.entity";
import { EntityPlayer } from "net.minecraft.entity.player";
import { WeakHashMap } from "java.util";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { ErrorLogger } from "../lib_hi03toolkit_1_0/lib_ErrorLogger";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import {
	RailCorePos,
	SRBXApiCompat,
	SRBXBuilderPoint,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";

const VERSION = "alpha-0.1.0";

export type RailPositionMoveTarget = {
	core: [number, number, number];
	index: number;
	original: [number, number, number];
};

export type RailPositionConnectedMove = {
	target: RailPositionMoveTarget;
	destination: RailCorePos;
};

export type RailPositionParallelMoveRequest = {
	action?: "move";
	mode: "parallel";
	core: RailCorePos;
	railKey: string;
	originalStart: RailCorePos;
	originalEnd: RailCorePos;
	originalStartPoint: SRBXBuilderPoint;
	originalEndPoint: SRBXBuilderPoint;
	start: SRBXBuilderPoint;
	end: SRBXBuilderPoint;
	connectedMoves?: RailPositionConnectedMove[];
};

export type RailPositionMoveRequest =
	| { action: "undo" }
	| {
			action?: "move";
			mode?: "endpoint";
			targets: RailPositionMoveTarget[];
			destination: RailCorePos;
	  }
	| RailPositionParallelMoveRequest
	| {
			action?: "move";
			mode: "parallel_multi";
			plans: RailPositionParallelMoveRequest[];
	  };

const hosts: WeakHashMap<Entity, EntityPlayer> = new WeakHashMap();
type RemovedRail = { core: RailCorePos; key: string };
type EndpointUndoOperation = {
	mode: "endpoint";
	core: RailCorePos;
	railKey: string;
	index: number;
	original: RailCorePos;
	destination: RailCorePos;
};
type ParallelUndoOperation = {
	mode: "parallel";
	core: RailCorePos;
	railKey: string;
	originalStart: RailCorePos;
	originalEnd: RailCorePos;
	start: SRBXBuilderPoint;
	end: SRBXBuilderPoint;
};
type UndoOperation = EndpointUndoOperation | ParallelUndoOperation;
const undoRecords: WeakHashMap<EntityVehicle, { operations: UndoOperation[] }> =
	new WeakHashMap();

function isMoveSuccess(result: string): boolean {
	return (
		result === "ok" ||
		result === "ok_sectioned" ||
		result === "ok_normal_crossing"
	);
}

function samePosition(a: RailCorePos, b: RailCorePos): boolean {
	return (
		Math.abs(a[0] - b[0]) <= 0.001 &&
		Math.abs(a[1] - b[1]) <= 0.001 &&
		Math.abs(a[2] - b[2]) <= 0.001
	);
}

function parallelPlansAreConnected(
	plans: RailPositionParallelMoveRequest[],
): boolean {
	const connected: boolean[] = [];
	const seenRailKeys: { [key: string]: boolean } = {};
	for (let i = 0; i < plans.length; i++) {
		const plan = plans[i];
		if (
			!plan ||
			!plan.railKey ||
			!plan.originalStart ||
			!plan.originalEnd ||
			seenRailKeys[plan.railKey]
		)
			return false;
		seenRailKeys[plan.railKey] = true;
		connected[i] = i === 0;
	}
	let changed = true;
	while (changed) {
		changed = false;
		for (let i = 0; i < plans.length; i++) {
			if (connected[i]) continue;
			for (let j = 0; j < plans.length; j++) {
				if (!connected[j]) continue;
				if (
					samePosition(
						plans[i].originalStart,
						plans[j].originalStart,
					) ||
					samePosition(
						plans[i].originalStart,
						plans[j].originalEnd,
					) ||
					samePosition(
						plans[i].originalEnd,
						plans[j].originalStart,
					) ||
					samePosition(plans[i].originalEnd, plans[j].originalEnd)
				) {
					connected[i] = true;
					changed = true;
					break;
				}
			}
		}
	}
	for (let i = 0; i < connected.length; i++) if (!connected[i]) return false;
	return true;
}

function sendClientChanges(
	dataMap: any,
	updated: RailCorePos[],
	removed: RemovedRail[],
): void {
	if (updated.length > 0)
		NGTOBuilderUtil.sendJsonData(
			dataMap,
			"railPositionUpdatedCores",
			updated,
		);
	if (removed.length > 0)
		NGTOBuilderUtil.sendJsonData(
			dataMap,
			"railPositionRemovedRails",
			removed,
		);
}

function findEndpointUndoOperation(
	world: net.minecraft.world.World,
	corePositions: RailCorePos[],
	currentPosition: RailCorePos,
	destination: RailCorePos,
): EndpointUndoOperation | null {
	const seen: { [key: string]: boolean } = {};
	for (let i = 0; i < corePositions.length; i++) {
		const tile = SRBXApiCompat.getTileEntity(
			world,
			corePositions[i][0],
			corePositions[i][1],
			corePositions[i][2],
		);
		if (!(tile instanceof TileEntityLargeRailBase)) continue;
		const core = tile.getRailCore();
		if (!core) continue;
		const railKey = SRBXApiCompat.getRailPositionCandidateKey(core);
		if (seen[railKey]) continue;
		seen[railKey] = true;
		const positions = SRBXApiCompat.getEditableRailPositions(core);
		for (let index = 0; index < positions.length; index++) {
			const rp = positions[index];
			if (!samePosition([rp.posX, rp.posY, rp.posZ], currentPosition))
				continue;
			return {
				mode: "endpoint",
				core: SRBXApiCompat.getRailCorePos(core),
				railKey,
				index,
				original: currentPosition,
				destination,
			};
		}
	}
	return null;
}

function findParallelUndoOperation(
	world: net.minecraft.world.World,
	corePositions: RailCorePos[],
	request: RailPositionParallelMoveRequest,
): ParallelUndoOperation | null {
	const seen: { [key: string]: boolean } = {};
	for (let i = 0; i < corePositions.length; i++) {
		const tile = SRBXApiCompat.getTileEntity(
			world,
			corePositions[i][0],
			corePositions[i][1],
			corePositions[i][2],
		);
		if (!(tile instanceof TileEntityLargeRailBase)) continue;
		const core = tile.getRailCore();
		if (!core) continue;
		const railKey = SRBXApiCompat.getRailPositionCandidateKey(core);
		if (seen[railKey]) continue;
		seen[railKey] = true;
		const positions = SRBXApiCompat.getEditableRailPositions(core);
		if (!positions || positions.length !== 2) continue;
		const currentStart: RailCorePos = [
			positions[0].posX,
			positions[0].posY,
			positions[0].posZ,
		];
		const currentEnd: RailCorePos = [
			positions[1].posX,
			positions[1].posY,
			positions[1].posZ,
		];
		const ordered =
			samePosition(currentStart, request.start.position) &&
			samePosition(currentEnd, request.end.position);
		const reversed =
			samePosition(currentStart, request.end.position) &&
			samePosition(currentEnd, request.start.position);
		if (!ordered && !reversed) continue;
		return {
			mode: "parallel",
			core: SRBXApiCompat.getRailCorePos(core),
			railKey,
			originalStart: currentStart,
			originalEnd: currentEnd,
			start: ordered
				? request.originalStartPoint
				: request.originalEndPoint,
			end: ordered
				? request.originalEndPoint
				: request.originalStartPoint,
		};
	}
	return null;
}

function applyUndo(
	entity: EntityVehicle,
	player: EntityPlayer,
	dataMap: any,
): string {
	const record = undoRecords.get(entity);
	if (!record) return "nothing_to_undo";
	const world = SRBXApiCompat.getWorld(entity);
	const updated: RailCorePos[] = [];
	const removed: RemovedRail[] = [];
	for (let i = record.operations.length - 1; i >= 0; i--) {
		const operation = record.operations[i];
		const tile = SRBXApiCompat.getTileEntity(
			world,
			operation.core[0],
			operation.core[1],
			operation.core[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase)) {
			record.operations = record.operations.slice(0, i + 1);
			sendClientChanges(dataMap, updated, removed);
			return "undo_rail_not_found";
		}
		const core = tile.getRailCore();
		if (
			!core ||
			SRBXApiCompat.getRailPositionCandidateKey(core) !==
				operation.railKey
		) {
			record.operations = record.operations.slice(0, i + 1);
			sendClientChanges(dataMap, updated, removed);
			return "undo_rail_changed";
		}
		const result =
			operation.mode === "endpoint"
				? SRBXApiCompat.moveRailPosition(
						core,
						operation.index,
						operation.original[0],
						operation.original[1],
						operation.original[2],
						operation.destination[0],
						operation.destination[1],
						operation.destination[2],
						player,
					)
				: SRBXApiCompat.moveBuilderRail(
						core,
						operation.railKey,
						operation.originalStart,
						operation.originalEnd,
						operation.start,
						operation.end,
						player,
					);
		const moved = SRBXApiCompat.consumeLastRailPositionMoveCores();
		for (let j = 0; j < moved.length; j++) updated.push(moved[j]);
		if (!isMoveSuccess(result)) {
			record.operations = record.operations.slice(0, i + 1);
			sendClientChanges(dataMap, updated, removed);
			return `undo_${i}:${result}`;
		}
		removed.push({ core: operation.core, key: operation.railKey });
	}
	undoRecords.remove(entity);
	sendClientChanges(dataMap, updated, removed);
	return "undo_ok";
}

function applyRequest(
	entity: EntityVehicle,
	player: EntityPlayer,
	request: RailPositionMoveRequest,
): string {
	const world = SRBXApiCompat.getWorld(entity);
	const dataMap = entity.getResourceState().getDataMap();
	NGTOBuilderUtil.resetJsonData(dataMap, "railPositionUpdatedCores");
	NGTOBuilderUtil.resetJsonData(dataMap, "railPositionRemovedRails");
	if (request.action === "undo") return applyUndo(entity, player, dataMap);
	if (request.mode === "parallel_multi") {
		if (!request.plans || request.plans.length === 0) return "no_targets";
		if (request.plans.length > 16) return "too_many_targets";
		if (!parallelPlansAreConnected(request.plans))
			return "disconnected_targets";
		const previousUndo = undoRecords.get(entity);
		undoRecords.remove(entity);
		const operations: UndoOperation[] = [];
		const updated: RailCorePos[] = [];
		const removed: RemovedRail[] = [];
		let usedNormalFallback = false;
		for (let i = 0; i < request.plans.length; i++) {
			const result = applyRequest(entity, player, request.plans[i]);
			const planUpdated =
				NGTOBuilderUtil.getJsonData<RailCorePos[]>(
					dataMap,
					"railPositionUpdatedCores",
				) || [];
			const planRemoved =
				NGTOBuilderUtil.getJsonData<RemovedRail[]>(
					dataMap,
					"railPositionRemovedRails",
				) || [];
			for (let j = 0; j < planUpdated.length; j++)
				updated.push(planUpdated[j]);
			for (let j = 0; j < planRemoved.length; j++)
				removed.push(planRemoved[j]);
			const planUndo = undoRecords.get(entity);
			if (planUndo)
				for (let j = 0; j < planUndo.operations.length; j++)
					operations.push(planUndo.operations[j]);
			undoRecords.remove(entity);
			if (!isMoveSuccess(result)) {
				if (operations.length > 0)
					undoRecords.put(entity, { operations });
				else if (previousUndo) undoRecords.put(entity, previousUndo);
				NGTOBuilderUtil.resetJsonData(
					dataMap,
					"railPositionUpdatedCores",
				);
				NGTOBuilderUtil.resetJsonData(
					dataMap,
					"railPositionRemovedRails",
				);
				sendClientChanges(dataMap, updated, removed);
				return i > 0
					? `partial_parallel_${i}:${result}`
					: `parallel_${i}:${result}`;
			}
			if (result === "ok_normal_crossing") usedNormalFallback = true;
		}
		if (operations.length > 0) undoRecords.put(entity, { operations });
		NGTLog.debug(
			`[SuperRailBuilderX/RailMover] parallel multi undo recorded: plans=${request.plans.length}, operations=${operations.length}`,
		);
		NGTOBuilderUtil.resetJsonData(dataMap, "railPositionUpdatedCores");
		NGTOBuilderUtil.resetJsonData(dataMap, "railPositionRemovedRails");
		sendClientChanges(dataMap, updated, removed);
		return usedNormalFallback ? "ok_normal_crossing" : "ok";
	}
	if (request.mode === "parallel") {
		if (
			!request.core ||
			!request.railKey ||
			!request.originalStart ||
			!request.originalEnd ||
			!request.originalStartPoint ||
			!request.originalEndPoint ||
			!request.start ||
			!request.end
		)
			return "invalid_parallel_request";
		const tile = SRBXApiCompat.getTileEntity(
			world,
			request.core[0],
			request.core[1],
			request.core[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase)) return "rail_not_found";
		const core = tile.getRailCore();
		if (!core) return "rail_not_found";
		const connectedMoves = request.connectedMoves || [];
		if (connectedMoves.length > 16) return "too_many_connected_targets";
		const resolvedConnected: Array<{
			core: TileEntityLargeRailCore;
			railKey: string;
			move: RailPositionConnectedMove;
		}> = [];
		const seenConnected: { [key: string]: boolean } = {};
		for (let i = 0; i < connectedMoves.length; i++) {
			const move = connectedMoves[i];
			const sourceEnd = samePosition(
				move.target.original,
				request.originalStart,
			)
				? request.start.position
				: samePosition(move.target.original, request.originalEnd)
					? request.end.position
					: null;
			if (!sourceEnd || !samePosition(move.destination, sourceEnd))
				return `connected_${i}:invalid_destination`;
			const connectedTile = SRBXApiCompat.getTileEntity(
				world,
				move.target.core[0],
				move.target.core[1],
				move.target.core[2],
			);
			if (!(connectedTile instanceof TileEntityLargeRailBase))
				return `connected_${i}:rail_not_found`;
			const connectedCore = connectedTile.getRailCore();
			if (!connectedCore) return `connected_${i}:rail_not_found`;
			const railKey =
				SRBXApiCompat.getRailPositionCandidateKey(connectedCore);
			const connectedKey = `${railKey}:${move.target.index}`;
			if (seenConnected[connectedKey]) continue;
			seenConnected[connectedKey] = true;
			if (
				SRBXApiCompat.getRailPositionCandidateKey(connectedCore) ===
				request.railKey
			)
				return `connected_${i}:source_rail`;
			const validation = SRBXApiCompat.validateRailPositionMove(
				connectedCore,
				move.target.index,
				move.target.original[0],
				move.target.original[1],
				move.target.original[2],
				move.destination[0],
				move.destination[1],
				move.destination[2],
			);
			if (validation !== "ok") return `connected_${i}:${validation}`;
			resolvedConnected.push({ core: connectedCore, railKey, move });
		}
		const result = SRBXApiCompat.moveBuilderRail(
			core,
			request.railKey,
			request.originalStart,
			request.originalEnd,
			request.start,
			request.end,
			player,
		);
		const movedCores = SRBXApiCompat.consumeLastRailPositionMoveCores();
		if (!isMoveSuccess(result)) {
			sendClientChanges(dataMap, movedCores, []);
			return result;
		}
		const operations: UndoOperation[] = [];
		const removed: RemovedRail[] = [
			{ core: request.core, key: request.railKey },
		];
		const sourceUndo = findParallelUndoOperation(
			world,
			movedCores,
			request,
		);
		if (sourceUndo) operations.push(sourceUndo);
		else
			NGTLog.debug(
				"[SuperRailBuilderX RailPosition] parallel undo identity was not found",
			);
		for (let i = 0; i < resolvedConnected.length; i++) {
			const item = resolvedConnected[i];
			const connectedResult = SRBXApiCompat.moveRailPosition(
				item.core,
				item.move.target.index,
				item.move.target.original[0],
				item.move.target.original[1],
				item.move.target.original[2],
				item.move.destination[0],
				item.move.destination[1],
				item.move.destination[2],
				player,
			);
			const connectedCores =
				SRBXApiCompat.consumeLastRailPositionMoveCores();
			for (let j = 0; j < connectedCores.length; j++)
				movedCores.push(connectedCores[j]);
			if (!isMoveSuccess(connectedResult)) {
				if (operations.length > 0)
					undoRecords.put(entity, { operations });
				sendClientChanges(dataMap, movedCores, removed);
				return `partial_connected_${i}:${connectedResult}`;
			}
			const undo = findEndpointUndoOperation(
				world,
				connectedCores,
				item.move.destination,
				item.move.target.original,
			);
			if (undo) {
				operations.push(undo);
				removed.push({
					core: item.move.target.core,
					key: item.railKey,
				});
			}
		}
		if (operations.length > 0) undoRecords.put(entity, { operations });
		sendClientChanges(dataMap, movedCores, removed);
		NGTLog.debug(
			`[SuperRailBuilderX RailPosition] parallel undo recorded: operations=${operations.length}`,
		);
		return result;
	}
	if (!request.targets || request.targets.length === 0) return "no_targets";
	if (request.targets.length > 16) return "too_many_targets";
	if (
		!request.destination ||
		!isFinite(request.destination[0]) ||
		!isFinite(request.destination[1]) ||
		!isFinite(request.destination[2])
	)
		return "invalid_destination";
	const sharedPosition = request.targets[0].original;
	if (!sharedPosition) return "invalid_target";
	const resolved: Array<{
		core: TileEntityLargeRailCore;
		railKey: string;
		target: RailPositionMoveTarget;
	}> = [];
	const seen: { [key: string]: boolean } = {};
	const updatedCores: Array<[number, number, number]> = [];
	const removedRails: RemovedRail[] = [];
	const operations: UndoOperation[] = [];
	let usedNormalFallback = false;
	for (let i = 0; i < request.targets.length; i++) {
		const target = request.targets[i];
		if (
			!target ||
			!target.core ||
			!target.original ||
			!isFinite(target.index) ||
			Math.floor(target.index) !== target.index ||
			Math.abs(target.original[0] - sharedPosition[0]) > 0.001 ||
			Math.abs(target.original[1] - sharedPosition[1]) > 0.001 ||
			Math.abs(target.original[2] - sharedPosition[2]) > 0.001
		)
			return `target_${i}:not_connected`;
		const tile = SRBXApiCompat.getTileEntity(
			world,
			target.core[0],
			target.core[1],
			target.core[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase))
			return `target_${i}:rail_not_found`;
		const core = tile.getRailCore();
		if (!core) return `target_${i}:rail_not_found`;
		const railKey = SRBXApiCompat.getRailPositionCandidateKey(core);
		const key = `${railKey}:${target.index}`;
		if (seen[key]) continue;
		seen[key] = true;
		const validation = SRBXApiCompat.validateRailPositionMove(
			core,
			target.index,
			target.original[0],
			target.original[1],
			target.original[2],
			request.destination[0],
			request.destination[1],
			request.destination[2],
		);
		if (validation !== "ok") return `target_${i}:${validation}`;
		resolved.push({ core, railKey, target });
	}
	NGTLog.debug(
		`[SuperRailBuilderX RailPosition] applying connected endpoint: targets=${resolved.length}`,
	);
	for (let i = 0; i < resolved.length; i++) {
		const item = resolved[i];
		const result = SRBXApiCompat.moveRailPosition(
			item.core,
			item.target.index,
			item.target.original[0],
			item.target.original[1],
			item.target.original[2],
			request.destination[0],
			request.destination[1],
			request.destination[2],
			player,
		);
		const movedCores = SRBXApiCompat.consumeLastRailPositionMoveCores();
		for (let j = 0; j < movedCores.length; j++)
			updatedCores.push(movedCores[j]);
		if (result === "ok_normal_crossing") usedNormalFallback = true;
		if (
			result !== "ok" &&
			result !== "ok_sectioned" &&
			result !== "ok_normal_crossing"
		) {
			if (operations.length > 0) undoRecords.put(entity, { operations });
			sendClientChanges(dataMap, updatedCores, removedRails);
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] connected endpoint apply failed: target=${i}, applied=${i}, result=${result}`,
			);
			return i > 0
				? `partial_target_${i}:${result}`
				: `target_${i}:${result}`;
		}
		const undo = findEndpointUndoOperation(
			world,
			movedCores,
			request.destination,
			item.target.original,
		);
		if (undo) {
			operations.push(undo);
			removedRails.push({ core: item.target.core, key: item.railKey });
		}
	}
	if (operations.length > 0) undoRecords.put(entity, { operations });
	sendClientChanges(dataMap, updatedCores, removedRails);
	NGTLog.debug(
		`[SuperRailBuilderX RailPosition] endpoint undo recorded: operations=${operations.length}`,
	);
	return usedNormalFallback ? "ok_normal_crossing" : "ok";
}

function onUpdate(entity: EntityVehicle, scriptExecuter: ScriptExecuter): void {
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
	if (dataMap.getBoolean("railMoverCanUndo") !== canUndo)
		dataMap.setBoolean("railMoverCanUndo", canUndo, 1);
	const request = NGTOBuilderUtil.getJsonData<RailPositionMoveRequest>(
		dataMap,
		"railPositionMove",
	);
	if (request) {
		try {
			const result = applyRequest(entity, host, request);
			dataMap.setString("applyResult", result, 1);
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] request completed: action=${request.action || "move"}, mode=${request.action === "undo" ? "undo" : request.mode || "endpoint"}, result=${result}`,
			);
		} catch (error) {
			ErrorLogger.log(
				"SuperRailBuilderX RailPosition apply",
				"applyRequest",
				error,
				{
					action: request.action || "move",
					mode:
						request.action === "undo"
							? "undo"
							: request.mode || "endpoint",
					targetCount:
						request.action === "undo"
							? 0
							: request.mode === "parallel"
								? 1
								: request.mode === "parallel_multi"
									? request.plans.length
									: request.targets.length,
				},
			);
			dataMap.setString("applyResult", "internal_error", 1);
		} finally {
			NGTOBuilderUtil.resetJsonData(dataMap, "railPositionMove");
			const updatedCanUndo = undoRecords.get(entity) !== null;
			if (dataMap.getBoolean("railMoverCanUndo") !== updatedCanUndo)
				dataMap.setBoolean("railMoverCanUndo", updatedCanUndo, 1);
		}
	}
}
