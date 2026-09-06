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
	SRBXBranchRequest,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";

const VERSION = "alpha-0.1.0";
export type BranchBuilderRequest =
	{ action: "create"; plan: SRBXBranchRequest } | { action: "undo" };
const hosts: WeakHashMap<Entity, EntityPlayer> = new WeakHashMap(),
	undos: WeakHashMap<EntityVehicle, string> = new WeakHashMap();
function process(
	entity: EntityVehicle,
	host: EntityPlayer,
	request: BranchBuilderRequest,
): string {
	const world = SRBXApiCompat.getWorld(entity);
	if (!request || (request.action !== "create" && request.action !== "undo"))
		return "invalid_request";
	if (request.action === "undo") {
		const token = undos.get(entity);
		if (!token) return "nothing_to_undo";
		const r = SRBXApiCompat.undoBranchBuilderRail(world, host, token);
		if (r === "undo_ok") undos.remove(entity);
		return r;
	}
	const result = SRBXApiCompat.createBranchBuilderRail(
		world,
		host,
		request.plan,
	);
	if (result.status === "ok" && result.undoToken)
		undos.put(entity, result.undoToken);
	return result.status;
}
function onUpdate(entity: EntityVehicle, executer: ScriptExecuter): void {
	void executer;
	entity.rotationYaw = 0;
	const d = entity.getResourceState().getDataMap();
	let host = hosts.get(entity);
	const rider = SRBXApiCompat.getRider(entity) as unknown as EntityPlayer,
		riding = SRBXApiCompat.getRidingEntity(entity);
	if (d.getString("VERSIONS") === "") d.setString("VERSIONS", VERSION, 1);
	if (!host) {
		if (rider) {
			host = rider;
			hosts.put(entity, host);
			d.setString("hostPlayerEntityId", String(host.getEntityId()), 1);
			SRBXApiCompat.dismountPlayer(entity);
			SRBXApiCompat.startRiding(entity, host);
		} else if (riding instanceof EntityPlayer) {
			host = riding;
			hosts.put(entity, host);
			d.setString("hostPlayerEntityId", String(host.getEntityId()), 1);
		}
		return;
	}
	SRBXApiCompat.doFollowing(entity, host);
	if (rider) {
		SRBXApiCompat.dismountPlayer(entity);
		d.setBoolean("isEndEdit", true, 1);
	}
	if (d.getBoolean("isEndEdit")) {
		entity.setDead();
		return;
	}
	d.setBoolean("branchBuilderCanUndo", undos.get(entity) !== null, 1);
	const request = NGTOBuilderUtil.getJsonData<BranchBuilderRequest>(
		d,
		"branchBuilderRequest",
	);
	if (!request) return;
	try {
		NGTOBuilderUtil.resetJsonData(d, "branchBuilderClientUpdate");
		const status = process(entity, host, request),
			update = SRBXApiCompat.consumeLastBranchClientUpdate();
		if (update)
			NGTOBuilderUtil.sendJsonData(
				d,
				"branchBuilderClientUpdate",
				update,
			);
		d.setString("branchBuilderResult", status, 1);
		d.setBoolean("branchBuilderCanUndo", undos.get(entity) !== null, 1);
		NGTLog.debug(
			`[SuperRailBuilderX branch] action=${request.action}, result=${status}`,
		);
	} catch (error) {
		ErrorLogger.log("SuperRailBuilderX branch", "processRequest", error, {
			action: request.action,
		});
		d.setString("branchBuilderResult", "internal_error", 1);
	} finally {
		NGTOBuilderUtil.resetJsonData(d, "branchBuilderRequest");
	}
}
