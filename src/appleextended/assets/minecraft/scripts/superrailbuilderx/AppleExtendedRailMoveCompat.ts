import { SRBXFreeEndpointPolicy as SRBXRailBoundary } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXFreeEndpointPolicy";
import {
	TileEntityLargeRailCore,
	TileEntityLargeRailSwitchCore,
} from "jp.ngt.rtm.rail";
import { ItemRail } from "jp.ngt.rtm.item";
import { ResourceStateRail } from "jp.ngt.rtm.modelpack.state";
import { RailMaker, RailMapBasic, RailPosition } from "jp.ngt.rtm.rail.util";
import { ArrayList } from "java.util";
import { EntityPlayer } from "net.minecraft.entity.player";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { BlockPos } from "net.minecraft.util.math";
import {
	AppleExtendedBuilderPoint,
	AppleExtendedRailCompat,
} from "./AppleExtendedRailCompat";

type Position = [number, number, number];

/** Relocate AE rails by rebuilding the whole logical rail, never one section. */
export class AppleExtendedRailMoveCompat {
	private static updated: Position[] = [];

	static consumeUpdated(): Position[] {
		const result = this.updated;
		this.updated = [];
		return result;
	}

	private static matches(rp: RailPosition, position: Position): boolean {
		return (
			!!position &&
			position.length === 3 &&
			isFinite(position[0]) &&
			isFinite(position[1]) &&
			isFinite(position[2]) &&
			Math.abs(rp.posX - position[0]) <= 0.001 &&
			Math.abs(rp.posY - position[1]) <= 0.001 &&
			Math.abs(rp.posZ - position[2]) <= 0.001
		);
	}

	private static validPoint(point: AppleExtendedBuilderPoint): boolean {
		if (
			!point ||
			(point.kind !== "free" && point.kind !== "rail") ||
			!point.position ||
			point.position.length !== 3
		)
			return false;
		const values = point.position.concat([
			point.anchorYaw,
			point.anchorPitch,
			point.anchorLength,
			point.anchorLengthVertical === undefined
				? point.anchorLength
				: point.anchorLengthVertical,
		]);
		for (let i = 0; i < values.length; i++)
			if (!isFinite(values[i])) return false;
		return (
			point.anchorLength >= 0 &&
			Math.abs(point.anchorPitch) < 90 &&
			(point.anchorLengthVertical === undefined ||
				point.anchorLengthVertical >= 0) &&
			(point.kind !== "rail" ||
				(!!point.core &&
					point.index !== undefined &&
					Math.floor(point.index) === point.index))
		);
	}

	private static cloneProperty(
		property: ResourceStateRail,
	): ResourceStateRail {
		const copy = ItemRail.getDefaultProperty();
		copy.readFromNBT(property.writeToNBT());
		return copy;
	}

	static point(rp: RailPosition): AppleExtendedBuilderPoint {
		return {
			kind: "free",
			position: [rp.posX, rp.posY, rp.posZ],
			direction: rp.direction,
			anchorYaw: rp.anchorYaw,
			anchorPitch: rp.anchorPitch,
			anchorLength: rp.anchorLengthHorizontal,
			anchorLengthVertical: rp.anchorLengthVertical,
			markerPosition: [rp.blockX, rp.blockY, rp.blockZ],
			ownerBlock: [rp.blockX, rp.blockY, rp.blockZ],
			cantEdge: rp.cantEdge,
			cantCenter: rp.cantCenter,
			cantRandom: rp.cantRandom,
		};
	}

	static move(
		core: TileEntityLargeRailCore,
		expectedKey: string,
		originalStart: Position,
		originalEnd: Position,
		start: AppleExtendedBuilderPoint,
		end: AppleExtendedBuilderPoint,
		player?: EntityPlayer,
		preserveEndpointGeometry = false,
		switchEndpoint?: { index: number; point: AppleExtendedBuilderPoint },
	): string {
		this.updated = [];
		if (!player) return "missing_player";
		const isSwitch = core instanceof TileEntityLargeRailSwitchCore;
		// A switch may be rebuilt only for one explicit endpoint operation.
		// The ordinary two-point API must continue rejecting whole-switch moves.
		if (
			!core ||
			(isSwitch && !switchEndpoint) ||
			(!isSwitch && switchEndpoint)
		)
			return "unsupported";
		if (AppleExtendedRailCompat.coreKey(core) !== expectedKey)
			return "rail_changed";
		const world = core.getWorld();
		const pos = core.getPos();
		if (
			AppleExtendedRailCompat.getCore(world, [
				pos.getX(),
				pos.getY(),
				pos.getZ(),
			]) !== core
		)
			return "rail_not_found";
		if (core.isLogicalRailOccupied()) return "occupied";
		const positions = AppleExtendedRailCompat.getLogicalPositions(core);
		if (
			!positions ||
			(isSwitch ? positions.length < 3 : positions.length !== 2) ||
			!positions[0] ||
			!positions[1]
		)
			return "invalid_positions";
		if (
			!this.matches(positions[0], originalStart) ||
			!this.matches(positions[1], originalEnd)
		)
			return "rail_changed";
		if (
			!this.validPoint(start) ||
			!this.validPoint(end) ||
			(switchEndpoint &&
				(!this.validPoint(switchEndpoint.point) ||
					Math.floor(switchEndpoint.index) !== switchEndpoint.index ||
					switchEndpoint.index < 0 ||
					switchEndpoint.index >= positions.length))
		)
			return "invalid_point";
		if (
			!preserveEndpointGeometry &&
			(!SRBXRailBoundary.isBoundary(start.position, start.anchorYaw) ||
				!SRBXRailBoundary.isBoundary(end.position, end.anchorYaw))
		)
			return "endpoint_not_on_block_boundary";
		const distance = Math.sqrt(
			Math.pow(start.position[0] - end.position[0], 2) +
				Math.pow(start.position[1] - end.position[1], 2) +
				Math.pow(start.position[2] - end.position[2], 2),
		);
		if (!isSwitch && distance < 0.01) return "rail_too_short";
		if (
			!isSwitch &&
			(start.anchorLength > Math.max(1, distance * 4) ||
				end.anchorLength > Math.max(1, distance * 4))
		)
			return "invalid_anchor_length";
		// Require every group member to be loaded before deleting the source group.
		if (AppleExtendedRailCompat.isSectionCore(core)) {
			const members = core.getRailGroupCorePositions();
			if (!members || members.size() === 0) return "invalid_positions";
			for (let i = 0; i < members.size(); i++) {
				const member = members.get(i);
				if (
					!world.isBlockLoaded(
						new BlockPos(member[0], member[1], member[2]),
					)
				)
					return "unloaded_rail";
				const loadedCore = AppleExtendedRailCompat.getCore(world, [
					member[0],
					member[1],
					member[2],
				]);
				if (
					!loadedCore ||
					AppleExtendedRailCompat.coreKey(loadedCore) !== expectedKey
				)
					return "rail_changed";
			}
		}
		let moved = [
			AppleExtendedRailCompat.resolveBuilderPoint(
				world,
				start,
				preserveEndpointGeometry,
			),
			AppleExtendedRailCompat.resolveBuilderPoint(
				world,
				end,
				preserveEndpointGeometry,
			),
		];
		if (switchEndpoint) {
			const selected = AppleExtendedRailCompat.resolveBuilderPoint(
				world,
				switchEndpoint.point,
				preserveEndpointGeometry,
			);
			if (!selected) return "rail_endpoint_changed";
			moved = [];
			for (let i = 0; i < positions.length; i++)
				moved.push(
					AppleExtendedRailCompat.cloneRailPosition(positions[i]),
				);
			// switchType is a final Java field. Rebuild from NBT with the original
			// role instead of assigning it (which leaves a moved root as type 0).
			const selectedNbt = selected.writeToNBT();
			selectedNbt.setByte(
				"SwitchType",
				positions[switchEndpoint.index].switchType,
			);
			moved[switchEndpoint.index] = RailPosition.readFromNBT(selectedNbt);
		}
		if (!moved[0] || !moved[1]) return "rail_endpoint_changed";
		if (
			!preserveEndpointGeometry &&
			!AppleExtendedRailCompat.areBoundaryPositions(moved)
		)
			return "endpoint_not_on_block_boundary";
		for (let i = 0; i < moved.length; i++) {
			const rp = moved[i];
			if (
				!world.isBlockLoaded(
					new BlockPos(rp.blockX, rp.blockY, rp.blockZ),
				)
			)
				return "unloaded_rail";
		}

		const original: RailPosition[] = [];
		for (let i = 0; i < positions.length; i++)
			original.push(
				AppleExtendedRailCompat.cloneRailPosition(positions[i]),
			);
		const property = this.cloneProperty(core.getResourceState());
		if (isSwitch) {
			const rejectSwitch = (stage: string, error?: unknown): string => {
				NGTLog.debug(
					`[SuperRailBuilderX AE move] switch validation failed: stage=${stage}, key=${expectedKey}, index=${switchEndpoint.index}, positions=${moved.map((rp) => `owner=${rp.blockX},${rp.blockY},${rp.blockZ},pos=${rp.posX},${rp.posY},${rp.posZ},role=${rp.switchType},yaw=${rp.anchorYaw}`).join(";")}, error=${error === undefined ? "none" : String(error)}`,
				);
				return "invalid_switch";
			};
			try {
				const list = new ArrayList<RailPosition>();
				for (const rp of moved) list.add(rp);
				const railSwitch = new RailMaker(
					world,
					list,
					RailMapBasic.fixRTMRailMapVersionCurrent,
				).getSwitch();
				if (!railSwitch) return rejectSwitch("layout");
				const maps = railSwitch.getAllRailMap();
				if (!maps || maps.length === 0) return rejectSwitch("maps");
				// Validate the entire switch footprint before removing any source tile.
				for (let i = 0; i < maps.length; i++) {
					const blocks = maps[i].getRailBlockList(property, true);
					for (let j = 0; j < blocks.size(); j++) {
						const b = blocks.get(j);
						if (
							!world.isBlockLoaded(new BlockPos(b[0], b[1], b[2]))
						)
							return "path_unloaded";
					}
				}
			} catch (error) {
				return rejectSwitch("exception", error);
			}
		}
		// An endpoint may share another rail's roadbed without owning its core.
		// Use the actual creation plan and ignore only the group we will remove.
		if (
			!AppleExtendedRailCompat.planCreation(
				world,
				moved,
				property,
				expectedKey,
			)
		) {
			NGTLog.debug(
				`[SuperRailBuilderX AE move] placement blocked before removal: key=${expectedKey}`,
			);
			return "rail_overlap";
		}
		const signal = core.getSignal();
		const subRails: ResourceStateRail[] = [];
		for (let i = 0; i < core.subRails.size(); i++)
			subRails.push(this.cloneProperty(core.subRails.get(i)));
		const applyState = (created: {
			core: Position;
			key: string;
		}): boolean => {
			const replacement = AppleExtendedRailCompat.getCore(
				world,
				created.core,
			);
			if (
				!replacement ||
				AppleExtendedRailCompat.coreKey(replacement) !== created.key
			)
				return false;
			const members: TileEntityLargeRailCore[] = [replacement];
			if (AppleExtendedRailCompat.isSectionCore(replacement)) {
				const memberPositions = replacement.getRailGroupCorePositions();
				if (!memberPositions || memberPositions.size() === 0)
					return false;
				for (let i = 0; i < memberPositions.size(); i++) {
					const position = memberPositions.get(i);
					const member = AppleExtendedRailCompat.getCore(world, [
						position[0],
						position[1],
						position[2],
					]);
					if (
						!member ||
						AppleExtendedRailCompat.coreKey(member) !== created.key
					)
						return false;
					if (member !== replacement) members.push(member);
				}
			}
			for (let i = 0; i < members.length; i++) {
				const member = members[i];
				member.setSignal(signal);
				for (let j = 0; j < subRails.length; j++)
					member.addSubRail(this.cloneProperty(subRails[j]));
				member.markDirty();
				member.sendPacket();
				const memberPos = member.getPos();
				this.updated.push([
					memberPos.getX(),
					memberPos.getY(),
					memberPos.getZ(),
				]);
			}
			return true;
		};
		let created: { core: Position; key: string } | null = null;
		try {
			AppleExtendedRailCompat.breakRail(world, core);
			created = AppleExtendedRailCompat.createFromPositions(
				world,
				player,
				moved,
				property,
			);
			if (created && applyState(created)) {
				NGTLog.debug(
					`[SuperRailBuilderX AE move] logical rail rebuilt: oldKey=${expectedKey}, newKey=${created.key}, cores=${this.updated.length}`,
				);
				return "ok";
			}
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX AE move] rebuild failed: ${error}`,
			);
		}
		this.updated = [];
		try {
			const surviving = AppleExtendedRailCompat.getCore(world, [
				pos.getX(),
				pos.getY(),
				pos.getZ(),
			]);
			if (!created && surviving === core) {
				NGTLog.debug(
					"[SuperRailBuilderX AE move] source rail still present after rebuild exception",
				);
				return "move_failed_rolled_back";
			}
			if (created) {
				const replacement = AppleExtendedRailCompat.getCore(
					world,
					created.core,
				);
				if (
					replacement &&
					AppleExtendedRailCompat.coreKey(replacement) === created.key
				)
					AppleExtendedRailCompat.breakRail(world, replacement);
			}
			const restored = AppleExtendedRailCompat.createFromPositions(
				world,
				player,
				original,
				property,
			);
			if (restored && applyState(restored)) {
				NGTLog.debug(
					"[SuperRailBuilderX AE move] rebuild failed, original logical rail restored",
				);
				return "move_failed_rolled_back";
			}
		} catch (error) {
			NGTLog.debug(
				`[SuperRailBuilderX AE move] rollback failed: ${error}`,
			);
		}
		NGTLog.debug(
			"[SuperRailBuilderX AE move] original logical rail could not be restored",
		);
		return "move_failed_rollback_failed";
	}
}
