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
	private static planOwners(
		world: World,
		positions: RailPosition[],
		maps: import("jp.ngt.rtm.rail.util").RailMap[],
		property: ResourceStateRail,
		blocked?: (owner: RailPosition) => boolean,
	): RailPosition[] | null {
		const reserved: { [key: string]: boolean } = {},
			used: { [key: string]: boolean } = {};
		const key = (p: number[]) => p.join(",");
		for (const rp of positions)
			reserved[key([rp.blockX, rp.blockY, rp.blockZ])] = true;
		const planned = positions.slice();
		for (let i = 0; i < positions.length; i++) {
			const rp = positions[i],
				owner = [rp.blockX, rp.blockY, rp.blockZ];
			const occupied = blocked
				? blocked(rp)
				: BlockUtil.getTileEntity(
						world,
						owner[0],
						owner[1],
						owner[2],
					) instanceof TileEntityLargeRailCore;
			if (!occupied && !used[key(owner)]) {
				used[key(owner)] = true;
				continue;
			}
			let target: number[] | null = null,
				best = 6.25;
			// Stay inside the rail's footprint so native Undo removes each owner.
			for (const map of maps) {
				const blocks = map.getRailBlockList(property, true);
				for (let j = 0; j < blocks.size(); j++) {
					const b = blocks.get(j),
						p = [b[0], b[1], b[2]];
					if (reserved[key(p)] || p[1] !== rp.blockY) continue;
					// Move preflight ignores the source group, including a source
					// core that becomes a free relocation target after removal.
					const candidate = new RailPosition(
						p[0],
						p[1],
						p[2],
						rp.direction,
						rp.switchType,
					);
					if (
						blocked
							? blocked(candidate)
							: BlockUtil.getTileEntity(
									world,
									p[0],
									p[1],
									p[2],
								) instanceof TileEntityLargeRailCore
					)
						continue;
					const distance =
						Math.pow(p[0] + 0.5 - rp.posX, 2) +
						Math.pow(p[2] + 0.5 - rp.posZ, 2);
					if (distance < best) {
						best = distance;
						target = p;
					}
				}
			}
			if (!target) {
				NGTLog.debug(
					`[SuperRailBuilderX AE] switch owner blocked: index=${i}, owner=${key(owner)}, logical=${rp.posX},${rp.posY},${rp.posZ}`,
				);
				return null;
			}
			const relocated = RailPosition.readFromNBT(
				rp.writeToNBT(),
				new RailPosition(
					rp.blockX,
					rp.blockY,
					rp.blockZ,
					rp.direction,
					rp.switchType,
				),
			);
			relocated.blockX = target[0];
			relocated.blockY = target[1];
			relocated.blockZ = target[2];
			relocated.setPosition(rp.posX, rp.posY, rp.posZ);
			planned[i] = relocated;
			reserved[key(target)] = used[key(target)] = true;
			NGTLog.debug(
				`[SuperRailBuilderX AE] switch owner relocated: index=${i}, from=${key(owner)}, to=${key(target)}, logical=${rp.posX},${rp.posY},${rp.posZ}`,
			);
		}
		return planned;
	}

	static planPositions(
		world: World,
		positions: RailPosition[],
		property: ResourceStateRail,
		blocked?: (owner: RailPosition) => boolean,
	): RailPosition[] | null {
		const list = new ArrayList<RailPosition>();
		for (const rp of positions) list.add(rp);
		const maker = new RailMaker(
			world,
			list,
			RailMapBasic.fixRTMRailMapVersionCurrent,
		);
		const railSwitch = maker.getSwitch();
		if (!railSwitch) return null;
		const maps = railSwitch.getAllRailMap();
		if (!maps || maps.length === 0) return null;
		return this.planOwners(
			world,
			positions,
			Array.prototype.slice.call(maps),
			property,
			blocked,
		);
	}

	static create(
		world: World,
		player: EntityPlayer,
		positions: RailPosition[],
		property: ResourceStateRail,
	): boolean {
		if (!positions || positions.length < 3 || positions.some((rp) => !rp))
			return false;
		// Keep logical endpoints fixed and use only free in-footprint owners.
		const list = new ArrayList<RailPosition>();
		for (let i = 0; i < positions.length; i++) list.add(positions[i]);
		let maker = new RailMaker(
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
		let maps = switchType.getAllRailMap();
		if (!maps || maps.length === 0) return false;
		const planned = this.planOwners(
			world,
			positions,
			Array.prototype.slice.call(maps),
			property,
		);
		if (!planned) return false;
		positions = planned;
		const relocatedList = new ArrayList<RailPosition>();
		for (const rp of positions) relocatedList.add(rp);
		maker = new RailMaker(
			world,
			relocatedList,
			RailMapBasic.fixRTMRailMapVersionCurrent,
		);
		const relocatedSwitch = maker.getSwitch();
		if (!relocatedSwitch) return false;
		maps = relocatedSwitch.getAllRailMap();
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
				if (prior instanceof TileEntityLargeRailCore) {
					NGTLog.debug(
						`[SuperRailBuilderX AE] switch owner changed before placement: index=${i}, owner=${rp.blockX},${rp.blockY},${rp.blockZ}`,
					);
					return false;
				}
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
