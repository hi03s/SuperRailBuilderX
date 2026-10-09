import { EntityTrainBase, EntityBogie } from "jp.ngt.rtm.entity.train";
import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { RailMap } from "jp.ngt.rtm.rail.util";
export declare class SRBXTrainDebugCompat {
	static readonly target: string;
	static read(
		train: EntityTrainBase,
		index: number,
	): {
		bogie: EntityBogie;
		core: TileEntityLargeRailCore;
		map: RailMap;
		split: number;
		positionIndex: number;
		roll: number;
	} | null;
}
