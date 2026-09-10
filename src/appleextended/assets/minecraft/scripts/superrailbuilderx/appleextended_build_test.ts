import { RailPosition } from "jp.ngt.rtm.rail.util";

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
