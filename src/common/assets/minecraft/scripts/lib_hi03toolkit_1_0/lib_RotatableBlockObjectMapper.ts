import { HashMap } from "java.util";
import { Pos, RotatableBlockObject } from "./lib_RotatableBlockObject";
import { RotatableBlockSet } from "./lib_RotatableBlockSet";
import { BlockSetPlacement } from "./lib_BlockBuilder";
import { World } from "net.minecraft.world";
import { RTMApiCompat } from "@target/assets/minecraft/scripts/lib_hi03toolkit_1_0/lib_RTMApiCompat";
import { Blocks } from "net.minecraft.init";

export class RotatableBlockObjectMapper {
	//補間ブロックを追加
	static applyDiffusionSelf(
		rbo: RotatableBlockObject,
		mode: BlockDiffusionMode,
		shouldGenerateDiffusedBlocks: boolean = true,
	): void {
		const baseList = rbo.blockSetList;
		if (!shouldGenerateDiffusedBlocks) {
			for (let i = 0; i < baseList.length; i++) {
				const rbs = baseList[i];
				if (rbs) rbs.isDiffused = false;
			}
			return;
		}
		const newList: RotatableBlockSet[] = [];
		for (let i = 0; i < baseList.length; i++) {
			const rbs = baseList[i];
			if (!rbs) continue;
			rbs.isDiffused = false;
			newList.push(rbs);
			//補間ブロック
			mode.forEachDiffusedPosition(
				rbs.local_x,
				rbs.local_y,
				rbs.local_z,
				(x, y, z) => {
					const newRBS = rbs.copy();
					newRBS.local_x = x;
					newRBS.local_y = y;
					newRBS.local_z = z;
					newRBS.isDiffused = true;
					newList.push(newRBS);
				},
			);
		}
		rbo.blockSetList = newList;
	}

	//ブロック座標化
	static toBlockCoordSelf(rbo: RotatableBlockObject): void {
		const posIndexMap: HashMap<string, number> = new HashMap();
		const newList: RotatableBlockSet[] = [];
		for (let i = 0; i < rbo.blockSetList.length; i++) {
			const rbs = rbo.blockSetList[i];
			if (!rbs) continue;
			const x = RotatableBlockObjectMapper.toBlockCoord(rbs.local_x);
			const y = RotatableBlockObjectMapper.toBlockCoord(rbs.local_y);
			const z = RotatableBlockObjectMapper.toBlockCoord(rbs.local_z);
			const key = x + "," + y + "," + z;
			rbs.local_x = x;
			rbs.local_y = y;
			rbs.local_z = z;
			const existingIndex = posIndexMap.get(key);

			// まだその座標にブロックがない
			if (existingIndex === null || existingIndex === undefined) {
				posIndexMap.put(key, newList.length);
				newList.push(rbs);
				continue;
			}

			// すでにあるブロックが補間ブロックで追加分がベースなら置き換える
			const existing = newList[existingIndex];
			if (!existing) continue;
			if (existing.isDiffused === true && rbs.isDiffused === false) {
				newList[existingIndex] = rbs;
				continue;
			}
		}

		rbo.blockSetList = newList;
		rbo.calcSize();
	}

	//描画フレーム用データ
	//x, y, zを入れた場合は絶対座標になる
	static getPosList(
		rbo: RotatableBlockObject,
		x: number = 0,
		y: number = 0,
		z: number = 0,
	): Pos[] {
		const list: Pos[] = [];
		for (let i = 0; i < rbo.blockSetList.length; i++) {
			const rbs = rbo.blockSetList[i];
			if (!rbs) continue;
			list.push([
				RotatableBlockObjectMapper.toBlockCoord(rbs.local_x + x),
				RotatableBlockObjectMapper.toBlockCoord(rbs.local_y + y),
				RotatableBlockObjectMapper.toBlockCoord(rbs.local_z + z),
			]);
		}
		return list;
	}

	//ブロック置き換えの描画フレーム用データ
	static getReplacePosList(
		world: World,
		rbo: RotatableBlockObject,
		x: number,
		y: number,
		z: number,
	): Pos[] {
		const list: Pos[] = [];
		for (let i = 0; i < rbo.blockSetList.length; i++) {
			const rbs = rbo.blockSetList[i];
			if (!rbs) continue;
			const worldX = RotatableBlockObjectMapper.toBlockCoord(rbs.local_x + x);
			const worldY = RotatableBlockObjectMapper.toBlockCoord(rbs.local_y + y);
			const worldZ = RotatableBlockObjectMapper.toBlockCoord(rbs.local_z + z);
			const block = RTMApiCompat.getBlock(world, worldX, worldY, worldZ);
			if (block !== RTMApiCompat.getBlockAir())
				list.push([worldX, worldY, worldZ]);
		}
		return list;
	}

	//BlockBuilder用データ
	static toBlockPlacements(
		rbo: RotatableBlockObject,
		x: number = 0,
		y: number = 0,
		z: number = 0,
	): BlockSetPlacement[] {
		const list: BlockSetPlacement[] = [];
		for (let i = 0; i < rbo.blockSetList.length; i++) {
			const rbs = rbo.blockSetList[i];
			if (!rbs) continue;
			list.push([
				rbs.blockSet,
				RotatableBlockObjectMapper.toBlockCoord(rbs.local_x + x),
				RotatableBlockObjectMapper.toBlockCoord(rbs.local_y + y),
				RotatableBlockObjectMapper.toBlockCoord(rbs.local_z + z),
				rbs.yaw,
			]);
		}
		return list;
	}

	//ブロック置き換えのBlockBuilder用データ
	static toReplacePlacements(
		world: World,
		rbo: RotatableBlockObject,
		x: number,
		y: number,
		z: number,
	): BlockSetPlacement[] {
		const list: BlockSetPlacement[] = [];
		for (let i = 0; i < rbo.blockSetList.length; i++) {
			const rbs = rbo.blockSetList[i];
			if (!rbs) continue;
			const worldX = RotatableBlockObjectMapper.toBlockCoord(rbs.local_x + x);
			const worldY = RotatableBlockObjectMapper.toBlockCoord(rbs.local_y + y);
			const worldZ = RotatableBlockObjectMapper.toBlockCoord(rbs.local_z + z);
			const block = RTMApiCompat.getBlock(world, worldX, worldY, worldZ);
			if (block !== RTMApiCompat.getBlockAir())
				list.push([rbs.blockSet, worldX, worldY, worldZ, rbs.yaw]);
		}
		return list;
	}

	private static toBlockCoord(value: number): number {
		const EPS = 1.0e-6;
		return Math.floor(value + EPS);
	}
}

//## 補間モードを管理するクラス ##
export class BlockDiffusionMode {
	static readonly XZ = 0;
	static readonly XYZ = 1;
	static readonly NONE = 2;
	static readonly CLASSIC = 3;

	private static readonly modes: BlockDiffusionMode[] = [
		new BlockDiffusionMode(BlockDiffusionMode.XZ, "xz", `XZ拡散 [Medium]`, 0.2),
		new BlockDiffusionMode(
			BlockDiffusionMode.CLASSIC,
			"classic",
			`従来式補間 [Medium]`,
			0.2,
		),
		new BlockDiffusionMode(
			BlockDiffusionMode.XYZ,
			"xyz",
			`XYZ拡散 [High]`,
			0.2,
		),
		new BlockDiffusionMode(
			BlockDiffusionMode.NONE,
			"none",
			`補間なし [Low]`,
			0,
		),
	];

	private constructor(
		public readonly id: number,
		public readonly key: string,
		public readonly displayName: string,
		public readonly rate: number,
	) {}

	isClassic(): boolean {
		return this.id === BlockDiffusionMode.CLASSIC;
	}

	static get(id: number): BlockDiffusionMode {
		for (let i = 0; i < BlockDiffusionMode.modes.length; i++) {
			if (BlockDiffusionMode.modes[i].id === id) {
				return BlockDiffusionMode.modes[i];
			}
		}
		return BlockDiffusionMode.modes[0];
	}

	static next(id: number): number {
		const current = BlockDiffusionMode.get(id);
		for (let i = 0; i < BlockDiffusionMode.modes.length; i++) {
			if (BlockDiffusionMode.modes[i].id === current.id) {
				return BlockDiffusionMode.modes[
					(i + 1) % BlockDiffusionMode.modes.length
				].id;
			}
		}
		return BlockDiffusionMode.modes[0].id;
	}

	withRate(rate?: number): BlockDiffusionMode {
		return new BlockDiffusionMode(
			this.id,
			this.key,
			this.displayName,
			rate === undefined ? this.rate : rate,
		);
	}

	getOffsets(): Pos[] {
		const r = this.rate;

		if (this.key === "none" || r === 0) {
			return [];
		}

		if (this.key === "xz" || this.key === "classic") {
			return [
				[-r, 0, -r],
				[-r, 0, +r],
				[+r, 0, -r],
				[+r, 0, +r],
			];
		}

		if (this.key === "xyz") {
			return [
				[-r, -r, -r],
				[+r, -r, -r],
				[-r, -r, +r],
				[+r, -r, +r],
				[-r, +r, -r],
				[+r, +r, -r],
				[-r, +r, +r],
				[+r, +r, +r],
			];
		}

		return [];
	}

	forEachOffset(
		func: (offsetX: number, offsetY: number, offsetZ: number) => void,
	): void {
		const offsets = this.getOffsets();
		for (let i = 0; i < offsets.length; i++) {
			const offset = offsets[i];
			func(offset[0], offset[1], offset[2]);
		}
	}

	forEachDiffusedPosition(
		x: number,
		y: number,
		z: number,
		func: (x: number, y: number, z: number) => void,
	): void {
		this.forEachOffset((offsetX, offsetY, offsetZ) => {
			func(x + offsetX, y + offsetY, z + offsetZ);
		});
	}
}
