export type SRBXVec3 = [x: number, y: number, z: number];

export class SRBXMath {
	static roundToStep(value: number, step: number): number {
		if (!isFinite(value) || !isFinite(step) || step <= 0) return value;
		return Math.round(value / step) * step;
	}

	static roundPosition(position: SRBXVec3, step: number): SRBXVec3 {
		return [
			this.roundToStep(position[0], step),
			this.roundToStep(position[1], step),
			this.roundToStep(position[2], step),
		];
	}

	static normalizeDegrees(angle: number): number {
		let normalized = angle % 360;
		if (normalized < 0) normalized += 360;
		return normalized;
	}

	static snapDegrees(angle: number, step: number): number {
		return this.normalizeDegrees(this.roundToStep(angle, step));
	}

	static horizontalYaw(from: SRBXVec3, to: SRBXVec3): number {
		return this.normalizeDegrees(
			(Math.atan2(to[2] - from[2], to[0] - from[0]) * 180) / Math.PI,
		);
	}

	static directionFromYaw(yaw: number): number {
		return Math.round(this.normalizeDegrees(yaw) / 45) & 7;
	}

	static distance(from: SRBXVec3, to: SRBXVec3): number {
		const dx = to[0] - from[0];
		const dy = to[1] - from[1];
		const dz = to[2] - from[2];
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	static horizontalDistance(from: SRBXVec3, to: SRBXVec3): number {
		const dx = to[0] - from[0];
		const dz = to[2] - from[2];
		return Math.sqrt(dx * dx + dz * dz);
	}
}
