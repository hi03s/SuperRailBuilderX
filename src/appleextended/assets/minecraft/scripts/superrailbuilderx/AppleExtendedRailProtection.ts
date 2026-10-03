import { TileEntityLargeRailBase } from "jp.ngt.rtm.rail";
import { RailMap } from "jp.ngt.rtm.rail.util";
import { ResourceStateRail } from "jp.ngt.rtm.modelpack.state";
import { World } from "net.minecraft.world";
import { BlockPos } from "net.minecraft.util.math";

type RoadbedOwner = {
	position: [number, number, number];
	owner: [number, number, number];
};

/** Native placement reassigns existing base tiles even when their block is unchanged. */
export class AppleExtendedRailProtection {
	static capture(
		world: World,
		maps: RailMap[],
		property: ResourceStateRail,
	): RoadbedOwner[] {
		const result: RoadbedOwner[] = [];
		const seen: { [key: string]: boolean } = {};
		for (let i = 0; i < maps.length; i++) {
			const blocks = maps[i].getRailBlockList(property, true);
			for (let j = 0; j < blocks.size(); j++) {
				const block = blocks.get(j);
				const key = `${block[0]},${block[1]},${block[2]}`;
				if (seen[key]) continue;
				seen[key] = true;
				const tile = world.getTileEntity(
					new BlockPos(block[0], block[1], block[2]),
				);
				if (
					!(tile instanceof TileEntityLargeRailBase) ||
					!tile.getRailCore()
				)
					continue;
				const owner = tile.getStartPoint();
				result.push({
					position: [block[0], block[1], block[2]],
					owner: [owner[0], owner[1], owner[2]],
				});
			}
		}
		return result;
	}

	static restore(world: World, records: RoadbedOwner[]): void {
		for (let i = 0; i < records.length; i++) {
			const entry = records[i];
			const tile = world.getTileEntity(
				new BlockPos(
					entry.position[0],
					entry.position[1],
					entry.position[2],
				),
			);
			if (tile instanceof TileEntityLargeRailBase)
				tile.setStartPoint(
					entry.owner[0],
					entry.owner[1],
					entry.owner[2],
				);
		}
	}
}
