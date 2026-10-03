import { NGTLog } from "jp.ngt.ngtlib.io";
import { SRBXPatchPlatform } from "@target/assets/minecraft/scripts/srbx_patch/platform";
import { SRBXRailRenderPatch } from "./rail_render_patch";

export class SRBXPatchBootstrap {
	private static started = false;
	private static completed = false;

	static start(): void {
		if (!SRBXPatchPlatform.isSupported() || this.started || this.completed)
			return;
		this.started = true;
		NGTLog.debug("[SRBX rail patch] bootstrap started");

		SRBXPatchPlatform.scheduleWhenReady(
			() => {
				if (this.completed) return;
				try {
					SRBXRailRenderPatch.apply();
					this.completed = true;
				} catch (error) {
					this.started = false;
					NGTLog.debug(
						`[SRBX rail patch] bootstrap failed: ${error}`,
					);
				}
			},
			(error) => {
				this.started = false;
				NGTLog.debug(
					`[SRBX rail patch] bootstrap unavailable: ${error}`,
				);
			},
		);
	}
}
