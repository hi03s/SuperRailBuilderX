import {
	BlockSet,
	BlockUtil,
	NGTObject,
	TileEntityPlaceable,
} from "jp.ngt.ngtlib.block";
import { NGTLog, ResourceLocationCustom } from "jp.ngt.ngtlib.io";
import { ItemMiniature } from "jp.ngt.mcte.item";
import { RTMItem } from "jp.ngt.rtm";
import { Connection, TileEntityInsulator } from "jp.ngt.rtm.electric";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { ItemInstalledObject, ItemWithModel } from "jp.ngt.rtm.item";
import { RailMap, RailPosition } from "jp.ngt.rtm.rail.util";
import { Block } from "net.minecraft.block";
import { ICommandSender } from "net.minecraft.command";
import { Entity } from "net.minecraft.entity";
import { EntityPlayerMP, InventoryPlayer } from "net.minecraft.entity.player";
import { Biomes, Blocks } from "net.minecraft.init";
import { ItemStack } from "net.minecraft.item";
import { NBTTagCompound } from "net.minecraft.nbt";
import { Packet } from "net.minecraft.network";
import { SPacketChunkData } from "net.minecraft.network.play.server";
import { TileEntity } from "net.minecraft.tileentity";
import { ResourceLocation } from "net.minecraft.util";
import { BlockPos } from "net.minecraft.util.math";
import { World } from "net.minecraft.world";
import { Biome } from "net.minecraft.world.biome";
import { Loader } from "net.minecraftforge.fml.common";

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

type OffsettableTileEntity = TileEntityPlaceable & {
	setOffset(x: number, y: number, z: number, sync: boolean): void;
};

type ResourceNameState = {
	color: number;
	setResourceName(modelName: string): void;
};

type ResourceStateTileEntity = TileEntity & {
	getResourceState(): ResourceNameState;
};

export class RTMApiCompat {
	/** 大文字を含むRTMモデルパック内パスを維持する。 */
	static createResourceLocation(
		domain: string,
		path: string,
	): ResourceLocation {
		return new ResourceLocationCustom(domain, path);
	}

	static isModLoaded(modid: string): boolean {
		return Loader.isModLoaded(modid);
	}

	static isFixRTM = Loader.isModLoaded("fix-rtm");

	static getRider(entity: EntityVehicle): Entity | null {
		const passengers = entity.getPassengers();
		return passengers.size() > 0 ? passengers.get(0) : null;
	}

	static getRidingEntity(entity: EntityVehicle): Entity | null {
		return entity.getRidingEntity();
	}

	static getWorld(entity: unknown): World {
		return (entity as Entity).world;
	}

	static dismountPlayer(entity: EntityVehicle): void {
		const rider = RTMApiCompat.getRider(entity);
		if (rider) RTMApiCompat.dismount(rider);
	}

	static dismount(entity: Entity): void {
		entity.dismountRidingEntity();
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
		BlockUtil.setBlock(
			world,
			x,
			y,
			z,
			block,
			metadata,
			notifyNeighbors ? 3 : 2,
		);
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
		return BlockUtil.getBlock(world, x, y, z);
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
		return BlockUtil.getMetadata(world, x, y, z);
	}

	static getTileEntity(
		world: World,
		x: number,
		y: number,
		z: number,
	): TileEntity | null {
		return world.getTileEntity(
			new BlockPos(Math.floor(x), Math.floor(y), Math.floor(z)),
		);
	}

	static hasTileEntity(blockSet: BlockSet | null): boolean {
		if (!blockSet || !blockSet.block) return false;
		const block = blockSet.block;
		try {
			const tileEntityProvider =
				Packages.net.minecraft.block.ITileEntityProvider;
			if (block instanceof tileEntityProvider) return true;
			return block.hasTileEntity(
				block.getStateFromMeta(blockSet.metadata),
			);
		} catch (err) {
			NGTLog.debug(
				"[NGTO Builder] hasTileEntity Error: " + block + " -> " + err,
			);
			return false;
		}
	}

	static setResourceName(tileEntity: TileEntity, modelName: string): void {
		const resourceState = (
			tileEntity as ResourceStateTileEntity
		).getResourceState();
		resourceState.setResourceName(modelName);
		// 1.12ではState.Colorがないと0（黒）として読み込まれる。
		// スクリプトから設置するモデル付き設置物は白で統一する。
		resourceState.color = 0xffffff;
	}

	static setPos(
		tileEntity: TileEntity,
		x: number,
		y: number,
		z: number,
	): void {
		tileEntity.setPos(new BlockPos(x, y, z));
	}

	static getItemStackAt(
		inventory: InventoryPlayer,
		index: number,
	): ItemStack | null {
		return inventory.mainInventory.get(index);
	}

	static getInventorySize(inventory: InventoryPlayer): number {
		return inventory.mainInventory.size();
	}

	static doFollowing(entity: unknown, hostPlayer: unknown): void {
		const followEntity = entity as Entity | null;
		const hostEntity = hostPlayer as Entity | null;
		if (!followEntity || !hostEntity) return;
		const x = hostEntity.posX;
		const y = hostEntity.posY + 3;
		const z = hostEntity.posZ;
		followEntity.setPosition(x, y, z);
		followEntity.motionX = 0;
		followEntity.motionY = 0;
		followEntity.motionZ = 0;
	}

	static startRiding(entity: unknown, targetEntity: unknown): void {
		void entity;
		void targetEntity;
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

	static getSubType(itemStack: ItemStack): string {
		return (itemStack.getItem() as ItemWithModel).getModelState(itemStack)
			.type.subType;
	}

	static getItemDamage(itemStack: ItemStack): number {
		return itemStack.getItemDamage();
	}

	static getBlockAir(): Block {
		return Blocks.AIR;
	}

	static getBlockStone(): Block {
		return Blocks.STONE;
	}

	static getBlockGrass(): Block {
		return Blocks.GRASS;
	}

	static getBlockDirt(): Block {
		return Blocks.DIRT;
	}

	static getBlockSnowLayer(): Block {
		return Blocks.SNOW_LAYER;
	}

	static getBlockSnow(): Block {
		return Blocks.SNOW;
	}

	static isLeaves(world: World, x: number, y: number, z: number): boolean {
		const pos = new BlockPos(Math.floor(x), Math.floor(y), Math.floor(z));
		const state = world.getBlockState(pos);
		return state.getBlock().isLeaves(state, world, pos);
	}

	static canPlaceSnow(
		world: World,
		x: number,
		y: number,
		z: number,
	): boolean {
		return Blocks.SNOW_LAYER.canPlaceBlockAt(
			world,
			new BlockPos(Math.floor(x), Math.floor(y), Math.floor(z)),
		);
	}

	static getBiomeId(world: World, x: number, z: number): number {
		const chunk = world.getChunk(Math.floor(x) >> 4, Math.floor(z) >> 4);
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
		const chunk = world.getChunk(Math.floor(x) >> 4, Math.floor(z) >> 4);
		chunk.getBiomeArray()[
			((Math.floor(z) & 15) << 4) | (Math.floor(x) & 15)
		] = biomeId;
		chunk.markDirty();
	}

	static getSnowyBiomeId(): number {
		return Biome.getIdForBiome(Biomes.ICE_PLAINS);
	}

	static getPlainsBiomeId(): number {
		return Biome.getIdForBiome(Biomes.PLAINS);
	}

	static syncBiomeChunk(world: World, chunkX: number, chunkZ: number): void {
		const packet: Packet<any> = new SPacketChunkData(
			world.getChunk(chunkX, chunkZ),
			65535,
		);
		for (let i = 0; i < world.playerEntities.size(); i++) {
			const player = world.playerEntities.get(i);
			if (player instanceof EntityPlayerMP)
				player.connection.sendPacket(packet);
		}
	}

	static setOffset(
		tileEntity: TileEntityPlaceable,
		x: number,
		y: number,
		z: number,
		sync: boolean,
	): void {
		if (RTMApiCompat.isFixRTM)
			(tileEntity as OffsettableTileEntity).setOffset(x, y, z, sync);
	}

	static setWireConnection(
		tileEntity: TileEntityInsulator,
		targetPos: Pos,
		wireStack: ItemStack,
	): void {
		if (wireStack.getItem() !== RTMItem.itemWire) return;
		const sx = Math.floor(tileEntity.getX());
		const sy = Math.floor(tileEntity.getY());
		const sz = Math.floor(tileEntity.getZ());
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
		const resourceState = (
			wireStack.getItem() as ItemWithModel
		).getModelState(wireStack);
		tileEntity.setConnectionTo(
			x,
			y,
			z,
			Connection.ConnectionType.WIRE,
			resourceState,
		);
	}

	static getModelNameFromItem(itemStack: ItemStack): string {
		const item = itemStack.getItem();
		if (item instanceof ItemInstalledObject) {
			const modelState = item.getModelState(itemStack);
			if (modelState) return modelState.getResourceName();
		}
		return "";
	}
}
