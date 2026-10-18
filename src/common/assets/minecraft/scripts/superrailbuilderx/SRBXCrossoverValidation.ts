import { SRBXCrossoverPlan } from "./SRBXCrossoverPlan";

/** Validate the bounded, horizontal four-marker request before touching a world. */
export function validateCrossoverPlan(plan: SRBXCrossoverPlan): string {
	if (
		!plan ||
		!Array.isArray(plan.points) ||
		plan.points.length !== 4 ||
		!Array.isArray(plan.switchTypes) ||
		plan.switchTypes.length !== 4
	)
		return "invalid_request";
	const mask = plan.switchTypes.join(",");
	if (mask !== "1,0,0,1" && mask !== "0,1,1,0" && mask !== "1,1,1,1")
		return "invalid_switch_layout";
	const vector = (v: unknown): v is number[] =>
		Array.isArray(v) &&
		v.length === 3 &&
		v.every((n) => typeof n === "number" && isFinite(n));
	if (
		plan.source &&
		(!vector(plan.source.core) ||
			!vector(plan.source.startPosition) ||
			!vector(plan.source.endPosition) ||
			typeof plan.source.railKey !== "string")
	)
		return "invalid_source_rail";
	for (let i = 0; i < 4; i++) {
		const p = plan.points[i];
		if (
			!p ||
			(p.kind !== "free" && p.kind !== "rail") ||
			!vector(p.markerPosition) ||
			(p.ownerBlock !== undefined && !vector(p.ownerBlock)) ||
			!isFinite(p.direction) ||
			Math.floor(p.direction) !== p.direction ||
			p.direction < 0 ||
			p.direction > 7 ||
			!Array.isArray(p.position) ||
			p.position.length !== 3 ||
			p.position.some((v) => typeof v !== "number" || !isFinite(v)) ||
			typeof p.anchorYaw !== "number" ||
			!isFinite(p.anchorYaw) ||
			typeof p.anchorPitch !== "number" ||
			!isFinite(p.anchorPitch) ||
			typeof p.anchorLength !== "number" ||
			!isFinite(p.anchorLength) ||
			p.anchorLength < 0 ||
			p.anchorLength > 512 ||
			(p.anchorLengthVertical !== undefined &&
				(!isFinite(p.anchorLengthVertical) ||
					p.anchorLengthVertical < 0 ||
					p.anchorLengthVertical > 512))
		)
			return "invalid_point";
		if (
			p.kind === "rail" &&
			(!vector(p.core) ||
				typeof p.index !== "number" ||
				!isFinite(p.index) ||
				Math.floor(p.index) !== p.index ||
				p.index < 0)
		)
			return "invalid_connection";
		if (
			Math.abs(p.anchorPitch) > 0.001 ||
			Math.abs(p.position[1] - plan.points[0].position[1]) > 0.001
		)
			return "sloped_or_changed_rail";
		for (let j = 0; j < i; j++) {
			const q = plan.points[j];
			const d = Math.sqrt(
				Math.pow(p.position[0] - q.position[0], 2) +
					Math.pow(p.position[2] - q.position[2], 2),
			);
			if (d < 0.1 || d > 1024) return "invalid_switch_layout";
		}
	}
	return "ok";
}
