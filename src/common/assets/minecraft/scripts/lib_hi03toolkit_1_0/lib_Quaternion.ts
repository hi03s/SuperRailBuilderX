import { Vec3 } from "jp.ngt.ngtlib.math";

export type EulerAngles = {
	/** Y軸周りの回転角度[deg] */
	yaw: number;
	/** X軸周りの回転角度[deg] */
	pitch: number;
	/** Z軸周りの回転角度[deg] */
	roll: number;
};

//###  Quaternion  ###
/**
 *  クォータニオンを扱うオブジェクト
 *
 *  回転軸の定義:
 *  - yaw   : Y軸周りの回転
 *  - pitch : X軸周りの回転
 *  - roll  : Z軸周りの回転
 *
 *  fromEuler / toEuler の回転順は yaw(Y) -> pitch(X) -> roll(Z)。
 */
export class Quaternion {
	constructor(
		public w: number = 1,
		public x: number = 0,
		public y: number = 0,
		public z: number = 0,
	) {}

	/**
	 * ハッシュを返す
	 * @returns
	 */
	getHash(): string {
		return `${this.w}_${this.x}_${this.y}_${this.z}`;
	}

	/**
	 * クォータニオンを正規化して自身を更新する
	 * @returns
	 */
	normalizeSelf(): Quaternion {
		const length = Math.sqrt(
			this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z,
		);
		if (length === 0) {
			this.w = 1;
			this.x = this.y = this.z = 0;
			return this;
		}
		this.w /= length;
		this.x /= length;
		this.y /= length;
		this.z /= length;
		return this;
	}

	/**
	 * クォータニオンを正規化する
	 */
	normalize(): Quaternion {
		const length = Math.sqrt(
			this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z,
		);
		if (length === 0) return new Quaternion(1, 0, 0, 0);
		return new Quaternion(
			this.w / length,
			this.x / length,
			this.y / length,
			this.z / length,
		);
	}

	/**
	 * クォータニオン同士を掛ける
	 */
	multiply(q: Quaternion): Quaternion {
		const w = this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z;
		const x = this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y;
		const y = this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x;
		const z = this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w;
		return new Quaternion(w, x, y, z);
	}

	/**
	 * クォータニオンの共役を求める
	 */
	conjugate(): Quaternion {
		return new Quaternion(this.w, -this.x, -this.y, -this.z);
	}

	/**
	 * クォータニオンでベクトルを回転させる(座標回転向け)
	 * @param vec 回転前のベクトル
	 * @returns 回転後のベクトル
	 */
	rotateVector(vec: Vec3): Vec3 {
		const qVec = new Quaternion(0, vec.getX(), vec.getY(), vec.getZ());
		const qConj = this.conjugate();
		const result = this.multiply(qVec).multiply(qConj);
		return new Vec3(result.x, result.y, result.z);
	}

	/**
	 * クォータニオンからYaw角を抽出する(度数)
	 * @returns Yaw角、つまりY軸周りの回転角度[deg]
	 */
	extractYaw(): number {
		// 精度と割り当てを抑えるため、直接計算して角度を返す（[deg]）
		const length = Math.sqrt(
			this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z,
		);
		let w = this.w,
			x = this.x,
			y = this.y,
			z = this.z;
		if (length !== 0) {
			w /= length;
			x /= length;
			y /= length;
			z /= length;
		}
		const m02 = 2 * (x * z + w * y);
		const m22 = 1 - 2 * (x * x + y * y);
		const yawRad = Math.atan2(m02, m22);
		return Quaternion.radToDeg(yawRad);
	}

	/**
	 * Yaw を stepDeg に丸める差分回転を適用して返す。
	 * @param q 対象クォータニオン
	 * @param stepDeg スナップ角度[deg]
	 * @param useWorldAxis true=ワールド軸(前乗算)、false=ローカル軸(後乗算)
	 */
	static snapYawDelta(
		q: Quaternion,
		stepDeg: number,
		useWorldAxis: boolean,
	): Quaternion {
		if (stepDeg === 0) return q;
		const currentYaw = q.extractYaw();
		const snapped = Math.round(currentYaw / stepDeg) * stepDeg;
		let delta = snapped - currentYaw;
		// delta を -180..180 の範囲に収める
		delta = ((delta + 180) % 360) - 180;
		if (Math.abs(delta) < 1e-6) return q;
		const rot = Quaternion.fromAxisAngle(0, 1, 0, delta);
		const result = useWorldAxis ? rot.multiply(q) : q.multiply(rot);
		return result.normalizeSelf();
	}

	/**
	 * Pitch を stepDeg に丸める差分回転を適用して返す。
	 * @param q 対象クォータニオン
	 * @param stepDeg スナップ角度[deg]
	 * @param useWorldAxis true=ワールド軸(前乗算)、false=ローカル軸(後乗算)
	 */
	static snapPitchDelta(
		q: Quaternion,
		stepDeg: number,
		useWorldAxis: boolean,
	): Quaternion {
		if (stepDeg === 0) return q;
		const e = q.toEuler();
		const current = e.pitch;
		const snapped = Math.round(current / stepDeg) * stepDeg;
		let delta = snapped - current;
		delta = ((delta + 180) % 360) - 180;
		if (Math.abs(delta) < 1e-6) return q;
		const rot = Quaternion.fromAxisAngle(1, 0, 0, delta);
		const result = useWorldAxis ? rot.multiply(q) : q.multiply(rot);
		return result.normalizeSelf();
	}

	/**
	 * Roll を stepDeg に丸める差分回転を適用して返す。
	 * @param q 対象クォータニオン
	 * @param stepDeg スナップ角度[deg]
	 * @param useWorldAxis true=ワールド軸(前乗算)、false=ローカル軸(後乗算)
	 */
	static snapRollDelta(
		q: Quaternion,
		stepDeg: number,
		useWorldAxis: boolean,
	): Quaternion {
		if (stepDeg === 0) return q;
		const e = q.toEuler();
		const current = e.roll;
		const snapped = Math.round(current / stepDeg) * stepDeg;
		let delta = snapped - current;
		delta = ((delta + 180) % 360) - 180;
		if (Math.abs(delta) < 1e-6) return q;
		const rot = Quaternion.fromAxisAngle(0, 0, 1, delta);
		const result = useWorldAxis ? rot.multiply(q) : q.multiply(rot);
		return result.normalizeSelf();
	}

	/**
	 * クォータニオンからEuler角(yaw, pitch, roll)を抽出する
	 *
	 * 回転軸:
	 * - yaw   : Y軸周りの回転[deg]
	 * - pitch : X軸周りの回転[deg]
	 * - roll  : Z軸周りの回転[deg]
	 *
	 * 回転順は fromEuler と同じ yaw(Y) -> pitch(X) -> roll(Z)。
	 * pitchが±90度付近ではyaw/rollの分離が不安定になる点に注意。
	 */
	toEuler(): EulerAngles {
		const q = this.normalizeSelf();

		const w = q.w;
		const x = q.x;
		const y = q.y;
		const z = q.z;

		// Quaternion -> rotation matrix
		// yaw(Y) -> pitch(X) -> roll(Z) の逆変換に使う要素だけ計算する。
		const m02 = 2 * (x * z + w * y);
		const m12 = 2 * (y * z - w * x);
		const m22 = 1 - 2 * (x * x + y * y);

		const m10 = 2 * (x * y + w * z);
		const m11 = 1 - 2 * (x * x + z * z);

		const pitchRad = Math.asin(Quaternion.clamp(-m12, -1, 1));
		const yawRad = Math.atan2(m02, m22);
		const rollRad = Math.atan2(m10, m11);

		return {
			yaw: Quaternion.radToDeg(yawRad),
			pitch: Quaternion.radToDeg(pitchRad),
			roll: Quaternion.radToDeg(rollRad),
		};
	}

	/**
	 * Euler角を指定角度単位に丸めたクォータニオンを返す
	 * @param stepDeg スナップ角度[deg]
	 */
	snapEuler(stepDeg: number): Quaternion {
		return this.snapEulerEach(stepDeg, stepDeg, stepDeg);
	}

	/**
	 * Euler角を軸ごとの指定角度単位に丸めたクォータニオンを返す
	 * @param yawStepDeg yawのスナップ角度[deg]
	 * @param pitchStepDeg pitchのスナップ角度[deg]
	 * @param rollStepDeg rollのスナップ角度[deg]
	 */
	snapEulerEach(
		yawStepDeg: number,
		pitchStepDeg: number,
		rollStepDeg: number,
	): Quaternion {
		const euler = this.toEuler();

		return Quaternion.fromEuler(
			Quaternion.snapDeg(euler.yaw, yawStepDeg),
			Quaternion.snapDeg(euler.pitch, pitchStepDeg),
			Quaternion.snapDeg(euler.roll, rollStepDeg),
		);
	}

	/**
	 * クォータニオンが90度の角度を取っているか判定する
	 */
	isRightAngleRotation(): boolean {
		const e = this.toEuler();
		const EPS = 1e-5;
		function near90(v: number): boolean {
			return Math.abs(v - Math.round(v / 90) * 90) < EPS;
		}
		return near90(e.yaw) && near90(e.pitch) && near90(e.roll);
	}

	/**
	 * 指定軸周りの回転からクォータニオンを作成する
	 * @param axisX 回転軸X成分
	 * @param axisY 回転軸Y成分
	 * @param axisZ 回転軸Z成分
	 * @param angleDeg 回転角度[deg]
	 */
	static fromAxisAngle(
		axisX: number,
		axisY: number,
		axisZ: number,
		angleDeg: number,
	): Quaternion {
		const axisLength = Math.sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ);

		if (axisLength === 0) {
			return new Quaternion(1, 0, 0, 0);
		}

		const nx = axisX / axisLength;
		const ny = axisY / axisLength;
		const nz = axisZ / axisLength;

		const halfRad = Quaternion.degToRad(angleDeg) * 0.5;
		const s = Math.sin(halfRad);

		return new Quaternion(
			Math.cos(halfRad),
			nx * s,
			ny * s,
			nz * s,
		).normalizeSelf();
	}

	/**
	 * Euler角(yaw, pitch, roll)からクォータニオンを作成する
	 *
	 * 回転軸:
	 * - yaw   : Y軸周りの回転[deg]
	 * - pitch : X軸周りの回転[deg]
	 * - roll  : Z軸周りの回転[deg]
	 *
	 * 回転順は yaw(Y) -> pitch(X) -> roll(Z)。
	 * @param yaw Y軸周りの回転[deg]
	 * @param pitch X軸周りの回転[deg]
	 * @param roll Z軸周りの回転[deg]
	 * @returns 合成されたクォータニオン
	 */
	static fromEuler(yaw: number, pitch: number, roll: number): Quaternion {
		const qYaw = Quaternion.fromAxisAngle(0, 1, 0, yaw);
		const qPitch = Quaternion.fromAxisAngle(1, 0, 0, pitch);
		const qRoll = Quaternion.fromAxisAngle(0, 0, 1, roll);

		return qYaw.multiply(qPitch).multiply(qRoll).normalizeSelf();
	}

	/**
	 * クォータニオンをOpenGLの行列に変換する
	 * @param q クォータニオン
	 * @returns OpenGL行列(4x4の列優先配列)
	 */
	static applyQuaternion(q: Quaternion): number[] {
		const nq = q.normalizeSelf();

		const x = nq.x;
		const y = nq.y;
		const z = nq.z;
		const w = nq.w;

		const xx = x * x;
		const yy = y * y;
		const zz = z * z;
		const xy = x * y;
		const xz = x * z;
		const yz = y * z;
		const wx = w * x;
		const wy = w * y;
		const wz = w * z;

		const m00 = 1 - 2 * (yy + zz);
		const m01 = 2 * (xy - wz);
		const m02 = 2 * (xz + wy);

		const m10 = 2 * (xy + wz);
		const m11 = 1 - 2 * (xx + zz);
		const m12 = 2 * (yz - wx);

		const m20 = 2 * (xz - wy);
		const m21 = 2 * (yz + wx);
		const m22 = 1 - 2 * (xx + yy);

		return [m00, m10, m20, 0, m01, m11, m21, 0, m02, m12, m22, 0, 0, 0, 0, 1];
	}

	private static degToRad(deg: number): number {
		return (deg * Math.PI) / 180;
	}

	private static radToDeg(rad: number): number {
		return (rad * 180) / Math.PI;
	}

	private static snapDeg(deg: number, stepDeg: number): number {
		if (stepDeg === 0) return deg;
		return Math.round(deg / stepDeg) * stepDeg;
	}

	private static clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}
}
