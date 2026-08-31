import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ScriptExecuter } from "jp.ngt.rtm.modelpack";
import { TileEntityLargeRailBase } from "jp.ngt.rtm.rail";
import { Entity } from "net.minecraft.entity";
import { EntityPlayer } from "net.minecraft.entity.player";
import { WeakHashMap } from "java.util";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import { RTMApiCompat } from "@target/assets/minecraft/scripts/lib_hi03toolkit_1_0/lib_RTMApiCompat";
import { RailPositionCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/RailPositionCompat";

const VERSION = "0.1.0";

export type RailPositionMoveRequest = {
	core: [number, number, number];
	index: number;
	original: [number, number, number];
	destination: [number, number, number];
};

const hosts: WeakHashMap<Entity, EntityPlayer> = new WeakHashMap();

function applyRequest(
	entity: EntityVehicle,
	request: RailPositionMoveRequest,
): string {
	const world = RTMApiCompat.getWorld(entity);
	const tile = RTMApiCompat.getTileEntity(
		world,
		request.core[0],
		request.core[1],
		request.core[2],
	);
	if (!(tile instanceof TileEntityLargeRailBase)) return "rail_not_found";
	const core = tile.getRailCore();
	if (!core) return "rail_not_found";
	return RailPositionCompat.moveRailPosition(
		core,
		request.index,
		request.original[0],
		request.original[1],
		request.original[2],
		request.destination[0],
		request.destination[1],
		request.destination[2],
	);
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
		dataMap.setString("applyResult", applyRequest(entity, request), 1);
		NGTOBuilderUtil.resetJsonData(dataMap, "railPositionMove");
	}
}
