import { ArrayList, HashMap, IdentityHashMap, List } from "java.util";
import { BlockSet, NGTObject } from "jp.ngt.ngtlib.block";
import { DataMap } from "jp.ngt.rtm.modelpack.state";
import { Block } from "net.minecraft.block";
import { Entity } from "net.minecraft.entity";
import { EntityPlayer } from "net.minecraft.entity.player";
import { ItemStack } from "net.minecraft.item";
import { NBTTagCompound } from "net.minecraft.nbt";
import { RTMApiCompat } from "@target/assets/minecraft/scripts/lib_hi03toolkit_1_0/lib_RTMApiCompat";
import { World } from "net.minecraft.world";
import { RailMap, RailPosition } from "jp.ngt.rtm.rail.util";
import {
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
	TileEntityLargeRailSwitchCore,
} from "jp.ngt.rtm.rail";
import { Vec3 } from "jp.ngt.ngtlib.math";
import { RotatableBlockObject } from "./lib_RotatableBlockObject";
import { RotatableBlockObjectMapper } from "./lib_RotatableBlockObjectMapper";
import { RotatableBlockSet } from "./lib_RotatableBlockSet";
import { Class } from "java.lang";
import { Method } from "java.lang.reflect";

export type Pos = [x: number, y: number, z: number];

export type combineNGTOList =
	| [ngto: NGTObject, offsetX: number, offsetY: number, offsetZ: number]
	| null;

//### NGTOBuilderUtil ###
/**
 * 便利機能を提供するユーティリティクラス
 */
export class NGTOBuilderUtil {
	private static ngtoCache: HashMap<NBTTagCompound | string, NGTObject> =
		new HashMap();
	private static ngtoIdentityMap: IdentityHashMap<NGTObject, number> =
		new IdentityHashMap();
	private static nextNGTOIdentity = 1;

	/**
	 * プレイヤーが手に持っているミニチュアブロックからNGTOを取得する
	 * @param player
	 * @returns NGTO。取得できない場合はnull
	 */
	static getHeldNGTO(player: EntityPlayer): NGTObject | null {
		const currrentItem = NGTOBuilderUtil.getHeldItem(player);
		if (currrentItem) {
			const nbt = currrentItem.getTagCompound();
			const cachedNGTO = this.ngtoCache.get(nbt);
			if (cachedNGTO) return cachedNGTO;
			if (nbt && nbt.hasKey("BlocksData")) {
				const ngto = RTMApiCompat.getNGTObjectFromItemNBT(nbt);
				if (ngto) {
					this.ngtoCache.put(nbt, ngto);
					return ngto;
				}
			}
		}
		return null;
	}

	/**
	 * プレイヤーのインベントリ内のすべてのミニチュアブロックからNGTOを取得する
	 * @param player
	 * @returns NGTOの配列。ない場合はnullが入る(indexがインベントリに対応する)
	 */
	static getAllInventoryNGTOs(player: EntityPlayer): (NGTObject | null)[] {
		const inventory = player.inventory;
		const ngtoList: (NGTObject | null)[] = [];
		for (let i = 0; i < RTMApiCompat.getInventorySize(inventory); i++) {
			const itemStack = RTMApiCompat.getItemStackAt(inventory, i);
			if (itemStack) {
				const nbt = itemStack.getTagCompound();
				if (nbt && nbt.hasKey("BlocksData")) {
					const cachedNGTO = this.ngtoCache.get(nbt);
					if (cachedNGTO) {
						ngtoList.push(cachedNGTO);
						continue;
					} else if (nbt && nbt.hasKey("BlocksData")) {
						const ngto = RTMApiCompat.getNGTObjectFromItemNBT(nbt);
						if (ngto) {
							this.ngtoCache.put(nbt, ngto);
							ngtoList.push(ngto);
							continue;
						}
					}
				} else ngtoList.push(null);
			} else ngtoList.push(null);
		}
		return ngtoList;
	}

	/**
	 * プレイヤーが手に持っているアイテムを取得する
	 * @param player
	 * @returns アイテムスタック。取得できない場合はnull
	 */
	static getHeldItem(player: EntityPlayer): ItemStack | null {
		const inventory = player.inventory;
		const index = inventory.currentItem;
		return RTMApiCompat.getItemStackAt(inventory, index);
	}

	/**
	 * プレイヤーが手に持っているブロックのBlockSetを取得する
	 * @param player
	 * @returns ブロックセット。取得できない場合はnull
	 */
	static getHeldBlockSet(player: EntityPlayer): BlockSet | null {
		const itemStack = this.getHeldItem(player);
		if (itemStack) {
			const itemBlock = Block.getBlockFromItem(itemStack.getItem());
			if (itemBlock instanceof Block) {
				const itemMetadata = RTMApiCompat.getItemDamage(itemStack);
				const itemNBT = itemStack.getTagCompound();
				return new BlockSet(itemBlock, itemMetadata, itemNBT);
			}
		}
		return null;
	}

	/**
	 * RotatableBlockObjectからNGTOを作成する
	 * 範囲内でリストにない座標は空気ブロックで満たされる
	 * @param rbo
	 * @returns
	 */
	static createNGTOWithRotatableBlockObject(
		src: RotatableBlockObject,
	): NGTObject {
		const rbo = src.copy();
		RotatableBlockObjectMapper.toBlockCoordSelf(rbo);
		rbo.calcSize();
		const minX = rbo.minX;
		const minY = rbo.minY;
		const minZ = rbo.minZ;
		const maxX = rbo.maxX;
		const maxY = rbo.maxY;
		const maxZ = rbo.maxZ;
		// 最小座標が0になるように補正
		const offsetX = -minX;
		const offsetY = -minY;
		const offsetZ = -minZ;

		const width = maxX - minX + 1;
		const height = maxY - minY + 1;
		const depth = maxZ - minZ + 1;

		const total = width * height * depth;
		const list: List<BlockSet> = new ArrayList<BlockSet>();
		// まず全部AIRで埋める
		for (let i = 0; i < total; i++) {
			list.add(BlockSet.AIR);
		}
		// rbsにあるブロックで上書き
		for (let i = 0; i < rbo.blockSetList.length; i++) {
			const rbs = rbo.blockSetList[i];
			if (!rbs) continue;
			const x = rbs.local_x + offsetX;
			const y = rbs.local_y + offsetY;
			const z = rbs.local_z + offsetZ;
			//範囲外はスキップ
			if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth)
				continue;
			const index = (x * height + y) * depth + z;
			const nbt = rbs.blockSet.writeToNBT();
			if (nbt) rbs.yaw = nbt.getFloat("Yaw");
			list.set(index, rbs.blockSet);
		}
		return NGTObject.createNGTO(
			list,
			width,
			height,
			depth,
			Math.floor(width / 2),
			0,
			Math.floor(depth / 2),
		);
	}

	static sliceByZ(
		ngto: NGTObject,
		isPlaceAirBlock: boolean,
	): RotatableBlockObject[] {
		const rboList: RotatableBlockObject[] = [];
		for (let zIdx = 0; zIdx < ngto.zSize; zIdx++) {
			const sliceRBO = new RotatableBlockObject();
			for (let yIdx = 0; yIdx < ngto.ySize; yIdx++) {
				let layerCount = 0;
				for (let xIdx = 0; xIdx < ngto.xSize; xIdx++) {
					const blockSet = ngto.getBlockSet(xIdx, yIdx, zIdx);
					if (!isPlaceAirBlock && Block.getIdFromBlock(blockSet.block) === 0)
						continue;
					const rbs = new RotatableBlockSet(blockSet, xIdx, yIdx, 0);
					const nbt = blockSet.writeToNBT();
					if (nbt) rbs.yaw = nbt.getFloat("Yaw");
					sliceRBO.blockSetList.push(rbs);
					layerCount++;
				}
			}
			sliceRBO.calcSize();
			rboList.push(sliceRBO);
		}
		return rboList;
	}

	/**
	 * BlockSetと相対座標リストからNGTOを作成する
	 * 範囲内でリストにない座標は空気ブロックで満たされる
	 * @param blockSet
	 * @param relativePosList 相対座標リスト [[x, y, z], ...]
	 */
	static createNGTOWithPosList(
		blockSet: BlockSet,
		relativePosList: Pos[],
	): NGTObject {
		if (relativePosList.length === 0) relativePosList = [[0, 0, 0]];
		let minX = relativePosList[0][0];
		let minY = relativePosList[0][1];
		let minZ = relativePosList[0][2];
		let maxX = relativePosList[0][0];
		let maxY = relativePosList[0][1];
		let maxZ = relativePosList[0][2];
		//relativePosListから必要サイズを計算
		for (let i = 0; i < relativePosList.length; i++) {
			const pos = relativePosList[i];
			const x = pos[0];
			const y = pos[1];
			const z = pos[2];
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (z < minZ) minZ = z;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
			if (z > maxZ) maxZ = z;
		}
		// 最小座標が0になるように補正
		const offsetX = -minX;
		const offsetY = -minY;
		const offsetZ = -minZ;

		const width = maxX - minX + 1;
		const height = maxY - minY + 1;
		const depth = maxZ - minZ + 1;

		const total = width * height * depth;
		const list: List<BlockSet> = new ArrayList<BlockSet>();
		// まず全部AIRで埋める
		for (let i = 0; i < total; i++) {
			list.add(BlockSet.AIR);
		}
		// relativePosListにある座標だけblockSetで上書き
		for (let i = 0; i < relativePosList.length; i++) {
			const pos = relativePosList[i];
			const x = pos[0] + offsetX;
			const y = pos[1] + offsetY;
			const z = pos[2] + offsetZ;
			//範囲外はスキップ
			if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth)
				continue;
			const index = (x * height + y) * depth + z;
			list.set(index, blockSet);
		}
		return NGTObject.createNGTO(
			list,
			width,
			height,
			depth,
			Math.floor(width / 2),
			0,
			Math.floor(depth / 2),
		);
	}

	/**
	 * NGTOをキャッシュする
	 * @param entity
	 * @param key
	 * @param ngto
	 */
	static setNGTOCache(entity: Entity, key: string, ngto: NGTObject): void {
		this.ngtoCache.put(`${entity.getEntityId()}_${key}`, ngto);
	}

	/**
	 * キャッシュされたNGTOを取得する
	 * @param entity
	 * @param key
	 * @returns
	 */
	static getNGTOCache(entity: Entity, key: string): NGTObject | null {
		const cached = this.ngtoCache.get(`${entity.getEntityId()}_${key}`);
		if (cached) return cached;
		return null;
	}

	/**
	 * 連想配列/配列をJson文字列に変換してdataMapを経由してサーバー/クライアント側に送る
	 * @param dataMap
	 * @param key
	 * @param object 連想配列もしくは配列
	 * @param flag DataMapの同期・保存フラグ
	 */
	static sendJsonData(
		dataMap: DataMap,
		key: string,
		object: object,
		flag = 1,
	): void {
		// const json = JSON.stringify(object).replace(/,/g, "☆");
		const json = JSON.stringify(object).split(",").join("\u2606");
		const val = dataMap.getString(key);
		if (val !== json) dataMap.setString(key, json, flag);
	}

	/**
	 * 送られてきたJson文字列を連想配列/配列に変換して取得する
	 * @param dataMap
	 * @param key
	 * @returns
	 */
	static getJsonData<T>(dataMap: DataMap, key: string): T | null {
		// const data = dataMap.getString(key).replace(/☆/g, ",");
		const data = dataMap.getString(key).split("\u2606").join(",");
		if (data === "") return null;
		try {
			return JSON.parse(data);
		} catch (e) {
			return null;
		}
	}

	/**
	 * dataMapに保存されているJson文字列をリセットする（空文字にする）
	 * @param dataMap
	 * @param key
	 */
	static resetJsonData(dataMap: DataMap, key: string): void {
		const data = dataMap.getString(key);
		if (data !== "") dataMap.setString(key, "", 1);
	}

	/**
	 * NGTOを指定したオフセット分だけ移動した新しいNGTOを返す
	 * @param ngto オフセットを加えるNGTO
	 * @param offsetX
	 * @param offsetY
	 * @param offsetZ
	 * @returns
	 */
	static offsetNGTO(
		ngto: NGTObject,
		offsetX: number,
		offsetY: number,
		offsetZ: number,
	): NGTObject {
		const oldW = ngto.xSize;
		const oldH = ngto.ySize;
		const oldD = ngto.zSize;

		const minX = Math.min(0, offsetX);
		const minY = Math.min(0, offsetY);
		const minZ = Math.min(0, offsetZ);

		const newW = oldW + Math.abs(offsetX);
		const newH = oldH + Math.abs(offsetY);
		const newD = oldD + Math.abs(offsetZ);

		const total = newW * newH * newD;
		const list: List<BlockSet> = new ArrayList<BlockSet>();
		for (let i = 0; i < total; i++) {
			list.add(BlockSet.AIR);
		}

		for (let x = 0; x < oldW; x++) {
			for (let y = 0; y < oldH; y++) {
				for (let z = 0; z < oldD; z++) {
					const blockSet = ngto.getBlockSet(x, y, z);
					const nx = x + offsetX - minX;
					const ny = y + offsetY - minY;
					const nz = z + offsetZ - minZ;
					if (
						nx < 0 ||
						nx >= newW ||
						ny < 0 ||
						ny >= newH ||
						nz < 0 ||
						nz >= newD
					)
						continue;
					const index = (nx * newH + ny) * newD + nz;
					list.set(index, blockSet);
				}
			}
		}

		const anchorX = Math.floor(newW / 2);
		const anchorY = 0;
		const anchorZ = Math.floor(newD / 2);
		return NGTObject.createNGTO(
			list,
			newW,
			newH,
			newD,
			anchorX,
			anchorY,
			anchorZ,
		);
	}

	/**
	 * 複数のNGTOをオフセット付きで結合して新しいNGTOを作成する
	 * @param ngtoList
	 * @returns
	 */
	static combineNGTO(ngtoList: combineNGTOList[]): NGTObject {
		//[[ngto, offsetX, offsetY, offsetZ], ...]
		if (ngtoList.length === 0)
			return NGTOBuilderUtil.createNGTOWithPosList(BlockSet.AIR, [[0, 0, 0]]);

		// 結合後の境界を計算
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let minZ = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		let maxZ = Number.NEGATIVE_INFINITY;

		for (let i = 0; i < ngtoList.length; i++) {
			const entry = ngtoList[i];
			if (!entry) continue;
			const ngto = entry[0];
			const offsetX = entry[1];
			const offsetY = entry[2];
			const offsetZ = entry[3];
			if (!ngto) continue;
			minX = Math.min(minX, offsetX);
			minY = Math.min(minY, offsetY);
			minZ = Math.min(minZ, offsetZ);
			maxX = Math.max(maxX, offsetX + ngto.xSize - 1);
			maxY = Math.max(maxY, offsetY + ngto.ySize - 1);
			maxZ = Math.max(maxZ, offsetZ + ngto.zSize - 1);
		}

		const newW = Math.max(1, Math.floor(maxX - minX + 1));
		const newH = Math.max(1, Math.floor(maxY - minY + 1));
		const newD = Math.max(1, Math.floor(maxZ - minZ + 1));

		const total = newW * newH * newD;
		const list: List<BlockSet> = new ArrayList<BlockSet>();
		for (let i = 0; i < total; i++) list.add(BlockSet.AIR);

		// 各NGTOのブロックを新しいリストにコピー
		for (let i = 0; i < ngtoList.length; i++) {
			const entry = ngtoList[i];
			if (!entry) continue;
			const ngto = entry[0];
			const offsetX = entry[1];
			const offsetY = entry[2];
			const offsetZ = entry[3];
			if (!ngto) continue;
			for (let x = 0; x < ngto.xSize; x++) {
				for (let y = 0; y < ngto.ySize; y++) {
					for (let z = 0; z < ngto.zSize; z++) {
						const bs = ngto.getBlockSet(x, y, z);
						const tx = offsetX + x - minX;
						const ty = offsetY + y - minY;
						const tz = offsetZ + z - minZ;
						if (
							tx < 0 ||
							tx >= newW ||
							ty < 0 ||
							ty >= newH ||
							tz < 0 ||
							tz >= newD
						)
							continue;
						const index = (tx * newH + ty) * newD + tz;
						list.set(index, bs);
					}
				}
			}
		}

		const anchorX = Math.floor(newW / 2);
		const anchorY = 0;
		const anchorZ = Math.floor(newD / 2);
		return NGTObject.createNGTO(
			list,
			newW,
			newH,
			newD,
			anchorX,
			anchorY,
			anchorZ,
		);
	}

	/**
	 * NGTOのハッシュを計算する。NGTOのサイズから計算する簡易的なハッシュ関数で、同じサイズのNGTOは同じハッシュになる。
	 * @param ngto
	 * @returns
	 */
	static getNGTOHash(ngto: NGTObject): number {
		return (
			((ngto.xSize & 0x3ff) << 20) |
			((ngto.ySize & 0x3ff) << 10) |
			(ngto.zSize & 0x3ff)
		);
	}

	/**
	 * NGTOを描画キャッシュ内で識別するキーを返す。
	 * 同じ寸法でも内容が異なるNGTOを区別するため、オブジェクトの識別値を含める。
	 */
	static getNGTOCacheKey(ngto: NGTObject): string {
		let identity = this.ngtoIdentityMap.get(ngto);
		if (!identity) {
			identity = this.nextNGTOIdentity++;
			this.ngtoIdentityMap.put(ngto, identity);
		}
		return `${identity}:${this.getNGTOHash(ngto)}`;
	}

	//小数点を含む座標を与えること(ブロック座標だとズレます)
	static getRailMapAt(
		entity: Entity,
		posX: number,
		posY: number,
		posZ: number,
	): RailMap | null {
		const world = RTMApiCompat.getWorld(entity);
		const tile = RTMApiCompat.getTileEntity(world, posX, posY, posZ);
		let railMap = null;
		if (tile instanceof TileEntityLargeRailBase) {
			const core = tile.getRailCore();
			if (core) {
				if (core instanceof TileEntityLargeRailSwitchCore) {
					//分岐器上
					let distance = Infinity;
					const railMapList = core.getAllRailMaps();
					for (let i = 0; i < railMapList.length; i++) {
						const rm = railMapList[i];
						const split = Math.floor(rm.getLength() * 2);
						const nearestIdx = rm.getNearlestPoint(split, posX, posZ);
						const posZX = rm.getRailPos(split, nearestIdx);
						const vec = new Vec3(posZX[1] - posX, 0, posZX[0] - posZ);
						const len = vec.length();
						if (len < distance) {
							distance = len;
							railMap = rm;
						}
					}
				} else {
					//通常レール
					railMap = core.getRailMap(entity);
				}
			}
		}
		if (railMap) return railMap;
		return null;
	}

	static isConnectedRail(railMap1: RailMap, railMap2: RailMap) {
		const rm1StartRP = railMap1.getStartRP();
		const rm1EndRP = railMap1.getEndRP();
		const rm2StartRP = railMap2.getStartRP();
		const rm2EndRP = railMap2.getEndRP();
		const connectPos1 = NGTOBuilderUtil.getConnectPos(rm1StartRP);
		const connectPos2 = NGTOBuilderUtil.getConnectPos(rm1EndRP);
		const rm2SPos: Pos = [
			rm2StartRP.blockX,
			rm2StartRP.blockY,
			rm2StartRP.blockZ,
		];
		const rm2EPos: Pos = [rm2EndRP.blockX, rm2EndRP.blockY, rm2EndRP.blockZ];
		if (
			connectPos1 &&
			(NGTOBuilderUtil.isSamePos(connectPos1, rm2SPos) ||
				NGTOBuilderUtil.isSamePos(connectPos1, rm2EPos))
		) {
			return true;
		}
		if (
			connectPos2 &&
			(NGTOBuilderUtil.isSamePos(connectPos2, rm2SPos) ||
				NGTOBuilderUtil.isSamePos(connectPos2, rm2EPos))
		) {
			return true;
		}
		return false;
	}

	static getConnectPos(railPos: RailPosition): Pos | null {
		if (
			!railPos ||
			railPos.direction === null ||
			railPos.direction === undefined
		)
			return null;
		return [
			Math.floor(
				railPos.blockX + 0.5 + RailPosition.REVISION[railPos.direction][0] * 2,
			),
			railPos.blockY,
			Math.floor(
				railPos.blockZ + 0.5 + RailPosition.REVISION[railPos.direction][1] * 2,
			),
		];
	}

	static isSamePos(pos1: Pos, pos2: Pos): boolean {
		return (
			Math.floor(pos1[0]) === Math.floor(pos2[0]) &&
			Math.floor(pos1[1]) === Math.floor(pos2[1]) &&
			Math.floor(pos1[2]) === Math.floor(pos2[2])
		);
	}

	static getRailCoreFromRailMap(
		world: World,
		railMap: RailMap,
	): TileEntityLargeRailCore | null {
		const startRP = railMap.getStartRP();
		const tile = RTMApiCompat.getTileEntity(
			world,
			startRP.blockX,
			startRP.blockY,
			startRP.blockZ,
		);
		if (tile instanceof TileEntityLargeRailBase) {
			const core = tile.getRailCore();
			if (core) return core;
		}
		return null;
	}

	static fromJavaObjectArray<T>(array: JavaObjectArray<T>): T[] {
		const result: T[] = [];
		for (let i = 0; i < array.length; i++) {
			result.push(array[i]);
		}
		return result;
	}

	/**
	 *
	 * @param array
	 * @param componentClass
	 * @returns
	 */
	static toJavaObjectArray<T>(
		array: T[],
		componentClass: java.lang.Class,
	): JavaObjectArray<T> {
		const javaArray = java.lang.reflect.Array.newInstance(
			componentClass,
			array.length,
		) as unknown as JavaObjectArray<T>;
		for (let i = 0; i < array.length; i++) {
			javaArray[i] = array[i];
		}
		return javaArray;
	}

	static findMethod(
		clazz: Class,
		names: string[],
		paramTypes: Class[] = [],
	): Method | null {
		if (!clazz || !names || names.length === 0) return null;
		let current: Class | null = clazz;
		while (current) {
			for (let i = 0; i < names.length; i++) {
				const name = names[i];
				try {
					const method = current.getDeclaredMethod(
						name,
						Java.to(paramTypes, "java.lang.Class[]"),
					);
					method.setAccessible(true);
					return method;
				} catch (e) {
					// 次の候補名を試す
				}
			}
			try {
				current = current.getSuperclass();
			} catch (e) {
				current = null;
			}
		}
		return null;
	}
}
