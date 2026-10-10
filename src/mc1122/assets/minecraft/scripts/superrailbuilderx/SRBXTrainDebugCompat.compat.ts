import { EntityTrainBase } from "jp.ngt.rtm.entity.train";
import { SRBXTrainDebugFields } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXTrainDebugFields";

export class SRBXTrainDebugCompat {
	static readonly target = "mc1122";
	static read(
		train: EntityTrainBase,
		index: number,
	): {
		bogie: jp.ngt.rtm.entity.train.EntityBogie;
		core: jp.ngt.rtm.rail.TileEntityLargeRailCore;
		map: jp.ngt.rtm.rail.util.RailMap;
		split: number;
		positionIndex: number;
		roll: number;
	} | null {
		void train;
		void index;
		void SRBXTrainDebugFields;
		return null; // Internal fields are only validated for KaizPatchX/AE.
	}
}
