import { SRBXFreeEndpointPolicy as SRBXRailBoundary } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXFreeEndpointPolicy";
import { GlStateManager } from "net.minecraft.client.renderer";
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

import { SRBXGuiGLState } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXGuiGLState";

/** AppleExtended v2.5.3 exposes logical-rail APIs and automatic section rails. */
import { NGTUtilClient } from "jp.ngt.ngtlib.util";
export class SRBXApiCompat {
	static drawGuiTextWithShadow(
		text: string,
		x: number,
		y: number,
		color: number,
	): void {
		NGTUtilClient.getMinecraft().fontRenderer.drawStringWithShadow(
			text,
			x,
			y,
			color,
		);
	}
	static syncGuiGLState(state: SRBXGuiGLState): void {
		if (state.enabled[0]) GlStateManager.enableLighting();
		else GlStateManager.disableLighting();
		if (state.enabled[1]) GlStateManager.enableFog();
		else GlStateManager.disableFog();
		if (state.enabled[2]) GlStateManager.enableCull();
		else GlStateManager.disableCull();
		if (state.enabled[3]) GlStateManager.enableAlpha();
		else GlStateManager.disableAlpha();
		if (state.enabled[4]) GlStateManager.enableDepth();
		else GlStateManager.disableDepth();
		if (state.enabled[5]) GlStateManager.enableBlend();
		else GlStateManager.disableBlend();
		GlStateManager.alphaFunc(state.alphaFunc, state.alphaRef);
		GlStateManager.depthFunc(state.depthFunc);
		GlStateManager.depthMask(state.depthWrite);
		GlStateManager.colorMask(
			state.colorWrite[0],
			state.colorWrite[1],
			state.colorWrite[2],
			state.colorWrite[3],
		);
		GlStateManager.tryBlendFuncSeparate(
			state.blend[0],
			state.blend[1],
			state.blend[2],
			state.blend[3],
		);
		GlStateManager.color(
			state.color[0],
			state.color[1],
			state.color[2],
			state.color[3],
		);
		for (let unit = 0; unit < 2; unit++) {
			GlStateManager.setActiveTexture(state.textureUnits[unit]);
			if (state.textureEnabled[unit]) GlStateManager.enableTexture2D();
			else GlStateManager.disableTexture2D();
			GlStateManager.bindTexture(state.textureBinding[unit]);
		}
		GlStateManager.setActiveTexture(state.activeTexture);
	}
	static requiresRailBoundarySnap(): boolean {
		return false;
	}

	/** Clients need only the separate model pack; Java capability is checked on writes. */
	private static hasFreeEndpointPatch(): boolean {
		try {
			const type = java.lang.Class.forName("jp.hi03.srbxpatch.SRBXPatch");
			const classes = java.lang.reflect.Array.newInstance(
				java.lang.Class.class,
				0,
			);
			const args = java.lang.reflect.Array.newInstance(
				java.lang.Class.forName("java.lang.Object"),
				0,
			);
			return (
				String(
					type
						.getMethod("isFreeEndpointEnabled", classes)
						.invoke(null, args),
				) === "true"
			);
		} catch (error) {
			return false;
		}
	}

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

	static usesGeometryRailHighlight(): boolean {
		return true;
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
			// cleanup must remove this exact old block and tile together.
			// Leaving the core block behind recreates an uninitialized tile.
			if ((world.getTileEntity(pos) as unknown) === core) {
				removedHere = world.setBlockToAir(pos);
				if (removedHere) removed++;
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
		preserveEndpointGeometry = false,
		restorePoint?: AppleExtendedBuilderPoint,
	): string {
		if (!this.hasFreeEndpointPatch()) return "srbxpatch_required";
		void restorePoint;
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
		if (!preserveEndpointGeometry) {
			for (let i = 0; i < positions.length; i++) {
				const rp = positions[i];
				const position: [number, number, number] =
					i === index ? [x, y, z] : [rp.posX, rp.posY, rp.posZ];
				if (!SRBXRailBoundary.isBoundary(position, rp.anchorYaw))
					return "endpoint_not_on_block_boundary";
			}
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
		player?: net.minecraft.entity.player.EntityPlayer,
		preserveEndpointGeometry = false,
		restorePoint?: AppleExtendedBuilderPoint,
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
			preserveEndpointGeometry,
			restorePoint,
		);
		if (validation !== "ok") return validation;
		const positions = AppleExtendedRailCompat.getLogicalPositions(core);
		const start = AppleExtendedRailMoveCompat.point(positions[0]);
		const end = AppleExtendedRailMoveCompat.point(positions[1]);
		const moved = index === 0 ? start : end;
		if (preserveEndpointGeometry && restorePoint) {
			moved.direction = restorePoint.direction;
			moved.ownerBlock = restorePoint.ownerBlock;
		}
		moved.position = [x, y, z];
		if (!preserveEndpointGeometry || !restorePoint) delete moved.ownerBlock;
		return AppleExtendedRailMoveCompat.move(
			core,
			this.getRailPositionCandidateKey(core),
			[positions[0].posX, positions[0].posY, positions[0].posZ],
			[positions[1].posX, positions[1].posY, positions[1].posZ],
			start,
			end,
			player,
			preserveEndpointGeometry,
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
		preserveEndpointGeometry = false,
	): string {
		if (!this.hasFreeEndpointPatch()) return "srbxpatch_required";
		return AppleExtendedRailMoveCompat.move(
			core,
			expectedKey,
			originalStart,
			originalEnd,
			start,
			end,
			player,
			preserveEndpointGeometry,
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
		preserveEndpointGeometry = false,
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
			preserveEndpointGeometry,
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
		preserveEndpointGeometry = false,
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
			preserveEndpointGeometry,
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
		preserveEndpointGeometry = false,
	) {
		if (!this.hasFreeEndpointPatch())
			return { status: "srbxpatch_required" };
		void preserveEndpointGeometry;
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
		if (!this.hasFreeEndpointPatch())
			return { status: "srbxpatch_required" };
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
		if (!this.hasFreeEndpointPatch())
			return { status: "srbxpatch_required" };
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
		if (!this.hasFreeEndpointPatch())
			return { status: "srbxpatch_required" };
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
