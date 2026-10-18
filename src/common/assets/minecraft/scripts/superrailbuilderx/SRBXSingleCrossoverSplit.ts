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
