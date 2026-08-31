import { GuiItemMiniature } from "jp.ngt.mcte.gui";
import { PartsRenderer } from "jp.ngt.rtm.render";
import { ResourceLocation } from "net.minecraft.util";

export class RTMApiCompatClient {
	static isMiniatureGui(screen: unknown): boolean {
		return screen instanceof GuiItemMiniature;
	}

	static getRendererWithScript(
		resource: ResourceLocation,
		...args: string[]
	): PartsRenderer {
		return PartsRenderer.getRendererWithScript(
			resource,
			...args,
		) as PartsRenderer;
	}
}
