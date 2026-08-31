import { HashMap } from "java.util";
import { Entity } from "net.minecraft.entity";

export type Pos = [x: number, y: number, z: number];

//###  PositionCollector  ###
/**
 * 複数の座標を保存するクラス。
 */
export class PositionCollector {
	private posMap: HashMap<Entity, Pos[]>;
	private keyMap: HashMap<Entity, HashMap<string, boolean>>; //containsKeyで高速な重複チェックをするため

	constructor() {
		this.posMap = new HashMap();
		this.keyMap = new HashMap();
	}

	/**
	 * 座標を追加する
	 * @param entity
	 * @param posX
	 * @param posY
	 * @param posZ
	 * @param allowDuplicates 重複する座標の追加を許可するかどうか（デフォルトはfalse）
	 */
	add(
		entity: Entity,
		posX: number,
		posY: number,
		posZ: number,
		allowDuplicates: boolean = false,
	): void {
		const posList = this.getOrCreateList(entity);
		const keySet = this.getKeySet(entity);
		const key = PositionCollector.createKey(posX, posY, posZ);
		if (!allowDuplicates && keySet.containsKey(key)) return;
		posList.push([posX, posY, posZ]);
		if (!allowDuplicates) keySet.put(key, true);
	}

	/**
	 * すべての座標を追加する
	 * @param entity
	 * @param posList 座標リスト [[x, y, z], ...]
	 * @param allowDuplicates 重複する座標の追加を許可するかどうか（デフォルトはfalse）
	 */
	addAll(
		entity: Entity,
		posList: Pos[],
		allowDuplicates: boolean = false,
	): void {
		for (let i = 0; i < posList.length; i++) {
			const pos = posList[i];
			if (!pos) continue;
			this.add(entity, pos[0], pos[1], pos[2], allowDuplicates);
		}
	}

	/**
	 * 最後の座標を取得して削除する
	 * @param entity
	 * @returns 座標 [x, y, z]
	 */
	pop(entity: Entity): Pos | null {
		const posList = this.getOrCreateList(entity);
		if (posList.length === 0) return null;
		const pos = posList.pop();
		if (!pos) return null;
		this.rebuildKeySet(entity); //重複した座標を削除するとキーが壊れるため再構築する
		return pos;
	}

	/**
	 * 最初の座標を取得して削除する
	 * @param entity
	 * @returns 座標 [x, y, z]
	 */
	shift(entity: Entity): Pos | null {
		const posList = this.getOrCreateList(entity);
		if (posList.length === 0) return null;
		const pos = posList.shift();
		if (!pos) return null;
		this.rebuildKeySet(entity); //重複した座標を削除するとキーが壊れるため再構築する
		return pos;
	}

	/**
	 * すべての座標を取得する
	 * @param entity
	 * @returns 座標の配列 [[x, y, z], ...]
	 */
	getAll(entity: Entity): Pos[] {
		return this.getOrCreateList(entity);
	}

	getLastPos(entity: Entity): Pos | null {
		const posList = this.getOrCreateList(entity);
		if (posList.length === 0) return null;
		return posList[posList.length - 1];
	}

	reverse(entity: Entity): void {
		const list = this.getAll(entity);
		list.reverse();
	}

	/**
	 * すべての座標を消去する
	 * @param entity
	 */
	clear(entity: Entity): void {
		this.posMap.put(entity, []);
		this.keyMap.put(entity, new HashMap());
	}

	/**
	 * 座標の数を取得する
	 * @param entity
	 * @returns
	 */
	size(entity: Entity): number {
		return this.getOrCreateList(entity).length;
	}

	private getOrCreateList(entity: Entity): Pos[] {
		let list = this.posMap.get(entity);
		if (!list) {
			list = [];
			this.posMap.put(entity, list);
		}
		return list;
	}

	private getKeySet(entity: Entity): HashMap<string, boolean> {
		let keySet = this.keyMap.get(entity);
		if (!keySet) {
			keySet = new HashMap();
			this.keyMap.put(entity, keySet);
		}
		return keySet;
	}

	private rebuildKeySet(entity: Entity): void {
		const posList = this.getOrCreateList(entity);
		const keySet: HashMap<string, boolean> = new HashMap();
		for (let i = 0; i < posList.length; i++) {
			const pos = posList[i];
			if (!pos) continue;
			keySet.put(PositionCollector.createKey(pos[0], pos[1], pos[2]), true);
		}
		this.keyMap.put(entity, keySet);
	}

	private static createKey(x: number, y: number, z: number): string {
		return x + "," + y + "," + z;
	}
}
