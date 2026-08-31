import { NGTObject } from "jp.ngt.ngtlib.block";
import { DisplayList } from "jp.ngt.ngtlib.renderer";
import { ModelSetBase } from "jp.ngt.rtm.modelpack.modelset";
import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { ModelObject, PartsRenderer } from "jp.ngt.rtm.render";
import { ResourceLocation } from "net.minecraft.util";

export class RTMApiCompatClient {
	static getLookingPos(partialTicks: number): {
		posX: number;
		posY: number;
		posZ: number;
		blockX: number;
		blockY: number;
		blockZ: number;
		placeX: number;
		placeY: number;
		placeZ: number;
		side: number;
	} | null;
	static getLookingPosAtDistance(
		partialTicks: number,
		distance: number,
	): {
		posX: number;
		posY: number;
		posZ: number;
		blockX: number;
		blockY: number;
		blockZ: number;
		placeX: number;
		placeY: number;
		placeZ: number;
		side: number;
	};
	static getLookingBlockDistance(partialTicks: number): number | null;
	static bindBlockTexture(renderer: PartsRenderer): void;
	static getGrassTextureUV(): [number, number, number, number];
	static generateGLList(): DisplayList;
	static startCompile(displayList: DisplayList): void;
	static callList(displayList: DisplayList): void;
	static renderNGTO(
		renderer: PartsRenderer,
		ngto: NGTObject,
		pass: number,
	): void;
	static isMiniatureGui(screen: unknown): boolean;
	static getRendererWithScript(
		resource: ResourceLocation,
		...args: string[]
	): PartsRenderer;
	static getModelSetList<T extends ModelSetBase>(
		modelType: string,
	): { [name: string]: T };
	static getRailModelSet(railCore: TileEntityLargeRailCore): ModelSetBase;
	static getRailName(railCore: TileEntityLargeRailCore): string;
	static getModelObject(modelSet: ModelSetBase): ModelObject;
}
