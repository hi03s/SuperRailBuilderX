import { NGTLog } from "jp.ngt.ngtlib.io";
import { Entity } from "net.minecraft.entity";
import { RailMap } from "jp.ngt.rtm.rail.util";
import { GL11 } from "org.lwjgl.opengl";
import { SRBXApiCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { NGTOBuilderUtilClient } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtilClient";

export class SRBXRailHighlight {
	private static reported = false;

	static render(
		entity: Entity,
		map: RailMap,
		color: string,
		alpha: number,
	): void {
		if (!SRBXApiCompat.usesGeometryRailHighlight()) {
			NGTOBuilderUtilClient.renderRailMapHighlight(
				entity,
				map,
				color,
				alpha,
			);
			return;
		}
		// AE section owners can differ from the logical endpoint block. Model
		// callbacks require a physical section, so highlight the logical geometry.
		try {
			const length = map.getLength();
			if (!isFinite(length) || length <= 0) return;
			const split = Math.max(1, Math.min(8192, Math.ceil(length * 2)));
			const points: number[][] = [];
			for (let i = 0; i <= split; i++) {
				const pos = map.getRailPos(split, i);
				const height = map.getRailHeight(split, i);
				if (!isFinite(pos[0]) || !isFinite(pos[1]) || !isFinite(height))
					return;
				points.push([pos[1], height + 0.1, pos[0]]);
			}
			const rgb = parseInt(color.replace("#", ""), 16);
			GL11.glPushAttrib(GL11.GL_ALL_ATTRIB_BITS);
			try {
				GL11.glDisable(GL11.GL_TEXTURE_2D);
				GL11.glDisable(GL11.GL_LIGHTING);
				GL11.glEnable(GL11.GL_BLEND);
				GL11.glBlendFunc(
					GL11.GL_SRC_ALPHA,
					GL11.GL_ONE_MINUS_SRC_ALPHA,
				);
				GL11.glColor4f(
					((rgb >> 16) & 255) / 255,
					((rgb >> 8) & 255) / 255,
					(rgb & 255) / 255,
					alpha,
				);
				GL11.glLineWidth(4);
				GL11.glBegin(GL11.GL_LINE_STRIP);
				try {
					for (let i = 0; i < points.length; i++)
						GL11.glVertex3d(
							points[i][0],
							points[i][1],
							points[i][2],
						);
				} finally {
					GL11.glEnd();
				}
			} finally {
				GL11.glPopAttrib();
			}
		} catch (error) {
			if (!this.reported) {
				this.reported = true;
				NGTLog.debug(
					`[SuperRailBuilderX AE] logical highlight deferred: ${error}`,
				);
			}
		}
	}
}
