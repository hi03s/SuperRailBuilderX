import { BlockSet, NGTObject } from "jp.ngt.ngtlib.block";
import { RotatableBlockSet } from "./lib_RotatableBlockSet";
import { Quaternion } from "./lib_Quaternion";
import { RTMApiCompat } from "@target/assets/minecraft/scripts/lib_hi03toolkit_1_0/lib_RTMApiCompat";
import {
	Block,
	BlockButton,
	BlockDoor,
	BlockFenceGate,
	BlockLadder,
	BlockLog,
	BlockStairs,
} from "net.minecraft.block";

export type Pos = [x: number, y: number, z: number];

/**
 * 回転可能なブロックのオブジェクト
    補完処理はブロック化時に実施するためここでは取り扱いをしない
    操作は基本的に一度きりのため破壊的変更の仕様
    座標はまだ相対座標
 */
export class RotatableBlockObject {
	public blockSetList: RotatableBlockSet[];
	public minX: number;
	public minY: number;
	public minZ: number;
	public maxX: number;
	public maxY: number;
	public maxZ: number;
	public pivotX: number;
	public pivotY: number;
	public pivotZ: number;

	explicitMinX: number | null = null;
	explicitMinY: number | null = null;
	explicitMinZ: number | null = null;
	explicitMaxX: number | null = null;
	explicitMaxY: number | null = null;
	explicitMaxZ: number | null = null;

	constructor() {
		this.blockSetList = [];
		this.minX = 0;
		this.minY = 0;
		this.minZ = 0;
		this.maxX = 0;
		this.maxY = 0;
		this.maxZ = 0;
		this.pivotX = 0.5;
		this.pivotY = 0.5;
		this.pivotZ = 0.5;
	}

	static createFromPosList(
		posList: Pos[],
		blockSet: BlockSet = new BlockSet(RTMApiCompat.getBlockStone(), 0),
	): RotatableBlockObject {
		const newRBO = new RotatableBlockObject();
		posList.forEach((pos) => {
			newRBO.blockSetList.push(
				new RotatableBlockSet(blockSet, pos[0], pos[1], pos[2]),
			);
		});
		newRBO.calcSize();
		return newRBO;
	}

	static createFromNGTO(
		ngto: NGTObject,
		isPlaceAirBlock: boolean,
	): RotatableBlockObject {
		const newRBO = new RotatableBlockObject();
		for (let yIdx = 0; yIdx < ngto.ySize; yIdx++) {
			for (let xIdx = 0; xIdx < ngto.xSize; xIdx++) {
				for (let zIdx = 0; zIdx < ngto.zSize; zIdx++) {
					const blockSet = ngto.getBlockSet(xIdx, yIdx, zIdx);
					if (
						isPlaceAirBlock ||
						Block.getIdFromBlock(blockSet.block) !== 0
					) {
						const rotatableBlockSet = new RotatableBlockSet(
							blockSet,
							xIdx,
							yIdx,
							zIdx,
						);
						const nbt = blockSet.writeToNBT();
						if (nbt) rotatableBlockSet.yaw = nbt.getFloat("Yaw");
						newRBO.blockSetList.push(rotatableBlockSet);
					}
				}
			}
		}
		newRBO.calcSize();
		return newRBO;
	}

	add(blockSet: RotatableBlockSet): RotatableBlockObject {
		this.blockSetList.push(blockSet);
		return this;
	}

	merge(rbo: RotatableBlockObject): RotatableBlockObject {
		for (let i = 0; i < rbo.blockSetList.length; i++) {
			const rbs = rbo.blockSetList[i];
			if (!rbs) continue;
			this.blockSetList.push(rbs.copy());
		}
		this.calcSize();
		return this;
	}

	mergeBefore(rbo: RotatableBlockObject): RotatableBlockObject {
		const newList: RotatableBlockSet[] = [];
		// 先に追加したいRBO
		for (let i = 0; i < rbo.blockSetList.length; i++) {
			const rbs = rbo.blockSetList[i];
			if (!rbs) continue;
			newList.push(rbs.copy());
		}
		// 既存のRBO
		for (let i = 0; i < this.blockSetList.length; i++) {
			const rbs = this.blockSetList[i];
			if (!rbs) continue;
			newList.push(rbs);
		}
		this.blockSetList = newList;
		this.calcSize();
		return this;
	}

	copy(): RotatableBlockObject {
		const newRBO = new RotatableBlockObject();
		this.blockSetList.forEach((rbs) => {
			if (!rbs) return;
			const newRBS = rbs.copy();
			newRBO.add(newRBS);
		});
		newRBO.explicitMinX = this.explicitMinX;
		newRBO.explicitMinY = this.explicitMinY;
		newRBO.explicitMinZ = this.explicitMinZ;
		newRBO.explicitMaxX = this.explicitMaxX;
		newRBO.explicitMaxY = this.explicitMaxY;
		newRBO.explicitMaxZ = this.explicitMaxZ;
		newRBO.calcSize();
		return newRBO;
	}

	setPivot(x: number, y: number, z: number): RotatableBlockObject {
		this.blockSetList.forEach((rbs) => {
			if (!rbs) return;
			rbs.setPivot(x, y, z);
		});
		this.pivotX = x;
		this.pivotY = y;
		this.pivotZ = z;
		return this;
	}

	rotateQ(q: Quaternion): RotatableBlockObject {
		const yaw = (q.extractYaw() + 360) % 360;
		this.blockSetList.forEach((rbs) => {
			if (!rbs) return;
			rbs.rotateQ(q);
			//ブロックの向きを変更する
			let isChangeMetaData = false;
			const block = rbs.blockSet.block;
			const instanceList = [
				BlockStairs,
				BlockDoor,
				BlockFenceGate,
				BlockLog,
				BlockLadder,
				BlockButton,
			];
			for (
				let instanceIdx = 0;
				instanceIdx < instanceList.length;
				instanceIdx++
			) {
				if (block instanceof instanceList[instanceIdx]) {
					isChangeMetaData = true;
					break;
				}
			}
			if (isChangeMetaData) {
				const metadata = rbs.blockSet.metadata;
				//directions
				let directions: number[] = [0, 3, 2, 1];
				if (block instanceof BlockStairs) directions = [0, 3, 1, 2];
				if (block instanceof BlockLog) directions = [];
				if (block instanceof BlockLadder) directions = [2, 4, 3, 5];
				if (block instanceof BlockButton) directions = [2, 3, 1, 4];
				//metadata解析
				let blockDir: number;
				let option1 = 0;
				let option2 = 0;
				if (block instanceof BlockLadder) {
					blockDir = metadata;
				} else {
					blockDir = metadata & 3;
					option1 = metadata & 4;
					option2 = metadata & 8;
				}
				//回転
				const currentDirIndex = directions.indexOf(blockDir);
				let rotateIndex = 0;
				if (45 <= yaw && yaw < 135) rotateIndex = 1;
				if (135 <= yaw && yaw < 225) rotateIndex = 2;
				if (225 <= yaw && yaw < 315) rotateIndex = 3;
				if (currentDirIndex !== -1) {
					const newDirIndex =
						(currentDirIndex + rotateIndex) % directions.length;
					blockDir = directions[newDirIndex];
				}
				let newMetadata =
					block instanceof BlockLadder
						? blockDir
						: option2 | option1 | blockDir;
				if (block instanceof BlockLog) {
					//原木は樹種(下位2bit)を維持し、横倒し時のX/Z軸だけを交換する。
					//縦向き(0)と全面樹皮(12)はYaw回転しても変化しない。
					const logType = metadata & 3;
					let logAxis = metadata & 12;
					if (rotateIndex === 1 || rotateIndex === 3) {
						if (logAxis === 4) logAxis = 8;
						else if (logAxis === 8) logAxis = 4;
					}
					newMetadata = logType | logAxis;
				}
				const prevNBT = rbs.blockSet.nbt;
				rbs.blockSet = prevNBT
					? new BlockSet(rbs.blockSet.block, newMetadata, prevNBT)
					: new BlockSet(rbs.blockSet.block, newMetadata);
			}
		});
		this.calcSize();
		return this;
	}

	rotate(yaw: number, pitch: number, roll: number): RotatableBlockObject {
		return this.rotateQ(Quaternion.fromEuler(yaw, pitch, roll));
	}

	offset(x: number, y: number, z: number): RotatableBlockObject {
		this.blockSetList.forEach((rbs) => {
			if (!rbs) return;
			rbs.move(x, y, z);
		});
		this.calcSize();
		return this;
	}

	offsetExpanding(offsetX: number, offsetY: number, offsetZ: number): void {
		this.calcSize();

		const oldMinX = this.minX;
		const oldMinY = this.minY;
		const oldMinZ = this.minZ;
		const oldMaxX = this.maxX;
		const oldMaxY = this.maxY;
		const oldMaxZ = this.maxZ;

		this.offset(offsetX, offsetY, offsetZ);

		// 正方向にずらした場合: min側に空白を残す
		// 負方向にずらした場合: max側に空白を残す
		this.explicitMinX = Math.min(oldMinX, oldMinX + offsetX);
		this.explicitMinY = Math.min(oldMinY, oldMinY + offsetY);
		this.explicitMinZ = Math.min(oldMinZ, oldMinZ + offsetZ);
		this.explicitMaxX = Math.max(oldMaxX, oldMaxX + offsetX);
		this.explicitMaxY = Math.max(oldMaxY, oldMaxY + offsetY);
		this.explicitMaxZ = Math.max(oldMaxZ, oldMaxZ + offsetZ);

		this.calcSize();
	}

	movePivotToBase(): RotatableBlockObject {
		const dx = 0.5 - this.pivotX;
		const dy = 0.5 - this.pivotY;
		const dz = 0.5 - this.pivotZ;
		this.offset(dx, dy, dz);
		return this;
	}

	movePivotToBaseXZ(): RotatableBlockObject {
		const dx = 0.5 - this.pivotX;
		const dz = 0.5 - this.pivotZ;
		this.offset(dx, 0, dz);
		return this;
	}

	mirrorX(): RotatableBlockObject {
		const centerX = (this.minX + this.maxX) / 2;
		this.blockSetList.forEach((rbs) => {
			if (!rbs) return;
			rbs.local_x = 2 * centerX - rbs.local_x;
			rbs.pivot_x = 2 * centerX - rbs.pivot_x;
			rbs.blockSet = this.mirroredBlockSet(rbs.blockSet, "X");
		});
		this.calcSize();
		return this;
	}

	mirrorY(): RotatableBlockObject {
		const centerY = (this.minY + this.maxY) / 2;
		this.blockSetList.forEach((rbs) => {
			if (!rbs) return;
			rbs.local_y = 2 * centerY - rbs.local_y;
			rbs.pivot_y = 2 * centerY - rbs.pivot_y;
		});
		this.calcSize();
		return this;
	}

	mirrorZ(): RotatableBlockObject {
		const centerZ = (this.minZ + this.maxZ) / 2;
		this.blockSetList.forEach((rbs) => {
			if (!rbs) return;
			rbs.local_z = 2 * centerZ - rbs.local_z;
			rbs.pivot_z = 2 * centerZ - rbs.pivot_z;
			rbs.blockSet = this.mirroredBlockSet(rbs.blockSet, "Z");
		});
		this.calcSize();
		return this;
	}

	calcSize(): RotatableBlockObject {
		this.minX = Number.POSITIVE_INFINITY;
		this.minY = Number.POSITIVE_INFINITY;
		this.minZ = Number.POSITIVE_INFINITY;
		this.maxX = Number.NEGATIVE_INFINITY;
		this.maxY = Number.NEGATIVE_INFINITY;
		this.maxZ = Number.NEGATIVE_INFINITY;
		this.blockSetList.forEach((rbs) => {
			if (!rbs) return;
			this.minX = Math.min(this.minX, rbs.local_x);
			this.minY = Math.min(this.minY, rbs.local_y);
			this.minZ = Math.min(this.minZ, rbs.local_z);
			this.maxX = Math.max(this.maxX, rbs.local_x);
			this.maxY = Math.max(this.maxY, rbs.local_y);
			this.maxZ = Math.max(this.maxZ, rbs.local_z);
		});
		if (this.explicitMinX !== null && this.explicitMinX < this.minX)
			this.minX = this.explicitMinX;
		if (this.explicitMinY !== null && this.explicitMinY < this.minY)
			this.minY = this.explicitMinY;
		if (this.explicitMinZ !== null && this.explicitMinZ < this.minZ)
			this.minZ = this.explicitMinZ;
		if (this.explicitMaxX !== null && this.explicitMaxX > this.maxX)
			this.maxX = this.explicitMaxX;
		if (this.explicitMaxY !== null && this.explicitMaxY > this.maxY)
			this.maxY = this.explicitMaxY;
		if (this.explicitMaxZ !== null && this.explicitMaxZ > this.maxZ)
			this.maxZ = this.explicitMaxZ;
		return this;
	}

	//axisは"X"/"Z"のいずれか
	private mirroredBlockSet(
		currentBlockSet: BlockSet,
		axis: string,
	): BlockSet {
		let isChangeMetaData = false;
		const block = currentBlockSet.block;
		const metadata = currentBlockSet.metadata;
		const instanceList = [
			BlockStairs,
			BlockDoor,
			BlockFenceGate,
			BlockLadder,
			BlockButton,
		];
		for (
			let instanceIdx = 0;
			instanceIdx < instanceList.length;
			instanceIdx++
		) {
			if (block instanceof instanceList[instanceIdx]) {
				isChangeMetaData = true;
				break;
			}
		}
		if (isChangeMetaData) {
			//directions
			let directions: number[] = [0, 3, 2, 1];
			if (block instanceof BlockStairs) directions = [0, 3, 1, 2];
			if (block instanceof BlockLog) directions = [];
			if (block instanceof BlockLadder) directions = [2, 4, 3, 5];
			if (block instanceof BlockButton) directions = [2, 3, 1, 4];
			//metadata解析
			let blockDir: number;
			let option1 = 0;
			let option2 = 0;
			if (block instanceof BlockLadder) {
				blockDir = metadata;
			} else {
				blockDir = metadata & 3;
				option1 = metadata & 4;
				option2 = metadata & 8;
			}
			const currentDirIndex = directions.indexOf(blockDir);
			if (currentDirIndex === -1) return currentBlockSet;
			//metadata反転処理
			let mappedIndex = currentDirIndex;
			if (axis === "X") {
				if (
					block instanceof BlockLadder ||
					block instanceof BlockFenceGate
				) {
					if (currentDirIndex === 1) mappedIndex = 3;
					else if (currentDirIndex === 3) mappedIndex = 1;
				} else {
					if (currentDirIndex === 0) mappedIndex = 2;
					else if (currentDirIndex === 2) mappedIndex = 0;
				}
			} else if (axis === "Z") {
				if (
					block instanceof BlockLadder ||
					block instanceof BlockFenceGate
				) {
					if (currentDirIndex === 0) mappedIndex = 2;
					else if (currentDirIndex === 2) mappedIndex = 0;
				} else {
					if (currentDirIndex === 1) mappedIndex = 3;
					else if (currentDirIndex === 3) mappedIndex = 1;
				}
			}
			const newDir = directions[mappedIndex];
			const newMetadata =
				block instanceof BlockLadder
					? newDir
					: option2 | option1 | newDir;
			const prevNBT = currentBlockSet.nbt;
			return prevNBT
				? new BlockSet(currentBlockSet.block, newMetadata, prevNBT)
				: new BlockSet(currentBlockSet.block, newMetadata);
		}
		return currentBlockSet;
	}
}
