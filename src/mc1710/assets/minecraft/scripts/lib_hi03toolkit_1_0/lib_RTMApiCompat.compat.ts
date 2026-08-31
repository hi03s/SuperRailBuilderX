import { BlockSet, NGTObject } from "jp.ngt.ngtlib.block";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { ItemMiniature } from "jp.ngt.mcte.item";
import { RTMItem } from "jp.ngt.rtm";
import { Connection, TileEntityInsulator } from "jp.ngt.rtm.electric";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ItemWithModel } from "jp.ngt.rtm.item";
import { RailMap, RailPosition } from "jp.ngt.rtm.rail.util";
import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { Block } from "net.minecraft.block";
import { ICommandSender } from "net.minecraft.command";
import { Entity } from "net.minecraft.entity";
import { EntityPlayerMP, InventoryPlayer } from "net.minecraft.entity.player";
import { Blocks } from "net.minecraft.init";
import { ItemStack } from "net.minecraft.item";
import { NBTTagCompound } from "net.minecraft.nbt";
import { Packet } from "net.minecraft.network";
import { S21PacketChunkData } from "net.minecraft.network.play.server";
import { TileEntity } from "net.minecraft.tileentity";
import { ResourceLocation } from "net.minecraft.util";
import { World } from "net.minecraft.world";
import { BiomeGenBase } from "net.minecraft.world.biome";
import { Loader } from "cpw.mods.fml.common";

declare const Packages: {
	net: {
		minecraft: {
			block: {
				ITileEntityProvider: Function;
			};
		};
	};
};

export type Pos = [x: number, y: number, z: number];

export class RTMApiCompat {
	static getRailCorePos(core: TileEntityLargeRailCore): Pos {
		return [core.xCoord, core.yCoord, core.zCoord];
	}

	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean {
		return false;
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
		return "unsupported";
	}
	static createResourceLocation(
		domain: string,
		path: string,
	): ResourceLocation {
		return new ResourceLocation(domain, path);
	}

	static isModLoaded(modid: string): boolean {
		return Loader.isModLoaded(modid);
	}

	static getRider(entity: EntityVehicle): Entity | null {
		return entity.riddenByEntity;
	}

	static getRidingEntity(entity: EntityVehicle): Entity | null {
		return entity.ridingEntity;
	}

	static getWorld(entity: unknown): World {
		return (entity as Entity).worldObj;
	}

	static dismountPlayer(entity: EntityVehicle): void {
		const rider = RTMApiCompat.getRider(entity);
		if (rider) RTMApiCompat.dismount(rider);
	}

	static dismount(entity: Entity): void {
		entity.mountEntity(null as Entity);
	}

	static createNBTFromTileEntity(tileEntity: TileEntity): NBTTagCompound {
		const nbt = new NBTTagCompound();
		tileEntity.writeToNBT(nbt);
		return nbt;
	}

	static setBlock(
		world: World,
		x: number,
		y: number,
		z: number,
		block: Block,
		metadata: number,
		notifyNeighbors: boolean = true,
	): void {
		x = Math.floor(x);
		y = Math.floor(y);
		z = Math.floor(z);
		const flags: number = notifyNeighbors ? 3 : 2;
		world.setBlock(x, y, z, block, metadata, flags);
	}

	static getBlock(
		world: World,
		x: number,
		y: number,
		z: number,
	): Block | null {
		x = Math.floor(x);
		y = Math.floor(y);
		z = Math.floor(z);
		return world.getBlock(x, y, z);
	}

	static getMetadata(
		world: World,
		x: number,
		y: number,
		z: number,
	): number | null {
		x = Math.floor(x);
		y = Math.floor(y);
		z = Math.floor(z);
		return world.getBlockMetadata(x, y, z);
	}

	static getTileEntity(
		world: World,
		x: number,
		y: number,
		z: number,
	): TileEntity | null {
		x = Math.floor(x);
		y = Math.floor(y);
		z = Math.floor(z);
		return world.getTileEntity(x, y, z);
	}

	static hasTileEntity(blockSet: BlockSet | null): boolean {
		if (!blockSet || !blockSet.block) return false;
		const block = blockSet.block;
		try {
			const tileEntityProvider =
				Packages.net.minecraft.block.ITileEntityProvider;
			if (block instanceof tileEntityProvider) return true;
			return block.hasTileEntity(blockSet.metadata);
		} catch (err) {
			NGTLog.debug(
				"[NGTO Builder] hasTileEntity Error: " + block + " -> " + err,
			);
			return false;
		}
	}

	static setResourceName(tileEntity: TileEntity, modelName: string): void {
		void tileEntity;
		void modelName;
	}

	static setPos(
		tileEntity: TileEntity,
		x: number,
		y: number,
		z: number,
	): void {
		tileEntity.xCoord = x;
		tileEntity.yCoord = y;
		tileEntity.zCoord = z;
	}

	static getItemStackAt(
		inventory: InventoryPlayer,
		index: number,
	): ItemStack | null {
		return inventory.mainInventory[index];
	}

	static getInventorySize(inventory: InventoryPlayer): number {
		return inventory.mainInventory.length;
	}

	static doFollowing(entity: unknown, hostPlayer: unknown): void {
		void entity;
		void hostPlayer;
	}

	static startRiding(entity: unknown, targetEntity: unknown): void {
		(entity as Entity).mountEntity(targetEntity as Entity);
	}

	static sendChatMessage(target: unknown, message: string): void {
		NGTLog.sendChatMessage(target as ICommandSender, message);
	}

	static getNGTObjectFromItemNBT(nbt: NBTTagCompound): NGTObject | null {
		return ItemMiniature.getNGTObject(nbt);
	}

	static getRailPitch(
		railMap: RailMap,
		split: number,
		index: number,
	): number {
		void split;
		void index;
		return railMap.getRailPitch();
	}

	static getRailYaw(railMap: RailMap, split: number, index: number): number {
		return railMap.getRailRotation(split, index);
	}

	static getCant(railMap: RailMap, split: number, index: number): number {
		void railMap;
		void split;
		void index;
		return 0;
	}

	static getHorizontalAnchorYaw(rp: RailPosition): number {
		return rp.anchorDirection;
	}

	static getHorizontalAnchorLength(rp: RailPosition): number {
		return rp.anchorLength;
	}

	static getRPAnchorPitch(rp: RailPosition): number {
		void rp;
		return 0;
	}

	static getSubType(itemStack: ItemStack): string {
		return (itemStack.getItem() as ItemWithModel).getSubType(itemStack);
	}

	static getItemDamage(itemStack: ItemStack): number {
		return itemStack.getItemDamage();
	}

	static getBlockAir(): Block {
		return Blocks.air;
	}

	static getBlockStone(): Block {
		return Blocks.stone;
	}

	static getBlockGrass(): Block {
		return Blocks.grass;
	}

	static getBlockDirt(): Block {
		return Blocks.dirt;
	}

	static getBlockSnowLayer(): Block {
		return Blocks.snow_layer;
	}

	static getBlockSnow(): Block {
		return Blocks.snow;
	}

	static isLeaves(world: World, x: number, y: number, z: number): boolean {
		x = Math.floor(x);
		y = Math.floor(y);
		z = Math.floor(z);
		const block = world.getBlock(x, y, z);
		return block.isLeaves(world, x, y, z);
	}

	static canPlaceSnow(
		world: World,
		x: number,
		y: number,
		z: number,
	): boolean {
		return Blocks.snow_layer.canPlaceBlockAt(
			world,
			Math.floor(x),
			Math.floor(y),
			Math.floor(z),
		);
	}

	static getBiomeId(world: World, x: number, z: number): number {
		const chunk = world.getChunkFromChunkCoords(
			Math.floor(x) >> 4,
			Math.floor(z) >> 4,
		);
		return (
			chunk.getBiomeArray()[
				((Math.floor(z) & 15) << 4) | (Math.floor(x) & 15)
			] & 255
		);
	}

	static setBiomeId(
		world: World,
		x: number,
		z: number,
		biomeId: number,
	): void {
		const chunk = world.getChunkFromChunkCoords(
			Math.floor(x) >> 4,
			Math.floor(z) >> 4,
		);
		chunk.getBiomeArray()[
			((Math.floor(z) & 15) << 4) | (Math.floor(x) & 15)
		] = biomeId;
		chunk.setChunkModified();
	}

	static getSnowyBiomeId(): number {
		return BiomeGenBase.icePlains.biomeID;
	}

	static getPlainsBiomeId(): number {
		return BiomeGenBase.plains.biomeID;
	}

	static syncBiomeChunk(world: World, chunkX: number, chunkZ: number): void {
		const packet: Packet = new S21PacketChunkData(
			world.getChunkFromChunkCoords(chunkX, chunkZ),
			true,
			65535,
		);
		for (let i = 0; i < world.playerEntities.size(); i++) {
			const player = world.playerEntities.get(i);
			if (player instanceof EntityPlayerMP)
				player.playerNetServerHandler.sendPacket(packet);
		}
	}

	static setOffset(
		tileEntity: TileEntity,
		x: number,
		y: number,
		z: number,
		sync: boolean,
	): void {
		void tileEntity;
		void x;
		void y;
		void z;
		void sync;
	}

	static setWireConnection(
		tileEntity: TileEntityInsulator,
		targetPos: Pos,
		wireStack: ItemStack,
	): void {
		if (wireStack.getItem() !== RTMItem.itemWire) return;
		const sx = Math.floor(tileEntity.xCoord);
		const sy = Math.floor(tileEntity.yCoord);
		const sz = Math.floor(tileEntity.zCoord);
		const x = Math.floor(targetPos[0]);
		const y = Math.floor(targetPos[1]);
		const z = Math.floor(targetPos[2]);
		if (x === sx && y === sy && z === sz) {
			NGTLog.debug(
				"[NGTO Builder] Skip self wire connection: " +
					x +
					"," +
					y +
					"," +
					z,
			);
			return;
		}
		if (y < 0 || y >= 256) {
			NGTLog.debug(
				"[NGTO Builder] Skip wire connection: invalid target y=" +
					y +
					" pos=" +
					x +
					"," +
					y +
					"," +
					z,
			);
			return;
		}
		const modelName = (wireStack.getItem() as ItemWithModel).getModelName(
			wireStack,
		);
		tileEntity.setConnectionTo(
			x,
			y,
			z,
			Connection.ConnectionType.WIRE,
			modelName,
		);
	}

	static getModelNameFromItem(itemStack: ItemStack): string {
		const tag = itemStack.getTagCompound();
		return tag ? tag.getString("ModelName") : "";
	}
}
