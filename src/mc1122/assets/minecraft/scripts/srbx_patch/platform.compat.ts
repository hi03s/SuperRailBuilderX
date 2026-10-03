export class SRBXPatchPlatform {
	static isSupported(): boolean {
		return false;
	}

	static scheduleWhenReady(
		task: () => void,
		onFailure: (error: unknown) => void,
	): void {
		void task;
		void onFailure;
	}

	static getRailPatchTargets(): never[] {
		return [];
	}

	static loadExcludeJson(): string {
		return '{"packs":[],"scripts":[]}';
	}
}
