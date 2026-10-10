const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const source = fs.readFileSync(
	"dist/assets/minecraft/scripts/superrailbuilderx/render_builder1.js",
	"utf8",
);
const save = source.slice(
	source.indexOf("function saveGuiMatrix("),
	source.indexOf("function saveGuiMatrix(") +
		source.slice(source.indexOf("function saveGuiMatrix(")).indexOf("\n}") +
		2,
);
const draw = source.slice(
	source.indexOf("function drawGuiTile("),
	source.indexOf("function resultMessage("),
);

// Host projection/texture stacks are already at their minimum GL capacity (2).
// Any GUI push/pop would overflow or consume the host renderer's stack frame.
for (const failure of [
	null,
	"tile",
	"font",
	"attrib-full",
	"entry-gl",
	"tile-gl",
	"font-gl",
	"restore-gl",
]) {
	const matrices = {
		projection: [11, 12],
		modelview: [21, 22],
		texture0: [31, 32],
		texture1: [41, 42],
	};
	let mode = "texture",
		active = 1,
		fog = true;
	const attributes = [],
		labels = [],
		tiles = [];
	const diagnostics = [];
	let pendingError = failure === "entry-gl" ? 1284 : 0;
	const before = JSON.stringify(matrices);
	let textureEnabled = { 0: false, 1: true };
	const gl = new Proxy(
		{
			GL_PROJECTION: "projection",
			GL_MODELVIEW: "modelview",
			GL_TEXTURE: "texture",
			GL_PROJECTION_MATRIX: "projection",
			GL_MODELVIEW_MATRIX: "modelview",
			GL_TEXTURE_MATRIX: "texture",
			GL_MATRIX_MODE: "mode",
			GL_ACTIVE_TEXTURE: "active",
			GL_FOG: "fog",
			GL_ATTRIB_STACK_DEPTH: "attrib-depth",
			GL_MAX_ATTRIB_STACK_DEPTH: "attrib-max",
			GL_TEXTURE0: 0,
			GL_TEXTURE1: 1,
			GL_NO_ERROR: 0,
			GL_TEXTURE_2D: "texture-enabled",
			glGetError() {
				const error = pendingError;
				pendingError = 0;
				return error;
			},
			glGetInteger(p) {
				return p === "mode"
					? mode
					: p === "active"
						? active
						: p === "attrib-depth"
							? failure === "attrib-full"
								? 16
								: attributes.length
							: 16;
			},
			glIsEnabled() {
				return fog;
			},
			glActiveTexture(unit) {
				active = unit;
			},
			glMatrixMode(value) {
				mode = value;
			},
			glGetFloat(p, b) {
				b.data = [
					...matrices[p === "texture" ? `texture${active}` : p],
				];
			},
			glLoadMatrix(b) {
				matrices[mode === "texture" ? `texture${active}` : mode] = [
					...b.data,
				];
			},
			glLoadIdentity() {
				matrices[mode === "texture" ? `texture${active}` : mode] = [
					1, 0,
				];
			},
			glPushMatrix() {
				assert.fail("GUI must not push a full host matrix stack");
			},
			glPopMatrix() {
				assert.fail("GUI must not pop a host matrix frame");
			},
			glPushAttrib() {
				attributes.push({
					mode,
					active,
					fog,
					textureEnabled: { ...textureEnabled },
				});
			},
			glPopAttrib() {
				assert(attributes.length);
				({ mode, active, fog, textureEnabled } = attributes.pop());
				if (failure === "restore-gl") pendingError = 1284;
			},
			glDisable(p) {
				if (p === "fog") fog = false;
				if (p === "texture-enabled") textureEnabled[active] = false;
			},
			glEnable(p) {
				if (p === "texture-enabled") textureEnabled[active] = true;
			},
		},
		{
			get(t, p) {
				return p in t ? t[p] : p.startsWith("GL_") ? 1 : () => {};
			},
		},
	);
	const font = {
		func_78256_a: (s) => s.length * 6,
		func_78276_b(s, x, y, color) {
			assert.equal(fog, false);
			assert.equal(active, 0);
			assert.deepStrictEqual(textureEnabled, { 0: true, 1: false });
			assert.deepStrictEqual(matrices.texture0, [1, 0]);
			if (failure === "font") throw new Error("font failure");
			labels.push({ s, x, y, color });
			if (failure === "font-gl") pendingError = 1284;
		},
	};
	const context = {
		GL11: gl,
		GL13: gl,
		NGTLog: {
			debug(message) {
				diagnostics.push(message);
			},
		},
		guiFogDiagnosticReported: false,
		guiRenderingDisabled: false,
		guiRestoreDiagnosticReported: false,
		GUI_TILE_SIZE: 16,
		GUI_TOOL_FRAME_SIZE: 32,
		GUI_DRAW_TEXTURE_SIZE: 256,
		GUI_TEXTURE_SIZE: 512,
		GUI_BASE_TEXTURE: "base",
		GUI_TOOL_ICON: "icon",
		GUI_TOOL_NAME: "tool",
		MAX_CURVE_RADIUS: 10000,
		snapAngles: [1, 5, 15],
		toolGui: {
			func_73729_b(...args) {
				assert.equal(fog, false);
				if (failure === "tile") throw new Error("tile failure");
				tiles.push(args);
				if (failure === "tile-gl") pendingError = 1284;
			},
		},
		NGTUtilClient: {
			bindTexture() {},
			getMinecraft: () => ({ field_71466_p: font }),
		},
		getScaledGuiSize: () => [320, 240],
	};
	for (const name of [
		"guiProjectionMatrix",
		"guiModelViewMatrix",
		"guiTextureMatrix",
		"guiTileTextureMatrix",
		"guiIconTextureMatrix",
	])
		context[name] = { data: [], clear() {}, rewind() {} };
	vm.runInNewContext(save + draw, context);
	const render = () =>
		context.renderToolGui(
			{
				snapEnabled: true,
				snapAngleIndex: 1,
				curveRadiusLocked: true,
				curveRadius: 250,
				selected: [{}],
			},
			12.345,
		);
	if (failure === "tile" || failure === "font")
		assert.throws(render, new RegExp(failure + " failure"));
	else render();
	assert.equal(
		JSON.stringify(matrices),
		before,
		"all host matrices restored",
	);
	assert.equal(mode, "texture");
	assert.equal(active, 1);
	assert.equal(fog, true);
	assert.equal(attributes.length, 0);
	assert.deepStrictEqual(textureEnabled, { 0: false, 1: true });
	if (failure === "attrib-full") assert.equal(tiles.length, 0);
	if (failure && failure.endsWith("-gl")) {
		assert.equal(context.guiRenderingDisabled, true);
		assert(diagnostics.some((line) => line.includes("error=1284")));
		const expectedStage = {
			"entry-gl": "entry-before-gui",
			"tile-gl": "base-and-status-icons",
			"font-gl": "tool-title",
			"restore-gl": "restore-attributes",
		}[failure];
		assert(
			diagnostics.some((line) => line.includes(`stage=${expectedStage}`)),
		);
		const count = tiles.length;
		render();
		assert.equal(tiles.length, count, "GUI stops after a GL error");
	}
	if (!failure) {
		assert.deepStrictEqual(
			labels.map((x) => x.s),
			["tool", "5°", "250 m", "12.35 m"],
		);
		for (const label of labels.slice(1)) {
			assert.equal(label.color, 0xffffff);
			assert.equal(label.x + label.s.length * 6, 300);
		}
	}
}
console.log(
	"GUI state restoration, global texture attributes, GL error stages and fail-stop passed",
);
