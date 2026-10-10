import { SRBXRailBoundary } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXRailBoundary";
import { RailMap } from "jp.ngt.rtm.rail.util";

/** KaizPatch experimental branch only. AE keeps its block-boundary policy. */
export class SRBXFreeEndpointPolicy {
	static isBoundary(
		position: [number, number, number],
		yaw: number,
	): boolean {
		return (
			!!position && isFinite(yaw) && position.every((v) => isFinite(v))
		);
	}
	static normalizePoint<T>(point: T): T {
		return point;
	}
	static direction(position: [number, number, number], yaw: number): number {
		void position;
		return Math.round((((yaw % 360) + 360) % 360) / 45) & 7;
	}
	static owner(position: [number, number, number], yaw: number) {
		return SRBXRailBoundary.owner(position, yaw);
	}
	static findMapBoundary(map: RailMap, ratio: number, min = 0, max = 1) {
		if (!map || !isFinite(ratio) || ratio < min || ratio > max) return null;
		const split = 100000000,
			index = Math.round(ratio * split);
		const p = map.getRailPos(split, index);
		return {
			ratio: index / split,
			position: [p[1], map.getRailHeight(split, index), p[0]] as [
				number,
				number,
				number,
			],
		};
	}
}
