import { EntityTrainBase } from "jp.ngt.rtm.entity.train";
import { SRBXTrainDebugFields } from "@common/assets/minecraft/scripts/superrailbuilderx/SRBXTrainDebugFields";

export class SRBXTrainDebugCompat {
	static readonly target = "kaizpatch";
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
		// Avoid getBogie(): it may create/setup a missing bogie. Never write fields.
		const bogies = SRBXTrainDebugFields.read(
			train.bogieController,
			"bogies",
		);
		const bogie = (bogies &&
			bogies[index]) as jp.ngt.rtm.entity.train.EntityBogie;
		if (!bogie) return null;
		return {
			bogie,
			roll: bogie.rotationRoll,
			core: SRBXTrainDebugFields.read(bogie, "currentRailObj"),
			map: SRBXTrainDebugFields.read(bogie, "currentRailMap"),
			split: Number(SRBXTrainDebugFields.read(bogie, "split")),
			positionIndex: Number(
				SRBXTrainDebugFields.read(bogie, "prevPosIndex"),
			),
		};
	}
}
