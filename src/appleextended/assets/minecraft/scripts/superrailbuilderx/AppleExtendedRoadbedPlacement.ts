import { BlockUtil } from "jp.ngt.ngtlib.block";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { RTMRail } from "jp.ngt.rtm";
import {
	BlockLargeRailBase,
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
} from "jp.ngt.rtm.rail";
import { RailMap, RailMapBasic, RailPosition } from "jp.ngt.rtm.rail.util";
import { ResourceStateRail } from "jp.ngt.rtm.modelpack.state";
import { BlockPos } from "net.minecraft.util.math";
import { World } from "net.minecraft.world";
import { NBTBase, NBTTagCompound } from "net.minecraft.nbt";

/** Preserve existing rail blocks before any block or ownership write. */
export class AppleExtendedRoadbedPlacement {
	static hasExisting(
		world: World,
		maps: RailMap[],
		property: ResourceStateRail,
	): boolean {
		for (let i = 0; i < maps.length; i++) {
			const blocks = maps[i].getRailBlockList(property, true);
			for (let j = 0; j < blocks.size(); j++) {
				const p = blocks.get(j);
				if (
					BlockUtil.getBlock(world, p[0], p[1], p[2]) instanceof
						BlockLargeRailBase ||
					BlockUtil.getTileEntity(world, p[0], p[1], p[2]) instanceof
						TileEntityLargeRailBase
				)
					return true;
			}
		}
		return false;
	}
	static place(
		world: World,
		map: RailMap,
		owner: RailPosition,
		property: ResourceStateRail,
	): void {
		const blocks = map.getRailBlockList(property, true);
		let retained = 0,
			added = 0;
		const samples: string[] = [];
		for (let i = 0; i < blocks.size(); i++) {
			const pos = blocks.get(i);
			const tile = BlockUtil.getTileEntity(world, pos[0], pos[1], pos[2]);
			const block = BlockUtil.getBlock(world, pos[0], pos[1], pos[2]);
			if (
				block instanceof BlockLargeRailBase ||
				tile instanceof TileEntityLargeRailBase
			) {
				retained++;
				if (samples.length < 4) {
					const prior =
						tile instanceof TileEntityLargeRailBase
							? tile.getStartPoint()
							: null;
					samples.push(
						`${pos[0]},${pos[1]},${pos[2]}:${prior ? `${prior[0]},${prior[1]},${prior[2]}` : "missing_tile"}`,
					);
				}
				continue;
			}
			BlockUtil.setBlock(
				world,
				pos[0],
				pos[1],
				pos[2],
				RTMRail.largeRailBase,
				0,
				2,
			);
			const placed = BlockUtil.getTileEntity(
				world,
				pos[0],
				pos[1],
				pos[2],
			);
			if (!(placed instanceof TileEntityLargeRailBase))
				throw new Error(
					`roadbed tile missing at ${pos[0]},${pos[1]},${pos[2]}`,
				);
			placed.setStartPoint(owner.blockX, owner.blockY, owner.blockZ);
			placed.markDirty();
			added++;
		}
		NGTLog.debug(
			`[SuperRailBuilderX roadbed] target=appleextended, added=${added}, retained=${retained}, owner=${owner.blockX},${owner.blockY},${owner.blockZ}, samples=${samples.join(";")}`,
		);
	}

	static createNormal(
		world: World,
		map: RailMap,
		property: ResourceStateRail,
		creative: boolean,
	): boolean {
		if (!map.canPlaceRail(world, creative, property)) return false;
		const start = map.getStartRP(),
			end = map.getEndRP();
		if (
			BlockUtil.getTileEntity(
				world,
				start.blockX,
				start.blockY,
				start.blockZ,
			) instanceof TileEntityLargeRailCore
		)
			return false;
		map.prepareBaseBlocks(world, start.blockX, start.blockY, start.blockZ);
		this.place(world, map, start, property);
		BlockUtil.setBlock(
			world,
			start.blockX,
			start.blockY,
			start.blockZ,
			RTMRail.largeRailCore,
			0,
			3,
		);
		const core = BlockUtil.getTileEntity(
			world,
			start.blockX,
			start.blockY,
			start.blockZ,
		);
		if (!(core instanceof TileEntityLargeRailCore)) return false;
		let success = false;
		try {
			const nbt = new NBTTagCompound();
			for (const field of ["x", "spX"])
				nbt.setInteger(field, start.blockX);
			for (const field of ["y", "spY"])
				nbt.setInteger(field, start.blockY);
			for (const field of ["z", "spZ"])
				nbt.setInteger(field, start.blockZ);
			nbt.setInteger(
				"fixRTMRailMapVersion",
				RailMapBasic.fixRTMRailMapVersionCurrent,
			);
			nbt.setTag("State", property.writeToNBT() as NBTBase);
			nbt.setByte("Size", 2);
			nbt.setTag("RP0", start.writeToNBT() as NBTBase);
			nbt.setTag("RP1", end.writeToNBT() as NBTBase);
			core.readFromNBT(nbt);
			core.createRailMap();
			core.sendPacket();
			success = true;
			return true;
		} finally {
			if (
				!success &&
				(BlockUtil.getTileEntity(
					world,
					start.blockX,
					start.blockY,
					start.blockZ,
				) as unknown) === core
			) {
				core.breaking = true;
				world.setBlockToAir(
					new BlockPos(start.blockX, start.blockY, start.blockZ),
				);
			}
		}
	}
}
