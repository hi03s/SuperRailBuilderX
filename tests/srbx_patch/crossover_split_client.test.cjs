const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const source = fs
	.readFileSync(
		"dist/assets/minecraft/scripts/superrailbuilderx/render_rail_splitter.js",
		"utf8",
	)
	.replace(
		/RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_\w+\.SRBXApiCompat/g,
		"SRBXApiCompat",
	);
function fn(name) {
	const start = source.indexOf("function " + name + "(");
	assert(start >= 0, name);
	return source.slice(start, source.indexOf("\n}", start) + 2);
}
class Core {
	getRailCore() {
		return this;
	}
}
const core = new Core();
const state = { ignoredRailKeys: {} };
let look = { posX: 10, posY: 0, posZ: 0 };
const maps = [0, 4, 2].map((z) => ({
	getLength: () => 40,
	getNearlestPoint: (count, x) => (x * count) / 40,
	getRailPos: (count, i) => [z, (40 * i) / count],
	getRailHeight: () => 0,
}));
const plan = {
	markers: [
		[20, 0, 0],
		[20, 0, 4],
		[20, 0, 2],
	],
	lengths: [40, 42],
};
let availablePlan = plan;
const highlights = [],
	markers = [],
	labels = [];
const compat = {
	getWorld: () => ({}),
	getTileEntity: () => core,
	getRailPositionCandidateKey: () => "switch",
	getRailCorePos: () => [0, 0, 0],
	getEditableRailPositions: () => [{}, {}, {}, {}],
	getSingleCrossoverSplitPlan: () => availablePlan,
	getRailMapsForTool: () => maps,
	getLogicalRailMap: () => {
		throw Error("Switch must use all native maps");
	},
};
const context = vm.createContext({
	SRBXApiCompat: compat,
	TileEntityLargeRailBase: Core,
	NGTOBuilderUtilClient: { getLookingPos: () => look },
	getState: () => state,
	renderRailHighlight: (entity, tick, map, color) =>
		highlights.push({ map, color }),
	renderAt: (entity, tick, position, cursor) =>
		markers.push({ position, cursor }),
	hoverCursor: "hover",
	selectedCursor: "selected",
	GUI_TOOL_ICON: "icon",
	SRBXToolGui: {
		formatLength: (value) => (value === null ? "" : value.toFixed(2)),
		render: (name, icon, rows) => labels.push(rows.map((row) => row.label)),
	},
});
for (const name of [
	"railPoint",
	"findHoverTarget",
	"resolveSwitchCore",
	"renderCrossoverTarget",
	"renderToolGui",
])
	vm.runInContext(fn(name), context);
const hover = context.findHoverTarget({}, 0);
assert(hover.fourPointSwitch && hover.splittable);
assert.equal(hover.ratio, 0.5);
context.renderCrossoverTarget({}, 0, hover, false, true);
assert.deepEqual(
	highlights.map((h) => h.map),
	maps,
	"Every native route is highlighted",
);
assert(highlights.every((h) => h.color === "ffff00"));
assert.deepEqual(
	markers.map((m) => m.position),
	plan.markers,
	"Three fixed midpoint markers",
);
look = { posX: 35, posY: 0, posZ: 4 };
const otherHover = context.findHoverTarget({}, 0);
markers.length = highlights.length = 0;
context.renderCrossoverTarget({}, 0, otherHover, true, false);
assert.deepEqual(
	markers.map((m) => m.position),
	plan.markers,
	"Cursor does not move split locations",
);
assert(highlights.every((h) => h.color === "00ffff"));
assert(markers.every((m) => m.cursor === "selected"));
highlights.length = 0;
context.renderCrossoverTarget({}, 0, otherHover, true, true);
assert(
	highlights.every((h) => h.color === "009999"),
	"Selected hover uses deselection color",
);
context.renderToolGui(hover);
assert.deepEqual(labels.pop(), ["20.00", "21.00"]);
availablePlan = null;
const scissors = context.findHoverTarget({}, 0);
assert(scissors.fourPointSwitch && !scissors.splittable);
markers.length = highlights.length = 0;
assert.equal(context.renderCrossoverTarget({}, 0, scissors, false, true), null);
assert.equal(markers.length, 0, "Unsupported scissors have no split markers");
assert.equal(
	highlights.length,
	3,
	"Unsupported four-point switches remain visible",
);
state.ignoredRailKeys.switch = true;
assert.equal(
	context.findHoverTarget({}, 0),
	null,
	"Removed switch ghosts cannot be selected",
);
console.log(
	"Crossover split client: all routes, fixed midpoint cursors, colors, lengths and unsupported selection passed",
);
