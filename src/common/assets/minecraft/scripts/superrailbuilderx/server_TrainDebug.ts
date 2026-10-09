import { NGTLog } from "jp.ngt.ngtlib.io";
import { WeakHashMap } from "java.util";
import { EntityTrainBase } from "jp.ngt.rtm.entity.train";
import { TileEntityLargeRailBase } from "jp.ngt.rtm.rail";
import { RailMap } from "jp.ngt.rtm.rail.util";
import { SRBXApiCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";
import { SRBXTrainDebugCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXTrainDebugCompat";
import { SRBXTrainDebugRecorder } from "./SRBXTrainDebugRecorder";

const states = new WeakHashMap<EntityTrainBase, SRBXTrainDebugRecorder>();
const errors = new WeakHashMap<EntityTrainBase, number>();
const PREFIX = "[SuperRailBuilderX train-debug]";
function numbers(values: ArrayLike<number>): string {
	const result: string[] = [];
	for (let i = 0; i < values.length; i++)
		result.push(Number(values[i]).toFixed(5));
	return result.join(",");
}
function mapDescription(map: RailMap): string {
	if (!map) return "none";
	const start = map.getStartRP(),
		end = map.getEndRP();
	return (
		String(
			(map as unknown as { getClass(): java.lang.Class<unknown> })
				.getClass()
				.getSimpleName(),
		) +
		":" +
		numbers([start.posX, start.posY, start.posZ]) +
		">" +
		numbers([end.posX, end.posY, end.posZ]) +
		":length=" +
		map.getLength().toFixed(5) +
		":cant=" +
		numbers([
			SRBXApiCompat.getRailPositionCantEdge(start),
			SRBXApiCompat.getRailPositionCantEdge(end),
		])
	);
}
function roadbeds(
	world: net.minecraft.world.World,
	pos: number[],
	radius: number,
): string {
	const found: string[] = [];
	for (let dx = -radius; dx <= radius; dx++)
		for (let dz = -radius; dz <= radius; dz++)
			for (let dy = -1; dy <= 1; dy++) {
				const cell = [
					Math.floor(pos[0]) + dx,
					Math.floor(pos[1]) + dy,
					Math.floor(pos[2]) + dz,
				];
				const tile = SRBXApiCompat.getTileEntity(
					world,
					cell[0],
					cell[1],
					cell[2],
				);
				if (!(tile instanceof TileEntityLargeRailBase)) continue;
				const owner = tile.getStartPoint();
				const core = tile.getRailCore();
				found.push(
					cell.join(",") +
						":owner=" +
						(owner
							? owner[0] + "," + owner[1] + "," + owner[2]
							: "none") +
						":core=" +
						(core
							? SRBXApiCompat.getRailPositionCandidateKey(core)
							: "missing"),
				);
			}
	return found.length ? found.join(";") : "none";
}
/** Server only, before formation movement. All vehicle/world state remains untouched. */
function onUpdate(train: EntityTrainBase): void {
	const world = SRBXApiCompat.getWorld(train);
	if (!world || world.isRemote) return;
	const tick = train.ticksExisted;
	try {
		let state = states.get(train);
		if (!state) {
			state = new SRBXTrainDebugRecorder();
			states.put(train, state);
		}
		const position = [train.posX, train.posY, train.posZ];
		const speed = train.getSpeed(),
			notch = train.getNotch(),
			direction = train.getTrainDirection();
		const snapshots: string[] = [],
			keys: string[] = [],
			bogiePositions: Array<{ index: number; position: number[] }> = [];
		for (let i = 0; i < 2; i++) {
			const snapshot = SRBXTrainDebugCompat.read(train, i);
			if (!snapshot) {
				snapshots.push("b" + i + "=missing");
				keys.push("missing");
				continue;
			}
			const bogie = snapshot.bogie;
			const pos = [bogie.posX, bogie.posY, bogie.posZ];
			bogiePositions.push({ index: i, position: pos });
			const core = snapshot.core
				? SRBXApiCompat.getRailPositionCandidateKey(snapshot.core)
				: "none";
			const physicalCore = snapshot.core
				? SRBXApiCompat.getRailCorePos(snapshot.core).join(",")
				: "none";
			const map = mapDescription(snapshot.map),
				bed = roadbeds(world, pos, 0);
			keys.push(
				physicalCore +
					"/" +
					map +
					"/" +
					bed.replace(/-?\d+,-?\d+,-?\d+:owner=/g, "owner="),
			);
			const buf = bogie.getPosBuf();
			snapshots.push(
				"b" +
					i +
					"={id=" +
					bogie.getEntityId() +
					",pos=" +
					numbers(pos) +
					",buf=" +
					numbers([buf[0], buf[1], buf[2]]) +
					",core=" +
					physicalCore +
					",logical=" +
					core +
					",map=" +
					map +
					",index=" +
					snapshot.positionIndex +
					"/" +
					snapshot.split +
					",roll=" +
					snapshot.roll +
					",bed=" +
					bed +
					"}",
			);
		}
		const text =
			"target=" +
			SRBXTrainDebugCompat.target +
			",id=" +
			train.getEntityId() +
			",tick=" +
			tick +
			",phase=before-movement,speed_mpt=" +
			speed.toFixed(6) +
			",kmh_20tps=" +
			(speed * 72).toFixed(3) +
			",notch=" +
			notch +
			",direction=" +
			direction +
			",pos=" +
			numbers(position) +
			"," +
			snapshots.join(",");
		const event = state.record({
			tick,
			key: direction + "/" + notch + "/" + keys.join("|"),
			speed,
			notch,
			position,
			text,
		});
		if (event) {
			for (let i = 0; i < event.context.length; i++)
				NGTLog.debug(PREFIX + " context " + event.context[i]);
			NGTLog.debug(PREFIX + " " + event.reason + " " + text);
			for (let i = 0; i < bogiePositions.length; i++)
				NGTLog.debug(
					PREFIX +
						" nearby id=" +
						train.getEntityId() +
						",tick=" +
						tick +
						",b=" +
						bogiePositions[i].index +
						",beds=" +
						roadbeds(world, bogiePositions[i].position, 1),
				);
		}
	} catch (error) {
		const previous = errors.get(train);
		if (
			previous === null ||
			previous === undefined ||
			tick - previous >= 100
		) {
			errors.put(train, tick);
			const detail = String((error as Error).message || "");
			const field = detail.match(
				/^(?:missing diagnostic field|diagnostic field unavailable): ([\w.$:]+)$/,
			);
			NGTLog.debug(
				PREFIX +
					" observation unavailable: target=" +
					SRBXTrainDebugCompat.target +
					",id=" +
					train.getEntityId() +
					",tick=" +
					tick +
					",field=" +
					(field ? field[1] : "snapshot API") +
					" (vehicle movement is unchanged)",
			);
		}
	}
}
