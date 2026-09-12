import { RTMItem } from "jp.ngt.rtm";
import {
	BlockMarker,
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
} from "jp.ngt.rtm.rail";
import { ItemRail } from "jp.ngt.rtm.item";
import { ResourceStateRail } from "jp.ngt.rtm.modelpack.state";
import { RailMapBasic, RailPosition } from "jp.ngt.rtm.rail.util";
import { EntityPlayer } from "net.minecraft.entity.player";
import { BlockPos } from "net.minecraft.util.math";
import { World } from "net.minecraft.world";
import { ArrayList } from "java.util";

type RailCorePos = [number, number, number];

export type AppleExtendedBuilderPoint = {
	kind: "free" | "rail";
	position: RailCorePos;
	direction: number;
	anchorYaw: number;
	anchorPitch: number;
	anchorLength: number;
	anchorLengthVertical?: number;
	markerPosition: RailCorePos;
	ownerBlock?: RailCorePos;
	cantEdge?: number;
	cantCenter?: number;
	cantRandom?: number;
	core?: RailCorePos;
	index?: number;
};

export type AppleExtendedSourceRail = {
	core: RailCorePos;
	railKey: string;
	startPosition: RailCorePos;
	endPosition: RailCorePos;
};

/**
 * Temporary SRBX-side implementation for RTM operations missing from AE.
 * Keep AE-specific assumptions here so each method can be removed when AE
 * exposes an equivalent supported API.
 */
export class AppleExtendedRailCompat {
	private static normalizeDegrees(angle: number): number {
		let result = angle % 360;
		if (result < 0) result += 360;
		return result;
	}

	private static directionFromYaw(yaw: number): number {
		return Math.round(this.normalizeDegrees(yaw) / 45) & 7;
	}

	private static coreKey(core: TileEntityLargeRailCore): string {
		const pos = core.getPos();
		return `core:${pos.getX()},${pos.getY()},${pos.getZ()}`;
	}

	private static validatePoint(point: AppleExtendedBuilderPoint): string {
		if (!point || (point.kind !== "free" && point.kind !== "rail"))
			return "invalid_point";
		const values = [
			point.position && point.position[0],
			point.position && point.position[1],
			point.position && point.position[2],
			point.anchorYaw,
			point.anchorPitch,
			point.anchorLength,
		];
		for (let i = 0; i < values.length; i++)
			if (!isFinite(values[i])) return "invalid_point";
		if (point.anchorLength < 0) return "invalid_point";
		if (
			point.kind === "rail" &&
			(!point.core ||
				point.index === undefined ||
				Math.floor(point.index) !== point.index)
		)
			return "invalid_rail_point";
		return "ok";
	}

	private static cloneRailPosition(source: RailPosition): RailPosition {
		const target = new RailPosition(
			source.blockX,
			source.blockY,
			source.blockZ,
			source.direction,
			source.switchType,
		);
		return RailPosition.readFromNBT(source.writeToNBT(), target);
	}

	private static createFreePoint(
		point: AppleExtendedBuilderPoint,
	): RailPosition {
		const direction = this.directionFromYaw(point.anchorYaw);
		const radians = (direction * 45 * Math.PI) / 180;
		const epsilon = 0.000001;
		const owner = point.ownerBlock;
		const result = new RailPosition(
			owner
				? Math.floor(owner[0])
				: Math.floor(point.position[0] + Math.sin(radians) * epsilon),
			owner
				? Math.floor(owner[1])
				: Math.floor(point.position[1] - 1 / 16 + epsilon),
			owner
				? Math.floor(owner[2])
				: Math.floor(point.position[2] + Math.cos(radians) * epsilon),
			direction,
			0,
		);
		result.anchorYaw = this.normalizeDegrees(point.anchorYaw);
		result.anchorPitch = point.anchorPitch;
		result.anchorLengthHorizontal = point.anchorLength;
		result.anchorLengthVertical =
			point.anchorLengthVertical === undefined
				? point.anchorLength
				: point.anchorLengthVertical;
		if (point.cantEdge !== undefined) result.cantEdge = point.cantEdge;
		if (point.cantCenter !== undefined)
			result.cantCenter = point.cantCenter;
		if (point.cantRandom !== undefined)
			result.cantRandom = point.cantRandom;
		result.setPosition(
			point.position[0],
			point.position[1],
			point.position[2],
		);
		return result;
	}

	private static resolveRailPoint(
		world: World,
		point: AppleExtendedBuilderPoint,
	): RailPosition | null {
		if (!point.core || point.index === undefined) return null;
		const tile = world.getTileEntity(
			new BlockPos(point.core[0], point.core[1], point.core[2]),
		);
		if (!(tile instanceof TileEntityLargeRailBase)) return null;
		const core = tile.getRailCore();
		if (!core) return null;
		const positions = core.getRailPositions();
		if (!positions || point.index < 0 || point.index >= positions.length)
			return null;
		const source = positions[point.index];
		if (
			Math.abs(source.posX - point.position[0]) > 0.001 ||
			Math.abs(source.posY - point.position[1]) > 0.001 ||
			Math.abs(source.posZ - point.position[2]) > 0.001
		)
			return null;
		const result = this.cloneRailPosition(source);
		const neighbor = source.getNeighborBlockPos();
		result.blockX = neighbor.getX();
		result.blockY = neighbor.getY();
		result.blockZ = neighbor.getZ();
		result.direction = (source.direction + 4) & 7;
		result.anchorYaw = this.normalizeDegrees(source.anchorYaw + 180);
		result.anchorPitch = -source.anchorPitch;
		result.setPosition(source.posX, source.posY, source.posZ);
		return result;
	}

	private static propertyFromPlayer(
		player: EntityPlayer,
	): ResourceStateRail | null {
		const held = player.inventory.getCurrentItem();
		if (!held || held.getItem() !== RTMItem.itemLargeRail) return null;
		return (held.getItem() as ItemRail).getModelState(held);
	}

	private static propertyFromPoint(
		world: World,
		point: AppleExtendedBuilderPoint,
	): ResourceStateRail | null {
		if (point.kind !== "rail" || !point.core) return null;
		const tile = world.getTileEntity(
			new BlockPos(point.core[0], point.core[1], point.core[2]),
		);
		if (!(tile instanceof TileEntityLargeRailBase)) return null;
		const core = tile.getRailCore();
		return core ? core.getResourceState() : null;
	}

	private static propertyFromSource(
		world: World,
		source: AppleExtendedSourceRail,
	): ResourceStateRail | null {
		const tile = world.getTileEntity(
			new BlockPos(source.core[0], source.core[1], source.core[2]),
		);
		if (!(tile instanceof TileEntityLargeRailBase)) return null;
		const core = tile.getRailCore();
		if (!core || this.coreKey(core) !== source.railKey) return null;
		const positions = core.getRailPositions();
		if (!positions || positions.length !== 2) return null;
		const expected = [source.startPosition, source.endPosition];
		for (let i = 0; i < 2; i++)
			if (
				Math.abs(positions[i].posX - expected[i][0]) > 0.001 ||
				Math.abs(positions[i].posY - expected[i][1]) > 0.001 ||
				Math.abs(positions[i].posZ - expected[i][2]) > 0.001
			)
				return null;
		return core.getResourceState();
	}

	static createNormalRail(
		world: World,
		player: EntityPlayer,
		start: AppleExtendedBuilderPoint,
		end: AppleExtendedBuilderPoint,
		fallbackProperty?: unknown,
		sourceRail?: AppleExtendedSourceRail,
		preferFallbackProperty = false,
		propertySourcePoint?: AppleExtendedBuilderPoint,
	): { status: string; undoCore?: RailCorePos; undoKey?: string } {
		const startStatus = this.validatePoint(start);
		if (startStatus !== "ok") return { status: startStatus };
		const endStatus = this.validatePoint(end);
		if (endStatus !== "ok") return { status: endStatus };
		const dx = end.position[0] - start.position[0];
		const dy = end.position[1] - start.position[1];
		const dz = end.position[2] - start.position[2];
		const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
		if (length < 0.01) return { status: "rail_too_short" };
		if (
			start.anchorLength > Math.max(1, length * 4) ||
			end.anchorLength > Math.max(1, length * 4)
		)
			return { status: "invalid_anchor_length" };

		const sourceProperty = sourceRail
			? this.propertyFromSource(world, sourceRail)
			: null;
		if (sourceRail && !sourceProperty)
			return { status: "source_rail_changed" };
		const fallback = fallbackProperty as ResourceStateRail | undefined;
		const property =
			(preferFallbackProperty ? fallback : undefined) ||
			this.propertyFromPlayer(player) ||
			sourceProperty ||
			(propertySourcePoint
				? this.propertyFromPoint(world, propertySourcePoint)
				: null) ||
			this.propertyFromPoint(world, start) ||
			this.propertyFromPoint(world, end) ||
			fallback;
		if (!property)
			return {
				status: sourceRail ? "source_rail_changed" : "hold_rail_item",
			};
		const startRP =
			start.kind === "rail"
				? this.resolveRailPoint(world, start)
				: this.createFreePoint(start);
		const endRP =
			end.kind === "rail"
				? this.resolveRailPoint(world, end)
				: this.createFreePoint(end);
		if (!startRP || !endRP) return { status: "rail_endpoint_changed" };

		const positions = new ArrayList<RailPosition>();
		if (startRP.posY <= endRP.posY) {
			positions.add(startRP);
			positions.add(endRP);
		} else {
			positions.add(endRP);
			positions.add(startRP);
		}
		const first = positions.get(0);
		if (
			!BlockMarker.createRail(
				world,
				first.blockX,
				first.blockY,
				first.blockZ,
				positions,
				property,
				true,
				player.capabilities.isCreativeMode,
			)
		)
			return { status: "create_failed" };
		const tile = world.getTileEntity(
			new BlockPos(first.blockX, first.blockY, first.blockZ),
		);
		if (!(tile instanceof TileEntityLargeRailCore))
			return { status: "create_failed" };
		const pos = tile.getPos();
		return {
			status: "ok",
			undoCore: [pos.getX(), pos.getY(), pos.getZ()],
			undoKey: this.coreKey(tile),
		};
	}

	static undoNormalRail(
		world: World,
		corePos: RailCorePos,
		expectedKey: string,
	): string {
		const tile = world.getTileEntity(
			new BlockPos(corePos[0], corePos[1], corePos[2]),
		);
		if (!(tile instanceof TileEntityLargeRailBase))
			return "undo_rail_not_found";
		const core = tile.getRailCore();
		if (!core) return "undo_rail_not_found";
		if (this.coreKey(core) !== expectedKey) return "undo_rail_changed";
		if (core.isTrainOnRail()) return "rail_occupied";
		const map = core.getRailMap(null);
		if (!map) return "undo_rail_not_found";
		map.breakRail(world, core.getResourceState(), core);
		return "ok";
	}
}
