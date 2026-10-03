import { RailPosition } from "jp.ngt.rtm.rail.util";
import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { TileEntityLargeRailSectionCore } from "jp.apple.rail";

/**
 * Compile-only smoke sample for AppleExtended's free RailPosition API.
 * This file has no RTM entry points and therefore does not run in game.
 */
export function verifyAppleExtendedRailPositionApi(
	position: RailPosition,
	x: number,
	y: number,
	z: number,
): [number, number, number] {
	position.setPosition(x, y, z);
	return [position.offsetX, position.offsetY, position.offsetZ];
}

/** Compile-only check for the logical-rail API added after the initial target. */
export function verifyAppleExtendedLogicalRailApi(
	core: TileEntityLargeRailCore,
): number {
	const positions = core.getLogicalRailPositions();
	core.isLogicalRailOccupied();
	if (core instanceof TileEntityLargeRailSectionCore && core.isRailSection())
		core.getRailGroupCorePositions();
	return positions.length;
}
