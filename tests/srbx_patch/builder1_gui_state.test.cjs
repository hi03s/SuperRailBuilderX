const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const source = fs.readFileSync(
	"dist/assets/minecraft/scripts/superrailbuilderx/render_builder1.js",
	"utf8",
);
const start = source.indexOf("function saveGuiMatrix(");
const save = source.slice(
	start,
	start + source.slice(start).indexOf("\n}") + 2,
);
const draw = source.slice(
	source.indexOf("function drawGuiTile("),
	source.indexOf("function resultMessage("),
);
assert(
	!/gl(Push|Pop)(Attrib|Matrix)\(/.test(draw),
	"GUI must use no native stacks",
);
let snapshot;
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
		pendingError = failure === "entry-gl" ? 1284 : 0;
	const attrs = {
		enabled: {
			GL_LIGHTING: true,
			GL_FOG: true,
			GL_CULL_FACE: false,
			GL_ALPHA_TEST: false,
			GL_DEPTH_TEST: true,
			GL_BLEND: false,
		},
		alphaFunc: 37,
		alphaRef: 0.3,
		depthFunc: 42,
		depthWrite: false,
		blend: [3, 4, 5, 6],
		color: [0.2, 0.3, 0.4, 0.5],
		colorWrite: [true, false, true, false],
		textureEnabled: [false, true],
		textureBinding: [51, 61],
		textureEnv: [71, 81],
		textureCoords: [
			[0.1, 0.2, 0.3, 0.4],
			[0.6, 0.7, 0.8, 0.9],
		],
	};
	const before = JSON.stringify({ matrices, attrs }),
		tiles = [],
		labels = [],
		diagnostics = [];
	const query = {
		GL_ALPHA_TEST_FUNC: "alphaFunc",
		GL_ALPHA_TEST_REF: "alphaRef",
		GL_DEPTH_FUNC: "depthFunc",
		GL_DEPTH_WRITEMASK: "depthWrite",
		GL_CURRENT_COLOR: "color",
		GL_COLOR_WRITEMASK: "colorWrite",
	};
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
			GL_TEXTURE0: 0,
			GL_TEXTURE1: 1,
			GL_NO_ERROR: 0,
			glGetError() {
				const error = pendingError;
				pendingError = 0;
				return error;
			},
			glGetInteger(p) {
				if (p === "mode") return mode;
				if (p === "active") return active;
				if (p === "GL_ATTRIB_STACK_DEPTH")
					return failure === "attrib-full" ? 16 : 0;
				if (p === "GL_TEXTURE_BINDING_2D")
					return attrs.textureBinding[active];
				const i = [
					"GL_BLEND_SRC_RGB",
					"GL_BLEND_DST_RGB",
					"GL_BLEND_SRC_ALPHA",
					"GL_BLEND_DST_ALPHA",
				].indexOf(p);
				return i >= 0
					? attrs.blend[i]
					: p in query
						? attrs[query[p]]
						: 16;
			},
			glIsEnabled(p) {
				return p === "GL_TEXTURE_2D"
					? attrs.textureEnabled[active]
					: attrs.enabled[p];
			},
			glActiveTexture(unit) {
				active = unit;
			},
			glMatrixMode(value) {
				mode = value;
			},
			glGetFloat(p, b) {
				if (!b) return attrs[query[p]];
				if (p === "GL_CURRENT_TEXTURE_COORDS") {
					b.data = [...attrs.textureCoords[active]];
					return;
				}
				b.data = [
					...(p === "GL_CURRENT_COLOR"
						? attrs.color
						: matrices[p === "texture" ? "texture" + active : p]),
				];
			},
			glGetBoolean(p, b) {
				if (b) b.data = attrs.colorWrite.map((v) => (v ? 1 : 0));
				else return attrs[query[p]];
			},
			glGetTexEnvi() {
				return attrs.textureEnv[active];
			},
			glLoadMatrix(b) {
				matrices[mode === "texture" ? "texture" + active : mode] = [
					...b.data,
				];
			},
			glLoadIdentity() {
				matrices[mode === "texture" ? "texture" + active : mode] = [
					1, 0,
				];
			},
			glPushMatrix() {
				assert.fail("No GUI matrix push");
			},
			glPopMatrix() {
				assert.fail("No GUI matrix pop");
			},
			glPushAttrib() {
				assert.fail("No GUI attribute push");
			},
			glPopAttrib() {
				assert.fail("No GUI attribute pop");
			},
			glDisable(p) {
				if (p === "GL_TEXTURE_2D") attrs.textureEnabled[active] = false;
				else attrs.enabled[p] = false;
			},
			glEnable(p) {
				if (p === "GL_TEXTURE_2D") attrs.textureEnabled[active] = true;
				else attrs.enabled[p] = true;
			},
			glAlphaFunc(f, r) {
				attrs.alphaFunc = f;
				attrs.alphaRef = r;
			},
			glDepthFunc(f) {
				attrs.depthFunc = f;
			},
			glDepthMask(v) {
				attrs.depthWrite = v;
			},
			glColorMask(...v) {
				attrs.colorWrite = v;
			},
			glColor4f(...v) {
				attrs.color = v;
			},
			glBlendFunc(s, d) {
				attrs.blend = [s, d, s, d];
			},
			glBlendFuncSeparate(...v) {
				attrs.blend = v;
			},
			glTexEnvi(t, p, v) {
				attrs.textureEnv[active] = v;
			},
			glBindTexture(t, id) {
				attrs.textureBinding[active] = id;
			},
			glMultiTexCoord4f(unit, ...v) {
				attrs.textureCoords[unit] = v;
			},
		},
		{
			get(t, p) {
				return p in t ? t[p] : p.startsWith("GL_") ? p : () => {};
			},
		},
	);
	const font = {
		func_78256_a: (s) => s.length * 6,
		func_78276_b(s, x, y, color) {
			assert.equal(attrs.enabled.GL_FOG, false);
			assert.equal(active, 0);
			assert.deepStrictEqual(attrs.textureEnabled, [true, false]);
			assert.deepStrictEqual(matrices.texture0, [1, 0]);
			if (failure === "font") throw new Error("font failure");
			attrs.textureBinding[0] = 103;
			attrs.textureCoords[0] = [0, 0, 0, 1];
			labels.push({ s, x, y, color });
			if (failure === "font-gl") pendingError = 1284;
		},
	};
	const compat = {
		drawGuiTextWithShadow(...args) {
			font.func_78261_a(...args);
		},
		syncGuiGLState(state) {
			snapshot = state;
			if (failure === "restore-gl") pendingError = 1284;
		},
	};
	font.func_78261_a = font.func_78276_b;
	const context = {
		GL11: gl,
		GL13: gl,
		GL14: gl,
		RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_1js5ute: {
			SRBXApiCompat: compat,
		},
		NGTLog: { debug: (s) => diagnostics.push(s) },
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
			func_73729_b(...v) {
				if (failure === "tile") throw new Error("tile failure");
				tiles.push(v);
				if (failure === "tile-gl") pendingError = 1284;
			},
		},
		NGTUtilClient: {
			bindTexture(t) {
				attrs.textureBinding[active] = t === "base" ? 101 : 102;
			},
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
		"guiColorBuffer",
		"guiColorMaskBuffer",
	])
		context[name] = {
			data: [],
			clear() {},
			rewind() {},
			get(i) {
				return this.data[i];
			},
		};
	vm.runInNewContext(save + draw, context);
	const render = () =>
		context.renderToolGui(
			{
				snapMode: "distance",
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
		JSON.stringify({ matrices, attrs }),
		before,
		"complete host state restored",
	);
	assert.equal(mode, "texture");
	assert.equal(active, 1);
	if (failure && failure.endsWith("-gl")) {
		assert.equal(context.guiRenderingDisabled, true);
		const stage = {
			"entry-gl": "entry-before-gui",
			"tile-gl": "base-and-status-icons",
			"font-gl": "tool-title",
			"restore-gl": "restore-attributes",
		}[failure];
		assert(
			diagnostics.some(
				(s) => s.includes("stage=" + stage) && s.includes("error=1284"),
			),
		);
		const count = tiles.length;
		render();
		assert.equal(tiles.length, count, "GUI stops on GL error");
	}
	if (!failure || failure === "attrib-full") {
		assert.deepStrictEqual(
			labels.map((l) => l.s),
			["tool", "5°", "250 m", "12.35 m"],
		);
		assert.equal(
			labels[0].color,
			0xffffff,
			"Tool title is white with shadow",
		);
		for (const l of labels.slice(1)) {
			assert.equal(l.color, 0xffffff);
			assert.equal(l.x + l.s.length * 6, 300);
		}
		// Restore twice more: restoration itself must not consume any host stack.
		context.restoreGuiAttributes(snapshot);
		context.restoreGuiAttributes(snapshot);
		assert.equal(
			JSON.stringify(attrs),
			JSON.stringify(JSON.parse(before).attrs),
		);
		labels.length = 0;
		context.renderToolGui(
			{
				snapMode: "off",
				snapAngleIndex: 1,
				curveRadiusLocked: false,
				selected: [{}],
			},
			12.345,
			500.6,
		);
		assert.deepStrictEqual(
			labels.map((l) => l.s),
			["tool", "501 m", "12.35 m"],
		);
		assert.equal(JSON.stringify({ matrices, attrs }), before);
		for (const locked of [false, true]) {
			labels.length = 0;
			context.renderToolGui(
				{
					snapMode: "block",
					snapAngleIndex: 0,
					curveRadiusLocked: locked,
					curveRadius: 10000,
					selected: [{}],
				},
				12.345,
				Infinity,
			);
			assert.deepStrictEqual(
				labels.map((l) => l.s),
				["tool", "ブロック", "直線", "12.35 m"],
			);
			assert.equal(JSON.stringify({ matrices, attrs }), before);
		}
	}
}

// Verify emitted SRG names and cache synchronization on both 1.12.2 targets.
for (const target of ["mc1122", "appleextended"]) {
	const dir =
		"dist/assets/minecraft/__targets__/" +
		target +
		"/scripts/superrailbuilderx";
	const file = fs
		.readdirSync(dir)
		.find((n) => n.startsWith("SRBXApiCompat.__rtmx_"));
	const code = fs.readFileSync(dir + "/" + file, "utf8");
	const start = code.indexOf("SRBXApiCompat.syncGuiGLState = function");
	const method = code.slice(start, code.indexOf("};", start) + 2);
	assert(
		!/GlStateManager\.(alphaFunc|depthFunc|depthMask|colorMask|tryBlendFuncSeparate|color|setActiveTexture|bindTexture)\(/.test(
			method,
		),
		"production output must use SRG names",
	);
	const calls = [];
	const manager = new Proxy(
		{},
		{
			get:
				(t, p) =>
				(...args) =>
					calls.push([p, ...args]),
		},
	);
	const c = {
		SRBXApiCompat: {},
		Packages: {
			net: {
				minecraft: {
					client: { renderer: { GlStateManager: manager } },
				},
			},
		},
	};
	vm.runInNewContext(method, c);
	c.SRBXApiCompat.syncGuiGLState(snapshot);
	assert(
		calls.some(
			(c) =>
				c[0] === "func_179144_i" && c[1] === snapshot.textureBinding[0],
		),
	);
	assert.deepStrictEqual(calls.at(-1), [
		"func_179138_g",
		snapshot.activeTexture,
	]);
}
for (const target of ["kaizpatch", "mc1710", "mc1122", "appleextended"]) {
	const dir =
		"dist/assets/minecraft/__targets__/" +
		target +
		"/scripts/superrailbuilderx";
	const file = fs
		.readdirSync(dir)
		.find((n) => n.startsWith("SRBXApiCompat.__rtmx_"));
	const code = fs.readFileSync(dir + "/" + file, "utf8");
	const start = code.indexOf(
		"SRBXApiCompat.drawGuiTextWithShadow = function",
	);
	const method = code.slice(start, code.indexOf("};", start) + 2);
	const name =
		target === "kaizpatch" || target === "mc1710"
			? "func_78261_a"
			: "func_175063_a";
	assert(
		method.includes("." + name + "("),
		"Correct version-specific shadow SRG call",
	);
}
console.log(
	"GUI stack-free restoration, repeated restore, GL guards and 1.12.2 cache/SRG synchronization passed",
);
