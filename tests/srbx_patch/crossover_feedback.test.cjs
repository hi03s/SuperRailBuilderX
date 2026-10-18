const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const builder = fs.readFileSync(dir + "render_builder1.js", "utf8");
const client = fs.readFileSync(dir + "SRBXCrossoverClient.js", "utf8");
function fn(source, name) {
	const start = source.indexOf("function " + name + "(");
	assert(start >= 0, name);
	return source.slice(start, source.indexOf("\n}", start) + 2);
}
let drawn;
const context = vm.createContext({
	builderB: true,
	crossoverBuilder: true,
	MAX_CURVE_RADIUS: 10000,
	DEFAULT_VERTICAL_CURVE_RADIUS: 1000,
	SRBXAcceleratedRepeat: class {},
	snapAngles: [1, 5],
	CROSSOVER_ICON: "crossover",
	GUI_BUILDER2_ICON: "builder2",
	GUI_TOOL_ICON: "builder1",
	SRBXToolGui: {
		render: (title, icon, rows) => {
			drawn = rows;
		},
	},
});
const names = builder.slice(
	builder.indexOf("var CROSSOVER_NAMES ="),
	builder.indexOf("function dataKey("),
);
vm.runInContext(
	names +
		fn(builder, "createDefaultState") +
		fn(builder, "resetState") +
		fn(builder, "renderToolGui"),
	context,
);
const state = context.createDefaultState();
Object.assign(state, {
	designLength: 111,
	curveRadius: 300,
	curveSide: -1,
	crossoverSpacing: 7,
	heightOffsetSixteenths: 8,
	crossoverSource: {},
	crossoverBase: [],
	selected: [{}],
	crossoverMode: 4,
	lastBuiltSelection: ["undo"],
});
context.resetState(state);
assert.equal(state.designLength, 40);
assert.equal(state.curveRadius, 10000);
assert.equal(state.crossoverSpacing, 4);
assert.equal(state.heightOffsetSixteenths, 0);
assert.equal(state.selected.length, 0);
assert.equal(state.crossoverSource, undefined);
assert.equal(state.crossoverBase, undefined);
assert.equal(state.lastBuiltSelection[0], "undo");
assert.match(
	fn(builder, "handleInput"),
	/if \(keys\.pressed\("clear"\)[\s\S]*?if \(crossoverBuilder\)\s*resetState\(state\)/,
);
for (let mode = 0; mode < 6; mode++) {
	state.crossoverMode = mode;
	context.renderToolGui(state, null, null);
	assert.equal(drawn[4].iconX, 6);
	assert.equal(drawn[4].iconY, 2);
	assert(drawn[4].label.endsWith(mode < 3 ? "右複線" : "左複線"));
}
let hover = null,
	highlights = [];
Object.assign(context, {
	highlightRail: (entity, tick, target, color, alpha) =>
		highlights.push({ target, color, alpha }),
});
vm.runInContext(
	client.slice(client.indexOf("var SRBXCrossoverClient =")),
	context,
);
context.SRBXCrossoverClient.base = () => hover;
const a = { railKey: "A", core: [0, 0, 0] },
	b = { railKey: "B", core: [1, 0, 0] };
hover = { source: a };
context.SRBXCrossoverClient.highlight({}, 0);
assert.deepEqual(
	highlights.map((x) => x.color),
	["ffff00"],
);
highlights = [];
context.SRBXCrossoverClient.highlight({}, 0, a);
assert.deepEqual(
	highlights.map((x) => x.color),
	["009999"],
);
highlights = [];
hover = { source: b };
context.SRBXCrossoverClient.highlight({}, 0, a);
assert.deepEqual(
	highlights.map((x) => x.color),
	["00ffff", "ffff00"],
);
console.log(
	"Crossover defaults/reset, six shape labels/icons and copy-style highlights passed",
);
