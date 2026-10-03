const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const code = fs.readFileSync(
	"dist/assets/minecraft/scripts/superrailbuilderx/SRBXRailHighlight.js",
	"utf8",
);
const symbol = code.match(/(RTMX_COMPAT_\w+)\.SRBXApiCompat/)[1];
let geometry = true,
	nativeCalls = 0,
	attrs = 0,
	begin = 0,
	diagnostics = 0,
	fail = false;
const vertices = [];
const gl = {
	glPushAttrib: () => attrs++,
	glPopAttrib: () => attrs--,
	glDisable() {},
	glEnable() {},
	glBlendFunc() {},
	glColor4f() {},
	glLineWidth() {},
	glBegin: () => begin++,
	glEnd: () => begin--,
	glVertex3d(x, y, z) {
		if (fail) throw new Error("render interrupted");
		vertices.push([x, y, z]);
	},
};
const context = {
	Packages: {
		jp: {
			ngt: { ngtlib: { io: { NGTLog: { debug: () => diagnostics++ } } } },
		},
		org: { lwjgl: { opengl: { GL11: gl } } },
	},
	[symbol]: { SRBXApiCompat: { usesGeometryRailHighlight: () => geometry } },
	NGTOBuilderUtilClient: { renderRailMapHighlight: () => nativeCalls++ },
};
vm.createContext(context);
vm.runInContext(code, context);
const map = {
	getLength: () => 8,
	getRailPos: (n, i) => [10, 20 + (i / n) * 8],
	getRailHeight: () => 4,
};
const render = () => context.SRBXRailHighlight.render({}, map, "00ffff", 0.65);
render();
assert.strictEqual(nativeCalls, 0, "AE avoids physical-core model callbacks");
assert.deepStrictEqual(vertices[0], [20, 4.1, 10]);
assert.deepStrictEqual(
	vertices.at(-1),
	[28, 4.1, 10],
	"entire logical rail is highlighted",
);
fail = true;
render();
render();
assert.strictEqual(begin, 0, "interrupted draws finish glBegin");
assert.strictEqual(attrs, 0, "interrupted draws restore GL state");
assert.strictEqual(diagnostics, 1, "diagnostic is bounded");
geometry = false;
render();
assert.strictEqual(nativeCalls, 1, "KaizPatch keeps the existing renderer");
console.log("Logical rail highlight and legacy dispatch tests passed");
