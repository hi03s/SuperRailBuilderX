export type SRBXVec3 = [x: number, y: number, z: number];

export type SRBXCircularConnection = {
	intersection: SRBXVec3;
	radius: number;
	angle: number;
	anchorLength: number;
	freeYaw: number;
	freePitch: number;
};

export type SRBXVerticalBuilderPoint = {
	kind: string;
	position: SRBXVec3;
	direction: number;
	anchorYaw: number;
	anchorPitch: number;
	anchorLength: number;
	anchorLengthVertical?: number;
	markerPosition: SRBXVec3;
	ownerBlock?: SRBXVec3;
	slopeTarget?: boolean;
	verticalProfile?: "circular_straight" | "circular_limited" | "straight";
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

	private static copyVerticalPoint<T extends SRBXVerticalBuilderPoint>(
		point: T,
	): T {
		const copy = {} as T;
		const keys = Object.keys(point) as Array<keyof T>;
		for (let i = 0; i < keys.length; i++) copy[keys[i]] = point[keys[i]];
		copy.position = [
			point.position[0],
			point.position[1],
			point.position[2],
		];
		copy.markerPosition = [
			point.markerPosition[0],
			point.markerPosition[1],
			point.markerPosition[2],
		];
		return copy;
	}

	private static lerpPoint(
		from: SRBXVec3,
		to: SRBXVec3,
		ratio: number,
	): SRBXVec3 {
		return [
			from[0] + (to[0] - from[0]) * ratio,
			from[1] + (to[1] - from[1]) * ratio,
			from[2] + (to[2] - from[2]) * ratio,
		];
	}

	private static planForwardVerticalProfile<
		T extends SRBXVerticalBuilderPoint,
	>(startSource: T, endSource: T): Array<[T, T]> {
		const start = this.copyVerticalPoint(startSource);
		const end = this.copyVerticalPoint(endSource);
		const horizontal = this.horizontalDistance(
			start.position,
			end.position,
		);
		if (horizontal < 0.001) return [[start, end]];
		const height = end.position[1] - start.position[1];
		const startPitch = (start.anchorPitch * Math.PI) / 180;
		const targetPitch = (-end.anchorPitch * Math.PI) / 180;
		const sinStart = Math.sin(startPitch);
		const cosStart = Math.cos(startPitch);
		const sinTarget = Math.sin(targetPitch);
		const cosTarget = Math.cos(targetPitch);
		const arcXFactor = sinTarget - sinStart;
		const arcYFactor = cosStart - cosTarget;
		const determinant = arcXFactor * sinTarget - arcYFactor * cosTarget;
		let radius = NaN;
		let straightLength = NaN;
		if (Math.abs(determinant) > 0.000000001) {
			radius =
				(horizontal * sinTarget - height * cosTarget) / determinant;
			straightLength =
				(arcXFactor * height - arcYFactor * horizontal) / determinant;
		}
		const angle = targetPitch - startPitch;
		const arcX = radius * arcXFactor;
		const arcY = radius * arcYFactor;
		const canReachTarget =
			isFinite(radius) &&
			isFinite(straightLength) &&
			radius * angle >= -0.0001 &&
			straightLength >= -0.0001 &&
			arcX >= -0.0001 &&
			arcX <= horizontal + 0.0001;
		if (canReachTarget && Math.abs(angle) < 0.0000001) {
			start.anchorLengthVertical = 0;
			end.anchorLengthVertical = 0;
			start.verticalProfile = "straight";
			return [[start, end]];
		}
		if (canReachTarget && straightLength > 0.01 && arcX > 0.001) {
			const ratio = Math.max(0, Math.min(1, arcX / horizontal));
			const p0 = start.position;
			const p1 = this.pointAtYawPitchDistance(
				p0,
				start.anchorYaw,
				0,
				start.anchorLength,
			);
			const p3 = end.position;
			const p2 = this.pointAtYawPitchDistance(
				p3,
				end.anchorYaw,
				0,
				end.anchorLength,
			);
			const a = this.lerpPoint(p0, p1, ratio);
			const b = this.lerpPoint(p1, p2, ratio);
			const c = this.lerpPoint(p2, p3, ratio);
			const d = this.lerpPoint(a, b, ratio);
			const e = this.lerpPoint(b, c, ratio);
			const midXZ = this.lerpPoint(d, e, ratio);
			const mid = this.copyVerticalPoint(start);
			mid.kind = "free";
			mid.position = [midXZ[0], start.position[1] + arcY, midXZ[2]];
			mid.anchorYaw = this.horizontalYaw(mid.position, e);
			mid.anchorPitch = (targetPitch * 180) / Math.PI;
			mid.direction = this.directionFromYaw(mid.anchorYaw);
			mid.markerPosition = [
				mid.position[0],
				mid.position[1],
				mid.position[2],
			];
			mid.slopeTarget = false;
			const leftEnd = this.copyVerticalPoint(mid);
			leftEnd.anchorYaw = this.horizontalYaw(mid.position, d);
			leftEnd.anchorPitch = (-targetPitch * 180) / Math.PI;
			leftEnd.direction = this.directionFromYaw(leftEnd.anchorYaw);
			const ownerYaw = (leftEnd.direction * 45 * Math.PI) / 180;
			const ownerY = Math.floor(mid.position[1] - 1 / 16 + 0.000001);
			leftEnd.ownerBlock = [
				Math.floor(mid.position[0] + Math.sin(ownerYaw) * 0.000001),
				ownerY,
				Math.floor(mid.position[2] + Math.cos(ownerYaw) * 0.000001),
			];
			const connectionOffsets: Array<[number, number]> = [
				[0, -1],
				[-1, -1],
				[-1, 0],
				[-1, 1],
				[0, 1],
				[1, 1],
				[1, 0],
				[1, -1],
			];
			const connectionOffset = connectionOffsets[leftEnd.direction & 7];
			mid.ownerBlock = [
				leftEnd.ownerBlock[0] + connectionOffset[0],
				ownerY,
				leftEnd.ownerBlock[2] + connectionOffset[1],
			];
			start.anchorLength = this.horizontalDistance(p0, a);
			leftEnd.anchorLength = this.horizontalDistance(mid.position, d);
			mid.anchorLength = this.horizontalDistance(mid.position, e);
			end.anchorLength = this.horizontalDistance(p3, c);
			const verticalAnchor = Math.abs(
				radius * (4 / 3) * Math.tan(Math.abs(angle) / 4),
			);
			start.anchorLengthVertical = verticalAnchor;
			leftEnd.anchorLengthVertical = verticalAnchor;
			mid.anchorLengthVertical = 0;
			end.anchorLengthVertical = 0;
			start.verticalProfile = "circular_straight";
			return [
				[start, leftEnd],
				[mid, end],
			];
		}
		const chordPitch = Math.atan2(height, horizontal);
		const reachablePitch = chordPitch * 2 - startPitch;
		const reachableAngle = reachablePitch - startPitch;
		const chordLength = Math.sqrt(
			horizontal * horizontal + height * height,
		);
		const sine = Math.sin(reachableAngle / 2);
		const reachableRadius =
			Math.abs(sine) < 0.000000001 ? Infinity : chordLength / (2 * sine);
		const verticalAnchor = isFinite(reachableRadius)
			? Math.abs(
					reachableRadius *
						(4 / 3) *
						Math.tan(Math.abs(reachableAngle) / 4),
				)
			: 0;
		start.anchorLengthVertical = verticalAnchor;
		end.anchorPitch = (-reachablePitch * 180) / Math.PI;
		end.anchorLengthVertical = verticalAnchor;
		start.verticalProfile = isFinite(reachableRadius)
			? "circular_limited"
			: "straight";
		return [[start, end]];
	}

	static planVerticalRailSegments<T extends SRBXVerticalBuilderPoint>(
		start: T,
		end: T,
	): Array<[T, T]> {
		if (!start.slopeTarget && !end.slopeTarget) {
			const copyStart = this.copyVerticalPoint(start);
			const copyEnd = this.copyVerticalPoint(end);
			copyStart.anchorLengthVertical = copyStart.anchorLength;
			copyEnd.anchorLengthVertical = copyEnd.anchorLength;
			return [[copyStart, copyEnd]];
		}
		if (end.slopeTarget) return this.planForwardVerticalProfile(start, end);
		const reversed = this.planForwardVerticalProfile(end, start);
		const result: Array<[T, T]> = [];
		for (let i = reversed.length - 1; i >= 0; i--)
			result.push([reversed[i][1], reversed[i][0]]);
		return result;
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
