import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { TileEntityLargeRailBase } from "jp.ngt.rtm.rail";
import { RailMap, RailPosition } from "jp.ngt.rtm.rail.util";
import { NGTOBuilderUtilClient } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtilClient";
import {
	SRBXApiCompat,
	SRBXBuilderPoint,
	SRBXSourceRail,
	RailCorePos,
} from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXMath, SRBXVec3 } from "./SRBXMath";
import { SRBXRailBoundary } from "./SRBXRailBoundary";
import { SRBXEndpointAvailability } from "./SRBXEndpointAvailability";
import { SRBXCrossoverGeometry } from "./SRBXCrossoverPlan";
const SNAP_RADIUS = 0.5;
type SelectedRail = { core: RailCorePos; railKey: string };
function railPoint(map: RailMap, split: number, index: number): SRBXVec3 {
	const pos = map.getRailPos(split, index);
	return [pos[1], map.getRailHeight(split, index), pos[0]];
}
function findHoverRail(
	entity: EntityVehicle,
	partialTicks: number,
): SelectedRail | null {
	const looking = NGTOBuilderUtilClient.getLookingPos(partialTicks);
	if (!looking) return null;
	const world = SRBXApiCompat.getWorld(entity);
	const seen: { [key: string]: boolean } = {};
	let best: SelectedRail | null = null;
	let bestDistance = 2.25;
	for (let dx = -1; dx <= 1; dx++) {
		for (let dy = -1; dy <= 1; dy++) {
			for (let dz = -1; dz <= 1; dz++) {
				const tile = SRBXApiCompat.getTileEntity(
					world,
					looking.posX + dx,
					looking.posY + dy,
					looking.posZ + dz,
				);
				if (!(tile instanceof TileEntityLargeRailBase)) continue;
				const core = tile.getRailCore();
				if (!core) continue;
				const railKey = SRBXApiCompat.getRailPositionCandidateKey(core);
				if (seen[railKey]) continue;
				seen[railKey] = true;
				const map = SRBXApiCompat.getLogicalRailMap(core);
				if (!map) continue;
				const split = Math.max(
					8,
					Math.min(256, Math.ceil(map.getLength() * 4)),
				);
				const index = map.getNearlestPoint(
					split,
					looking.posX,
					looking.posZ,
				);
				const position = railPoint(map, split, index);
				const distance =
					Math.pow(position[0] - looking.posX, 2) +
					Math.pow(position[1] - looking.posY, 2) +
					Math.pow(position[2] - looking.posZ, 2);
				if (distance >= bestDistance) continue;
				bestDistance = distance;
				best = { core: SRBXApiCompat.getRailCorePos(core), railKey };
			}
		}
	}
	return best;
}
function sourcePoint(rp: RailPosition): SRBXBuilderPoint {
	return {
		kind: "free",
		position: [rp.posX, rp.posY, rp.posZ],
		direction: rp.direction,
		anchorYaw: SRBXApiCompat.getHorizontalAnchorYaw(rp),
		anchorPitch: SRBXApiCompat.getRailPositionAnchorPitch(rp),
		anchorLength: SRBXApiCompat.getHorizontalAnchorLength(rp),
		anchorLengthVertical: SRBXApiCompat.getVerticalAnchorLength(rp),
		markerPosition: [rp.posX, rp.posY, rp.posZ],
		cantEdge: SRBXApiCompat.getRailPositionCantEdge(rp),
		cantCenter: SRBXApiCompat.getRailPositionCantCenter(rp),
		cantRandom: SRBXApiCompat.getRailPositionCantRandom(rp),
	};
}
function connectionCandidate(
	entity: EntityVehicle,
	point: SRBXBuilderPoint,
	excluded: { [key: string]: boolean },
): SRBXBuilderPoint | null {
	const world = SRBXApiCompat.getWorld(entity);
	const center = point.position;
	const seen: { [key: string]: boolean } = {};
	let best: SRBXBuilderPoint | null = null;
	let bestDistance = SNAP_RADIUS * SNAP_RADIUS;
	for (
		let x = Math.floor(center[0]) - 1;
		x <= Math.floor(center[0]) + 1;
		x++
	) {
		for (
			let y = Math.floor(center[1]) - 1;
			y <= Math.floor(center[1]) + 1;
			y++
		) {
			for (
				let z = Math.floor(center[2]) - 1;
				z <= Math.floor(center[2]) + 1;
				z++
			) {
				const tile = SRBXApiCompat.getTileEntity(world, x, y, z);
				if (!(tile instanceof TileEntityLargeRailBase)) continue;
				const core = tile.getRailCore();
				if (!core) continue;
				const railKey = SRBXApiCompat.getRailPositionCandidateKey(core);
				if (seen[railKey] || excluded[railKey]) continue;
				seen[railKey] = true;
				if (
					SRBXApiCompat.getRailPositionUnsupportedReason(core) !==
						"" &&
					SRBXApiCompat.getRailPositionUnsupportedReason(core) !==
						"switch"
				)
					continue;
				const positions = SRBXApiCompat.getEditableRailPositions(core);
				const corePos = SRBXApiCompat.getRailCorePos(core);
				for (let index = 0; index < positions.length; index++) {
					const rp = positions[index] as RailPosition;
					if (
						!rp ||
						Math.abs(SRBXApiCompat.getRailPositionAnchorPitch(rp)) >
							0.0001 ||
						!SRBXEndpointAvailability.isAvailable(
							world,
							core,
							rp,
							SRBXApiCompat.getLoadedRailCores(
								world,
								center[0],
								center[2],
								2,
							),
						)
					)
						continue;
					if (
						SRBXApiCompat.requiresRailBoundarySnap() &&
						!SRBXRailBoundary.isBoundary(
							[rp.posX, rp.posY, rp.posZ],
							SRBXApiCompat.getHorizontalAnchorYaw(rp),
						)
					)
						continue;
					const dx = rp.posX - center[0];
					const dy = rp.posY - center[1];
					const dz = rp.posZ - center[2];
					const distance = dx * dx + dy * dy + dz * dz;
					if (distance > bestDistance) continue;
					bestDistance = distance;
					best = {
						kind: "rail",
						position: [rp.posX, rp.posY, rp.posZ],
						direction: (rp.direction + 4) & 7,
						anchorYaw: SRBXMath.normalizeDegrees(
							SRBXApiCompat.getHorizontalAnchorYaw(rp) + 180,
						),
						anchorPitch:
							-SRBXApiCompat.getRailPositionAnchorPitch(rp),
						anchorLength: point.anchorLength,
						anchorLengthVertical: point.anchorLengthVertical,
						markerPosition:
							SRBXApiCompat.getRailPositionConnectionMarkerPosition(
								rp,
							),
						core: corePos,
						index,
						cantEdge: point.cantEdge,
						cantCenter: point.cantCenter,
						cantRandom: point.cantRandom,
					};
				}
			}
		}
	}
	return best;
}
export class SRBXCrossoverClient {
	static base(
		entity: EntityVehicle,
		partialTicks: number,
	): {
		points: [SRBXBuilderPoint, SRBXBuilderPoint];
		source: SRBXSourceRail;
	} | null {
		const target = findHoverRail(entity, partialTicks);
		if (!target) return null;
		const world = SRBXApiCompat.getWorld(entity);
		const tile = SRBXApiCompat.getTileEntity(
			world,
			target.core[0],
			target.core[1],
			target.core[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase)) return null;
		const core = tile.getRailCore();
		if (
			!core ||
			SRBXApiCompat.getRailPositionUnsupportedReason(core) !== ""
		)
			return null;
		const rp = SRBXApiCompat.getEditableRailPositions(core);
		if (!rp || rp.length !== 2) return null;
		const points: [SRBXBuilderPoint, SRBXBuilderPoint] = [
			sourcePoint(rp[0]),
			sourcePoint(rp[1]),
		];
		if (!SRBXCrossoverGeometry.flat(points)) return null;
		if (!SRBXApiCompat.isHorizontalBuilderRail(core)) return null;
		return {
			points,
			source: {
				core: target.core,
				railKey: target.railKey,
				startPosition: points[0].position,
				endPosition: points[1].position,
			},
		};
	}
	static snap(
		entity: EntityVehicle,
		point: SRBXBuilderPoint,
		source?: SRBXSourceRail,
	): SRBXBuilderPoint {
		const excluded: { [key: string]: boolean } = {};
		if (source) excluded[source.railKey] = true;
		return connectionCandidate(entity, point, excluded) || point;
	}
}
