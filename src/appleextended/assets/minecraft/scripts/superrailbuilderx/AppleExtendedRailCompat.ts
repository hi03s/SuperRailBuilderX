import { SRBXFreeEndpointPolicy as SRBXRailBoundary } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXFreeEndpointPolicy";
import { SRBXRoadbedOwnership } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXRoadbedOwnership";
import { AppleExtendedRoadbedPlacement } from "./AppleExtendedRoadbedPlacement";
import { RTMCore, RTMItem } from "jp.ngt.rtm";
import {
	BlockMarker,
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
} from "jp.ngt.rtm.rail";
import { ItemRail } from "jp.ngt.rtm.item";
import { ResourceStateRail } from "jp.ngt.rtm.modelpack.state";
import {
	RailMaker,
	RailMap,
	RailMapBasic,
	RailPosition,
} from "jp.ngt.rtm.rail.util";
import { EntityPlayer } from "net.minecraft.entity.player";
import { BlockPos } from "net.minecraft.util.math";
import { World } from "net.minecraft.world";
import { ArrayList } from "java.util";
import { TileEntityLargeRailSectionCore } from "jp.apple.rail";
import { RailChunkSectioner, RailMapSection } from "jp.apple.rail.util";
import { AppleExtendedSwitchCompat } from "./AppleExtendedSwitchCompat";
import { AppleExtendedRailProtection } from "./AppleExtendedRailProtection";
import {
	AppleExtendedSectionPlacement,
	AppleExtendedSectionPlacementCompat,
} from "./AppleExtendedSectionPlacementCompat";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { BlockUtil } from "jp.ngt.ngtlib.block";
import { RTMRail } from "jp.ngt.rtm";

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
	static normalizeDegrees(angle: number): number {
		let result = angle % 360;
		if (result < 0) result += 360;
		return result;
	}

	static directionFromYaw(yaw: number): number {
		return Math.round(this.normalizeDegrees(yaw) / 45) & 7;
	}

	static coreKey(core: TileEntityLargeRailCore): string {
		if (
			core instanceof TileEntityLargeRailSectionCore &&
			core.isRailSection()
		)
			return `section:${core.getRailGroupId().toString()}`;
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

	static cloneRailPosition(source: RailPosition): RailPosition {
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
		preserveOwner = false,
	): RailPosition {
		const direction = preserveOwner
			? point.direction
			: SRBXRailBoundary.direction(point.position, point.anchorYaw);
		const owner =
			(preserveOwner && point.ownerBlock) ||
			SRBXRailBoundary.owner(point.position, point.anchorYaw);
		const result = new RailPosition(
			Math.floor(owner[0]),
			Math.floor(owner[1]),
			Math.floor(owner[2]),
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
		const positions = this.getLogicalPositions(core);
		if (!positions || point.index < 0 || point.index >= positions.length)
			return null;
		const source = positions[point.index];
		if (
			Math.abs(source.posX - point.position[0]) > 0.001 ||
			Math.abs(source.posY - point.position[1]) > 0.001 ||
			Math.abs(source.posZ - point.position[2]) > 0.001
		)
			return null;
		if (
			!SRBXRailBoundary.isBoundary(
				[source.posX, source.posY, source.posZ],
				source.anchorYaw,
			)
		)
			return null;
		const result = this.cloneRailPosition(source);
		const owner = SRBXRailBoundary.owner(
			[source.posX, source.posY, source.posZ],
			source.anchorYaw + 180,
		);
		result.blockX = owner[0];
		result.blockY = owner[1];
		result.blockZ = owner[2];
		result.direction = SRBXRailBoundary.direction(
			[source.posX, source.posY, source.posZ],
			source.anchorYaw + 180,
		);
		result.anchorYaw = this.normalizeDegrees(source.anchorYaw + 180);
		result.anchorPitch = -source.anchorPitch;
		// AE cantEdge is measured in the endpoint heading, reversed above.
		result.cantEdge = -source.cantEdge;
		result.setPosition(source.posX, source.posY, source.posZ);
		return result;
	}

	static areBoundaryPositions(positions: {
		length: number;
		[index: number]: RailPosition;
	}): boolean {
		for (let i = 0; i < positions.length; i++) {
			const rp = positions[i];
			if (
				!SRBXRailBoundary.isBoundary(
					[rp.posX, rp.posY, rp.posZ],
					rp.anchorYaw,
				)
			)
				return false;
		}
		return true;
	}

	static resolveBuilderPoint(
		world: World,
		point: AppleExtendedBuilderPoint,
		preserveOwner = false,
	): RailPosition | null {
		return point.kind === "rail"
			? this.resolveRailPoint(world, point)
			: this.createFreePoint(point, preserveOwner);
	}

	static propertyFromPlayer(player: EntityPlayer): ResourceStateRail | null {
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

	static getCore(
		world: World,
		position: RailCorePos,
	): TileEntityLargeRailCore | null {
		const tile = world.getTileEntity(
			new BlockPos(position[0], position[1], position[2]),
		);
		if (!(tile instanceof TileEntityLargeRailBase)) return null;
		return tile.getRailCore();
	}

	static isSectionCore(
		core: TileEntityLargeRailCore,
	): core is TileEntityLargeRailSectionCore {
		return (
			core instanceof TileEntityLargeRailSectionCore &&
			core.isRailSection()
		);
	}

	static getLogicalPositions(
		core: TileEntityLargeRailCore,
	): JavaObjectArray<RailPosition> {
		return core ? core.getLogicalRailPositions() : null;
	}

	static getLogicalRailMap(
		core: TileEntityLargeRailCore,
	): RailMapBasic | null {
		const positions = this.getLogicalPositions(core);
		if (
			!positions ||
			positions.length !== 2 ||
			!positions[0] ||
			!positions[1]
		)
			return null;
		return new RailMapBasic(
			positions[0],
			positions[1],
			RailMapBasic.fixRTMRailMapVersionCurrent,
		);
	}

	static planCreation(
		world: World,
		positions: RailPosition[],
		property: ResourceStateRail,
		ignoredKey?: string,
	): {
		ordered: RailPosition[];
		root: RailPosition;
		property: ResourceStateRail;
		sections?: AppleExtendedSectionPlacement;
	} | null {
		if (!positions || positions.length < 2) return null;
		const ordered = positions.slice();
		if (ordered.length === 2 && ordered[0].posY > ordered[1].posY)
			ordered.reverse();
		// Match AE's actual core owner, including the equal-block-height case.
		// The public API chooses the second endpoint when blockY is equal.
		let root =
			ordered.length === 2
				? ordered[0].blockY >= ordered[1].blockY
					? ordered[1]
					: ordered[0]
				: ordered[0];
		let creationProperty = property;
		if (ordered.length === 2 && property.autoSplit) {
			const end = root === ordered[0] ? ordered[1] : ordered[0];
			const sections = RailChunkSectioner.split(
				new RailMapBasic(
					root,
					end,
					RailMapBasic.fixRTMRailMapVersionCurrent,
				),
			);
			if (sections.size() > 1) {
				let collision = false;
				const owners: { [key: string]: boolean } = {};
				for (let i = 0; i < sections.size(); i++) {
					const owner = sections.get(i).getStartRP();
					const key = `${owner.blockX},${owner.blockY},${owner.blockZ}`;
					if (
						owners[key] ||
						this.corePlacementBlocked(world, owner, ignoredKey)
					)
						collision = true;
					owners[key] = true;
				}
				if (collision) {
					const reverse = AppleExtendedSectionPlacementCompat.plan(
						world,
						end,
						root,
						property,
						(owner) =>
							this.corePlacementBlocked(world, owner, ignoredKey),
					);
					if (reverse) {
						NGTLog.debug(
							"[SuperRailBuilderX AE] section core conflict resolved by reversed generation",
						);
						return {
							ordered: ordered.slice().reverse(),
							root: reverse.sections[0].start,
							property,
							sections: reverse,
						};
					}
					if (
						new RailMapBasic(
							root,
							end,
							RailMapBasic.fixRTMRailMapVersionCurrent,
						).getLength() > RTMCore.railGeneratingDistance
					)
						return null;
					creationProperty = ItemRail.getDefaultProperty();
					creationProperty.readFromNBT(property.writeToNBT());
					creationProperty.autoSplit = false;
					NGTLog.debug(
						"[SuperRailBuilderX AE] section owner collision: using normal rail to protect existing logical rails",
					);
				} else {
					// Sectioner may round an offset logical endpoint to a different owner.
					root = sections.get(0).getStartRP();
				}
			}
		}
		if (this.corePlacementBlocked(world, root, ignoredKey)) {
			const other =
				ordered.length === 2 && ordered[0].blockY === ordered[1].blockY
					? root === ordered[0]
						? ordered[1]
						: ordered[0]
					: null;
			if (other && !this.corePlacementBlocked(world, other, ignoredKey)) {
				creationProperty = ItemRail.getDefaultProperty();
				creationProperty.readFromNBT(property.writeToNBT());
				creationProperty.autoSplit = false;
				ordered.reverse();
				root = other;
			} else {
				if (ordered.length === 2) {
					const logicalStart =
						ordered[0].blockY >= ordered[1].blockY
							? ordered[1]
							: ordered[0];
					const logicalEnd =
						logicalStart === ordered[0] ? ordered[1] : ordered[0];
					const sections = AppleExtendedSectionPlacementCompat.plan(
						world,
						logicalStart,
						logicalEnd,
						property,
						(owner) =>
							this.corePlacementBlocked(world, owner, ignoredKey),
					);
					if (sections)
						return {
							ordered,
							root: sections.sections[0].start,
							property,
							sections,
						};
				}
				NGTLog.debug(
					`[SuperRailBuilderX AE] creation blocked: protected rail owner at ${root.blockX},${root.blockY},${root.blockZ}`,
				);
				return null;
			}
		}
		if (
			ordered.length === 2 &&
			!creationProperty.autoSplit &&
			new RailMapBasic(
				root,
				root === ordered[0] ? ordered[1] : ordered[0],
				RailMapBasic.fixRTMRailMapVersionCurrent,
			).getLength() > RTMCore.railGeneratingDistance
		)
			return null;
		return { ordered, root, property: creationProperty };
	}

	static createFromPositions(
		world: World,
		player: EntityPlayer,
		positions: RailPosition[],
		property: ResourceStateRail,
	): { core: RailCorePos; key: string } | null {
		const plan = this.planCreation(world, positions, property);
		if (!plan) return null;
		const ordered = plan.ordered;
		const root = plan.root;
		const creationProperty = plan.property;
		const list = new ArrayList<RailPosition>();
		for (let i = 0; i < ordered.length; i++) list.add(ordered[i]);
		const before = this.getCore(world, [
			root.blockX,
			root.blockY,
			root.blockZ,
		]);
		// AE v2.5.3 discards the internal result and always returns false.
		let apiResult = false;
		const placementMaps: RailMap[] = [];
		const sectionOwners: RailPosition[] = [];
		let preservingSections:
			| import("./AppleExtendedSectionPlacementCompat").AppleExtendedSectionPlacement
			| undefined;
		if (ordered.length > 2) {
			const maker = new RailMaker(
				world,
				list,
				RailMapBasic.fixRTMRailMapVersionCurrent,
			);
			const railSwitch = maker.getSwitch();
			if (!railSwitch) return null;
			const maps = railSwitch.getAllRailMap();
			for (let i = 0; i < maps.length; i++) placementMaps.push(maps[i]);
		}
		if (ordered.length === 2) {
			const start =
				ordered[0].blockY >= ordered[1].blockY
					? ordered[1]
					: ordered[0];
			const end = start === ordered[0] ? ordered[1] : ordered[0];
			const map = new RailMapBasic(
				start,
				end,
				RailMapBasic.fixRTMRailMapVersionCurrent,
			);
			placementMaps.push(map);
			if (creationProperty.autoSplit) {
				const sections = RailChunkSectioner.split(map);
				if (sections.size() > 1) {
					preservingSections = { source: map, sections: [] };
					for (let i = 0; i < sections.size(); i++) {
						const s = sections.get(i);
						const start = s.getStartRP(),
							end = s.getEndRP();
						const owner = java.lang.reflect.Array.newInstance(
							java.lang.Integer.TYPE,
							3,
						) as JavaIntArray;
						owner[0] = start.blockX;
						owner[1] = start.blockY;
						owner[2] = start.blockZ;
						preservingSections.sections.push({
							start,
							end,
							from: s.getStartRatio(),
							to: s.getEndRatio(),
							owner,
							map: new RailMapSection(
								map,
								start,
								end,
								s.getStartRatio(),
								s.getEndRatio(),
							),
						});
					}
				}
				if (sections.size() > 1)
					for (let i = 0; i < sections.size(); i++) {
						const section = sections.get(i);
						sectionOwners.push(section.getStartRP());
						placementMaps.push(
							new RailMapSection(
								map,
								section.getStartRP(),
								section.getEndRP(),
								section.getStartRatio(),
								section.getEndRatio(),
							),
						);
					}
			}
		}
		const protectedRoadbeds = AppleExtendedRailProtection.capture(
			world,
			placementMaps,
			creationProperty,
		);
		try {
			apiResult = plan.sections
				? AppleExtendedSectionPlacementCompat.create(
						world,
						plan.sections,
						creationProperty,
						player.capabilities.isCreativeMode,
					)
				: ordered.length > 2
					? AppleExtendedSwitchCompat.create(
							world,
							player,
							ordered,
							creationProperty,
						)
					: protectedRoadbeds.length > 0 ||
						  AppleExtendedRoadbedPlacement.hasExisting(
								world,
								placementMaps,
								creationProperty,
						  )
						? preservingSections
							? AppleExtendedSectionPlacementCompat.create(
									world,
									preservingSections,
									creationProperty,
									player.capabilities.isCreativeMode,
								)
							: AppleExtendedRoadbedPlacement.createNormal(
									world,
									placementMaps[0],
									creationProperty,
									player.capabilities.isCreativeMode,
								)
						: BlockMarker.createRail(
								world,
								root.blockX,
								root.blockY,
								root.blockZ,
								list,
								creationProperty,
								true,
								player.capabilities.isCreativeMode,
							);
		} catch (error) {
			NGTLog.debug(`[SuperRailBuilderX AE] creation exception: ${error}`);
			return null;
		} finally {
			AppleExtendedRailProtection.restore(world, protectedRoadbeds);
		}
		const core = this.getCore(world, [
			root.blockX,
			root.blockY,
			root.blockZ,
		]);
		if (!core || core === before) {
			NGTLog.debug(
				`[SuperRailBuilderX AE] creation not confirmed: apiResult=${apiResult}, positions=${ordered.length}, root=${root.blockX},${root.blockY},${root.blockZ}, existingCore=${before !== null}`,
			);
			if (sectionOwners.length > 1) {
				let partial = false;
				const owners: string[] = [];
				for (let i = 0; i < sectionOwners.length; i++) {
					const owner = sectionOwners[i];
					owners.push(
						`${owner.blockX},${owner.blockY},${owner.blockZ}`,
					);
					if (this.corePlacementBlocked(world, owner)) partial = true;
				}
				NGTLog.debug(
					`[SuperRailBuilderX AE] section creation failed: owners=${owners.join(";")}, partial=${partial}, creative=${player.capabilities.isCreativeMode}`,
				);
				// Retry only when no live section owner remains. Do not replace a partial group.
				if (!partial) {
					const fallback = ItemRail.getDefaultProperty();
					fallback.readFromNBT(creationProperty.writeToNBT());
					fallback.autoSplit = false;
					NGTLog.debug(
						"[SuperRailBuilderX AE] retrying creation as normal rail",
					);
					return this.createFromPositions(
						world,
						player,
						ordered,
						fallback,
					);
				}
			}
			return null;
		}
		NGTLog.debug(
			`[SuperRailBuilderX AE] creation confirmed: apiResult=${apiResult}, sectioned=${this.isSectionCore(core)}, positions=${ordered.length}`,
		);
		const endpointMaps =
			ordered.length === 2
				? [plan.sections ? plan.sections.source : placementMaps[0]]
				: placementMaps;
		for (let mapIndex = 0; mapIndex < endpointMaps.length; mapIndex++) {
			const endpointTiles = SRBXRoadbedOwnership.endpointTiles(
				endpointMaps[mapIndex],
			);
			const owners = plan.sections
				? plan.sections.sections.map((s) => s.start)
				: sectionOwners;
			for (let i = 0; i < endpointTiles.length; i++) {
				const p = endpointTiles[i];
				const owner = owners.length
					? owners[i === 0 ? 0 : owners.length - 1]
					: root;
				const tilePos = new BlockPos(p[0], p[1], p[2]);
				let tile = world.getTileEntity(tilePos);
				if (!tile && world.isAirBlock(tilePos)) {
					BlockUtil.setBlock(
						world,
						p[0],
						p[1],
						p[2],
						RTMRail.largeRailBase,
						0,
						2,
					);
					tile = world.getTileEntity(tilePos);
					if (tile instanceof TileEntityLargeRailBase) {
						tile.setStartPoint(
							owner.blockX,
							owner.blockY,
							owner.blockZ,
						);
						tile.markDirty();
						const state = world.getBlockState(tilePos);
						world.notifyBlockUpdate(tilePos, state, state, 3);
					}
				}
				if (
					tile instanceof TileEntityLargeRailBase &&
					!(tile instanceof TileEntityLargeRailCore)
				) {
					if (
						SRBXRoadbedOwnership.transfer(
							tile,
							[owner.blockX, owner.blockY, owner.blockZ],
							(c) => this.coreKey(c),
							tile.getTileData(),
						)
					) {
						const pos = new BlockPos(p[0], p[1], p[2]);
						const state = world.getBlockState(pos);
						world.notifyBlockUpdate(pos, state, state, 3);
						NGTLog.debug(
							`[SuperRailBuilderX transition] endpoint roadbed claimed: target=appleextended, tile=${p.join(",")}, owner=${owner.blockX},${owner.blockY},${owner.blockZ}`,
						);
					}
				}
			}
		}
		const pos = core.getPos();
		return {
			core: [pos.getX(), pos.getY(), pos.getZ()],
			key: this.coreKey(core),
		};
	}

	private static corePlacementBlocked(
		world: World,
		owner: RailPosition,
		ignoredKey?: string,
	): boolean {
		const tile = world.getTileEntity(
			new BlockPos(owner.blockX, owner.blockY, owner.blockZ),
		);
		// Replacing even a foreign roadbed calls breakBlock -> breakLogicalRail.
		if (!(tile instanceof TileEntityLargeRailCore)) return false;
		const core = tile.getRailCore();
		return !!core && (!ignoredKey || this.coreKey(core) !== ignoredKey);
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
		const positions = this.getLogicalPositions(core);
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
		forceNormal = false,
	): { status: string; undoCore?: RailCorePos; undoKey?: string } {
		const startStatus = this.validatePoint(start);
		if (startStatus !== "ok") return { status: startStatus };
		const endStatus = this.validatePoint(end);
		if (endStatus !== "ok") return { status: endStatus };
		start = SRBXRailBoundary.normalizePoint(start);
		end = SRBXRailBoundary.normalizePoint(end);
		if (
			!SRBXRailBoundary.isBoundary(start.position, start.anchorYaw) ||
			!SRBXRailBoundary.isBoundary(end.position, end.anchorYaw)
		)
			return { status: "endpoint_not_on_block_boundary" };
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
		if (!this.areBoundaryPositions([startRP, endRP]))
			return { status: "endpoint_not_on_block_boundary" };

		const createdProperty = ItemRail.getDefaultProperty();
		createdProperty.readFromNBT(property.writeToNBT());
		if (forceNormal) createdProperty.autoSplit = false;
		const created = this.createFromPositions(
			world,
			player,
			[startRP, endRP],
			createdProperty,
		);
		if (!created) return { status: "create_failed" };
		return {
			status: "ok",
			undoCore: created.core,
			undoKey: created.key,
		};
	}

	static undoNormalRail(
		world: World,
		corePos: RailCorePos,
		expectedKey: string,
	): string {
		const validation = this.validateUndoNormalRail(
			world,
			corePos,
			expectedKey,
		);
		if (validation !== "ok") return validation;
		const core = this.getCore(world, corePos);
		this.breakRail(world, core);
		return "ok";
	}

	static breakRail(world: World, core: TileEntityLargeRailCore): void {
		const records = SRBXRoadbedOwnership.promotions(
			world.loadedTileEntityList,
			this.coreKey(core),
			(c) => this.coreKey(c),
			(c) => c.getTileData(),
		);
		SRBXRoadbedOwnership.release(
			world.loadedTileEntityList,
			this.coreKey(core),
			(p) => this.getCore(world, p),
			(c) => this.coreKey(c),
			(tile) => tile.getTileData(),
			(tile) => {
				const pos = tile.getPos(),
					state = world.getBlockState(pos);
				world.notifyBlockUpdate(pos, state, state, 3);
			},
		);
		core.breakLogicalRail();
		for (let i = 0; i < records.length; i++)
			AppleExtendedRoadbedPlacement.restorePromotion(world, records[i]);
	}

	static validateUndoNormalRail(
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
		if (core.isLogicalRailOccupied()) return "rail_occupied";
		return "ok";
	}
}
