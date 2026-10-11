import {
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
} from "jp.ngt.rtm.rail";
import { RailMap } from "jp.ngt.rtm.rail.util";
import { NBTBase, NBTTagCompound } from "net.minecraft.nbt";

const loanTag = "SRBXEndpointRoadbedLoan";
const promotionTag = "SRBXPromotedRoadbed";
type Position = [number, number, number];

/** Change only ownership, never replace a live rail block (breakBlock is destructive). */
export class SRBXRoadbedOwnership {
	static capturePromotion(
		tile: TileEntityLargeRailBase,
		blockId: number,
		metadata: number,
		keyOf: (core: TileEntityLargeRailCore) => string,
		write: (tile: TileEntityLargeRailBase, nbt: NBTTagCompound) => void,
	): NBTTagCompound | null {
		if (tile instanceof TileEntityLargeRailCore) return null;
		const owner = tile.getRailCore();
		if (!owner) return null;
		const record = new NBTTagCompound(),
			nbt = new NBTTagCompound();
		write(tile, nbt);
		record.setTag("tile", nbt as NBTBase);
		record.setInteger("block", blockId);
		record.setInteger("metadata", metadata);
		record.setString("key", keyOf(owner));
		return record;
	}

	static attachPromotion(
		data: NBTTagCompound,
		record: NBTTagCompound | null,
	): void {
		if (!record) return;
		if (data.hasKey(promotionTag))
			record.setTag(
				"nextPromotion",
				data.getCompoundTag(promotionTag) as NBTBase,
			);
		data.setTag(promotionTag, record as NBTBase);
	}

	static promotions(
		tiles: java.util.List<unknown>,
		key: string,
		keyOf: (core: TileEntityLargeRailCore) => string,
		getData: (core: TileEntityLargeRailCore) => NBTTagCompound,
	): NBTTagCompound[] {
		const result: NBTTagCompound[] = [];
		for (let i = 0; i < tiles.size(); i++) {
			const tile = tiles.get(i);
			if (
				!(tile instanceof TileEntityLargeRailCore) ||
				keyOf(tile) !== key
			)
				continue;
			const data = getData(tile);
			if (!data.hasKey(promotionTag)) continue;
			let record = data.getCompoundTag(promotionTag);
			for (let depth = 0; depth < 64; depth++) {
				result.push(record);
				if (!record.hasKey("nextPromotion")) break;
				record = record.getCompoundTag("nextPromotion");
			}
		}
		return result;
	}

	static endpointTiles(
		map: Pick<RailMap, "getLength" | "getRailPos" | "getRailHeight">,
	): Position[] {
		const split = Math.max(1, Math.ceil(map.getLength() * 100));
		const result: Position[] = [];
		for (const index of [Math.min(1, split), Math.max(0, split - 1)]) {
			const p = map.getRailPos(split, index);
			const height = map.getRailHeight(split, index);
			result.push([
				Math.floor(p[1]),
				height < 0 ? Math.ceil(height) : Math.floor(height),
				Math.floor(p[0]),
			]);
		}
		return result;
	}

	static transfer(
		tile: TileEntityLargeRailBase,
		owner: Position,
		keyOf: (core: TileEntityLargeRailCore) => string,
		data: NBTTagCompound,
	): boolean {
		if (tile instanceof TileEntityLargeRailCore) return false;
		const previous = tile.getStartPoint();
		if (
			previous[0] === owner[0] &&
			previous[1] === owner[1] &&
			previous[2] === owner[2]
		)
			return false;
		const previousCore = tile.getRailCore();
		if (previousCore) {
			const record = new NBTTagCompound();
			record.setInteger("x", previous[0]);
			record.setInteger("y", previous[1]);
			record.setInteger("z", previous[2]);
			record.setString("key", keyOf(previousCore));
			if (data.hasKey(loanTag))
				record.setTag(
					"previous",
					data.getCompoundTag(loanTag) as NBTBase,
				);
			data.setTag(loanTag, record as NBTBase);
		}
		tile.setStartPoint(owner[0], owner[1], owner[2]);
		tile.markDirty();
		return true;
	}

	/** Return borrowed tiles before moving/splitting/undoing their current owner. */
	static release(
		tiles: java.util.List<unknown>,
		departingKey: string,
		resolve: (position: Position) => TileEntityLargeRailCore | null,
		keyOf: (core: TileEntityLargeRailCore) => string,
		getData: (tile: TileEntityLargeRailBase) => NBTTagCompound,
		changed?: (tile: TileEntityLargeRailBase) => void,
	): void {
		for (let i = 0; i < tiles.size(); i++) {
			const tile = tiles.get(i);
			if (
				!(tile instanceof TileEntityLargeRailBase) ||
				tile instanceof TileEntityLargeRailCore
			)
				continue;
			const current = tile.getRailCore();
			if (!current || keyOf(current) !== departingKey) continue;
			const data = getData(tile);
			if (!data.hasKey(loanTag)) continue;
			let record = data.getCompoundTag(loanTag);
			for (let depth = 0; depth < 64; depth++) {
				const position: Position = [
					record.getInteger("x"),
					record.getInteger("y"),
					record.getInteger("z"),
				];
				const prior = resolve(position);
				if (
					prior &&
					keyOf(prior) === record.getString("key") &&
					keyOf(prior) !== departingKey
				) {
					tile.setStartPoint(position[0], position[1], position[2]);
					if (record.hasKey("previous"))
						data.setTag(
							loanTag,
							record.getCompoundTag("previous") as NBTBase,
						);
					else data.removeTag(loanTag);
					tile.markDirty();
					if (changed) changed(tile);
					break;
				}
				if (!record.hasKey("previous")) {
					data.removeTag(loanTag);
					break;
				}
				record = record.getCompoundTag("previous");
			}
		}
	}
}
