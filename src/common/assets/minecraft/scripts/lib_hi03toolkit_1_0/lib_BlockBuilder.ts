import { HashMap } from "java.util";
import {
	BlockSet,
	TileEntityCustom,
	TileEntityPlaceable,
} from "jp.ngt.ngtlib.block";
import { TileEntityLargeRailBase } from "jp.ngt.rtm.rail";
import { Block, BlockDoor, BlockDoublePlant } from "net.minecraft.block";
import { Entity } from "net.minecraft.entity";
import { NBTTagCompound } from "net.minecraft.nbt";
import { TileEntity } from "net.minecraft.tileentity";
import { World } from "net.minecraft.world";
import { RTMApiCompat } from "@target/assets/minecraft/scripts/lib_hi03toolkit_1_0/lib_RTMApiCompat";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { ErrorLogger } from "./lib_ErrorLogger";

export type BlockSetPlacement = [
	blockSet: BlockSet,
	x: number,
	y: number,
	z: number,
	yaw: number,
];

export type Pos = [x: number, y: number, z: number];

//###  BlockBuilder  ###
/**
 * ブロックをまとめて設置するクラス
 * 引数のEntityはHashMapのキーとして使用
 */
export class BlockBuilder {
	private hashMap: HashMap<Entity, BlockSetPlacement[]>;
	private processed: HashMap<Entity, number>;

	constructor() {
		this.hashMap = new HashMap();
		this.processed = new HashMap();
	}

	/**
	 * ブロック設置が完了しているかどうかを判定する
	 * @param entity
	 * @returns
	 */
	isFinished(entity: Entity): boolean {
		const posList = this.get(entity);
		const processed = this.getProcessed(entity);
		return processed >= posList.length;
	}

	/**
	 * 残りのブロックの数を取得する
	 * @param entity
	 * @returns
	 */
	getCount(entity: Entity): number {
		const posList = this.get(entity);
		const processed = this.getProcessed(entity);
		return Math.max(0, posList.length - processed);
	}

	/**
	 * 指定座標のブロックを収集するUndo向け機能
	 * @param entity
	 * @param pos [x, y, z]
	 */
	addBackup(entity: Entity, pos: Pos): void {
		const posList = this.get(entity);
		const world = RTMApiCompat.getWorld(entity);
		const tileEntity = RTMApiCompat.getTileEntity(
			world,
			pos[0],
			pos[1],
			pos[2],
		);
		const block = RTMApiCompat.getBlock(world, pos[0], pos[1], pos[2]);
		const metadata = RTMApiCompat.getMetadata(world, pos[0], pos[1], pos[2]);
		if (block !== null && metadata !== null) {
			let nbt = null;
			let blockRotation = 0;
			if (tileEntity && !(tileEntity instanceof TileEntityLargeRailBase)) {
				if (block instanceof TileEntityPlaceable) blockRotation = block.getRotation();
				try {
					nbt = RTMApiCompat.createNBTFromTileEntity(tileEntity);
				} catch (error) {
					ErrorLogger.log("addBackup", "createNBTFromTileEntity", error, {
						world: world,
						tileEntity: tileEntity,
						pos: `[${pos[0]}, ${pos[1]}, ${pos[2]}]`,
					});
				}
			}
			const blockSet = !nbt
				? new BlockSet(block, metadata)
				: new BlockSet(block, metadata, nbt);
			posList.push([blockSet, pos[0], pos[1], pos[2], blockRotation]);
			this.set(entity, posList);
		}
	}

	/**
	 * 指定座標にブロックを追加する
	 * @param entity
	 * @param blockSet
	 * @param x
	 * @param y
	 * @param z
	 */
	add(
		entity: Entity,
		blockSet: BlockSet,
		x: number,
		y: number,
		z: number,
		yaw: number = 0,
	): void {
		const posList = this.get(entity);
		posList.push([blockSet, x, y, z, yaw]);
		this.set(entity, posList);
	}

	/**
	 * 複数の座標に同じブロックを追加する(塗りつぶし向け機能)
	 * @param entity
	 * @param blockSet
	 * @param posList [[x, y, z], ...]
	 */
	addAll(entity: Entity, blockSet: BlockSet, posList: Pos[]): void {
		posList.forEach(([x, y, z]: Pos): void => {
			this.add(entity, blockSet, x, y, z);
		});
	}

	addFromRotatableBlockObjectAt(
		entity: Entity,
		list: BlockSetPlacement[],
		isPlaceOnlyInAir: boolean = false,
	): void {
		const world = isPlaceOnlyInAir ? RTMApiCompat.getWorld(entity) : null;
		const airBlock = isPlaceOnlyInAir ? RTMApiCompat.getBlockAir() : null;
		const doublePlantPlacements: { [key: string]: BlockSetPlacement } = {};
		for (let i = 0; i < list.length; i++) {
			const placement = list[i];
			if (!placement || !(placement[0].block instanceof BlockDoublePlant))
				continue;
			const key = `${Math.floor(placement[1])},${Math.floor(placement[2])},${Math.floor(placement[3])}`;
			doublePlantPlacements[key] = placement;
		}
		for (let i = 0; i < list.length; i++) {
			const placeData = list[i];
			if (!placeData) continue;
			if (world && airBlock) {
				const blockSet = placeData[0];
				const x = Math.floor(placeData[1]);
				const y = Math.floor(placeData[2]);
				const z = Math.floor(placeData[3]);
				if (blockSet.block instanceof BlockDoublePlant) {
					const doublePlantBlock = blockSet.block as unknown as Block;
					const lowerY = (blockSet.metadata & 8) !== 0 ? y - 1 : y;
					const upperY = lowerY + 1;
					const lowerData = doublePlantPlacements[`${x},${lowerY},${z}`];
					const upperData = doublePlantPlacements[`${x},${upperY},${z}`];
					if (
						!lowerData ||
						!upperData ||
						lowerData[0].block !== doublePlantBlock ||
						upperData[0].block !== doublePlantBlock ||
						(lowerData[0].metadata & 8) !== 0 ||
						(upperData[0].metadata & 8) === 0 ||
						RTMApiCompat.getBlock(world, x, lowerY, z) !== airBlock ||
						RTMApiCompat.getBlock(world, x, upperY, z) !== airBlock
					)
						continue;
				}
				if (RTMApiCompat.getBlock(world, x, y, z) !== airBlock) continue;
				if (
					blockSet.block instanceof BlockDoor &&
					blockSet.metadata < 8 &&
					RTMApiCompat.getBlock(world, x, y + 1, z) !== airBlock
				)
					continue;
			}
			this.add(
				entity,
				placeData[0],
				placeData[1],
				placeData[2],
				placeData[3],
				placeData[4],
			);
		}
	}

	/**
	 * ブロックのリストをクリアする
	 * @param entity
	 */
	clear(entity: Entity): void {
		this.set(entity, []);
		this.setProcessed(entity, 0);
	}

	/**
	 * ブロックを生成する
	 * 終了するまで実行し続ける必要があるため、完了しているかどうかはisFinishedで判定する
	 * @param entity
	 * @param buildLimit 1tickあたりのブロック生成数
	 */
	doBuild(entity: Entity, buildLimit: number): void {
		if (buildLimit <= 0) return;
		const world = RTMApiCompat.getWorld(entity);
		const posList = this.get(entity);
		let processed = this.getProcessed(entity);
		if (processed >= posList.length) {
			this.clear(entity);
			return;
		}
		const end = Math.min(processed + buildLimit, posList.length);
		const doublePlantPlacements: { [key: string]: BlockSetPlacement } = {};
		for (let i = 0; i < posList.length; i++) {
			const placement = posList[i];
			if (!placement || !(placement[0].block instanceof BlockDoublePlant))
				continue;
			const key = `${Math.floor(placement[1])},${Math.floor(placement[2])},${Math.floor(placement[3])}`;
			doublePlantPlacements[key] = placement;
		}
		for (let i = processed; i < end; i++) {
			const data = posList[i];
			if (!data) continue;
			const blockSet = data[0];
			const block = blockSet.block;
			const metadata = blockSet.metadata;
			if (blockSet.block instanceof BlockDoor && metadata >= 8) continue; // ドア上部はスキップ
			const x = Math.floor(data[1]);
			const y = Math.floor(data[2]);
			const z = Math.floor(data[3]);
			const blockRotation = data[4];
			const replaceBlock = RTMApiCompat.getBlock(world, x, y, z);
			const replaceBlockMeta = RTMApiCompat.getMetadata(world, x, y, z);
			if (replaceBlock === block && replaceBlockMeta === metadata) continue;
			const tile = RTMApiCompat.getTileEntity(world, x, y, z);
			if (tile instanceof TileEntityLargeRailBase) continue;
			if (block instanceof BlockDoublePlant) {
				// RTM向け型定義ではBlockDoublePlantのBlock継承情報が欠けている。
				const doublePlantBlock = block as unknown as Block;
				const isUpper = (metadata & 8) !== 0;
				const lowerY = isUpper ? y - 1 : y;
				const upperY = lowerY + 1;
				const lowerData = doublePlantPlacements[`${x},${lowerY},${z}`];
				const upperData = doublePlantPlacements[`${x},${upperY},${z}`];
				if (
					lowerData &&
					upperData &&
					lowerData[0].block === doublePlantBlock &&
					upperData[0].block === doublePlantBlock &&
					(lowerData[0].metadata & 8) === 0 &&
					(upperData[0].metadata & 8) !== 0
				) {
					// 1.12では下段だけを通常更新付きで置くと、上段不足として即座に破壊される。
					RTMApiCompat.setBlock(
						world,
						x,
						lowerY,
						z,
						doublePlantBlock,
						lowerData[0].metadata,
						false,
					);
					RTMApiCompat.setBlock(
						world,
						x,
						upperY,
						z,
						doublePlantBlock,
						upperData[0].metadata,
					);
					continue;
				}
				// 不完全な2段植物は上側または下側だけを残すため、単独では設置しない。
				continue;
			}
			// ブロックを設置
			RTMApiCompat.setBlock(world, x, y, z, block, metadata);
			if (block instanceof BlockDoor) {
				const upsideMetadata = 8;
				RTMApiCompat.setBlock(
					world,
					x,
					y + 1,
					z,
					block as unknown as Block,
					upsideMetadata,
				);
			}
			if (RTMApiCompat.hasTileEntity(blockSet)) {
				let tileEntity: TileEntity | null = null;
				try {
					tileEntity = RTMApiCompat.getTileEntity(world, x, y, z);
					if (tileEntity) {
						BlockBuilder.setTileEntityData(
							tileEntity,
							blockSet,
							x,
							y,
							z,
							blockRotation,
							entity,
							world,
						);
					} else {
						BlockBuilder.logTileEntityError(
							"getTileEntity (tile entity was null)",
							null,
							entity,
							world,
							tileEntity,
							blockSet,
							x,
							y,
							z,
							blockRotation,
						);
					}
				} catch (e) {
					BlockBuilder.logTileEntityError(
						"getTileEntity/call setTileEntityData",
						e,
						entity,
						world,
						tileEntity,
						blockSet,
						x,
						y,
						z,
						blockRotation,
					);
				}
			}
		}
		processed = end;
		if (processed >= posList.length) {
			this.clear(entity);
		} else {
			this.setProcessed(entity, processed);
		}
	}

	get(entity: Entity): BlockSetPlacement[] {
		return this.hashMap.get(entity) || [];
	}

	set(entity: Entity, posList: BlockSetPlacement[]): void {
		this.hashMap.put(entity, posList);
	}

	getProcessed(entity: Entity): number {
		return this.processed.get(entity) || 0;
	}

	setProcessed(entity: Entity, processed: number): void {
		this.processed.put(entity, processed);
	}

	static setTileEntityData(
		tile: TileEntity,
		blockSet: BlockSet,
		x: number,
		y: number,
		z: number,
		yaw: number,
		entity?: Entity,
		world?: World,
	): void {
		if (y < 0 || y >= 256) {
			NGTLog.debug("Skip TileEntity NBT: invalid y=" + y);
			return;
		}

		let phase = "read blockSet.nbt";
		try {
			const nbt = blockSet.nbt;
			let prevX = 0;
			let prevY = 0;
			let prevZ = 0;
			if (nbt) {
				phase = "copy NBT";
				const _nbt = nbt.copy() as NBTTagCompound;
				phase = "read previous NBT position";
				prevX = _nbt.getInteger("x");
				prevY = _nbt.getInteger("y");
				prevZ = _nbt.getInteger("z");
				phase = "write target NBT position";
				_nbt.setInteger("x", x);
				_nbt.setInteger("y", y);
				_nbt.setInteger("z", z);

				phase = "tile.readFromNBT";
				tile.readFromNBT(_nbt);

				phase = "setResourceName";
				RTMApiCompat.setResourceName(tile, _nbt.getString("ModelName")); //1.12専用
			}
			if (tile instanceof TileEntityCustom) {
				phase = "TileEntityCustom.setPos";
				//RTM側のsetPos
				tile.setPos(x, y, z, prevX, prevY, prevZ);
			} else {
				phase = "Minecraft TileEntity.setPos";
				//Minecraft側のsetPos
				RTMApiCompat.setPos(tile, x, y, z);
			}
			if (tile instanceof TileEntityPlaceable) {
				phase = "TileEntityPlaceable.getRotation";
				const rotation = tile.getRotation() + yaw;
				phase = "TileEntityPlaceable.setRotation";
				tile.setRotation(rotation, true);
			}
		} catch (e) {
			BlockBuilder.logTileEntityError(
				phase,
				e,
				entity,
				world,
				tile,
				blockSet,
				x,
				y,
				z,
				yaw,
			);
		}
	}

	private static logTileEntityError(
		phase: string,
		error: any,
		entity: Entity | undefined,
		world: World | undefined,
		tileEntity: TileEntity | null,
		blockSet: BlockSet,
		x: number,
		y: number,
		z: number,
		blockRotation: number,
	): void {
		ErrorLogger.log("setTileEntityData", phase, error, {
			side: world ? (world.isRemote ? "CLIENT" : "SERVER") : "UNKNOWN",
			entity: entity,
			entityId: ErrorLogger.capture(() =>
				entity ? entity.getEntityId() : "unknown",
			),
			world: world,
			tileEntity: tileEntity,
			block: ErrorLogger.capture(() => blockSet.block),
			blockId: ErrorLogger.capture(() =>
				Block.getIdFromBlock(blockSet.block),
			),
			metadata: ErrorLogger.capture(() => blockSet.metadata),
			blockSet: blockSet,
			nbt: ErrorLogger.capture(() => blockSet.nbt),
			pos: `[${x}, ${y}, ${z}]`,
			blockRotation: blockRotation,
		});
	}
}
