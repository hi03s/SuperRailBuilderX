import { HashMap } from "java.util";
import { Entity } from "net.minecraft.entity";
import { BlockBuilder } from "./lib_BlockBuilder";

export class UndoManager {
	private static hashMap: HashMap<Entity, BlockBuilder[]> = new HashMap();

	static backupFromBlockBuilder(entity: Entity, builder: BlockBuilder): void {
		const backupBuilder = new BlockBuilder();
		const posList = builder.get(entity);
		for (let i = posList.length - 1; i >= 0; i--) {
			const pos = posList[i];
			backupBuilder.addBackup(entity, [pos[1], pos[2], pos[3]]);
		}
		UndoManager.push(entity, backupBuilder);
	}

	static removeUnbuiltBlocks(entity: Entity, remainingCount: number): void {
		const backupBuilder = UndoManager.getLastData(entity);
		if (backupBuilder) {
			const posList = backupBuilder.get(entity);
			posList.splice(0, remainingCount);
			backupBuilder.set(entity, posList);
			// 更新
			UndoManager.updateLastData(entity, backupBuilder);
		}
	}

	static push(entity: Entity, blockBuilder: BlockBuilder): void {
		const list = this.getList(entity);
		list.push(blockBuilder);
		this.setList(entity, list);
	}

	static pop(entity: Entity): BlockBuilder | null {
		const list = this.getList(entity);
		const result = list.pop();
		this.setList(entity, list);
		return result ? result : null;
	}

	static updateLastData(entity: Entity, blockBuilder: BlockBuilder): void {
		const list = this.getList(entity);
		if (list.length === 0) list.push(blockBuilder);
		else list[list.length - 1] = blockBuilder;
		this.setList(entity, list);
	}

	static getLastData(entity: Entity): BlockBuilder | null {
		const list = this.getList(entity);
		if (list.length === 0) return null;
		return list[list.length - 1];
	}

	static clear(entity: Entity): void {
		this.setList(entity, []);
	}

	static canUndo(entity: Entity): boolean {
		const size = UndoManager.getList(entity).length;
		return size > 0;
	}

	private static getList(entity: Entity): BlockBuilder[] {
		const list = this.hashMap.get(entity) || [];
		return list;
	}

	private static setList(entity: Entity, list: BlockBuilder[]): void {
		this.hashMap.put(entity, list);
	}
}
