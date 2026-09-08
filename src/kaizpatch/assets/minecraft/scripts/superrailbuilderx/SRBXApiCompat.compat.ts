import { NGTLog } from "jp.ngt.ngtlib.io";
import { NGTUtil } from "jp.ngt.ngtlib.util";
import { RTMItem, RTMRail } from "jp.ngt.rtm";
import {
	BlockLargeRailBase,
	BlockMarker,
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
	TileEntityLargeRailSwitchCore,
} from "jp.ngt.rtm.rail";
import { ItemRail } from "jp.ngt.rtm.item";
import {
	RailMaker,
	RailMapBasic,
	RailPosition,
	RailProperty,
} from "jp.ngt.rtm.rail.util";
import { EntityPlayer } from "net.minecraft.entity.player";
import { NBTTagCompound } from "net.minecraft.nbt";
import { ArrayList } from "java.util";

type RailSectionCore = TileEntityLargeRailCore & {
	fixRTMRailMapVersion: number;
	configureRailSection(
		groupId: java.util.UUID,
		logicalPositions: JavaObjectArray<RailPosition>,
		sectionPositions: JavaObjectArray<RailPosition>,
		startRatio: number,
		endRatio: number,
		corePositions: java.util.List<number[]>,
	): void;
	getLogicalRailPositions(): JavaObjectArray<RailPosition> | null;
	getRailGroupCorePositions(): java.util.List<number[]> | null;
	getRailGroupId(): { toString(): string } | null;
	isRailSection(): boolean;
	readSectionData(parent: NBTTagCompound): void;
	writeSectionData(parent: NBTTagCompound): void;
};

type NormalRailCore = TileEntityLargeRailCore & {
	fixRTMRailMapVersion: number;
};

type BuilderPoint = {
	kind: "free" | "rail";
	position: [number, number, number];
	direction: number;
	anchorYaw: number;
	anchorPitch: number;
	anchorLength: number;
	anchorLengthVertical?: number;
	markerPosition: [number, number, number];
	ownerBlock?: [number, number, number];
	curveRadius?: number;
	slopeTarget?: boolean;
	verticalCurveRadius?: number;
	verticalProfile?:
		| "circular_straight"
		| "straight_circular"
		| "circular_limited"
		| "straight";
	core?: [number, number, number];
	index?: number;
	cantEdge?: number;
	cantCenter?: number;
	cantRandom?: number;
};

type SourceRail = {
	core: [number, number, number];
	railKey: string;
	startPosition: [number, number, number];
	endPosition: [number, number, number];
};

type SplitCreatedRail = {
	core: [number, number, number];
	key: string;
};

type SplitUndoRecord = {
	positions: RailPosition[];
	property: RailProperty;
	signal: any;
	subRails: java.util.List<RailProperty>;
	created: SplitCreatedRail[];
	wasSectioned: boolean;
	cants?: CantUndoRecord;
};

type SplitClientUpdate = {
	removed: SplitCreatedRail[];
	refreshed: SplitCreatedRail[];
};

type CantTarget = {
	core: [number, number, number];
	railKey: string;
	index: number;
	position: [number, number, number];
	angle: number;
};

type CantUndoRecord = Array<{
	core: [number, number, number];
	railKey: string;
	positions: RailPosition[];
}>;

type RailSectionPlan = {
	getStartRatio(): number;
	getEndRatio(): number;
	getStartRP(): RailPosition;
	getEndRP(): RailPosition;
};

type RailSectionMap = {
	getRailBlockList(property: RailProperty): java.util.List<JavaIntArray>;
	getStartRP(): RailPosition;
	getEndRP(): RailPosition;
	getLength(): number;
	getRailPos(split: number, index: number): JavaDoubleArray;
	getRailHeight(split: number, index: number): number;
	getRailYaw(split: number, index: number): number;
};

declare const Packages: {
	jp: {
		kaiz: {
			kaizpatch: {
				rtm: {
					rail: {
						TileEntityLargeRailSectionCore: Function;
						util: {
							RailChunkSectioner: {
								split(
									source: RailMapBasic,
								): java.util.List<RailSectionPlan>;
							};
							RailMapSection: new (
								source: RailMapBasic,
								start: RailPosition,
								end: RailPosition,
								startRatio: number,
								endRatio: number,
							) => RailSectionMap;
						};
					};
				};
			};
		};
	};
};

export class SRBXApiCompat {
	private static splitUndoRecords: { [token: string]: SplitUndoRecord } = {};
	private static lastSplitClientUpdate: SplitClientUpdate | null = null;
	private static lastRailPositionMoveCores: Array<[number, number, number]> =
		[];
	private static cantUndoRecords: { [token: string]: CantUndoRecord } = {};
	private static lastCantClientUpdate: Array<[number, number, number]> = [];
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
		const neighbor = this.getBuilderConnectionBlock(rp);
		return [
			neighbor[0] + 0.5,
			neighbor[1] + rp.height / 16,
			neighbor[2] + 0.5,
		];
	}

	private static getBuilderConnectionBlock(
		rp: RailPosition,
	): [number, number, number] {
		const revision = RailPosition.REVISION[rp.direction];
		return [
			Math.floor(rp.blockX + 0.5 + revision[0] * 2),
			rp.blockY,
			Math.floor(rp.blockZ + 0.5 + revision[1] * 2),
		];
	}

	private static getCoreWorld(core: TileEntityLargeRailCore) {
		return core.getWorldObj();
	}

	private static markCoreDirty(core: TileEntityLargeRailCore): void {
		core.markDirty();
	}

	private static isSectionCore(
		core: TileEntityLargeRailCore,
	): core is RailSectionCore {
		return (
			core instanceof
			Packages.jp.kaiz.kaizpatch.rtm.rail.TileEntityLargeRailSectionCore
		);
	}

	private static copyRailPositions(positions: {
		length: number;
		[index: number]: RailPosition;
	}): RailPosition[] {
		const copies: RailPosition[] = [];
		for (let i = 0; i < positions.length; i++)
			copies.push(RailPosition.readFromNBT(positions[i].writeToNBT()));
		return copies;
	}

	private static toJavaList(positions: {
		length: number;
		[index: number]: RailPosition;
	}): java.util.List<RailPosition> {
		const list = new ArrayList<RailPosition>();
		for (let i = 0; i < positions.length; i++) list.add(positions[i]);
		return list;
	}

	private static toRailPositionArray(
		positions: RailPosition[],
	): JavaObjectArray<RailPosition> {
		const result = java.lang.reflect.Array.newInstance(
			RailPosition.class,
			positions.length,
		) as JavaObjectArray<RailPosition>;
		for (let i = 0; i < positions.length; i++) result[i] = positions[i];
		return result;
	}

	private static createIntPosition(
		x: number,
		y: number,
		z: number,
	): number[] {
		const result = java.lang.reflect.Array.newInstance(
			java.lang.Integer.TYPE,
			3,
		) as number[];
		java.lang.reflect.Array.setInt(result, 0, x);
		java.lang.reflect.Array.setInt(result, 1, y);
		java.lang.reflect.Array.setInt(result, 2, z);
		return result;
	}

	private static positionKey(x: number, y: number, z: number): string {
		return `${x},${y},${z}`;
	}

	private static createSectionPlan(
		core: TileEntityLargeRailCore,
		positions: RailPosition[],
	): {
		source: RailMapBasic;
		sections: java.util.List<RailSectionPlan>;
		coreKeys: { [key: string]: boolean };
	} {
		const currentMap = core.getRailMap(null);
		const mapVersion =
			currentMap instanceof RailMapBasic
				? currentMap.fixRTMRailMapVersion
				: RailMapBasic.fixRTMRailMapVersionCurrent;
		const source = new RailMapBasic(positions[0], positions[1], mapVersion);
		const sections =
			Packages.jp.kaiz.kaizpatch.rtm.rail.util.RailChunkSectioner.split(
				source,
			);
		const coreKeys: { [key: string]: boolean } = {};
		for (let i = 0; i < sections.size(); i++) {
			const rp = sections.get(i).getStartRP();
			coreKeys[this.positionKey(rp.blockX, rp.blockY, rp.blockZ)] = true;
		}
		return { source, sections, coreKeys };
	}

	private static createMovedPositions(
		positions: { length: number; [index: number]: RailPosition },
		index: number,
		x: number,
		y: number,
		z: number,
	): RailPosition[] {
		const moved = this.copyRailPositions(positions);
		moved[index].setPosition(x, y, z);
		return moved;
	}

	private static validateRoadbedPath(
		core: TileEntityLargeRailCore,
		positions: RailPosition[],
		strict: boolean,
	): string {
		const world = this.getCoreWorld(core);
		const property = core.getProperty();
		const currentMap = core.getRailMap(null);
		const mapVersion =
			currentMap instanceof RailMapBasic
				? currentMap.fixRTMRailMapVersion
				: RailMapBasic.fixRTMRailMapVersionCurrent;
		const railMap = new RailMapBasic(
			positions[0],
			positions[1],
			mapVersion,
		);
		const blocks = railMap.getRailBlockList(property);
		const sectionPlan = strict
			? this.createSectionPlan(core, positions)
			: null;
		let conflicts = 0;
		let plannedCoreConflicts = 0;
		let retainedCrossingCores = 0;
		let overlappingForeignRoadbeds = 0;
		const samples: string[] = [];
		const plannedCoreSamples: string[] = [];
		const plannedCoreConflictKeys: { [key: string]: boolean } = {};
		for (let i = 0; i < blocks.size(); i++) {
			const pos = blocks.get(i);
			if (world.isAirBlock(pos[0], pos[1], pos[2])) continue;
			const block = world.getBlock(pos[0], pos[1], pos[2]);
			if (block instanceof BlockMarker) continue;
			if (block instanceof BlockLargeRailBase) {
				const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
				if (tile instanceof TileEntityLargeRailBase) {
					const owner = tile.getRailCore();
					if (owner && core.isSameLogicalRail(owner)) continue;
				}
				if (!block.isCore()) {
					overlappingForeignRoadbeds++;
					continue;
				}
				if (
					sectionPlan &&
					!sectionPlan.coreKeys[
						this.positionKey(pos[0], pos[1], pos[2])
					]
				) {
					retainedCrossingCores++;
					continue;
				}
				if (sectionPlan) {
					const key = this.positionKey(pos[0], pos[1], pos[2]);
					if (!plannedCoreConflictKeys[key]) plannedCoreConflicts++;
					plannedCoreConflictKeys[key] = true;
					if (plannedCoreSamples.length < 8)
						plannedCoreSamples.push(
							`${pos[0]},${pos[1]},${pos[2]}:${block.getUnlocalizedName()}`,
						);
					continue;
				}
			}
			conflicts++;
			if (samples.length < 8)
				samples.push(
					`${pos[0]},${pos[1]},${pos[2]}:${block.getUnlocalizedName()}`,
				);
		}
		if (sectionPlan) {
			for (let i = 0; i < sectionPlan.sections.size(); i++) {
				const rp = sectionPlan.sections.get(i).getStartRP();
				const key = this.positionKey(rp.blockX, rp.blockY, rp.blockZ);
				if (plannedCoreConflictKeys[key]) continue;
				if (world.isAirBlock(rp.blockX, rp.blockY, rp.blockZ)) continue;
				const block = world.getBlock(rp.blockX, rp.blockY, rp.blockZ);
				if (block instanceof BlockMarker) continue;
				if (block instanceof BlockLargeRailBase) {
					if (!block.isCore()) continue;
					const tile = world.getTileEntity(
						rp.blockX,
						rp.blockY,
						rp.blockZ,
					);
					if (tile instanceof TileEntityLargeRailBase) {
						const owner = tile.getRailCore();
						if (owner && core.isSameLogicalRail(owner)) continue;
					}
				}
				plannedCoreConflictKeys[key] = true;
				plannedCoreConflicts++;
				if (plannedCoreSamples.length < 8)
					plannedCoreSamples.push(
						`${rp.blockX},${rp.blockY},${rp.blockZ}:${block.getUnlocalizedName()}`,
					);
			}
		}
		if (plannedCoreConflicts > 0) {
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] planned section core conflict: count=${plannedCoreConflicts}, samples=${plannedCoreSamples.join(";")}`,
			);
			return `section_core_conflict(${plannedCoreConflicts})`;
		}
		if (conflicts > 0) {
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] ${strict ? "roadbed conflict" : "normal roadbed obstacles retained"}: count=${conflicts}, samples=${samples.join(";")}`,
			);
			if (strict) return `roadbed_conflict(${conflicts})`;
		}
		if (overlappingForeignRoadbeds > 0)
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] allowing overlapping foreign roadbed: count=${overlappingForeignRoadbeds}`,
			);
		if (retainedCrossingCores > 0)
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] allowing section crossing over retained foreign cores: count=${retainedCrossingCores}`,
			);
		return "ok";
	}

	private static logSectionCorePlan(
		core: RailSectionCore,
		positions: RailPosition[],
	): void {
		try {
			const world = this.getCoreWorld(core);
			const sections = this.createSectionPlan(core, positions).sections;
			const samples: string[] = [];
			for (let i = 0; i < sections.size() && i < 12; i++) {
				const rp = sections.get(i).getStartRP();
				const block = world.getBlock(rp.blockX, rp.blockY, rp.blockZ);
				const occupant = world.isAirBlock(
					rp.blockX,
					rp.blockY,
					rp.blockZ,
				)
					? "air"
					: block.getUnlocalizedName();
				samples.push(
					`${rp.blockX},${rp.blockY},${rp.blockZ}:${occupant}`,
				);
			}
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] planned section cores: count=${sections.size()}, samples=${samples.join(";")}`,
			);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] planned section core diagnostic failed: ${error}`,
			);
		}
	}

	private static hasRetainedForeignCoreCrossing(
		core: RailSectionCore,
		positions: RailPosition[],
	): boolean {
		const world = this.getCoreWorld(core);
		const plan = this.createSectionPlan(core, positions);
		const blocks = plan.source.getRailBlockList(core.getProperty());
		for (let i = 0; i < blocks.size(); i++) {
			const pos = blocks.get(i);
			const block = world.getBlock(pos[0], pos[1], pos[2]);
			if (!(block instanceof BlockLargeRailBase) || !block.isCore())
				continue;
			const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
			if (tile instanceof TileEntityLargeRailBase) {
				const owner = tile.getRailCore();
				if (owner && core.isSameLogicalRail(owner)) continue;
			}
			if (!plan.coreKeys[this.positionKey(pos[0], pos[1], pos[2])])
				return true;
		}
		return false;
	}

	private static placeRoadbedInAir(
		world: net.minecraft.world.World,
		railMap: {
			getRailBlockList(
				property: RailProperty,
			): java.util.List<JavaIntArray>;
		},
		coreX: number,
		coreY: number,
		coreZ: number,
		property: RailProperty,
		context: string,
	): boolean {
		const blocks = railMap.getRailBlockList(property);
		let added = 0;
		let retained = 0;
		let failed = 0;
		for (let i = 0; i < blocks.size(); i++) {
			const pos = blocks.get(i);
			if (!world.isAirBlock(pos[0], pos[1], pos[2])) {
				retained++;
				continue;
			}
			if (
				!world.setBlock(
					pos[0],
					pos[1],
					pos[2],
					RTMRail.largeRailBase0,
					0,
					2,
				)
			) {
				failed++;
				continue;
			}
			const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
			if (!(tile instanceof TileEntityLargeRailBase)) {
				failed++;
				continue;
			}
			tile.setStartPoint(coreX, coreY, coreZ);
			tile.markDirty();
			added++;
		}
		NGTLog.debug(
			`[SuperRailBuilderX RailPosition] air-only roadbed placement: context=${context}, added=${added}, retained=${retained}, failed=${failed}`,
		);
		return failed === 0;
	}

	private static createSectionedRailPreservingForeignCores(
		core: RailSectionCore,
		positions: RailPosition[],
		property: RailProperty,
	): boolean {
		const world = this.getCoreWorld(core);
		const plan = this.createSectionPlan(core, positions);
		if (plan.sections.size() <= 1) return false;
		const groupId = java.util.UUID.randomUUID();
		const logicalPositions = this.copyRailPositions(positions);
		const logicalArray = this.toRailPositionArray(logicalPositions);
		const corePositions = new ArrayList<number[]>();
		const placedCoreKeys: { [key: string]: boolean } = {};
		const overwrittenRoadbeds: Array<{
			x: number;
			y: number;
			z: number;
			ownerX: number;
			ownerY: number;
			ownerZ: number;
		}> = [];
		let replacedForeignRoadbeds = 0;
		for (let i = 0; i < plan.sections.size(); i++) {
			const rp = plan.sections.get(i).getStartRP();
			const existingBlock = world.getBlock(
				rp.blockX,
				rp.blockY,
				rp.blockZ,
			);
			if (
				existingBlock instanceof BlockLargeRailBase &&
				!existingBlock.isCore()
			) {
				replacedForeignRoadbeds++;
				const existingTile = world.getTileEntity(
					rp.blockX,
					rp.blockY,
					rp.blockZ,
				);
				if (existingTile instanceof TileEntityLargeRailBase) {
					const owner = existingTile.getRailCore();
					if (owner)
						overwrittenRoadbeds.push({
							x: rp.blockX,
							y: rp.blockY,
							z: rp.blockZ,
							ownerX: owner.xCoord,
							ownerY: owner.yCoord,
							ownerZ: owner.zCoord,
						});
				}
			}
			corePositions.add(
				this.createIntPosition(rp.blockX, rp.blockY, rp.blockZ),
			);
		}
		try {
			for (let i = 0; i < plan.sections.size(); i++) {
				const section = plan.sections.get(i);
				const sectionMap =
					new Packages.jp.kaiz.kaizpatch.rtm.rail.util.RailMapSection(
						plan.source,
						section.getStartRP(),
						section.getEndRP(),
						section.getStartRatio(),
						section.getEndRatio(),
					);
				const rp = section.getStartRP();
				if (
					!this.placeRoadbedInAir(
						world,
						sectionMap,
						rp.blockX,
						rp.blockY,
						rp.blockZ,
						property,
						`section_${i}`,
					)
				)
					throw new Error(`failed to place roadbed for section ${i}`);
			}
			for (let i = 0; i < plan.sections.size(); i++) {
				const section = plan.sections.get(i);
				const sectionStart = RailPosition.readFromNBT(
					section.getStartRP().writeToNBT(),
				);
				const sectionEnd = RailPosition.readFromNBT(
					section.getEndRP().writeToNBT(),
				);
				if (
					!world.setBlock(
						sectionStart.blockX,
						sectionStart.blockY,
						sectionStart.blockZ,
						RTMRail.largeRailCore0,
						1,
						2,
					)
				)
					throw new Error(
						`failed to place section core at ${sectionStart.blockX},${sectionStart.blockY},${sectionStart.blockZ}`,
					);
				placedCoreKeys[
					this.positionKey(
						sectionStart.blockX,
						sectionStart.blockY,
						sectionStart.blockZ,
					)
				] = true;
				const tile = world.getTileEntity(
					sectionStart.blockX,
					sectionStart.blockY,
					sectionStart.blockZ,
				);
				if (
					!(tile instanceof TileEntityLargeRailCore) ||
					!this.isSectionCore(tile)
				)
					throw new Error(
						`section core tile missing at ${sectionStart.blockX},${sectionStart.blockY},${sectionStart.blockZ}`,
					);
				tile.configureRailSection(
					groupId,
					logicalArray,
					this.toRailPositionArray([sectionStart, sectionEnd]),
					section.getStartRatio(),
					section.getEndRatio(),
					corePositions,
				);
				tile.setProperty(property);
				tile.setStartPoint(
					sectionStart.blockX,
					sectionStart.blockY,
					sectionStart.blockZ,
				);
				tile.fixRTMRailMapVersion = plan.source.fixRTMRailMapVersion;
				tile.createRailMap();
				this.markCoreDirty(tile);
				world.markBlockForUpdate(
					sectionStart.blockX,
					sectionStart.blockY,
					sectionStart.blockZ,
				);
			}
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] tolerant section rebuild created: sections=${plan.sections.size()}, replacedRoadbedsWithCores=${replacedForeignRoadbeds}`,
			);
			return true;
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] tolerant section rebuild exception: ${error}`,
			);
			for (let i = 0; i < plan.sections.size(); i++) {
				const rp = plan.sections.get(i).getStartRP();
				if (
					!placedCoreKeys[
						this.positionKey(rp.blockX, rp.blockY, rp.blockZ)
					]
				)
					continue;
				const tile = world.getTileEntity(
					rp.blockX,
					rp.blockY,
					rp.blockZ,
				);
				if (
					tile instanceof TileEntityLargeRailCore &&
					this.isSectionCore(tile)
				) {
					world.setBlockToAir(rp.blockX, rp.blockY, rp.blockZ);
					world.removeTileEntity(rp.blockX, rp.blockY, rp.blockZ);
					world.markBlockForUpdate(rp.blockX, rp.blockY, rp.blockZ);
				}
			}
			for (let i = 0; i < overwrittenRoadbeds.length; i++) {
				const roadbed = overwrittenRoadbeds[i];
				if (
					world.setBlock(
						roadbed.x,
						roadbed.y,
						roadbed.z,
						RTMRail.largeRailBase0,
						0,
						2,
					)
				) {
					const tile = world.getTileEntity(
						roadbed.x,
						roadbed.y,
						roadbed.z,
					);
					if (tile instanceof TileEntityLargeRailBase) {
						tile.setStartPoint(
							roadbed.ownerX,
							roadbed.ownerY,
							roadbed.ownerZ,
						);
						tile.markDirty();
					}
					world.markBlockForUpdate(roadbed.x, roadbed.y, roadbed.z);
				}
			}
			return false;
		}
	}

	private static addMissingRoadbed(core: TileEntityLargeRailCore): void {
		const world = this.getCoreWorld(core);
		const railMap = core.getRailMap(null);
		if (!railMap) return;
		const blocks = railMap.getRailBlockList(core.getProperty());
		let added = 0;
		let retained = 0;
		for (let i = 0; i < blocks.size(); i++) {
			const pos = blocks.get(i);
			const block = world.getBlock(pos[0], pos[1], pos[2]);
			if (
				world.isAirBlock(pos[0], pos[1], pos[2]) ||
				block instanceof BlockMarker
			) {
				if (
					world.setBlock(
						pos[0],
						pos[1],
						pos[2],
						RTMRail.largeRailBase0,
						0,
						2,
					)
				) {
					const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
					if (tile instanceof TileEntityLargeRailBase) {
						tile.setStartPoint(
							core.xCoord,
							core.yCoord,
							core.zCoord,
						);
						tile.markDirty();
					}
					added++;
				}
			} else {
				retained++;
			}
		}
		NGTLog.debug(
			`[SuperRailBuilderX RailPosition] additive roadbed update: added=${added}, retained=${retained}, removed=0`,
		);
	}

	static getRailCorePos(
		core: TileEntityLargeRailCore,
	): [number, number, number] {
		return [core.xCoord, core.yCoord, core.zCoord];
	}

	static getRailPositionCandidateKey(core: TileEntityLargeRailCore): string {
		if (this.isSectionCore(core)) {
			const groupId = core.getRailGroupId();
			if (groupId) return `section:${groupId.toString()}`;
		}
		return `core:${core.xCoord},${core.yCoord},${core.zCoord}`;
	}

	static getEditableRailPositions(
		core: TileEntityLargeRailCore,
	): JavaObjectArray<RailPosition> {
		if (this.isSectionCore(core)) {
			const positions = core.getLogicalRailPositions();
			return positions || core.getRailPositions();
		}
		return core.getRailPositions();
	}

	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean {
		return this.getRailPositionUnsupportedReason(core) === "";
	}

	static getRailPositionUnsupportedReason(
		core: TileEntityLargeRailCore,
	): string {
		if (!core) return "missing_core";
		if (core instanceof TileEntityLargeRailSwitchCore) return "switch";
		if (this.isSectionCore(core)) {
			if (!core.isRailSection()) return "sectioned_uninitialized";
			let logicalPositions: JavaObjectArray<RailPosition> | null = null;
			let groupPositions: java.util.List<number[]> | null = null;
			try {
				logicalPositions = core.getLogicalRailPositions();
				groupPositions = core.getRailGroupCorePositions();
			} catch (error) {
				NGTLog.debug(
					`[SuperRailBuilderX RailPosition] invalid section core ignored: ${error}`,
				);
				return "sectioned_uninitialized";
			}
			if (
				!logicalPositions ||
				logicalPositions.length !== 2 ||
				!groupPositions ||
				groupPositions.size() === 0
			)
				return `sectioned_invalid(groupCores=${groupPositions ? groupPositions.size() : -1}, logicalPositions=${logicalPositions ? logicalPositions.length : -1})`;
		}
		return "";
	}

	static refreshRailPositionClient(
		core: TileEntityLargeRailCore,
		index: number,
		x: number,
		y: number,
		z: number,
	): void {
		if (this.isSectionCore(core)) return;
		const positions = core.getRailPositions();
		if (!positions || index < 0 || index >= positions.length) return;
		positions[index].setPosition(x, y, z);
		core.setRailPositions(positions);
		core.createRailMap();
		core.shouldRerenderRail = true;
		this.getCoreWorld(core).markBlockForUpdate(
			core.xCoord,
			core.yCoord,
			core.zCoord,
		);
	}

	static removeRailClientGhost(
		world: net.minecraft.world.World,
		corePosition: [number, number, number],
		expectedKey: string,
	): void {
		try {
			const tile = world.getTileEntity(
				corePosition[0],
				corePosition[1],
				corePosition[2],
			);
			if (!(tile instanceof TileEntityLargeRailBase)) return;
			const core = tile.getRailCore();
			if (!core || this.getRailPositionCandidateKey(core) !== expectedKey)
				return;
			core.breakLogicalRail();
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX DoubleTrackCopy] client ghost cleanup failed: ${error}`,
			);
		}
	}

	static refreshRailCoreClient(core: TileEntityLargeRailCore): void {
		if (!core) return;
		core.createRailMap();
		core.shouldRerenderRail = true;
		this.getCoreWorld(core).markBlockForUpdate(
			core.xCoord,
			core.yCoord,
			core.zCoord,
		);
	}

	static consumeLastRailPositionMoveCores(): Array<[number, number, number]> {
		const result = this.lastRailPositionMoveCores;
		this.lastRailPositionMoveCores = [];
		return result;
	}

	private static recordLastRailPositionMoveCores(
		core: TileEntityLargeRailCore,
	): void {
		this.lastRailPositionMoveCores = [];
		if (this.isSectionCore(core)) {
			const positions = core.getRailGroupCorePositions();
			if (positions)
				for (let i = 0; i < positions.size(); i++) {
					const pos = positions.get(i);
					this.lastRailPositionMoveCores.push([
						pos[0],
						pos[1],
						pos[2],
					]);
				}
		}
		if (this.lastRailPositionMoveCores.length === 0)
			this.lastRailPositionMoveCores.push([
				core.xCoord,
				core.yCoord,
				core.zCoord,
			]);
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
		if (!this.canMoveRailPosition(core)) return "unsupported";
		if (core.isLogicalRailOccupied()) return "occupied";
		const positions = this.getEditableRailPositions(core);
		if (!positions || index < 0 || index >= positions.length)
			return "not_found";
		const position = positions[index];
		const tolerance = 0.001;
		if (
			Math.abs(position.posX - originalX) > tolerance ||
			Math.abs(position.posY - originalY) > tolerance ||
			Math.abs(position.posZ - originalZ) > tolerance
		)
			return "changed";
		const movedPositions = this.createMovedPositions(
			positions,
			index,
			x,
			y,
			z,
		);
		const roadbedValidation = this.validateBuilderMovePath(
			core,
			movedPositions,
		);
		if (roadbedValidation !== "ok") return roadbedValidation;
		if (!this.isSectionCore(core)) return "ok";
		if (core.isLogicalRailOccupied()) return "occupied";
		const groupPositions = core.getRailGroupCorePositions();
		if (!groupPositions || groupPositions.size() === 0)
			return "invalid_section";
		const world = this.getCoreWorld(core);
		for (let i = 0; i < groupPositions.size(); i++) {
			const pos = groupPositions.get(i);
			const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
			if (!(tile instanceof TileEntityLargeRailBase))
				return "section_unloaded";
			const groupCore = tile.getRailCore();
			if (!groupCore || !core.isSameLogicalRail(groupCore))
				return "section_unloaded";
		}
		return "ok";
	}

	private static getBuilderMoveProtectedRailKeys(
		core: TileEntityLargeRailCore,
		positions: RailPosition[],
	): string[] {
		const world = this.getCoreWorld(core);
		const keys: { [key: string]: boolean } = {};
		keys[this.getRailPositionCandidateKey(core)] = true;
		for (let i = 0; i < positions.length; i++) {
			const rp = positions[i];
			const candidates = [
				[rp.blockX, rp.blockY, rp.blockZ],
				this.getBuilderConnectionBlock(rp),
			];
			for (let j = 0; j < candidates.length; j++) {
				const pos = candidates[j];
				const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
				if (!(tile instanceof TileEntityLargeRailBase)) continue;
				const owner = tile.getRailCore();
				if (owner) keys[this.getRailPositionCandidateKey(owner)] = true;
			}
		}
		return Object.keys(keys);
	}

	private static validateBuilderMovePath(
		core: TileEntityLargeRailCore,
		positions: RailPosition[],
	): string {
		const world = this.getCoreWorld(core);
		const property = core.getProperty();
		const currentMap = core.getRailMap(null);
		const mapVersion =
			currentMap instanceof RailMapBasic
				? currentMap.fixRTMRailMapVersion
				: RailMapBasic.fixRTMRailMapVersionCurrent;
		const source = new RailMapBasic(positions[0], positions[1], mapVersion);
		if (!this.isBuilderRoadbedLoaded(world, source, property))
			return "path_unloaded";
		const protectedKeys: { [key: string]: boolean } = {};
		const protectedList = this.getBuilderMoveProtectedRailKeys(
			core,
			positions,
		);
		for (let i = 0; i < protectedList.length; i++)
			protectedKeys[protectedList[i]] = true;
		const preserveSectionCores = this.hasOnlyBuilderSectionCoreCrossings(
			world,
			source,
			property,
			protectedKeys,
			positions[0],
		);
		if (preserveSectionCores && source.getLength() > 64)
			return "normal_rail_too_long";
		return this.validateBuilderPlacement(
			world,
			[source],
			property,
			protectedKeys,
			preserveSectionCores,
		);
	}

	private static applyBuilderRailState(
		world: net.minecraft.world.World,
		result: { undoCore?: [number, number, number] },
		signal: any,
		subRails: java.util.List<RailProperty>,
	): boolean {
		if (!result.undoCore) return false;
		const tile = world.getTileEntity(
			result.undoCore[0],
			result.undoCore[1],
			result.undoCore[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase)) return false;
		const core = tile.getRailCore();
		if (!core) return false;
		core.setSignal(signal);
		for (let i = 0; i < subRails.size(); i++)
			core.addSubRail(this.cloneRailProperty(subRails.get(i)));
		this.markCoreDirty(core);
		NGTUtil.sendPacketToClient(core);
		return true;
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
		this.lastRailPositionMoveCores = [];
		const validation = this.validateRailPositionMove(
			core,
			index,
			originalX,
			originalY,
			originalZ,
			x,
			y,
			z,
		);
		if (validation !== "ok") return validation;
		if (!player) return "missing_player";
		const wasSectioned = this.isSectionCore(core);
		const sourcePositions = this.getEditableRailPositions(core);
		if (!sourcePositions || sourcePositions.length !== 2)
			return "not_found";
		const originalPositions = this.copyRailPositions(sourcePositions);
		const movedPositions = this.createMovedPositions(
			sourcePositions,
			index,
			x,
			y,
			z,
		);
		const world = this.getCoreWorld(core);
		const property = this.cloneRailProperty(core.getProperty());
		const originalMap = this.getLogicalRailMap(core) as RailSectionMap;
		const oldSyncBlocks = originalMap
			? this.getBuilderRoadbedBlocks(originalMap, property)
			: [];
		oldSyncBlocks.push([core.xCoord, core.yCoord, core.zCoord]);
		const signal = core.getSignal();
		const subRails = new ArrayList<RailProperty>();
		for (let i = 0; i < core.subRails.size(); i++)
			subRails.add(this.cloneRailProperty(core.subRails.get(i)));
		const protectedKeys = this.getBuilderMoveProtectedRailKeys(
			core,
			movedPositions,
		);
		core.breakLogicalRail();
		for (let i = 0; i < oldSyncBlocks.length; i++) {
			const pos = oldSyncBlocks[i];
			world.markBlockForUpdate(pos[0], pos[1], pos[2]);
		}
		const result = this.createBuilderRail(
			world,
			player,
			this.splitPointFromRailPosition(
				movedPositions[0],
				movedPositions[0].anchorLengthHorizontal,
				movedPositions[0].anchorLengthVertical,
			),
			this.splitPointFromRailPosition(
				movedPositions[1],
				movedPositions[1].anchorLengthHorizontal,
				movedPositions[1].anchorLengthVertical,
			),
			protectedKeys,
			undefined,
			property,
			false,
			true,
			true,
		);
		if (
			result.status === "ok" &&
			this.applyBuilderRailState(world, result, signal, subRails)
		) {
			if (result.undoCore) {
				const createdTile = world.getTileEntity(
					result.undoCore[0],
					result.undoCore[1],
					result.undoCore[2],
				);
				if (createdTile instanceof TileEntityLargeRailBase) {
					const createdCore = createdTile.getRailCore();
					if (createdCore)
						this.recordLastRailPositionMoveCores(createdCore);
				}
			}
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] builder-rule rebuild succeeded: sectioned=${wasSectioned}, normalCrossing=${result.createdAsNormalCrossing === true}`,
			);
			return result.createdAsNormalCrossing
				? "ok_normal_crossing"
				: wasSectioned
					? "ok_sectioned"
					: "ok";
		}
		if (result.status === "ok" && result.undoCore && result.undoKey)
			this.undoBuilderRail(
				world,
				result.undoCore[0],
				result.undoCore[1],
				result.undoCore[2],
				result.undoKey,
			);
		const restored = this.createBuilderRail(
			world,
			player,
			this.splitPointFromRailPosition(
				originalPositions[0],
				originalPositions[0].anchorLengthHorizontal,
				originalPositions[0].anchorLengthVertical,
			),
			this.splitPointFromRailPosition(
				originalPositions[1],
				originalPositions[1].anchorLengthHorizontal,
				originalPositions[1].anchorLengthVertical,
			),
			protectedKeys,
			undefined,
			property,
			false,
			true,
			true,
		);
		const rollbackOk =
			restored.status === "ok" &&
			this.applyBuilderRailState(world, restored, signal, subRails);
		if (rollbackOk && restored.undoCore) {
			const restoredTile = world.getTileEntity(
				restored.undoCore[0],
				restored.undoCore[1],
				restored.undoCore[2],
			);
			if (restoredTile instanceof TileEntityLargeRailBase) {
				const restoredCore = restoredTile.getRailCore();
				if (restoredCore)
					this.recordLastRailPositionMoveCores(restoredCore);
			}
		}
		NGTLog.debug(
			`[SuperRailBuilderX RailPosition] builder-rule rebuild failed: result=${result.status}, restored=${rollbackOk}`,
		);
		return rollbackOk ? result.status : "move_rollback_failed";
	}

	static moveBuilderRail(
		core: TileEntityLargeRailCore,
		expectedKey: string,
		originalStart: [number, number, number],
		originalEnd: [number, number, number],
		start: BuilderPoint,
		end: BuilderPoint,
		player?: EntityPlayer,
	): string {
		this.lastRailPositionMoveCores = [];
		if (!player) return "missing_player";
		if (
			!core ||
			!this.canMoveRailPosition(core) ||
			this.getRailPositionCandidateKey(core) !== expectedKey
		)
			return "rail_not_found";
		if (core.isLogicalRailOccupied()) return "occupied";
		const sourcePositions = this.getEditableRailPositions(core);
		if (!sourcePositions || sourcePositions.length !== 2)
			return "rail_not_found";
		const expected = [originalStart, originalEnd];
		for (let i = 0; i < 2; i++)
			if (
				Math.abs(sourcePositions[i].posX - expected[i][0]) > 0.001 ||
				Math.abs(sourcePositions[i].posY - expected[i][1]) > 0.001 ||
				Math.abs(sourcePositions[i].posZ - expected[i][2]) > 0.001
			)
				return "rail_changed";
		const startValidation = this.validateBuilderPoint(start);
		if (startValidation !== "ok") return startValidation;
		const endValidation = this.validateBuilderPoint(end);
		if (endValidation !== "ok") return endValidation;
		const world = this.getCoreWorld(core);
		const property = this.cloneRailProperty(core.getProperty());
		const originalPositions = this.copyRailPositions(sourcePositions);
		const movedStart =
			start.kind === "rail"
				? this.resolveBuilderRailPoint(world, start)
				: this.createBuilderFreePoint(start);
		const movedEnd =
			end.kind === "rail"
				? this.resolveBuilderRailPoint(world, end)
				: this.createBuilderFreePoint(end);
		if (!movedStart || !movedEnd) return "rail_endpoint_changed";
		const protectedKeys = this.getBuilderMoveProtectedRailKeys(core, [
			movedStart,
			movedEnd,
		]);
		const rollbackProtectedKeys = this.getBuilderMoveProtectedRailKeys(
			core,
			originalPositions,
		);
		const originalMap = this.getLogicalRailMap(core) as RailSectionMap;
		const oldSyncBlocks = originalMap
			? this.getBuilderRoadbedBlocks(originalMap, property)
			: [];
		oldSyncBlocks.push([core.xCoord, core.yCoord, core.zCoord]);
		const signal = core.getSignal();
		const subRails = new ArrayList<RailProperty>();
		for (let i = 0; i < core.subRails.size(); i++)
			subRails.add(this.cloneRailProperty(core.subRails.get(i)));
		core.breakLogicalRail();
		for (let i = 0; i < oldSyncBlocks.length; i++) {
			const pos = oldSyncBlocks[i];
			world.markBlockForUpdate(pos[0], pos[1], pos[2]);
		}
		const result = this.createBuilderRail(
			world,
			player,
			start,
			end,
			protectedKeys,
			undefined,
			property,
			false,
			true,
			true,
		);
		if (
			result.status === "ok" &&
			this.applyBuilderRailState(world, result, signal, subRails)
		) {
			if (result.undoCore) {
				const tile = world.getTileEntity(
					result.undoCore[0],
					result.undoCore[1],
					result.undoCore[2],
				);
				if (tile instanceof TileEntityLargeRailBase) {
					const createdCore = tile.getRailCore();
					if (createdCore)
						this.recordLastRailPositionMoveCores(createdCore);
				}
			}
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] parallel move succeeded: normalFallback=${result.createdAsNormalCrossing === true}`,
			);
			return result.createdAsNormalCrossing ? "ok_normal_crossing" : "ok";
		}
		if (result.status === "ok" && result.undoCore && result.undoKey)
			this.undoBuilderRail(
				world,
				result.undoCore[0],
				result.undoCore[1],
				result.undoCore[2],
				result.undoKey,
			);
		const restored = this.createBuilderRail(
			world,
			player,
			this.splitPointFromRailPosition(
				originalPositions[0],
				originalPositions[0].anchorLengthHorizontal,
				originalPositions[0].anchorLengthVertical,
			),
			this.splitPointFromRailPosition(
				originalPositions[1],
				originalPositions[1].anchorLengthHorizontal,
				originalPositions[1].anchorLengthVertical,
			),
			rollbackProtectedKeys,
			undefined,
			property,
			false,
			true,
			true,
		);
		const rollbackOk =
			restored.status === "ok" &&
			this.applyBuilderRailState(world, restored, signal, subRails);
		if (rollbackOk && restored.undoCore) {
			const restoredTile = world.getTileEntity(
				restored.undoCore[0],
				restored.undoCore[1],
				restored.undoCore[2],
			);
			if (restoredTile instanceof TileEntityLargeRailBase) {
				const restoredCore = restoredTile.getRailCore();
				if (restoredCore)
					this.recordLastRailPositionMoveCores(restoredCore);
			}
		}
		NGTLog.debug(
			`[SuperRailBuilderX RailPosition] parallel move failed: result=${result.status}, restored=${rollbackOk}`,
		);
		return rollbackOk ? result.status : "move_rollback_failed";
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
		if (!this.canMoveRailPosition(core)) return "unsupported";
		const positions = this.getEditableRailPositions(core);
		if (!positions || index < 0 || index >= positions.length)
			return "not_found";
		const position = positions[index];
		const tolerance = 0.001;
		if (
			Math.abs(position.posX - originalX) > tolerance ||
			Math.abs(position.posY - originalY) > tolerance ||
			Math.abs(position.posZ - originalZ) > tolerance
		)
			return "changed";
		const movedPositions = this.createMovedPositions(
			positions,
			index,
			x,
			y,
			z,
		);
		const roadbedValidation = this.validateRoadbedPath(
			core,
			movedPositions,
			false,
		);
		if (roadbedValidation !== "ok") return roadbedValidation;
		if (!this.isSectionCore(core)) return "ok";
		if (core.isLogicalRailOccupied()) return "occupied";
		const groupPositions = core.getRailGroupCorePositions();
		if (!groupPositions || groupPositions.size() === 0)
			return "invalid_section";
		const world = this.getCoreWorld(core);
		for (let i = 0; i < groupPositions.size(); i++) {
			const pos = groupPositions.get(i);
			const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
			if (!(tile instanceof TileEntityLargeRailBase))
				return "section_unloaded";
			const groupCore = tile.getRailCore();
			if (!groupCore || !core.isSameLogicalRail(groupCore))
				return "section_unloaded";
		}
		return "ok";
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
		const validation = this.validateRailPositionMoveAsNormal(
			core,
			index,
			originalX,
			originalY,
			originalZ,
			x,
			y,
			z,
		);
		if (validation !== "ok") return validation;
		if (!this.isSectionCore(core))
			return this.moveRailPosition(
				core,
				index,
				originalX,
				originalY,
				originalZ,
				x,
				y,
				z,
			);
		return this.moveSectionedRailPositionAsNormal(
			core,
			index,
			originalX,
			originalY,
			originalZ,
			x,
			y,
			z,
		);
	}

	private static createNormalRail(
		core: TileEntityLargeRailCore,
		positions: RailPosition[],
		property: RailProperty,
	): TileEntityLargeRailCore | null {
		const world = this.getCoreWorld(core);
		const start = positions[0];
		const railMap = new RailMapBasic(
			positions[0],
			positions[1],
			RailMapBasic.fixRTMRailMapVersionCurrent,
		);
		if (
			!this.placeRoadbedInAir(
				world,
				railMap,
				start.blockX,
				start.blockY,
				start.blockZ,
				property,
				"normal_rebuild",
			)
		)
			return null;
		if (
			!world.setBlock(
				start.blockX,
				start.blockY,
				start.blockZ,
				RTMRail.largeRailCore0,
				0,
				2,
			)
		)
			return null;
		const tile = world.getTileEntity(
			start.blockX,
			start.blockY,
			start.blockZ,
		);
		if (!(tile instanceof TileEntityLargeRailCore)) return null;
		const normalCore = tile as NormalRailCore;
		normalCore.setRailPositions(this.toRailPositionArray(positions));
		normalCore.setProperty(property);
		normalCore.setStartPoint(start.blockX, start.blockY, start.blockZ);
		normalCore.fixRTMRailMapVersion = railMap.fixRTMRailMapVersion;
		normalCore.createRailMap();
		this.markCoreDirty(normalCore);
		NGTUtil.sendPacketToClient(normalCore);
		world.markBlockForUpdate(start.blockX, start.blockY, start.blockZ);
		return normalCore;
	}

	private static moveSectionedRailPositionAsNormal(
		core: RailSectionCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
		const logicalPositions = core.getLogicalRailPositions();
		if (!logicalPositions || logicalPositions.length !== 2)
			return "invalid_section";
		if (index < 0 || index >= logicalPositions.length) return "not_found";
		const position = logicalPositions[index];
		const tolerance = 0.001;
		if (
			Math.abs(position.posX - originalX) > tolerance ||
			Math.abs(position.posY - originalY) > tolerance ||
			Math.abs(position.posZ - originalZ) > tolerance
		)
			return "changed";
		const world = this.getCoreWorld(core);
		const originalPositions = this.copyRailPositions(logicalPositions);
		const movedPositions = this.copyRailPositions(logicalPositions);
		movedPositions[index].setPosition(x, y, z);
		const property = core.getProperty();
		const signal = core.getSignal();
		const subRails = new ArrayList<RailProperty>();
		for (let i = 0; i < core.subRails.size(); i++)
			subRails.add(core.subRails.get(i));
		NGTLog.debug(
			`[SuperRailBuilderX RailPosition Normal] rebuilding as a single normal rail: oldGroupCores=${core.getRailGroupCorePositions().size()}, index=${index}`,
		);
		let newCore: TileEntityLargeRailCore | null = null;
		try {
			core.breakLogicalRail();
			newCore = this.createNormalRail(core, movedPositions, property);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition Normal] normal rail rebuild exception: ${error}`,
			);
		}
		if (!newCore) {
			const partialTile = world.getTileEntity(
				movedPositions[0].blockX,
				movedPositions[0].blockY,
				movedPositions[0].blockZ,
			);
			if (partialTile instanceof TileEntityLargeRailBase) {
				const partialCore = partialTile.getRailCore();
				if (partialCore) partialCore.breakLogicalRail();
			}
			let restored = false;
			try {
				restored = BlockMarker.createRail(
					world,
					originalPositions[0].blockX,
					originalPositions[0].blockY,
					originalPositions[0].blockZ,
					this.toJavaList(originalPositions),
					property,
					true,
					true,
				);
			} catch (error) {
				NGTLog.debug(
					`[SuperRailBuilderX RailPosition Normal] rollback exception: ${error}`,
				);
			}
			return restored
				? "normal_rebuild_failed"
				: "normal_rollback_failed";
		}
		newCore.setSignal(signal);
		for (let i = 0; i < subRails.size(); i++)
			newCore.addSubRail(subRails.get(i));
		this.markCoreDirty(newCore);
		NGTUtil.sendPacketToClient(newCore);
		return "ok_normal";
	}

	private static moveSectionedRailPosition(
		core: RailSectionCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
		if (core.isLogicalRailOccupied()) return "occupied";
		const logicalPositions = core.getLogicalRailPositions();
		const groupPositions = core.getRailGroupCorePositions();
		if (
			!logicalPositions ||
			logicalPositions.length !== 2 ||
			!groupPositions ||
			groupPositions.size() === 0
		)
			return "invalid_section";
		if (index < 0 || index >= logicalPositions.length) return "not_found";
		const position = logicalPositions[index];
		const tolerance = 0.001;
		if (
			Math.abs(position.posX - originalX) > tolerance ||
			Math.abs(position.posY - originalY) > tolerance ||
			Math.abs(position.posZ - originalZ) > tolerance
		)
			return "changed";
		const world = this.getCoreWorld(core);
		for (let i = 0; i < groupPositions.size(); i++) {
			const pos = groupPositions.get(i);
			const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
			if (!(tile instanceof TileEntityLargeRailBase))
				return "section_unloaded";
			const groupCore = tile.getRailCore();
			if (!groupCore || !core.isSameLogicalRail(groupCore))
				return "section_unloaded";
		}
		const originalPositions = this.copyRailPositions(logicalPositions);
		const movedPositions = this.copyRailPositions(logicalPositions);
		movedPositions[index].setPosition(x, y, z);
		const property = core.getProperty();
		const signal = core.getSignal();
		const subRails = new ArrayList<RailProperty>();
		for (let i = 0; i < core.subRails.size(); i++)
			subRails.add(core.subRails.get(i));
		this.logSectionCorePlan(core, movedPositions);
		const preserveForeignCores = this.hasRetainedForeignCoreCrossing(
			core,
			movedPositions,
		);
		const plannedSectionCount = this.createSectionPlan(
			core,
			movedPositions,
		).sections.size();
		const useAirOnlySectionRebuild = plannedSectionCount > 1;
		NGTLog.debug(
			`[SuperRailBuilderX RailPosition] rebuilding sectioned rail: groupCores=${groupPositions.size()}, index=${index}, preserveForeignCores=${preserveForeignCores}, airOnlyRoadbed=${useAirOnlySectionRebuild}`,
		);
		let created = false;
		try {
			core.breakLogicalRail();
			created = useAirOnlySectionRebuild
				? this.createSectionedRailPreservingForeignCores(
						core,
						movedPositions,
						property,
					)
				: BlockMarker.createRail(
						world,
						movedPositions[0].blockX,
						movedPositions[0].blockY,
						movedPositions[0].blockZ,
						this.toJavaList(movedPositions),
						property,
						true,
						true,
					);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] sectioned rail rebuild exception: ${error}`,
			);
		}
		if (!created) {
			let restored = false;
			try {
				restored = BlockMarker.createRail(
					world,
					originalPositions[0].blockX,
					originalPositions[0].blockY,
					originalPositions[0].blockZ,
					this.toJavaList(originalPositions),
					property,
					true,
					true,
				);
			} catch (error) {
				NGTLog.debug(
					`[SuperRailBuilderX RailPosition] sectioned rail rollback exception: ${error}`,
				);
			}
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] sectioned rail rebuild failed: restored=${restored}`,
			);
			return restored
				? "section_rebuild_failed"
				: "section_rollback_failed";
		}
		const newTile = world.getTileEntity(
			movedPositions[0].blockX,
			movedPositions[0].blockY,
			movedPositions[0].blockZ,
		);
		if (!(newTile instanceof TileEntityLargeRailBase))
			return "section_state_restore_failed";
		const newCore = newTile.getRailCore();
		if (!newCore) return "section_state_restore_failed";
		try {
			newCore.setSignal(signal);
			for (let i = 0; i < subRails.size(); i++)
				newCore.addSubRail(subRails.get(i));
			this.markCoreDirty(newCore);
			NGTUtil.sendPacketToClient(newCore);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX RailPosition] sectioned rail state restore exception: ${error}`,
			);
			return "section_state_restore_failed";
		}
		let newGroupCoreCount = 1;
		if (this.isSectionCore(newCore)) {
			const newGroupPositions = newCore.getRailGroupCorePositions();
			if (newGroupPositions) newGroupCoreCount = newGroupPositions.size();
		}
		NGTLog.debug(
			`[SuperRailBuilderX RailPosition] sectioned rail rebuild succeeded: oldGroupCores=${groupPositions.size()}, newGroupCores=${newGroupCoreCount}`,
		);
		return "ok_sectioned";
	}

	private static normalizeDegrees(angle: number): number {
		let normalized = angle % 360;
		if (normalized < 0) normalized += 360;
		return normalized;
	}

	private static builderDirectionFromYaw(yaw: number): number {
		return Math.round(this.normalizeDegrees(yaw) / 45) & 7;
	}

	private static builderAngleDifference(a: number, b: number): number {
		let difference = this.normalizeDegrees(a - b);
		if (difference > 180) difference -= 360;
		return difference;
	}

	private static validateBuilderPoint(point: BuilderPoint): string {
		if (!point || (point.kind !== "free" && point.kind !== "rail"))
			return "invalid_point";
		if (
			!point.position ||
			!isFinite(point.position[0]) ||
			!isFinite(point.position[1]) ||
			!isFinite(point.position[2]) ||
			!isFinite(point.anchorYaw) ||
			!isFinite(point.anchorPitch) ||
			!isFinite(point.anchorLength) ||
			point.anchorLength < 0 ||
			!point.markerPosition ||
			!isFinite(point.markerPosition[0]) ||
			!isFinite(point.markerPosition[1]) ||
			!isFinite(point.markerPosition[2])
		)
			return "invalid_point";
		if (point.kind === "rail") {
			if (
				!point.core ||
				!isFinite(point.core[0]) ||
				!isFinite(point.core[1]) ||
				!isFinite(point.core[2]) ||
				point.index === undefined ||
				!isFinite(point.index) ||
				Math.floor(point.index) !== point.index
			)
				return "invalid_rail_point";
		}
		if (
			point.ownerBlock &&
			(!isFinite(point.ownerBlock[0]) ||
				!isFinite(point.ownerBlock[1]) ||
				!isFinite(point.ownerBlock[2]))
		)
			return "invalid_point";
		return "ok";
	}

	private static resolveBuilderRailPoint(
		world: net.minecraft.world.World,
		point: BuilderPoint,
	): RailPosition | null {
		if (!point.core || point.index === undefined) return null;
		const tile = world.getTileEntity(
			point.core[0],
			point.core[1],
			point.core[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase)) return null;
		const core = tile.getRailCore();
		if (!core) return null;
		const unsupported = this.getRailPositionUnsupportedReason(core);
		if (unsupported !== "" && unsupported !== "switch") return null;
		const positions = this.getEditableRailPositions(core);
		if (point.index < 0 || point.index >= positions.length) return null;
		const source = positions[point.index];
		if (
			Math.abs(source.posX - point.position[0]) > 0.001 ||
			Math.abs(source.posY - point.position[1]) > 0.001 ||
			Math.abs(source.posZ - point.position[2]) > 0.001 ||
			Math.abs(
				this.builderAngleDifference(
					this.normalizeDegrees(source.anchorYaw + 180),
					point.anchorYaw,
				),
			) > 0.001 ||
			Math.abs(-source.anchorPitch - point.anchorPitch) > 0.001
		)
			return null;
		const neighbor = this.getBuilderConnectionBlock(source);
		const result = RailPosition.readFromNBT(source.writeToNBT());
		result.blockX = neighbor[0];
		result.blockY = neighbor[1];
		result.blockZ = neighbor[2];
		result.direction = (source.direction + 4) & 7;
		result.anchorYaw = this.normalizeDegrees(source.anchorYaw + 180);
		result.anchorPitch = -source.anchorPitch;
		result.setPosition(source.posX, source.posY, source.posZ);
		return result;
	}

	private static createBuilderFreePoint(point: BuilderPoint): RailPosition {
		const direction = this.builderDirectionFromYaw(point.anchorYaw);
		const yawRadians = (direction * 45 * Math.PI) / 180;
		const insideDistance = 0.000001;
		const result = new RailPosition(
			point.ownerBlock
				? Math.floor(point.ownerBlock[0])
				: Math.floor(
						point.position[0] +
							Math.sin(yawRadians) * insideDistance,
					),
			point.ownerBlock
				? Math.floor(point.ownerBlock[1])
				: Math.floor(point.position[1] - 1 / 16 + 0.000001),
			point.ownerBlock
				? Math.floor(point.ownerBlock[2])
				: Math.floor(
						point.position[2] +
							Math.cos(yawRadians) * insideDistance,
					),
			direction,
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

	private static createBuilderProperty(
		player: EntityPlayer,
	): RailProperty | null {
		const held = player.inventory.getCurrentItem();
		if (!held || held.getItem() !== RTMItem.itemLargeRail) return null;
		const heldProperty = ItemRail.getProperty(held);
		if (!heldProperty) return null;
		const nbt = new NBTTagCompound();
		heldProperty.writeToNBT(nbt);
		const property = RailProperty.readFromNBT(nbt);
		property.autoSplit = true;
		return property;
	}

	private static createBuilderSourceProperty(
		world: net.minecraft.world.World,
		sourceRail?: SourceRail,
	): RailProperty | null {
		if (!sourceRail) return null;
		const tile = world.getTileEntity(
			sourceRail.core[0],
			sourceRail.core[1],
			sourceRail.core[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase)) return null;
		const core = tile.getRailCore();
		if (
			!core ||
			core instanceof TileEntityLargeRailSwitchCore ||
			this.getRailPositionCandidateKey(core) !== sourceRail.railKey
		)
			return null;
		const positions = this.getEditableRailPositions(core);
		if (!positions || positions.length !== 2) return null;
		const expected = [sourceRail.startPosition, sourceRail.endPosition];
		for (let i = 0; i < 2; i++)
			if (
				Math.abs(positions[i].posX - expected[i][0]) > 0.001 ||
				Math.abs(positions[i].posY - expected[i][1]) > 0.001 ||
				Math.abs(positions[i].posZ - expected[i][2]) > 0.001
			)
				return null;
		const property = this.cloneRailProperty(core.getProperty());
		property.autoSplit = true;
		return property;
	}

	private static createBuilderEndpointProperty(
		world: net.minecraft.world.World,
		point: BuilderPoint,
	): RailProperty | null {
		if (point.kind !== "rail" || !point.core) return null;
		const tile = world.getTileEntity(
			point.core[0],
			point.core[1],
			point.core[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase)) return null;
		const core = tile.getRailCore();
		if (!core) return null;
		const unsupported = this.getRailPositionUnsupportedReason(core);
		if (unsupported !== "" && unsupported !== "switch") return null;
		const positions = this.getEditableRailPositions(core);
		if (
			point.index === undefined ||
			point.index < 0 ||
			point.index >= positions.length
		)
			return null;
		const rp = positions[point.index];
		if (
			Math.abs(rp.posX - point.position[0]) > 0.001 ||
			Math.abs(rp.posY - point.position[1]) > 0.001 ||
			Math.abs(rp.posZ - point.position[2]) > 0.001
		)
			return null;
		const property = this.cloneRailProperty(core.getProperty());
		property.autoSplit = true;
		return property;
	}

	private static normalizeBuilderTrig(value: number): number {
		if (Math.abs(value) < 0.000000001) return 0;
		if (Math.abs(value - 1) < 0.000000001) return 1;
		if (Math.abs(value + 1) < 0.000000001) return -1;
		return value;
	}

	private static getBuilderRoadbedBlocks(
		railMap: RailSectionMap,
		property: RailProperty,
	): Array<[number, number, number]> {
		const propertyWithModel = property as unknown as {
			getModelSet(): { getConfig(): { ballastWidth: number } };
		};
		const width =
			propertyWithModel.getModelSet().getConfig().ballastWidth >> 1;
		const split = Math.floor(railMap.getLength() * 4);
		const startNeighbor = railMap.getStartRP().getNeighborPos();
		const endNeighbor = railMap.getEndRP().getNeighborPos();
		const blocks: { [horizontalKey: string]: [number, number, number] } =
			{};
		const add = (x: number, y: number, z: number): void => {
			if (
				(x === startNeighbor[0] &&
					y === startNeighbor[1] &&
					z === startNeighbor[2]) ||
				(x === endNeighbor[0] &&
					y === endNeighbor[1] &&
					z === endNeighbor[2])
			)
				return;
			const key = `${x},${z}`;
			const previous = blocks[key];
			if (!previous || y < previous[1]) blocks[key] = [x, y, z];
		};
		for (let j = 0; j < split; j++) {
			const point = railMap.getRailPos(split, j);
			const x = point[1];
			const z = point[0];
			const yaw = (railMap.getRailYaw(split, j) * Math.PI) / 180;
			const yValue = railMap.getRailHeight(split, j);
			const y = yValue < 0 ? Math.ceil(yValue) : Math.floor(yValue);
			const centerX = Math.floor(x);
			const centerZ = Math.floor(z);
			if (
				(centerX === startNeighbor[0] &&
					y === startNeighbor[1] &&
					centerZ === startNeighbor[2]) ||
				(centerX === endNeighbor[0] &&
					y === endNeighbor[1] &&
					centerZ === endNeighbor[2])
			)
				continue;
			const plusX = this.normalizeBuilderTrig(
				Math.sin(yaw + Math.PI / 2),
			);
			const plusZ = this.normalizeBuilderTrig(
				Math.cos(yaw + Math.PI / 2),
			);
			const minusX = this.normalizeBuilderTrig(
				Math.sin(yaw - Math.PI / 2),
			);
			const minusZ = this.normalizeBuilderTrig(
				Math.cos(yaw - Math.PI / 2),
			);
			for (let offset = 1; offset <= width; offset++) {
				add(
					Math.floor(x + plusX * offset),
					y,
					Math.floor(z + plusZ * offset),
				);
				add(
					Math.floor(x + minusX * offset),
					y,
					Math.floor(z + minusZ * offset),
				);
			}
			add(centerX, y, centerZ);
		}
		return Object.keys(blocks).map((key) => blocks[key]);
	}

	private static placeBuilderRoadbed(
		world: net.minecraft.world.World,
		railMap: RailSectionMap,
		coreX: number,
		coreY: number,
		coreZ: number,
		property: RailProperty,
		protectedRailKeys: { [key: string]: boolean },
		preserveSectionCores = false,
		replacementEndpoint?: [number, number, number],
		overwriteForeignRoadbeds = false,
	): number {
		const blocks = this.getBuilderRoadbedBlocks(railMap, property);
		let replaced = 0;
		for (let i = 0; i < blocks.length; i++) {
			const pos = blocks[i];
			const existingTile = world.getTileEntity(pos[0], pos[1], pos[2]);
			if (existingTile instanceof TileEntityLargeRailBase) {
				const owner = existingTile.getRailCore();
				if (existingTile instanceof TileEntityLargeRailCore) {
					NGTLog.debug(
						`[SuperRailBuilderX builder1] existing rail core preserved during roadbed placement: pos=${pos[0]},${pos[1]},${pos[2]}`,
					);
					continue;
				}
				const protectedEndpointRoadbed =
					overwriteForeignRoadbeds &&
					owner &&
					this.isBuilderEndpointRoadbed(owner, pos, 2);
				if (protectedEndpointRoadbed) {
					NGTLog.debug(
						`[SuperRailBuilderX RailPosition] existing endpoint roadbed preserved: pos=${pos[0]},${pos[1]},${pos[2]}, railKey=${this.getRailPositionCandidateKey(owner)}`,
					);
					continue;
				}
				const replacesEndpoint =
					!overwriteForeignRoadbeds &&
					!(existingTile instanceof TileEntityLargeRailCore) &&
					replacementEndpoint !== undefined &&
					pos[0] === replacementEndpoint[0] &&
					pos[1] === replacementEndpoint[1] &&
					pos[2] === replacementEndpoint[2];
				if (
					!overwriteForeignRoadbeds &&
					!(existingTile instanceof TileEntityLargeRailCore) &&
					owner &&
					!replacesEndpoint
				) {
					NGTLog.debug(
						`[SuperRailBuilderX builder1] foreign normal roadbed preserved: pos=${pos[0]},${pos[1]},${pos[2]}, railKey=${this.getRailPositionCandidateKey(owner)}`,
					);
					continue;
				}
				if (replacesEndpoint)
					NGTLog.debug(
						`[SuperRailBuilderX builder1] endpoint roadbed ownership replaced: pos=${pos[0]},${pos[1]},${pos[2]}`,
					);
				if (
					preserveSectionCores &&
					existingTile instanceof TileEntityLargeRailCore &&
					owner &&
					this.isSectionCore(owner)
				) {
					NGTLog.debug(
						`[SuperRailBuilderX builder1] crossing section core preserved: pos=${pos[0]},${pos[1]},${pos[2]}, railKey=${this.getRailPositionCandidateKey(owner)}`,
					);
					continue;
				}
				if (
					!overwriteForeignRoadbeds &&
					!replacesEndpoint &&
					owner &&
					protectedRailKeys[this.getRailPositionCandidateKey(owner)]
				) {
					NGTLog.debug(
						`[SuperRailBuilderX builder1] protected connection roadbed preserved: pos=${pos[0]},${pos[1]},${pos[2]}`,
					);
					continue;
				}
			}
			const beforeBlock = world.getBlock(pos[0], pos[1], pos[2]);
			const beforeMetadata = world.getBlockMetadata(
				pos[0],
				pos[1],
				pos[2],
			);
			if (!world.isAirBlock(pos[0], pos[1], pos[2])) replaced++;
			const changed = world.setBlock(
				pos[0],
				pos[1],
				pos[2],
				RTMRail.largeRailBase0,
				0,
				2,
			);
			const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
			if (!(tile instanceof TileEntityLargeRailBase))
				throw new Error(
					`builder roadbed tile missing at ${pos[0]},${pos[1]},${pos[2]}: changed=${changed}, before=${beforeBlock}/${beforeMetadata}, after=${world.getBlock(pos[0], pos[1], pos[2])}/${world.getBlockMetadata(pos[0], pos[1], pos[2])}, tile=${tile}`,
				);
			tile.setStartPoint(coreX, coreY, coreZ);
			tile.markDirty();
		}
		return replaced;
	}

	private static isBuilderEndpointRoadbed(
		core: TileEntityLargeRailCore,
		position: [number, number, number],
		endpointLength: number,
	): boolean {
		const map = this.getLogicalRailMap(core);
		if (!map || map.getLength() <= 0) return false;
		const split = Math.max(
			8,
			Math.min(4096, Math.ceil(map.getLength() * 4)),
		);
		const index = map.getNearlestPoint(
			split,
			position[0] + 0.5,
			position[2] + 0.5,
		);
		const distance = (map.getLength() * index) / split;
		return (
			distance <= endpointLength + 0.25 ||
			map.getLength() - distance <= endpointLength + 0.25
		);
	}

	private static getBuilderProtectedRailKeys(
		world: net.minecraft.world.World,
		start: BuilderPoint,
		end: BuilderPoint,
	): { [key: string]: boolean } {
		const result: { [key: string]: boolean } = {};
		const points = [start, end];
		for (let i = 0; i < points.length; i++) {
			const point = points[i];
			if (point.kind !== "rail" || !point.core) continue;
			const tile = world.getTileEntity(
				point.core[0],
				point.core[1],
				point.core[2],
			);
			if (!(tile instanceof TileEntityLargeRailBase)) continue;
			const core = tile.getRailCore();
			if (core) result[this.getRailPositionCandidateKey(core)] = true;
		}
		return result;
	}

	private static validateBuilderPlacement(
		world: net.minecraft.world.World,
		maps: RailSectionMap[],
		property: RailProperty,
		protectedRailKeys: { [key: string]: boolean },
		preserveSectionCores = false,
	): string {
		const coreBlocks: {
			[key: string]: {
				position: [number, number, number];
				core: TileEntityLargeRailCore;
				railKey: string;
			};
		} = {};
		for (let mapIndex = 0; mapIndex < maps.length; mapIndex++) {
			const blocks = this.getBuilderRoadbedBlocks(
				maps[mapIndex],
				property,
			);
			for (let i = 0; i < blocks.length; i++) {
				const pos = blocks[i];
				const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
				if (!(tile instanceof TileEntityLargeRailCore)) continue;
				const core = tile.getRailCore();
				if (!core) continue;
				const key = this.getRailPositionCandidateKey(core);
				coreBlocks[`${pos[0]},${pos[1]},${pos[2]}`] = {
					position: [pos[0], pos[1], pos[2]],
					core,
					railKey: key,
				};
			}
		}
		const keys = Object.keys(coreBlocks);
		for (let i = 0; i < keys.length; i++) {
			const target = coreBlocks[keys[i]];
			if (protectedRailKeys[target.railKey]) {
				NGTLog.debug(
					`[SuperRailBuilderX builder1] protected connection core preserved: pos=${target.position[0]},${target.position[1]},${target.position[2]}, railKey=${target.railKey}`,
				);
				continue;
			}
			if (preserveSectionCores && this.isSectionCore(target.core)) {
				NGTLog.debug(
					`[SuperRailBuilderX builder1] crossing section core accepted for normal rail: pos=${target.position[0]},${target.position[1]},${target.position[2]}, railKey=${target.railKey}`,
				);
				continue;
			}
			NGTLog.debug(
				`[SuperRailBuilderX builder1] existing rail core blocks placement: pos=${target.position[0]},${target.position[1]},${target.position[2]}, railKey=${target.railKey}`,
			);
			return "rail_core_conflict";
		}
		return "ok";
	}

	private static hasOnlyBuilderSectionCoreCrossings(
		world: net.minecraft.world.World,
		railMap: RailSectionMap,
		property: RailProperty,
		protectedRailKeys: { [key: string]: boolean },
		start: RailPosition,
	): boolean {
		const blocks = this.getBuilderRoadbedBlocks(railMap, property);
		let found = false;
		for (let i = 0; i < blocks.length; i++) {
			const pos = blocks[i];
			const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
			if (!(tile instanceof TileEntityLargeRailCore)) continue;
			const core = tile.getRailCore();
			if (!core) continue;
			const railKey = this.getRailPositionCandidateKey(core);
			if (protectedRailKeys[railKey]) continue;
			if (
				(pos[0] === start.blockX &&
					pos[1] === start.blockY &&
					pos[2] === start.blockZ) ||
				!this.isSectionCore(core)
			)
				return false;
			found = true;
		}
		return found;
	}

	private static isBuilderRoadbedLoaded(
		world: net.minecraft.world.World,
		railMap: RailSectionMap,
		property: RailProperty,
	): boolean {
		const blocks = this.getBuilderRoadbedBlocks(railMap, property);
		for (let i = 0; i < blocks.length; i++) {
			const pos = blocks[i];
			if (!world.blockExists(pos[0], pos[1], pos[2])) return false;
		}
		return true;
	}

	private static prepareBuilderSectionCorePositions(
		world: net.minecraft.world.World,
		source: RailMapBasic,
		sections: java.util.List<RailSectionPlan>,
		property: RailProperty,
	): string {
		const used: { [key: string]: boolean } = {};
		for (let i = 0; i < sections.size(); i++) {
			const rp = sections.get(i).getStartRP();
			used[`${rp.blockX},${rp.blockY},${rp.blockZ}`] = true;
		}
		for (let i = 0; i < sections.size(); i++) {
			const section = sections.get(i);
			const start = section.getStartRP();
			const existing = world.getBlock(
				start.blockX,
				start.blockY,
				start.blockZ,
			);
			if (!(existing instanceof BlockLargeRailBase)) continue;
			if (!existing.isCore()) {
				NGTLog.debug(
					`[SuperRailBuilderX builder1] section core will replace normal roadbed: pos=${start.blockX},${start.blockY},${start.blockZ}`,
				);
				continue;
			}
			if (i === 0) {
				NGTLog.debug(
					`[SuperRailBuilderX builder1] logical start core position is occupied by rail: pos=${start.blockX},${start.blockY},${start.blockZ}`,
				);
				return "section_core_conflict";
			}
			const sectionMap =
				new Packages.jp.kaiz.kaizpatch.rtm.rail.util.RailMapSection(
					source,
					start,
					section.getEndRP(),
					section.getStartRatio(),
					section.getEndRatio(),
				);
			const blocks = this.getBuilderRoadbedBlocks(sectionMap, property);
			let replacement: [number, number, number] | null = null;
			for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
				const candidate = blocks[blockIndex];
				const key = `${candidate[0]},${candidate[1]},${candidate[2]}`;
				if (
					used[key] ||
					candidate[0] >> 4 !== start.blockX >> 4 ||
					candidate[2] >> 4 !== start.blockZ >> 4
				)
					continue;
				const block = world.getBlock(
					candidate[0],
					candidate[1],
					candidate[2],
				);
				if (
					world.isAirBlock(
						candidate[0],
						candidate[1],
						candidate[2],
					) ||
					block instanceof BlockMarker ||
					(block instanceof BlockLargeRailBase && !block.isCore())
				) {
					replacement = candidate;
					break;
				}
			}
			if (!replacement) {
				NGTLog.debug(
					`[SuperRailBuilderX builder1] no safe section core position in chunk: original=${start.blockX},${start.blockY},${start.blockZ}`,
				);
				return "section_core_conflict";
			}
			const old = `${start.blockX},${start.blockY},${start.blockZ}`;
			start.blockX = replacement[0];
			start.blockY = replacement[1];
			start.blockZ = replacement[2];
			const previousEnd = sections.get(i - 1).getEndRP();
			previousEnd.blockX = replacement[0];
			previousEnd.blockY = replacement[1];
			previousEnd.blockZ = replacement[2];
			used[`${replacement[0]},${replacement[1]},${replacement[2]}`] =
				true;
			NGTLog.debug(
				`[SuperRailBuilderX builder1] section core relocated from occupied roadbed: from=${old}, to=${replacement[0]},${replacement[1]},${replacement[2]}`,
			);
		}
		return "ok";
	}

	private static createBuilderNormalRail(
		world: net.minecraft.world.World,
		source: RailMapBasic,
		positions: RailPosition[],
		property: RailProperty,
		protectedRailKeys: { [key: string]: boolean },
		preserveSectionCores = false,
		overwriteForeignRoadbeds = false,
	): TileEntityLargeRailCore | null {
		const start = positions[0];
		const replaced = this.placeBuilderRoadbed(
			world,
			source,
			start.blockX,
			start.blockY,
			start.blockZ,
			property,
			protectedRailKeys,
			preserveSectionCores,
			[positions[1].blockX, positions[1].blockY, positions[1].blockZ],
			overwriteForeignRoadbeds,
		);
		const startBase = world.getTileEntity(
			start.blockX,
			start.blockY,
			start.blockZ,
		);
		if (startBase instanceof TileEntityLargeRailBase) {
			startBase.setStartPoint(start.blockX, start.blockY, start.blockZ);
			startBase.markDirty();
		}
		world.setBlock(
			start.blockX,
			start.blockY,
			start.blockZ,
			RTMRail.largeRailCore0,
			0,
			2,
		);
		const tile = world.getTileEntity(
			start.blockX,
			start.blockY,
			start.blockZ,
		);
		if (!(tile instanceof TileEntityLargeRailCore)) return null;
		const core = tile as NormalRailCore;
		core.setRailPositions(this.toRailPositionArray(positions));
		core.setProperty(property);
		core.setStartPoint(start.blockX, start.blockY, start.blockZ);
		core.fixRTMRailMapVersion = source.fixRTMRailMapVersion;
		core.createRailMap();
		this.markCoreDirty(core);
		NGTUtil.sendPacketToClient(core);
		world.markBlockForUpdate(start.blockX, start.blockY, start.blockZ);
		NGTLog.debug(
			`[SuperRailBuilderX builder1] destructive normal rail created: replacedBlocks=${replaced}`,
		);
		return core;
	}

	private static createBuilderSectionedRail(
		world: net.minecraft.world.World,
		source: RailMapBasic,
		sections: java.util.List<RailSectionPlan>,
		positions: RailPosition[],
		property: RailProperty,
		protectedRailKeys: { [key: string]: boolean },
		overwriteForeignRoadbeds = false,
	): TileEntityLargeRailCore | null {
		if (sections.size() <= 1) return null;
		const groupId = java.util.UUID.randomUUID();
		const logicalArray = this.toRailPositionArray(
			this.copyRailPositions(positions),
		);
		const corePositions = new ArrayList<number[]>();
		for (let i = 0; i < sections.size(); i++) {
			const rp = sections.get(i).getStartRP();
			corePositions.add(
				this.createIntPosition(rp.blockX, rp.blockY, rp.blockZ),
			);
		}
		let replaced = 0;
		for (let i = 0; i < sections.size(); i++) {
			const section = sections.get(i);
			const sectionMap =
				new Packages.jp.kaiz.kaizpatch.rtm.rail.util.RailMapSection(
					source,
					section.getStartRP(),
					section.getEndRP(),
					section.getStartRatio(),
					section.getEndRatio(),
				);
			const rp = section.getStartRP();
			replaced += this.placeBuilderRoadbed(
				world,
				sectionMap,
				rp.blockX,
				rp.blockY,
				rp.blockZ,
				property,
				protectedRailKeys,
				false,
				[positions[1].blockX, positions[1].blockY, positions[1].blockZ],
				overwriteForeignRoadbeds,
			);
		}
		let firstCore: TileEntityLargeRailCore | null = null;
		for (let i = 0; i < sections.size(); i++) {
			const section = sections.get(i);
			const sectionStart = RailPosition.readFromNBT(
				section.getStartRP().writeToNBT(),
			);
			const sectionEnd = RailPosition.readFromNBT(
				section.getEndRP().writeToNBT(),
			);
			const beforeBlock = world.getBlock(
				sectionStart.blockX,
				sectionStart.blockY,
				sectionStart.blockZ,
			);
			const beforeMetadata = world.getBlockMetadata(
				sectionStart.blockX,
				sectionStart.blockY,
				sectionStart.blockZ,
			);
			const coreBase = world.getTileEntity(
				sectionStart.blockX,
				sectionStart.blockY,
				sectionStart.blockZ,
			);
			if (coreBase instanceof TileEntityLargeRailBase) {
				coreBase.setStartPoint(
					sectionStart.blockX,
					sectionStart.blockY,
					sectionStart.blockZ,
				);
				coreBase.markDirty();
			}
			const changed = world.setBlock(
				sectionStart.blockX,
				sectionStart.blockY,
				sectionStart.blockZ,
				RTMRail.largeRailCore0,
				1,
				2,
			);
			const tile = world.getTileEntity(
				sectionStart.blockX,
				sectionStart.blockY,
				sectionStart.blockZ,
			);
			if (
				!(tile instanceof TileEntityLargeRailCore) ||
				!this.isSectionCore(tile)
			)
				throw new Error(
					`builder section core tile missing at ${sectionStart.blockX},${sectionStart.blockY},${sectionStart.blockZ}: changed=${changed}, before=${beforeBlock}/${beforeMetadata}, after=${world.getBlock(sectionStart.blockX, sectionStart.blockY, sectionStart.blockZ)}/${world.getBlockMetadata(sectionStart.blockX, sectionStart.blockY, sectionStart.blockZ)}, tile=${tile}`,
				);
			tile.configureRailSection(
				groupId,
				logicalArray,
				this.toRailPositionArray([sectionStart, sectionEnd]),
				section.getStartRatio(),
				section.getEndRatio(),
				corePositions,
			);
			tile.setProperty(property);
			tile.setStartPoint(
				sectionStart.blockX,
				sectionStart.blockY,
				sectionStart.blockZ,
			);
			tile.fixRTMRailMapVersion = source.fixRTMRailMapVersion;
			tile.createRailMap();
			this.markCoreDirty(tile);
			NGTUtil.sendPacketToClient(tile);
			world.markBlockForUpdate(
				sectionStart.blockX,
				sectionStart.blockY,
				sectionStart.blockZ,
			);
			if (!firstCore) firstCore = tile;
		}
		NGTLog.debug(
			`[SuperRailBuilderX builder1] destructive sectioned rail created: sections=${sections.size()}, replacedBlocks=${replaced}`,
		);
		return firstCore;
	}

	static createBuilderRail(
		world: net.minecraft.world.World,
		player: EntityPlayer,
		start: BuilderPoint,
		end: BuilderPoint,
		additionalProtectedRailKeys?: string[],
		sourceRail?: SourceRail,
		fallbackProperty?: RailProperty,
		forceNormal = false,
		preferFallbackProperty = false,
		overwriteForeignRoadbeds = false,
		propertySourcePoint?: BuilderPoint,
		replaceProtectedCoreRoadbedAt?: [number, number, number],
	) {
		const startValidation = this.validateBuilderPoint(start);
		if (startValidation !== "ok") return { status: startValidation };
		const endValidation = this.validateBuilderPoint(end);
		if (endValidation !== "ok") return { status: endValidation };
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
		if (
			!world.blockExists(
				Math.floor(start.position[0]),
				Math.floor(start.position[1]),
				Math.floor(start.position[2]),
			) ||
			!world.blockExists(
				Math.floor(end.position[0]),
				Math.floor(end.position[1]),
				Math.floor(end.position[2]),
			)
		)
			return { status: "endpoint_unloaded" };
		const sourceProperty = this.createBuilderSourceProperty(
			world,
			sourceRail,
		);
		if (sourceRail && !sourceProperty)
			return { status: "source_rail_changed" };
		const property =
			(preferFallbackProperty && fallbackProperty
				? this.cloneRailProperty(fallbackProperty)
				: null) ||
			this.createBuilderProperty(player) ||
			sourceProperty ||
			(propertySourcePoint
				? this.createBuilderEndpointProperty(world, propertySourcePoint)
				: null) ||
			this.createBuilderEndpointProperty(world, start) ||
			this.createBuilderEndpointProperty(world, end) ||
			(fallbackProperty
				? this.cloneRailProperty(fallbackProperty)
				: null);
		if (!property)
			return {
				status: sourceRail ? "source_rail_changed" : "hold_rail_item",
			};
		let startRP: RailPosition | null = null;
		let endRP: RailPosition | null = null;
		if (start.kind === "rail")
			startRP = this.resolveBuilderRailPoint(world, start);
		else startRP = this.createBuilderFreePoint(start);
		if (end.kind === "rail")
			endRP = this.resolveBuilderRailPoint(world, end);
		else endRP = this.createBuilderFreePoint(end);
		if (!startRP || !endRP) return { status: "rail_endpoint_changed" };
		startRP.anchorLengthHorizontal = start.anchorLength;
		endRP.anchorLengthHorizontal = end.anchorLength;
		startRP.anchorLengthVertical =
			start.anchorLengthVertical === undefined
				? start.anchorLength
				: start.anchorLengthVertical;
		endRP.anchorLengthVertical =
			end.anchorLengthVertical === undefined
				? end.anchorLength
				: end.anchorLengthVertical;
		if (
			!world.blockExists(
				startRP.blockX,
				startRP.blockY,
				startRP.blockZ,
			) ||
			!world.blockExists(endRP.blockX, endRP.blockY, endRP.blockZ)
		)
			return { status: "endpoint_unloaded" };
		NGTLog.debug(
			`[SuperRailBuilderX builder1] creation plan: kinds=${start.kind}->${end.kind}, startBlock=${startRP.blockX},${startRP.blockY},${startRP.blockZ}, startPos=${startRP.posX},${startRP.posY},${startRP.posZ}, startDir=${startRP.direction}, startYaw=${startRP.anchorYaw}, startPitch=${startRP.anchorPitch}, startLengthH=${startRP.anchorLengthHorizontal}, startLengthV=${startRP.anchorLengthVertical}, endBlock=${endRP.blockX},${endRP.blockY},${endRP.blockZ}, endPos=${endRP.posX},${endRP.posY},${endRP.posZ}, endDir=${endRP.direction}, endYaw=${endRP.anchorYaw}, endPitch=${endRP.anchorPitch}, endLengthH=${endRP.anchorLengthHorizontal}, endLengthV=${endRP.anchorLengthVertical}`,
		);
		const positions = (
			startRP.posY <= endRP.posY ? [startRP, endRP] : [endRP, startRP]
		) as RailPosition[];
		NGTLog.debug(
			`[SuperRailBuilderX builder1] generation order: ${positions[0] === startRP ? "selected" : "reversed_to_lower_y"}`,
		);
		const source = new RailMapBasic(
			positions[0],
			positions[1],
			RailMapBasic.fixRTMRailMapVersionCurrent,
		);
		const sections =
			Packages.jp.kaiz.kaizpatch.rtm.rail.util.RailChunkSectioner.split(
				source,
			);
		const protectedRailKeys = this.getBuilderProtectedRailKeys(
			world,
			start,
			end,
		);
		if (additionalProtectedRailKeys)
			for (let i = 0; i < additionalProtectedRailKeys.length; i++)
				protectedRailKeys[additionalProtectedRailKeys[i]] = true;
		let preserveSectionCores =
			sections.size() > 1 &&
			this.hasOnlyBuilderSectionCoreCrossings(
				world,
				source,
				property,
				protectedRailKeys,
				positions[0],
			);
		if ((forceNormal || preserveSectionCores) && source.getLength() > 64)
			return { status: "normal_rail_too_long" };
		let createAsNormal =
			forceNormal || sections.size() <= 1 || preserveSectionCores;
		let unsafeSectionCoreFallback = false;
		if (forceNormal) property.autoSplit = false;
		if (preserveSectionCores) {
			property.autoSplit = false;
			NGTLog.debug(
				"[SuperRailBuilderX builder1] section-core crossing will be created as one normal rail",
			);
		}
		if (!createAsNormal) {
			const corePreparation = this.prepareBuilderSectionCorePositions(
				world,
				source,
				sections,
				property,
			);
			if (corePreparation !== "ok") {
				const startBlock = world.getBlock(
					positions[0].blockX,
					positions[0].blockY,
					positions[0].blockZ,
				);
				if (
					corePreparation === "section_core_conflict" &&
					source.getLength() <= 64 &&
					!(startBlock instanceof BlockLargeRailBase)
				) {
					createAsNormal = true;
					unsafeSectionCoreFallback = true;
					preserveSectionCores = false;
					property.autoSplit = false;
					NGTLog.debug(
						"[SuperRailBuilderX builder1] unsafe section core placement will be created as one normal rail",
					);
				} else return { status: corePreparation };
			}
		} else {
			const startTile = world.getTileEntity(
				positions[0].blockX,
				positions[0].blockY,
				positions[0].blockZ,
			);
			const startOwner =
				startTile instanceof TileEntityLargeRailBase
					? startTile.getRailCore()
					: null;
			const canReplaceProtectedStartRoadbed =
				replaceProtectedCoreRoadbedAt &&
				positions[0].blockX === replaceProtectedCoreRoadbedAt[0] &&
				positions[0].blockY === replaceProtectedCoreRoadbedAt[1] &&
				positions[0].blockZ === replaceProtectedCoreRoadbedAt[2] &&
				startTile instanceof TileEntityLargeRailBase &&
				!(startTile instanceof TileEntityLargeRailCore) &&
				startOwner &&
				protectedRailKeys[this.getRailPositionCandidateKey(startOwner)];
			if (canReplaceProtectedStartRoadbed)
				NGTLog.debug(
					`[SuperRailBuilderX splitter] shared split endpoint roadbed will be replaced by core: pos=${positions[0].blockX},${positions[0].blockY},${positions[0].blockZ}`,
				);
			else if (
				world.getBlock(
					positions[0].blockX,
					positions[0].blockY,
					positions[0].blockZ,
				) instanceof BlockLargeRailBase
			) {
				NGTLog.debug(
					`[SuperRailBuilderX builder1] normal core position is occupied by rail: pos=${positions[0].blockX},${positions[0].blockY},${positions[0].blockZ}`,
				);
				return { status: "section_core_conflict" };
			}
		}
		const placementMaps: RailSectionMap[] = [];
		if (!createAsNormal) {
			for (let i = 0; i < sections.size(); i++) {
				const section = sections.get(i);
				const sectionMap =
					new Packages.jp.kaiz.kaizpatch.rtm.rail.util.RailMapSection(
						source,
						section.getStartRP(),
						section.getEndRP(),
						section.getStartRatio(),
						section.getEndRatio(),
					);
				if (!this.isBuilderRoadbedLoaded(world, sectionMap, property))
					return { status: "path_unloaded" };
				placementMaps.push(sectionMap);
			}
		} else if (!this.isBuilderRoadbedLoaded(world, source, property)) {
			return { status: "path_unloaded" };
		} else placementMaps.push(source);
		const preparation = this.validateBuilderPlacement(
			world,
			placementMaps,
			property,
			protectedRailKeys,
			preserveSectionCores,
		);
		if (preparation !== "ok") return { status: preparation };
		let core: TileEntityLargeRailCore | null = null;
		try {
			core = !createAsNormal
				? this.createBuilderSectionedRail(
						world,
						source,
						sections,
						positions,
						property,
						protectedRailKeys,
						overwriteForeignRoadbeds,
					)
				: this.createBuilderNormalRail(
						world,
						source,
						positions,
						property,
						protectedRailKeys,
						preserveSectionCores,
						overwriteForeignRoadbeds,
					);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX builder1] destructive rail creation exception: ${error}`,
			);
			return { status: "create_failed" };
		}
		if (!core) return { status: "create_failed" };
		const corePos = this.getRailCorePos(core);
		const createdKey = this.getRailPositionCandidateKey(core);
		this.logBuilderTransitionState(
			world,
			createdKey,
			corePos,
			positions[0],
			positions[1],
		);
		return {
			status: "ok",
			undoCore: corePos,
			undoKey: createdKey,
			createdAsNormalCrossing:
				preserveSectionCores || unsafeSectionCoreFallback,
		};
	}

	private static builderEndpointOwner(
		world: net.minecraft.world.World,
		x: number,
		y: number,
		z: number,
	): string {
		const tile = world.getTileEntity(x, y, z);
		if (!(tile instanceof TileEntityLargeRailBase))
			return `none(block=${world.getBlock(x, y, z)})`;
		const owner = tile.getRailCore();
		return owner
			? this.getRailPositionCandidateKey(owner)
			: "rail_without_core";
	}

	private static logBuilderTransitionState(
		world: net.minecraft.world.World,
		railKey: string,
		core: [number, number, number],
		start: RailPosition,
		end: RailPosition,
	): void {
		const startConnection = this.getBuilderConnectionBlock(start);
		const endConnection = this.getBuilderConnectionBlock(end);
		NGTLog.debug(
			`[SuperRailBuilderX transition] created: railKey=${railKey}, core=${core[0]},${core[1]},${core[2]}, startPos=${start.posX},${start.posY},${start.posZ}, startBlock=${start.blockX},${start.blockY},${start.blockZ}, startOwner=${this.builderEndpointOwner(world, start.blockX, start.blockY, start.blockZ)}, startConnection=${startConnection[0]},${startConnection[1]},${startConnection[2]}, startConnectionOwner=${this.builderEndpointOwner(world, startConnection[0], startConnection[1], startConnection[2])}, endPos=${end.posX},${end.posY},${end.posZ}, endBlock=${end.blockX},${end.blockY},${end.blockZ}, endOwner=${this.builderEndpointOwner(world, end.blockX, end.blockY, end.blockZ)}, endConnection=${endConnection[0]},${endConnection[1]},${endConnection[2]}, endConnectionOwner=${this.builderEndpointOwner(world, endConnection[0], endConnection[1], endConnection[2])}`,
		);
	}

	static undoBuilderRail(
		world: net.minecraft.world.World,
		coreX: number,
		coreY: number,
		coreZ: number,
		expectedKey: string,
	): string {
		const tile = world.getTileEntity(coreX, coreY, coreZ);
		if (!(tile instanceof TileEntityLargeRailBase)) {
			NGTLog.debug(
				`[SuperRailBuilderX builder1] undo rail not found: core=${coreX},${coreY},${coreZ}, expectedKey=${expectedKey}, block=${world.getBlock(coreX, coreY, coreZ)}, tile=${tile}`,
			);
			return "undo_rail_not_found";
		}
		const core = tile.getRailCore();
		if (!core) {
			NGTLog.debug(
				`[SuperRailBuilderX builder1] undo rail core missing: core=${coreX},${coreY},${coreZ}, expectedKey=${expectedKey}, tile=${tile}`,
			);
			return "undo_rail_not_found";
		}
		const actualKey = this.getRailPositionCandidateKey(core);
		if (actualKey !== expectedKey) {
			NGTLog.debug(
				`[SuperRailBuilderX builder1] undo rail changed: core=${coreX},${coreY},${coreZ}, expectedKey=${expectedKey}, actualKey=${actualKey}`,
			);
			return "undo_rail_changed";
		}
		if (core.isLogicalRailOccupied()) return "rail_occupied";
		const correctedRoadbeds: Array<{
			position: [number, number, number];
			tile: TileEntityLargeRailBase;
		}> = [];
		const syncBlocks: Array<[number, number, number]> = [
			[coreX, coreY, coreZ],
		];
		let cleanupMap = core.getRailMap(null) as unknown as RailSectionMap;
		if (this.isSectionCore(core)) {
			const logical = core.getLogicalRailPositions();
			if (logical && logical.length >= 2)
				cleanupMap = new RailMapBasic(
					logical[0],
					logical[1],
					core.fixRTMRailMapVersion,
				) as unknown as RailSectionMap;
		}
		if (cleanupMap) {
			const blocks = this.getBuilderRoadbedBlocks(
				cleanupMap,
				core.getProperty(),
			);
			for (let i = 0; i < blocks.length; i++) {
				const pos = blocks[i];
				syncBlocks.push(pos);
				const roadbed = world.getTileEntity(pos[0], pos[1], pos[2]);
				if (!(roadbed instanceof TileEntityLargeRailBase)) continue;
				const owner = roadbed.getRailCore();
				if (owner && core.isSameLogicalRail(owner))
					correctedRoadbeds.push({ position: pos, tile: roadbed });
			}
		}
		core.breakLogicalRail();
		let correctedRemoved = 0;
		for (let i = 0; i < correctedRoadbeds.length; i++) {
			const target = correctedRoadbeds[i];
			const current = world.getTileEntity(
				target.position[0],
				target.position[1],
				target.position[2],
			);
			if (current !== target.tile) continue;
			world.setBlockToAir(
				target.position[0],
				target.position[1],
				target.position[2],
			);
			world.removeTileEntity(
				target.position[0],
				target.position[1],
				target.position[2],
			);
			world.markBlockForUpdate(
				target.position[0],
				target.position[1],
				target.position[2],
			);
			correctedRemoved++;
		}
		for (let i = 0; i < syncBlocks.length; i++) {
			const pos = syncBlocks[i];
			world.markBlockForUpdate(pos[0], pos[1], pos[2]);
		}
		NGTLog.debug(
			`[SuperRailBuilderX builder1] generated logical rail removed by undo: core=${coreX},${coreY},${coreZ}, correctedRoadbeds=${correctedRemoved}, syncedBlocks=${syncBlocks.length}`,
		);
		return "ok";
	}

	static getLogicalRailMap(core: TileEntityLargeRailCore) {
		if (!core || core instanceof TileEntityLargeRailSwitchCore) return null;
		if (this.isSectionCore(core)) {
			let positions: JavaObjectArray<RailPosition> | null = null;
			try {
				if (!core.isRailSection()) return null;
				positions = core.getLogicalRailPositions();
			} catch (error) {
				NGTLog.debug(
					`[SuperRailBuilderX RailPosition] invalid logical rail map ignored: ${error}`,
				);
				return null;
			}
			if (!positions || positions.length !== 2) return null;
			return new RailMapBasic(
				positions[0],
				positions[1],
				core.fixRTMRailMapVersion,
			);
		}
		return core.getRailMap(null);
	}

	private static cloneRailProperty(property: RailProperty): RailProperty {
		const nbt = new NBTTagCompound();
		property.writeToNBT(nbt);
		return RailProperty.readFromNBT(nbt);
	}

	private static lerpSplitPoint(
		a: [number, number],
		b: [number, number],
		t: number,
	): [number, number] {
		return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
	}

	private static cubicSplitPoint(
		points: Array<[number, number]>,
		t: number,
	): [number, number] {
		const q0 = this.lerpSplitPoint(points[0], points[1], t);
		const q1 = this.lerpSplitPoint(points[1], points[2], t);
		const q2 = this.lerpSplitPoint(points[2], points[3], t);
		const r0 = this.lerpSplitPoint(q0, q1, t);
		const r1 = this.lerpSplitPoint(q1, q2, t);
		return this.lerpSplitPoint(r0, r1, t);
	}

	private static splitHorizontalBezier(
		start: RailPosition,
		end: RailPosition,
		targetX: number,
		targetZ: number,
	) {
		const startYaw = (start.anchorYaw * Math.PI) / 180;
		const endYaw = (end.anchorYaw * Math.PI) / 180;
		const chord = Math.sqrt(
			Math.pow(end.posX - start.posX, 2) +
				Math.pow(end.posZ - start.posZ, 2),
		);
		const startLength =
			start.anchorLengthHorizontal > 0
				? start.anchorLengthHorizontal
				: chord / 3;
		const endLength =
			end.anchorLengthHorizontal > 0
				? end.anchorLengthHorizontal
				: chord / 3;
		const points: Array<[number, number]> = [
			[start.posX, start.posZ],
			[
				start.posX + Math.sin(startYaw) * startLength,
				start.posZ + Math.cos(startYaw) * startLength,
			],
			[
				end.posX + Math.sin(endYaw) * endLength,
				end.posZ + Math.cos(endYaw) * endLength,
			],
			[end.posX, end.posZ],
		];
		let low = 0;
		let high = 1;
		for (let i = 0; i < 56; i++) {
			const t0 = low + (high - low) / 3;
			const t1 = high - (high - low) / 3;
			const p0 = this.cubicSplitPoint(points, t0);
			const p1 = this.cubicSplitPoint(points, t1);
			const d0 =
				Math.pow(p0[0] - targetX, 2) + Math.pow(p0[1] - targetZ, 2);
			const d1 =
				Math.pow(p1[0] - targetX, 2) + Math.pow(p1[1] - targetZ, 2);
			if (d0 < d1) high = t1;
			else low = t0;
		}
		const t = (low + high) / 2;
		const q0 = this.lerpSplitPoint(points[0], points[1], t);
		const q1 = this.lerpSplitPoint(points[1], points[2], t);
		const q2 = this.lerpSplitPoint(points[2], points[3], t);
		const r0 = this.lerpSplitPoint(q0, q1, t);
		const r1 = this.lerpSplitPoint(q1, q2, t);
		const split = this.lerpSplitPoint(r0, r1, t);
		const distance = (a: [number, number], b: [number, number]) =>
			Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
		const yaw = (a: [number, number], b: [number, number]) =>
			this.normalizeDegrees(
				(Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI,
			);
		return {
			t,
			firstStartLength: distance(points[0], q0),
			firstEndLength: distance(split, r0),
			firstEndYaw: yaw(split, r0),
			secondStartLength: distance(split, r1),
			secondStartYaw: yaw(split, r1),
			secondEndLength: distance(points[3], q2),
		};
	}

	private static verticalLengthForPitch(
		horizontalLength: number,
		pitch: number,
	): number {
		const cosine = Math.abs(Math.cos((pitch * Math.PI) / 180));
		return Math.max(0.01, horizontalLength / Math.max(0.001, cosine));
	}

	private static splitPointFromRailPosition(
		rp: RailPosition,
		anchorLength: number,
		anchorLengthVertical: number,
	): BuilderPoint {
		return {
			kind: "free",
			position: [rp.posX, rp.posY, rp.posZ],
			direction: rp.direction,
			anchorYaw: rp.anchorYaw,
			anchorPitch: rp.anchorPitch,
			anchorLength,
			anchorLengthVertical,
			markerPosition: [rp.posX, rp.posY, rp.posZ],
			ownerBlock: [rp.blockX, rp.blockY, rp.blockZ],
			cantEdge: rp.cantEdge,
			cantCenter: rp.cantCenter,
			cantRandom: rp.cantRandom,
		};
	}

	private static restoreSplitSource(
		world: net.minecraft.world.World,
		player: EntityPlayer,
		record: SplitUndoRecord,
	): SplitCreatedRail | null {
		try {
			const protectedKeys: { [key: string]: boolean } = {};
			for (let i = 0; i < record.positions.length; i++) {
				const rp = record.positions[i];
				const candidates = [
					[rp.blockX, rp.blockY, rp.blockZ],
					this.getBuilderConnectionBlock(rp),
				];
				for (let j = 0; j < candidates.length; j++) {
					const pos = candidates[j];
					const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
					if (!(tile instanceof TileEntityLargeRailBase)) continue;
					const owner = tile.getRailCore();
					if (owner)
						protectedKeys[this.getRailPositionCandidateKey(owner)] =
							true;
				}
			}
			const restored = this.createBuilderRail(
				world,
				player,
				this.splitPointFromRailPosition(
					record.positions[0],
					record.positions[0].anchorLengthHorizontal,
					record.positions[0].anchorLengthVertical,
				),
				this.splitPointFromRailPosition(
					record.positions[1],
					record.positions[1].anchorLengthHorizontal,
					record.positions[1].anchorLengthVertical,
				),
				Object.keys(protectedKeys),
				undefined,
				record.property,
				!record.wasSectioned,
				true,
			);
			if (
				restored.status !== "ok" ||
				!restored.undoCore ||
				!restored.undoKey
			) {
				NGTLog.debug(
					`[SuperRailBuilderX splitter] source restore failed: result=${restored.status}`,
				);
				return null;
			}
			if (
				!this.applyBuilderRailState(
					world,
					restored,
					record.signal,
					record.subRails,
				)
			) {
				this.undoBuilderRail(
					world,
					restored.undoCore[0],
					restored.undoCore[1],
					restored.undoCore[2],
					restored.undoKey,
				);
				return null;
			}
			return { core: restored.undoCore, key: restored.undoKey };
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX splitter] source restore exception: ${error}`,
			);
			return null;
		}
	}

	static consumeLastSplitClientUpdate(): SplitClientUpdate | null {
		const result = this.lastSplitClientUpdate;
		this.lastSplitClientUpdate = null;
		return result;
	}

	static splitBuilderRail(
		world: net.minecraft.world.World,
		player: EntityPlayer,
		corePosition: [number, number, number],
		expectedKey: string,
		ratio: number,
	) {
		this.lastSplitClientUpdate = null;
		if (!isFinite(ratio) || ratio <= 0 || ratio >= 1)
			return { status: "invalid_split_position" };
		const tile = world.getTileEntity(
			corePosition[0],
			corePosition[1],
			corePosition[2],
		);
		if (!(tile instanceof TileEntityLargeRailBase))
			return { status: "rail_not_found" };
		const core = tile.getRailCore();
		if (!core) return { status: "rail_not_found" };
		if (core instanceof TileEntityLargeRailSwitchCore)
			return { status: "switch_unsupported" };
		if (this.getRailPositionCandidateKey(core) !== expectedKey)
			return { status: "rail_changed" };
		if (core.isLogicalRailOccupied()) return { status: "rail_occupied" };
		const railMap = this.getLogicalRailMap(core);
		if (!railMap) return { status: "invalid_rail" };
		const length = railMap.getLength();
		if (length <= 6) return { status: "rail_too_short" };
		const renderSplit = Math.max(1, Math.floor(railMap.getLength() * 2));
		const candidateSplit = Math.max(2, renderSplit);
		const candidateIndex = Math.round(ratio * candidateSplit);
		if (
			candidateIndex <= 0 ||
			candidateIndex >= candidateSplit ||
			Math.abs(ratio - candidateIndex / candidateSplit) > 0.0000001
		)
			return { status: "invalid_split_position" };
		ratio = candidateIndex / candidateSplit;
		const positions = this.isSectionCore(core)
			? core.getLogicalRailPositions()
			: core.getRailPositions();
		if (!positions || positions.length !== 2)
			return { status: "invalid_rail" };
		const original = this.copyRailPositions(positions);
		const property = this.cloneRailProperty(core.getProperty());
		const subRails = new ArrayList<RailProperty>();
		for (let i = 0; i < core.subRails.size(); i++)
			subRails.add(this.cloneRailProperty(core.subRails.get(i)));
		const record: SplitUndoRecord = {
			positions: original,
			property,
			signal: core.getSignal(),
			subRails,
			created: [],
			wasSectioned: this.isSectionCore(core),
		};
		const leftLength = length * ratio;
		const rightLength = length - leftLength;
		if (leftLength <= 3 || rightLength <= 3)
			return { status: "rail_too_short" };
		const point = railMap.getRailPos(1000000, Math.round(ratio * 1000000));
		const x = point[1];
		const sampleIndex = Math.round(ratio * 1000000);
		const cant = railMap.getCant(1000000, sampleIndex);
		const cantLift = Math.abs(Math.sin((cant * Math.PI) / 180) * 1.5);
		const y = railMap.getRailHeight(1000000, sampleIndex) - cantLift;
		const z = point[0];
		const sampledYaw = railMap.getRailYaw(1000000, sampleIndex);
		const pitch = railMap.getRailPitch(
			1000000,
			Math.round(ratio * 1000000),
		);
		const horizontal = this.splitHorizontalBezier(
			original[0],
			original[1],
			x,
			z,
		);
		const direction = this.builderDirectionFromYaw(
			horizontal.secondStartYaw,
		);
		const yawRadians = (direction * 45 * Math.PI) / 180;
		const splitStart = new RailPosition(
			Math.floor(x + Math.sin(yawRadians) * 0.000001),
			Math.floor(y - 1 / 16 + 0.000001),
			Math.floor(z + Math.cos(yawRadians) * 0.000001),
			direction,
		);
		splitStart.anchorYaw = horizontal.secondStartYaw;
		splitStart.anchorPitch = pitch;
		splitStart.anchorLengthHorizontal = Math.max(
			0.01,
			horizontal.secondStartLength,
		);
		splitStart.anchorLengthVertical = this.verticalLengthForPitch(
			splitStart.anchorLengthHorizontal,
			pitch,
		);
		splitStart.cantEdge = cant;
		splitStart.cantCenter = railMap.getCant(
			1000000,
			Math.round(((ratio + 1) / 2) * 1000000),
		);
		splitStart.setPosition(x, y, z);
		const splitEnd = RailPosition.readFromNBT(splitStart.writeToNBT());
		const splitEndBlock = this.getBuilderConnectionBlock(splitStart);
		splitEnd.blockX = splitEndBlock[0];
		splitEnd.blockY = splitEndBlock[1];
		splitEnd.blockZ = splitEndBlock[2];
		splitEnd.direction = (splitStart.direction + 4) & 7;
		splitEnd.anchorYaw = horizontal.firstEndYaw;
		splitEnd.anchorPitch = -splitStart.anchorPitch;
		splitEnd.anchorLengthHorizontal = Math.max(
			0.01,
			horizontal.firstEndLength,
		);
		splitEnd.anchorLengthVertical = this.verticalLengthForPitch(
			splitEnd.anchorLengthHorizontal,
			splitEnd.anchorPitch,
		);
		splitEnd.cantEdge = -splitStart.cantEdge;
		splitEnd.cantCenter = railMap.getCant(
			1000000,
			Math.round((ratio / 2) * 1000000),
		);
		splitEnd.setPosition(x, y, z);
		const firstStart = this.splitPointFromRailPosition(
			original[0],
			Math.max(0.01, horizontal.firstStartLength),
			this.verticalLengthForPitch(
				horizontal.firstStartLength,
				original[0].anchorPitch,
			),
		);
		const firstEnd = this.splitPointFromRailPosition(
			splitEnd,
			splitEnd.anchorLengthHorizontal,
			splitEnd.anchorLengthVertical,
		);
		const secondStart = this.splitPointFromRailPosition(
			splitStart,
			splitStart.anchorLengthHorizontal,
			splitStart.anchorLengthVertical,
		);
		const secondEnd = this.splitPointFromRailPosition(
			original[1],
			Math.max(0.01, horizontal.secondEndLength),
			this.verticalLengthForPitch(
				horizontal.secondEndLength,
				original[1].anchorPitch,
			),
		);
		const connectedRailKeys = this.getBuilderMoveProtectedRailKeys(
			core,
			original,
		);
		core.breakLogicalRail();
		const first = this.createBuilderRail(
			world,
			player,
			firstStart,
			firstEnd,
			connectedRailKeys,
			undefined,
			property,
			leftLength <= 64 && rightLength <= 64,
			false,
			false,
			undefined,
			firstEnd.ownerBlock,
		);
		if (first.status !== "ok" || !first.undoCore || !first.undoKey) {
			const restored = this.restoreSplitSource(world, player, record);
			if (restored)
				this.lastSplitClientUpdate = {
					removed: [{ core: corePosition, key: expectedKey }],
					refreshed: [restored],
				};
			return {
				status: restored ? first.status : "split_rollback_failed",
			};
		}
		record.created.push({ core: first.undoCore, key: first.undoKey });
		const second = this.createBuilderRail(
			world,
			player,
			secondStart,
			secondEnd,
			connectedRailKeys.concat([first.undoKey]),
			undefined,
			property,
			leftLength <= 64 && rightLength <= 64,
			false,
			false,
			undefined,
			secondStart.ownerBlock,
		);
		if (second.status !== "ok" || !second.undoCore || !second.undoKey) {
			this.undoBuilderRail(
				world,
				first.undoCore[0],
				first.undoCore[1],
				first.undoCore[2],
				first.undoKey,
			);
			const restored = this.restoreSplitSource(world, player, record);
			if (restored)
				this.lastSplitClientUpdate = {
					removed: [
						{ core: corePosition, key: expectedKey },
						{ core: first.undoCore, key: first.undoKey },
					],
					refreshed: [restored],
				};
			return {
				status: restored ? second.status : "split_rollback_failed",
			};
		}
		record.created.push({ core: second.undoCore, key: second.undoKey });
		const token = java.util.UUID.randomUUID().toString();
		this.splitUndoRecords[token] = record;
		this.lastSplitClientUpdate = {
			removed: [{ core: corePosition, key: expectedKey }],
			refreshed: record.created.slice(),
		};
		NGTLog.debug(
			`[SuperRailBuilderX splitter] split succeeded: ratio=${ratio}, bezierT=${horizontal.t}, sampledYaw=${sampledYaw}, lengths=${leftLength}/${rightLength}, token=${token}`,
		);
		return { status: "ok", undoToken: token };
	}

	static undoSplitBuilderRail(
		world: net.minecraft.world.World,
		player: EntityPlayer,
		undoToken: string,
	): string {
		this.lastSplitClientUpdate = null;
		const record = this.splitUndoRecords[undoToken];
		if (!record) return "nothing_to_undo";
		const removed: SplitCreatedRail[] = [];
		for (let i = record.created.length - 1; i >= 0; i--) {
			const rail = record.created[i];
			const result = this.undoBuilderRail(
				world,
				rail.core[0],
				rail.core[1],
				rail.core[2],
				rail.key,
			);
			if (result !== "ok") {
				if (removed.length > 0)
					this.lastSplitClientUpdate = {
						removed,
						refreshed: [],
					};
				return result;
			}
			removed.push(rail);
		}
		const restored = this.restoreSplitSource(world, player, record);
		if (!restored) return "undo_restore_failed";
		const cantRestore = record.cants
			? this.restoreCantRecords(world, record.cants)
			: { status: "ok", refreshed: [] as SplitCreatedRail[] };
		if (cantRestore.status !== "ok") return cantRestore.status;
		this.lastSplitClientUpdate = {
			removed,
			refreshed: [restored].concat(cantRestore.refreshed),
		};
		delete this.splitUndoRecords[undoToken];
		return "undo_ok";
	}

	private static updateCantRail(
		world: net.minecraft.world.World,
		core: TileEntityLargeRailCore,
		positions: RailPosition[],
	): Array<[number, number, number]> {
		const refreshed: Array<[number, number, number]> = [];
		const apply = (target: TileEntityLargeRailCore) => {
			if (this.isSectionCore(target)) {
				const nbt = new NBTTagCompound();
				target.writeSectionData(nbt);
				const section = nbt.getCompoundTag("RailSection");
				if (!section || !section.hasKey("LogicalStartRP")) return;
				const setTag = (
					compound: NBTTagCompound,
					key: string,
					value: NBTTagCompound,
				) =>
					(
						compound as unknown as {
							func_74782_a(name: string, tag: unknown): void;
						}
					).func_74782_a(key, value);
				setTag(section, "LogicalStartRP", positions[0].writeToNBT());
				setTag(section, "LogicalEndRP", positions[1].writeToNBT());
				setTag(nbt, "RailSection", section);
				target.readSectionData(nbt);
			} else {
				const targetPositions = this.getEditableRailPositions(target);
				if (
					!targetPositions ||
					targetPositions.length !== positions.length
				)
					return;
				for (let i = 0; i < positions.length; i++) {
					targetPositions[i].cantEdge = positions[i].cantEdge;
					targetPositions[i].cantCenter = positions[i].cantCenter;
					targetPositions[i].cantRandom = positions[i].cantRandom;
				}
				target.setRailPositions(targetPositions);
			}
			target.createRailMap();
			target.shouldRerenderRail = true;
			this.markCoreDirty(target);
			NGTUtil.sendPacketToClient(target);
			world.markBlockForUpdate(
				target.xCoord,
				target.yCoord,
				target.zCoord,
			);
			refreshed.push([target.xCoord, target.yCoord, target.zCoord]);
		};
		if (this.isSectionCore(core)) {
			const group = core.getRailGroupCorePositions();
			if (group)
				for (let i = 0; i < group.size(); i++) {
					const pos = group.get(i);
					const tile = world.getTileEntity(pos[0], pos[1], pos[2]);
					if (tile instanceof TileEntityLargeRailCore) apply(tile);
				}
		} else apply(core);
		return refreshed;
	}

	private static zeroRailCants(
		world: net.minecraft.world.World,
		core: TileEntityLargeRailCore,
		indices: number[] | null,
		records?: CantUndoRecord,
	): Array<[number, number, number]> {
		const positions = this.copyRailPositions(
			this.getEditableRailPositions(core),
		);
		if (!positions || positions.length < 2) return [];
		const key = this.getRailPositionCandidateKey(core);
		if (records) {
			let recorded = false;
			for (let i = 0; i < records.length; i++)
				if (records[i].railKey === key) recorded = true;
			if (!recorded)
				records.push({
					core: this.getRailCorePos(core),
					railKey: key,
					positions: this.copyRailPositions(positions),
				});
		}
		const targets = indices || positions.map((_position, index) => index);
		for (let i = 0; i < targets.length; i++) {
			const index = targets[i];
			if (index < 0 || index >= positions.length) continue;
			positions[index].cantEdge = 0;
			positions[index].cantRandom = 0;
		}
		if (positions.length === 2) {
			const center = (positions[0].cantEdge - positions[1].cantEdge) / 2;
			positions[0].cantCenter = center;
			positions[1].cantCenter = center;
		} else
			for (let i = 0; i < positions.length; i++)
				positions[i].cantCenter = 0;
		return this.updateCantRail(world, core, positions);
	}

	private static findConnectedCantEndpoints(
		world: net.minecraft.world.World,
		sourceCore: TileEntityLargeRailCore,
		positions: { length: number; [index: number]: RailPosition },
	): Array<{ core: TileEntityLargeRailCore; index: number }> {
		const result: Array<{ core: TileEntityLargeRailCore; index: number }> =
			[];
		const seen: { [key: string]: boolean } = {};
		for (let i = 0; i < positions.length; i++) {
			const source = positions[i];
			const block = this.getBuilderConnectionBlock(source);
			const tile = world.getTileEntity(block[0], block[1], block[2]);
			if (!(tile instanceof TileEntityLargeRailBase)) continue;
			const core = tile.getRailCore();
			if (
				!core ||
				core === sourceCore ||
				sourceCore.isSameLogicalRail(core)
			)
				continue;
			const connected = this.getEditableRailPositions(core);
			for (let index = 0; index < connected.length; index++) {
				const rp = connected[index];
				if (
					Math.abs(rp.posX - source.posX) > 0.001 ||
					Math.abs(rp.posY - source.posY) > 0.001 ||
					Math.abs(rp.posZ - source.posZ) > 0.001
				)
					continue;
				const id = `${this.getRailPositionCandidateKey(core)}:${index}`;
				if (!seen[id]) {
					seen[id] = true;
					result.push({ core, index });
				}
			}
		}
		return result;
	}

	private static restoreCantRecords(
		world: net.minecraft.world.World,
		records: CantUndoRecord,
	): { status: string; refreshed: SplitCreatedRail[] } {
		const refreshed: SplitCreatedRail[] = [];
		for (let i = 0; i < records.length; i++) {
			const record = records[i];
			const tile = world.getTileEntity(
				record.core[0],
				record.core[1],
				record.core[2],
			);
			if (!(tile instanceof TileEntityLargeRailBase))
				return { status: "undo_rail_not_found", refreshed };
			const core = tile.getRailCore();
			if (
				!core ||
				this.getRailPositionCandidateKey(core) !== record.railKey
			)
				return { status: "undo_rail_changed", refreshed };
			if (core.isLogicalRailOccupied())
				return { status: "rail_occupied", refreshed };
			const cores = this.updateCantRail(world, core, record.positions);
			for (let j = 0; j < cores.length; j++)
				refreshed.push({ core: cores[j], key: record.railKey });
		}
		return { status: "ok", refreshed };
	}

	static applyRailCants(
		world: net.minecraft.world.World,
		targets: CantTarget[],
	) {
		this.lastCantClientUpdate = [];
		if (!targets || targets.length === 0) return { status: "no_selection" };
		const records: CantUndoRecord = [];
		const pending: {
			[key: string]: {
				core: TileEntityLargeRailCore;
				positions: RailPosition[];
			};
		} = {};
		const getPending = (core: TileEntityLargeRailCore) => {
			const railKey = this.getRailPositionCandidateKey(core);
			let entry = pending[railKey];
			if (!entry) {
				const positions = this.copyRailPositions(
					this.getEditableRailPositions(core),
				);
				if (!positions || positions.length !== 2) return null;
				records.push({
					core: this.getRailCorePos(core),
					railKey,
					positions: this.copyRailPositions(positions),
				});
				entry = { core, positions };
				pending[railKey] = entry;
			}
			return entry;
		};
		for (let i = 0; i < targets.length; i++) {
			const target = targets[i];
			if (
				!target ||
				!isFinite(target.angle) ||
				Math.abs(target.angle) > 9
			)
				return { status: "invalid_cant" };
			const tile = world.getTileEntity(
				target.core[0],
				target.core[1],
				target.core[2],
			);
			if (!(tile instanceof TileEntityLargeRailBase))
				return { status: "rail_not_found" };
			const core = tile.getRailCore();
			if (!core || this.getRailPositionUnsupportedReason(core) !== "")
				return { status: "unsupported_rail" };
			if (this.getRailPositionCandidateKey(core) !== target.railKey)
				return { status: "rail_changed" };
			if (core.isLogicalRailOccupied())
				return { status: "rail_occupied" };
			const entry = getPending(core);
			if (!entry) return { status: "invalid_rail" };
			if (target.index < 0 || target.index >= entry.positions.length)
				return { status: "invalid_endpoint" };
			const rp = entry.positions[target.index];
			if (
				Math.abs(rp.posX - target.position[0]) > 0.001 ||
				Math.abs(rp.posY - target.position[1]) > 0.001 ||
				Math.abs(rp.posZ - target.position[2]) > 0.001
			)
				return { status: "rail_changed" };
			rp.cantEdge = target.angle;
			const connected = this.findConnectedCantEndpoints(world, core, [
				rp,
			]);
			for (let j = 0; j < connected.length; j++) {
				const neighbor = connected[j];
				if (this.getRailPositionUnsupportedReason(neighbor.core) !== "")
					return { status: "unsupported_rail" };
				if (neighbor.core.isLogicalRailOccupied())
					return { status: "rail_occupied" };
				const neighborEntry = getPending(neighbor.core);
				if (!neighborEntry) return { status: "invalid_rail" };
				neighborEntry.positions[neighbor.index].cantEdge =
					-target.angle;
			}
		}
		const keys = Object.keys(pending);
		for (let i = 0; i < keys.length; i++) {
			const entry = pending[keys[i]];
			const center =
				(entry.positions[0].cantEdge - entry.positions[1].cantEdge) / 2;
			entry.positions[0].cantCenter = center;
			entry.positions[1].cantCenter = center;
			this.lastCantClientUpdate = this.lastCantClientUpdate.concat(
				this.updateCantRail(world, entry.core, entry.positions),
			);
		}
		const token = java.util.UUID.randomUUID().toString();
		this.cantUndoRecords[token] = records;
		return { status: "ok", undoToken: token };
	}

	static undoRailCants(
		world: net.minecraft.world.World,
		undoToken: string,
	): string {
		this.lastCantClientUpdate = [];
		const records = this.cantUndoRecords[undoToken];
		if (!records) return "nothing_to_undo";
		for (let i = 0; i < records.length; i++) {
			const record = records[i];
			const tile = world.getTileEntity(
				record.core[0],
				record.core[1],
				record.core[2],
			);
			if (!(tile instanceof TileEntityLargeRailBase))
				return "undo_rail_not_found";
			const core = tile.getRailCore();
			if (
				!core ||
				this.getRailPositionCandidateKey(core) !== record.railKey
			)
				return "undo_rail_changed";
			if (core.isLogicalRailOccupied()) return "rail_occupied";
			this.lastCantClientUpdate = this.lastCantClientUpdate.concat(
				this.updateCantRail(world, core, record.positions),
			);
		}
		delete this.cantUndoRecords[undoToken];
		return "undo_ok";
	}

	static consumeLastCantClientUpdate(): Array<[number, number, number]> {
		const result = this.lastCantClientUpdate;
		this.lastCantClientUpdate = [];
		return result;
	}

	private static withSwitchType(
		source: RailPosition,
		switchType: number,
	): RailPosition {
		const nbt = source.writeToNBT();
		nbt.setByte("SwitchType", switchType);
		return RailPosition.readFromNBT(nbt);
	}

	private static createBuilderBasicSwitch(
		world: net.minecraft.world.World,
		positions: RailPosition[],
		property: RailProperty,
		protectedKeys: string[],
	): TileEntityLargeRailSwitchCore | null {
		const root = positions[0];
		const maker = new RailMaker(
			world,
			this.toRailPositionArray(positions),
			RailMapBasic.fixRTMRailMapVersionCurrent,
		);
		const railSwitch = maker.getSwitch();
		if (!railSwitch) return null;
		const maps = railSwitch.getAllRailMap();
		const protectedMap: { [key: string]: boolean } = {};
		for (let i = 0; i < protectedKeys.length; i++)
			protectedMap[protectedKeys[i]] = true;
		for (let i = 0; i < maps.length; i++)
			this.placeBuilderRoadbed(
				world,
				maps[i] as unknown as RailSectionMap,
				root.blockX,
				root.blockY,
				root.blockZ,
				property,
				protectedMap,
				false,
				undefined,
				true,
			);
		for (let i = 0; i < positions.length; i++) {
			const rp = positions[i];
			world.setBlock(
				rp.blockX,
				rp.blockY,
				rp.blockZ,
				RTMRail.largeRailSwitchBase0,
				0,
				2,
			);
			const base = world.getTileEntity(rp.blockX, rp.blockY, rp.blockZ);
			if (base instanceof TileEntityLargeRailBase)
				base.setStartPoint(root.blockX, root.blockY, root.blockZ);
		}
		world.setBlock(
			root.blockX,
			root.blockY,
			root.blockZ,
			RTMRail.largeRailSwitchCore0,
			0,
			2,
		);
		const tile = world.getTileEntity(root.blockX, root.blockY, root.blockZ);
		if (!(tile instanceof TileEntityLargeRailSwitchCore)) return null;
		tile.setRailPositions(this.toRailPositionArray(positions));
		tile.setProperty(property);
		tile.setStartPoint(root.blockX, root.blockY, root.blockZ);
		(tile as unknown as NormalRailCore).fixRTMRailMapVersion =
			RailMapBasic.fixRTMRailMapVersionCurrent;
		tile.createRailMap();
		this.markCoreDirty(tile);
		NGTUtil.sendPacketToClient(tile);
		world.markBlockForUpdate(root.blockX, root.blockY, root.blockZ);
		return tile;
	}

	private static isFlatBuilderRail(core: TileEntityLargeRailCore): boolean {
		const map = this.getLogicalRailMap(core);
		return (
			!!map &&
			Math.abs(map.getRailPitch(1000, 0)) <= 0.001 &&
			Math.abs(map.getRailPitch(1000, 500)) <= 0.001 &&
			Math.abs(map.getRailPitch(1000, 1000)) <= 0.001
		);
	}

	private static createEndpointBranchBuilderRail(
		world: net.minecraft.world.World,
		player: EntityPlayer,
		sourceCore: TileEntityLargeRailCore,
		resolvedEnd: RailPosition,
		resolvedEndCore: TileEntityLargeRailCore | null,
		request: {
			core: [number, number, number];
			railKey: string;
			ratio: number;
			branchStart: BuilderPoint;
			branchEnd: BuilderPoint;
		},
	) {
		const sourcePositions = this.copyRailPositions(
			this.getEditableRailPositions(sourceCore),
		);
		if (!sourcePositions || sourcePositions.length !== 2)
			return { status: "invalid_source_rail" };
		const rootIndex = request.ratio === 0 ? 0 : 1;
		const sourceRoot = sourcePositions[rootIndex];
		if (
			Math.abs(
				this.builderAngleDifference(
					sourceRoot.anchorYaw,
					request.branchStart.anchorYaw,
				),
			) > 0.001 ||
			Math.abs(sourceRoot.anchorPitch - request.branchStart.anchorPitch) >
				0.001
		)
			return { status: "rail_changed" };
		const connectedEndpoints = this.findConnectedCantEndpoints(
			world,
			sourceCore,
			sourcePositions,
		);
		const subRails = new ArrayList<RailProperty>();
		for (let i = 0; i < sourceCore.subRails.size(); i++)
			subRails.add(this.cloneRailProperty(sourceCore.subRails.get(i)));
		const record: SplitUndoRecord = {
			positions: this.copyRailPositions(sourcePositions),
			property: this.cloneRailProperty(sourceCore.getProperty()),
			signal: sourceCore.getSignal(),
			subRails,
			created: [],
			wasSectioned: this.isSectionCore(sourceCore),
		};
		const root = this.withSwitchType(sourcePositions[rootIndex], 1);
		const trunk = this.withSwitchType(sourcePositions[1 - rootIndex], 0);
		const branch = this.withSwitchType(resolvedEnd, 0);
		branch.anchorLengthHorizontal = request.branchEnd.anchorLength;
		branch.anchorLengthVertical =
			request.branchEnd.anchorLengthVertical === undefined
				? request.branchEnd.anchorLength
				: request.branchEnd.anchorLengthVertical;
		const switchPositions = [root, trunk, branch];
		for (let i = 0; i < switchPositions.length; i++) {
			switchPositions[i].cantEdge = 0;
			switchPositions[i].cantCenter = 0;
			switchPositions[i].cantRandom = 0;
		}
		const protectedKeys = this.getBuilderMoveProtectedRailKeys(
			sourceCore,
			sourcePositions,
		);
		if (resolvedEndCore)
			protectedKeys.push(
				this.getRailPositionCandidateKey(resolvedEndCore),
			);
		const held = this.createBuilderProperty(player);
		const property = held || this.cloneRailProperty(record.property);
		property.autoSplit = false;
		NGTLog.debug(
			`[SuperRailBuilderX branch] endpoint switch plan: rootIndex=${rootIndex}, rootPos=${root.posX},${root.posY},${root.posZ}, rootYaw=${root.anchorYaw}, rootLength=${root.anchorLengthHorizontal}, trunkPos=${trunk.posX},${trunk.posY},${trunk.posZ}, branchPos=${branch.posX},${branch.posY},${branch.posZ}, branchYaw=${branch.anchorYaw}, branchLength=${branch.anchorLengthHorizontal}`,
		);
		sourceCore.breakLogicalRail();
		let switchCore: TileEntityLargeRailSwitchCore | null = null;
		try {
			switchCore = this.createBuilderBasicSwitch(
				world,
				switchPositions,
				property,
				protectedKeys,
			);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX branch] endpoint switch creation exception: ${error}`,
			);
		}
		if (!switchCore) {
			const restored = this.restoreSplitSource(world, player, record);
			if (restored)
				this.lastSplitClientUpdate = {
					removed: [{ core: request.core, key: request.railKey }],
					refreshed: [restored],
				};
			return {
				status: restored
					? "switch_create_failed"
					: "split_rollback_failed",
			};
		}
		switchCore.setSignal(record.signal);
		for (let i = 0; i < record.subRails.size(); i++)
			switchCore.addSubRail(
				this.cloneRailProperty(record.subRails.get(i)),
			);
		this.markCoreDirty(switchCore);
		NGTUtil.sendPacketToClient(switchCore);
		const created = {
			core: this.getRailCorePos(switchCore),
			key: this.getRailPositionCandidateKey(switchCore),
		};
		record.created.push(created);
		record.cants = [];
		let refreshed: SplitCreatedRail[] = [created];
		const appendRefresh = (
			core: TileEntityLargeRailCore,
			positions: Array<[number, number, number]>,
		) => {
			const key = this.getRailPositionCandidateKey(core);
			for (let i = 0; i < positions.length; i++)
				refreshed.push({ core: positions[i], key });
		};
		for (let i = 0; i < connectedEndpoints.length; i++) {
			const endpoint = connectedEndpoints[i];
			appendRefresh(
				endpoint.core,
				this.zeroRailCants(
					world,
					endpoint.core,
					[endpoint.index],
					record.cants,
				),
			);
		}
		if (
			resolvedEndCore &&
			request.branchEnd.index !== undefined &&
			resolvedEndCore !== sourceCore
		)
			appendRefresh(
				resolvedEndCore,
				this.zeroRailCants(
					world,
					resolvedEndCore,
					[request.branchEnd.index],
					record.cants,
				),
			);
		const token = java.util.UUID.randomUUID().toString();
		this.splitUndoRecords[token] = record;
		const seen: { [key: string]: boolean } = {};
		refreshed = refreshed.filter((rail) => {
			const id = `${rail.core[0]},${rail.core[1]},${rail.core[2]}`;
			if (seen[id]) return false;
			seen[id] = true;
			return true;
		});
		this.lastSplitClientUpdate = {
			removed: [{ core: request.core, key: request.railKey }],
			refreshed,
		};
		return { status: "ok", undoToken: token };
	}

	static createBranchBuilderRail(
		world: net.minecraft.world.World,
		player: EntityPlayer,
		request: {
			core: [number, number, number];
			railKey: string;
			ratio: number;
			branchStart: BuilderPoint;
			branchEnd: BuilderPoint;
		},
	) {
		this.lastSplitClientUpdate = null;
		if (
			!request ||
			this.validateBuilderPoint(request.branchStart) !== "ok" ||
			this.validateBuilderPoint(request.branchEnd) !== "ok"
		)
			return { status: "invalid_request" };
		const sourceTile = world.getTileEntity(
			request.core[0],
			request.core[1],
			request.core[2],
		);
		if (!(sourceTile instanceof TileEntityLargeRailBase))
			return { status: "rail_not_found" };
		const sourceCore = sourceTile.getRailCore();
		if (
			!sourceCore ||
			this.getRailPositionCandidateKey(sourceCore) !== request.railKey ||
			!this.isFlatBuilderRail(sourceCore)
		)
			return { status: "sloped_or_changed_rail" };
		const sourceMap = this.getLogicalRailMap(sourceCore);
		const endpoint = request.ratio === 0 || request.ratio === 1;
		if (
			!sourceMap ||
			!isFinite(request.ratio) ||
			request.ratio < 0 ||
			request.ratio > 1
		)
			return { status: "invalid_split_position" };
		if (
			(endpoint && request.branchStart.kind !== "rail") ||
			(!endpoint && request.branchStart.kind !== "free")
		)
			return { status: "invalid_branch_start" };
		if (
			endpoint &&
			(!request.branchStart.core ||
				request.branchStart.core[0] !== request.core[0] ||
				request.branchStart.core[1] !== request.core[1] ||
				request.branchStart.core[2] !== request.core[2] ||
				request.branchStart.index !== (request.ratio === 0 ? 0 : 1))
		)
			return { status: "invalid_branch_start" };
		const sampleIndex = Math.round(request.ratio * 1000000);
		const sourcePositions = this.getEditableRailPositions(sourceCore);
		if (!sourcePositions || sourcePositions.length !== 2)
			return { status: "invalid_source_rail" };
		const sampledPosition: [number, number, number] = endpoint
			? [
					sourcePositions[request.ratio === 0 ? 0 : 1].posX,
					sourcePositions[request.ratio === 0 ? 0 : 1].posY,
					sourcePositions[request.ratio === 0 ? 0 : 1].posZ,
				]
			: (() => {
					const sampled = sourceMap.getRailPos(1000000, sampleIndex);
					const sampledCant = sourceMap.getCant(1000000, sampleIndex);
					return [
						sampled[1],
						sourceMap.getRailHeight(1000000, sampleIndex) -
							Math.abs(
								Math.sin((sampledCant * Math.PI) / 180) * 1.5,
							),
						sampled[0],
					] as [number, number, number];
				})();
		if (
			Math.abs(sampledPosition[0] - request.branchStart.position[0]) >
				0.01 ||
			Math.abs(sampledPosition[1] - request.branchStart.position[1]) >
				0.01 ||
			Math.abs(sampledPosition[2] - request.branchStart.position[2]) >
				0.01
		)
			return { status: "rail_changed" };
		let resolvedEnd: RailPosition | null = null;
		let resolvedEndCore: TileEntityLargeRailCore | null = null;
		if (request.branchEnd.kind === "rail") {
			const endTile = request.branchEnd.core
				? world.getTileEntity(
						request.branchEnd.core[0],
						request.branchEnd.core[1],
						request.branchEnd.core[2],
					)
				: null;
			const endCore =
				endTile instanceof TileEntityLargeRailBase
					? endTile.getRailCore()
					: null;
			if (!endCore || !this.isFlatBuilderRail(endCore))
				return { status: "sloped_or_changed_rail" };
			resolvedEndCore = endCore;
			resolvedEnd = this.resolveBuilderRailPoint(
				world,
				request.branchEnd,
			);
		} else resolvedEnd = this.createBuilderFreePoint(request.branchEnd);
		if (!resolvedEnd) return { status: "invalid_branch_end" };
		if (endpoint)
			return this.createEndpointBranchBuilderRail(
				world,
				player,
				sourceCore,
				resolvedEnd,
				resolvedEndCore,
				request,
			);
		const connectedEndpoints = this.findConnectedCantEndpoints(
			world,
			sourceCore,
			sourcePositions,
		);
		const split = this.splitBuilderRail(
			world,
			player,
			request.core,
			request.railKey,
			request.ratio,
		);
		if (split.status !== "ok" || !split.undoToken) return split;
		const record = this.splitUndoRecords[split.undoToken];
		if (!record || record.created.length !== 2)
			return { status: "branch_split_failed" };
		const splitPosition = request.branchStart.position;
		const vx = request.branchEnd.position[0] - splitPosition[0],
			vz = request.branchEnd.position[2] - splitPosition[2];
		const sx = record.positions[0].posX - splitPosition[0],
			sz = record.positions[0].posZ - splitPosition[2];
		const ex = record.positions[1].posX - splitPosition[0],
			ez = record.positions[1].posZ - splitPosition[2];
		const selectedIndex = vx * sx + vz * sz >= vx * ex + vz * ez ? 0 : 1;
		const selected = record.created[selectedIndex];
		const selectedTile = world.getTileEntity(
			selected.core[0],
			selected.core[1],
			selected.core[2],
		);
		if (!(selectedTile instanceof TileEntityLargeRailBase))
			return { status: "branch_split_failed" };
		const selectedCore = selectedTile.getRailCore();
		if (!selectedCore) return { status: "branch_split_failed" };
		const half = this.copyRailPositions(
			this.getEditableRailPositions(selectedCore),
		);
		let rootIndex = 0;
		if (
			Math.pow(half[1].posX - splitPosition[0], 2) +
				Math.pow(half[1].posZ - splitPosition[2], 2) <
			Math.pow(half[0].posX - splitPosition[0], 2) +
				Math.pow(half[0].posZ - splitPosition[2], 2)
		)
			rootIndex = 1;
		const rootSource = half[rootIndex],
			trunkSource = half[1 - rootIndex];
		const removedStatus = this.undoBuilderRail(
			world,
			selected.core[0],
			selected.core[1],
			selected.core[2],
			selected.key,
		);
		if (removedStatus !== "ok") return { status: removedStatus };
		record.created.splice(selectedIndex, 1);
		const root = this.withSwitchType(rootSource, 1);
		const trunk = this.withSwitchType(trunkSource, 0);
		const branch = this.withSwitchType(resolvedEnd, 0);
		const switchPositions = [root, trunk, branch];
		for (let i = 0; i < switchPositions.length; i++) {
			switchPositions[i].cantEdge = 0;
			switchPositions[i].cantCenter = 0;
			switchPositions[i].cantRandom = 0;
		}
		branch.anchorLengthHorizontal = request.branchEnd.anchorLength;
		branch.anchorLengthVertical =
			request.branchEnd.anchorLengthVertical === undefined
				? request.branchEnd.anchorLength
				: request.branchEnd.anchorLengthVertical;
		const held = this.createBuilderProperty(player);
		const property = held || this.cloneRailProperty(record.property);
		property.autoSplit = false;
		let switchCore: TileEntityLargeRailSwitchCore | null = null;
		try {
			switchCore = this.createBuilderBasicSwitch(
				world,
				[root, trunk, branch],
				property,
				record.created.map((rail) => rail.key),
			);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX branch] switch creation exception: ${error}`,
			);
		}
		if (!switchCore) {
			for (let i = record.created.length - 1; i >= 0; i--) {
				const rail = record.created[i];
				this.undoBuilderRail(
					world,
					rail.core[0],
					rail.core[1],
					rail.core[2],
					rail.key,
				);
			}
			record.created = [];
			const restored = this.restoreSplitSource(world, player, record);
			if (restored)
				this.lastSplitClientUpdate = {
					removed: [
						{ core: request.core, key: request.railKey },
						selected,
					],
					refreshed: [restored],
				};
			delete this.splitUndoRecords[split.undoToken];
			return {
				status: restored
					? "switch_create_failed"
					: "split_rollback_failed",
			};
		}
		const created = {
			core: this.getRailCorePos(switchCore),
			key: this.getRailPositionCandidateKey(switchCore),
		};
		record.created.push(created);
		record.cants = [];
		let refreshed = record.created.slice();
		const zeroAndRefresh = (
			core: TileEntityLargeRailCore,
			indices: number[] | null,
			recordChanges: boolean,
		) => {
			const key = this.getRailPositionCandidateKey(core);
			const cores = this.zeroRailCants(
				world,
				core,
				indices,
				recordChanges ? record.cants : undefined,
			);
			for (let i = 0; i < cores.length; i++)
				refreshed.push({ core: cores[i], key });
		};
		for (let i = 0; i < record.created.length; i++) {
			const rail = record.created[i];
			const tile = world.getTileEntity(
				rail.core[0],
				rail.core[1],
				rail.core[2],
			);
			if (tile instanceof TileEntityLargeRailBase) {
				const core = tile.getRailCore();
				if (core) zeroAndRefresh(core, null, false);
			}
		}
		for (let i = 0; i < connectedEndpoints.length; i++)
			zeroAndRefresh(
				connectedEndpoints[i].core,
				[connectedEndpoints[i].index],
				true,
			);
		if (
			resolvedEndCore &&
			request.branchEnd.index !== undefined &&
			resolvedEndCore !== sourceCore
		)
			zeroAndRefresh(resolvedEndCore, [request.branchEnd.index], true);
		const refreshedSeen: { [key: string]: boolean } = {};
		refreshed = refreshed.filter((rail) => {
			const id = `${rail.core[0]},${rail.core[1]},${rail.core[2]}`;
			if (refreshedSeen[id]) return false;
			refreshedSeen[id] = true;
			return true;
		});
		this.lastSplitClientUpdate = {
			removed: [{ core: request.core, key: request.railKey }, selected],
			refreshed,
		};
		return { status: "ok", undoToken: split.undoToken };
	}

	static undoBranchBuilderRail(
		world: net.minecraft.world.World,
		player: EntityPlayer,
		undoToken: string,
	): string {
		return this.undoSplitBuilderRail(world, player, undoToken);
	}

	static consumeLastBranchClientUpdate(): SplitClientUpdate | null {
		return this.consumeLastSplitClientUpdate();
	}
}
