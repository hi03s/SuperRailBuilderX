import { NGTLog } from "jp.ngt.ngtlib.io";
import { NGTUtilClient } from "jp.ngt.ngtlib.util";
import { Minecraft } from "net.minecraft.client";
import { ICommandSender } from "net.minecraft.command";
import { Gui } from "net.minecraft.client.gui";
import { ResourceLocation } from "net.minecraft.util";
import { GL11, GL13, GL14 } from "org.lwjgl.opengl";
import { BufferUtils } from "org.lwjgl";
import { SRBXApiCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";

export type SRBXGuiRow = {
	iconX: number;
	iconY: number;
	enabled?: boolean;
	label?: string;
};

const GUI_TILE_SIZE = 16;
const GUI_TOOL_FRAME_SIZE = GUI_TILE_SIZE * 2;
const GUI_TEXTURE_SIZE = 512;
const GUI_DRAW_TEXTURE_SIZE = 256;
const GUI_BASE_TEXTURE = new ResourceLocation(
	"minecraft",
	"textures/superrailbuilderx/gui_base.png",
);
const toolGui = new Gui();
let guiFogDiagnosticReported = false;
let guiRenderingDisabled = false;
let guiRestoreDiagnosticReported = false;
const guiProjectionMatrix = BufferUtils.createFloatBuffer(16);
const guiModelViewMatrix = BufferUtils.createFloatBuffer(16);
const guiTextureMatrix = BufferUtils.createFloatBuffer(16);
const guiTileTextureMatrix = BufferUtils.createFloatBuffer(16);
const guiIconTextureMatrix = BufferUtils.createFloatBuffer(16);
const guiColorBuffer = BufferUtils.createFloatBuffer(16);
const guiColorMaskBuffer = BufferUtils.createByteBuffer(16);

function saveGuiMatrix(matrix: number, buffer: java.nio.FloatBuffer): void {
	buffer.clear();
	GL11.glGetFloat(matrix, buffer);
	buffer.rewind();
}

let guiToolName = "";

function getScaledGuiSize(mc: Minecraft): [number, number] {
	let scale = 1;
	let requestedScale = mc.gameSettings.guiScale;
	if (requestedScale === 0) requestedScale = 1000;
	while (
		scale < requestedScale &&
		mc.displayWidth / (scale + 1) >= 320 &&
		mc.displayHeight / (scale + 1) >= 240
	)
		scale++;
	if (mc.fontRenderer.getUnicodeFlag() && scale % 2 !== 0 && scale !== 1)
		scale--;
	return [
		Math.ceil(mc.displayWidth / scale),
		Math.ceil(mc.displayHeight / scale),
	];
}

function drawGuiTile(
	x: number,
	y: number,
	tileX: number,
	tileY: number,
	width: number = GUI_TILE_SIZE,
	height: number = GUI_TILE_SIZE,
): void {
	toolGui.drawTexturedModalRect(
		x,
		y,
		tileX * GUI_TILE_SIZE,
		tileY * GUI_TILE_SIZE,
		width,
		height,
	);
}

function drawToolGuiBase(
	width: number,
	height: number,
	rows: SRBXGuiRow[],
): void {
	NGTUtilClient.bindTexture(GUI_BASE_TEXTURE);
	GL13.glActiveTexture(GL13.GL_TEXTURE0);
	saveGuiMatrix(GL11.GL_TEXTURE_MATRIX, guiTileTextureMatrix);
	GL11.glMatrixMode(GL11.GL_TEXTURE);
	try {
		GL11.glLoadIdentity();
		GL11.glScalef(
			GUI_DRAW_TEXTURE_SIZE / GUI_TEXTURE_SIZE,
			GUI_DRAW_TEXTURE_SIZE / GUI_TEXTURE_SIZE,
			1,
		);
		GL11.glMatrixMode(GL11.GL_MODELVIEW);
		for (let x = 0; x < width; x += GUI_TILE_SIZE)
			drawGuiTile(x, 0, 0, 0, Math.min(GUI_TILE_SIZE, width - x));
		const rightX = Math.max(0, width - GUI_TILE_SIZE);
		for (let y = 0; y < height; y += GUI_TILE_SIZE)
			drawGuiTile(
				rightX,
				y,
				0,
				1,
				Math.min(GUI_TILE_SIZE, width),
				Math.min(GUI_TILE_SIZE, height - y),
			);
		const frameX = Math.max(0, width - GUI_TOOL_FRAME_SIZE);
		drawGuiTile(frameX, 0, 1, 0);
		drawGuiTile(frameX + GUI_TILE_SIZE, 0, 2, 0);
		drawGuiTile(frameX, GUI_TILE_SIZE, 1, 1);
		drawGuiTile(frameX + GUI_TILE_SIZE, GUI_TILE_SIZE, 2, 1);
		const statusX = Math.max(0, width - GUI_TILE_SIZE);
		for (let row = 0; row < rows.length; row++) {
			const y = GUI_TOOL_FRAME_SIZE + row * GUI_TILE_SIZE;
			const background =
				rows[row].enabled === undefined ? 2 : rows[row].enabled ? 1 : 0;
			drawGuiTile(statusX, y, 3, background);
			drawGuiTile(statusX, y, rows[row].iconX, rows[row].iconY);
		}
	} finally {
		GL13.glActiveTexture(GL13.GL_TEXTURE0);
		GL11.glMatrixMode(GL11.GL_TEXTURE);
		GL11.glLoadMatrix(guiTileTextureMatrix);
		GL11.glMatrixMode(GL11.GL_MODELVIEW);
	}
}

function drawToolGuiIcon(width: number, icon: ResourceLocation): void {
	NGTUtilClient.bindTexture(icon);
	GL13.glActiveTexture(GL13.GL_TEXTURE0);
	saveGuiMatrix(GL11.GL_TEXTURE_MATRIX, guiIconTextureMatrix);
	GL11.glMatrixMode(GL11.GL_TEXTURE);
	try {
		GL11.glLoadIdentity();
		GL11.glScalef(
			GUI_DRAW_TEXTURE_SIZE / GUI_TILE_SIZE,
			GUI_DRAW_TEXTURE_SIZE / GUI_TILE_SIZE,
			1,
		);
		GL11.glMatrixMode(GL11.GL_MODELVIEW);
		toolGui.drawTexturedModalRect(
			Math.max(0, width - GUI_TOOL_FRAME_SIZE) + GUI_TILE_SIZE / 2,
			GUI_TILE_SIZE / 2,
			0,
			0,
			GUI_TILE_SIZE,
			GUI_TILE_SIZE,
		);
	} finally {
		GL13.glActiveTexture(GL13.GL_TEXTURE0);
		GL11.glMatrixMode(GL11.GL_TEXTURE);
		GL11.glLoadMatrix(guiIconTextureMatrix);
		GL11.glMatrixMode(GL11.GL_MODELVIEW);
	}
}

function guiGLState(): string {
	return `mode=${GL11.glGetInteger(GL11.GL_MATRIX_MODE)}, activeTexture=${GL11.glGetInteger(GL13.GL_ACTIVE_TEXTURE)}, modelViewDepth=${GL11.glGetInteger(GL11.GL_MODELVIEW_STACK_DEPTH)}, projectionDepth=${GL11.glGetInteger(GL11.GL_PROJECTION_STACK_DEPTH)}, textureDepth=${GL11.glGetInteger(GL11.GL_TEXTURE_STACK_DEPTH)}, attribDepth=${GL11.glGetInteger(GL11.GL_ATTRIB_STACK_DEPTH)}`;
}

const GUI_GL_CAPABILITIES = [
	GL11.GL_LIGHTING,
	GL11.GL_FOG,
	GL11.GL_CULL_FACE,
	GL11.GL_ALPHA_TEST,
	GL11.GL_DEPTH_TEST,
	GL11.GL_BLEND,
];

function saveGuiAttributes(activeTexture: number) {
	saveGuiMatrix(GL11.GL_CURRENT_COLOR, guiColorBuffer);
	guiColorMaskBuffer.clear();
	GL11.glGetBoolean(GL11.GL_COLOR_WRITEMASK, guiColorMaskBuffer);
	const state = {
		activeTexture,
		enabled: GUI_GL_CAPABILITIES.map((cap) => GL11.glIsEnabled(cap)),
		alphaFunc: GL11.glGetInteger(GL11.GL_ALPHA_TEST_FUNC),
		alphaRef: GL11.glGetFloat(GL11.GL_ALPHA_TEST_REF),
		depthFunc: GL11.glGetInteger(GL11.GL_DEPTH_FUNC),
		depthWrite: GL11.glGetBoolean(GL11.GL_DEPTH_WRITEMASK),
		blend: [
			GL14.GL_BLEND_SRC_RGB,
			GL14.GL_BLEND_DST_RGB,
			GL14.GL_BLEND_SRC_ALPHA,
			GL14.GL_BLEND_DST_ALPHA,
		].map((p) => GL11.glGetInteger(p)),
		color: [0, 1, 2, 3].map((i) => guiColorBuffer.get(i)),
		colorWrite: [0, 1, 2, 3].map((i) => guiColorMaskBuffer.get(i) !== 0),
		textureUnits: [GL13.GL_TEXTURE0, GL13.GL_TEXTURE1],
		textureEnabled: [] as boolean[],
		textureBinding: [] as number[],
		textureEnv: [] as number[],
		textureCoords: [] as number[][],
	};
	try {
		for (let unit = 0; unit < 2; unit++) {
			GL13.glActiveTexture(state.textureUnits[unit]);
			state.textureEnabled.push(GL11.glIsEnabled(GL11.GL_TEXTURE_2D));
			state.textureBinding.push(
				GL11.glGetInteger(GL11.GL_TEXTURE_BINDING_2D),
			);
			state.textureEnv.push(
				GL11.glGetTexEnvi(
					GL11.GL_TEXTURE_ENV,
					GL11.GL_TEXTURE_ENV_MODE,
				),
			);
			saveGuiMatrix(GL11.GL_CURRENT_TEXTURE_COORDS, guiColorBuffer);
			state.textureCoords.push(
				[0, 1, 2, 3].map((i) => guiColorBuffer.get(i)),
			);
		}
	} finally {
		GL13.glActiveTexture(activeTexture);
	}
	return state;
}

function setGuiCapability(capability: number, enabled: boolean): void {
	if (enabled) GL11.glEnable(capability);
	else GL11.glDisable(capability);
}

function restoreGuiAttributes(
	state: ReturnType<typeof saveGuiAttributes>,
): void {
	for (let i = 0; i < GUI_GL_CAPABILITIES.length; i++)
		setGuiCapability(GUI_GL_CAPABILITIES[i], state.enabled[i]);
	GL11.glAlphaFunc(state.alphaFunc, state.alphaRef);
	GL11.glDepthFunc(state.depthFunc);
	GL11.glDepthMask(state.depthWrite);
	GL11.glColorMask(
		state.colorWrite[0],
		state.colorWrite[1],
		state.colorWrite[2],
		state.colorWrite[3],
	);
	GL14.glBlendFuncSeparate(
		state.blend[0],
		state.blend[1],
		state.blend[2],
		state.blend[3],
	);
	GL11.glColor4f(
		state.color[0],
		state.color[1],
		state.color[2],
		state.color[3],
	);
	for (let unit = 0; unit < 2; unit++) {
		GL13.glActiveTexture(state.textureUnits[unit]);
		setGuiCapability(GL11.GL_TEXTURE_2D, state.textureEnabled[unit]);
		GL11.glBindTexture(GL11.GL_TEXTURE_2D, state.textureBinding[unit]);
		GL11.glTexEnvi(
			GL11.GL_TEXTURE_ENV,
			GL11.GL_TEXTURE_ENV_MODE,
			state.textureEnv[unit],
		);
		GL13.glMultiTexCoord4f(
			state.textureUnits[unit],
			state.textureCoords[unit][0],
			state.textureCoords[unit][1],
			state.textureCoords[unit][2],
			state.textureCoords[unit][3],
		);
	}
	GL13.glActiveTexture(state.activeTexture);
	// 1.12.2 also caches these states; restoring only the driver would leave
	// its texture/lighting cache inconsistent with subsequent rail rendering.
	SRBXApiCompat.syncGuiGLState(state);
}

function stopGuiOnGLError(stage: string): boolean {
	const error = GL11.glGetError();
	if (error === GL11.GL_NO_ERROR) return false;
	guiRenderingDisabled = true;
	NGTLog.debug(
		`[SuperRailBuilderX GUI] tool=${guiToolName} build=gui-gl-state-v3 disabled: stage=${stage}, error=${error}, ${guiGLState()}`,
	);
	// Drain only this error batch; diagnostics retain the codes rather than
	// repeatedly flooding Minecraft's Post render check every frame.
	for (let i = 0; i < 7; i++) {
		const next = GL11.glGetError();
		if (next === GL11.GL_NO_ERROR) break;
		NGTLog.debug(
			`[SuperRailBuilderX GUI] tool=${guiToolName} stage=${stage}, error=${next}`,
		);
	}
	return true;
}

function renderSharedGui(
	toolName: string,
	icon: ResourceLocation,
	rows: SRBXGuiRow[],
): void {
	if (guiRenderingDisabled) return;
	guiToolName = toolName;
	// An entry error belongs to earlier world/preview rendering, not this GUI.
	if (stopGuiOnGLError("entry-before-gui")) return;
	const mc = NGTUtilClient.getMinecraft();
	const size = getScaledGuiSize(mc);
	const width = size[0];
	const height = size[1];
	const worldFog = GL11.glIsEnabled(GL11.GL_FOG);
	const previousActiveTexture = GL11.glGetInteger(GL13.GL_ACTIVE_TEXTURE);
	const previousMatrixMode = GL11.glGetInteger(GL11.GL_MATRIX_MODE);
	const entryGLState = !guiRestoreDiagnosticReported ? guiGLState() : "";
	// Projection/texture stacks can already be full inside RTM's renderer.
	// Snapshot matrices without pushing onto (or popping) its stacks.
	saveGuiMatrix(GL11.GL_PROJECTION_MATRIX, guiProjectionMatrix);
	saveGuiMatrix(GL11.GL_MODELVIEW_MATRIX, guiModelViewMatrix);
	const attributes = saveGuiAttributes(previousActiveTexture);
	if (stopGuiOnGLError("save-attributes")) return;
	GL13.glActiveTexture(GL13.GL_TEXTURE1);
	GL11.glDisable(GL11.GL_TEXTURE_2D);
	GL13.glActiveTexture(GL13.GL_TEXTURE0);
	saveGuiMatrix(GL11.GL_TEXTURE_MATRIX, guiTextureMatrix);
	GL11.glMatrixMode(GL11.GL_PROJECTION);
	GL11.glLoadIdentity();
	GL11.glOrtho(0, width, height, 0, 1000, 3000);
	GL11.glMatrixMode(GL11.GL_MODELVIEW);
	GL11.glLoadIdentity();
	GL11.glTranslatef(0, 0, -1001);
	GL11.glMatrixMode(GL11.GL_TEXTURE);
	GL11.glLoadIdentity();
	GL11.glMatrixMode(GL11.GL_MODELVIEW);
	try {
		if (stopGuiOnGLError("setup-matrices")) return;
		GL11.glDisable(GL11.GL_LIGHTING);
		// This screen projection uses eye-space z=-1001. World fog would
		// replace GUI RGB with the sky color while still writing its depth.
		// The world's fog state is restored explicitly after drawing.
		GL11.glDisable(GL11.GL_FOG);
		if (!guiFogDiagnosticReported) {
			guiFogDiagnosticReported = true;
			NGTLog.debug(
				`[SuperRailBuilderX GUI] tool=${guiToolName} build=gui-gl-state-v3 fog isolated: worldFog=${worldFog}, guiFog=${GL11.glIsEnabled(GL11.GL_FOG)}, size=${width}x${height}, ${guiGLState()}`,
			);
		}
		GL11.glDisable(GL11.GL_CULL_FACE);
		GL11.glEnable(GL11.GL_ALPHA_TEST);
		GL11.glAlphaFunc(GL11.GL_GREATER, 0.01);
		GL11.glEnable(GL11.GL_DEPTH_TEST);
		GL11.glDepthFunc(GL11.GL_ALWAYS);
		GL11.glDepthMask(true);
		GL11.glColorMask(true, true, true, true);
		GL11.glEnable(GL11.GL_TEXTURE_2D);
		GL11.glTexEnvi(
			GL11.GL_TEXTURE_ENV,
			GL11.GL_TEXTURE_ENV_MODE,
			GL11.GL_MODULATE,
		);
		GL11.glEnable(GL11.GL_BLEND);
		GL11.glBlendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
		GL11.glColor4f(1, 1, 1, 1);
		if (stopGuiOnGLError("setup-attributes")) return;
		drawToolGuiBase(width, height, rows);
		if (stopGuiOnGLError("base-and-status-icons")) return;
		drawToolGuiIcon(width, icon);
		if (stopGuiOnGLError("tool-icon")) return;
		const font = mc.fontRenderer;
		const textX = Math.floor((width - font.getStringWidth(toolName)) / 2);
		SRBXApiCompat.drawGuiTextWithShadow(toolName, textX, 4, 0xffffff);
		if (stopGuiOnGLError("tool-title")) return;

		for (let row = 0; row < rows.length; row++) {
			// Java 8u51 Nashorn runs the enclosing finally on loop continue.
			// Keep optional rows in the loop without taking that exit path.
			const label = rows[row].label || "";
			if (label) {
				SRBXApiCompat.drawGuiTextWithShadow(
					label,
					width - GUI_TILE_SIZE - 4 - font.getStringWidth(label),
					GUI_TOOL_FRAME_SIZE + row * GUI_TILE_SIZE + 4,
					0xffffff,
				);
				if (stopGuiOnGLError(`status-text-${row}`)) return;
			}
		}
	} finally {
		GL11.glMatrixMode(GL11.GL_MODELVIEW);
		GL11.glLoadMatrix(guiModelViewMatrix);
		GL11.glMatrixMode(GL11.GL_PROJECTION);
		GL11.glLoadMatrix(guiProjectionMatrix);
		GL13.glActiveTexture(GL13.GL_TEXTURE0);
		GL11.glMatrixMode(GL11.GL_TEXTURE);
		GL11.glLoadMatrix(guiTextureMatrix);
		stopGuiOnGLError("restore-matrices");
		restoreGuiAttributes(attributes);
		GL13.glActiveTexture(previousActiveTexture);
		GL11.glMatrixMode(previousMatrixMode);
		stopGuiOnGLError("restore-attributes");
		if (!guiRestoreDiagnosticReported) {
			guiRestoreDiagnosticReported = true;
			NGTLog.debug(
				`[SuperRailBuilderX GUI] tool=${guiToolName} build=gui-gl-state-v3 restored: entry={${entryGLState}}, exit={${guiGLState()}}`,
			);
		}
	}
}

export class SRBXToolGui {
	static helpFooter(sender: ICommandSender): void {
		NGTLog.sendChatMessage(
			sender,
			"チャット欄を開いてスクロールすると、説明文の全文を確認できます。",
		);
	}
	static render(
		toolName: string,
		icon: ResourceLocation,
		rows: SRBXGuiRow[],
	): void {
		renderSharedGui(toolName, icon, rows);
	}
	static formatLength(value: number | null): string {
		return value !== null && isFinite(value) ? value.toFixed(2) + " m" : "";
	}
	static formatRadius(value: number | null): string {
		return value === null
			? ""
			: isFinite(value)
				? Math.round(Math.abs(value)) + " m"
				: "\u76f4\u7dda";
	}
}
