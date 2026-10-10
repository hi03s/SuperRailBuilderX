// Run with the game's jjs -scripting (Java 8u51) after pnpm build.
// Driver calls are mocked; the actual legacy JS engine executes the GUI code.
var source = readFully(
	"dist/assets/minecraft/scripts/superrailbuilderx/SRBXToolGui.js"
);
var start = source.indexOf("function saveGuiMatrix(");
var code =
	source.slice(start, start + source.slice(start).indexOf("\n}") + 2) +
	source.slice(source.indexOf("function drawGuiTile("), source.length);
var GL11 = {},
	GL13 = GL11,
	GL14 = GL11,
	mode = "",
	active = 0,
	projected = false;
var refs = code.match(/GL(?:11|13|14)\.[A-Za-z0-9_]+/g);
for (var i = 0; i < refs.length; i++) {
	var name = refs[i].split(".")[1];
	GL11[name] = name.indexOf("GL_") === 0 ? name : function () {};
}
GL11.GL_TEXTURE0 = 0;
GL11.GL_TEXTURE1 = 1;
GL11.GL_NO_ERROR = 0;
GL11.glGetError = function () {
	return 0;
};
GL11.glIsEnabled = function () {
	return true;
};
GL11.glGetInteger = function (p) {
	return p === "GL_MATRIX_MODE"
		? mode
		: p === "GL_ACTIVE_TEXTURE"
			? active
			: 1;
};
GL11.glGetFloat = function (p, b) {
	if (b) b.data = [1, 1, 1, 1];
	else return 1;
};
GL11.glGetBoolean = function (p, b) {
	if (b) b.data = [1, 1, 1, 1];
	else return true;
};
GL11.glGetTexEnvi = function () {
	return 1;
};
GL11.glMatrixMode = function (p) {
	mode = p;
};
GL11.glActiveTexture = function (p) {
	active = p;
};
GL11.glOrtho = function () {
	projected = true;
};
GL11.glLoadMatrix = function () {
	if (mode === "GL_PROJECTION") projected = false;
};
function buffer() {
	return {
		data: [],
		clear: function () {},
		rewind: function () {},
		get: function (i) {
			return this.data[i];
		}
	};
}
var guiProjectionMatrix = buffer(),
	guiModelViewMatrix = buffer(),
	guiTextureMatrix = buffer();
var guiTileTextureMatrix = buffer(),
	guiIconTextureMatrix = buffer(),
	guiColorBuffer = buffer(),
	guiColorMaskBuffer = buffer();
var guiFogDiagnosticReported = false,
	guiRenderingDisabled = false,
	guiRestoreDiagnosticReported = false;
var GUI_TILE_SIZE = 16,
	GUI_TOOL_FRAME_SIZE = 32,
	GUI_DRAW_TEXTURE_SIZE = 256,
	GUI_TEXTURE_SIZE = 512;
var GUI_BASE_TEXTURE = "base",
	GUI_TOOL_ICON = "icon",
	GUI_TOOL_NAME = "tool",
	MAX_CURVE_RADIUS = 10000,
	snapAngles = [1, 5, 15];
var toolGui = { func_73729_b: function () {} },
	NGTLog = { debug: function () {} },
	labels = [];
function checkProjection() {
	if (!projected)
		throw new Error("Text rendered after premature finally restoration");
}
var font = {
	func_78256_a: function (s) {
		return s.length * 6;
	},
	func_78276_b: checkProjection,
	func_78261_a: function (s) {
		checkProjection();
		if (s !== "tool") labels.push(s);
	}
};
var NGTUtilClient = {
	bindTexture: function () {},
	getMinecraft: function () {
		return { field_71466_p: font };
	}
};
function getScaledGuiSize() {
	return [320, 240];
}
var RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_1js5ute = {
	SRBXApiCompat: {
		syncGuiGLState: function () {},
		drawGuiTextWithShadow: function (s, x, y, color) {
			font.func_78261_a(s, x, y, color);
		}
	}
};
var builder = readFully(
	"dist/assets/minecraft/scripts/superrailbuilderx/render_builder1.js"
);
code += builder.slice(
	builder.indexOf("function renderToolGui("),
	builder.indexOf("function resultMessage(")
);
eval(code);
var cases = [
	["off", true, 1, 250, 500.6, ["250 m", "12.35 m"]],
	["off", false, 1, 250, 500.6, ["501 m", "12.35 m"]],
	["off", false, 2, 250, Infinity, ["\u76f4\u7dda", "12.35 m"]],
	["distance", false, 0, 250, null, ["5\u00b0"]],
	["block", false, 0, 250, null, ["\u30d6\u30ed\u30c3\u30af"]]
];
for (var c = 0; c < cases.length; c++) {
	var test = cases[c];
	labels = [];
	renderToolGui(
		{
			snapMode: test[0],
			snapAngleIndex: 1,
			curveRadiusLocked: test[1],
			curveRadius: test[3],
			selected: new Array(test[2])
		},
		12.345,
		test[4]
	);
	if (JSON.stringify(labels) !== JSON.stringify(test[5]))
		throw new Error("Label mismatch: " + JSON.stringify(labels));
	if (projected) throw new Error("Projection not restored");
}
print(
	"Legacy Nashorn GUI OFF/ON, preview radius, straight radius, shadow labels and projection restoration passed"
);

// Execute all five adapters through the same legacy engine and shared GL renderer.
var otherCases = [
	["rail_splitter", [null], ["\u7dda\u8def\u5206\u5272"]],
	[
		"rail_splitter",
		[{ length: 100, ratio: 0.25 }],
		["\u7dda\u8def\u5206\u5272", "25.00 m", "75.00 m"]
	],
	["rail_mover", [{ snapEnabled: false }], ["\u7dda\u8def\u79fb\u52d5"]],
	[
		"double_track_copy",
		[{ spacing: 4 }],
		["\u8907\u7dda\u30b3\u30d4\u30fc", "\u9593\u9694:4.0m"]
	],
	[
		"cant_formatter",
		[{ speed: 100, gaugeIndex: 0 }],
		[
			"\u30ab\u30f3\u30c8\u6574\u5f62",
			"\u8a2d\u8a08\u901f\u5ea6:100km/h",
			"\u7a2e\u985e:1067mm"
		]
	],
	[
		"branch_builder",
		[{ locked: false, split: {} }, 12.345, Infinity],
		["\u5206\u5c90\u751f\u6210", "\u76f4\u7dda", "12.35 m"]
	],
	[
		"branch_builder",
		[{ locked: true, radius: 10000, split: null }, null, null],
		["\u5206\u5c90\u751f\u6210", "\u76f4\u7dda"]
	]
];
var MAX_RADIUS = 10000;
for (var n = 0; n < otherCases.length; n++) {
	var testCase = otherCases[n];
	var toolSource = readFully(
		"dist/assets/minecraft/scripts/superrailbuilderx/render_" +
			testCase[0] +
			".js"
	);
	if (testCase[0] === "cant_formatter")
		eval(
			toolSource.slice(
				toolSource.indexOf("var GAUGES ="),
				toolSource.indexOf("var states =")
			)
		);
	var adapterStart = toolSource.indexOf("function renderToolGui(");
	eval(
		toolSource.slice(
			adapterStart,
			toolSource.indexOf("\n}", adapterStart) + 2
		)
	);
	labels = [];
	renderToolGui.apply(null, testCase[1]);
	if (JSON.stringify(labels) !== JSON.stringify(testCase[2]))
		throw new Error("Tool label mismatch: " + JSON.stringify(labels));
	if (projected) throw new Error("Tool projection not restored");
}
print(
	"Legacy Nashorn all five tool adapters, empty rows and shared projection restoration passed"
);
