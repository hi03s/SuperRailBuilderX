import {
	TileEntityLargeRailCore,
	TileEntityLargeRailSwitchCore,
} from "jp.ngt.rtm.rail";
import { RailPosition } from "jp.ngt.rtm.rail.util";

/** AppleExtended ca255fd provides persistent free coordinates on normal RailPosition. */
export class SRBXApiCompat {
	private static lastRailPositionMoveCores: Array<[number, number, number]> =
		[];

	static getRailCorePos(
		core: TileEntityLargeRailCore,
	): [number, number, number] {
		const pos = core.getPos();
		return [pos.getX(), pos.getY(), pos.getZ()];
	}

	static getRailPositionCandidateKey(core: TileEntityLargeRailCore): string {
		const pos = this.getRailCorePos(core);
		return `core:${pos[0]},${pos[1]},${pos[2]}`;
	}

	static getEditableRailPositions(
		core: TileEntityLargeRailCore,
	): JavaObjectArray<RailPosition> {
		return core.getRailPositions();
	}

	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean {
		return this.getRailPositionUnsupportedReason(core) === "";
	}

	static getRailPositionUnsupportedReason(
		core: TileEntityLargeRailCore,
	): string {
		if (!core) return "missing_core";
		if (core instanceof TileEntityLargeRailSwitchCore) return "switch";
		const positions = core.getRailPositions();
		return positions && positions.length === 2 ? "" : "invalid_positions";
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
		this.refreshRailCoreClient(core);
	}

	static refreshRailCoreClient(core: TileEntityLargeRailCore): void {
		if (!core) return;
		core.createRailMap();
		core.shouldRerenderRail = true;
		const world = core.getWorld();
		const pos = core.getPos();
		const state = world.getBlockState(pos);
		world.notifyBlockUpdate(pos, state, state, 3);
	}

	static consumeLastRailPositionMoveCores(): Array<[number, number, number]> {
		const result = this.lastRailPositionMoveCores;
		this.lastRailPositionMoveCores = [];
		return result;
	}

	static validateRailPositionMove(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
		if (!this.canMoveRailPosition(core)) return "unsupported";
		if (core.isTrainOnRail()) return "occupied";
		const positions = core.getRailPositions();
		if (!positions || index < 0 || index >= positions.length)
			return "not_found";
		const current = positions[index];
		const tolerance = 0.001;
		if (
			Math.abs(current.posX - originalX) > tolerance ||
			Math.abs(current.posY - originalY) > tolerance ||
			Math.abs(current.posZ - originalZ) > tolerance
		)
			return "changed";
		if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return "invalid";
		return "ok";
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
		this.lastRailPositionMoveCores = [];
		const validation = this.validateRailPositionMove(
			core,
			index,
			originalX,
			originalY,
			originalZ,
			x,
			y,
			z,
		);
		if (validation !== "ok") return validation;
		const positions = core.getRailPositions();
		positions[index].setPosition(x, y, z);
		core.setRailPositions(positions);
		core.createRailMap();
		core.markDirty();
		core.sendPacket();
		this.lastRailPositionMoveCores.push(this.getRailCorePos(core));
		return "ok";
	}

	static validateRailPositionMoveAsNormal(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
		return this.validateRailPositionMove(
			core,
			index,
			originalX,
			originalY,
			originalZ,
			x,
			y,
			z,
		);
	}

	static moveRailPositionAsNormal(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
		return this.moveRailPosition(
			core,
			index,
			originalX,
			originalY,
			originalZ,
			x,
			y,
			z,
		);
	}
}
