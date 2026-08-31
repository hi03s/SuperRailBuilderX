import { HashMap } from "java.util";
import { Entity } from "net.minecraft.entity";

export type InsulatorPos = [
	blockX: number,
	blockY: number,
	blockZ: number,
	blockSide: number,
	offsetX: number,
	offsetY: number,
	offsetZ: number,
	renderYaw: number,
];

export class InsulatorCollector {
	private posMap: HashMap<Entity, InsulatorPos[]>;
	private keyMap: HashMap<Entity, HashMap<string, boolean>>; //containsKeyで高速な重複チェックをするため

	constructor() {
		this.posMap = new HashMap();
		this.keyMap = new HashMap();
	}

	add(
		entity: Entity,
		posX: number,
		posY: number,
		posZ: number,
		blockSide: number,
		renderYaw: number,
	): void {
		const blockX = Math.floor(posX);
		const blockY = Math.floor(posY);
		const blockZ = Math.floor(posZ);
		const posList = this.getOrCreateList(entity);
		const keySet = this.getKeySet(entity);
		const key = InsulatorCollector.createKey(blockX, blockY, blockZ);
		if (keySet.containsKey(key)) return;
		const offsetX = posX - (blockX + 0.5);
		const offsetY = posY - (blockY + 0.5);
		const offsetZ = posZ - (blockZ + 0.5);
		posList.push([
			blockX,
			blockY,
			blockZ,
			blockSide,
			offsetX,
			offsetY,
			offsetZ,
			renderYaw,
		]);
	}

	pop(entity: Entity): InsulatorPos | null {
		const posList = this.getOrCreateList(entity);
		if (posList.length === 0) return null;
		const pos = posList.pop();
		if (!pos) return null;
		this.rebuildKeySet(entity); //重複した座標を削除するとキーが壊れるため再構築する
		return pos;
	}

	getAll(entity: Entity): InsulatorPos[] {
		return this.getOrCreateList(entity);
	}

	getLastPos(entity: Entity): InsulatorPos | null {
		const posList = this.getOrCreateList(entity);
		if (posList.length === 0) return null;
		return posList[posList.length - 1];
	}

	reverse(entity: Entity): void {
		const list = this.getAll(entity);
		list.reverse();
	}

	translateY(entity: Entity, offsetY: number): void {
		if (offsetY === 0) return;
		const list = this.getAll(entity);
		for (let i = 0; i < list.length; i++) {
			list[i][1] += offsetY;
		}
		this.rebuildKeySet(entity);
	}

	clear(entity: Entity): void {
		this.posMap.put(entity, []);
		this.keyMap.put(entity, new HashMap());
	}

	size(entity: Entity): number {
		return this.getOrCreateList(entity).length;
	}

	private getOrCreateList(entity: Entity): InsulatorPos[] {
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
			keySet.put(InsulatorCollector.createKey(pos[0], pos[1], pos[2]), true);
		}
		this.keyMap.put(entity, keySet);
	}

	private static createKey(x: number, y: number, z: number): string {
		return x + "," + y + "," + z;
	}
}
