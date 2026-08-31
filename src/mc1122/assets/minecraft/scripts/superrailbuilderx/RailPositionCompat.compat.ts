import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";

export class RailPositionCompat {
	static getRailCorePos(
		core: TileEntityLargeRailCore,
	): [number, number, number] {
		const pos = core.getPos();
		return [pos.getX(), pos.getY(), pos.getZ()];
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
