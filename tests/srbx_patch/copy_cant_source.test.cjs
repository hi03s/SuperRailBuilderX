const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const read = (name) => fs.readFileSync(dir + name + ".js", "utf8");
const fn = (source, name) => {
	const start = source.indexOf("function " + name + "(");
	assert(start >= 0, name);
	return source.slice(start, source.indexOf("\n}", start) + 2);
};
class Base {
	getRailCore() {
		return this;
	}
}
const core = new Base(),
	captured = [],
	removed = [];
let positions = [
	{
		posX: 0,
		posY: 4,
		posZ: 0,
		cantEdge: 3,
		cantCenter: 4,
		cantRandom: 0.5,
		direction: 0,
		anchorYaw: 0,
		anchorPitch: 0,
	},
	{
		posX: 0,
		posY: 4,
		posZ: 10,
		cantEdge: -3,
		cantCenter: 4,
		cantRandom: 0.5,
	},
];
const api = {
	getWorld: () => ({}),
	getTileEntity: () => core,
	getRailPositionCandidateKey: () => "source",
	getEditableRailPositions: () => positions,
	getRailPositionCantEdge: (rp) => rp.cantEdge,
	getRailPositionCantCenter: (rp) => rp.cantCenter,
	getRailPositionCantRandom: (rp) => rp.cantRandom,
	getHorizontalAnchorYaw: (rp) => rp.anchorYaw,
	getRailPositionAnchorPitch: (rp) => rp.anchorPitch,
	getRailPositionConnectionMarkerPosition: (rp) => [
		rp.posX,
		rp.posY,
		rp.posZ,
	],
	getRailCorePos: () => [0, 4, 0],
	getLogicalRailMap: () => ({}),
	requiresRailBoundarySnap: () => false,
	createBuilderRail: (...args) => {
		captured.push(args);
		return { status: "ok", undoCore: [1, 4, 0], undoKey: "created" };
	},
	undoBuilderRail: (_world, _x, _y, _z, key) => {
		removed.push(key);
		return "ok";
	},
};
const context = vm.createContext({
	TileEntityLargeRailBase: Base,
	SRBXApiCompat: api,
	__assign: Object.assign,
	SNAP_RADIUS: 0.5,
	MAX_COPY_RAILS: 128,
	MIN_RAIL_LENGTH: 2,
	plannedLength: () => 10,
	NGTLog: { debug() {} },
	undoRecords: { get() {}, put() {} },
});
vm.runInContext(read("SRBXMath"), context);
const client = read("render_double_track_copy"),
	server = read("server_double_track_copy");
for (const alias of (client + server).match(
	/RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_\w+/g,
) || [])
	context[alias] = { SRBXApiCompat: api };
vm.runInContext(fn(client, "connectionCandidate"), context);
const requested = {
	kind: "free",
	position: [0, 4, 0],
	anchorLength: 3,
	cantEdge: 8,
	cantCenter: 6,
	cantRandom: 0.2,
};
const snap = context.connectionCandidate({}, requested, {});
assert.equal(snap.kind, "rail");
assert.equal(snap.anchorYaw, 180);
assert.equal(
	snap.cantEdge,
	8,
	"Preview keeps its own cant even against neighbour cant 3",
);
assert.equal(snap.cantCenter, 6);
for (const name of ["sourceCantPoints", "rollback", "processRequest"])
	vm.runInContext(fn(server, name), context);
const plan = {
	sourceCore: [0, 4, 0],
	sourceRailKey: "source",
	sourceStart: [0, 4, 0],
	sourceEnd: [0, 4, 10],
	start: { ...snap, cantEdge: 99 },
	end: { ...snap, position: [0, 4, 10], cantEdge: 99 },
};
const before = JSON.stringify({ plan, positions });
assert.equal(
	context.processRequest({}, {}, { action: "create", plans: [plan] }),
	"ok",
);
assert.equal(
	captured[0][2].cantEdge,
	3,
	"Server re-reads the source instead of trusting client cant",
);
assert.equal(captured[0][3].cantEdge, -3);
assert.equal(captured[0][2].cantCenter, 4);
assert.equal(captured[0][5].preserveEndpointCant, true);
assert.equal(
	JSON.stringify({ plan, positions }),
	before,
	"Source and input request remain unchanged",
);
assert.equal(
	context.sourceCantPoints({}, { ...plan, sourceRailKey: "stale" }),
	null,
);
assert.equal(
	context.sourceCantPoints({}, { ...plan, sourceEnd: [0, 4, 11] }),
	null,
);
for (const field of ["sourceCore", "sourceStart", "sourceEnd"])
	for (const invalid of [undefined, [0, 4], [0, NaN, 10]])
		assert.equal(
			context.sourceCantPoints({}, { ...plan, [field]: invalid }),
			null,
		);
positions[0].cantEdge = NaN;
assert.equal(context.sourceCantPoints({}, plan), null);
positions[0].cantEdge = 0;
assert.equal(context.sourceCantPoints({}, plan)[0].cantEdge, 0);
captured.length = 0;
assert.equal(
	context.processRequest(
		{},
		{},
		{
			action: "create",
			plans: [plan, { ...plan, sourceRailKey: "stale" }],
		},
	),
	"source_rail_changed",
);
assert.equal(captured.length, 1);
assert.deepEqual(
	removed,
	["created"],
	"Later source failure rolls back earlier copies",
);
console.log(
	"Copy cant preview, authoritative server source, scoped snap policy and rollback passed",
);
