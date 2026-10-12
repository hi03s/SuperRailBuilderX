import { RailPosition } from "jp.ngt.rtm.rail.util";
import {
	SRBXApiCompat,
	SRBXBuilderPoint,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath } from "./SRBXMath";
import { SRBXRailBoundary } from "./SRBXRailBoundary";

type Pair = { start: SRBXBuilderPoint; end: SRBXBuilderPoint };

/** Platform offsets follow the source plan and grade, with a level cross section. */
export class SRBXPlatformGeometry {
	static offset(
		a: RailPosition,
		b: RailPosition,
		distance: number,
		height: number,
	): Pair | null {
		const point = (
			rp: RailPosition,
			reverse: boolean,
		): SRBXBuilderPoint => {
			const yaw = SRBXApiCompat.getHorizontalAnchorYaw(rp);
			const radians = ((yaw + (reverse ? 180 : 0)) * Math.PI) / 180;
			const position: [number, number, number] = [
				rp.posX + Math.cos(radians) * distance,
				rp.posY + height,
				rp.posZ - Math.sin(radians) * distance,
			];
			return {
				kind: "free",
				position,
				direction: SRBXMath.directionFromYaw(yaw),
				anchorYaw: yaw,
				anchorPitch: SRBXApiCompat.getRailPositionAnchorPitch(rp),
				anchorLength: SRBXApiCompat.getHorizontalAnchorLength(rp),
				anchorLengthVertical: SRBXApiCompat.getVerticalAnchorLength(rp),
				markerPosition: position.slice() as [number, number, number],
				cantEdge: 0,
				cantCenter: 0,
				cantRandom: 0,
			};
		};
		const start = point(a, false),
			end = point(b, true);
		const dx = b.posX - a.posX,
			dz = b.posZ - a.posZ;
		const ox = end.position[0] - start.position[0],
			oz = end.position[2] - start.position[2];
		const squared = dx * dx + dz * dz;
		if (squared <= 0.000001 || dx * ox + dz * oz <= squared * 0.01)
			return null;
		const scale = Math.sqrt((ox * ox + oz * oz) / squared);
		start.anchorLength *= scale;
		end.anchorLength *= scale;
		if (start.anchorLengthVertical !== undefined)
			start.anchorLengthVertical *= scale;
		if (end.anchorLengthVertical !== undefined)
			end.anchorLengthVertical *= scale;
		return { start, end };
	}

	static assignOwners(plans: Pair[]): void {
		const points: SRBXBuilderPoint[] = [];
		for (let i = 0; i < plans.length; i++)
			points.push(plans[i].start, plans[i].end);
		for (let i = 0; i < points.length; i++) {
			const p = points[i],
				boundary = SRBXApiCompat.requiresRailBoundarySnap();
			if (boundary)
				p.position = SRBXRailBoundary.snap(
					p.position,
					p.anchorYaw,
					p.anchorPitch,
				);
			const direction = SRBXMath.directionFromYaw(p.anchorYaw),
				radians = (direction * Math.PI) / 4;
			p.direction = boundary
				? SRBXRailBoundary.direction(p.position, p.anchorYaw)
				: direction;
			p.ownerBlock = boundary
				? SRBXRailBoundary.owner(p.position, p.anchorYaw)
				: [
						Math.floor(
							p.position[0] + Math.sin(radians) * 0.000001,
						),
						Math.floor(p.position[1] - 1 / 16 + 0.000001),
						Math.floor(
							p.position[2] + Math.cos(radians) * 0.000001,
						),
					];
			p.markerPosition = [
				p.ownerBlock[0] + 0.5,
				p.position[1],
				p.ownerBlock[2] + 0.5,
			];
		}
		const paired: boolean[] = [];
		for (let i = 0; i < points.length; i++) {
			if (paired[i]) continue;
			for (let j = i + 1; j < points.length; j++) {
				if (
					paired[j] ||
					SRBXMath.distance(points[i].position, points[j].position) >
						0.01
				)
					continue;
				const owner = points[i].ownerBlock!,
					revision =
						RailPosition.REVISION[
							SRBXMath.directionFromYaw(points[i].anchorYaw)
						];
				points[j].ownerBlock = [
					Math.floor(owner[0] + 0.5 + revision[0] * 2),
					owner[1],
					Math.floor(owner[2] + 0.5 + revision[1] * 2),
				];
				points[j].markerPosition = [
					points[j].ownerBlock![0] + 0.5,
					points[j].position[1],
					points[j].ownerBlock![2] + 0.5,
				];
				paired[i] = paired[j] = true;
				break;
			}
		}
	}
}
