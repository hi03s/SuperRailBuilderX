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
assert.equal(state.designLength, 60);
context.crossoverBuilder = false;
assert.equal(context.createDefaultState().designLength, 40);
context.crossoverBuilder = true;
vm.runInContext(fn(builder, "changeDesignLength"), context);
for (const delta of [-0.1, -1, -10, -100, -1000]) {
	state.designLength = 30;
	context.changeDesignLength(state, delta);
	assert.equal(state.designLength, 30, "all repeat units stop at 30m");
}
state.designLength = 511;
context.changeDesignLength(state, 100);
assert.equal(state.designLength, 512);
context.crossoverBuilder = false;
state.designLength = 2;
context.changeDesignLength(state, -100);
assert.equal(state.designLength, 1, "builder B keeps its own lower limit");
context.crossoverBuilder = true;
context.resetState(state);
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
	client
		.slice(client.indexOf("var SRBXCrossoverClient ="))
		.replace(
			/RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_\w+\.SRBXApiCompat/g,
			"SRBXApiCompat",
		),
	context,
);
class RailTile {
	getRailCore() {
		return this;
	}
}
const baseTile = new RailTile();
let horizontal = true;
Object.assign(context, {
	TileEntityLargeRailBase: RailTile,
	findHoverRail: () => ({ core: [1, 2, 3], railKey: "base" }),
	sourcePoint: (rp) => rp,
	SRBXCrossoverGeometry: { flat: () => true },
	SRBXApiCompat: {
		getWorld: () => ({}),
		getTileEntity: () => baseTile,
		getRailPositionUnsupportedReason: () => "",
		getEditableRailPositions: () => [
			{ position: [0, 0, 0] },
			{ position: [0, 0, 60] },
		],
		isHorizontalBuilderRail: () => horizontal,
	},
});
assert.equal(context.SRBXCrossoverClient.base({}, 0).source.railKey, "base");
horizontal = false;
assert.equal(context.SRBXCrossoverClient.base({}, 0), null);
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

const server = fs
	.readFileSync(dir + "server_crossover_builder.js", "utf8")
	.replace(
		/RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_\w+\.SRBXApiCompat/g,
		"SRBXApiCompat",
	);
let calls = 0;
const serverContext = vm.createContext({
	SRBXApiCompat: {
		getWorld: () => ({}),
		createCrossoverBuilderRail: () => {
			calls++;
			return { status: "ok", undoToken: "must-not-be-retained" };
		},
		undoCrossoverBuilderRail: () => {
			throw new Error("disabled Undo must never call native mutation");
		},
	},
});
vm.runInContext(fn(server, "process"), serverContext);
assert.equal(
	serverContext.process({}, {}, { action: "undo" }),
	"undo_disabled",
);
assert.equal(
	serverContext.process({}, {}, { action: "create", plan: {} }),
	"ok",
);
assert.equal(
	serverContext.process({}, {}, { action: "undo" }),
	"undo_disabled",
);
assert.equal(calls, 1);
assert(
	!server.includes("undos"),
	"server keeps no successful generation Undo tokens",
);
assert(!server.includes('"crossoverBuilderCanUndo", true'));
assert.match(
	fn(builder, "handleInput"),
	/!crossoverBuilder\s*&&\s*keys\.pressed\("undo"\)/,
);
assert.match(
	fn(builder, "init"),
	/if \(!crossoverBuilder\)\s*keys\.register\("undo"/,
);
assert(
	!fn(builder, "showHelp")
		.split("if (SRBXApiCompat.requiresRailBoundarySnap())")[0]
		.includes("[Ctrl+Z]"),
);
console.log(
	"Crossover minimum length and disabled Undo request/input regression passed",
);

// A failed free crossover has no restored source. Older servers sent
// refreshed:[null]; render callbacks must finish handling that failure.
for (const [file, kind] of [
	["render_builder1.js", "crossover"],
	["render_branch_builder.js", "branch"],
	["render_rail_splitter.js", "splitter"],
]) {
	const code = fs
		.readFileSync(dir + file, "utf8")
		.replace(
			/RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_\w+\.SRBXApiCompat/g,
			"SRBXApiCompat",
		);
	for (const payload of [
		{ removed: [], refreshed: [null] },
		{
			removed: [
				null,
				{ core: [1, 2, 3], key: "old" },
				{ core: [4, 5, 6], key: "same" },
			],
			refreshed: [null, { core: [4, 5, 6], key: "same" }],
		},
		{ removed: null, refreshed: null },
	]) {
		let result = "create_failed",
			removedKeys = [],
			refreshed = 0,
			messages = [],
			warnings = [];
		const data = {
			getString: () => result,
			setString: (_key, value) => {
				result = value;
			},
			setBoolean() {},
		};
		const tile = new RailTile();
		const ctx = vm.createContext({
			crossoverBuilder: true,
			dataKey: (suffix) => suffix,
			resultMessage: (value) => value,
			TileEntityLargeRailBase: RailTile,
			NGTOBuilderUtil: {
				getJsonData: () => JSON.parse(JSON.stringify(payload)),
				resetJsonData() {},
			},
			NGTLog: {
				sendChatMessage: (_sender, text) => messages.push(text),
				debug: (text) => warnings.push(text),
			},
			SRBXApiCompat: {
				getWorld: () => ({}),
				getTileEntity: () => tile,
				removeRailClientGhost: (_world, _pos, key) =>
					removedKeys.push(key),
				refreshRailCoreClient: () => refreshed++,
			},
		});
		vm.runInContext(fn(code, "handleResult"), ctx);
		const state = {
			awaitingResult: true,
			pendingAction: "create",
			awaiting: true,
			pending: "create",
			ignored: {},
			ignoredRailKeys: {},
			selected: ["keep"],
		};
		const entity = { getResourceState: () => ({ getDataMap: () => data }) };
		assert.doesNotThrow(() => ctx.handleResult({}, entity, state), kind);
		assert.equal(
			result,
			"",
			"Failure is consumed rather than crashing on every frame",
		);
		assert.equal(
			kind === "branch" ? state.awaiting : state.awaitingResult,
			false,
		);
		assert(messages.some((text) => text.includes("create_failed")));
		assert.deepEqual(
			state.selected,
			["keep"],
			"Failure preserves selection for retry",
		);
		if (Array.isArray(payload.removed) && payload.removed.length) {
			assert.deepEqual(
				removedKeys,
				["old"],
				"Refreshed identity must never be removed as a ghost",
			);
			assert.equal(refreshed, 1);
		}
		if (
			Array.isArray(payload.refreshed) &&
			payload.refreshed.includes(null)
		)
			assert.equal(warnings.length, 1);
	}
}
console.log(
	"Crossover/branch/splitter result handling tolerates null rollback entries and preserves valid updates",
);
