import { NGTLog } from "jp.ngt.ngtlib.io";
import { NGTUtil } from "jp.ngt.ngtlib.util";
import {
	BlockMarker,
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
} from "jp.ngt.rtm.rail";
import { RailPosition, RailProperty } from "jp.ngt.rtm.rail.util";
import { ArrayList } from "java.util";

type RailSectionCore = TileEntityLargeRailCore & {
	getLogicalRailPositions(): JavaObjectArray<RailPosition> | null;
	getRailGroupCorePositions(): java.util.List<number[]> | null;
	getRailGroupId(): { toString(): string } | null;
	isRailSection(): boolean;
};

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
	private static isSectionCore(
		core: TileEntityLargeRailCore,
	): core is RailSectionCore {
		return (
			core instanceof
			Packages.jp.kaiz.kaizpatch.rtm.rail.TileEntityLargeRailSectionCore
		);
	}

	private static copyRailPositions(positions: {
		length: number;
		[index: number]: RailPosition;
	}): RailPosition[] {
		const copies: RailPosition[] = [];
		for (let i = 0; i < positions.length; i++)
			copies.push(RailPosition.readFromNBT(positions[i].writeToNBT()));
		return copies;
	}

	private static toJavaList(positions: {
		length: number;
		[index: number]: RailPosition;
	}): java.util.List<RailPosition> {
		const list = new ArrayList<RailPosition>();
		for (let i = 0; i < positions.length; i++) list.add(positions[i]);
		return list;
	}

	static getRailCorePos(
		core: TileEntityLargeRailCore,
	): [number, number, number] {
		return [core.xCoord, core.yCoord, core.zCoord];
	}

	static getRailPositionCandidateKey(core: TileEntityLargeRailCore): string {
		if (this.isSectionCore(core)) {
			const groupId = core.getRailGroupId();
			if (groupId) return `section:${groupId.toString()}`;
		}
		return `core:${core.xCoord},${core.yCoord},${core.zCoord}`;
	}

	static getEditableRailPositions(
		core: TileEntityLargeRailCore,
	): JavaObjectArray<RailPosition> {
		if (this.isSectionCore(core)) {
			const positions = core.getLogicalRailPositions();
			return positions || core.getRailPositions();
		}
		return core.getRailPositions();
	}

	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean {
		return this.getRailPositionUnsupportedReason(core) === "";
	}

	static getRailPositionUnsupportedReason(
		core: TileEntityLargeRailCore,
	): string {
		if (!core) return "missing_core";
		if (this.isSectionCore(core)) {
			const logicalPositions = core.getLogicalRailPositions();
			const groupPositions = core.getRailGroupCorePositions();
			if (
				!logicalPositions ||
				logicalPositions.length !== 2 ||
				!groupPositions ||
				groupPositions.size() === 0
			)
				return `sectioned_invalid(groupCores=${groupPositions ? groupPositions.size() : -1}, logicalPositions=${logicalPositions ? logicalPositions.length : -1})`;
		}
		return "";
	}

	static refreshRailPositionClient(
		core: TileEntityLargeRailCore,
		index: number,
		x: number,
		y: number,
		z: number,
	): void {
		if (this.isSectionCore(core)) return;
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
		if (this.isSectionCore(core))
			return this.moveSectionedRailPosition(
				core,
				index,
				originalX,
				originalY,
				originalZ,
				x,
				y,
				z,
			);
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

	private static moveSectionedRailPosition(
		core: RailSectionCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
		if (core.isLogicalRailOccupied()) return "occupied";
		const logicalPositions = core.getLogicalRailPositions();
		const groupPositions = core.getRailGroupCorePositions();
		if (
			!logicalPositions ||
			logicalPositions.length !== 2 ||
			!groupPositions ||
			groupPositions.size() === 0
		)
			return "invalid_section";
		if (index < 0 || index >= logicalPositions.length) return "not_found";
		const position = logicalPositions[index];
		const tolerance = 0.001;
		if (
			Math.abs(position.posX - originalX) > tolerance ||
			Math.abs(position.posY - originalY) > tolerance ||
			Math.abs(position.posZ - originalZ) > tolerance
		)
			return "changed";
		const world = core.getWorldObj();
		for (let i = 0; i < groupPositions.size(); i++) {
			const pos = groupPositions.get(i);
			const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
			if (!(tile instanceof TileEntityLargeRailBase))
				return "section_unloaded";
			const groupCore = tile.getRailCore();
			if (!groupCore || !core.isSameLogicalRail(groupCore))
				return "section_unloaded";
		}
		const originalPositions = this.copyRailPositions(logicalPositions);
		const movedPositions = this.copyRailPositions(logicalPositions);
		movedPositions[index].setPosition(x, y, z);
		const property = core.getProperty();
		const signal = core.getSignal();
		const subRails = new ArrayList<RailProperty>();
		for (let i = 0; i < core.subRails.size(); i++)
			subRails.add(core.subRails.get(i));
		NGTLog.debug(
			`[SuperRailBuilderX RailPosition] rebuilding sectioned rail: groupCores=${groupPositions.size()}, index=${index}`,
		);
		let created = false;
		try {
			core.breakLogicalRail();
			created = BlockMarker.createRail(
				world,
				movedPositions[0].blockX,
				movedPositions[0].blockY,
				movedPositions[0].blockZ,
				this.toJavaList(movedPositions),
				property,
				true,
				true,
			);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] sectioned rail rebuild exception: ${error}`,
			);
		}
		if (!created) {
			let restored = false;
			try {
				restored = BlockMarker.createRail(
					world,
					originalPositions[0].blockX,
					originalPositions[0].blockY,
					originalPositions[0].blockZ,
					this.toJavaList(originalPositions),
					property,
					true,
					true,
				);
			} catch (error) {
				NGTLog.debug(
					`[SuperRailBuilderX RailPosition] sectioned rail rollback exception: ${error}`,
				);
			}
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] sectioned rail rebuild failed: restored=${restored}`,
			);
			return restored
				? "section_rebuild_failed"
				: "section_rollback_failed";
		}
		const newTile = world.getTileEntity(
			movedPositions[0].blockX,
			movedPositions[0].blockY,
			movedPositions[0].blockZ,
		);
		if (!(newTile instanceof TileEntityLargeRailBase))
			return "section_state_restore_failed";
		const newCore = newTile.getRailCore();
		if (!newCore) return "section_state_restore_failed";
		try {
			newCore.setSignal(signal);
			for (let i = 0; i < subRails.size(); i++)
				newCore.addSubRail(subRails.get(i));
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] sectioned rail state restore exception: ${error}`,
			);
			return "section_state_restore_failed";
		}
		let newGroupCoreCount = 1;
		if (this.isSectionCore(newCore)) {
			const newGroupPositions = newCore.getRailGroupCorePositions();
			if (newGroupPositions) newGroupCoreCount = newGroupPositions.size();
		}
		NGTLog.debug(
			`[SuperRailBuilderX RailPosition] sectioned rail rebuild succeeded: oldGroupCores=${groupPositions.size()}, newGroupCores=${newGroupCoreCount}`,
		);
		return "ok_sectioned";
	}
}
