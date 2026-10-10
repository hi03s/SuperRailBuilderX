const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const read = (name) => fs.readFileSync(dir + name + ".js", "utf8");
let drawn;
const context = vm.createContext({
	GUI_TOOL_ICON: "icon",
	MAX_RADIUS: 10000,
	snapAngles: [1, 5, 15],
	renderSharedGui: (title, icon, rows) => {
		drawn = JSON.parse(JSON.stringify({ title, icon, rows }));
	},
});
const shared = read("SRBXToolGui");
vm.runInContext(shared.slice(shared.indexOf("var SRBXToolGui =")), context);
const fn = (source, name) => {
	const start = source.indexOf("function " + name + "(");
	assert(start >= 0, name);
	return source.slice(start, source.indexOf("\n}", start) + 2);
};
const load = (tool) => {
	const code = read("render_" + tool);
	vm.runInContext(fn(code, "renderToolGui"), context);
	return code;
};
load("rail_splitter");
context.renderToolGui(null);
assert.deepStrictEqual(
	drawn.rows.map((r) => r.label),
	["", ""],
);
const selected = { length: 100, ratio: 0.25, splittable: true };
context.renderToolGui(selected);
assert.deepStrictEqual(
	drawn.rows.map((r) => r.label),
	["25.00 m", "75.00 m"],
);
assert(
	drawn.rows.every(
		(r) => r.iconX === 4 && r.iconY === 2 && r.enabled === undefined,
	),
);
// Exercise actual render gating and the hover-to-selected path, including invalid targets.
const host = {};
let state = { selected: null },
	hover = selected;
let screen = null;
const compat = {
	getWorld: () => ({ func_73045_a: () => host }),
	doFollowing: () => {},
};
Object.assign(context, {
	RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_1js5ute: {
		SRBXApiCompat: compat,
	},
	MCWrapperClient: { getPlayer: () => host },
	NGTUtilClient: { getMinecraft: () => ({ field_71462_r: screen }) },
	body: { render: () => {} },
	renderer: { currentMatId: 0 },
	getState: () => state,
	findHoverTarget: () => hover,
	resolveMap: () => ({}),
	renderRailHighlight: () => {},
	renderAt: () => {},
	railPoint: () => [],
	renderLengthPanel: () => {},
	hoverCursor: {},
	selectedCursor: {},
	Mouse: { isButtonDown: () => false },
	keys: { update: () => {} },
	handleInput: () => {},
});
vm.runInContext(fn(read("render_rail_splitter"), "render"), context);
const data = {
	getString: () => "1",
	getBoolean: () => false,
	setBoolean: () => {},
};
const entity = { getResourceState: () => ({ getDataMap: () => data }) };
context.render(entity, 0, 0);
assert.deepStrictEqual(
	drawn.rows.map((r) => r.label),
	["25.00 m", "75.00 m"],
	"Hover previews both lengths",
);
state.selected = { ...selected, ratio: 0.6 };
context.render(entity, 0, 0);
assert.deepStrictEqual(
	drawn.rows.map((r) => r.label),
	["60.00 m", "40.00 m"],
	"Selected split takes precedence over hover",
);
state.selected = null;
hover = { ...selected, splittable: false };
context.render(entity, 0, 0);
assert.deepStrictEqual(
	drawn.rows.map((r) => r.label),
	["", ""],
	"No split cursor means no lengths",
);
for (const [pass, material, open] of [
	[1, 0, null],
	[0, 1, null],
	[0, 0, {}],
]) {
	drawn = null;
	context.renderer.currentMatId = material;
	screen = open;
	context.render(entity, pass, 0);
	assert.equal(
		drawn,
		null,
		"GUI only draws once on main pass and outside Minecraft screens",
	);
}
load("rail_mover");
for (const enabled of [false, true]) {
	context.renderToolGui({ snapEnabled: enabled });
	assert.deepStrictEqual(drawn.rows, [{ iconX: 4, iconY: 0, enabled }]);
}
const copy = load("double_track_copy");
for (const spacing of [0.1, 4, 8.5]) {
	context.renderToolGui({ spacing });
	assert.equal(drawn.rows[0].label, `間隔:${spacing.toFixed(1)}m`);
}
assert(!copy.includes("showSpacing"), "Spacing changes do not print to chat");
const cant = load("cant_formatter");
vm.runInContext(
	cant.slice(cant.indexOf("var GAUGES ="), cant.indexOf("var states =")),
	context,
);
for (let gaugeIndex = 0; gaugeIndex < context.GAUGES.length; gaugeIndex++) {
	context.renderToolGui({ speed: 123, gaugeIndex });
	assert.equal(drawn.rows[0].label, "設計速度:123km/h");
	assert.deepStrictEqual([drawn.rows[0].iconX, drawn.rows[0].iconY], [5, 0]);
	assert.equal(
		drawn.rows[1].label,
		"種類:" + context.GAUGES[gaugeIndex].name,
	);
}
const branch = load("branch_builder");
context.renderToolGui(
	{ snapMode: "block", locked: false, split: null },
	null,
	null,
);
assert.equal(drawn.rows[0].label, "ブロック");
assert.equal(drawn.rows[0].enabled, true);
context.renderToolGui(
	{ snapMode: "distance", snapIndex: 1, locked: false, split: null },
	null,
	null,
);
assert.equal(drawn.rows[0].label, "5°");
context.renderToolGui(
	{ snapMode: "off", locked: false, split: null },
	null,
	null,
);
assert.deepStrictEqual(
	drawn.rows.map((r) => r.label),
	["", "", ""],
);
context.renderToolGui(
	{ snapMode: "off", locked: false, split: {} },
	20.123,
	-250.6,
);
assert.deepStrictEqual(
	drawn.rows.map((r) => r.label),
	["", "251 m", "20.12 m"],
);
context.renderToolGui(
	{ snapMode: "off", locked: true, radius: 10000, split: {} },
	null,
	250,
);
assert.deepStrictEqual(
	drawn.rows.map((r) => r.label),
	["", "直線", "0.00 m"],
);
assert.equal(drawn.rows[1].enabled, true);
context.renderToolGui(
	{ snapMode: "off", locked: false, split: {} },
	5,
	Infinity,
);
assert.equal(drawn.rows[1].label, "直線");
// Length is accumulated on the actual displayed 3D polyline, including curved/sloped paths.
vm.runInContext(read("SRBXMath"), context);
vm.runInContext(fn(branch, "preview"), context);
let segments = [];
context.segment = (e, pt, a, b) =>
	segments.push([Array.from(a), Array.from(b)]);
const a = {
	position: [0, 0, 0],
	anchorYaw: 90,
	anchorPitch: 0,
	anchorLength: 6,
};
const b = {
	position: [10, 3, 10],
	anchorYaw: 180,
	anchorPitch: -5,
	anchorLength: 6,
};
const length = context.preview({}, 0, a, b);
const displayed = segments.reduce(
	(sum, [a, b]) => sum + Math.hypot(...a.map((v, i) => v - b[i])),
	0,
);
assert.equal(segments.length, 48);
assert(Math.abs(length - displayed) < 1e-9);
assert(length > context.SRBXMath.distance(a.position, b.position));
console.log(
	"All tool GUI rows, split hover/selection, pass gating and branch 3D preview length passed",
);
