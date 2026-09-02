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
import { RailMapBasic, RailPosition, RailProperty } from "jp.ngt.rtm.rail.util";
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
	markerPosition: [number, number, number];
	core?: [number, number, number];
	index?: number;
};

type RailSectionPlan = {
	getStartRatio(): number;
	getEndRatio(): number;
	getStartRP(): RailPosition;
	getEndRP(): RailPosition;
};

type RailSectionMap = {
	getRailBlockList(property: RailProperty): java.util.List<JavaIntArray>;
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

	static getRailPositionAnchorPitch(rp: RailPosition): number {
		return rp.anchorPitch;
	}

	static getRailPositionConnectionMarkerPosition(
		rp: RailPosition,
	): [number, number, number] {
		const neighbor = rp.getNeighborPos();
		return [
			neighbor[0] + 0.5,
			neighbor[1] + rp.height / 16,
			neighbor[2] + 0.5,
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
			this.isSectionCore(core),
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

	static moveRailPosition(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
	): string {
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
		if (this.isSectionCore(core))
			return this.moveSectionedRailPosition(
				core,
				index,
				originalX,
				originalY,
				originalZ,
				x,
				y,
				z,
			);
		const positions = core.getRailPositions();
		if (index < 0 || index >= positions.length) return "not_found";
		const position = positions[index];
		const tolerance = 0.001;
		if (
			Math.abs(position.posX - originalX) > tolerance ||
			Math.abs(position.posY - originalY) > tolerance ||
			Math.abs(position.posZ - originalZ) > tolerance
		)
			return "changed";
		position.setPosition(x, y, z);
		core.setRailPositions(positions);
		core.createRailMap();
		this.addMissingRoadbed(core);
		core.markDirty();
		NGTUtil.sendPacketToClient(core);
		this.getCoreWorld(core).markBlockForUpdate(
			core.xCoord,
			core.yCoord,
			core.zCoord,
		);
		return "ok";
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
		if (!core || !this.canMoveRailPosition(core)) return null;
		const positions = this.getEditableRailPositions(core);
		if (point.index < 0 || point.index >= positions.length) return null;
		const source = positions[point.index];
		if (
			Math.abs(source.posX - point.position[0]) > 0.001 ||
			Math.abs(source.posY - point.position[1]) > 0.001 ||
			Math.abs(source.posZ - point.position[2]) > 0.001
		)
			return null;
		const neighbor = source.getNeighborPos();
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
		const result = new RailPosition(
			Math.floor(point.position[0]),
			Math.floor(point.position[1]),
			Math.floor(point.position[2]),
			direction,
		);
		result.anchorYaw = this.normalizeDegrees(point.anchorYaw);
		result.anchorPitch = point.anchorPitch;
		result.anchorLengthHorizontal = point.anchorLength;
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

	private static placeBuilderRoadbed(
		world: net.minecraft.world.World,
		railMap: RailSectionMap,
		coreX: number,
		coreY: number,
		coreZ: number,
		property: RailProperty,
	): number {
		const blocks = railMap.getRailBlockList(property);
		let replaced = 0;
		for (let i = 0; i < blocks.size(); i++) {
			const pos = blocks.get(i);
			if (!world.isAirBlock(pos[0], pos[1], pos[2])) replaced++;
			world.setBlock(
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
					`builder roadbed tile missing at ${pos[0]},${pos[1]},${pos[2]}`,
				);
			tile.setStartPoint(coreX, coreY, coreZ);
			tile.markDirty();
		}
		return replaced;
	}

	private static isBuilderRoadbedLoaded(
		world: net.minecraft.world.World,
		railMap: RailSectionMap,
		property: RailProperty,
	): boolean {
		const blocks = railMap.getRailBlockList(property);
		for (let i = 0; i < blocks.size(); i++) {
			const pos = blocks.get(i);
			if (!world.blockExists(pos[0], pos[1], pos[2])) return false;
		}
		return true;
	}

	private static createBuilderNormalRail(
		world: net.minecraft.world.World,
		source: RailMapBasic,
		positions: RailPosition[],
		property: RailProperty,
	): TileEntityLargeRailCore | null {
		const start = positions[0];
		const replaced = this.placeBuilderRoadbed(
			world,
			source,
			start.blockX,
			start.blockY,
			start.blockZ,
			property,
		);
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
			world.setBlock(
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
				throw new Error("builder section core tile missing");
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
	) {
		const startValidation = this.validateBuilderPoint(start);
		if (startValidation !== "ok") return { status: startValidation };
		const endValidation = this.validateBuilderPoint(end);
		if (endValidation !== "ok") return { status: endValidation };
		if (start.kind !== end.kind)
			return { status: "rail_to_free_not_implemented" };
		const dx = end.position[0] - start.position[0];
		const dy = end.position[1] - start.position[1];
		const dz = end.position[2] - start.position[2];
		const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
		if (length < 0.01) return { status: "rail_too_short" };
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
		const property = this.createBuilderProperty(player);
		if (!property) return { status: "hold_rail_item" };
		let startRP: RailPosition | null = null;
		let endRP: RailPosition | null = null;
		if (start.kind === "rail") {
			startRP = this.resolveBuilderRailPoint(world, start);
			endRP = this.resolveBuilderRailPoint(world, end);
			if (!startRP || !endRP) return { status: "rail_endpoint_changed" };
			const anchorLength = (length * 2) / 3;
			startRP.anchorLengthHorizontal = anchorLength;
			endRP.anchorLengthHorizontal = anchorLength;
		} else {
			startRP = this.createBuilderFreePoint(start);
			endRP = this.createBuilderFreePoint(end);
		}
		const positions = [startRP, endRP] as RailPosition[];
		const source = new RailMapBasic(
			startRP,
			endRP,
			RailMapBasic.fixRTMRailMapVersionCurrent,
		);
		const sections =
			Packages.jp.kaiz.kaizpatch.rtm.rail.util.RailChunkSectioner.split(
				source,
			);
		if (sections.size() > 1) {
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
			}
		} else if (!this.isBuilderRoadbedLoaded(world, source, property)) {
			return { status: "path_unloaded" };
		}
		let core: TileEntityLargeRailCore | null = null;
		try {
			core =
				sections.size() > 1
					? this.createBuilderSectionedRail(
							world,
							source,
							sections,
							positions,
							property,
						)
					: this.createBuilderNormalRail(
							world,
							source,
							positions,
							property,
						);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX builder1] destructive rail creation exception: ${error}`,
			);
			return { status: "create_failed" };
		}
		if (!core) return { status: "create_failed" };
		const corePos = this.getRailCorePos(core);
		return {
			status: "ok",
			undoCore: corePos,
			undoKey: this.getRailPositionCandidateKey(core),
		};
	}

	static undoBuilderRail(
		world: net.minecraft.world.World,
		coreX: number,
		coreY: number,
		coreZ: number,
		expectedKey: string,
	): string {
		const tile = world.getTileEntity(coreX, coreY, coreZ);
		if (!(tile instanceof TileEntityLargeRailBase))
			return "undo_rail_not_found";
		const core = tile.getRailCore();
		if (!core) return "undo_rail_not_found";
		if (this.getRailPositionCandidateKey(core) !== expectedKey)
			return "undo_rail_changed";
		if (core.isLogicalRailOccupied()) return "rail_occupied";
		core.breakLogicalRail();
		NGTLog.debug(
			`[SuperRailBuilderX builder1] generated logical rail removed by undo: core=${coreX},${coreY},${coreZ}`,
		);
		return "ok";
	}
}
