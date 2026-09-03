import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { RailMap, RailPosition } from "jp.ngt.rtm.rail.util";
import { Entity } from "net.minecraft.entity";
import { EntityPlayer } from "net.minecraft.entity.player";
import { TileEntity } from "net.minecraft.tileentity";
import { World } from "net.minecraft.world";

export type RailCorePos = [x: number, y: number, z: number];

export type SRBXBuilderPoint = {
	kind: "free" | "rail";
	position: RailCorePos;
	direction: number;
	anchorYaw: number;
	anchorPitch: number;
	anchorLength: number;
	anchorLengthVertical?: number;
	markerPosition: RailCorePos;
	ownerBlock?: RailCorePos;
	curveRadius?: number;
	slopeTarget?: boolean;
	verticalCurveRadius?: number;
	verticalProfile?: "circular_straight" | "circular_limited" | "straight";
	core?: RailCorePos;
	index?: number;
};

export type SRBXBuilderCreateResult = {
	status: string;
	undoCore?: RailCorePos;
	undoKey?: string;
};

export type SRBXRailSplitResult = {
	status: string;
	undoToken?: string;
};

export class SRBXApiCompat {
	static getRider(entity: unknown): Entity | null;
	static getRidingEntity(entity: unknown): Entity | null;
	static getWorld(entity: unknown): World;
	static getTileEntity(
		world: World,
		x: number,
		y: number,
		z: number,
	): TileEntity | null;
	static dismountPlayer(entity: unknown): void;
	static startRiding(entity: unknown, targetEntity: unknown): void;
	static doFollowing(entity: unknown, hostPlayer: unknown): void;
	static getHorizontalAnchorYaw(rp: RailPosition): number;
	static getHorizontalAnchorLength(rp: RailPosition): number;
	static getRailPositionAnchorPitch(rp: RailPosition): number;
	static getRailPositionConnectionMarkerPosition(
		rp: RailPosition,
	): RailCorePos;
	static getRailCorePos(core: TileEntityLargeRailCore): RailCorePos;
	static getRailPositionCandidateKey(core: TileEntityLargeRailCore): string;
	static getEditableRailPositions(
		core: TileEntityLargeRailCore,
	): JavaObjectArray<RailPosition>;
	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean;
	static getRailPositionUnsupportedReason(
		core: TileEntityLargeRailCore,
	): string;
	static refreshRailPositionClient(
		core: TileEntityLargeRailCore,
		index: number,
		x: number,
		y: number,
		z: number,
	): void;
	static validateRailPositionMove(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string;
	static moveRailPosition(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string;
	static validateRailPositionMoveAsNormal(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string;
	static moveRailPositionAsNormal(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string;
	static createBuilderRail(
		world: World,
		player: EntityPlayer,
		start: SRBXBuilderPoint,
		end: SRBXBuilderPoint,
		additionalProtectedRailKeys?: string[],
	): SRBXBuilderCreateResult;
	static undoBuilderRail(
		world: World,
		coreX: number,
		coreY: number,
		coreZ: number,
		expectedKey: string,
	): string;
	static getLogicalRailMap(core: TileEntityLargeRailCore): RailMap | null;
	static splitBuilderRail(
		world: World,
		player: EntityPlayer,
		core: RailCorePos,
		expectedKey: string,
		ratio: number,
	): SRBXRailSplitResult;
	static undoSplitBuilderRail(world: World, undoToken: string): string;
}
