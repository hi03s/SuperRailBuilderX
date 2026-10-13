type CopyRailEndpoints = {
	start: [number, number, number];
	end: [number, number, number];
};

/** Keep one physical side across connected rails, regardless of endpoint order. */
export class SRBXCopyOrientation {
	static directions(rails: CopyRailEndpoints[]): number[] {
		const directions: number[] = [];
		for (let i = 0; i < rails.length; i++) directions.push(0);
		// Disconnected selections retain their own local side, as before.
		for (let seed = 0; seed < rails.length; seed++) {
			if (directions[seed] !== 0) continue;
			directions[seed] = 1;
			const pending = [seed];
			for (let cursor = 0; cursor < pending.length; cursor++) {
				const source = pending[cursor];
				const sourceEnds = [rails[source].start, rails[source].end];
				for (let target = 0; target < rails.length; target++) {
					if (directions[target] !== 0) continue;
					const targetEnds = [rails[target].start, rails[target].end];
					for (let a = 0; a < 2; a++) {
						for (let b = 0; b < 2; b++) {
							if (directions[target] !== 0) continue;
							const dx = sourceEnds[a][0] - targetEnds[b][0];
							const dy = sourceEnds[a][1] - targetEnds[b][1];
							const dz = sourceEnds[a][2] - targetEnds[b][2];
							if (dx * dx + dy * dy + dz * dz > 0.0001) continue;
							directions[target] =
								directions[source] * (a === b ? -1 : 1);
							pending.push(target);
						}
					}
				}
			}
		}
		return directions;
	}
}
