import { BlockSet } from "jp.ngt.ngtlib.block";
import { Quaternion } from "./lib_Quaternion";
import { Vec3 } from "jp.ngt.ngtlib.math";

//###  RotatableBlockSet  ###
//RotatableBlockSetはBlockSetを持つ点です
export class RotatableBlockSet {
	blockSet: BlockSet;
	local_x: number;
	local_y: number;
	local_z: number;
	pivot_x: number;
	pivot_y: number;
	pivot_z: number;
	yaw: number;
	isDiffused: boolean;

	constructor(
		blockSet: BlockSet,
		localX: number,
		localY: number,
		localZ: number,
	) {
		this.blockSet = blockSet;
		this.local_x = Math.floor(localX) + 0.5;
		this.local_y = Math.floor(localY) + 0.5;
		this.local_z = Math.floor(localZ) + 0.5;
		this.pivot_x = 0.5;
		this.pivot_y = 0.5;
		this.pivot_z = 0.5;
		this.yaw = 0; //TileEntityPlaceable用
		this.isDiffused = false;
	}

	copy(): RotatableBlockSet {
		const newBS = new RotatableBlockSet(this.blockSet, 0, 0, 0);
		newBS.local_x = this.local_x;
		newBS.local_y = this.local_y;
		newBS.local_z = this.local_z;
		newBS.pivot_x = this.pivot_x;
		newBS.pivot_y = this.pivot_y;
		newBS.pivot_z = this.pivot_z;
		newBS.yaw = this.yaw;
		newBS.isDiffused = this.isDiffused;
		return newBS;
	}

	move(x: number, y: number, z: number): RotatableBlockSet {
		this.local_x += x;
		this.local_y += y;
		this.local_z += z;
		return this;
	}

	setYaw(yaw: number): RotatableBlockSet {
		this.yaw = yaw;
		return this;
	}

	rotateQ(q: Quaternion): RotatableBlockSet {
		this.yaw += q.extractYaw();
		let vec = new Vec3(
			this.local_x - this.pivot_x,
			this.local_y - this.pivot_y,
			this.local_z - this.pivot_z,
		);
		vec = q.rotateVector(vec);
		this.local_x = this.pivot_x + vec.getX();
		this.local_y = this.pivot_y + vec.getY();
		this.local_z = this.pivot_z + vec.getZ();
		return this;
	}

	rotate(yaw: number, pitch: number, roll: number): RotatableBlockSet {
		return this.rotateQ(Quaternion.fromEuler(yaw, pitch, roll));
	}

	setPivot(x: number, y: number, z: number): RotatableBlockSet {
		this.pivot_x = x;
		this.pivot_y = y;
		this.pivot_z = z;
		return this;
	}
}
