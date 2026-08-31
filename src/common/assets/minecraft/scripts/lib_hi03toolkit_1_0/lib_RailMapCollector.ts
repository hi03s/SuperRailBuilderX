import { HashMap } from "java.util";
import { RailMap } from "jp.ngt.rtm.rail.util";
import { Entity } from "net.minecraft.entity";
import { NGTOBuilderUtil } from "./lib_NGTOBuilderUtil";

export type Pos = [x: number, y: number, z: number];

export type RailMapSet = [posKey: string, railMap: RailMap];

export class RailMapCollector {
	private railMapList: HashMap<Entity, RailMap[]>;
	private reverseList: HashMap<Entity, boolean[]>;

	constructor() {
		this.railMapList = new HashMap();
		this.reverseList = new HashMap();
	}

	add(entity: Entity, railMap: RailMap, isReverse: boolean): void {
		const list = this.getOrCreateList(entity);
		if (!this.hasRailMap(entity, railMap)) {
			const rmList = list[0];
			const boolList = list[1];
			rmList.push(railMap);
			boolList.push(isReverse);
			this.set(entity, rmList, boolList);
		}
	}

	//小数点を含む座標を与えること(ブロック座標だとズレます)
	addAt(
		entity: Entity,
		posX: number,
		posY: number,
		posZ: number,
		isReverse: boolean,
	): void {
		const railMap = NGTOBuilderUtil.getRailMapAt(entity, posX, posY, posZ);
		if (railMap && !this.hasRailMap(entity, railMap))
			this.add(entity, railMap, isReverse);
	}

	//小数点を含む座標を与えること(ブロック座標だとズレます)
	isConnectedRailAt(
		entity: Entity,
		posX: number,
		posY: number,
		posZ: number,
	): boolean {
		const lookingRailMap = NGTOBuilderUtil.getRailMapAt(
			entity,
			posX,
			posY,
			posZ,
		);
		if (!lookingRailMap) return false;
		const railMapList = this.getOrCreateList(entity)[0];
		for (let i = 0; i < railMapList.length; i++) {
			const rm = railMapList[i];
			if (rm) {
				const bool = NGTOBuilderUtil.isConnectedRail(rm, lookingRailMap);
				if (bool) return true;
			}
		}
		return false;
	}

	hasRailMap(entity: Entity, railMap: RailMap): boolean {
		const railMapList = this.getOrCreateList(entity)[0];
		return railMapList.indexOf(railMap) >= 0;
	}

	getLastRailMap(entity: Entity): RailMap | null {
		const railMapList = this.getOrCreateList(entity)[0];
		if (railMapList.length === 0) return null;
		return railMapList[railMapList.length - 1];
	}

	pop(entity: Entity): [RailMap, boolean] | null {
		const list = this.getOrCreateList(entity);
		const rmList = list[0];
		const boolList = list[1];
		if (rmList.length === 0) return null;
		const rm = rmList.pop();
		const bool = boolList.pop();
		this.set(entity, rmList, boolList);
		if (rm !== undefined && bool !== undefined) return [rm, bool];
		return null;
	}

	shift(entity: Entity): [RailMap, boolean] | null {
		const list = this.getOrCreateList(entity);
		const rmList = list[0];
		const boolList = list[1];
		if (rmList.length === 0) return null;
		const rm = rmList.shift();
		const bool = boolList.shift();
		this.set(entity, rmList, boolList);
		if (rm !== undefined && bool !== undefined) return [rm, bool];
		return null;
	}

	clear(entity: Entity): void {
		this.set(entity, [], []);
	}

	size(entity: Entity): number {
		const rmList = this.getOrCreateList(entity)[0];
		return rmList.length;
	}

	getAll(entity: Entity): [RailMap[], boolean[]] {
		return this.getOrCreateList(entity);
	}

	getAllRailMap(entity: Entity): RailMap[] {
		return this.getOrCreateList(entity)[0];
	}

	reverse(entity: Entity): void {
		const list = this.getAll(entity)[1];
		for (let i = 0; i < list.length; i++) {
			list[i] = !list[i];
		}
	}

	private getOrCreateList(entity: Entity): [RailMap[], boolean[]] {
		let rmList = this.railMapList.get(entity);
		let boolList = this.reverseList.get(entity);
		if (!rmList) {
			rmList = [];
			boolList = [];
			this.set(entity, rmList, boolList);
		}
		return [rmList, boolList];
	}

	private set(
		entity: Entity,
		railMapList: RailMap[],
		reverseList: boolean[],
	): void {
		this.railMapList.put(entity, railMapList);
		this.reverseList.put(entity, reverseList);
	}
}
