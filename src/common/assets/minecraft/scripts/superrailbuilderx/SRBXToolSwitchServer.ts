import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { EntityPlayer } from "net.minecraft.entity.player";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { SRBXApiCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBX_TOOLS, SRBX_TOOL_REQUESTS, toolIndex } from "./SRBXTools";

export class SRBXToolSwitchServer {
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
		let status = "invalid_tool";
		if (index >= 0 && ownerId !== hostId) status = "invalid_owner";
		else if (index >= 0 && ridingId !== hostId) status = "invalid_mount";
		if (index >= 0 && ownerId === hostId && ridingId === hostId) {
			let busy = false;
			for (let i = 0; i < SRBX_TOOL_REQUESTS.length; i++)
				if (data.getString(SRBX_TOOL_REQUESTS[i])) busy = true;
			if (busy) status = "busy";
			else {
				try {
					// A newly selected renderer has its own script globals. Carry the
					// input-release gate through the synchronized entity DataMap.
					data.setBoolean("srbxWheelInputBlocked", true, 1);
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
			}
		}
		data.setString("srbxToolSwitchResult", status, 1);
		NGTLog.debug(
			`[SuperRailBuilderX wheel] target=${target}, result=${status}, index=${index}, host=${hostId}, owner=${ownerId}, riding=${ridingId}`,
		);
		return status === "ok";
	}
}
