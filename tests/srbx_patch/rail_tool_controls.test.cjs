const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const read = (name) => fs.readFileSync(dir + name + ".js", "utf8");
function fn(source, name) {
	const start = source.indexOf("function " + name + "(");
	assert(start >= 0, name);
	return source.slice(start, source.indexOf("\n}", start) + 2);
}
const client = read("render_cant_formatter");
let look = { posX: 35, posY: 0.0625, posZ: 0 },
	held = new Set(),
	pressed = "",
	sent;
const s = {
	speed: 100,
	gaugeIndex: 0,
	selected: [],
	repeatAt: 0,
	awaiting: false,
};
class Core {
	constructor(key, x = 0) {
		this.key = key;
		this.x = x;
	}
	getRailCore() {
		return this;
	}
}
const core = new Core("A"),
	neighbor = new Core("B", 100);
const positions = (c) => [
	{ posX: c.x, posY: 0.0625, posZ: 0 },
	{ posX: c.x + 100, posY: 0.0625, posZ: 0 },
];
const map = {
	getLength: () => 100,
	getNearlestPoint: (split, x) => (x * split) / 100,
	getRailPos: (split, i) => [0, (i / split) * 100],
	getRailHeight: () => 0.0625,
};
const compat = {
	getWorld: () => ({ func_73045_a: () => host }),
	getLoadedRailCores: () => [core, core, neighbor],
	getRailPositionUnsupportedReason: () => "",
	getRailPositionCandidateKey: (c) => c.key,
	getLogicalRailMap: () => map,
	getEditableRailPositions: positions,
	getRailCorePos: (c) => [c.x, 0, 0],
	getHorizontalAnchorYaw: (rp) => (rp.posX === 0 ? 0 : 180),
	getTileEntity: (w, x) => (x === 0 ? core : neighbor),
	doFollowing: () => {},
	requiresRailBoundarySnap: () => false,
};
const context = vm.createContext({
	RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_1js5ute: {
		SRBXApiCompat: compat,
	},
	RTMX_COMPAT_scripts_lib_hi03toolkit_1_0_lib_RTMApiCompat_102i8zl: {
		RTMApiCompat: { getRailYaw: (m, split, i) => (i / split) * 20 },
	},
	NGTOBuilderUtilClient: { getLookingPos: () => look },
	state: () => s,
	Keyboard: new Proxy(
		{ isKeyDown: (key) => held.has(key) },
		{ get: (t, k) => (k in t ? t[k] : k) },
	),
	keys: { pressed: (key) => pressed === key, down: () => false },
	result: () => {},
	NGTLog: { sendChatMessage: () => {} },
	send: (e, s, r) => {
		sent = r;
	},
});
vm.runInContext(read("SRBXMath"), context);
vm.runInContext(
	client.slice(
		client.indexOf("var GAUGES ="),
		client.indexOf("var states ="),
	),
	context,
);
for (const name of [
	"point",
	"railEndpoints",
	"updateEndpointCants",
	"candidate",
	"recalculateSelected",
	"input",
	"collectAffectedRails",
])
	vm.runInContext(fn(client, name), context);
const first = context.candidate({}, 0);
assert.equal(first.railKey, "A");
assert.equal(first.endpoints.length, 2);
assert(
	first.endpoints[0].angle < 0 && first.endpoints[1].angle > 0,
	"Both endpoint cant conventions are respected",
);
look.posX = 65;
assert.equal(
	context.candidate({}, 0).railKey,
	"A",
	"Selection stays logical rail at another point",
);
const data = { getBoolean: () => false, setBoolean: () => {} };
const entity = { getResourceState: () => ({ getDataMap: () => data }) };
context.input({}, entity, 0, true, false);
assert.equal(s.selected.length, 1);
look.posX = 35;
context.input({}, entity, 0, true, false);
assert.equal(s.selected.length, 0, "Clicking same rail anywhere toggles it");
s.selected = [first];
pressed = "apply";
context.input({}, entity, 0, false, false);
assert.equal(sent.targets.length, 2);
assert(sent.targets.every((t) => t.mode === "edge"));
pressed = "";
held = new Set(["KEY_LCONTROL", "KEY_DOWN"]);
s.speed = 30;
s.repeatAt = 0;
context.input({}, entity, 0, false, false);
assert.equal(s.speed, 0);
assert(s.selected[0].endpoints.every((e) => e.angle === 0));
held = new Set(["KEY_LCONTROL", "KEY_UP"]);
s.repeatAt = 0;
context.input({}, entity, 0, false, false);
assert.equal(s.speed, 50);
assert(
	s.selected[0].endpoints[0].angle < 0 &&
		s.selected[0].endpoints[1].angle > 0,
	"Cant direction survives zero speed",
);
const affected = {};
context.collectAffectedRails(entity, first, affected);
assert.deepStrictEqual(
	Object.keys(affected).sort(),
	["A", "B"],
	"Both rail ends discover connected rails",
);
// Actual render gives hover yellow priority over the yellow-green affected rail.
const host = {};
let highlights = [];
Object.assign(context, {
	TileEntityLargeRailBase: Core,
	MCWrapperClient: { getPlayer: () => host },
	NGTUtilClient: { getMinecraft: () => ({ field_71462_r: null }) },
	body: { render: () => {} },
	renderer: { currentMatId: 0 },
	keys: { update: () => {} },
	Mouse: { isButtonDown: () => false },
	renderAt: () => {},
	panel: () => {},
	cantDigits: [],
	cantMM: {},
	selectedCursor: {},
	hoverCursor: {},
	renderToolGui: () => {},
	input: () => {},
	renderRailHighlight: (e, pt, m, color) => highlights.push(color),
	candidate: () => ({ ...first, core: [100, 0, 0], railKey: "B" }),
});
data.getString = () => "1";
vm.runInContext(fn(client, "render"), context);
context.render(entity, 0, 0);
assert(highlights.includes("ffff00"));
assert(
	!highlights.includes("99ff00"),
	"Hovered affected rail is yellow, not yellow-green",
);
highlights = [];
context.candidate = () => null;
context.render(entity, 0, 0);
assert(highlights.includes("99ff00"));
assert(!client.includes("curveDigits"), "Cursor speed panel is removed");
// Server rejects old splitting/center requests and retains failed Undo for retry.
const server = read("server_cant_formatter"),
	records = new Map();
let applyCalls = 0,
	undoStatus = "undo_rail_changed";
Object.assign(compat, {
	applyRailCants: () => ({ status: "ok", undoToken: "cant" + ++applyCalls }),
	consumeLastCantClientUpdate: () => [
		[0, 0, 0],
		[0, 0, 0],
	],
	undoRailCants: () => undoStatus,
});
context.undoRecords = {
	get: (e) => records.get(e),
	put: (e, v) => records.set(e, v),
	remove: (e) => records.delete(e),
};
for (const name of ["appendUniqueCore", "appendCantUpdate", "process"])
	vm.runInContext(fn(server, name), context);
for (const mode of ["split", "center"])
	assert.equal(
		context.process(
			entity,
			{},
			{ action: "apply", targets: [{ mode, index: 0 }] },
		).status,
		"invalid_endpoint",
	);
assert.equal(applyCalls, 0);
const targets = first.endpoints;
assert.equal(
	context.process(entity, {}, { action: "apply", targets: [targets[0]] })
		.status,
	"invalid_endpoint",
	"Server requires both rail ends",
);
assert.equal(
	context.process(
		entity,
		{},
		{ action: "apply", targets: [targets[0], targets[0]] },
	).status,
	"invalid_endpoint",
	"Duplicate end cannot replace missing end",
);
assert.equal(
	context.process(entity, {}, { action: "apply", targets }).status,
	"ok",
);
assert.equal(
	context.process(entity, {}, { action: "undo" }).status,
	"undo_rail_changed",
);
assert.equal(records.get(entity).length, 1);
undoStatus = "undo_ok";
assert.equal(context.process(entity, {}, { action: "undo" }).status, "undo_ok");
assert(!records.has(entity));
assert(!server.includes("splitBuilderRail"));
// Branch snap modes and world-grid independence.
const branch = read("render_branch_builder");
context.DEFAULT_HEIGHT = 1 / 16;
context.MAX_RADIUS = 10000;
context.snapAngles = [1, 5, 15];
vm.runInContext(fn(branch, "freePoint"), context);
const bs = {
	snapMode: "block",
	snapIndex: 1,
	locked: false,
	split: { position: [0.13, 0.0625, 0.27] },
};
look = { posX: -2.24, posY: 4.21, posZ: 3.76 };
assert.deepStrictEqual(
	Array.from(context.freePoint({}, 0, bs).position),
	[-2, 4.0625, 4],
);
bs.snapIndex = 2;
assert.deepStrictEqual(
	Array.from(context.freePoint({}, 0, bs).position),
	[-2, 4.0625, 4],
);
bs.snapMode = "distance";
bs.snapIndex = 1;
const distancePoint = context.freePoint({}, 0, bs).position;
const distance = context.SRBXMath.distance(bs.split.position, distancePoint);
assert(Math.abs(distance * 2 - Math.round(distance * 2)) < 1e-8);
assert(
	Math.abs(
		context.SRBXMath.horizontalYaw(bs.split.position, distancePoint) / 5 -
			Math.round(
				context.SRBXMath.horizontalYaw(
					bs.split.position,
					distancePoint,
				) / 5,
			),
	) < 1e-8,
);
// CTRL hides unselected rail and endpoint hover without hiding the current selection.
const mover = read("render_rail_mover"),
	editor = {
		awaitingResult: false,
		stage: 0,
		selected: null,
		selectedRails: [],
		parallelPlans: [],
		destination: null,
	};
let hovered = 0,
	markers = 0;
Object.assign(context, {
	getState: () => editor,
	findCandidates: () => [{ position: [0, 0, 0] }],
	findHoverRail: () => ({ key: "A" }),
	resolveRail: () => ({ map }),
	renderRailHighlight: () => hovered++,
	renderMarker: () => markers++,
	point: {},
	handleInput: () => {},
});
vm.runInContext(fn(mover, "render"), context);
held = new Set(["KEY_LCONTROL"]);
context.render(entity, 0, 0);
assert.equal(hovered, 0);
assert.equal(markers, 0);
held = new Set();
context.findCandidates = () => [];
context.render(entity, 0, 0);
assert.equal(hovered, 1);
// All helpers end with the chat scrolling note and use one key combination per line.
const gui = read("SRBXToolGui");
vm.runInContext(gui.slice(gui.indexOf("var SRBXToolGui =")), context);
let messages = [];
context.NGTLog.sendChatMessage = (sender, text) => messages.push(text);
context.keys = {
	pressed: (name) => name === "help",
	down: () => false,
	getDescription: (name) => "[" + name + "]",
};
context.handleResult = () => {};
context.repeatedKey = () => false;
for (const tool of [
	"builder1",
	"rail_splitter",
	"double_track_copy",
	"cant_formatter",
	"branch_builder",
	"rail_mover",
]) {
	messages = [];
	const code = read("render_" + tool);
	if (tool === "rail_mover") {
		vm.runInContext(fn(code, "handleInput"), context);
		context.handleInput(host, entity, 0, false, false);
	} else {
		const name = ["cant_formatter", "branch_builder"].includes(tool)
			? "help"
			: "showHelp";
		vm.runInContext(fn(code, name), context);
		context[name](host);
	}
	assert(messages.at(-1).includes("スクロール"), tool + " scroll footer");
	for (const line of messages) {
		const combos = line.match(/\[[^\]]+\]/g) || [];
		assert(combos.length <= 1, tool + " one key per line: " + line);
		assert(
			!/\[[^\]]*[,/←→↑↓][^\]]*[,/←→↑↓][^\]]*\]/.test(line),
			tool + " arrows split per key",
		);
	}
}
console.log(
	"Logical cant selection, both-end payload, zero/50 speed, hover priority, no split, Undo retry and branch snapping passed",
);
