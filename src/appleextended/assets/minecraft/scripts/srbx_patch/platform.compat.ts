import { NGTLog } from "jp.ngt.ngtlib.io";
import { ModelPackManager } from "jp.ngt.rtm.modelpack";
import { ModelSetRail } from "jp.ngt.rtm.modelpack.modelset";
import { Minecraft } from "net.minecraft.client";
import { Thread } from "java.lang";

type RailPatchTarget = {
	engine: javax.script.ScriptEngine | null;
	modelName: string;
	scriptPath: string;
	packName: string | null;
};

export class SRBXPatchPlatform {
	static isSupported(): boolean {
		return true;
	}

	static scheduleWhenReady(
		task: () => void,
		onFailure: (error: unknown) => void,
	): void {
		try {
			const worker = new Thread(() => {
				try {
					NGTLog.debug(
						"[SRBX rail patch] waiting for AppleExtended model construction",
					);
					let ready = false;
					for (let attempt = 0; attempt < 6000; attempt++) {
						if (this.isReady()) {
							ready = true;
							break;
						}
						Thread.sleep(100);
					}
					if (!ready)
						throw new Error(
							`AppleExtended model construction timed out: modelConstructed=${ModelPackManager.INSTANCE.modelConstructed}, railType=${Boolean(ModelPackManager.INSTANCE.getType("ModelRail"))}`,
						);
					Minecraft.getMinecraft().addScheduledTask(
						task as unknown as java.util.concurrent.Callable<unknown>,
					);
				} catch (error) {
					onFailure(error);
				}
			}, "SRBX Rail Patch Bootstrap");
			worker.setDaemon(true);
			worker.start();
		} catch (error) {
			onFailure(error);
		}
	}

	static getRailPatchTargets(): RailPatchTarget[] {
		const manager = ModelPackManager.INSTANCE;
		const railType = manager.getType("ModelRail");
		const list = manager.getModelList(railType);
		const targets: RailPatchTarget[] = [];
		for (let index = 0; index < list.size(); index++) {
			const set = list.get(index) as ModelSetRail;
			if (!set) continue;
			const config = set.getConfig();
			if (!config) continue;
			const model = set.modelObj;
			const renderer = model ? model.renderer : null;
			if (!renderer)
				NGTLog.debug(
					`[SRBX rail patch] skipped: no constructed renderer: ${String(config.getName())}`,
				);
			targets.push({
				engine: renderer ? renderer.getScript() : null,
				modelName: String(config.getName()),
				scriptPath:
					config.model && config.model.rendererPath
						? String(config.model.rendererPath)
						: "",
				packName: null,
			});
		}
		return targets;
	}

	static loadExcludeJson(): string {
		return String(
			ModelPackManager.INSTANCE.getScript(
				"scripts/srbx_patch/exclude.json",
			),
		);
	}

	private static isReady(): boolean {
		const manager = ModelPackManager.INSTANCE;
		if (!manager.modelConstructed) return false;
		// AE publishes this volatile flag after all construction tasks finish.
		// Dummy and failed model sets can legitimately have no renderer; they
		// must not prevent the remaining script engines from being patched.
		return Boolean(manager.getType("ModelRail"));
	}
}
