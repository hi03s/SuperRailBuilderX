const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const read = (name) => fs.readFileSync(dir + name + ".js", "utf8");
const point = (x) => ({ posX: x, posY: 0, posZ: 0, direction: 2 });
class Base {
	getRailCore() {
		return this;
	}
}
const core = (key, positions) => Object.assign(new Base(), { key, positions });
const a = core("A", [point(0), point(10)]),
	b = core("B", [point(10), point(20)]);
let cores = [a, b],
	snapshots = 0;
const compat = {
	getRailPositionCandidateKey: (c) => c.key,
	getEditableRailPositions: (c) => c.positions,
	getLoadedRailCores: () => {
		snapshots++;
		return cores;
	},
	getWorld: () => ({}),
	getTileEntity: (_w, x, y, z) =>
		y === 0 && z === 0 ? (x < 10 ? a : b) : null,
	getRailPositionUnsupportedReason: () => "",
	getRailCorePos: () => [0, 0, 0],
	requiresRailBoundarySnap: () => false,
	getHorizontalAnchorYaw: () => 90,
	getRailPositionAnchorPitch: () => 0,
	getRailPositionConnectionMarkerPosition: (p) => [p.posX, p.posY, p.posZ],
};
const context = vm.createContext({
	SRBXApiCompat: compat,
	TileEntityLargeRailBase: Base,
	NGTOBuilderUtilClient: {
		getLookingPos: () => ({ posX: 10, posY: 0, posZ: 0 }),
	},
	ENDPOINT_SEARCH_RADIUS: 0.8,
	logScanErrorOnce: (_phase, _x, _y, _z, error) => {
		throw error;
	},
});
const helper = read("SRBXEndpointAvailability");
const alias = helper.match(/(\w+)\.SRBXApiCompat/);
if (alias) context[alias[1]] = { SRBXApiCompat: compat };
vm.runInContext(
	helper.slice(helper.indexOf("var SRBXEndpointAvailability =")),
	context,
);
vm.runInContext(read("SRBXMath"), context);
const available = (rail, p) =>
	context.SRBXEndpointAvailability.isAvailable({}, rail, p, cores);
assert(!available(a, point(10)));
assert(!available(b, point(10)));
assert(available(a, point(0)));
cores = [a, core("A", a.positions), core("unready", null)];
assert(
	available(a, point(10)),
	"Same logical sections and incomplete unrelated cores do not block a free endpoint",
);
cores = [a, core("switch", [point(30), point(10), point(40)])];
assert(!available(a, point(10)), "Switch endpoints count as connections");
cores = [a, core("raised", [{ ...point(10), posY: 0.01 }])];
assert(
	available(a, point(10)),
	"Crossing rails at different heights are independent",
);
cores = [a, core("far-owner", [point(10), point(2000)])];
assert(
	!context.SRBXEndpointAvailability.isAvailable({}, a, point(10)),
	"Remote core ownership does not hide an endpoint connection",
);
assert.equal(snapshots, 1);
// Exercise the shared A/B endpoint scanner rather than only the helper.
const builder = read("render_builder1");
const start = builder.indexOf("function findRailCandidate(");
vm.runInContext(
	builder.slice(start, builder.indexOf("\n}", start) + 2),
	context,
);
cores = [a, b];
snapshots = 0;
assert.equal(
	context.findRailCandidate({}, 0),
	null,
	"Both sides of a joined endpoint are excluded",
);
assert.equal(snapshots, 1, "One loaded-core snapshot per candidate scan");
b.positions = [point(12), point(20)];
assert.equal(
	context.findRailCandidate({}, 0).position[0],
	10,
	"A newly free endpoint is selectable immediately",
);
console.log("Logical endpoint availability and A/B candidate exclusion passed");
a.positions = [point(0), point(5)];
b.positions = [point(30), point(40), point(10)];
compat.getRailPositionUnsupportedReason = (c) => (c === b ? "switch" : "");
assert.equal(
	context.findRailCandidate({}, 0).index,
	2,
	"A/B already support all switch endpoints",
);
cores.push(core("connection", [point(10), point(50)]));
assert.equal(
	context.findRailCandidate({}, 0),
	null,
	"A/B exclude a connected third switch endpoint as well",
);
