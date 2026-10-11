import { SRBXMath, SRBXVec3 } from "./SRBXMath";
import { SRBXBuilderPoint } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";

export type SRBXBuilderDesign = {
	length: number;
	radius: number;
	yaw: number;
	slopePermil: number;
	verticalCurveRadius: number;
};

/** The same plan is used by preview and the server; a design never moves its start. */
export class SRBXBuilderGeometry {
	static horizontalLength(
		start: SRBXBuilderPoint,
		end: SRBXBuilderPoint,
	): number {
		const a: SRBXVec3 = [start.position[0], 0, start.position[2]];
		const b: SRBXVec3 = [end.position[0], 0, end.position[2]];
		return SRBXMath.cubicBezierLength(
			a,
			SRBXMath.pointAtYawPitchDistance(
				a,
				start.anchorYaw,
				0,
				start.anchorLength,
			),
			SRBXMath.pointAtYawPitchDistance(
				b,
				end.anchorYaw,
				0,
				end.anchorLength,
			),
			b,
		);
	}

	static straightSlope(
		start: SRBXBuilderPoint,
		end: SRBXBuilderPoint,
		permil: number,
	): void {
		const length = this.horizontalLength(start, end);
		const pitch = SRBXMath.pitchFromPermil(permil);
		end.position[1] = start.position[1] + (length * permil) / 1000;
		start.anchorPitch = pitch;
		end.anchorPitch = -pitch;
		const verticalLength =
			(length * Math.sqrt(1 + Math.pow(permil / 1000, 2))) / 3;
		start.anchorLengthVertical = verticalLength;
		end.anchorLengthVertical = verticalLength;
		start.slopeTarget = false;
		end.slopeTarget = false;
	}

	static plan(
		source: SRBXBuilderPoint,
		design: SRBXBuilderDesign,
	): [SRBXBuilderPoint, SRBXBuilderPoint] | null {
		if (
			!source ||
			!source.position ||
			source.position.length !== 3 ||
			source.position.some((value) => !isFinite(value)) ||
			(source.kind !== "free" && source.kind !== "rail") ||
			!isFinite(source.anchorYaw) ||
			!isFinite(source.anchorPitch) ||
			!design ||
			!isFinite(design.length) ||
			design.length < 1 ||
			design.length > 2048 ||
			!isFinite(design.radius) ||
			Math.abs(design.radius) < 1 ||
			Math.abs(design.radius) > 10000 ||
			!isFinite(design.yaw) ||
			!isFinite(design.slopePermil) ||
			Math.abs(design.slopePermil) > 1000 ||
			!isFinite(design.verticalCurveRadius) ||
			design.verticalCurveRadius < 1000 ||
			design.verticalCurveRadius > 1000000
		)
			return null;
		const start = {} as SRBXBuilderPoint;
		for (const key in source) (start as any)[key] = (source as any)[key];
		start.position = source.position.slice() as SRBXVec3;
		const yaw =
			start.kind === "rail"
				? start.anchorYaw
				: SRBXMath.normalizeDegrees(design.yaw);
		const horizontal =
			design.length /
			Math.sqrt(1 + Math.pow(design.slopePermil / 1000, 2));
		// A single cubic arc cannot represent a loop or a full turn reliably.
		if (
			Math.abs(design.radius) < 10000 &&
			horizontal / Math.abs(design.radius) >= Math.PI
		)
			return null;
		const curve = SRBXMath.continueCircularCurve(
			start.position,
			yaw,
			design.radius,
			horizontal,
		);
		const anchor =
			curve.angle === 0
				? horizontal / 3
				: SRBXMath.circularAnchorLength(design.radius, curve.angle);
		const end: SRBXBuilderPoint = {
			kind: "free",
			position: curve.position,
			direction: SRBXMath.directionFromYaw(curve.endYaw + 180),
			anchorYaw: SRBXMath.normalizeDegrees(curve.endYaw + 180),
			anchorPitch: 0,
			anchorLength: anchor,
			markerPosition: curve.position.slice() as SRBXVec3,
		};
		start.anchorYaw = yaw;
		start.direction = SRBXMath.directionFromYaw(yaw);
		start.anchorLength = anchor;
		start.curveRadius =
			Math.abs(design.radius) >= 10000 ? undefined : design.radius;
		this.straightSlope(start, end, design.slopePermil);
		if (start.kind === "rail") {
			start.anchorPitch = source.anchorPitch;
			end.slopeTarget = true;
			end.verticalCurveRadius = design.verticalCurveRadius;
			start.anchorLengthVertical = undefined;
			end.anchorLengthVertical = undefined;
		}
		for (const point of [start, end]) {
			if (point.kind !== "free") continue;
			point.markerPosition = SRBXMath.markerBlockDisplayPosition(
				point.position,
				point.direction,
				1 / 16,
			);
			point.ownerBlock = [
				Math.floor(point.markerPosition[0]),
				Math.floor(point.position[1] - 1 / 16 + 0.000001),
				Math.floor(point.markerPosition[2]),
			];
		}
		return [start, end];
	}
}
