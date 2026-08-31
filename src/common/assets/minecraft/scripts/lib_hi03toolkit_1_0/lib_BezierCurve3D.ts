export type Pos = [x: number, y: number, z: number];

export type BezierControlPoints = [p0: Pos, p1: Pos, p2: Pos, p3: Pos];

//###  BezierCurve3D  ###
/**
 * 3次元のベジェ曲線を表すクラス。
 */
export class BezierCurve3D {
	private p0: Pos;
	private p1: Pos;
	private p2: Pos;
	private p3: Pos;

	/**
	 * 3次元のベジェ曲線を初期化する。
	 * 引数は、始点、中間点、終点の3点を指定する方法と、2つの端点と制御点の4点を指定する方法がある
	 * @param arg1 始点
	 * @param arg2 始点の制御点 または 中間点
	 * @param arg3 終点の制御点 または 終点
	 * @param arg4 終点 または なし
	 */
	constructor(arg1: Pos, arg2: Pos, arg3: Pos, arg4?: Pos) {
		if (arg4 === undefined) {
			const startPos = arg1;
			const handlePos = arg2;
			const endPos = arg3;
			this.p0 = startPos;
			this.p1 = BezierCurve3D.lerpPoint(startPos, handlePos, 2 / 3);
			this.p2 = BezierCurve3D.lerpPoint(endPos, handlePos, 2 / 3);
			this.p3 = endPos;
		} else {
			this.p0 = arg1;
			this.p1 = arg2;
			this.p2 = arg3;
			this.p3 = arg4;
		}
	}

	/**
	 * 分割数とインデックスを指定して、曲線上の点を取得する。
	 * @param index 取得する位置のインデックス
	 * @param split 曲線の分割数
	 * @returns 曲線上の座標 [x, y, z]
	 */
	getPoint(split: number, index: number): Pos {
		if (split <= 0) return [this.p0[0], this.p0[1], this.p0[2]];
		index = Math.min(Math.max(index, 0), split);
		const t = index / split;
		const u = 1 - t;
		const point: Pos = [
			u * u * u * this.p0[0] +
				3 * u * u * t * this.p1[0] +
				3 * u * t * t * this.p2[0] +
				t * t * t * this.p3[0],
			u * u * u * this.p0[1] +
				3 * u * u * t * this.p1[1] +
				3 * u * t * t * this.p2[1] +
				t * t * t * this.p3[1],
			u * u * u * this.p0[2] +
				3 * u * u * t * this.p1[2] +
				3 * u * t * t * this.p2[2] +
				t * t * t * this.p3[2],
		];
		return point;
	}

	/**
	 * 分割数とインデックスを指定して、その位置でのヨー角を取得する。
	 * @param index 取得する位置のインデックス
	 * @param split 曲線の分割数
	 * @returns ヨー角（度）
	 */
	getYaw(split: number, index: number): number {
		index = Math.min(Math.max(index, 0), split);
		const point1 =
			index >= split
				? this.getPoint(split, index - 1)
				: this.getPoint(split, index);
		const point2 =
			index >= split
				? this.getPoint(split, index)
				: this.getPoint(split, index + 1);
		const dx = point2[0] - point1[0];
		const dz = point2[2] - point1[2];
		const yaw = Math.atan2(-dx, dz); //Minecraft用のyaw仕様
		return yaw * (180 / Math.PI);
	}

	/**
	 * 分割数とインデックスを指定して、その位置でのピッチ角を取得する。
	 * @param index 取得する位置のインデックス
	 * @param split 曲線の分割数
	 * @returns ピッチ角（度）
	 */
	getPitch(split: number, index: number): number {
		index = Math.min(Math.max(index, 0), split);
		const point1 =
			index >= split
				? this.getPoint(split, index - 1)
				: this.getPoint(split, index);
		const point2 =
			index >= split
				? this.getPoint(split, index)
				: this.getPoint(split, index + 1);
		const dy = point2[1] - point1[1];
		const dx = point2[0] - point1[0];
		const dz = point2[2] - point1[2];
		const distance = Math.sqrt(dx * dx + dz * dz);
		const pitch = Math.atan2(dy, distance);
		return pitch * (180 / Math.PI);
	}

	/**
	 * ベジェ曲線の長さを近似計算で取得する。
	 * @returns 曲線長
	 */
	getLength(): number {
		let dx = this.p3[0] - this.p0[0];
		let dy = this.p3[1] - this.p0[1];
		let dz = this.p3[2] - this.p0[2];
		//始点～終点直線距離の2倍を分割精度とする
		const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
		const split = Math.max(16, Math.ceil(distance * 2));
		if (split <= 0) return 0;
		let length = 0;
		let previousPoint = this.getPoint(split, 0);
		for (let i = 1; i <= split; i++) {
			const currentPoint = this.getPoint(split, i);
			dx = currentPoint[0] - previousPoint[0];
			dy = currentPoint[1] - previousPoint[1];
			dz = currentPoint[2] - previousPoint[2];
			const segmentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
			length += segmentLength;
			previousPoint = currentPoint;
		}
		return length;
	}

	/**
	 * 旧NGTO Builderと同じ分割精度で曲線長を近似する。
	 * 従来式補間のサンプル数を旧版へ合わせるために使用する。
	 */
	getClassicLength(): number {
		let dx = this.p3[0] - this.p0[0];
		let dy = this.p3[1] - this.p0[1];
		let dz = this.p3[2] - this.p0[2];
		const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
		const split = Math.ceil(distance * 2);
		if (split <= 0) return 0;
		let length = 0;
		let previousPoint = this.getPoint(split, 0);
		for (let i = 1; i <= split; i++) {
			const currentPoint = this.getPoint(split, i);
			dx = currentPoint[0] - previousPoint[0];
			dy = currentPoint[1] - previousPoint[1];
			dz = currentPoint[2] - previousPoint[2];
			length += Math.sqrt(dx * dx + dy * dy + dz * dz);
			previousPoint = currentPoint;
		}
		return length;
	}

	/**
	 * 始点アンカー長を取得する。
	 * @returns p0 から p1 までの距離
	 */
	getStartAnchorLength(): number {
		const dx = this.p1[0] - this.p0[0];
		const dy = this.p1[1] - this.p0[1];
		const dz = this.p1[2] - this.p0[2];
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	getControlPoints(): BezierControlPoints {
		return [
			[this.p0[0], this.p0[1], this.p0[2]],
			[this.p1[0], this.p1[1], this.p1[2]],
			[this.p2[0], this.p2[1], this.p2[2]],
			[this.p3[0], this.p3[1], this.p3[2]],
		];
	}

	getCacheKey(precision: number = 1000): string {
		const posData = this.getControlPoints();
		const parts: string[] = [];
		for (let i = 0; i < posData.length; i++) {
			const pos = posData[i];
			parts.push(
				Math.round(pos[0] * precision) +
					"," +
					Math.round(pos[1] * precision) +
					"," +
					Math.round(pos[2] * precision),
			);
		}
		return parts.join("|");
	}

	static lerpPoint(pos1: Pos, pos2: Pos, ratio: number): Pos {
		return [
			pos1[0] + (pos2[0] - pos1[0]) * ratio,
			pos1[1] + (pos2[1] - pos1[1]) * ratio,
			pos1[2] + (pos2[2] - pos1[2]) * ratio,
		];
	}
}
