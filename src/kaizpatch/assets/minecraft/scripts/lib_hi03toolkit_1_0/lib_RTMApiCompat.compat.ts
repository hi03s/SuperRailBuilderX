import { ItemMiniature } from "jp.ngt.mcte.item";
import { NGTObject, TileEntityPlaceable } from "jp.ngt.ngtlib.block";
import { RailMap, RailPosition } from "jp.ngt.rtm.rail.util";
import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { NBTTagCompound } from "net.minecraft.nbt";
import { ResourceLocation } from "net.minecraft.util";
import { NGTUtil } from "jp.ngt.ngtlib.util";

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

export class RTMApiCompat {
	static getRailCorePos(core: TileEntityLargeRailCore): [number, number, number] {
		return [core.xCoord, core.yCoord, core.zCoord];
	}

	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean {
		return (
			core !== null &&
			!(
				core instanceof
				Packages.jp.kaiz.kaizpatch.rtm.rail.TileEntityLargeRailSectionCore
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
	static createResourceLocation(
		domain: string,
		path: string,
	): ResourceLocation {
		return new ResourceLocation(domain, path);
	}

	static getRailPitch(
		railMap: RailMap,
		split: number,
		index: number,
	): number {
		return railMap.getRailPitch(split, index);
	}

	static getRailYaw(railMap: RailMap, split: number, index: number): number {
		return railMap.getRailYaw(split, index);
	}

	static getCant(railMap: RailMap, split: number, index: number): number {
		return railMap.getCant(split, index);
	}

	static getHorizontalAnchorYaw(rp: RailPosition): number {
		return rp.anchorYaw;
	}

	static getHorizontalAnchorLength(rp: RailPosition): number {
		return rp.anchorLengthHorizontal;
	}

	static getRPAnchorPitch(rp: RailPosition): number {
		return rp.anchorPitch;
	}

	static setOffset(
		tileEntity: TileEntityPlaceable,
		x: number,
		y: number,
		z: number,
		sync: boolean,
	): void {
		tileEntity.setOffset(x, y, z, sync);
	}

	static getNGTObjectFromItemNBT(nbt: NBTTagCompound): NGTObject | null {
		return ItemMiniature.getNGTObject(nbt);
	}
}
