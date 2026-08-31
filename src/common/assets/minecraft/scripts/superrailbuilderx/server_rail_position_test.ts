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
import { RTMApiCompat } from "@target/assets/minecraft/scripts/lib_hi03toolkit_1_0/lib_RTMApiCompat";
import { RailPositionCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/RailPositionCompat";

const VERSION = "0.1.0";

export type RailPositionMoveTarget = {
	core: [number, number, number];
	index: number;
	original: [number, number, number];
};

export type RailPositionMoveRequest = {
	targets: RailPositionMoveTarget[];
	destination: [number, number, number];
};

const hosts: WeakHashMap<Entity, EntityPlayer> = new WeakHashMap();

function applyRequest(
	entity: EntityVehicle,
	request: RailPositionMoveRequest,
): string {
	const world = RTMApiCompat.getWorld(entity);
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
		target: RailPositionMoveTarget;
	}> = [];
	const seen: { [key: string]: boolean } = {};
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
		const tile = RTMApiCompat.getTileEntity(
			world,
			target.core[0],
			target.core[1],
			target.core[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase))
			return `target_${i}:rail_not_found`;
		const core = tile.getRailCore();
		if (!core) return `target_${i}:rail_not_found`;
		const key = `${RailPositionCompat.getRailPositionCandidateKey(core)}:${target.index}`;
		if (seen[key]) continue;
		seen[key] = true;
		const validation = RailPositionCompat.validateRailPositionMove(
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
		resolved.push({ core, target });
	}
	NGTLog.debug(
		`[SuperRailBuilderX RailPosition] applying connected endpoint: targets=${resolved.length}`,
	);
	for (let i = 0; i < resolved.length; i++) {
		const item = resolved[i];
		const result = RailPositionCompat.moveRailPosition(
			item.core,
			item.target.index,
			item.target.original[0],
			item.target.original[1],
			item.target.original[2],
			request.destination[0],
			request.destination[1],
			request.destination[2],
		);
		if (result !== "ok" && result !== "ok_sectioned") {
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] connected endpoint apply failed: target=${i}, applied=${i}, result=${result}`,
			);
			return i > 0
				? `partial_target_${i}:${result}`
				: `target_${i}:${result}`;
		}
	}
	return "ok";
}

function onUpdate(entity: EntityVehicle, scriptExecuter: ScriptExecuter): void {
	entity.rotationYaw = 0;
	const dataMap = entity.getResourceState().getDataMap();
	let host = hosts.get(entity);
	const rider = RTMApiCompat.getRider(entity) as unknown as EntityPlayer;
	const ridingEntity = RTMApiCompat.getRidingEntity(entity);
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
			RTMApiCompat.dismountPlayer(entity);
			RTMApiCompat.startRiding(entity, host);
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
	RTMApiCompat.doFollowing(entity, host);
	if (rider) {
		RTMApiCompat.dismountPlayer(entity);
		dataMap.setBoolean("isEndEdit", true, 1);
	}
	if (dataMap.getBoolean("isEndEdit")) {
		entity.setDead();
		return;
	}
	const request = NGTOBuilderUtil.getJsonData<RailPositionMoveRequest>(
		dataMap,
		"railPositionMove",
	);
	if (request) {
		try {
			dataMap.setString("applyResult", applyRequest(entity, request), 1);
		} catch (error) {
			ErrorLogger.log(
				"SuperRailBuilderX RailPosition apply",
				"applyRequest",
				error,
				{ targetCount: request.targets ? request.targets.length : -1 },
			);
			dataMap.setString("applyResult", "internal_error", 1);
		} finally {
			NGTOBuilderUtil.resetJsonData(dataMap, "railPositionMove");
		}
	}
}
