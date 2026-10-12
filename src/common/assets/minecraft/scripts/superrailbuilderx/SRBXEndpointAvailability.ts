import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { RailPosition } from "jp.ngt.rtm.rail.util";
import { World } from "net.minecraft.world";
import { SRBXApiCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";

/** Endpoint snapping uses logical rails, including remote section owners. */
export class SRBXEndpointAvailability {
	static isAvailable(
		world: World,
		core: TileEntityLargeRailCore,
		position: RailPosition,
		loadedCores?: TileEntityLargeRailCore[],
	): boolean {
		if (
			!position ||
			!isFinite(position.posX) ||
			!isFinite(position.posY) ||
			!isFinite(position.posZ)
		)
			return false;
		const ownKey = String(SRBXApiCompat.getRailPositionCandidateKey(core));
		const cores =
			loadedCores ||
			SRBXApiCompat.getLoadedRailCores(
				world,
				position.posX,
				position.posZ,
				2,
			);
		const seen: { [key: string]: boolean } = {};
		for (let i = 0; i < cores.length; i++) {
			const other = cores[i];
			if (!other) continue;
			const key = String(
				SRBXApiCompat.getRailPositionCandidateKey(other),
			);
			if (key === ownKey || seen[key]) continue;
			const positions = SRBXApiCompat.getEditableRailPositions(other);
			if (!positions) continue;
			seen[key] = true;
			for (let j = 0; j < positions.length; j++) {
				const p = positions[j];
				if (
					p &&
					Math.abs(p.posX - position.posX) <= 0.001 &&
					Math.abs(p.posY - position.posY) <= 0.001 &&
					Math.abs(p.posZ - position.posZ) <= 0.001
				)
					return false;
			}
		}
		return true;
	}
}
