import { BlockSet, NGTObject, TileEntityPlaceable } from "jp.ngt.ngtlib.block";
import { TileEntityInsulator } from "jp.ngt.rtm.electric";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { RailMap, RailPosition } from "jp.ngt.rtm.rail.util";
import { Block } from "net.minecraft.block";
import { Entity } from "net.minecraft.entity";
import { InventoryPlayer } from "net.minecraft.entity.player";
import { ItemStack } from "net.minecraft.item";
import { NBTTagCompound } from "net.minecraft.nbt";
import { TileEntity } from "net.minecraft.tileentity";
import { ResourceLocation } from "net.minecraft.util";
import { World } from "net.minecraft.world";

export type Pos = [x: number, y: number, z: number];

export class RTMApiCompat {
	static createResourceLocation(
		domain: string,
		path: string,
	): ResourceLocation;
	static isModLoaded(modid: string): boolean;
	static getRider(entity: unknown): Entity | null;
	static getRidingEntity(entity: unknown): Entity | null;
	static getWorld(entity: unknown): World;
	static dismountPlayer(entity: unknown): void;
	static dismount(entity: unknown): void;
	static createNBTFromTileEntity(tileEntity: TileEntity): NBTTagCompound;
	static setBlock(
		world: World,
		x: number,
		y: number,
		z: number,
		block: Block,
		metadata: number,
		notifyNeighbors?: boolean,
	): void;
	static getBlock(
		world: World,
		x: number,
		y: number,
		z: number,
	): Block | null;
	static getMetadata(
		world: World,
		x: number,
		y: number,
		z: number,
	): number | null;
	static getTileEntity(
		world: World,
		x: number,
		y: number,
		z: number,
	): TileEntity | null;
	static hasTileEntity(blockSet: BlockSet | null): boolean;
	static setResourceName(tileEntity: TileEntity, modelName: string): void;
	static setPos(
		tileEntity: TileEntity,
		x: number,
		y: number,
		z: number,
	): void;
	static getItemStackAt(
		inventory: InventoryPlayer,
		index: number,
	): ItemStack | null;
	static getInventorySize(inventory: InventoryPlayer): number;
	static doFollowing(entity: unknown, hostPlayer: unknown): void;
	static startRiding(entity: unknown, targetEntity: unknown): void;
	static sendChatMessage(target: unknown, message: string): void;
	static getNGTObjectFromItemNBT(nbt: NBTTagCompound): NGTObject | null;
	static getRailPitch(railMap: RailMap, split: number, index: number): number;
	static getRailYaw(railMap: RailMap, split: number, index: number): number;
	static getCant(railMap: RailMap, split: number, index: number): number;
	static getHorizontalAnchorYaw(rp: RailPosition): number;
	static getHorizontalAnchorLength(rp: RailPosition): number;
	static getRPAnchorPitch(rp: RailPosition): number;
	static getSubType(itemStack: ItemStack): string;
	static getItemDamage(itemStack: ItemStack): number;
	static getBlockAir(): Block;
	static getBlockStone(): Block;
	static getBlockGrass(): Block;
	static getBlockDirt(): Block;
	static getBlockSnowLayer(): Block;
	static getBlockSnow(): Block;
	static isLeaves(world: World, x: number, y: number, z: number): boolean;
	static canPlaceSnow(world: World, x: number, y: number, z: number): boolean;
	static getBiomeId(world: World, x: number, z: number): number;
	static setBiomeId(
		world: World,
		x: number,
		z: number,
		biomeId: number,
	): void;
	static getSnowyBiomeId(): number;
	static getPlainsBiomeId(): number;
	static syncBiomeChunk(world: World, chunkX: number, chunkZ: number): void;
	static setOffset(
		tileEntity: TileEntityPlaceable,
		x: number,
		y: number,
		z: number,
		sync: boolean,
	): void;
	static setWireConnection(
		tileEntity: TileEntityInsulator,
		targetPos: Pos,
		wireStack: ItemStack,
	): void;
	static getModelNameFromItem(itemStack: ItemStack): string;
}
