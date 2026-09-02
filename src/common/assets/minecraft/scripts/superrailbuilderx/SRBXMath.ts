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
			(Math.atan2(to[0] - from[0], to[2] - from[2]) * 180) / Math.PI,
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

	static pointAtYawPitchDistance(
		origin: SRBXVec3,
		yaw: number,
		pitch: number,
		distance: number,
	): SRBXVec3 {
		const yawRadians = (yaw * Math.PI) / 180;
		const pitchRadians = (pitch * Math.PI) / 180;
		const horizontal = Math.cos(pitchRadians) * distance;
		return [
			origin[0] + Math.sin(yawRadians) * horizontal,
			origin[1] + Math.sin(pitchRadians) * distance,
			origin[2] + Math.cos(yawRadians) * horizontal,
		];
	}

	static cubicBezierPoint(
		start: SRBXVec3,
		startControl: SRBXVec3,
		endControl: SRBXVec3,
		end: SRBXVec3,
		t: number,
	): SRBXVec3 {
		const u = 1 - t;
		return [
			u * u * u * start[0] +
				3 * u * u * t * startControl[0] +
				3 * u * t * t * endControl[0] +
				t * t * t * end[0],
			u * u * u * start[1] +
				3 * u * u * t * startControl[1] +
				3 * u * t * t * endControl[1] +
				t * t * t * end[1],
			u * u * u * start[2] +
				3 * u * u * t * startControl[2] +
				3 * u * t * t * endControl[2] +
				t * t * t * end[2],
		];
	}
}
