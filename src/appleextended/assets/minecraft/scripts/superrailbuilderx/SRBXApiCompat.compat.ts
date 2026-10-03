import {
	TileEntityLargeRailCore,
	TileEntityLargeRailSwitchCore,
} from "jp.ngt.rtm.rail";
import { RailPosition } from "jp.ngt.rtm.rail.util";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { WeakHashMap } from "java.util";
import {
	AppleExtendedBuilderPoint,
	AppleExtendedRailCompat,
	AppleExtendedSourceRail,
} from "./AppleExtendedRailCompat";
import { AppleExtendedRailToolsCompat } from "./AppleExtendedRailToolsCompat";
import { AppleExtendedRailMoveCompat } from "./AppleExtendedRailMoveCompat";

/** AppleExtended v2.5.3 exposes logical-rail APIs and automatic section rails. */
export class SRBXApiCompat {
	private static ghostInvalidated: WeakHashMap<
		TileEntityLargeRailCore,
		boolean
	> | null = null;
	static getRailCorePos(
		core: TileEntityLargeRailCore,
	): [number, number, number] {
		const pos = core.getPos();
		return [pos.getX(), pos.getY(), pos.getZ()];
	}

	static getRailPositionCandidateKey(core: TileEntityLargeRailCore): string {
		return AppleExtendedRailCompat.coreKey(core);
	}

	static getEditableRailPositions(
		core: TileEntityLargeRailCore,
	): JavaObjectArray<RailPosition> {
		return AppleExtendedRailCompat.getLogicalPositions(core);
	}

	static getLogicalRailMap(core: TileEntityLargeRailCore) {
		return core ? AppleExtendedRailCompat.getLogicalRailMap(core) : null;
	}

	static canMoveRailPosition(core: TileEntityLargeRailCore): boolean {
		return this.getRailPositionUnsupportedReason(core) === "";
	}

	static getRailPositionUnsupportedReason(
		core: TileEntityLargeRailCore,
	): string {
		if (!core) return "missing_core";
		if (core instanceof TileEntityLargeRailSwitchCore) return "switch";
		const positions = AppleExtendedRailCompat.getLogicalPositions(core);
		// Shared selectors read logical endpoints for creation, cant and branches.
		// Relocation restrictions belong to canMoveRailPosition and validation.
		return positions &&
			positions.length === 2 &&
			positions[0] &&
			positions[1]
			? ""
			: "invalid_positions";
	}

	static refreshRailPositionClient(
		core: TileEntityLargeRailCore,
		index: number,
		x: number,
		y: number,
		z: number,
	): void {
		if (AppleExtendedRailCompat.isSectionCore(core)) return;
		const positions = AppleExtendedRailCompat.getLogicalPositions(core);
		if (!positions || index < 0 || index >= positions.length) return;
		positions[index].setPosition(x, y, z);
		core.setRailPositions(positions);
		this.refreshRailCoreClient(core);
	}

	static refreshRailCoreClient(core: TileEntityLargeRailCore): void {
		if (!core) return;
		core.createRailMap();
		core.shouldRerenderRail = true;
		const world = core.getWorld();
		const pos = core.getPos();
		const state = world.getBlockState(pos);
		world.notifyBlockUpdate(pos, state, state, 3);
	}

	static needsRailClientGhostRetry(expectedKey: string): boolean {
		return expectedKey.indexOf("section:") === 0;
	}

	static removeRailClientGhost(
		world: net.minecraft.world.World,
		corePosition: [number, number, number],
		expectedKey: string,
	): void {
		if (!world.isRemote || !expectedKey) return;
		if (!this.ghostInvalidated) this.ghostInvalidated = new WeakHashMap();
		const candidates: TileEntityLargeRailCore[] = [];
		const root = AppleExtendedRailCompat.getCore(world, corePosition);
		if (root) candidates.push(root);
		// The representative can already belong to the replacement group.
		const loaded = world.loadedTileEntityList;
		for (let i = 0; i < loaded.size(); i++) {
			const tile = loaded.get(i);
			if (tile instanceof TileEntityLargeRailCore) candidates.push(tile);
		}
		// Packet-applied chunk tiles need not have joined the loaded list yet.
		const initialCount = candidates.length;
		for (let i = 0; i < initialCount; i++) {
			const core = candidates[i];
			if (
				this.getRailPositionCandidateKey(core) !== expectedKey ||
				!AppleExtendedRailCompat.isSectionCore(core)
			)
				continue;
			const group = core.getRailGroupCorePositions();
			for (let j = 0; j < group.size(); j++) {
				const pos = group.get(j);
				const member = AppleExtendedRailCompat.getCore(world, [
					pos[0],
					pos[1],
					pos[2],
				]);
				if (member) candidates.push(member);
			}
		}
		let removed = 0,
			invalidated = 0;
		const seen: TileEntityLargeRailCore[] = [];
		for (let i = 0; i < candidates.length; i++) {
			const core = candidates[i];
			if (
				seen.indexOf(core) >= 0 ||
				this.getRailPositionCandidateKey(core) !== expectedKey
			)
				continue;
			seen.push(core);
			const pos = core.getPos();
			let removedHere = false;
			// breakLogicalRail also deletes shared rail-bed blocks. A client
			// cleanup must only remove this exact old tile, never its replacement.
			if ((world.getTileEntity(pos) as unknown) === core) {
				const state = world.getBlockState(pos);
				world.removeTileEntity(pos);
				world.notifyBlockUpdate(pos, state, state, 3);
				removed++;
				removedHere = true;
			}
			// Detached tiles can still own GL lists in the render dispatcher.
			if (removedHere || !this.ghostInvalidated.containsKey(core)) {
				core.invalidate();
				this.ghostInvalidated.put(core, true);
				invalidated++;
			}
		}
		if (removed || invalidated)
			NGTLog.debug(
				`[SuperRailBuilderX AE] client ghost cleanup: key=${expectedKey}, removed=${removed}, invalidated=${invalidated}`,
			);
	}

	static consumeLastRailPositionMoveCores(): Array<[number, number, number]> {
		return AppleExtendedRailMoveCompat.consumeUpdated();
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
		if (
			!isFinite(originalX) ||
			!isFinite(originalY) ||
			!isFinite(originalZ) ||
			!isFinite(index) ||
			Math.floor(index) !== index
		)
			return "invalid";
		if (core.isLogicalRailOccupied()) return "occupied";
		const positions = AppleExtendedRailCompat.getLogicalPositions(core);
		if (!positions || index < 0 || index >= positions.length)
			return "not_found";
		const current = positions[index];
		const tolerance = 0.001;
		if (
			Math.abs(current.posX - originalX) > tolerance ||
			Math.abs(current.posY - originalY) > tolerance ||
			Math.abs(current.posZ - originalZ) > tolerance
		)
			return "changed";
		if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return "invalid";
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
		player?: net.minecraft.entity.player.EntityPlayer,
	): string {
		AppleExtendedRailMoveCompat.consumeUpdated();
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
		const positions = AppleExtendedRailCompat.getLogicalPositions(core);
		const start = AppleExtendedRailMoveCompat.point(positions[0]);
		const end = AppleExtendedRailMoveCompat.point(positions[1]);
		const moved = index === 0 ? start : end;
		moved.position = [x, y, z];
		delete moved.ownerBlock;
		return AppleExtendedRailMoveCompat.move(
			core,
			this.getRailPositionCandidateKey(core),
			[positions[0].posX, positions[0].posY, positions[0].posZ],
			[positions[1].posX, positions[1].posY, positions[1].posZ],
			start,
			end,
			player,
		);
	}

	static moveBuilderRail(
		core: TileEntityLargeRailCore,
		expectedKey: string,
		originalStart: [number, number, number],
		originalEnd: [number, number, number],
		start: AppleExtendedBuilderPoint,
		end: AppleExtendedBuilderPoint,
		player?: net.minecraft.entity.player.EntityPlayer,
	): string {
		return AppleExtendedRailMoveCompat.move(
			core,
			expectedKey,
			originalStart,
			originalEnd,
			start,
			end,
			player,
		);
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
		return this.validateRailPositionMove(
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

	static moveRailPositionAsNormal(
		core: TileEntityLargeRailCore,
		index: number,
		originalX: number,
		originalY: number,
		originalZ: number,
		x: number,
		y: number,
		z: number,
		player?: net.minecraft.entity.player.EntityPlayer,
	): string {
		return this.moveRailPosition(
			core,
			index,
			originalX,
			originalY,
			originalZ,
			x,
			y,
			z,
			player,
		);
	}

	static createBuilderRail(
		world: net.minecraft.world.World,
		player: net.minecraft.entity.player.EntityPlayer,
		start: AppleExtendedBuilderPoint,
		end: AppleExtendedBuilderPoint,
		additionalProtectedRailKeys?: string[],
		sourceRail?: AppleExtendedSourceRail,
		fallbackProperty?: unknown,
		forceNormal?: boolean,
		preferFallbackProperty?: boolean,
		overwriteForeignRoadbeds?: boolean,
		propertySourcePoint?: AppleExtendedBuilderPoint,
		replaceProtectedCoreRoadbedAt?: [number, number, number],
	) {
		void additionalProtectedRailKeys;
		void overwriteForeignRoadbeds;
		void replaceProtectedCoreRoadbedAt;
		return AppleExtendedRailCompat.createNormalRail(
			world,
			player,
			start,
			end,
			fallbackProperty,
			sourceRail,
			preferFallbackProperty,
			propertySourcePoint,
			!!forceNormal,
		);
	}

	static undoBuilderRail(
		world: net.minecraft.world.World,
		coreX: number,
		coreY: number,
		coreZ: number,
		expectedKey: string,
	): string {
		return AppleExtendedRailCompat.undoNormalRail(
			world,
			[coreX, coreY, coreZ],
			expectedKey,
		);
	}

	static applyRailCants(
		world: net.minecraft.world.World,
		targets: unknown[],
	) {
		return AppleExtendedRailToolsCompat.applyRailCants(
			world,
			targets as Parameters<
				typeof AppleExtendedRailToolsCompat.applyRailCants
			>[1],
		);
	}

	static undoRailCants(
		world: net.minecraft.world.World,
		undoToken: string,
	): string {
		return AppleExtendedRailToolsCompat.undoRailCants(world, undoToken);
	}

	static consumeLastCantClientUpdate(): Array<[number, number, number]> {
		return AppleExtendedRailToolsCompat.consumeLastCantClientUpdate();
	}

	static splitBuilderRail(
		world: net.minecraft.world.World,
		player: net.minecraft.entity.player.EntityPlayer,
		core: [number, number, number],
		expectedKey: string,
		ratio: number,
	) {
		return AppleExtendedRailToolsCompat.splitBuilderRail(
			world,
			player,
			core,
			expectedKey,
			ratio,
		);
	}

	static undoSplitBuilderRail(
		world: net.minecraft.world.World,
		player: net.minecraft.entity.player.EntityPlayer,
		undoToken: string,
	): string {
		return AppleExtendedRailToolsCompat.undoSplitBuilderRail(
			world,
			player,
			undoToken,
		);
	}

	static consumeLastSplitClientUpdate() {
		return AppleExtendedRailToolsCompat.consumeLastSplitClientUpdate();
	}

	static createBranchBuilderRail(
		world: net.minecraft.world.World,
		player: net.minecraft.entity.player.EntityPlayer,
		request: unknown,
	) {
		return AppleExtendedRailToolsCompat.createBranchBuilderRail(
			world,
			player,
			request as Parameters<
				typeof AppleExtendedRailToolsCompat.createBranchBuilderRail
			>[2],
		);
	}

	static undoBranchBuilderRail(
		world: net.minecraft.world.World,
		player: net.minecraft.entity.player.EntityPlayer,
		undoToken: string,
	): string {
		return AppleExtendedRailToolsCompat.undoBranchBuilderRail(
			world,
			player,
			undoToken,
		);
	}

	static consumeLastBranchClientUpdate() {
		return AppleExtendedRailToolsCompat.consumeLastSplitClientUpdate();
	}
}
