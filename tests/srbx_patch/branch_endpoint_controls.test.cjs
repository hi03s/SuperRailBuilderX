const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const source = fs.readFileSync(dir + "render_branch_builder.js", "utf8");
function fn(name) {
	const start = source.indexOf("function " + name + "(");
	assert(start >= 0, name);
	return source.slice(start, source.indexOf("\n}", start) + 2);
}
class Core {
	constructor(key, x) {
		this.key = key;
		this.x = x;
	}
	getRailCore() {
		return this;
	}
}
const a = new Core("A", 0),
	b = new Core("B", 20);
let look = { posX: 20, posY: 0.0625, posZ: 0 },
	snapshots = 0;
const state = { split: null, ignored: {} };
const positions = (core) =>
	[0, 20].map((offset) => ({
		posX: core.x + offset,
		posY: 0.0625,
		posZ: 0,
		direction: 0,
	}));
const map = (core) => ({
	getLength: () => 20,
	getNearlestPoint: (split, x) => ((x - core.x) * split) / 20,
	getRailPos: (split, i) => [0, core.x + (i * 20) / split],
	getRailHeight: () => 0.0625,
});
const compat = {
	getWorld: () => ({}),
	getLoadedRailCores: () => {
		snapshots++;
		return [a, b];
	},
	getTileEntity: (world, x, y, z) =>
		y === 0 && z === 0 ? (x < 20 ? a : b) : null,
	getRailPositionUnsupportedReason: () => "",
	getRailPositionCandidateKey: (core) => core.key,
	getLogicalRailMap: map,
	getEditableRailPositions: positions,
	getRailPositionAnchorPitch: () => 0,
	getHorizontalAnchorYaw: () => 90,
	getHorizontalAnchorLength: () => 0,
	getRailPositionConnectionMarkerPosition: (rp) => [
		rp.posX,
		rp.posY,
		rp.posZ,
	],
	getRailCorePos: (core) => [core.x, 0, 0],
	requiresRailBoundarySnap: () => false,
};
const context = vm.createContext({
	TileEntityLargeRailBase: Core,
	NGTOBuilderUtilClient: { getLookingPos: () => look },
	getState: () => state,
	MIN_LENGTH: 3,
	missingPositionReports: {},
	NGTLog: { debug: () => {} },
	RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_1js5ute: {
		SRBXApiCompat: compat,
	},
	RTMX_COMPAT_scripts_lib_hi03toolkit_1_0_lib_RTMApiCompat_102i8zl: {
		RTMApiCompat: {
			getRailPitch: () => 0,
			getCant: () => 0,
			getRailYaw: () => 90,
		},
	},
	SRBXEndpointAvailability: {
		isAvailable: (world, core, rp, loaded) => {
			assert.equal(
				loaded.length,
				2,
				"All loaded logical rails share one scan snapshot",
			);
			return rp.posX !== 20;
		},
	},
});
vm.runInContext(fs.readFileSync(dir + "SRBXMath.js", "utf8"), context);
for (const name of [
	"readyRailPositions",
	"railPoint",
	"findSplit",
	"findEndpoint",
])
	vm.runInContext(fn(name), context);
assert.equal(
	context.findSplit({}, 0).endpoint.kind,
	"rail",
	"A connected base endpoint remains selectable for branching",
);
assert.equal(
	context.findSplit({}, 0).endpointOptions.length,
	2,
	"Both connected source rails remain available",
);
assert.equal(
	snapshots,
	0,
	"Source selection does not apply destination availability filtering",
);
look.posX = 10;
assert.equal(
	context.findSplit({}, 0).ratio,
	0.5,
	"Interior branch selection stays available",
);
look.posX = 0;
assert.equal(
	context.findSplit({}, 0).endpoint.kind,
	"rail",
	"A free base endpoint stays selectable",
);
state.split = { railKey: "A" };
look.posX = 20;
assert.equal(
	context.findEndpoint({}, 0),
	null,
	"A connected destination endpoint is excluded",
);
look.posX = 40;
assert.equal(
	context.findEndpoint({}, 0).position[0],
	40,
	"A free destination endpoint stays selectable",
);
// Switches have no single logical basic map, and their third endpoint is valid.
const p = (x, pitch = 0) => ({
	posX: x,
	posY: 0.0625,
	posZ: 0,
	direction: 0,
	pitch,
});
compat.getRailPositionUnsupportedReason = (core) =>
	core === b ? "switch" : "";
compat.getEditableRailPositions = (core) =>
	core === b ? b.positions : positions(core);
compat.getLogicalRailMap = (core) => {
	assert.notEqual(
		core,
		b,
		"A switch is inspected by endpoint, not by a basic rail map",
	);
	return map(core);
};
compat.getRailPositionAnchorPitch = (rp) => rp.pitch || 0;
b.positions = [p(20), p(30), p(40)];
assert.equal(
	context.findEndpoint({}, 0).index,
	2,
	"Third switch endpoint can be snapped",
);
look.posX = 20;
assert.equal(
	context.findEndpoint({}, 0),
	null,
	"Connected switch endpoints remain excluded at the destination",
);
look.posX = 40;
b.positions[2].pitch = 1;
assert.equal(
	context.findEndpoint({}, 0),
	null,
	"Inclined endpoints remain unsupported for horizontal branching",
);
b.positions[2] = null;
assert.equal(
	context.findEndpoint({}, 0),
	null,
	"An uninitialized switch endpoint is skipped safely",
);
vm.runInContext(
	fs.readFileSync(dir + "SRBXAcceleratedRepeat.js", "utf8"),
	context,
);
vm.runInContext(fn("input"), context);
let now = 0;
const held = new Set(["KEY_RIGHT"]);
context.Date = { now: () => now };
context.Keyboard = new Proxy(
	{ isKeyDown: (key) => held.has(key) },
	{
		get: (target, key) => (key in target ? target[key] : key),
	},
);
context.keys = {
	pressed: () => false,
	down: () => false,
	downOptionKey: () => held.has("KEY_LCONTROL") || held.has("KEY_RCONTROL"),
};
context.handleResult = () => {};
context.MAX_RADIUS = 10000;
state.radiusRepeat = vm.runInContext("new SRBXAcceleratedRepeat()", context);
state.radius = 100;
state.locked = true;
state.awaiting = false;
const entity = { getResourceState: () => ({ getDataMap: () => ({}) }) };
const input = () => context.input({}, entity, 0, false, false);
input();
assert.equal(state.radius, 101);
now = 350 + 38 * 75;
input();
assert.equal(state.radius, 140);
now += 75;
input();
assert.equal(state.radius, 150, "Normal branch radius accelerates to 10m");
held.add("KEY_LCONTROL");
now += 75;
input();
assert.equal(state.radius, 250, "Changing Ctrl restarts at 100m");
now += 3200;
input();
assert.equal(state.radius, 4150);
now += 75;
input();
assert.equal(
	state.radius,
	4250,
	"Ctrl radius repeat stays at 100m after forty changes",
);
state.radius = 250;
state.awaiting = true;
now += 10000;
input();
assert.equal(state.radius, 250, "A pending server action pauses radius input");
state.awaiting = false;
input();
assert.equal(state.radius, 350, "Resuming starts at the initial step");
console.log(
	"Branch endpoint exclusion, interior selection and accelerated radius controls passed",
);
