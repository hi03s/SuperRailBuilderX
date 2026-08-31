import { HashMap } from "java.util";
import { NGTObject } from "jp.ngt.ngtlib.block";
import { GuiItemMiniature } from "jp.ngt.mcte.gui";
import {
	DisplayList,
	GLHelper,
	NGTObjectRenderer,
} from "jp.ngt.ngtlib.renderer";
import {
	MCWrapperClient,
	NGTUtil,
	NGTUtilClient,
} from "jp.ngt.ngtlib.util";
import { NGTWorld } from "jp.ngt.ngtlib.world";
import { ModelPackManager } from "jp.ngt.rtm.modelpack";
import {
	ModelSetBase,
	ModelSetRail,
	ResourceSet,
} from "jp.ngt.rtm.modelpack.modelset";
import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { ModelObject, PartsRenderer, RTMRenderers } from "jp.ngt.rtm.render";
import { TextureMap } from "net.minecraft.client.renderer.texture";
import { ResourceLocation } from "net.minecraft.util";

type LookingPos = {
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

type ModelConfigWithName = {
	name: string;
};

export class RTMApiCompatClient {
	static ngtoWorld = new HashMap<NGTObject, NGTWorld>();

	static getLookingPos(partialTicks: number): LookingPos | null {
		const player = MCWrapperClient.getPlayer();
		const start = player.getPositionEyes(partialTicks);
		const look = player.getLook(partialTicks);
		const end = start.add(look.x * 512, look.y * 512, look.z * 512);
		const mop = NGTUtil.getClientWorld().rayTraceBlocks(
			start,
			end,
			true,
			false,
			true,
		);
		if (!mop) return null;

		const lookingVec = mop.hitVec;
		const posX = lookingVec.x;
		const posY = lookingVec.y;
		const posZ = lookingVec.z;
		const blockPos = mop.getBlockPos();
		const facing = mop.sideHit;
		const dir = facing.getDirectionVec();
		const hitX = blockPos.getX();
		const hitY = blockPos.getY();
		const hitZ = blockPos.getZ();
		const side = facing.getIndex();
		let dx = 0;
		let dy = 0;
		let dz = 0;
		if (side === 0) dy = -1;
		else if (side === 1) dy = 1;
		else if (side === 2) dz = -1;
		else if (side === 3) dz = 1;
		else if (side === 4) dx = -1;
		else if (side === 5) dx = 1;
		return {
			posX: posX + dx * 1e-6,
			posY: posY + dy * 1e-6,
			posZ: posZ + dz * 1e-6,
			blockX: hitX,
			blockY: hitY,
			blockZ: hitZ,
			placeX: hitX + dir.getX(),
			placeY: hitY + dir.getY(),
			placeZ: hitZ + dir.getZ(),
			side: side,
		};
	}

	static getLookingPosAtDistance(
		partialTicks: number,
		distance: number,
	): LookingPos {
		const player = MCWrapperClient.getPlayer();
		const start = player.getPositionEyes(partialTicks);
		const look = player.getLook(partialTicks);
		const end = start.add(look.x * distance, look.y * distance, look.z * distance);
		const mop = NGTUtil.getClientWorld().rayTraceBlocks(
			start,
			end,
			true,
			false,
			true,
		);
		if (mop) {
			const blockPos = mop.getBlockPos();
			const facing = mop.sideHit;
			const dir = facing.getDirectionVec();
			const side = facing.getIndex();
			return {
				posX: mop.hitVec.x + dir.getX() * 1e-6,
				posY: mop.hitVec.y + dir.getY() * 1e-6,
				posZ: mop.hitVec.z + dir.getZ() * 1e-6,
				blockX: blockPos.getX(),
				blockY: blockPos.getY(),
				blockZ: blockPos.getZ(),
				placeX: blockPos.getX() + dir.getX(),
				placeY: blockPos.getY() + dir.getY(),
				placeZ: blockPos.getZ() + dir.getZ(),
				side: side,
			};
		}
		return {
			posX: end.x,
			posY: end.y,
			posZ: end.z,
			blockX: Math.floor(end.x),
			blockY: Math.floor(end.y),
			blockZ: Math.floor(end.z),
			placeX: Math.floor(end.x),
			placeY: Math.floor(end.y),
			placeZ: Math.floor(end.z),
			side: -1,
		};
	}

	static getLookingBlockDistance(partialTicks: number): number | null {
		const lookingPos = RTMApiCompatClient.getLookingPos(partialTicks);
		if (!lookingPos) return null;
		const eye = MCWrapperClient.getPlayer().getPositionEyes(partialTicks);
		const dx = lookingPos.posX - eye.x;
		const dy = lookingPos.posY - eye.y;
		const dz = lookingPos.posZ - eye.z;
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	static bindBlockTexture(renderer: PartsRenderer): void {
		renderer.bindTexture(TextureMap.LOCATION_BLOCKS_TEXTURE);
	}

	static getGrassTextureUV(): [number, number, number, number] {
		const icon = NGTUtilClient.getMinecraft()
			.getTextureMapBlocks()
			.getAtlasSprite("minecraft:blocks/grass_top");
		return [icon.getMinU(), icon.getMinV(), icon.getMaxU(), icon.getMaxV()];
	}

	static generateGLList(): DisplayList {
		return GLHelper.generateGLList(null);
	}

	static startCompile(displayList: DisplayList): void {
		GLHelper.startCompile(displayList);
	}

	static callList(displayList: DisplayList): void {
		GLHelper.callList(displayList);
	}

	static renderNGTO(
		renderer: PartsRenderer,
		ngto: NGTObject,
		pass: number,
	): void {
		const modelObj = NGTUtil.getField(
			PartsRenderer.class,
			renderer,
			"modelObj",
		) as ModelObject | null;
		const matId = renderer.currentMatId;
		if (modelObj) {
			const defaultTexture = modelObj.textures[matId].material.texture;
			renderer.bindTexture(TextureMap.LOCATION_BLOCKS_TEXTURE);
			let world = RTMApiCompatClient.ngtoWorld.get(ngto);
			if (!world) {
				world = new NGTWorld(NGTUtil.getClientWorld(), ngto);
				RTMApiCompatClient.ngtoWorld.put(ngto, world);
			}
			NGTObjectRenderer.INSTANCE.renderNGTObject(world, ngto, true, 0, pass);
			renderer.bindTexture(defaultTexture);
		}
	}

	static isMiniatureGui(screen: unknown): boolean {
		return screen instanceof GuiItemMiniature;
	}

	static getRendererWithScript(
		resource: ResourceLocation,
		...args: string[]
	): PartsRenderer {
		return RTMRenderers.getRendererWithScript(
			resource,
			...args,
		) as PartsRenderer;
	}

	static getModelSetList<T extends ResourceSet>(
		modelType: string,
	): { [name: string]: T } {
		const type = ModelPackManager.INSTANCE.getType(modelType);
		const allModelList = ModelPackManager.INSTANCE.getModelList(type);
		const list: { [name: string]: T } = {};
		for (let i = 0; i < allModelList.size(); i++) {
			const modelSet = allModelList.get(i) as T;
			const modelConfig = modelSet.getConfig() as ModelConfigWithName;
			const modelName = modelConfig.name;
			list[modelName] = modelSet;
		}
		return list;
	}

	static getRailModelSet(railCore: TileEntityLargeRailCore): ModelSetRail {
		return railCore.getResourceState().getResourceSet();
	}

	static getRailName(railCore: TileEntityLargeRailCore): string {
		return railCore.getResourceState().getResourceName();
	}

	static getModelObject(modelSet: ModelSetBase): ModelObject {
		return modelSet.modelObj;
	}
}
