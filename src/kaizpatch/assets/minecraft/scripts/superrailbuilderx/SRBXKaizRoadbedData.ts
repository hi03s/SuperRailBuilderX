import {
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
} from "jp.ngt.rtm.rail";
import { NBTBase, NBTTagCompound } from "net.minecraft.nbt";
import { World, WorldSavedData } from "net.minecraft.world";
import { MapGenStructureData } from "net.minecraft.world.gen.structure";
declare const Packages: {
	jp: {
		kaiz: {
			kaizpatch: {
				rtm: { rail: { TileEntityLargeRailSectionCore: Function } };
			};
		};
	};
};

/** 1.7.10 has no TileEntity#getTileData. Keep metadata in a dedicated saved-data file. */
export class SRBXKaizRoadbedData {
	private static storage(world: World): MapGenStructureData | null {
		// Client ghost cleanup must not create or write server persistence data.
		if (world.isRemote) return null;
		const name = `SRBXRoadbedOwnership_${world.provider.dimensionId}`;
		const storage = world.mapStorage;
		if (!storage)
			throw new Error("SRBX roadbed saved-data storage unavailable");
		let data = storage.loadData(
			(
				MapGenStructureData as unknown as {
					class: java.lang.Class<MapGenStructureData>;
				}
			).class,
			name,
		) as MapGenStructureData;
		if (!data) {
			// Vanilla's concrete NBT container supplies the existing save/load API;
			// its unique name is unrelated to native structure generation data.
			data = new MapGenStructureData(name);
			// Use the verified 1.7.10 SRG name: the overloaded MCP setData call
			// is not mapped by the script compiler for this concrete saved-data type.
			(
				storage as unknown as {
					func_75745_a(name: string, data: WorldSavedData): void;
				}
			).func_75745_a(name, data);
		}
		return data;
	}

	private static position(tile: TileEntityLargeRailBase): string {
		return `${tile.xCoord},${tile.yCoord},${tile.zCoord}`;
	}

	private static stamp(tile: TileEntityLargeRailBase): string {
		if (
			tile instanceof
			Packages.jp.kaiz.kaizpatch.rtm.rail.TileEntityLargeRailSectionCore
		) {
			const group = (
				tile as unknown as {
					getRailGroupId(): { toString(): string } | null;
				}
			).getRailGroupId();
			if (group) return `section:${group.toString()}`;
		}
		if (tile instanceof TileEntityLargeRailCore)
			return `core:${this.position(tile)}`;
		const owner = tile.getStartPoint();
		return `base:${owner[0]},${owner[1]},${owner[2]}`;
	}

	static get(tile: TileEntityLargeRailBase): NBTTagCompound {
		const saved = this.storage(tile.getWorldObj());
		if (!saved) return new NBTTagCompound();
		const root = saved.func_143041_a();
		const pos = this.position(tile);
		if (!root.hasKey(pos)) return new NBTTagCompound();
		const record = root.getCompoundTag(pos);
		return record.getString("stamp") === this.stamp(tile)
			? record.getCompoundTag("data")
			: new NBTTagCompound();
	}

	static set(tile: TileEntityLargeRailBase, data: NBTTagCompound): void {
		const saved = this.storage(tile.getWorldObj());
		if (!saved) return;
		const record = new NBTTagCompound();
		record.setString("stamp", this.stamp(tile));
		record.setTag("data", data as NBTBase);
		saved.func_143041_a().setTag(this.position(tile), record as NBTBase);
		saved.markDirty();
	}

	static remove(tile: TileEntityLargeRailBase): void {
		const saved = this.storage(tile.getWorldObj());
		if (!saved) return;
		saved.func_143041_a().removeTag(this.position(tile));
		saved.markDirty();
	}
}
