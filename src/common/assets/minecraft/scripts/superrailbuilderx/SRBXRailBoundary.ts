import { RailMap } from "jp.ngt.rtm.rail.util";

type Position = [number, number, number];

/** Geometry only. The caller still validates the world, connections and ownership. */
export class SRBXRailBoundary {
	static readonly EPSILON = 0.0000001;
	private static readonly SAMPLE_SPLIT = 100000000;

	static isBoundary(position: Position, yaw: number): boolean {
		if (!position || !isFinite(yaw) || position.some((v) => !isFinite(v)))
			return false;
		const angle = (yaw * Math.PI) / 180;
		return (
			(Math.abs(Math.sin(angle)) > 0.000001 &&
				Math.abs(position[0] - Math.round(position[0])) <=
					this.EPSILON) ||
			(Math.abs(Math.cos(angle)) > 0.000001 &&
				Math.abs(position[2] - Math.round(position[2])) <= this.EPSILON)
		);
	}

	/** Move along the endpoint tangent to the closest crossed block face. */
	static snap(position: Position, yaw: number, pitch = 0): Position {
		if (
			!position ||
			!isFinite(yaw) ||
			!isFinite(pitch) ||
			position.some((v) => !isFinite(v))
		)
			throw new Error("invalid_boundary_position");
		const angle = (yaw * Math.PI) / 180;
		const dx = Math.sin(angle),
			dz = Math.cos(angle);
		const tx =
			Math.abs(dx) > 0.000001
				? (Math.round(position[0]) - position[0]) / dx
				: Infinity;
		const tz =
			Math.abs(dz) > 0.000001
				? (Math.round(position[2]) - position[2]) / dz
				: Infinity;
		const xFace = Math.abs(tx) <= Math.abs(tz);
		const distance = xFace ? tx : tz;
		return [
			xFace ? Math.round(position[0]) : position[0] + dx * distance,
			position[1] + Math.tan((pitch * Math.PI) / 180) * distance,
			xFace ? position[2] + dz * distance : Math.round(position[2]),
		];
	}

	/** Owner on the rail's inward tangent side, rather than its rounded marker direction. */
	static owner(position: Position, yaw: number): Position {
		const angle = (yaw * Math.PI) / 180;
		const component = (v: number) => (Math.abs(v) < 0.000001 ? 0 : v);
		return [
			Math.floor(position[0] + component(Math.sin(angle)) * 0.000001),
			Math.floor(position[1] - 1 / 16 + 0.000001),
			Math.floor(position[2] + component(Math.cos(angle)) * 0.000001),
		];
	}

	/** Native marker direction must cross the selected face; anchorYaw stays precise. */
	static direction(position: Position, yaw: number): number {
		const angle = (yaw * Math.PI) / 180;
		const dx = Math.sin(angle),
			dz = Math.cos(angle);
		const x =
			Math.abs(dx) > 0.000001 &&
			Math.abs(position[0] - Math.round(position[0])) <= this.EPSILON;
		const z =
			Math.abs(dz) > 0.000001 &&
			Math.abs(position[2] - Math.round(position[2])) <= this.EPSILON;
		if (x && z) return dx > 0 ? (dz > 0 ? 1 : 3) : dz > 0 ? 7 : 5;
		if (x) return dx > 0 ? 2 : 6;
		if (z) return dz > 0 ? 0 : 4;
		throw new Error("invalid_boundary_direction");
	}

	static snapShared(position: Position, yaws: number[], pitch = 0): Position {
		if (!yaws.length) throw new Error("missing_boundary_tangent");
		const candidate = this.snap(position, yaws[0], pitch);
		if (yaws.every((yaw) => this.isBoundary(candidate, yaw)))
			return candidate;
		const x = Math.round(position[0]),
			z = Math.round(position[2]);
		const angle = (yaws[0] * Math.PI) / 180;
		const distance =
			(x - position[0]) * Math.sin(angle) +
			(z - position[2]) * Math.cos(angle);
		return [
			x,
			position[1] + distance * Math.tan((pitch * Math.PI) / 180),
			z,
		];
	}

	/** Preserve a signed circular radius and choose the nearest grid crossing on it. */
	static findCircularBoundary(
		origin: Position,
		yaw: number,
		radius: number,
		arcLength: number,
	): {
		position: Position;
		endYaw: number;
		angle: number;
		arcLength: number;
	} | null {
		if (
			!isFinite(radius) ||
			!isFinite(yaw) ||
			!isFinite(arcLength) ||
			Math.abs(radius) < 0.001 ||
			arcLength <= 0
		)
			return null;
		const start = (yaw * Math.PI) / 180;
		const target = start - arcLength / radius;
		const cx = origin[0] - radius * Math.cos(start),
			cz = origin[2] + radius * Math.sin(start);
		const targetX = cx + radius * Math.cos(target),
			targetZ = cz - radius * Math.sin(target);
		let best: {
			position: Position;
			endYaw: number;
			angle: number;
			arcLength: number;
		} | null = null;
		let bestDistance = Infinity;
		const accept = (theta: number, axis: number, plane: number) => {
			theta += Math.round((target - theta) / (2 * Math.PI)) * 2 * Math.PI;
			const length = (start - theta) * radius;
			const distance = Math.abs(length - arcLength);
			if (length <= 0 || distance > 1.5 || distance >= bestDistance)
				return;
			const position: Position = [
				cx + radius * Math.cos(theta),
				origin[1],
				cz - radius * Math.sin(theta),
			];
			position[axis] = plane;
			const endYaw = (theta * 180) / Math.PI;
			if (!this.isBoundary(position, endYaw)) return;
			bestDistance = distance;
			best = {
				position,
				endYaw,
				angle: ((length / radius) * 180) / Math.PI,
				arcLength: length,
			};
		};
		for (
			let plane = Math.ceil(targetX - 1.5);
			plane <= Math.floor(targetX + 1.5);
			plane++
		) {
			const v = (plane - cx) / radius;
			if (Math.abs(v) <= 1) {
				const theta = Math.acos(v);
				accept(theta, 0, plane);
				accept(-theta, 0, plane);
			}
		}
		for (
			let plane = Math.ceil(targetZ - 1.5);
			plane <= Math.floor(targetZ + 1.5);
			plane++
		) {
			const v = (cz - plane) / radius;
			if (Math.abs(v) <= 1) {
				const theta = Math.asin(v);
				accept(theta, 2, plane);
				accept(Math.PI - theta, 2, plane);
			}
		}
		return best;
	}

	static normalizePoint<
		T extends {
			kind: string;
			position: Position;
			anchorYaw: number;
			anchorPitch: number;
			direction?: number;
			ownerBlock?: Position;
			markerPosition?: Position;
		},
	>(point: T): T {
		if (point.kind !== "free") return point;
		const result = {} as T;
		for (const key in point)
			if (Object.prototype.hasOwnProperty.call(point, key))
				result[key] = point[key];
		result.position = this.snap(
			point.position,
			point.anchorYaw,
			point.anchorPitch,
		);
		result.ownerBlock = this.owner(result.position, point.anchorYaw);
		result.direction = this.direction(result.position, point.anchorYaw);
		result.markerPosition = [
			result.ownerBlock[0] + 0.5,
			result.ownerBlock[1] + 1 / 16,
			result.ownerBlock[2] + 0.5,
		];
		return result;
	}

	/** Find an actual curve/block-face intersection near the requested split. */
	static findMapBoundary(
		map: RailMap,
		ratio: number,
		minRatio = 0,
		maxRatio = 1,
	): { ratio: number; position: Position } | null {
		if (
			!map ||
			!isFinite(ratio) ||
			!isFinite(minRatio) ||
			!isFinite(maxRatio)
		)
			return null;
		minRatio = Math.max(0, minRatio);
		maxRatio = Math.min(1, maxRatio);
		if (minRatio > maxRatio) return null;
		const length = Number(map.getLength());
		if (!isFinite(length) || length <= 0) return null;
		ratio = Math.max(minRatio, Math.min(maxRatio, ratio));
		const point = (t: number): Position => {
			const index = Math.round(t * this.SAMPLE_SPLIT);
			const p = map.getRailPos(this.SAMPLE_SPLIT, index);
			return [
				Number(p[1]),
				Number(map.getRailHeight(this.SAMPLE_SPLIT, index)),
				Number(p[0]),
			];
		};
		const from = Math.max(minRatio, ratio - 1.5 / length);
		const to = Math.min(maxRatio, ratio + 1.5 / length);
		const count = Math.max(1, Math.ceil((to - from) * length * 8));
		let best: { ratio: number; position: Position } | null = null;
		let bestDistance = Infinity;
		const accept = (t: number, axis: number, plane: number) => {
			const p = point(t);
			p[axis] = plane;
			const left = point(Math.max(0, t - 0.001 / length));
			const right = point(Math.min(1, t + 0.001 / length));
			const yaw =
				(Math.atan2(right[0] - left[0], right[2] - left[2]) * 180) /
				Math.PI;
			if (!this.isBoundary(p, yaw)) return;
			const distance = Math.abs(t - ratio);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = { ratio: t, position: p };
			}
		};
		const requested = point(ratio);
		for (const axis of [0, 2])
			if (
				Math.abs(requested[axis] - Math.round(requested[axis])) <=
				this.EPSILON
			)
				accept(ratio, axis, Math.round(requested[axis]));
		for (let i = 0; i < count; i++) {
			const a = from + ((to - from) * i) / count,
				b = from + ((to - from) * (i + 1)) / count;
			const pa = point(a),
				pb = point(b);
			for (const axis of [0, 2]) {
				if (Math.abs(pa[axis] - pb[axis]) < this.EPSILON) continue;
				for (
					let plane = Math.ceil(Math.min(pa[axis], pb[axis]));
					plane <= Math.floor(Math.max(pa[axis], pb[axis]));
					plane++
				) {
					let low = a,
						high = b;
					const increasing = pb[axis] > pa[axis];
					for (
						let k = 0;
						k < 32 && high - low > 1 / this.SAMPLE_SPLIT;
						k++
					) {
						const middle = (low + high) / 2;
						if (point(middle)[axis] < plane === increasing)
							low = middle;
						else high = middle;
					}
					accept((low + high) / 2, axis, plane);
				}
			}
		}
		return best;
	}
}
