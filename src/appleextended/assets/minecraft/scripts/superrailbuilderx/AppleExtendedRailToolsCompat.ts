import {
	TileEntityLargeRailBase,
	TileEntityLargeRailCore,
	TileEntityLargeRailSwitchCore,
} from "jp.ngt.rtm.rail";
import { ResourceStateRail } from "jp.ngt.rtm.modelpack.state";
import { RailPosition } from "jp.ngt.rtm.rail.util";
import { EntityPlayer } from "net.minecraft.entity.player";
import { BlockPos } from "net.minecraft.util.math";
import { World } from "net.minecraft.world";
import { UUID } from "java.util";
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
		const target = core.getRailPositions();
		if (!target || target.length !== positions.length) return [];
		for (let i = 0; i < positions.length; i++) {
			target[i].cantEdge = positions[i].cantEdge;
			target[i].cantCenter = positions[i].cantCenter;
			target[i].cantRandom = positions[i].cantRandom;
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
		const neighbor = source.getNeighborBlockPos();
		const tile = world.getTileEntity(neighbor);
		if (!(tile instanceof TileEntityLargeRailBase)) return result;
		const core = tile.getRailCore();
		if (!core || core === sourceCore) return result;
		const positions = core.getRailPositions();
		if (!positions) return result;
		for (let i = 0; i < positions.length; i++)
			if (
				Math.abs(positions[i].posX - source.posX) <= 0.001 &&
				Math.abs(positions[i].posY - source.posY) <= 0.001 &&
				Math.abs(positions[i].posZ - source.posZ) <= 0.001
			)
				result.push({ core, index: i });
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
				const positions = this.copyPositions(core.getRailPositions());
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
			if (core.isTrainOnRail()) return { status: "rail_occupied" };
			const entry = getPending(core);
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
				if (connected[j].core.isTrainOnRail())
					return { status: "rail_occupied" };
				const neighbor = getPending(connected[j].core);
				if (!neighbor) return { status: "invalid_rail" };
				neighbor.positions[connected[j].index].cantEdge = -target.angle;
			}
		}
		const keys = Object.keys(pending);
		for (let i = 0; i < keys.length; i++) {
			const entry = pending[keys[i]];
			const center =
				(entry.positions[0].cantEdge - entry.positions[1].cantEdge) / 2;
			entry.positions[0].cantCenter = center;
			entry.positions[1].cantCenter = center;
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
			if (core.isTrainOnRail()) return "rail_occupied";
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
				core.isTrainOnRail()
			)
				return false;
			this.updateCants(core, records[i].positions);
		}
		return true;
	}

	static splitBuilderRail(
		world: World,
		player: EntityPlayer,
		corePosition: RailCorePos,
		expectedKey: string,
		ratio: number,
	) {
		this.lastSplitUpdate = null;
		if (!isFinite(ratio) || ratio <= 0 || ratio >= 1)
			return { status: "invalid_split_position" };
		const core = AppleExtendedRailCompat.getCore(world, corePosition);
		if (!core) return { status: "rail_not_found" };
		if (core instanceof TileEntityLargeRailSwitchCore)
			return { status: "switch_unsupported" };
		if (AppleExtendedRailCompat.coreKey(core) !== expectedKey)
			return { status: "rail_changed" };
		if (core.isTrainOnRail()) return { status: "rail_occupied" };
		const railMap = core.getRailMap(null);
		const positions = core.getRailPositions();
		if (!railMap || !positions || positions.length !== 2)
			return { status: "invalid_rail" };
		const length = railMap.getLength();
		const candidateSplit = Math.max(2, Math.floor(length * 2));
		const candidateIndex = Math.round(ratio * candidateSplit);
		if (
			candidateIndex <= 0 ||
			candidateIndex >= candidateSplit ||
			Math.abs(ratio - candidateIndex / candidateSplit) > 0.0000001
		)
			return { status: "invalid_split_position" };
		ratio = candidateIndex / candidateSplit;
		if (length * ratio <= 3 || length * (1 - ratio) <= 3)
			return { status: "rail_too_short" };
		const original = this.copyPositions(positions);
		const record: RailRecord = {
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
		const sample = 1000000;
		const index = Math.round(ratio * sample);
		const point = railMap.getRailPos(sample, index);
		const cant = railMap.getCant(sample, index);
		const x = point[1],
			z = point[0];
		const y =
			railMap.getRailHeight(sample, index) -
			Math.abs(Math.sin((cant * Math.PI) / 180) * 1.5);
		const pitch = railMap.getRailPitch(sample, index);
		const horizontal = this.splitHorizontal(original[0], original[1], x, z);
		const direction = AppleExtendedRailCompat.directionFromYaw(
			horizontal.secondStartYaw,
		);
		const radians = (direction * 45 * Math.PI) / 180;
		const splitStart = new RailPosition(
			Math.floor(x + Math.sin(radians) * 0.000001),
			Math.floor(y - 1 / 16 + 0.000001),
			Math.floor(z + Math.cos(radians) * 0.000001),
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
		const neighbor = splitStart.getNeighborBlockPos();
		splitEnd.blockX = neighbor.getX();
		splitEnd.blockY = neighbor.getY();
		splitEnd.blockZ = neighbor.getZ();
		splitEnd.direction = (splitStart.direction + 4) & 7;
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
		const removed = AppleExtendedRailCompat.undoNormalRail(
			world,
			corePosition,
			expectedKey,
		);
		if (removed !== "ok") return { status: removed };
		const first = AppleExtendedRailCompat.createFromPositions(
			world,
			player,
			[firstStart, splitEnd],
			record.property,
		);
		if (first) record.created.push(first);
		const second = first
			? AppleExtendedRailCompat.createFromPositions(
					world,
					player,
					[splitStart, secondEnd],
					record.property,
				)
			: null;
		if (second) record.created.push(second);
		if (!first || !second) {
			for (let i = record.created.length - 1; i >= 0; i--)
				AppleExtendedRailCompat.undoNormalRail(
					world,
					record.created[i].core,
					record.created[i].key,
				);
			const restored = this.restoreRecord(world, player, record);
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
		const removed: CreatedRail[] = [];
		for (let i = record.created.length - 1; i >= 0; i--) {
			const result = AppleExtendedRailCompat.undoNormalRail(
				world,
				record.created[i].core,
				record.created[i].key,
			);
			if (result !== "ok") return result;
			removed.push(record.created[i]);
		}
		const restored = this.restoreRecord(world, player, record);
		if (!restored) return "undo_restore_failed";
		if (!this.restoreCantRecords(world, record.cants))
			return "undo_cant_restore_failed";
		this.lastSplitUpdate = { removed, refreshed: [restored] };
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
		const result = AppleExtendedRailCompat.cloneRailPosition(source);
		result.switchType = switchType;
		result.cantEdge = 0;
		result.cantCenter = 0;
		result.cantRandom = 0;
		return result;
	}

	private static isFlat(core: TileEntityLargeRailCore): boolean {
		const map = core.getRailMap(null);
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
		for (let i = record.created.length - 1; i >= 0; i--)
			AppleExtendedRailCompat.undoNormalRail(
				world,
				record.created[i].core,
				record.created[i].key,
			);
		record.created = [];
		return (
			!!this.restoreRecord(world, player, record) &&
			this.restoreCantRecords(world, record.cants)
		);
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
			const original = this.copyPositions(core.getRailPositions());
			if (original.length !== 2) return;
			record = {
				core: this.corePos(core),
				railKey: key,
				positions: original,
			};
			records.push(record);
		}
		const updated = this.copyPositions(core.getRailPositions());
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
				core !== sourceCore &&
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
		if (sourceCore.isTrainOnRail()) return { status: "rail_occupied" };
		const sourcePositions = sourceCore.getRailPositions();
		if (!sourcePositions || sourcePositions.length !== 2)
			return { status: "invalid_source_rail" };
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
		const sourceMap = sourceCore.getRailMap(null);
		if (!sourceMap) return { status: "invalid_source_rail" };
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
		record.cants = [];
		this.zeroBranchConnections(
			world,
			sourceCore,
			sourcePositions,
			request,
			record.cants,
		);
		const splitPosition = request.branchStart.position;
		const vx = request.branchEnd.position[0] - splitPosition[0];
		const vz = request.branchEnd.position[2] - splitPosition[2];
		const sx = record.positions[0].posX - splitPosition[0];
		const sz = record.positions[0].posZ - splitPosition[2];
		const ex = record.positions[1].posX - splitPosition[0];
		const ez = record.positions[1].posZ - splitPosition[2];
		const selectedIndex = vx * sx + vz * sz >= vx * ex + vz * ez ? 0 : 1;
		const selected = record.created[selectedIndex];
		const selectedCore = AppleExtendedRailCompat.getCore(
			world,
			selected.core,
		);
		if (!selectedCore) {
			this.rollbackBranch(world, player, record);
			delete this.splitUndoRecords[split.undoToken];
			return { status: "branch_split_failed" };
		}
		const half = this.copyPositions(selectedCore.getRailPositions());
		let rootIndex = 0;
		if (
			Math.pow(half[1].posX - splitPosition[0], 2) +
				Math.pow(half[1].posZ - splitPosition[2], 2) <
			Math.pow(half[0].posX - splitPosition[0], 2) +
				Math.pow(half[0].posZ - splitPosition[2], 2)
		)
			rootIndex = 1;
		const removed = AppleExtendedRailCompat.undoNormalRail(
			world,
			selected.core,
			selected.key,
		);
		if (removed !== "ok") {
			this.restoreCantRecords(world, record.cants);
			return { status: removed };
		}
		record.created.splice(selectedIndex, 1);
		const created = AppleExtendedRailCompat.createFromPositions(
			world,
			player,
			[
				this.switchPosition(half[rootIndex], 1),
				this.switchPosition(half[1 - rootIndex], 0),
				this.switchPosition(branchEnd, 0),
			],
			property,
		);
		if (!created) {
			const restored = this.rollbackBranch(world, player, record);
			delete this.splitUndoRecords[split.undoToken];
			return {
				status: restored
					? "switch_create_failed"
					: "split_rollback_failed",
			};
		}
		record.created.push(created);
		this.lastSplitUpdate = {
			removed: [{ core: request.core, key: request.railKey }, selected],
			refreshed: record.created.slice(),
		};
		return { status: "ok", undoToken: split.undoToken };
	}

	static undoBranchBuilderRail(
		world: World,
		player: EntityPlayer,
		token: string,
	): string {
		return this.undoSplitBuilderRail(world, player, token);
	}
}
