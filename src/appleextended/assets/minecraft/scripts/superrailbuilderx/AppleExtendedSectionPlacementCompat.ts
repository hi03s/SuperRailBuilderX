import { AppleExtendedRoadbedPlacement } from "./AppleExtendedRoadbedPlacement";
import { ArrayList, UUID } from "java.util";
import { BlockUtil } from "jp.ngt.ngtlib.block";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { RTMRail } from "jp.ngt.rtm";
import { ResourceStateRail } from "jp.ngt.rtm.modelpack.state";
import {
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
} from "jp.ngt.rtm.rail";
import { RailMap, RailMapBasic, RailPosition } from "jp.ngt.rtm.rail.util";
import { RailChunkSectioner, RailMapSection } from "jp.apple.rail.util";
import { TileEntityLargeRailSectionCore } from "jp.apple.rail";
import { World } from "net.minecraft.world";
import { BlockPos } from "net.minecraft.util.math";
import { NBTBase, NBTTagCompound } from "net.minecraft.nbt";
import { AppleExtendedRailProtection } from "./AppleExtendedRailProtection";
import { Block } from "net.minecraft.block";
import { SRBXRoadbedOwnership } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXRoadbedOwnership";

type Section = {
	start: RailPosition;
	end: RailPosition;
	from: number;
	to: number;
	owner: JavaIntArray;
	map: RailMapSection;
};
export type AppleExtendedSectionPlacement = {
	source: RailMapBasic;
	sections: Section[];
};

/** Preserve logical endpoints; move only physical section ownership within its roadbed. */
export class AppleExtendedSectionPlacementCompat {
	static plan(
		world: World,
		start: RailPosition,
		end: RailPosition,
		property: ResourceStateRail,
		blocked: (position: RailPosition) => boolean,
	): AppleExtendedSectionPlacement | null {
		const source = new RailMapBasic(
			start,
			end,
			RailMapBasic.fixRTMRailMapVersionCurrent,
		);
		const native = RailChunkSectioner.split(source);
		const count = native.size() || 1;
		const sections: Section[] = [];
		const used: { [key: string]: boolean } = {};
		for (let i = 0; i < count; i++) {
			const section = native.size() ? native.get(i) : null;
			const physicalStart = section ? section.getStartRP() : start;
			const physicalEnd = section ? section.getEndRP() : end;
			const from = section ? section.getStartRatio() : 0;
			const to = section ? section.getEndRatio() : 1;
			const map = new RailMapSection(
				source,
				physicalStart,
				physicalEnd,
				from,
				to,
			);
			const blocks = map.getRailBlockList(property, true);
			let owner: JavaIntArray | null = null;
			let distance = Infinity;
			for (let j = 0; j < blocks.size(); j++) {
				const candidate = blocks.get(j);
				const key = `${candidate[0]},${candidate[1]},${candidate[2]}`;
				if (
					used[key] ||
					!world.isBlockLoaded(
						new BlockPos(candidate[0], candidate[1], candidate[2]),
					)
				)
					continue;
				const rp = new RailPosition(
					candidate[0],
					candidate[1],
					candidate[2],
					physicalStart.direction,
					physicalStart.switchType,
				);
				if (blocked(rp)) continue;
				const d =
					Math.pow(candidate[0] - physicalStart.blockX, 2) +
					Math.pow(candidate[1] - physicalStart.blockY, 2) +
					Math.pow(candidate[2] - physicalStart.blockZ, 2);
				if (d < distance) {
					owner = candidate;
					distance = d;
				}
			}
			if (!owner) {
				NGTLog.debug(
					`[SuperRailBuilderX AE] section owner relocation blocked: section=${i}, candidates=${blocks.size()}, range=${from}-${to}`,
				);
				return null;
			}
			used[`${owner[0]},${owner[1]},${owner[2]}`] = true;
			// Section geometry comes from source + ratios. Its logical RPs are unchanged.
			const relocated = RailPosition.readFromNBT(
				physicalStart.writeToNBT(),
			);
			relocated.blockX = owner[0];
			relocated.blockY = owner[1];
			relocated.blockZ = owner[2];
			relocated.setPosition(
				physicalStart.posX,
				physicalStart.posY,
				physicalStart.posZ,
			);
			sections.push({
				start: relocated,
				end: RailPosition.readFromNBT(physicalEnd.writeToNBT()),
				from,
				to,
				owner,
				map: new RailMapSection(
					source,
					relocated,
					physicalEnd,
					from,
					to,
				),
			});
		}
		return { source, sections };
	}

	static create(
		world: World,
		placement: AppleExtendedSectionPlacement,
		property: ResourceStateRail,
		creative: boolean,
	): boolean {
		const sections = placement.sections;
		// Revalidate every physical owner before any block mutation.
		for (let i = 0; i < sections.length; i++) {
			const owner = sections[i].owner;
			const tile = world.getTileEntity(
				new BlockPos(owner[0], owner[1], owner[2]),
			);
			if (tile instanceof TileEntityLargeRailCore) return false;
			if (!sections[i].map.canPlaceRail(world, creative, property))
				return false;
		}
		const group = UUID.randomUUID();
		const positions = new ArrayList<JavaIntArray>();
		for (let i = 0; i < sections.length; i++)
			positions.add(sections[i].owner);
		const maps: RailMap[] = [placement.source];
		for (let i = 0; i < sections.length; i++) maps.push(sections[i].map);
		const protectedRoadbeds = AppleExtendedRailProtection.capture(
			world,
			maps,
			property,
		);
		const created: TileEntityLargeRailSectionCore[] = [];
		const promotions: NBTTagCompound[] = [];
		let success = false;
		try {
			const logical = [
				placement.source.getStartRP(),
				placement.source.getEndRP(),
			] as unknown as JavaObjectArray<RailPosition>;
			placement.source.prepareBaseBlocks(
				world,
				logical[0].blockX,
				logical[0].blockY,
				logical[0].blockZ,
			);
			for (let i = 0; i < sections.length; i++) {
				const section = sections[i],
					owner = section.owner;
				AppleExtendedRoadbedPlacement.place(
					world,
					section.map,
					section.start,
					property,
				);
			}
			for (let i = 0; i < sections.length; i++) {
				const section = sections[i],
					owner = section.owner;
				const beforeCore = BlockUtil.getTileEntity(
					world,
					owner[0],
					owner[1],
					owner[2],
				);
				const beforeBlock = BlockUtil.getBlock(
					world,
					owner[0],
					owner[1],
					owner[2],
				);
				const promotion =
					beforeCore instanceof TileEntityLargeRailBase
						? SRBXRoadbedOwnership.capturePromotion(
								beforeCore,
								Block.getIdFromBlock(beforeBlock),
								beforeBlock.getMetaFromState(
									world.getBlockState(
										new BlockPos(
											owner[0],
											owner[1],
											owner[2],
										),
									),
								),
								(c) =>
									AppleExtendedRoadbedPlacement.ownerKey(c),
								(tile, nbt) => {
									tile.writeToNBT(nbt);
								},
							)
						: null;
				if (promotion) promotions.push(promotion);
				if (beforeCore instanceof TileEntityLargeRailBase) {
					beforeCore.setStartPoint(owner[0], owner[1], owner[2]);
					beforeCore.markDirty();
				}
				BlockUtil.setBlock(
					world,
					owner[0],
					owner[1],
					owner[2],
					RTMRail.largeRailCore,
					1,
					3,
				);
				const core = BlockUtil.getTileEntity(
					world,
					owner[0],
					owner[1],
					owner[2],
				) as unknown as TileEntityLargeRailSectionCore;
				if (!(core instanceof TileEntityLargeRailSectionCore))
					return false;
				created.push(core);
				const nbt: NBTTagCompound = new NBTTagCompound();
				nbt.setInteger("x", owner[0]);
				nbt.setInteger("y", owner[1]);
				nbt.setInteger("z", owner[2]);
				nbt.setInteger("spX", owner[0]);
				nbt.setInteger("spY", owner[1]);
				nbt.setInteger("spZ", owner[2]);
				nbt.setInteger(
					"fixRTMRailMapVersion",
					RailMapBasic.fixRTMRailMapVersionCurrent,
				);
				nbt.setTag("State", property.writeToNBT() as NBTBase);
				nbt.setByte("Size", 2);
				nbt.setTag("RP0", section.start.writeToNBT() as NBTBase);
				nbt.setTag("RP1", section.end.writeToNBT() as NBTBase);
				core.readFromNBT(nbt);
				core.configureRailSection(
					group,
					logical,
					[
						section.start,
						section.end,
					] as unknown as JavaObjectArray<RailPosition>,
					section.from,
					section.to,
					positions,
				);
				core.createRailMap();
				if (promotion)
					SRBXRoadbedOwnership.attachPromotion(
						core.getTileData(),
						promotion,
					);
			}
			for (let i = 0; i < created.length; i++) created[i].sendPacket();
			success = true;
			NGTLog.debug(
				`[SuperRailBuilderX AE] section owners relocated: cores=${sections.length}, owners=${sections.map((s) => `${s.owner[0]},${s.owner[1]},${s.owner[2]}`).join(";")}`,
			);
			return true;
		} finally {
			if (!success) {
				// Do not leave partially initialized section cores if native placement fails.
				for (let i = 0; i < created.length; i++) {
					const core = created[i],
						pos = core.getPos();
					if ((world.getTileEntity(pos) as unknown) === core) {
						core.breaking = true;
						world.setBlockToAir(pos);
					}
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
