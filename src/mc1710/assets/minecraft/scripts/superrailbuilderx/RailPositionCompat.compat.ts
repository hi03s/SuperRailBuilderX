import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { RailPosition } from "jp.ngt.rtm.rail.util";

export class RailPositionCompat {
	static getRailCorePos(
		core: TileEntityLargeRailCore,
	): [number, number, number] {
		return [core.xCoord, core.yCoord, core.zCoord];
	}

	static getRailPositionCandidateKey(core: TileEntityLargeRailCore): string {
		return `core:${core.xCoord},${core.yCoord},${core.zCoord}`;
	}

	static getEditableRailPositions(
		core: TileEntityLargeRailCore,
	): JavaObjectArray<RailPosition> {
		return core.getRailPositions();
	}

	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean {
		void core;
		return false;
	}

	static getRailPositionUnsupportedReason(
		core: TileEntityLargeRailCore,
	): string {
		void core;
		return "unsupported_target";
	}

	static refreshRailPositionClient(
		core: TileEntityLargeRailCore,
		index: number,
		x: number,
		y: number,
		z: number,
	): void {
		void core;
		void index;
		void x;
		void y;
		void z;
	}

	static validateRailPositionMove(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
	): string {
		void core;
		void index;
		void originalX;
		void originalY;
		void originalZ;
		return "unsupported";
	}

	static moveRailPosition(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
		void core;
		void index;
		void originalX;
		void originalY;
		void originalZ;
		void x;
		void y;
		void z;
		return "unsupported";
	}
}
