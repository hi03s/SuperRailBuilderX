import { NGTUtilClient } from "jp.ngt.ngtlib.util";
import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { GuiIngameCustom } from "jp.ngt.rtm.gui";
import { ResourceLocation } from "net.minecraft.util";
import { GL11 } from "org.lwjgl.opengl";

const TILE_SIZE = 16;
const TOOL_FRAME_SIZE = TILE_SIZE * 2;
const TOOL_NAME = "レール生成A";
const TOOL_ICON = new ResourceLocation(
	"minecraft",
	"textures/superrailbuilderx/icon_builder1.png",
);

function drawTile(
	gui: GuiIngameCustom,
	x: number,
	y: number,
	tileX: number,
	tileY: number,
	width: number = TILE_SIZE,
	height: number = TILE_SIZE,
): void {
	gui.drawTexturedModalRect(
		x,
		y,
		tileX * TILE_SIZE,
		tileY * TILE_SIZE,
		width,
		height,
	);
}

function drawBase(gui: GuiIngameCustom): void {
	for (let x = 0; x < gui.width; x += TILE_SIZE)
		drawTile(gui, x, 0, 0, 0, Math.min(TILE_SIZE, gui.width - x));

	const rightX = Math.max(0, gui.width - TILE_SIZE);
	for (let y = 0; y < gui.height; y += TILE_SIZE)
		drawTile(
			gui,
			rightX,
			y,
			0,
			1,
			Math.min(TILE_SIZE, gui.width),
			Math.min(TILE_SIZE, gui.height - y),
		);
}

function drawToolFrame(gui: GuiIngameCustom): void {
	const x = Math.max(0, gui.width - TOOL_FRAME_SIZE);
	drawTile(gui, x, 0, 1, 0);
	drawTile(gui, x + TILE_SIZE, 0, 2, 0);
	drawTile(gui, x, TILE_SIZE, 1, 1);
	drawTile(gui, x + TILE_SIZE, TILE_SIZE, 2, 1);
}

function drawToolIcon(gui: GuiIngameCustom): void {
	NGTUtilClient.bindTexture(TOOL_ICON);
	GL11.glMatrixMode(GL11.GL_TEXTURE);
	GL11.glPushMatrix();
	GL11.glScalef(512 / TILE_SIZE, 512 / TILE_SIZE, 1);
	GL11.glMatrixMode(GL11.GL_MODELVIEW);
	gui.drawTexturedModalRect(
		Math.max(0, gui.width - TOOL_FRAME_SIZE) + TILE_SIZE / 2,
		TILE_SIZE / 2,
		0,
		0,
		TILE_SIZE,
		TILE_SIZE,
	);
	GL11.glMatrixMode(GL11.GL_TEXTURE);
	GL11.glPopMatrix();
	GL11.glMatrixMode(GL11.GL_MODELVIEW);
}

function drawToolName(gui: GuiIngameCustom): void {
	const font = gui.mc.fontRenderer;
	const x = Math.floor((gui.width - font.getStringWidth(TOOL_NAME)) / 2);
	font.drawString(TOOL_NAME, x, 4, 0x202020);
}

function renderGui(entity: EntityVehicle, gui: GuiIngameCustom): void {
	void entity;
	GL11.glPushAttrib(
		GL11.GL_ENABLE_BIT |
			GL11.GL_COLOR_BUFFER_BIT |
			GL11.GL_TEXTURE_BIT |
			GL11.GL_TRANSFORM_BIT,
	);
	GL11.glColor4f(1, 1, 1, 1);
	GL11.glEnable(GL11.GL_BLEND);
	GL11.glBlendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
	drawBase(gui);
	drawToolFrame(gui);
	drawToolIcon(gui);
	drawToolName(gui);
	GL11.glPopAttrib();
}
