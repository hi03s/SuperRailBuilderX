import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { EntityPlayer } from "net.minecraft.entity.player";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { SRBXApiCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBX_TOOLS, SRBX_TOOL_REQUESTS, toolIndex } from "./SRBXTools";

export class SRBXToolSwitchServer {
	/** Consume the server's handoff when a different tool starts its script. */
	static restoreHost(entity: EntityVehicle): EntityPlayer | null {
		const data = entity.getResourceState().getDataMap();
		const pending = String(data.getString("srbxToolSwitchHost"));
		if (!pending) return null;
		data.setString("srbxToolSwitchHost", "", 1);
		if (
			pending !== String(data.getString("hostPlayerEntityId")) ||
			data.getBoolean("isEndEdit") ||
			!isFinite(Number(pending)) ||
			String(Number(pending)) !== pending ||
			Number(pending) < 0
		)
			return null;
		const host = SRBXApiCompat.getWorld(entity).getEntityByID(
			Number(pending),
		);
		return host instanceof EntityPlayer && !host.isDead ? host : null;
	}
	/** Run after host/exit validation, before processing the current tool's requests. */
	static update(entity: EntityVehicle, host: EntityPlayer): boolean {
		const data = entity.getResourceState().getDataMap();
		const target = String(data.getString("srbxToolSwitchRequest"));
		if (!target) return false;
		data.setString("srbxToolSwitchRequest", "", 1);
		const index = toolIndex(target);
		const hostId = String(host.getEntityId());
		const ownerId = String(data.getString("hostPlayerEntityId"));
		const riding = SRBXApiCompat.getRidingEntity(entity);
		// Java wrappers can differ between stored hosts and API return values.
		// Entity IDs identify the host within this server world.
		const ridingId = riding ? String(riding.getEntityId()) : "none";
		const validMount = SRBXApiCompat.usesMountedToolHost()
			? ridingId === hostId
			: !riding || ridingId === hostId;
		let status = "invalid_tool";
		if (index >= 0 && ownerId !== hostId) status = "invalid_owner";
		else if (index >= 0 && !validMount) status = "invalid_mount";
		if (index >= 0 && ownerId === hostId && validMount) {
			let busy = false;
			for (let i = 0; i < SRBX_TOOL_REQUESTS.length; i++)
				if (data.getString(SRBX_TOOL_REQUESTS[i])) busy = true;
			if (busy) status = "busy";
			else {
				try {
					// A newly selected renderer has its own script globals. Carry the
					// input-release gate through the synchronized entity DataMap.
					data.setBoolean("srbxWheelInputBlocked", true, 1);
					data.setString("srbxToolSwitchHost", hostId, 1);
					status = SRBXApiCompat.switchToolModel(
						entity,
						SRBX_TOOLS[index].model,
					)
						? "ok"
						: "missing_model";
				} catch (error) {
					status = "internal_error";
					NGTLog.debug(
						`[SuperRailBuilderX wheel] switch failed: ${String(error)}`,
					);
				}
				if (status !== "ok")
					data.setString("srbxToolSwitchHost", "", 1);
			}
		}
		data.setString("srbxToolSwitchResult", status, 1);
		NGTLog.debug(
			`[SuperRailBuilderX wheel] target=${target}, result=${status}, index=${index}, host=${hostId}, owner=${ownerId}, riding=${ridingId}`,
		);
		return status === "ok";
	}
}
