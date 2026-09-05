import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { RailPosition } from "jp.ngt.rtm.rail.util";
import { EntityPlayer } from "net.minecraft.entity.player";
import { BlockPos } from "net.minecraft.util.math";

export class SRBXApiCompat {
	static getRider(entity: unknown) {
		const passengers = (
			entity as jp.ngt.rtm.entity.vehicle.EntityVehicle
		).getPassengers();
		return passengers.size() > 0 ? passengers.get(0) : null;
	}

	static getRidingEntity(entity: unknown) {
		return (
			entity as jp.ngt.rtm.entity.vehicle.EntityVehicle
		).getRidingEntity();
	}

	static getWorld(entity: unknown) {
		return (entity as net.minecraft.entity.Entity).world;
	}

	static getTileEntity(
		world: net.minecraft.world.World,
		x: number,
		y: number,
		z: number,
	) {
		return world.getTileEntity(
			new BlockPos(Math.floor(x), Math.floor(y), Math.floor(z)),
		);
	}

	static dismountPlayer(entity: unknown): void {
		const rider = this.getRider(entity);
		if (rider) rider.dismountRidingEntity();
	}

	static startRiding(entity: unknown, targetEntity: unknown): void {
		void entity;
		void targetEntity;
	}

	static doFollowing(entity: unknown, hostPlayer: unknown): void {
		const followEntity = entity as net.minecraft.entity.Entity | null;
		const hostEntity = hostPlayer as net.minecraft.entity.Entity | null;
		if (!followEntity || !hostEntity) return;
		followEntity.setPosition(
			hostEntity.posX,
			hostEntity.posY + 3,
			hostEntity.posZ,
		);
		followEntity.motionX = 0;
		followEntity.motionY = 0;
		followEntity.motionZ = 0;
	}

	static getHorizontalAnchorYaw(rp: RailPosition): number {
		return rp.anchorYaw;
	}

	static getHorizontalAnchorLength(rp: RailPosition): number {
		return rp.anchorLengthHorizontal;
	}

	static getVerticalAnchorLength(rp: RailPosition): number {
		return rp.anchorLengthVertical;
	}

	static getRailPositionAnchorPitch(rp: RailPosition): number {
		return rp.anchorPitch;
	}

	static getRailPositionCantEdge(rp: RailPosition): number {
		return rp.cantEdge;
	}

	static getRailPositionCantCenter(rp: RailPosition): number {
		return rp.cantCenter;
	}

	static getRailPositionCantRandom(rp: RailPosition): number {
		return rp.cantRandom;
	}

	static getRailPositionConnectionMarkerPosition(
		rp: RailPosition,
	): [number, number, number] {
		const revision = RailPosition.REVISION[rp.direction];
		return [
			Math.floor(rp.blockX + 0.5 + revision[0] * 2) + 0.5,
			rp.blockY + rp.height / 16,
			Math.floor(rp.blockZ + 0.5 + revision[1] * 2) + 0.5,
		];
	}

	static getRailCorePos(
		core: TileEntityLargeRailCore,
	): [number, number, number] {
		const pos = core.getPos();
		return [pos.getX(), pos.getY(), pos.getZ()];
	}

	static getRailPositionCandidateKey(core: TileEntityLargeRailCore): string {
		const pos = core.getPos();
		return `core:${pos.getX()},${pos.getY()},${pos.getZ()}`;
	}

	static getEditableRailPositions(
		core: TileEntityLargeRailCore,
	): JavaObjectArray<RailPosition> {
		return core.getRailPositions();
	}

	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean {
		void core;
		return false;
	}

	static getRailPositionUnsupportedReason(
		core: TileEntityLargeRailCore,
	): string {
		void core;
		return "unsupported_target";
	}

	static refreshRailPositionClient(
		core: TileEntityLargeRailCore,
		index: number,
		x: number,
		y: number,
		z: number,
	): void {
		void core;
		void index;
		void x;
		void y;
		void z;
	}

	static validateRailPositionMove(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
		void core;
		void index;
		void originalX;
		void originalY;
		void originalZ;
		void x;
		void y;
		void z;
		return "unsupported";
	}

	static moveRailPosition(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
		player?: EntityPlayer,
	): string {
		void core;
		void index;
		void originalX;
		void originalY;
		void originalZ;
		void x;
		void y;
		void z;
		void player;
		return "unsupported";
	}

	static validateRailPositionMoveAsNormal(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
		return "unsupported";
	}

	static moveRailPositionAsNormal(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
		return "unsupported";
	}

	static createBuilderRail(
		world: net.minecraft.world.World,
		player: net.minecraft.entity.player.EntityPlayer,
		start: unknown,
		end: unknown,
		additionalProtectedRailKeys?: string[],
		sourceRail?: unknown,
		fallbackProperty?: unknown,
		forceNormal?: boolean,
		preferFallbackProperty?: boolean,
	) {
		void world;
		void player;
		void start;
		void end;
		void additionalProtectedRailKeys;
		void sourceRail;
		void fallbackProperty;
		void forceNormal;
		void preferFallbackProperty;
		return { status: "unsupported" };
	}

	static undoBuilderRail(
		world: net.minecraft.world.World,
		coreX: number,
		coreY: number,
		coreZ: number,
		expectedKey: string,
	): string {
		void world;
		void coreX;
		void coreY;
		void coreZ;
		void expectedKey;
		return "unsupported";
	}

	static getLogicalRailMap(core: TileEntityLargeRailCore) {
		return core.getAllRailMaps().length === 1
			? core.getRailMap(null)
			: null;
	}

	static splitBuilderRail(
		world: net.minecraft.world.World,
		player: net.minecraft.entity.player.EntityPlayer,
		core: [number, number, number],
		expectedKey: string,
		ratio: number,
	) {
		void world;
		void player;
		void core;
		void expectedKey;
		void ratio;
		return { status: "unsupported_target" };
	}

	static undoSplitBuilderRail(
		world: net.minecraft.world.World,
		undoToken: string,
	): string {
		void world;
		void undoToken;
		return "unsupported_target";
	}
}
