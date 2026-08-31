import { NGTUtil } from "jp.ngt.ngtlib.util";
import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";

declare const Packages: {
	jp: {
		kaiz: {
			kaizpatch: {
				rtm: {
					rail: {
						TileEntityLargeRailSectionCore: Function;
					};
				};
			};
		};
	};
};

export class RailPositionCompat {
	static getRailCorePos(
		core: TileEntityLargeRailCore,
	): [number, number, number] {
		return [core.xCoord, core.yCoord, core.zCoord];
	}

	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean {
		return (
			core !== null &&
			!(
				core instanceof
				Packages.jp.kaiz.kaizpatch.rtm.rail
					.TileEntityLargeRailSectionCore
			)
		);
	}

	static refreshRailPositionClient(
		core: TileEntityLargeRailCore,
		index: number,
		x: number,
		y: number,
		z: number,
	): void {
		const positions = core.getRailPositions();
		if (!positions || index < 0 || index >= positions.length) return;
		positions[index].setPosition(x, y, z);
		core.setRailPositions(positions);
		core.createRailMap();
		core.shouldRerenderRail = true;
		core.getWorldObj().markBlockForUpdate(
			core.xCoord,
			core.yCoord,
			core.zCoord,
		);
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
		if (!this.canMoveRailPosition(core)) return "sectioned";
		const positions = core.getRailPositions();
		if (index < 0 || index >= positions.length) return "not_found";
		const position = positions[index];
		const tolerance = 0.001;
		if (
			Math.abs(position.posX - originalX) > tolerance ||
			Math.abs(position.posY - originalY) > tolerance ||
			Math.abs(position.posZ - originalZ) > tolerance
		)
			return "changed";
		position.setPosition(x, y, z);
		core.setRailPositions(positions);
		core.createRailMap();
		core.markDirty();
		NGTUtil.sendPacketToClient(core);
		core.getWorldObj().markBlockForUpdate(
			core.xCoord,
			core.yCoord,
			core.zCoord,
		);
		return "ok";
	}
}
