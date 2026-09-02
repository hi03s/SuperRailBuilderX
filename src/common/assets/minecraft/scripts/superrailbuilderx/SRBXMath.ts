export type SRBXVec3 = [x: number, y: number, z: number];

export type SRBXCircularConnection = {
	intersection: SRBXVec3;
	radius: number;
	angle: number;
	anchorLength: number;
	freeYaw: number;
	freePitch: number;
};

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

	static relativeDegrees(angle: number, baseAngle: number): number {
		let relative = this.normalizeDegrees(angle - baseAngle);
		if (relative > 180) relative -= 360;
		return relative;
	}

	static horizontalYaw(from: SRBXVec3, to: SRBXVec3): number {
		return this.normalizeDegrees(
			(Math.atan2(to[0] - from[0], to[2] - from[2]) * 180) / Math.PI,
		);
	}

	static directionFromYaw(yaw: number): number {
		return Math.round(this.normalizeDegrees(yaw) / 45) & 7;
	}

	static pitchFromPermil(permil: number): number {
		return (Math.atan(permil / 1000) * 180) / Math.PI;
	}

	static permilFromPitch(pitch: number): number {
		return Math.tan((pitch * Math.PI) / 180) * 1000;
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

	static markerBlockDisplayPosition(
		position: SRBXVec3,
		direction: number,
		railHeight: number,
	): SRBXVec3 {
		const yawRadians = ((direction & 7) * 45 * Math.PI) / 180;
		const insideDistance = 0.000001;
		return [
			Math.floor(position[0] + Math.sin(yawRadians) * insideDistance) +
				0.5,
			Math.floor(position[1] - railHeight + 0.000001) + railHeight,
			Math.floor(position[2] + Math.cos(yawRadians) * insideDistance) +
				0.5,
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

	static cubicBezierLength(
		start: SRBXVec3,
		startControl: SRBXVec3,
		endControl: SRBXVec3,
		end: SRBXVec3,
	): number {
		const split = Math.max(1, Math.ceil(this.distance(start, end) * 2));
		let length = 0;
		let previous = start;
		for (let i = 1; i <= split; i++) {
			const current = this.cubicBezierPoint(
				start,
				startControl,
				endControl,
				end,
				i / split,
			);
			length += this.distance(previous, current);
			previous = current;
		}
		return length;
	}

	static cubicBezierTangentYaw(
		start: SRBXVec3,
		startControl: SRBXVec3,
		endControl: SRBXVec3,
		end: SRBXVec3,
		t: number,
	): number {
		const u = 1 - t;
		const derivative: SRBXVec3 = [
			3 * u * u * (startControl[0] - start[0]) +
				6 * u * t * (endControl[0] - startControl[0]) +
				3 * t * t * (end[0] - endControl[0]),
			3 * u * u * (startControl[1] - start[1]) +
				6 * u * t * (endControl[1] - startControl[1]) +
				3 * t * t * (end[1] - endControl[1]),
			3 * u * u * (startControl[2] - start[2]) +
				6 * u * t * (endControl[2] - startControl[2]) +
				3 * t * t * (end[2] - endControl[2]),
		];
		return this.horizontalYaw([0, 0, 0], derivative);
	}

	static approximateBezierRadius(
		start: SRBXVec3,
		startControl: SRBXVec3,
		endControl: SRBXVec3,
		end: SRBXVec3,
	): number {
		const startYaw = this.cubicBezierTangentYaw(
			start,
			startControl,
			endControl,
			end,
			0,
		);
		const endYaw = this.cubicBezierTangentYaw(
			start,
			startControl,
			endControl,
			end,
			1,
		);
		const angle = this.relativeDegrees(startYaw, endYaw);
		const sine = Math.sin((angle * Math.PI) / 360);
		if (Math.abs(sine) < 0.00001) return Infinity;
		return this.horizontalDistance(start, end) / 2 / sine;
	}

	static fixedPairAnchorLength(
		start: SRBXVec3,
		startYaw: number,
		startPitch: number,
		end: SRBXVec3,
		endYaw: number,
		endPitch: number,
	): number {
		const provisionalLength = (this.distance(start, end) * 2) / 3;
		const startControl = this.pointAtYawPitchDistance(
			start,
			startYaw,
			startPitch,
			provisionalLength,
		);
		const endControl = this.pointAtYawPitchDistance(
			end,
			endYaw,
			endPitch,
			provisionalLength,
		);
		return this.cubicBezierLength(start, startControl, endControl, end) / 3;
	}

	static circularAnchorLength(radius: number, angleDegrees: number): number {
		if (!isFinite(radius) || Math.abs(radius) >= 10000) return 0;
		return Math.abs(
			radius *
				(4 / 3) *
				Math.tan((Math.abs(angleDegrees) * Math.PI) / 720),
		);
	}

	static continueCircularCurve(
		origin: SRBXVec3,
		yaw: number,
		radius: number,
		arcLength: number,
	): { position: SRBXVec3; endYaw: number; angle: number } {
		if (!isFinite(radius) || Math.abs(radius) >= 10000) {
			return {
				position: this.pointAtYawPitchDistance(
					origin,
					yaw,
					0,
					arcLength,
				),
				endYaw: this.normalizeDegrees(yaw),
				angle: 0,
			};
		}
		const angle = (arcLength / radius) * (180 / Math.PI);
		const yawRadians = (yaw * Math.PI) / 180;
		const rotatedRadians = ((yaw - angle) * Math.PI) / 180;
		return {
			position: [
				origin[0] +
					radius * (Math.cos(rotatedRadians) - Math.cos(yawRadians)),
				origin[1],
				origin[2] +
					radius * (-Math.sin(rotatedRadians) + Math.sin(yawRadians)),
			],
			endYaw: this.normalizeDegrees(yaw - angle),
			angle,
		};
	}

	static circularConnection(
		fixed: SRBXVec3,
		fixedYaw: number,
		fixedPitch: number,
		free: SRBXVec3,
	): SRBXCircularConnection {
		const center: SRBXVec3 = [
			(fixed[0] + free[0]) / 2,
			(fixed[1] + free[1]) / 2,
			(fixed[2] + free[2]) / 2,
		];
		const toCenterYaw = this.horizontalYaw(fixed, center);
		const yawDifference = this.relativeDegrees(fixedYaw, toCenterYaw);
		const cosine = Math.cos((yawDifference * Math.PI) / 180);
		const distanceToIntersection =
			Math.abs(cosine) < 0.00001
				? this.distance(fixed, center)
				: this.distance(fixed, center) / cosine;
		const intersection = this.pointAtYawPitchDistance(
			fixed,
			fixedYaw,
			fixedPitch,
			distanceToIntersection,
		);
		const intersectionYaw = this.horizontalYaw(fixed, intersection);
		const endYaw = this.horizontalYaw(fixed, free);
		const angle = this.relativeDegrees(intersectionYaw, endYaw) * 2;
		const sine = Math.sin((angle * Math.PI) / 360);
		const radius =
			Math.abs(sine) < 0.00001
				? Infinity
				: this.distance(fixed, free) / 2 / sine;
		let anchorLength = this.distance(fixed, free) / 3;
		if (Math.abs(radius) <= 9999 && Math.abs(angle) >= 1) {
			anchorLength = Math.abs(
				radius * (4 / 3) * Math.tan((angle * Math.PI) / 720),
			);
		}
		const freeYaw = this.horizontalYaw(free, intersection);
		const freeHorizontal = this.horizontalDistance(free, intersection);
		const freePitch =
			(Math.atan2(intersection[1] - free[1], freeHorizontal) * 180) /
			Math.PI;
		return {
			intersection,
			radius,
			angle,
			anchorLength,
			freeYaw,
			freePitch,
		};
	}
}
