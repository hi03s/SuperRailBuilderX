import {
	SRBXBuilderPoint,
	SRBXSourceRail,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath } from "./SRBXMath";
export type SRBXCrossoverPlan = {
	points: SRBXBuilderPoint[];
	switchTypes: number[];
	source?: SRBXSourceRail;
};
export class SRBXCrossoverGeometry {
	static flat(points: SRBXBuilderPoint[]): boolean {
		return (
			points.length >= 2 &&
			points.every(
				(p) =>
					p &&
					p.position.every((v) => isFinite(v)) &&
					Math.abs(p.anchorPitch) < 0.0001 &&
					Math.abs(p.position[1] - points[0].position[1]) < 0.001,
			)
		);
	}
	static plan(
		base: [SRBXBuilderPoint, SRBXBuilderPoint],
		spacing: number,
		mode: number,
		source?: SRBXSourceRail,
	): SRBXCrossoverPlan | null {
		if (
			!this.flat(base) ||
			!isFinite(spacing) ||
			spacing < 0.1 ||
			spacing > 64 ||
			mode < 0 ||
			mode > 5 ||
			mode !== Math.floor(mode)
		)
			return null;
		// With yaw=0 the rail points toward +Z, so the right side is -X.
		const distance = spacing * (mode < 3 ? -1 : 1);
		const points = base.map(
			(p) => JSON.parse(JSON.stringify(p)) as SRBXBuilderPoint,
		);
		for (let i = 0; i < 2; i++) {
			const p = JSON.parse(JSON.stringify(base[i])) as SRBXBuilderPoint;
			const yaw = ((p.anchorYaw + (i === 1 ? 180 : 0)) * Math.PI) / 180;
			p.position = [
				p.position[0] + Math.cos(yaw) * distance,
				p.position[1],
				p.position[2] - Math.sin(yaw) * distance,
			];
			p.kind = "free";
			p.core = undefined;
			p.index = undefined;
			p.ownerBlock = undefined;
			p.direction = SRBXMath.directionFromYaw(p.anchorYaw);
			p.markerPosition = p.position.slice() as [number, number, number];
			points.push(p);
		}
		const sourceChord = SRBXMath.horizontalDistance(
			base[0].position,
			base[1].position,
		);
		const offsetChord = SRBXMath.horizontalDistance(
			points[2].position,
			points[3].position,
		);
		const dx = base[1].position[0] - base[0].position[0],
			dz = base[1].position[2] - base[0].position[2];
		if (
			sourceChord < 2 ||
			dx * (points[3].position[0] - points[2].position[0]) +
				dz * (points[3].position[2] - points[2].position[2]) <=
				sourceChord * sourceChord * 0.01
		)
			return null;
		for (let i = 2; i < 4; i++) {
			points[i].anchorLength *= offsetChord / sourceChord;
			if (points[i].anchorLengthVertical !== undefined)
				points[i].anchorLengthVertical! *= offsetChord / sourceChord;
		}
		const switchTypes =
			mode % 3 === 2
				? [1, 1, 1, 1]
				: (mode % 3 === 0) === mode < 3
					? [1, 0, 0, 1]
					: [0, 1, 1, 0];
		for (const point of points)
			point.cantEdge = point.cantCenter = point.cantRandom = 0;
		return { points, switchTypes, source };
	}
}
