type CantDiagnosticMap = {
	getLength(): number;
	getRailHeight(split: number, index: number): number;
	getRailPos(split: number, index: number): ArrayLike<number>;
	getRailPitch(split: number, index: number): number;
	getCant(split: number, index: number): number;
};

/** Read-only, bounded diagnostics; never normalize or change rail data. */
export class SRBXCantDiagnostics {
	private static finite(value: number): number {
		if (!isFinite(value)) throw new Error("non-finite rail sample");
		return value;
	}

	private static rounded(value: number): number {
		return Math.round(value * 1000000) / 1000000;
	}

	static profile(map: CantDiagnosticMap): string {
		const length = this.finite(map.getLength());
		// Same approximate spacing as native static rendering, with a hard cap.
		const split = Math.max(1, Math.min(2048, Math.floor(length * 2)));
		let maxHeightStep = 0,
			maxRollStep = 0,
			maxPitchMismatch = 0;
		let previousHeight = this.finite(map.getRailHeight(split, 0));
		let previousRoll = this.finite(map.getCant(split, 0));
		let previousPitch = this.finite(map.getRailPitch(split, 0));
		let previousPos = map.getRailPos(split, 0);
		for (let i = 1; i <= split; i++) {
			const height = this.finite(map.getRailHeight(split, i));
			const roll = this.finite(map.getCant(split, i));
			const pitch = this.finite(map.getRailPitch(split, i));
			const pos = map.getRailPos(split, i);
			const dx = this.finite(pos[1] - previousPos[1]);
			const dz = this.finite(pos[0] - previousPos[0]);
			const horizontal = Math.sqrt(dx * dx + dz * dz);
			const dy = height - previousHeight;
			maxHeightStep = Math.max(maxHeightStep, Math.abs(dy));
			maxRollStep = Math.max(maxRollStep, Math.abs(roll - previousRoll));
			if (horizontal > 0.000001) {
				const effectivePitch =
					(Math.atan2(dy, horizontal) * 180) / Math.PI;
				maxPitchMismatch = Math.max(
					maxPitchMismatch,
					Math.abs(effectivePitch - (pitch + previousPitch) / 2),
				);
			}
			previousHeight = height;
			previousRoll = roll;
			previousPitch = pitch;
			previousPos = pos;
		}
		const landmarks: string[] = [];
		for (let i = 0; i <= 4; i++) {
			landmarks.push(
				[
					this.rounded(this.finite(map.getRailHeight(4, i))),
					this.rounded(this.finite(map.getRailPitch(4, i))),
					this.rounded(this.finite(map.getCant(4, i))),
				].join("/"),
			);
		}
		return `length=${this.rounded(length)}, split=${split}, maxHeightStep=${this.rounded(maxHeightStep)}, maxRollStep=${this.rounded(maxRollStep)}, maxPitchMismatch=${this.rounded(maxPitchMismatch)}, height/pitch/roll=${landmarks.join(";")}`;
	}

	static seams(maps: CantDiagnosticMap[]): string {
		let maxPositionGap = 0,
			maxHeightGap = 0,
			maxRollGap = 0;
		for (let i = 1; i < maps.length; i++) {
			const a = maps[i - 1],
				b = maps[i];
			const end = a.getRailPos(1, 1),
				start = b.getRailPos(1, 0);
			const dx = this.finite(end[1] - start[1]),
				dz = this.finite(end[0] - start[0]);
			maxPositionGap = Math.max(
				maxPositionGap,
				Math.sqrt(dx * dx + dz * dz),
			);
			maxHeightGap = Math.max(
				maxHeightGap,
				Math.abs(
					this.finite(a.getRailHeight(1, 1) - b.getRailHeight(1, 0)),
				),
			);
			maxRollGap = Math.max(
				maxRollGap,
				Math.abs(this.finite(a.getCant(1, 1) - b.getCant(1, 0))),
			);
		}
		return `sections=${maps.length}, maxXZGap=${this.rounded(maxPositionGap)}, maxHeightGap=${this.rounded(maxHeightGap)}, maxRollGap=${this.rounded(maxRollGap)}`;
	}
}
