/** 時刻を基準に、長押し中の数値変更を段階的に加速する。 */
export class SRBXAcceleratedRepeat {
	private direction = 0;
	private initialStep = 0;
	private stageCount = 0;
	private nextAt = 0;
	private lastAt = 0;
	private accelerate = true;

	reset(): void {
		this.direction = 0;
		this.initialStep = 0;
		this.stageCount = 0;
		this.nextAt = 0;
		this.lastAt = 0;
	}

	/**
	 * direction は減少=-1、解除=0、増加=1。Ctrl 時は initialStep を変える。
	 * 戻り値は前回更新後の変更量。値の上下限は呼び出し側で適用する。
	 */
	update(
		now: number,
		direction: number,
		initialStep: number,
		accelerate = true,
	): number {
		if (!isFinite(now) || !isFinite(initialStep) || initialStep <= 0) {
			this.reset();
			return 0;
		}
		direction = direction < 0 ? -1 : direction > 0 ? 1 : 0;
		if (direction === 0) {
			this.reset();
			return 0;
		}
		if (
			this.direction !== direction ||
			this.initialStep !== initialStep ||
			this.accelerate !== accelerate ||
			now < this.lastAt
		) {
			this.direction = direction;
			this.initialStep = initialStep;
			this.accelerate = accelerate;
			this.stageCount = 1;
			this.nextAt = now + 350;
			this.lastAt = now;
			return direction * initialStep;
		}
		this.lastAt = now;
		if (now < this.nextAt) return 0;
		let count = Math.floor((now - this.nextAt) / 75) + 1;
		this.nextAt += count * 75;
		// Forty initial changes, then one higher decimal place for the whole hold.
		const initialCount = Math.min(count, Math.max(0, 40 - this.stageCount));
		this.stageCount += initialCount;
		count -= initialCount;
		const delta =
			this.initialStep * initialCount +
			this.initialStep * (accelerate ? 10 : 1) * count;
		return direction * delta;
	}
}
