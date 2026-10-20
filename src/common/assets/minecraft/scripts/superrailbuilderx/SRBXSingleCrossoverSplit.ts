import {
	RailCorePos,
	SRBXBuilderPoint,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath } from "./SRBXMath";

export type SRBXSingleCrossoverSplitEdge = {
	start: SRBXBuilderPoint;
	end: SRBXBuilderPoint;
	startSwitch: boolean;
	endSwitch: boolean;
	midpoint: RailCorePos;
	length: number;
};
export type SRBXSingleCrossoverSplitPlan = {
	switches: SRBXBuilderPoint[][];
	normals: SRBXBuilderPoint[][];
	markers: RailCorePos[];
	lengths: number[];
};
const clone = (p: SRBXBuilderPoint): SRBXBuilderPoint =>
	JSON.parse(JSON.stringify(p));
const same = (a: RailCorePos, b: RailCorePos): boolean =>
	a.every((v, i) => Math.abs(v - b[i]) < 0.001);
const lerp = (a: RailCorePos, b: RailCorePos, t: number): RailCorePos =>
	a.map((v, i) => v + (b[i] - v) * t) as RailCorePos;
const distance = (a: RailCorePos, b: RailCorePos): number =>
	SRBXMath.horizontalDistance(a, b);
function midpointPoint(
	position: RailCorePos,
	control: RailCorePos,
): SRBXBuilderPoint {
	const yaw = SRBXMath.horizontalYaw(position, control);
	return {
		kind: "free",
		position: position.slice() as RailCorePos,
		direction: SRBXMath.directionFromYaw(yaw),
		anchorYaw: yaw,
		anchorPitch: 0,
		anchorLength: distance(position, control),
		anchorLengthVertical: 0,
		markerPosition: position.slice() as RailCorePos,
		cantEdge: 0,
		cantCenter: 0,
		cantRandom: 0,
	};
}
/** Split the actual native half-length location, not the cursor or parameter t=.5. */
function halves(
	edge: SRBXSingleCrossoverSplitEdge,
): SRBXBuilderPoint[][] | null {
	const a = edge.start,
		b = edge.end,
		m = edge.midpoint;
	if (
		!isFinite(edge.length) ||
		edge.length < 6 ||
		!m ||
		m.some((v) => !isFinite(v)) ||
		[a, b].some(
			(p) =>
				!p ||
				Math.abs(p.anchorPitch) > 0.001 ||
				Math.abs(p.position[1] - m[1]) > 0.001,
		)
	)
		return null;
	const controls = [
		a.position,
		SRBXMath.pointAtYawPitchDistance(
			a.position,
			a.anchorYaw,
			0,
			a.anchorLength,
		),
		SRBXMath.pointAtYawPitchDistance(
			b.position,
			b.anchorYaw,
			0,
			b.anchorLength,
		),
		b.position,
	];
	let best = 0,
		bestDistance = Infinity;
	for (let i = 0; i <= 64; i++) {
		const d = distance(
			SRBXMath.cubicBezierPoint(
				controls[0],
				controls[1],
				controls[2],
				controls[3],
				i / 64,
			),
			m,
		);
		if (d < bestDistance) {
			bestDistance = d;
			best = i / 64;
		}
	}
	let low = Math.max(0, best - 1 / 64),
		high = Math.min(1, best + 1 / 64);
	for (let i = 0; i < 48; i++) {
		const l = low + (high - low) / 3,
			r = high - (high - low) / 3;
		if (
			distance(
				SRBXMath.cubicBezierPoint(
					controls[0],
					controls[1],
					controls[2],
					controls[3],
					l,
				),
				m,
			) <
			distance(
				SRBXMath.cubicBezierPoint(
					controls[0],
					controls[1],
					controls[2],
					controls[3],
					r,
				),
				m,
			)
		)
			high = r;
		else low = l;
	}
	const t = (low + high) / 2;
	if (
		t < 0.0001 ||
		t > 0.9999 ||
		distance(
			SRBXMath.cubicBezierPoint(
				controls[0],
				controls[1],
				controls[2],
				controls[3],
				t,
			),
			m,
		) > 0.02
	)
		return null;
	const q0 = lerp(controls[0], controls[1], t),
		q1 = lerp(controls[1], controls[2], t),
		q2 = lerp(controls[2], controls[3], t),
		r0 = lerp(q0, q1, t),
		r1 = lerp(q1, q2, t);
	const first = clone(a),
		last = clone(b);
	for (const p of [first, last]) {
		p.kind = "free";
		delete p.core;
		delete p.index;
		p.anchorPitch = 0;
		p.anchorLengthVertical = 0;
		p.cantEdge = p.cantCenter = p.cantRandom = 0;
	}
	first.anchorLength = distance(first.position, q0);
	last.anchorLength = distance(last.position, q2);
	return [
		[first, midpointPoint(m, r0)],
		[midpointPoint(m, r1), last],
	];
}
export class SRBXSingleCrossoverSplit {
	static preview(points: SRBXBuilderPoint[], switchTypes: number[]) {
		const sample = (
			start: SRBXBuilderPoint,
			end: SRBXBuilderPoint,
			ratio = 0.5,
		) => {
			const controls = [
				start.position,
				SRBXMath.pointAtYawPitchDistance(
					start.position,
					start.anchorYaw,
					0,
					start.anchorLength,
				),
				SRBXMath.pointAtYawPitchDistance(
					end.position,
					end.anchorYaw,
					0,
					end.anchorLength,
				),
				end.position,
			];
			const samples: RailCorePos[] = [start.position],
				lengths = [0];
			for (let i = 1; i <= 128; i++) {
				samples.push(
					SRBXMath.cubicBezierPoint(
						controls[0],
						controls[1],
						controls[2],
						controls[3],
						i / 128,
					),
				);
				lengths.push(
					lengths[i - 1] + distance(samples[i - 1], samples[i]),
				);
			}
			const length = lengths[128];
			let index = 1;
			while (index < 128 && lengths[index] < length * ratio) index++;
			const span = lengths[index] - lengths[index - 1];
			return {
				length,
				midpoint: lerp(
					samples[index - 1],
					samples[index],
					span > 0 ? (length * ratio - lengths[index - 1]) / span : 0,
				),
			};
		};
		return switchTypes.join(",") === "1,1,1,1"
			? this.scissorsFromPoints(points, sample)
			: this.fromPoints(points, switchTypes, sample);
	}
	/** Plan the same midpoint split without constructing a four-point native switch. */
	static fromPoints(
		points: SRBXBuilderPoint[],
		switchTypes: number[],
		sample: (
			start: SRBXBuilderPoint,
			end: SRBXBuilderPoint,
		) => {
			midpoint: RailCorePos;
			length: number;
		},
	): SRBXSingleCrossoverSplitPlan | null {
		if (points.length !== 4 || switchTypes.length !== 4) return null;
		const mask = switchTypes.join(",");
		if (mask !== "1,0,0,1" && mask !== "0,1,1,0") return null;
		const switches: number[] = [];
		for (let i = 0; i < 4; i++) if (switchTypes[i] === 1) switches.push(i);
		return this.plan(
			[[0, 1], [2, 3], switches].map(([a, b]) => {
				const measured = sample(points[a], points[b]);
				return {
					start: points[a],
					end: points[b],
					startSwitch: switchTypes[a] === 1,
					endSwitch: switchTypes[b] === 1,
					midpoint: measured.midpoint,
					length: measured.length,
				};
			}),
		);
	}

	static orderScissors(
		mains: SRBXBuilderPoint[][],
	): SRBXBuilderPoint[] | null {
		if (mains.length !== 2 || mains.some((p) => p.length !== 2))
			return null;
		const a = mains[0],
			b = mains[1].slice();
		const dot =
			(a[1].position[0] - a[0].position[0]) *
				(b[1].position[0] - b[0].position[0]) +
			(a[1].position[2] - a[0].position[2]) *
				(b[1].position[2] - b[0].position[2]);
		if (dot < 0) b.reverse();
		if (Math.abs(dot) < 0.001) return null;
		return [a[0], a[1], b[0], b[1]];
	}
	static scissorsFromPoints(
		points: SRBXBuilderPoint[],
		sample: (
			a: SRBXBuilderPoint,
			b: SRBXBuilderPoint,
			ratio: number,
		) => { midpoint: RailCorePos; length: number },
	): SRBXSingleCrossoverSplitPlan | null {
		if (points.length !== 4) return null;
		const divided: SRBXBuilderPoint[][][] = [];
		const markers: RailCorePos[] = [],
			lengths: number[] = [];
		for (const [a, b] of [
			[0, 1],
			[2, 3],
			[0, 3],
			[2, 1],
		]) {
			const first = sample(points[a], points[b], 1 / 3),
				second = sample(points[a], points[b], 2 / 3);
			if (!isFinite(first.length) || first.length < 19.999) return null;
			const initial = halves({
				start: points[a],
				end: points[b],
				startSwitch: true,
				endSwitch: true,
				...first,
			});
			if (!initial) return null;
			const rest = halves({
				start: initial[1][0],
				end: initial[1][1],
				startSwitch: true,
				endSwitch: true,
				midpoint: second.midpoint,
				length: (first.length * 2) / 3,
			});
			if (!rest) return null;
			divided.push([initial[0], rest[0], rest[1]]);
			markers.push(first.midpoint, second.midpoint);
			lengths.push(first.length);
		}
		// Straight central crossing pieces make the intersection independent of the
		// native four-point switch and keep both routes continuous through the centre.
		for (const i of [2, 3]) {
			const middle = divided[i][1],
				yaw = SRBXMath.horizontalYaw(
					middle[0].position,
					middle[1].position,
				),
				length = distance(middle[0].position, middle[1].position);
			if (length < 3) return null;
			middle[0].anchorYaw = yaw;
			middle[1].anchorYaw = SRBXMath.normalizeDegrees(yaw + 180);
			for (const p of middle) {
				p.direction = SRBXMath.directionFromYaw(p.anchorYaw);
				p.anchorLength = length / 3;
			}
			divided[i][0][1] = clone(middle[0]);
			divided[i][0][1].anchorYaw = SRBXMath.normalizeDegrees(
				middle[0].anchorYaw + 180,
			);
			divided[i][2][0] = clone(middle[1]);
			divided[i][2][0].anchorYaw = SRBXMath.normalizeDegrees(
				middle[1].anchorYaw + 180,
			);
			divided[i][0][1].direction = SRBXMath.directionFromYaw(
				divided[i][0][1].anchorYaw,
			);
			divided[i][2][0].direction = SRBXMath.directionFromYaw(
				divided[i][2][0].anchorYaw,
			);
		}
		const switches = [
			[divided[0][0][0], divided[0][0][1], divided[2][0][1]],
			[divided[0][2][1], divided[0][2][0], divided[3][2][0]],
			[divided[1][0][0], divided[1][0][1], divided[3][0][1]],
			[divided[1][2][1], divided[1][2][0], divided[2][2][0]],
		];
		return {
			switches,
			normals: divided.map((p) => p[1]),
			markers,
			lengths: lengths.slice(0, 2),
		};
	}
	static plan(
		edges: SRBXSingleCrossoverSplitEdge[],
	): SRBXSingleCrossoverSplitPlan | null {
		if (!edges || edges.length !== 3) return null;
		const diagonals = edges.filter((e) => e.startSwitch && e.endSwitch),
			mains = edges.filter((e) => e.startSwitch !== e.endSwitch);
		if (diagonals.length !== 1 || mains.length !== 2) return null;
		const diagonal = halves(diagonals[0]);
		if (!diagonal) return null;
		const switches: SRBXBuilderPoint[][] = [],
			normals: SRBXBuilderPoint[][] = [],
			markers: RailCorePos[] = [],
			lengths: number[] = [];
		for (const main of mains) {
			const oriented = main.startSwitch
				? main
				: {
						...main,
						start: main.end,
						end: main.start,
						startSwitch: true,
						endSwitch: false,
					};
			const parts = halves(oriented);
			if (!parts) return null;
			const startHalf = same(
					oriented.start.position,
					diagonals[0].start.position,
				),
				endHalf = same(
					oriented.start.position,
					diagonals[0].end.position,
				);
			if (!startHalf && !endHalf) return null;
			const branchMid = clone(
				startHalf ? diagonal[0][1] : diagonal[1][0],
			);
			switches.push([parts[0][0], parts[0][1], branchMid]);
			// Put the original outer endpoint first so its block owns the normal rail core.
			normals.push([parts[1][1], parts[1][0]]);
			markers.push(main.midpoint.slice() as RailCorePos);
			lengths.push(main.length);
		}
		if (same(switches[0][0].position, switches[1][0].position)) return null;
		markers.push(diagonals[0].midpoint.slice() as RailCorePos);
		return { switches, normals, markers, lengths };
	}
}
