import { NGTLog } from "jp.ngt.ngtlib.io";
import {
	SRBXPatchPlatform,
	SRBXRailPatchTarget,
} from "@target/assets/minecraft/scripts/srbx_patch/platform";
import { RAIL_RENDER_PATCH_SOURCE } from "./patch_source";

type ExcludeConfig = {
	packs: string[];
	scripts: string[];
};

export class SRBXRailRenderPatch {
	static apply(): void {
		const exclusions = this.loadExclusions();
		const targets = SRBXPatchPlatform.getRailPatchTargets();
		let patched = 0;
		let noFunction = 0;
		let excluded = 0;
		let alreadyPatched = 0;
		let failed = 0;

		NGTLog.debug(
			`[SRBX rail patch] scanning ${targets.length} rail models`,
		);
		for (const target of targets) {
			const label = this.getLabel(target);
			try {
				if (this.isExcluded(target, exclusions)) {
					excluded++;
					NGTLog.debug(
						`[SRBX rail patch] skipped: excluded: ${label}`,
					);
					continue;
				}
				if (target.engine === null) {
					noFunction++;
					continue;
				}
				if (
					!this.evalBoolean(
						target,
						'typeof renderRailDynamic2 === "function"',
					)
				) {
					noFunction++;
					continue;
				}
				if (
					this.evalBoolean(
						target,
						'typeof __SRBX_RAIL_RENDER_PATCHED__ !== "undefined" && __SRBX_RAIL_RENDER_PATCHED__ === true',
					)
				) {
					alreadyPatched++;
					NGTLog.debug(`[SRBX rail patch] already patched: ${label}`);
					continue;
				}

				target.engine.eval(RAIL_RENDER_PATCH_SOURCE);
				patched++;
				NGTLog.debug(`[SRBX rail patch] patched: ${label}`);
			} catch (error) {
				failed++;
				NGTLog.debug(
					`[SRBX rail patch] patch failed: ${label}: ${error}`,
				);
			}
		}

		NGTLog.debug(
			`[SRBX rail patch] completed: patched=${patched}, no renderRailDynamic2=${noFunction}, excluded=${excluded}, already patched=${alreadyPatched}, failed=${failed}`,
		);
	}

	private static evalBoolean(
		target: SRBXRailPatchTarget,
		source: string,
	): boolean {
		if (target.engine === null) return false;
		return Boolean(target.engine.eval(source));
	}

	private static loadExclusions(): ExcludeConfig {
		try {
			const parsed = JSON.parse(
				SRBXPatchPlatform.loadExcludeJson(),
			) as Partial<ExcludeConfig>;
			return {
				packs: Array.isArray(parsed.packs)
					? parsed.packs.map(String)
					: [],
				scripts: Array.isArray(parsed.scripts)
					? parsed.scripts.map((path) => this.normalize(path))
					: [],
			};
		} catch (error) {
			NGTLog.debug(
				`[SRBX rail patch] failed to load exclude.json; using empty exclusions: ${error}`,
			);
			return { packs: [], scripts: [] };
		}
	}

	private static isExcluded(
		target: SRBXRailPatchTarget,
		exclusions: ExcludeConfig,
	): boolean {
		if (exclusions.scripts.indexOf(this.normalize(target.scriptPath)) >= 0)
			return true;
		return (
			target.packName !== null &&
			exclusions.packs.indexOf(target.packName) >= 0
		);
	}

	private static normalize(path: string): string {
		return String(path).replace(/\\/g, "/");
	}

	private static getLabel(target: SRBXRailPatchTarget): string {
		return target.scriptPath
			? `${target.modelName} (${target.scriptPath})`
			: target.modelName;
	}
}
