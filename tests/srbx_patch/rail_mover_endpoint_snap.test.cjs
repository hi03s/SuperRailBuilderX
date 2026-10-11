const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const root = "dist/assets/minecraft/scripts/superrailbuilderx/";
function fn(file, name) {
	const s = fs.readFileSync(root + file + ".js", "utf8"),
		start = s.indexOf("function " + name + "(");
	assert(start >= 0);
	return s.slice(start, s.indexOf("\n}", start) + 2);
}
let looking = { posX: 10.1, posY: 4, posZ: 0.5 },
	candidates = [];
const selected = { railKey: "a", position: [0, 4.0625, 0.5] };
const state = { selected: { candidates: [selected] } };
const compat = { requiresRailBoundarySnap: () => false };
const context = {
	NGTOBuilderUtilClient: { getLookingPos: () => looking },
	getState: () => state,
	getRailBaseHeightAt: () => 4.0625,
	findCandidates: () => candidates,
	ENDPOINT_SNAP_RADIUS: 0.5,
	CONNECTED_ENDPOINT_TOLERANCE: 0.001,
	NORMAL_RAIL_HEIGHT: 0.0625,
	roundSnap: (n) => Math.round(n * 10) / 10,
	roundCentimeter: (n) => Math.round(n * 100) / 100,
	RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_1js5ute: {
		SRBXApiCompat: compat,
	},
};
vm.createContext(context);
vm.runInContext(
	fs.readFileSync(root + "SRBXMath.js", "utf8") +
		fn("render_rail_mover", "getDestination"),
	context,
);
const target = {
	railKey: "b",
	coreX: 20,
	coreY: 4,
	coreZ: 0,
	index: 1,
	position: [10.345, 4.0625, 0.5],
};
candidates = [selected, target];
const destination = () => Array.from(context.getDestination({}, 0, true));
assert.deepEqual(
	destination(),
	target.position,
	"Exact rail endpoint wins over 0.1m rounding",
);
assert.equal(state.destinationEndpoint.railKey, "b");
candidates = [selected, target, { ...target, railKey: "c" }];
assert.deepEqual(
	destination(),
	[10.1, 4.0625, 0.5],
	"Already connected destination is not snapped",
);
assert.equal(state.destinationEndpoint, undefined);
state.selected.candidates.push({ ...selected, railKey: "d" });
candidates = [target];
assert.deepEqual(
	destination(),
	[10.1, 4.0625, 0.5],
	"Connected source endpoints move together without attachment snapping",
);
state.selected.candidates.pop();
candidates = [{ ...target, position: [10.7, 4.0625, 0.5] }];
assert.deepEqual(
	destination(),
	[10.1, 4.0625, 0.5],
	"Outside 0.5m is not snapped",
);
const rp = (p) => ({ posX: p[0], posY: p[1], posZ: p[2] });
const a = { key: "a", positions: [rp(selected.position)] },
	b = { key: "b", positions: [rp(target.position)] };
let near = [a, b];
Object.assign(compat, {
	getRailPositionCandidateKey: (c) => c.key,
	getEditableRailPositions: (c) => c.positions,
	getLoadedRailCores: () => near,
});
context.resolveCurrentCore = (_w, p, key) =>
	near.find((c) => c.key === key) || null;
vm.runInContext(
	fn("server_rail_mover", "samePosition") +
		fn("server_rail_mover", "validateEndpointSnap"),
	context,
);
const request = {
	targets: [{ core: [0, 4, 0], railKey: "a", original: selected.position }],
	destination: target.position,
	destinationEndpoint: {
		core: [20, 4, 0],
		railKey: "b",
		index: 0,
		original: target.position,
	},
};
const validate = () => context.validateEndpointSnap({}, request);
assert.equal(validate(), "ok");
b.positions = [rp([11, 4.0625, 0.5])];
assert.equal(validate(), "destination_endpoint_changed");
b.positions = [rp(target.position)];
near.push({ key: "c", positions: [rp(target.position)] });
assert.equal(validate(), "destination_endpoint_connected");
near.pop();
near.push({ key: "c", positions: [rp(selected.position)] });
assert.equal(validate(), "source_endpoint_connected");
near.pop();
b.positions.push(rp(selected.position));
assert.equal(
	validate(),
	"source_endpoint_connected",
	"target's other end must not already be attached to source",
);
b.positions.pop();
request.destinationEndpoint.railKey = "missing";
assert.equal(validate(), "destination_endpoint_changed");
console.log(
	"Free endpoint snap preview/confirmation, connected-source exclusion and server race revalidation passed",
);
