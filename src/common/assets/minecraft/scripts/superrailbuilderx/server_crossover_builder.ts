import { SRBXToolSwitchServer } from "./SRBXToolSwitchServer";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ScriptExecuter } from "jp.ngt.rtm.modelpack";
import { Entity } from "net.minecraft.entity";
import { EntityPlayer } from "net.minecraft.entity.player";
import { WeakHashMap } from "java.util";
import { ErrorLogger } from "../lib_hi03toolkit_1_0/lib_ErrorLogger";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import { SRBXApiCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";

import { SRBXCrossoverPlan } from "./SRBXCrossoverPlan";

const VERSION = "0.3.1";
export type CrossoverBuilderRequest =
	{ action: "create"; plan: SRBXCrossoverPlan } | { action: "undo" };
const hosts: WeakHashMap<Entity, EntityPlayer> = new WeakHashMap();
function process(
	entity: EntityVehicle,
	host: EntityPlayer,
	request: CrossoverBuilderRequest,
): string {
	const world = SRBXApiCompat.getWorld(entity);
	if (!request || (request.action !== "create" && request.action !== "undo"))
		return "invalid_request";
	if (request.action === "undo") return "undo_disabled";
	const result = SRBXApiCompat.createCrossoverBuilderRail(
		world,
		host,
		request.plan,
	);
	if (result.status !== "ok")
		NGTLog.debug(
			`[SuperRailBuilderX crossover] rejected request: status=${result.status}, plan=${JSON.stringify(request.plan)}`,
		);
	return result.status;
}
function onUpdate(entity: EntityVehicle, executer: ScriptExecuter): void {
	void executer;
	entity.rotationYaw = 0;
	const d = entity.getResourceState().getDataMap();
	let host = hosts.get(entity) || SRBXToolSwitchServer.restoreHost(entity);
	if (host) hosts.put(entity, host);
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
	if (SRBXToolSwitchServer.update(entity, host)) return;
	d.setBoolean("crossoverBuilderCanUndo", false, 1);
	const request = NGTOBuilderUtil.getJsonData<CrossoverBuilderRequest>(
		d,
		"crossoverBuilderRequest",
	);
	if (!request) return;
	try {
		NGTOBuilderUtil.resetJsonData(d, "crossoverBuilderClientUpdate");
		const status = process(entity, host, request),
			update = SRBXApiCompat.consumeLastBranchClientUpdate();
		if (update)
			NGTOBuilderUtil.sendJsonData(
				d,
				"crossoverBuilderClientUpdate",
				update,
			);
		d.setString("crossoverBuilderResult", status, 1);
		d.setBoolean("crossoverBuilderCanUndo", false, 1);
		NGTLog.debug(
			`[SuperRailBuilderX crossover] action=${request.action}, result=${status}`,
		);
	} catch (error) {
		ErrorLogger.log(
			"SuperRailBuilderX crossover",
			"processRequest",
			error,
			{
				action: request.action,
			},
		);
		d.setString("crossoverBuilderResult", "internal_error", 1);
	} finally {
		NGTOBuilderUtil.resetJsonData(d, "crossoverBuilderRequest");
	}
}
