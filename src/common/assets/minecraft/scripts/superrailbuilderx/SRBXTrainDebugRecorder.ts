export type TrainDebugFrame = {
	tick: number;
	key: string;
	speed: number;
	notch: number;
	position: number[];
	text: string;
};
/** A bounded history captures the approach to a possible stall without tick-by-tick log spam. */
export class SRBXTrainDebugRecorder {
	private previous: TrainDebugFrame | null = null;
	private history: string[] = [];
	private lastLog = -1000;
	private stoppedTicks = 0;
	private stallReported = false;
	record(
		frame: TrainDebugFrame,
	): { reason: string; context: string[] } | null {
		const previous = this.previous;
		const dt = previous ? Math.max(0, frame.tick - previous.tick) : 0;
		const distance = previous
			? Math.sqrt(
					frame.position.reduce(
						(sum, value, i) =>
							sum + Math.pow(value - previous.position[i], 2),
						0,
					),
				)
			: 0;
		this.stoppedTicks =
			frame.notch > 0 && previous && distance < 0.0001
				? this.stoppedTicks + dt
				: 0;
		if (!this.stoppedTicks) this.stallReported = false;
		let reason = !previous
			? "start"
			: frame.key !== previous.key
				? "transition"
				: "";
		const stalled = this.stoppedTicks >= 40 && !this.stallReported;
		if (stalled) {
			reason = "possible-stall";
			this.stallReported = true;
		}
		if (
			!reason &&
			frame.tick - this.lastLog >=
				(Math.abs(frame.speed) > 0.0001 || frame.notch > 0 ? 10 : 100)
		)
			reason = "sample";
		const context = stalled ? this.history.slice() : [];
		this.history.push(frame.text);
		if (this.history.length > 20) this.history.shift();
		this.previous = frame;
		if (!reason) return null;
		this.lastLog = frame.tick;
		return { reason, context };
	}
}
