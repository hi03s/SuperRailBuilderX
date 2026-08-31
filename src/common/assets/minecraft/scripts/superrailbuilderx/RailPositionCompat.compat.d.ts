import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";

export type RailCorePos = [x: number, y: number, z: number];

export class RailPositionCompat {
	static getRailCorePos(core: TileEntityLargeRailCore): RailCorePos;
	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean;
	static refreshRailPositionClient(
		core: TileEntityLargeRailCore,
		index: number,
		x: number,
		y: number,
		z: number,
	): void;
	static moveRailPosition(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string;
}
