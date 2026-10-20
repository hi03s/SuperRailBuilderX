import { SRBXFreeEndpointPolicy as SRBXRailBoundary } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXFreeEndpointPolicy";
import { validateCrossoverPlan } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXCrossoverValidation";
import { SRBXCrossoverPlan } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXCrossoverPlan";
import {
	SRBXSingleCrossoverSplit,
	SRBXSingleCrossoverSplitPlan,
} from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXSingleCrossoverSplit";
import { ArrayList } from "java.util";
import { ItemRail } from "jp.ngt.rtm.item";
import { RailMap, RailMapBasic, RailMaker } from "jp.ngt.rtm.rail.util";
import {
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
	TileEntityLargeRailSwitchCore,
} from "jp.ngt.rtm.rail";
import { ResourceStateRail } from "jp.ngt.rtm.modelpack.state";
import { RailPosition } from "jp.ngt.rtm.rail.util";
import { TileEntityLargeRailSectionCore } from "jp.apple.rail";
import { EntityPlayer } from "net.minecraft.entity.player";
import { NBTBase, NBTTagCompound } from "net.minecraft.nbt";
import { BlockPos } from "net.minecraft.util.math";
import { World } from "net.minecraft.world";
import { UUID } from "java.util";
import { NGTLog } from "jp.ngt.ngtlib.io";
import {
	AppleExtendedBuilderPoint,
	AppleExtendedRailCompat,
} from "./AppleExtendedRailCompat";

type RailCorePos = [number, number, number];
type CreatedRail = { core: RailCorePos; key: string };
type CantTarget = {
	core: RailCorePos;
	railKey: string;
	index: number;
	position: RailCorePos;
	angle: number;
	mode?: "edge" | "center" | "split";
	yaw?: number;
};
type BranchRequest = {
	core: RailCorePos;
	railKey: string;
	ratio: number;
	branchStart: AppleExtendedBuilderPoint;
	branchEnd: AppleExtendedBuilderPoint;
};
type CantRecord = {
	core: RailCorePos;
	railKey: string;
	positions: RailPosition[];
};
type RailRecord = {
	source?: CreatedRail;
	positions: RailPosition[];
	property: ResourceStateRail;
	signal: number;
	subRails: ResourceStateRail[];
	created: CreatedRail[];
	cants?: CantRecord[];
};

export class AppleExtendedRailToolsCompat {
	private static splitUndoRecords: { [token: string]: RailRecord } = {};
	private static cantUndoRecords: { [token: string]: CantRecord[] } = {};
	private static crossoverUndoRecords: {
		[token: string]: { created: CreatedRail; cants: CantRecord[] };
	} = {};
	private static lastSplitUpdate: {
		removed: CreatedRail[];
		refreshed: CreatedRail[];
	} | null = null;
	private static lastCantUpdate: RailCorePos[] = [];

	private static copyPositions(source: {
		length: number;
		[index: number]: RailPosition;
	}): RailPosition[] {
		const result: RailPosition[] = [];
		for (let i = 0; i < source.length; i++)
			result.push(AppleExtendedRailCompat.cloneRailPosition(source[i]));
		return result;
	}

	private static corePos(core: TileEntityLargeRailCore): RailCorePos {
		const pos = core.getPos();
		return [pos.getX(), pos.getY(), pos.getZ()];
	}

	private static updateCants(
		core: TileEntityLargeRailCore,
		positions: RailPosition[],
	): RailCorePos[] {
		const target = AppleExtendedRailCompat.getLogicalPositions(core);
		if (!target || target.length !== positions.length) return [];
		for (let i = 0; i < positions.length; i++) {
			target[i].cantEdge = positions[i].cantEdge;
			target[i].cantCenter = positions[i].cantCenter;
			target[i].cantRandom = positions[i].cantRandom;
		}
		if (AppleExtendedRailCompat.isSectionCore(core)) {
			const updated: RailCorePos[] = [];
			const group = core.getRailGroupCorePositions();
			const world = core.getWorld();
			for (let i = 0; i < group.size(); i++) {
				const pos = group.get(i);
				const member = AppleExtendedRailCompat.getCore(world, [
					pos[0],
					pos[1],
					pos[2],
				]);
				if (!(member instanceof TileEntityLargeRailSectionCore))
					continue;
				const nbt = new NBTTagCompound();
				member.writeSectionData(nbt);
				const section: NBTTagCompound =
					nbt.getCompoundTag("RailSection");
				section.setTag(
					"LogicalStartRP",
					target[0].writeToNBT() as NBTBase,
				);
				section.setTag(
					"LogicalEndRP",
					target[1].writeToNBT() as NBTBase,
				);
				member.readSectionData(nbt);
				member.createRailMap();
				member.shouldRerenderRail = true;
				member.markDirty();
				member.sendPacket();
				updated.push(this.corePos(member));
			}
			return updated;
		}
		core.setRailPositions(target);
		core.createRailMap();
		core.shouldRerenderRail = true;
		core.markDirty();
		core.sendPacket();
		return [this.corePos(core)];
	}

	private static connectedEndpoints(
		world: World,
		sourceCore: TileEntityLargeRailCore,
		source: RailPosition,
	): Array<{ core: TileEntityLargeRailCore; index: number }> {
		const result: Array<{ core: TileEntityLargeRailCore; index: number }> =
			[];
		const seen: { [key: string]: boolean } = {};
		seen[AppleExtendedRailCompat.coreKey(sourceCore)] = true;
		const inspect = (tile: unknown) => {
			if (!(tile instanceof TileEntityLargeRailBase)) return;
			const core = tile.getRailCore();
			if (!core || core instanceof TileEntityLargeRailSwitchCore) return;
			const key = AppleExtendedRailCompat.coreKey(core);
			if (seen[key]) return;
			seen[key] = true;
			const positions = AppleExtendedRailCompat.getLogicalPositions(core);
			if (!positions) return;
			for (let i = 0; i < positions.length; i++)
				if (
					Math.abs(positions[i].posX - source.posX) <= 0.001 &&
					Math.abs(positions[i].posY - source.posY) <= 0.001 &&
					Math.abs(positions[i].posZ - source.posZ) <= 0.001
				)
					result.push({ core, index: i });
		};
		inspect(world.getTileEntity(source.getNeighborBlockPos()));
		// A logical endpoint may be distant from its owning section core;
		// its neighbor block alone does not enumerate all connected rails.
		const loaded = world.loadedTileEntityList;
		for (let i = 0; i < loaded.size(); i++) inspect(loaded.get(i));
		return result;
	}

	static applyRailCants(world: World, targets: CantTarget[]) {
		this.lastCantUpdate = [];
		if (!targets || targets.length === 0) return { status: "no_selection" };
		const records: CantRecord[] = [];
		const pending: {
			[key: string]: {
				core: TileEntityLargeRailCore;
				positions: RailPosition[];
			};
		} = {};
		const getPending = (core: TileEntityLargeRailCore) => {
			const key = AppleExtendedRailCompat.coreKey(core);
			if (!pending[key]) {
				const logical =
					AppleExtendedRailCompat.getLogicalPositions(core);
				if (!logical || logical.length !== 2) return null;
				const positions = this.copyPositions(logical);
				if (positions.length !== 2) return null;
				records.push({
					core: this.corePos(core),
					railKey: key,
					positions: this.copyPositions(positions),
				});
				pending[key] = { core, positions };
			}
			return pending[key];
		};
		for (let i = 0; i < targets.length; i++) {
			const target = targets[i];
			if (
				!target ||
				!isFinite(target.angle) ||
				Math.abs(target.angle) > 9
			)
				return { status: "invalid_cant" };
			const core = AppleExtendedRailCompat.getCore(world, target.core);
			if (!core || core instanceof TileEntityLargeRailSwitchCore)
				return { status: "unsupported_rail" };
			if (AppleExtendedRailCompat.coreKey(core) !== target.railKey)
				return { status: "rail_changed" };
			if (core.isLogicalRailOccupied())
				return { status: "rail_occupied" };
			const entry = getPending(core);
			if (target.mode === "center") {
				if (!entry) return { status: "invalid_rail" };
				entry.positions[0].cantCenter = target.angle;
				entry.positions[1].cantCenter = target.angle;
				continue;
			}
			if (
				!entry ||
				target.index < 0 ||
				target.index >= entry.positions.length
			)
				return { status: "invalid_endpoint" };
			const rp = entry.positions[target.index];
			if (
				Math.abs(rp.posX - target.position[0]) > 0.001 ||
				Math.abs(rp.posY - target.position[1]) > 0.001 ||
				Math.abs(rp.posZ - target.position[2]) > 0.001
			)
				return { status: "rail_changed" };
			rp.cantEdge = target.angle;
			const connected = this.connectedEndpoints(world, core, rp);
			for (let j = 0; j < connected.length; j++) {
				if (connected[j].core.isLogicalRailOccupied())
					return { status: "rail_occupied" };
				const neighbor = getPending(connected[j].core);
				if (!neighbor) return { status: "invalid_rail" };
				const referenceYaw = isFinite(target.yaw as number)
					? (target.yaw as number)
					: rp.anchorYaw;
				const neighborYaw =
					neighbor.positions[connected[j].index].anchorYaw;
				const delta = Math.abs(
					((((neighborYaw - referenceYaw) % 360) + 540) % 360) - 180,
				);
				neighbor.positions[connected[j].index].cantEdge =
					delta > 90 ? -target.angle : target.angle;
			}
		}
		const keys = Object.keys(pending);
		for (let i = 0; i < keys.length; i++)
			if (
				!AppleExtendedRailCompat.areBoundaryPositions(
					pending[keys[i]].positions,
				)
			)
				return { status: "endpoint_not_on_block_boundary" };
		for (let i = 0; i < keys.length; i++) {
			const entry = pending[keys[i]];
			let hasCenterTarget = false;
			for (let j = 0; j < targets.length; j++)
				if (
					targets[j].railKey === keys[i] &&
					targets[j].mode === "center"
				)
					hasCenterTarget = true;
			const center =
				(entry.positions[0].cantEdge - entry.positions[1].cantEdge) / 2;
			if (!hasCenterTarget) {
				entry.positions[0].cantCenter = center;
				entry.positions[1].cantCenter = center;
			}
			this.lastCantUpdate = this.lastCantUpdate.concat(
				this.updateCants(entry.core, entry.positions),
			);
		}
		const token = UUID.randomUUID().toString();
		this.cantUndoRecords[token] = records;
		return { status: "ok", undoToken: token };
	}

	static undoRailCants(world: World, token: string): string {
		this.lastCantUpdate = [];
		const records = this.cantUndoRecords[token];
		if (!records) return "nothing_to_undo";
		// Reject a changed/occupied member before changing any saved cant.
		for (let i = 0; i < records.length; i++) {
			const validation = AppleExtendedRailCompat.validateUndoNormalRail(
				world,
				records[i].core,
				records[i].railKey,
			);
			if (validation !== "ok") return validation;
		}
		for (let i = 0; i < records.length; i++) {
			const core = AppleExtendedRailCompat.getCore(
				world,
				records[i].core,
			);
			if (
				!core ||
				AppleExtendedRailCompat.coreKey(core) !== records[i].railKey
			)
				return "undo_rail_changed";
			if (core.isLogicalRailOccupied()) return "rail_occupied";
			this.lastCantUpdate = this.lastCantUpdate.concat(
				this.updateCants(core, records[i].positions),
			);
		}
		delete this.cantUndoRecords[token];
		return "undo_ok";
	}

	static consumeLastCantClientUpdate(): RailCorePos[] {
		const result = this.lastCantUpdate;
		this.lastCantUpdate = [];
		return result;
	}

	private static lerp(
		a: [number, number],
		b: [number, number],
		t: number,
	): [number, number] {
		return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
	}

	private static cubic(
		points: Array<[number, number]>,
		t: number,
	): [number, number] {
		const q0 = this.lerp(points[0], points[1], t);
		const q1 = this.lerp(points[1], points[2], t);
		const q2 = this.lerp(points[2], points[3], t);
		return this.lerp(this.lerp(q0, q1, t), this.lerp(q1, q2, t), t);
	}

	private static splitHorizontal(
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
		let low = 0,
			high = 1;
		for (let i = 0; i < 56; i++) {
			const t0 = low + (high - low) / 3;
			const t1 = high - (high - low) / 3;
			const p0 = this.cubic(points, t0);
			const p1 = this.cubic(points, t1);
			const d0 =
				Math.pow(p0[0] - targetX, 2) + Math.pow(p0[1] - targetZ, 2);
			const d1 =
				Math.pow(p1[0] - targetX, 2) + Math.pow(p1[1] - targetZ, 2);
			if (d0 < d1) high = t1;
			else low = t0;
		}
		const t = (low + high) / 2;
		const q0 = this.lerp(points[0], points[1], t);
		const q1 = this.lerp(points[1], points[2], t);
		const q2 = this.lerp(points[2], points[3], t);
		const r0 = this.lerp(q0, q1, t);
		const r1 = this.lerp(q1, q2, t);
		const split = this.lerp(r0, r1, t);
		const distance = (a: [number, number], b: [number, number]) =>
			Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
		const yaw = (a: [number, number], b: [number, number]) =>
			AppleExtendedRailCompat.normalizeDegrees(
				(Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI,
			);
		return {
			firstStartLength: distance(points[0], q0),
			firstEndLength: distance(split, r0),
			firstEndYaw: yaw(split, r0),
			secondStartLength: distance(split, r1),
			secondStartYaw: yaw(split, r1),
			secondEndLength: distance(points[3], q2),
		};
	}

	private static verticalLength(horizontal: number, pitch: number): number {
		const cosine = Math.abs(Math.cos((pitch * Math.PI) / 180));
		return Math.max(0.01, horizontal / Math.max(0.001, cosine));
	}

	private static restoreRecord(
		world: World,
		player: EntityPlayer,
		record: RailRecord,
	): CreatedRail | null {
		const created = AppleExtendedRailCompat.createFromPositions(
			world,
			player,
			this.copyPositions(record.positions),
			record.property,
		);
		if (!created) return null;
		const core = AppleExtendedRailCompat.getCore(world, created.core);
		if (core) {
			core.setSignal(record.signal);
			for (let i = 0; i < record.subRails.length; i++)
				core.addSubRail(record.subRails[i]);
			core.markDirty();
			core.sendPacket();
		}
		return created;
	}

	private static restoreCantRecords(
		world: World,
		records?: CantRecord[],
	): boolean {
		if (!records) return true;
		for (let i = 0; i < records.length; i++) {
			const core = AppleExtendedRailCompat.getCore(
				world,
				records[i].core,
			);
			if (
				!core ||
				AppleExtendedRailCompat.coreKey(core) !== records[i].railKey ||
				core.isLogicalRailOccupied()
			)
				return false;
			this.updateCants(core, records[i].positions);
		}
		return true;
	}

	static getRailMapsForTool(core: TileEntityLargeRailCore): RailMap[] {
		if (core instanceof TileEntityLargeRailSwitchCore) {
			const native = core.getAllRailMaps();
			const result: RailMap[] = [];
			if (native)
				for (let i = 0; i < native.length; i++) result.push(native[i]);
			return result;
		}
		const map = AppleExtendedRailCompat.getLogicalRailMap(core);
		return map ? [map] : [];
	}

	static getSingleCrossoverSplitPlan(
		core: TileEntityLargeRailCore,
	): SRBXSingleCrossoverSplitPlan | null {
		if (!(core instanceof TileEntityLargeRailSwitchCore)) return null;
		const positions = AppleExtendedRailCompat.getLogicalPositions(core);
		if (!positions || positions.length !== 4) return null;
		let switchCount = 0;
		for (let i = 0; i < positions.length; i++)
			if (positions[i].switchType === 1) switchCount++;
		if (switchCount !== 2) return null;
		const maps = this.getRailMapsForTool(core);
		if (maps.length !== 3) return null;
		const point = (rp: RailPosition): AppleExtendedBuilderPoint => ({
			kind: "free",
			position: [rp.posX, rp.posY, rp.posZ],
			markerPosition: [rp.posX, rp.posY, rp.posZ],
			ownerBlock: [rp.blockX, rp.blockY, rp.blockZ],
			direction: rp.direction,
			anchorYaw: rp.anchorYaw,
			anchorPitch: rp.anchorPitch,
			anchorLength: rp.anchorLengthHorizontal,
			anchorLengthVertical: rp.anchorLengthVertical,
			cantEdge: rp.cantEdge,
			cantCenter: rp.cantCenter,
			cantRandom: rp.cantRandom,
		});
		return SRBXSingleCrossoverSplit.plan(
			maps.map((map) => {
				const start = map.getStartRP(),
					end = map.getEndRP(),
					mid = map.getRailPos(2, 1);
				return {
					start: point(start),
					end: point(end),
					startSwitch: start.switchType === 1,
					endSwitch: end.switchType === 1,
					midpoint: [
						mid[1],
						map.getRailHeight(2, 1),
						mid[0],
					] as RailCorePos,
					length: map.getLength(),
				};
			}),
		);
	}

	/** Preflight the complete replacement set before removing the four-point switch. */
	private static splitSingleCrossover(
		world: World,
		player: EntityPlayer,
		core: TileEntityLargeRailCore,
		expectedKey: string,
	) {
		if (AppleExtendedRailCompat.coreKey(core) !== expectedKey)
			return { status: "rail_changed" };
		if (core.isLogicalRailOccupied()) return { status: "rail_occupied" };
		const plan = this.getSingleCrossoverSplitPlan(core);
		const original = AppleExtendedRailCompat.getLogicalPositions(core);
		if (!plan || !original) return { status: "switch_unsupported" };
		const property = core.getResourceState();
		for (const rp of original) {
			const external = this.connectedEndpoints(world, core, rp);
			for (const connection of external)
				if (connection.core.isLogicalRailOccupied())
					return { status: "rail_occupied" };
		}
		const subRails: ResourceStateRail[] = [];
		for (let i = 0; i < core.subRails.size(); i++)
			subRails.push(core.subRails.get(i));
		const source = { core: this.corePos(core), key: expectedKey };
		const record: RailRecord = {
			source,
			positions: this.copyPositions(original),
			property,
			signal: core.getSignal(),
			subRails,
			created: [],
		};
		return this.createSplitCrossover(world, player, plan, record);
	}

	private static createSplitCrossover(
		world: World,
		player: EntityPlayer,
		plan: SRBXSingleCrossoverSplitPlan,
		record: RailRecord,
		prepare?: () => void,
	) {
		const property = record.property;
		const expectedKey = record.source ? record.source.key : undefined;
		const normalProperty = ItemRail.getDefaultProperty();
		normalProperty.readFromNBT(property.writeToNBT());
		normalProperty.autoSplit = false;
		const groups: RailPosition[][] = [];
		for (const points of plan.switches) {
			const native: RailPosition[] = [];
			for (let i = 0; i < points.length; i++) {
				const rp = AppleExtendedRailCompat.resolveBuilderPoint(
					world,
					points[i],
					true,
				);
				if (!rp) return { status: "invalid_endpoint" };
				native.push(this.switchPosition(rp, i === 0 ? 1 : 0));
			}
			groups.push(native);
		}
		for (const points of plan.normals) {
			const native: RailPosition[] = [];
			// AE places a level normal rail's core at its second endpoint.
			for (const point of points.slice().reverse()) {
				const rp = AppleExtendedRailCompat.resolveBuilderPoint(
					world,
					point,
					true,
				);
				if (!rp) return { status: "invalid_endpoint" };
				native.push(this.switchPosition(rp, 0));
			}
			groups.push(native);
		}
		const owners: { [key: string]: boolean } = {};
		const key = (rp: RailPosition) =>
			[rp.blockX, rp.blockY, rp.blockZ].join(",");
		const footprints: number[][][] = [];
		for (let i = 0; i < 4; i++) {
			const group = groups[i],
				prop = i < 2 ? property : normalProperty;
			let maps: RailMap[];
			if (i < 2) {
				const list = new ArrayList<RailPosition>();
				for (const rp of group) list.add(rp);
				const railSwitch = new RailMaker(
					world,
					list,
					RailMapBasic.fixRTMRailMapVersionCurrent,
				).getSwitch();
				if (!railSwitch) return { status: "invalid_switch" };
				maps = [];
				const native = railSwitch.getAllRailMap();
				for (let j = 0; j < native.length; j++) maps.push(native[j]);
			} else
				maps = [
					new RailMapBasic(
						group[0],
						group[1],
						RailMapBasic.fixRTMRailMapVersionCurrent,
					),
				];
			const footprint: number[][] = [];
			for (const map of maps) {
				const blocks = map.getRailBlockList(prop, true);
				for (let j = 0; j < blocks.size(); j++) {
					const b = blocks.get(j),
						p = [b[0], b[1], b[2]];
					if (!world.isBlockLoaded(new BlockPos(p[0], p[1], p[2])))
						return { status: "path_unloaded" };
					footprint.push(p);
				}
			}
			footprints.push(footprint);
		}
		const foreignCore = (p: number[]): boolean => {
			const tile = world.getTileEntity(new BlockPos(p[0], p[1], p[2]));
			return (
				tile instanceof TileEntityLargeRailCore &&
				(!expectedKey ||
					AppleExtendedRailCompat.coreKey(tile) !== expectedKey)
			);
		};
		const relocate = (rp: RailPosition, footprint: number[][]): boolean => {
			let best: number[] | null = null,
				distance = 6.25;
			const angle = (rp.anchorYaw * Math.PI) / 180;
			for (const p of footprint) {
				if (owners[p.join(",")] || p[1] !== rp.blockY || foreignCore(p))
					continue;
				if (
					(p[0] + 0.5 - rp.posX) * Math.sin(angle) +
						(p[2] + 0.5 - rp.posZ) * Math.cos(angle) <
					-0.001
				)
					continue;
				const d =
					Math.pow(p[0] + 0.5 - rp.posX, 2) +
					Math.pow(p[2] + 0.5 - rp.posZ, 2);
				if (d < distance) {
					distance = d;
					best = p;
				}
			}
			if (!best) return false;
			rp.blockX = best[0];
			rp.blockY = best[1];
			rp.blockZ = best[2];
			// Keep precision offsets relative to the newly assigned owner block.
			rp.setPosition(rp.posX, rp.posY, rp.posZ);
			owners[best.join(",")] = true;
			return true;
		};
		// Retain every available outer root before relocating any blocked root.
		// Relocation keeps the outer physical endpoint, never the normal midpoint.
		const blockedRoots: number[] = [];
		for (let i = 0; i < 4; i++) {
			const rp = groups[i][i < 2 ? 0 : 1],
				k = key(rp);
			if (owners[k] || foreignCore([rp.blockX, rp.blockY, rp.blockZ]))
				blockedRoots.push(i);
			else owners[k] = true;
		}
		for (const i of blockedRoots)
			if (!relocate(groups[i][i < 2 ? 0 : 1], footprints[i]))
				return { status: "core_conflict" };
		// Opposite-facing midpoint owners stay on their own inward tangent side.
		for (let i = 0; i < 4; i++)
			for (let j = 0; j < groups[i].length; j++) {
				if (j === (i < 2 ? 0 : 1)) continue;
				if (!relocate(groups[i][j], footprints[i]))
					return { status: "core_conflict" };
			}
		// Native creation checks run after owners are settled, before any mutation.
		for (let i = 0; i < 4; i++) {
			const group = groups[i],
				prop = i < 2 ? property : normalProperty;
			const placement = AppleExtendedRailCompat.planCreation(
				world,
				group,
				prop,
				expectedKey,
			);
			if (
				!placement ||
				key(placement.root) !== key(group[i < 2 ? 0 : 1]) ||
				placement.sections
			)
				return { status: "core_conflict" };
		}
		try {
			if (prepare) prepare();
		} catch (error) {
			return {
				status: this.restoreCantRecords(world, record.cants)
					? "cant_update_failed"
					: "split_rollback_failed",
			};
		}
		if (record.source) {
			const removed = AppleExtendedRailCompat.undoNormalRail(
				world,
				record.source.core,
				record.source.key,
			);
			if (removed !== "ok") {
				this.restoreCantRecords(world, record.cants);
				return { status: removed };
			}
		}
		try {
			for (let i = 0; i < groups.length; i++) {
				const created = AppleExtendedRailCompat.createFromPositions(
					world,
					player,
					groups[i],
					i < 2 ? property : normalProperty,
				);
				if (!created)
					throw new Error("replacement creation failed: " + i);
				record.created.push(created);
				const replacement = AppleExtendedRailCompat.getCore(
					world,
					created.core,
				);
				if (!replacement) throw new Error("replacement core missing");
				replacement.setSignal(record.signal);
				for (const subRail of record.subRails)
					replacement.addSubRail(subRail);
				replacement.markDirty();
				replacement.sendPacket();
			}
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX AE] single crossover split exception: ${error}`,
			);
			const restored = this.rollbackBranch(world, player, record);
			return {
				status: restored ? "create_failed" : "split_rollback_failed",
			};
		}
		const token = UUID.randomUUID().toString();
		this.splitUndoRecords[token] = record;
		this.lastSplitUpdate = {
			removed: record.source ? [record.source] : [],
			refreshed: record.created.slice(),
		};
		NGTLog.debug(
			`[SuperRailBuilderX AE] single crossover split: source=${record.source ? record.source.core.join(",") : "free"}, replacementCores=${record.created.map((rail) => rail.core.join(",")).join(";")}`,
		);
		return { status: "ok", undoToken: token };
	}

	static splitBuilderRail(
		world: World,
		player: EntityPlayer,
		corePosition: RailCorePos,
		expectedKey: string,
		ratio: number,
		branch?: {
			request: BranchRequest;
			end: RailPosition;
			property: ResourceStateRail;
		},
	) {
		this.lastSplitUpdate = null;
		if (!isFinite(ratio) || ratio <= 0 || ratio >= 1)
			return { status: "invalid_split_position" };
		const core = AppleExtendedRailCompat.getCore(world, corePosition);
		if (!core) return { status: "rail_not_found" };
		if (core instanceof TileEntityLargeRailSwitchCore)
			return branch
				? { status: "switch_unsupported" }
				: this.splitSingleCrossover(world, player, core, expectedKey);
		if (AppleExtendedRailCompat.coreKey(core) !== expectedKey)
			return { status: "rail_changed" };
		if (core.isLogicalRailOccupied()) return { status: "rail_occupied" };
		const railMap = AppleExtendedRailCompat.getLogicalRailMap(core);
		const positions = AppleExtendedRailCompat.getLogicalPositions(core);
		if (!railMap || !positions || positions.length !== 2)
			return { status: "invalid_rail" };
		if (!AppleExtendedRailCompat.areBoundaryPositions(positions))
			return { status: "endpoint_not_on_block_boundary" };
		const length = railMap.getLength();
		const boundary = SRBXRailBoundary.findMapBoundary(
			railMap,
			ratio,
			3 / length,
			1 - 3 / length,
		);
		if (!boundary) return { status: "endpoint_not_on_block_boundary" };
		ratio = boundary.ratio;
		if (length * ratio <= 3 || length * (1 - ratio) <= 3)
			return { status: "rail_too_short" };
		const original = this.copyPositions(positions);
		const record: RailRecord = {
			source: { core: corePosition, key: expectedKey },
			positions: original,
			property: core.getResourceState(),
			signal: core.getSignal(),
			subRails: (() => {
				const result: ResourceStateRail[] = [];
				for (let i = 0; i < core.subRails.size(); i++)
					result.push(core.subRails.get(i));
				return result;
			})(),
			created: [],
		};
		const sample = 100000000;
		const index = Math.round(ratio * sample);
		const cant = railMap.getCant(sample, index);
		const x = boundary.position[0],
			z = boundary.position[2];
		const y =
			boundary.position[1] -
			Math.abs(Math.sin((cant * Math.PI) / 180) * 1.5);
		const pitch = railMap.getRailPitch(sample, index);
		const horizontal = this.splitHorizontal(original[0], original[1], x, z);
		const direction = SRBXRailBoundary.direction(
			[x, y, z],
			horizontal.secondStartYaw,
		);
		const startOwner = SRBXRailBoundary.owner(
			[x, y, z],
			horizontal.secondStartYaw,
		);
		const splitStart = new RailPosition(
			startOwner[0],
			startOwner[1],
			startOwner[2],
			direction,
			0,
		);
		splitStart.anchorYaw = horizontal.secondStartYaw;
		splitStart.anchorPitch = pitch;
		splitStart.anchorLengthHorizontal = Math.max(
			0.01,
			horizontal.secondStartLength,
		);
		splitStart.anchorLengthVertical = this.verticalLength(
			splitStart.anchorLengthHorizontal,
			pitch,
		);
		splitStart.cantEdge = cant;
		splitStart.cantCenter = railMap.getCant(
			sample,
			Math.round(((ratio + 1) / 2) * sample),
		);
		splitStart.setPosition(x, y, z);
		const splitEnd = AppleExtendedRailCompat.cloneRailPosition(splitStart);
		const endOwner = SRBXRailBoundary.owner(
			[x, y, z],
			horizontal.firstEndYaw,
		);
		splitEnd.blockX = endOwner[0];
		splitEnd.blockY = endOwner[1];
		splitEnd.blockZ = endOwner[2];
		splitEnd.direction = SRBXRailBoundary.direction(
			[x, y, z],
			horizontal.firstEndYaw,
		);
		splitEnd.anchorYaw = horizontal.firstEndYaw;
		splitEnd.anchorPitch = -pitch;
		splitEnd.anchorLengthHorizontal = Math.max(
			0.01,
			horizontal.firstEndLength,
		);
		splitEnd.anchorLengthVertical = this.verticalLength(
			splitEnd.anchorLengthHorizontal,
			splitEnd.anchorPitch,
		);
		splitEnd.cantEdge = -cant;
		splitEnd.cantCenter = railMap.getCant(
			sample,
			Math.round((ratio / 2) * sample),
		);
		splitEnd.setPosition(x, y, z);
		const firstStart = AppleExtendedRailCompat.cloneRailPosition(
			original[0],
		);
		firstStart.anchorLengthHorizontal = Math.max(
			0.01,
			horizontal.firstStartLength,
		);
		firstStart.anchorLengthVertical = this.verticalLength(
			firstStart.anchorLengthHorizontal,
			firstStart.anchorPitch,
		);
		const secondEnd = AppleExtendedRailCompat.cloneRailPosition(
			original[1],
		);
		secondEnd.anchorLengthHorizontal = Math.max(
			0.01,
			horizontal.secondEndLength,
		);
		secondEnd.anchorLengthVertical = this.verticalLength(
			secondEnd.anchorLengthHorizontal,
			secondEnd.anchorPitch,
		);
		let firstPositions = [firstStart, splitEnd];
		let secondPositions = [splitStart, secondEnd];
		if (branch) {
			// Snapshot external connections while the original rail still exists.
			// Replacement halves must never become external cant Undo targets.
			record.cants = [];
			this.zeroBranchConnections(
				world,
				core,
				positions,
				branch.request,
				record.cants,
			);
			const vx = branch.end.posX - x,
				vz = branch.end.posZ - z;
			const selectedFirst =
				vx * (original[0].posX - x) + vz * (original[0].posZ - z) >=
				vx * (original[1].posX - x) + vz * (original[1].posZ - z);
			const selected = selectedFirst ? firstPositions : secondPositions;
			const remaining = selectedFirst ? secondPositions : firstPositions;
			const rootIndex = selectedFirst ? 1 : 0;
			firstPositions = [
				this.switchPosition(selected[rootIndex], 1),
				this.switchPosition(selected[1 - rootIndex], 0),
				this.switchPosition(branch.end, 0),
			];
			secondPositions = remaining;
			for (let i = 0; i < remaining.length; i++) {
				remaining[i].cantEdge = 0;
				remaining[i].cantCenter = 0;
				remaining[i].cantRandom = 0;
			}
		}
		const removed = AppleExtendedRailCompat.undoNormalRail(
			world,
			corePosition,
			expectedKey,
		);
		if (removed !== "ok") {
			this.restoreCantRecords(world, record.cants);
			return { status: removed };
		}
		const first = AppleExtendedRailCompat.createFromPositions(
			world,
			player,
			firstPositions,
			branch ? branch.property : record.property,
		);
		if (first) record.created.push(first);
		const second = first
			? AppleExtendedRailCompat.createFromPositions(
					world,
					player,
					secondPositions,
					record.property,
				)
			: null;
		if (second) record.created.push(second);
		if (!first || !second) {
			const restored = this.rollbackBranch(world, player, record);
			return {
				status: restored ? "create_failed" : "split_rollback_failed",
			};
		}
		const token = UUID.randomUUID().toString();
		this.splitUndoRecords[token] = record;
		this.lastSplitUpdate = {
			removed: [{ core: corePosition, key: expectedKey }],
			refreshed: record.created.slice(),
		};
		return { status: "ok", undoToken: token };
	}

	static undoSplitBuilderRail(
		world: World,
		player: EntityPlayer,
		token: string,
	): string {
		this.lastSplitUpdate = null;
		const record = this.splitUndoRecords[token];
		if (!record) return "nothing_to_undo";
		// Cant records belong to external connections. Check them before
		// deleting the replacement rails, so a failed Undo remains retryable.
		if (record.cants)
			for (let i = 0; i < record.cants.length; i++) {
				const validation =
					AppleExtendedRailCompat.validateUndoNormalRail(
						world,
						record.cants[i].core,
						record.cants[i].railKey,
					);
				if (validation !== "ok") return validation;
			}
		const removed: CreatedRail[] = [];
		// Validate the entire replacement set before removing either half.
		for (let i = 0; i < record.created.length; i++) {
			const validation = AppleExtendedRailCompat.validateUndoNormalRail(
				world,
				record.created[i].core,
				record.created[i].key,
			);
			if (validation !== "ok") return validation;
		}
		for (let i = record.created.length - 1; i >= 0; i--) {
			const result = AppleExtendedRailCompat.undoNormalRail(
				world,
				record.created[i].core,
				record.created[i].key,
			);
			if (result !== "ok") return result;
			removed.push(record.created[i]);
		}
		const restored = record.source
			? this.restoreRecord(world, player, record)
			: null;
		if (record.source && !restored) return "undo_restore_failed";
		if (!this.restoreCantRecords(world, record.cants))
			return "undo_cant_restore_failed";
		this.lastSplitUpdate = {
			removed,
			refreshed: restored ? [restored] : [],
		};
		delete this.splitUndoRecords[token];
		return "undo_ok";
	}

	static consumeLastSplitClientUpdate() {
		const result = this.lastSplitUpdate;
		this.lastSplitUpdate = null;
		return result;
	}

	private static switchPosition(
		source: RailPosition,
		switchType: number,
	): RailPosition {
		// AE's switchType is a final Java field. Recreate it through NBT rather
		// than assigning a field that Nashorn cannot change.
		const nbt: NBTTagCompound = source.writeToNBT();
		nbt.setByte("SwitchType", switchType);
		const result = RailPosition.readFromNBT(nbt);
		result.cantEdge = 0;
		result.cantCenter = 0;
		result.cantRandom = 0;
		return result;
	}

	private static isFlat(core: TileEntityLargeRailCore): boolean {
		const map = AppleExtendedRailCompat.getLogicalRailMap(core);
		return (
			!!map &&
			Math.abs(map.getRailPitch(1000, 0)) <= 0.001 &&
			Math.abs(map.getRailPitch(1000, 500)) <= 0.001 &&
			Math.abs(map.getRailPitch(1000, 1000)) <= 0.001
		);
	}

	private static rollbackBranch(
		world: World,
		player: EntityPlayer,
		record: RailRecord,
	): boolean {
		// Never restore over replacements that could not safely be removed.
		const removed = record.created.slice();
		for (let i = 0; i < record.created.length; i++) {
			const validation = AppleExtendedRailCompat.validateUndoNormalRail(
				world,
				record.created[i].core,
				record.created[i].key,
			);
			if (validation !== "ok") {
				NGTLog.debug(
					`[SuperRailBuilderX AE] branch rollback blocked: core=${record.created[i].core.join(",")}, key=${record.created[i].key}, status=${validation}`,
				);
				return false;
			}
		}
		for (let i = record.created.length - 1; i >= 0; i--) {
			const result = AppleExtendedRailCompat.undoNormalRail(
				world,
				record.created[i].core,
				record.created[i].key,
			);
			if (result !== "ok") return false;
			record.created.pop();
		}
		const restored = record.source
			? this.restoreRecord(world, player, record)
			: null;
		if (record.source && !restored) return false;
		if (record.source) removed.push(record.source);
		// A rollback also replaces the section UUID. Refresh the restored group,
		// even when the requested branch itself failed.
		this.lastSplitUpdate = { removed, refreshed: [restored] };
		return this.restoreCantRecords(world, record.cants);
	}

	private static zeroExternalCant(
		core: TileEntityLargeRailCore,
		index: number,
		records: CantRecord[],
	): void {
		const key = AppleExtendedRailCompat.coreKey(core);
		let record: CantRecord | null = null;
		for (let i = 0; i < records.length; i++)
			if (records[i].railKey === key) record = records[i];
		if (!record) {
			const original = this.copyPositions(
				AppleExtendedRailCompat.getLogicalPositions(core),
			);
			if (original.length !== 2) return;
			record = {
				core: this.corePos(core),
				railKey: key,
				positions: original,
			};
			records.push(record);
		}
		const updated = this.copyPositions(
			AppleExtendedRailCompat.getLogicalPositions(core),
		);
		if (index < 0 || index >= updated.length) return;
		updated[index].cantEdge = 0;
		updated[index].cantRandom = 0;
		const center = (updated[0].cantEdge - updated[1].cantEdge) / 2;
		updated[0].cantCenter = center;
		updated[1].cantCenter = center;
		this.updateCants(core, updated);
	}

	private static zeroBranchConnections(
		world: World,
		sourceCore: TileEntityLargeRailCore,
		sourcePositions: { length: number; [index: number]: RailPosition },
		request: BranchRequest,
		records: CantRecord[],
	): void {
		for (let i = 0; i < sourcePositions.length; i++) {
			const connected = this.connectedEndpoints(
				world,
				sourceCore,
				sourcePositions[i],
			);
			for (let j = 0; j < connected.length; j++)
				this.zeroExternalCant(
					connected[j].core,
					connected[j].index,
					records,
				);
		}
		if (request.branchEnd.kind === "rail" && request.branchEnd.core) {
			const core = AppleExtendedRailCompat.getCore(
				world,
				request.branchEnd.core,
			);
			if (
				core &&
				AppleExtendedRailCompat.coreKey(core) !==
					AppleExtendedRailCompat.coreKey(sourceCore) &&
				request.branchEnd.index !== undefined
			)
				this.zeroExternalCant(core, request.branchEnd.index, records);
		}
	}

	static createBranchBuilderRail(
		world: World,
		player: EntityPlayer,
		request: BranchRequest,
	) {
		this.lastSplitUpdate = null;
		if (
			!request ||
			!isFinite(request.ratio) ||
			request.ratio < 0 ||
			request.ratio > 1
		)
			return { status: "invalid_request" };
		const sourceCore = AppleExtendedRailCompat.getCore(world, request.core);
		if (
			!sourceCore ||
			sourceCore instanceof TileEntityLargeRailSwitchCore ||
			AppleExtendedRailCompat.coreKey(sourceCore) !== request.railKey ||
			!this.isFlat(sourceCore)
		)
			return { status: "sloped_or_changed_rail" };
		if (sourceCore.isLogicalRailOccupied())
			return { status: "rail_occupied" };
		const sourcePositions =
			AppleExtendedRailCompat.getLogicalPositions(sourceCore);
		if (!sourcePositions || sourcePositions.length !== 2)
			return { status: "invalid_source_rail" };
		if (!AppleExtendedRailCompat.areBoundaryPositions(sourcePositions))
			return { status: "endpoint_not_on_block_boundary" };
		if (
			!request.branchStart ||
			!request.branchEnd ||
			!request.branchEnd.position ||
			!isFinite(request.branchEnd.anchorYaw) ||
			!isFinite(request.branchEnd.anchorPitch) ||
			request.branchEnd.position.some((value) => !isFinite(value))
		)
			return { status: "invalid_branch_end" };
		request = {
			...request,
			branchEnd: SRBXRailBoundary.normalizePoint(request.branchEnd),
		};
		if (
			!SRBXRailBoundary.isBoundary(
				request.branchEnd.position,
				request.branchEnd.anchorYaw,
			)
		)
			return { status: "endpoint_not_on_block_boundary" };
		const endpoint = request.ratio === 0 || request.ratio === 1;
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
		const sourceMap = AppleExtendedRailCompat.getLogicalRailMap(sourceCore);
		if (!sourceMap) return { status: "invalid_source_rail" };
		if (!endpoint) {
			const length = sourceMap.getLength();
			const boundary = SRBXRailBoundary.findMapBoundary(
				sourceMap,
				request.ratio,
				3 / length,
				1 - 3 / length,
			);
			if (!boundary) return { status: "endpoint_not_on_block_boundary" };
			const position: RailCorePos = [
				boundary.position[0],
				boundary.position[1] -
					Math.abs(
						Math.sin(
							(sourceMap.getCant(
								100000000,
								Math.round(boundary.ratio * 100000000),
							) *
								Math.PI) /
								180,
						) * 1.5,
					),
				boundary.position[2],
			];
			request = {
				...request,
				ratio: boundary.ratio,
				branchStart: { ...request.branchStart, position },
			};
		}
		const sampleIndex = Math.round(request.ratio * 1000000);
		const sampled = endpoint
			? sourcePositions[request.ratio === 0 ? 0 : 1]
			: null;
		const sampledMap = endpoint
			? null
			: sourceMap.getRailPos(1000000, sampleIndex);
		const sampledX = sampled ? sampled.posX : sampledMap![1];
		const sampledZ = sampled ? sampled.posZ : sampledMap![0];
		const sampledY = sampled
			? sampled.posY
			: sourceMap.getRailHeight(1000000, sampleIndex) -
				Math.abs(
					Math.sin(
						(sourceMap.getCant(1000000, sampleIndex) * Math.PI) /
							180,
					) * 1.5,
				);
		if (
			Math.abs(sampledX - request.branchStart.position[0]) > 0.01 ||
			Math.abs(sampledY - request.branchStart.position[1]) > 0.01 ||
			Math.abs(sampledZ - request.branchStart.position[2]) > 0.01
		)
			return { status: "rail_changed" };
		const branchEnd = AppleExtendedRailCompat.resolveBuilderPoint(
			world,
			request.branchEnd,
		);
		if (!branchEnd) return { status: "invalid_branch_end" };
		if (!AppleExtendedRailCompat.areBoundaryPositions([branchEnd]))
			return { status: "endpoint_not_on_block_boundary" };
		branchEnd.anchorLengthHorizontal = request.branchEnd.anchorLength;
		branchEnd.anchorLengthVertical =
			request.branchEnd.anchorLengthVertical === undefined
				? request.branchEnd.anchorLength
				: request.branchEnd.anchorLengthVertical;
		const property =
			AppleExtendedRailCompat.propertyFromPlayer(player) ||
			sourceCore.getResourceState();

		if (endpoint) {
			const rootIndex = request.ratio === 0 ? 0 : 1;
			const original = this.copyPositions(sourcePositions);
			const record: RailRecord = {
				source: { core: request.core, key: request.railKey },
				positions: original,
				property: sourceCore.getResourceState(),
				signal: sourceCore.getSignal(),
				subRails: (() => {
					const result: ResourceStateRail[] = [];
					for (let i = 0; i < sourceCore.subRails.size(); i++)
						result.push(sourceCore.subRails.get(i));
					return result;
				})(),
				created: [],
				cants: [],
			};
			this.zeroBranchConnections(
				world,
				sourceCore,
				sourcePositions,
				request,
				record.cants!,
			);
			const removed = AppleExtendedRailCompat.undoNormalRail(
				world,
				request.core,
				request.railKey,
			);
			if (removed !== "ok") {
				this.restoreCantRecords(world, record.cants);
				return { status: removed };
			}
			const created = AppleExtendedRailCompat.createFromPositions(
				world,
				player,
				[
					this.switchPosition(original[rootIndex], 1),
					this.switchPosition(original[1 - rootIndex], 0),
					this.switchPosition(branchEnd, 0),
				],
				property,
			);
			if (!created) {
				const restored = this.rollbackBranch(world, player, record);
				return {
					status: restored
						? "switch_create_failed"
						: "split_rollback_failed",
				};
			}
			record.created.push(created);
			const token = UUID.randomUUID().toString();
			this.splitUndoRecords[token] = record;
			this.lastSplitUpdate = {
				removed: [{ core: request.core, key: request.railKey }],
				refreshed: [created],
			};
			return { status: "ok", undoToken: token };
		}

		// Install the final switch before the remaining half can occupy its root.
		return this.splitBuilderRail(
			world,
			player,
			request.core,
			request.railKey,
			request.ratio,
			{ request, end: branchEnd, property },
		);
	}

	private static hasCrossoverConnection(
		world: World,
		owner: TileEntityLargeRailCore,
		position: RailPosition,
	): boolean {
		const ownKey = AppleExtendedRailCompat.coreKey(owner);
		const seen: { [key: string]: boolean } = {};
		const loaded = world.loadedTileEntityList;
		for (let i = 0; i < loaded.size(); i++) {
			const tile = loaded.get(i);
			if (!(tile instanceof TileEntityLargeRailBase)) continue;
			const core = tile.getRailCore();
			if (!core) continue;
			const key = AppleExtendedRailCompat.coreKey(core);
			if (key === ownKey || seen[key]) continue;
			seen[key] = true;
			const positions = AppleExtendedRailCompat.getLogicalPositions(core);
			if (!positions) continue;
			for (let j = 0; j < positions.length; j++) {
				const p = positions[j];
				if (
					Math.abs(p.posX - position.posX) <= 0.001 &&
					Math.abs(p.posY - position.posY) <= 0.001 &&
					Math.abs(p.posZ - position.posZ) <= 0.001
				)
					return true;
			}
		}
		return false;
	}

	static isHorizontalBuilderRail(core: TileEntityLargeRailCore): boolean {
		return this.isFlat(core);
	}
	static createCrossoverBuilderRail(
		world: World,
		player: EntityPlayer,
		plan: SRBXCrossoverPlan,
	) {
		this.lastSplitUpdate = null;
		const validation = validateCrossoverPlan(plan);
		if (validation !== "ok") return { status: validation };
		let sourceCore: TileEntityLargeRailCore | null = null;
		let record: RailRecord | null = null;
		if (plan.source) {
			const source = plan.source;
			if (!source.core || !source.startPosition || !source.endPosition)
				return { status: "invalid_source_rail" };
			sourceCore = AppleExtendedRailCompat.getCore(world, source.core);
			if (
				!sourceCore ||
				sourceCore instanceof TileEntityLargeRailSwitchCore ||
				AppleExtendedRailCompat.coreKey(sourceCore) !==
					source.railKey ||
				!this.isFlat(sourceCore)
			)
				return { status: "sloped_or_changed_rail" };
			if (sourceCore.isLogicalRailOccupied())
				return { status: "rail_occupied" };
			const original =
				AppleExtendedRailCompat.getLogicalPositions(sourceCore);
			if (!original || original.length !== 2)
				return { status: "invalid_source_rail" };
			const expected = [source.startPosition, source.endPosition];
			for (let i = 0; i < 2; i++) {
				const actual = [
					original[i].posX,
					original[i].posY,
					original[i].posZ,
				];
				for (let axis = 0; axis < 3; axis++)
					if (
						!isFinite(expected[i][axis]) ||
						Math.abs(actual[axis] - expected[i][axis]) > 0.001 ||
						Math.abs(actual[axis] - plan.points[i].position[axis]) >
							0.001
					)
						return { status: "rail_changed" };
				const point = plan.points[i];
				if (
					Math.abs(
						AppleExtendedRailCompat.normalizeDegrees(
							original[i].anchorYaw - point.anchorYaw,
						),
					) > 0.001 ||
					Math.abs(
						original[i].anchorLengthHorizontal - point.anchorLength,
					) > 0.001 ||
					Math.abs(
						original[i].anchorLengthVertical -
							(point.anchorLengthVertical === undefined
								? point.anchorLength
								: point.anchorLengthVertical),
					) > 0.001
				)
					return { status: "rail_changed" };
			}
			const subRails: ResourceStateRail[] = [];
			for (let i = 0; i < sourceCore.subRails.size(); i++)
				subRails.push(sourceCore.subRails.get(i));
			record = {
				source: { core: source.core, key: source.railKey },
				positions: this.copyPositions(original),
				property: sourceCore.getResourceState(),
				signal: sourceCore.getSignal(),
				subRails,
				created: [],
				cants: [],
			};
		}
		let property = record
			? record.property
			: AppleExtendedRailCompat.propertyFromPlayer(player);
		if (!property)
			for (let i = 0; i < plan.points.length; i++) {
				const p = plan.points[i];
				if (p.kind !== "rail" || !p.core) continue;
				const core = AppleExtendedRailCompat.getCore(world, p.core);
				if (core) {
					property = core.getResourceState();
					break;
				}
			}
		if (!property) return { status: "rail_item_required" };
		const positions: RailPosition[] = [];
		const external: Array<{
			core: TileEntityLargeRailCore;
			index: number;
		}> = [];
		for (let i = 0; i < 4; i++) {
			const point = plan.points[i];
			const resolved =
				record && i < 2
					? record.positions[i]
					: AppleExtendedRailCompat.resolveBuilderPoint(world, point);
			if (
				!resolved ||
				Math.abs(resolved.anchorPitch) > 0.001 ||
				Math.abs(resolved.posY - plan.points[0].position[1]) > 0.001
			)
				return { status: "invalid_endpoint" };
			if (!record || i >= 2) {
				// The adjacent rail supplies heading and height, while this new
				// crossover retains its own curve control lengths.
				resolved.anchorLengthHorizontal = point.anchorLength;
				resolved.anchorLengthVertical =
					point.anchorLengthVertical === undefined
						? point.anchorLength
						: point.anchorLengthVertical;
			}
			positions.push(this.switchPosition(resolved, plan.switchTypes[i]));
			if (record && i < 2 && sourceCore) {
				const connected = this.connectedEndpoints(
					world,
					sourceCore,
					resolved,
				);
				for (let j = 0; j < connected.length; j++)
					external.push(connected[j]);
			} else if (
				point.kind === "rail" &&
				point.core &&
				point.index !== undefined
			) {
				const core = AppleExtendedRailCompat.getCore(world, point.core);
				if (
					!core ||
					core === sourceCore ||
					(!(core instanceof TileEntityLargeRailSwitchCore) &&
						!this.isFlat(core))
				)
					return { status: "invalid_endpoint" };
				const logical =
					AppleExtendedRailCompat.getLogicalPositions(core);
				if (
					!logical ||
					!logical[point.index] ||
					this.hasCrossoverConnection(
						world,
						core,
						logical[point.index],
					)
				)
					return { status: "endpoint_already_connected" };
				external.push({ core, index: point.index });
			}
		}
		for (let i = 0; i < external.length; i++)
			if (external[i].core.isLogicalRailOccupied())
				return { status: "rail_occupied" };
		if (plan.switchTypes.filter((value) => value === 1).length === 2) {
			const resolvedPoints: AppleExtendedBuilderPoint[] = positions.map(
				(rp) => ({
					kind: "free",
					markerPosition: [rp.posX, rp.posY, rp.posZ] as RailCorePos,
					position: [rp.posX, rp.posY, rp.posZ] as RailCorePos,
					ownerBlock: [
						rp.blockX,
						rp.blockY,
						rp.blockZ,
					] as RailCorePos,
					direction: rp.direction,
					anchorYaw: rp.anchorYaw,
					anchorPitch: rp.anchorPitch,
					anchorLength: rp.anchorLengthHorizontal,
					anchorLengthVertical: rp.anchorLengthVertical,
					cantEdge: 0,
					cantCenter: 0,
					cantRandom: 0,
				}),
			);
			const divided = SRBXSingleCrossoverSplit.fromPoints(
				resolvedPoints,
				plan.switchTypes,
				(start, end) => {
					const a = AppleExtendedRailCompat.resolveBuilderPoint(
						world,
						start,
						true,
					);
					const b = AppleExtendedRailCompat.resolveBuilderPoint(
						world,
						end,
						true,
					);
					if (!a || !b)
						return { midpoint: [NaN, NaN, NaN], length: NaN };
					const map = new RailMapBasic(
						a,
						b,
						RailMapBasic.fixRTMRailMapVersionCurrent,
					);
					const middle = map.getRailPos(2, 1);
					return {
						midpoint: [
							middle[1],
							map.getRailHeight(2, 1),
							middle[0],
						],
						length: map.getLength(),
					};
				},
			);
			if (!divided) return { status: "invalid_switch_layout" };
			const transaction: RailRecord = record || {
				positions: [],
				property,
				signal: 0,
				subRails: [],
				created: [],
				cants: [],
			};
			return this.createSplitCrossover(
				world,
				player,
				divided,
				transaction,
				() => {
					for (const endpoint of external)
						if (
							!(
								endpoint.core instanceof
								TileEntityLargeRailSwitchCore
							)
						)
							this.zeroExternalCant(
								endpoint.core,
								endpoint.index,
								transaction.cants!,
							);
				},
			);
		}
		// Preflight ignores only the source that this transaction replaces.
		if (
			!AppleExtendedRailCompat.planCreation(
				world,
				positions,
				property,
				plan.source ? plan.source.railKey : undefined,
			)
		)
			return { status: "core_conflict" };
		const cants = record ? record.cants! : [];
		try {
			for (let i = 0; i < external.length; i++)
				// Native switches already have zero cant; the normal-rail helper
				// recalculates a two-end profile and must not edit a switch topology.
				if (
					!(external[i].core instanceof TileEntityLargeRailSwitchCore)
				)
					this.zeroExternalCant(
						external[i].core,
						external[i].index,
						cants,
					);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX AE] crossover cant preparation exception: ${error}`,
			);
			let restored = false;
			try {
				restored = this.restoreCantRecords(world, cants);
			} catch (restoreError) {
				NGTLog.debug(
					`[SuperRailBuilderX AE] crossover cant rollback exception: ${restoreError}`,
				);
			}
			return {
				status: restored
					? "cant_update_failed"
					: "split_rollback_failed",
			};
		}
		if (record && plan.source) {
			const removed = AppleExtendedRailCompat.undoNormalRail(
				world,
				plan.source.core,
				plan.source.railKey,
			);
			if (removed !== "ok") {
				this.restoreCantRecords(world, cants);
				return { status: removed };
			}
		}
		let created: CreatedRail | null = null;
		try {
			created = AppleExtendedRailCompat.createFromPositions(
				world,
				player,
				positions,
				property,
			);
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX AE] crossover creation exception: ${error}`,
			);
		}
		if (!created) {
			const restored = record
				? this.rollbackBranch(world, player, record)
				: this.restoreCantRecords(world, cants);
			return {
				status: restored
					? "switch_create_failed"
					: "split_rollback_failed",
			};
		}
		const token = UUID.randomUUID().toString();
		if (record) {
			record.created.push(created);
			try {
				const core = AppleExtendedRailCompat.getCore(
					world,
					created.core,
				);
				if (!core) throw new Error("created crossover core missing");
				core.setSignal(record.signal);
				for (let i = 0; i < record.subRails.length; i++)
					core.addSubRail(record.subRails[i]);
				core.markDirty();
				core.sendPacket();
			} catch (error) {
				NGTLog.debug(
					`[SuperRailBuilderX AE] crossover metadata exception: ${error}`,
				);
				let restored = false;
				try {
					restored = this.rollbackBranch(world, player, record);
				} catch (restoreError) {
					NGTLog.debug(
						`[SuperRailBuilderX AE] crossover metadata rollback exception: ${restoreError}`,
					);
				}
				return {
					status: restored
						? "switch_create_failed"
						: "split_rollback_failed",
				};
			}
			this.splitUndoRecords[token] = record;
		} else this.crossoverUndoRecords[token] = { created, cants };
		this.lastSplitUpdate = {
			removed: record && record.source ? [record.source] : [],
			refreshed: [created],
		};
		return { status: "ok", undoToken: token };
	}

	static undoCrossoverBuilderRail(
		world: World,
		player: EntityPlayer,
		token: string,
	): string {
		this.lastSplitUpdate = null;
		if (this.splitUndoRecords[token])
			return this.undoSplitBuilderRail(world, player, token);
		const record = this.crossoverUndoRecords[token];
		if (!record) return "nothing_to_undo";
		const targets = [
			{ core: record.created.core, railKey: record.created.key },
		];
		for (let i = 0; i < record.cants.length; i++)
			targets.push(record.cants[i]);
		for (let i = 0; i < targets.length; i++) {
			const validation = AppleExtendedRailCompat.validateUndoNormalRail(
				world,
				targets[i].core,
				targets[i].railKey,
			);
			if (validation !== "ok") return validation;
		}
		const removed = AppleExtendedRailCompat.undoNormalRail(
			world,
			record.created.core,
			record.created.key,
		);
		if (removed !== "ok") return removed;
		if (!this.restoreCantRecords(world, record.cants))
			return "undo_cant_restore_failed";
		this.lastSplitUpdate = { removed: [record.created], refreshed: [] };
		delete this.crossoverUndoRecords[token];
		return "undo_ok";
	}

	static undoBranchBuilderRail(
		world: World,
		player: EntityPlayer,
		token: string,
	): string {
		return this.undoSplitBuilderRail(world, player, token);
	}
}
