import { HashMap } from "java.util";
import { NGTObject } from "jp.ngt.ngtlib.block";
import { GuiItemMiniature } from "jp.ngt.mcte.gui";
import { DisplayList, GLHelper, NGTRenderer } from "jp.ngt.ngtlib.renderer";
import { MCWrapperClient, NGTUtil } from "jp.ngt.ngtlib.util";
import { NGTWorld } from "jp.ngt.ngtlib.world";
import { ModelPackManager } from "jp.ngt.rtm.modelpack";
import {
	ModelSetBase,
	ModelSetRailClient,
} from "jp.ngt.rtm.modelpack.modelset";
import { TileEntityLargeRailCore } from "jp.ngt.rtm.rail";
import { ModelObject, PartsRenderer, RTMRenderers } from "jp.ngt.rtm.render";
import { TextureMap } from "net.minecraft.client.renderer.texture";
import { Blocks } from "net.minecraft.init";
import { ResourceLocation, Vec3 } from "net.minecraft.util";

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

type ModelSetWithModel = ModelSetBase & {
	model: ModelObject;
};

type ModelConfigWithName = {
	name: string;
};

export class RTMApiCompatClient {
	static ngtoWorld = new HashMap<NGTObject, NGTWorld>();

	static getLookingPos(partialTicks: number): LookingPos | null {
		const player = MCWrapperClient.getPlayer();
		const start = Vec3.createVectorHelper(
			player.prevPosX + (player.posX - player.prevPosX) * partialTicks,
			player.prevPosY +
				(player.posY - player.prevPosY) * partialTicks +
				1.62 -
				player.yOffset,
			player.prevPosZ + (player.posZ - player.prevPosZ) * partialTicks,
		);
		const look = player.getLook(partialTicks);
		const end = start.addVector(
			look.xCoord * 512,
			look.yCoord * 512,
			look.zCoord * 512,
		);
		const mop = NGTUtil.getClientWorld().rayTraceBlocks(start, end, true);
		if (!mop) return null;

		const lookingVec = mop.hitVec;
		const posX = lookingVec.xCoord;
		const posY = lookingVec.yCoord;
		const posZ = lookingVec.zCoord;
		const hitX = mop.blockX;
		const hitY = mop.blockY;
		const hitZ = mop.blockZ;
		const side = mop.sideHit;
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
			placeX: hitX + dx,
			placeY: hitY + dy,
			placeZ: hitZ + dz,
			side: side,
		};
	}

	static getLookingPosAtDistance(
		partialTicks: number,
		distance: number,
	): LookingPos {
		const player = MCWrapperClient.getPlayer();
		const start = Vec3.createVectorHelper(
			player.prevPosX + (player.posX - player.prevPosX) * partialTicks,
			player.prevPosY +
				(player.posY - player.prevPosY) * partialTicks +
				1.62 -
				player.yOffset,
			player.prevPosZ + (player.posZ - player.prevPosZ) * partialTicks,
		);
		const look = player.getLook(partialTicks);
		const end = start.addVector(
			look.xCoord * distance,
			look.yCoord * distance,
			look.zCoord * distance,
		);
		const mop = NGTUtil.getClientWorld().rayTraceBlocks(start, end, true);
		if (mop) {
			const side = mop.sideHit;
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
				posX: mop.hitVec.xCoord + dx * 1e-6,
				posY: mop.hitVec.yCoord + dy * 1e-6,
				posZ: mop.hitVec.zCoord + dz * 1e-6,
				blockX: mop.blockX,
				blockY: mop.blockY,
				blockZ: mop.blockZ,
				placeX: mop.blockX + dx,
				placeY: mop.blockY + dy,
				placeZ: mop.blockZ + dz,
				side: side,
			};
		}
		return {
			posX: end.xCoord,
			posY: end.yCoord,
			posZ: end.zCoord,
			blockX: Math.floor(end.xCoord),
			blockY: Math.floor(end.yCoord),
			blockZ: Math.floor(end.zCoord),
			placeX: Math.floor(end.xCoord),
			placeY: Math.floor(end.yCoord),
			placeZ: Math.floor(end.zCoord),
			side: -1,
		};
	}

	static getLookingBlockDistance(partialTicks: number): number | null {
		const lookingPos = RTMApiCompatClient.getLookingPos(partialTicks);
		if (!lookingPos) return null;
		const player = MCWrapperClient.getPlayer();
		const eyeX =
			player.prevPosX + (player.posX - player.prevPosX) * partialTicks;
		const eyeY =
			player.prevPosY +
			(player.posY - player.prevPosY) * partialTicks +
			1.62 -
			player.yOffset;
		const eyeZ =
			player.prevPosZ + (player.posZ - player.prevPosZ) * partialTicks;
		const dx = lookingPos.posX - eyeX;
		const dy = lookingPos.posY - eyeY;
		const dz = lookingPos.posZ - eyeZ;
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	static bindBlockTexture(renderer: PartsRenderer): void {
		renderer.bindTexture(TextureMap.locationBlocksTexture);
	}

	static getGrassTextureUV(): [number, number, number, number] {
		const icon = Blocks.grass.getIcon(1, 0);
		return [icon.getMinU(), icon.getMinV(), icon.getMaxU(), icon.getMaxV()];
	}

	static generateGLList(): DisplayList {
		return GLHelper.generateGLList();
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
			renderer.bindTexture(TextureMap.locationBlocksTexture);
			NGTRenderer.renderNGTObject(ngto, true);
			renderer.bindTexture(defaultTexture);
		}
		void pass;
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

	static getModelSetList<T extends ModelSetBase>(
		modelType: string,
	): { [name: string]: T } {
		const allModelList = ModelPackManager.INSTANCE.getModelList(modelType);
		const list: { [name: string]: T } = {};
		for (let i = 0; i < allModelList.size(); i++) {
			const modelSet = allModelList.get(i) as T;
			const modelConfig = modelSet.getConfig() as ModelConfigWithName;
			const modelName = modelConfig.name;
			list[modelName] = modelSet;
		}
		return list;
	}

	static getRailModelSet(
		railCore: TileEntityLargeRailCore,
	): ModelSetRailClient {
		return railCore.getProperty().getModelSet() as ModelSetRailClient;
	}

	static getRailName(railCore: TileEntityLargeRailCore): string {
		return railCore.getProperty().railModel;
	}

	static getModelObject(modelSet: ModelSetBase): ModelObject {
		return (modelSet as ModelSetWithModel).model;
	}
}
