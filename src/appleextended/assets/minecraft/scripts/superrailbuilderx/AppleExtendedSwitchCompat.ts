import { AppleExtendedRoadbedPlacement } from "./AppleExtendedRoadbedPlacement";
import { ArrayList } from "java.util";
import { BlockUtil } from "jp.ngt.ngtlib.block";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { RTMRail } from "jp.ngt.rtm";
import { ResourceStateRail } from "jp.ngt.rtm.modelpack.state";
import {
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
	TileEntityLargeRailSwitchBase,
	TileEntityLargeRailSwitchCore,
} from "jp.ngt.rtm.rail";
import { RailMaker, RailMapBasic, RailPosition } from "jp.ngt.rtm.rail.util";
import { EntityPlayer } from "net.minecraft.entity.player";
import { World } from "net.minecraft.world";
import { NBTBase, NBTTagCompound } from "net.minecraft.nbt";
import { AppleExtendedRailProtection } from "./AppleExtendedRailProtection";
import { SRBXRoadbedOwnership } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXRoadbedOwnership";
import { Block } from "net.minecraft.block";
import { BlockPos } from "net.minecraft.util.math";

/** AE's public marker overload omits the player on its switch failure path. */
export class AppleExtendedSwitchCompat {
	static create(
		world: World,
		player: EntityPlayer,
		positions: RailPosition[],
		property: ResourceStateRail,
	): boolean {
		// Live cores are never replaced. Ordinary bases are detached safely below.
		for (let i = 0; i < positions.length; i++) {
			const rp = positions[i];
			const tile = BlockUtil.getTileEntity(
				world,
				rp.blockX,
				rp.blockY,
				rp.blockZ,
			);
			if (tile instanceof TileEntityLargeRailCore) {
				NGTLog.debug(
					"[SuperRailBuilderX AE] switch creation rejected: occupied owner block",
				);
				return false;
			}
		}
		const list = new ArrayList<RailPosition>();
		for (let i = 0; i < positions.length; i++) list.add(positions[i]);
		const maker = new RailMaker(
			world,
			list,
			RailMapBasic.fixRTMRailMapVersionCurrent,
		);
		const switchType = maker.getSwitch();
		if (!switchType) {
			NGTLog.debug(
				"[SuperRailBuilderX AE] switch creation rejected: invalid switch positions",
			);
			return false;
		}
		const maps = switchType.getAllRailMap();
		if (!maps || maps.length === 0) return false;
		for (let i = 0; i < maps.length; i++)
			if (
				!maps[i].canPlaceRail(
					world,
					player.capabilities.isCreativeMode,
					property,
				)
			)
				return false;

		// Follow AE v2.5.3 BlockMarker.createSwitchRail using public rail APIs.
		// Complete the geometry/placement checks before modifying the world.
		const root = positions[0];
		const protectedRoadbeds = AppleExtendedRailProtection.capture(
			world,
			Array.prototype.slice.call(maps),
			property,
		);
		const promotions: NBTTagCompound[] = [];
		const installed: BlockPos[] = [];
		let success = false;
		try {
			for (let i = 0; i < maps.length; i++) {
				maps[i].prepareBaseBlocks(
					world,
					root.blockX,
					root.blockY,
					root.blockZ,
				);
				AppleExtendedRoadbedPlacement.place(
					world,
					maps[i],
					root,
					property,
				);
			}
			for (let i = 0; i < positions.length; i++) {
				const rp = positions[i];
				const pos = new BlockPos(rp.blockX, rp.blockY, rp.blockZ);
				const prior = world.getTileEntity(pos);
				if (prior instanceof TileEntityLargeRailBase) {
					const block = world.getBlockState(pos).getBlock();
					const record = SRBXRoadbedOwnership.capturePromotion(
						prior,
						Block.getIdFromBlock(block),
						block.getMetaFromState(world.getBlockState(pos)),
						(c) => AppleExtendedRoadbedPlacement.ownerKey(c),
						(tile, nbt) => {
							tile.writeToNBT(nbt);
						},
					);
					if (record) promotions.push(record);
					prior.setStartPoint(rp.blockX, rp.blockY, rp.blockZ);
					prior.markDirty();
				}
				installed.push(pos);
				BlockUtil.setBlock(
					world,
					rp.blockX,
					rp.blockY,
					rp.blockZ,
					RTMRail.largeRailSwitchBase,
					0,
					3,
				);
				const base = BlockUtil.getTileEntity(
					world,
					rp.blockX,
					rp.blockY,
					rp.blockZ,
				) as unknown as TileEntityLargeRailSwitchBase;
				base.setStartPoint(root.blockX, root.blockY, root.blockZ);
			}
			BlockUtil.setBlock(
				world,
				root.blockX,
				root.blockY,
				root.blockZ,
				RTMRail.largeRailSwitchCore,
				0,
				3,
			);
			const core = BlockUtil.getTileEntity(
				world,
				root.blockX,
				root.blockY,
				root.blockZ,
			) as unknown as TileEntityLargeRailSwitchCore;
			// The version is protected, and setRailPositions immediately creates
			// a switch map. Initialize both together via the public persistence API.
			const nbt: NBTTagCompound = new NBTTagCompound();
			nbt.setInteger("x", root.blockX);
			nbt.setInteger("y", root.blockY);
			nbt.setInteger("z", root.blockZ);
			nbt.setInteger("spX", root.blockX);
			nbt.setInteger("spY", root.blockY);
			nbt.setInteger("spZ", root.blockZ);
			nbt.setInteger("fixRTMRailMapVersion", maker.fixRTMRailMapVersion);
			nbt.setTag("State", property.writeToNBT() as NBTBase);
			nbt.setByte("Size", positions.length);
			for (let i = 0; i < positions.length; i++)
				nbt.setTag(`RP${i}`, positions[i].writeToNBT() as NBTBase);
			core.readFromNBT(nbt);
			core.createRailMap();
			for (let i = 0; i < promotions.length; i++)
				SRBXRoadbedOwnership.attachPromotion(
					core.getTileData(),
					promotions[i],
				);
			core.onBlockChanged();
			core.sendPacket();
			NGTLog.debug(
				`[SuperRailBuilderX AE] switch initialized: root=${root.blockX},${root.blockY},${root.blockZ}, positions=${positions.length}, version=${maker.fixRTMRailMapVersion}`,
			);
			success = true;
			return true;
		} finally {
			if (!success) {
				for (let i = 0; i < installed.length; i++) {
					const pos = installed[i],
						tile = world.getTileEntity(pos);
					if (tile instanceof TileEntityLargeRailCore)
						tile.breaking = true;
					else if (tile instanceof TileEntityLargeRailBase)
						tile.setStartPoint(pos.getX(), pos.getY(), pos.getZ());
					world.setBlockToAir(pos);
				}
				for (let i = 0; i < promotions.length; i++)
					AppleExtendedRoadbedPlacement.restorePromotion(
						world,
						promotions[i],
					);
			}
			AppleExtendedRailProtection.restore(world, protectedRoadbeds);
		}
	}
}
