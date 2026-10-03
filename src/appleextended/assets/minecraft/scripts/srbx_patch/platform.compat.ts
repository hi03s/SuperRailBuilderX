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
							"AppleExtended model construction timed out",
						);
					Minecraft.getMinecraft().addScheduledTask(task as any);
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
			const config = set.getConfig();
			const model = set.modelObj;
			const renderer = model ? model.renderer : null;
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
		const railType = manager.getType("ModelRail");
		if (!railType) return false;
		const list = manager.getModelList(railType);
		if (list.isEmpty()) return false;
		for (let index = 0; index < list.size(); index++) {
			const set = list.get(index) as ModelSetRail;
			if (!set || !set.modelObj || !set.modelObj.renderer) return false;
		}
		return true;
	}
}
