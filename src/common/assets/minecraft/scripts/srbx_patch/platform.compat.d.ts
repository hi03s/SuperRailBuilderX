import { ScriptEngine } from "javax.script";

export type SRBXRailPatchTarget = {
	engine: ScriptEngine | null;
	modelName: string;
	scriptPath: string;
	packName: string | null;
};

export class SRBXPatchPlatform {
	static isSupported(): boolean;
	static scheduleWhenReady(
		task: () => void,
		onFailure: (error: unknown) => void,
	): void;
	static getRailPatchTargets(): SRBXRailPatchTarget[];
	static loadExcludeJson(): string;
}
