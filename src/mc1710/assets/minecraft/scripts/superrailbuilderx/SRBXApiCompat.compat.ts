import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { RailPosition } from "jp.ngt.rtm.rail.util";
import { EntityPlayer } from "net.minecraft.entity.player";

export class SRBXApiCompat {
	static getRider(entity: unknown) {
		return (entity as jp.ngt.rtm.entity.vehicle.EntityVehicle)
			.riddenByEntity;
	}

	static getRidingEntity(entity: unknown) {
		return (entity as jp.ngt.rtm.entity.vehicle.EntityVehicle).ridingEntity;
	}

	static getWorld(entity: unknown) {
		return (entity as net.minecraft.entity.Entity).worldObj;
	}

	static getTileEntity(
		world: net.minecraft.world.World,
		x: number,
		y: number,
		z: number,
	) {
		return world.getTileEntity(Math.floor(x), Math.floor(y), Math.floor(z));
	}

	static dismountPlayer(entity: unknown): void {
		const rider = this.getRider(entity);
		if (rider) rider.mountEntity(null as net.minecraft.entity.Entity);
	}

	static startRiding(entity: unknown, targetEntity: unknown): void {
		(entity as net.minecraft.entity.Entity).mountEntity(
			targetEntity as net.minecraft.entity.Entity,
		);
	}

	static doFollowing(entity: unknown, hostPlayer: unknown): void {
		void entity;
		void hostPlayer;
	}

	static getHorizontalAnchorYaw(rp: RailPosition): number {
		return rp.anchorDirection;
	}

	static getHorizontalAnchorLength(rp: RailPosition): number {
		return rp.anchorLength;
	}

	static getVerticalAnchorLength(rp: RailPosition): number {
		return rp.anchorLength;
	}

	static getRailPositionAnchorPitch(rp: RailPosition): number {
		void rp;
		return 0;
	}

	static getRailPositionCantEdge(rp: RailPosition): number {
		void rp;
		return 0;
	}

	static getRailPositionCantCenter(rp: RailPosition): number {
		void rp;
		return 0;
	}

	static getRailPositionCantRandom(rp: RailPosition): number {
		void rp;
		return 0;
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
		return [core.xCoord, core.yCoord, core.zCoord];
	}

	static getRailPositionCandidateKey(core: TileEntityLargeRailCore): string {
		return `core:${core.xCoord},${core.yCoord},${core.zCoord}`;
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
