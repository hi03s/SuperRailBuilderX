import { HashMap } from "java.util";
import { Entity } from "net.minecraft.entity";
import { BezierCurve3D, Pos } from "./lib_BezierCurve3D";
import { RailMap } from "jp.ngt.rtm.rail.util";
import { Vec3 } from "jp.ngt.ngtlib.math";
import { RTMApiCompat } from "@target/assets/minecraft/scripts/lib_hi03toolkit_1_0/lib_RTMApiCompat";

export class BezierCollector {
	private bezierHashMap: HashMap<Entity, BezierCurve3D[]>;
	totalLength: number;

	constructor() {
		this.bezierHashMap = new HashMap();
		this.totalLength = 0;
	}

	add(entity: Entity, bezier: BezierCurve3D): void {
		const list = this.getOrCreateList(entity);
		list.push(bezier);
		this.set(entity, list);
		this.totalLength += bezier.getLength();
	}

	addAll(entity: Entity, bezierList: BezierCurve3D[]): void {
		bezierList.forEach((bezier) => {
			this.add(entity, bezier);
		});
	}

	addFromRailMap(entity: Entity, railMap: RailMap, isReverse: boolean): void {
		const startRP = isReverse ? railMap.getEndRP() : railMap.getStartRP();
		const endRP = isReverse ? railMap.getStartRP() : railMap.getEndRP();
		//ピッチ
		let startAnchorPitch = RTMApiCompat.getRPAnchorPitch(startRP);
		let endAnchorPitch = RTMApiCompat.getRPAnchorPitch(endRP);
		if (
			startAnchorPitch === 0 &&
			endAnchorPitch === 0 &&
			startRP.posY !== endRP.posY
		) {
			const split = Math.floor(railMap.getLength() * 2);
			startAnchorPitch = RTMApiCompat.getRailPitch(railMap, split, 0);
			endAnchorPitch = -startAnchorPitch;
		}
		//始点
		const startAnchorYaw = RTMApiCompat.getHorizontalAnchorYaw(startRP);
		const startAnchorLength =
			RTMApiCompat.getHorizontalAnchorLength(startRP);
		const startAnchorVec = new Vec3(0, 0, startAnchorLength)
			.rotateAroundX(startAnchorPitch)
			.rotateAroundY(startAnchorYaw);
		//終点
		const endAnchorYaw = RTMApiCompat.getHorizontalAnchorYaw(endRP);
		const endAnchorLength = RTMApiCompat.getHorizontalAnchorLength(endRP);
		const endAnchorVec = new Vec3(0, 0, endAnchorLength)
			.rotateAroundX(endAnchorPitch)
			.rotateAroundY(endAnchorYaw);
		//座標
		const startPos: Pos = [startRP.posX, startRP.posY, startRP.posZ];
		const endPos: Pos = [endRP.posX, endRP.posY, endRP.posZ];
		const startAnchorPos: Pos = [
			startRP.posX + startAnchorVec.getX(),
			startRP.posY + startAnchorVec.getY(),
			startRP.posZ + startAnchorVec.getZ(),
		];
		const endAnchorPos: Pos = [
			endRP.posX + endAnchorVec.getX(),
			endRP.posY + endAnchorVec.getY(),
			endRP.posZ + endAnchorVec.getZ(),
		];

		this.add(
			entity,
			new BezierCurve3D(startPos, startAnchorPos, endAnchorPos, endPos),
		);
	}

	createFromPosList(entity: Entity, posList: Pos[]): void {
		function toBlockCenterPosList(pos: Pos): Pos {
			return [pos[0] + 0.5, pos[1] + 0.5, pos[2] + 0.5];
		}
		this.clear(entity);

		//足りないときは消去のみ
		if (posList.length < 2) {
			return;
		}

		//2点は直線のベジェ曲線
		if (posList.length === 2) {
			const sp = toBlockCenterPosList(posList[0]);
			const ep = toBlockCenterPosList(posList[1]);
			const cp = BezierCurve3D.lerpPoint(sp, ep, 0.5);
			this.add(entity, new BezierCurve3D(sp, cp, ep));
			return;
		}

		//3点は1本のベジェ曲線
		if (posList.length === 3) {
			this.add(
				entity,
				new BezierCurve3D(
					toBlockCenterPosList(posList[0]),
					toBlockCenterPosList(posList[1]),
					toBlockCenterPosList(posList[2]),
				),
			);
			return;
		}

		//4点以上は複数のベジェ曲線

		{
			//最初のベジェ曲線
			const sp = toBlockCenterPosList(posList[0]);
			const ep = BezierCurve3D.lerpPoint(
				sp,
				toBlockCenterPosList(posList[1]),
				0.5,
			);
			const cp = BezierCurve3D.lerpPoint(sp, ep, 0.5);
			this.add(entity, new BezierCurve3D(sp, cp, ep));
		}

		//中間のベジェ曲線
		for (let i = 1; i < posList.length - 1; i++) {
			const prevPos = toBlockCenterPosList(posList[i - 1]);
			const currenPos = toBlockCenterPosList(posList[i]);
			const nextPos = toBlockCenterPosList(posList[i + 1]);
			const sp = BezierCurve3D.lerpPoint(prevPos, currenPos, 0.5);
			const ep = BezierCurve3D.lerpPoint(currenPos, nextPos, 0.5);
			this.add(entity, new BezierCurve3D(sp, currenPos, ep));
		}

		{
			//最後のベジェ曲線
			const ep = toBlockCenterPosList(posList[posList.length - 1]);
			const sp = BezierCurve3D.lerpPoint(
				toBlockCenterPosList(posList[posList.length - 2]),
				ep,
				0.5,
			);
			const cp = BezierCurve3D.lerpPoint(sp, ep, 0.5);
			this.add(entity, new BezierCurve3D(sp, cp, ep));
		}
	}

	pop(entity: Entity): BezierCurve3D | null {
		const list = this.getOrCreateList(entity);
		if (list.length === 0) return null;
		const bezier = list.pop();
		if (!bezier) return null;
		this.set(entity, list);
		this.totalLength -= bezier.getLength();
		return bezier;
	}

	shift(entity: Entity): BezierCurve3D | null {
		const list = this.getOrCreateList(entity);
		if (list.length === 0) return null;
		const bezier = list.shift();
		if (!bezier) return null;
		this.set(entity, list);
		this.totalLength -= bezier.getLength();
		return bezier;
	}

	clear(entity: Entity): void {
		this.set(entity, []);
		this.totalLength = 0;
	}

	getAll(entity: Entity): BezierCurve3D[] {
		return this.getOrCreateList(entity);
	}

	getLast(entity: Entity): BezierCurve3D | null {
		const list = this.getOrCreateList(entity);
		if (list.length === 0) return null;
		return list[list.length - 1];
	}

	translateY(entity: Entity, offsetY: number): void {
		if (offsetY === 0) return;
		const list = this.getOrCreateList(entity);
		const translatedList: BezierCurve3D[] = [];
		for (let i = 0; i < list.length; i++) {
			const controlPoints = list[i].getControlPoints();
			for (let j = 0; j < controlPoints.length; j++) {
				controlPoints[j][1] += offsetY;
			}
			translatedList.push(
				new BezierCurve3D(
					controlPoints[0],
					controlPoints[1],
					controlPoints[2],
					controlPoints[3],
				),
			);
		}
		this.set(entity, translatedList);
	}

	size(entity: Entity): number {
		const list = this.getOrCreateList(entity);
		return list.length;
	}

	getCacheKey(entity: Entity, precision: number = 1000): string {
		const list = this.getAll(entity);
		const parts: string[] = [];
		parts.push("BezierCollector");
		for (let i = 0; i < list.length; i++) {
			parts.push(list[i].getCacheKey(precision));
		}
		return parts.join(";");
	}

	private getOrCreateList(entity: Entity): BezierCurve3D[] {
		let list = this.bezierHashMap.get(entity);
		if (!list) {
			list = [];
			this.bezierHashMap.put(entity, list);
		}
		return list;
	}

	private set(entity: Entity, bezierList: BezierCurve3D[]): void {
		this.bezierHashMap.put(entity, bezierList);
	}
}
