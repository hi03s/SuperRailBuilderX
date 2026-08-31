import { BlockSet } from "jp.ngt.ngtlib.block";
import { Pos, RotatableBlockObject } from "./lib_RotatableBlockObject";

export class RotatableBlockObjectFactory {
	static createCylinder(
		blockSet: BlockSet,
		diameter: number,
		height: number,
	): RotatableBlockObject {
		diameter = diameter <= 1 ? 1 : Math.round(diameter);
		height = height <= 1 ? 1 : Math.round(height);
		const posList: Pos[] = [];
		const radius = diameter / 2;
		const center = (diameter - 1) / 2;
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < diameter; x++) {
				for (let z = 0; z < diameter; z++) {
					const dx = x - center;
					const dz = z - center;
					const distanceSq = dx * dx + dz * dz;
					if (distanceSq <= radius * radius) {
						posList.push([x, y, z]);
					}
				}
			}
		}
		return RotatableBlockObject.createFromPosList(posList, blockSet);
	}

	static createBox(
		blockSet: BlockSet,
		width: number,
		height: number,
		depth: number,
	): RotatableBlockObject {
		width = width <= 1 ? 1 : Math.round(width);
		height = height <= 1 ? 1 : Math.round(height);
		depth = depth <= 1 ? 1 : Math.round(depth);
		const posList: Pos[] = [];
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				for (let z = 0; z < depth; z++) {
					posList.push([x, y, z]);
				}
			}
		}
		return RotatableBlockObject.createFromPosList(posList, blockSet);
	}

	static createWalls(
		blockSet: BlockSet,
		width: number,
		height: number,
		depth: number,
	): RotatableBlockObject {
		width = width <= 1 ? 1 : Math.round(width);
		height = height <= 1 ? 1 : Math.round(height);
		depth = depth <= 1 ? 1 : Math.round(depth);
		const posList: Pos[] = [];
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (x !== 0 && x !== width - 1) {
					posList.push([x, y, 0]);
					posList.push([x, y, depth - 1]);
				} else {
					for (let z = 0; z < depth; z++) {
						posList.push([x, y, z]);
					}
				}
			}
		}
		return RotatableBlockObject.createFromPosList(posList, blockSet);
	}

	static createSideWalls(
		blockSet: BlockSet,
		width: number,
		height: number,
	): RotatableBlockObject {
		width = width <= 1 ? 1 : Math.round(width);
		height = height <= 1 ? 1 : Math.round(height);
		const posList: Pos[] = [];
		for (let y = 0; y < height; y++) {
			posList.push([0, y, 0]);
			posList.push([width - 1, y, 0]);
		}
		return RotatableBlockObject.createFromPosList(posList, blockSet);
	}
}
