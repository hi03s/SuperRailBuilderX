import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { RailPosition } from "jp.ngt.rtm.rail.util";

export type RailCorePos = [x: number, y: number, z: number];

export class RailPositionCompat {
	static getRailCorePos(core: TileEntityLargeRailCore): RailCorePos;
	static getRailPositionCandidateKey(core: TileEntityLargeRailCore): string;
	static getEditableRailPositions(
		core: TileEntityLargeRailCore,
	): JavaObjectArray<RailPosition>;
	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean;
	static getRailPositionUnsupportedReason(
		core: TileEntityLargeRailCore,
	): string;
	static refreshRailPositionClient(
		core: TileEntityLargeRailCore,
		index: number,
		x: number,
		y: number,
		z: number,
	): void;
	static validateRailPositionMove(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string;
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
	static validateRailPositionMoveAsNormal(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string;
	static moveRailPositionAsNormal(
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
