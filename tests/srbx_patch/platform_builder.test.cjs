const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const read = (name) => fs.readFileSync(dir + name + ".js", "utf8");
class RailBase {
	constructor(key, positions) {
		this.key = key;
		this.positions = positions;
	}
	getRailCore() {
		return this;
	}
}
class WeakMapFixture {
	constructor() {
		this.values = new Map();
	}
	get(k) {
		return this.values.get(k) || null;
	}
	put(k, v) {
		this.values.set(k, v);
	}
	remove(k) {
		this.values.delete(k);
	}
}
let sources = {},
	held = true,
	createCalls = [],
	deleted = [],
	failCreation = 0,
	failUndo = "";
const compat = {
	getHorizontalAnchorYaw: (r) => r.yaw,
	getRailPositionAnchorPitch: (r) => r.pitch || 0,
	getHorizontalAnchorLength: (r) => r.length,
	getVerticalAnchorLength: (r) => r.vertical || r.length,
	requiresRailBoundarySnap: () => false,
	getWorld: () => ({}),
	getTileEntity: (_w, x) => sources[x],
	getRailPositionCandidateKey: (c) => c.key,
	getRailPositionUnsupportedReason: () => "",
	getEditableRailPositions: (c) => c.positions,
	createBuilderRail: (...args) => {
		createCalls.push(args);
		if (args[13] && !held) return { status: "hold_rail_item" };
		if (failCreation && createCalls.length === failCreation)
			return { status: "blocked" };
		return {
			status: "ok",
			undoCore: [100 + createCalls.length, 0, 0],
			undoKey: "new-" + createCalls.length,
		};
	},
	undoBuilderRail: (_w, x, _y, _z, key) => {
		if (key === failUndo) return "undo_rail_changed";
		deleted.push(key);
		return "ok";
	},
};
const context = vm.createContext({
	Packages: {
		jp: {
			ngt: {
				rtm: {
					rail: {
						util: {
							RailPosition: {
								REVISION: [
									[0, 0.5],
									[-0.5, 0.5],
									[-0.5, 0],
									[-0.5, -0.5],
									[0, -0.5],
									[0.5, -0.5],
									[0.5, 0],
									[0.5, 0.5],
								],
							},
						},
						TileEntityLargeRailBase: RailBase,
					},
				},
				ngtlib: { io: { NGTLog: { debug: () => {} } } },
			},
		},
		net: { minecraft: { entity: { player: { EntityPlayer: class {} } } } },
		java: { util: { WeakHashMap: WeakMapFixture } },
	},
	RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_1js5ute: {
		SRBXApiCompat: compat,
	},
	NGTOBuilderUtil: { sendJsonData: (map, key, value) => (map[key] = value) },
});
vm.runInContext(
	read("SRBXMath") +
		read("SRBXPlatformGeometry") +
		read("server_platform_builder"),
	context,
);
const geometry = context.SRBXPlatformGeometry;
const a = { posX: 0, posY: 0.0625, posZ: 0, yaw: 0, length: 10, pitch: 2 },
	b = { posX: 0, posY: 1.0625, posZ: 40, yaw: 180, length: 10, pitch: -2 };
const unchanged = JSON.stringify([a, b]);
for (const distance of [-2, 2]) {
	const pair = geometry.offset(a, b, distance, 1.5);
	assert(Math.abs(pair.start.position[0] - distance) < 1e-8);
	assert(Math.abs(pair.end.position[0] - distance) < 1e-8);
	assert.equal(pair.start.position[1], 1.5625);
	assert.equal(pair.end.position[1], 2.5625);
	assert.equal(pair.start.anchorPitch, 2);
	assert.equal(pair.start.cantEdge, 0);
	assert.equal(pair.end.cantCenter, 0);
}
assert.equal(
	JSON.stringify([a, b]),
	unchanged,
	"Preview must preserve the source rail",
);
assert.equal(geometry.offset(a, { ...b, posX: 0, posZ: 0 }, 2, 1.5), null);
sources = {
	1: new RailBase("source-a", [a, b]),
	2: new RailBase("source-b", [
		{ ...a, posZ: 40 },
		{ ...b, posZ: 80 },
	]),
};
const ref = (id) => {
	const rp = sources[id].positions;
	return {
		sourceCore: [id, 0, 0],
		sourceRailKey: sources[id].key,
		sourceStart: [rp[0].posX, rp[0].posY, rp[0].posZ],
		sourceEnd: [rp[1].posX, rp[1].posY, rp[1].posZ],
		start: { position: [999, 999, 999] },
		end: { position: [888, 888, 888] },
	};
};
const request = (ids = [1]) => ({
	action: "create",
	plans: ids.map(ref),
	spacing: 2,
	height: 1.5,
	side: 1,
});
const entity = { getResourceState: () => ({ getDataMap: () => map }) },
	map = {};
held = false;
assert.equal(context.processRequest(entity, {}, request()), "hold_rail_item");
assert.equal(createCalls.length, 1);
assert.equal(
	createCalls[0][13],
	true,
	"A held model must be required on the server",
);
assert.equal(deleted.length, 0, "The selected source must not be removed");
held = true;
createCalls = [];
assert.equal(context.processRequest(entity, {}, request([1, 2])), "ok");
assert.equal(
	createCalls.length,
	2,
	"Exactly one lane is created for each selected source",
);
assert.equal(
	createCalls[0][2].position[1],
	1.5625,
	"Server derives the height instead of trusting preview coordinates",
);
assert.equal(createCalls[0][2].position[0], 2);
assert.equal(
	createCalls[0][4][0],
	"source-a",
	"Existing sources remain protected",
);
assert.equal(context.processRequest(entity, {}, { action: "undo" }), "undo_ok");
assert.deepEqual(deleted, ["new-2", "new-1"]);
assert.equal(map.platformBuilderRemovedRails.length, 2);
assert.equal(
	context.processRequest(entity, {}, { action: "undo" }),
	"nothing_to_undo",
);
createCalls = [];
deleted = [];
assert.equal(
	context.processRequest(entity, {}, request([1, 1])),
	"invalid_source_rail",
);
assert.equal(createCalls.length, 0);
for (const settings of [
	{ height: NaN },
	{ height: "1.5" },
	{ spacing: Infinity },
	{ side: 0 },
])
	assert.equal(
		context.processRequest(entity, {}, Object.assign(request(), settings)),
		"invalid_platform_settings",
	);
const stale = request();
stale.plans[0].sourceStart[0] = 1;
assert.equal(context.processRequest(entity, {}, stale), "source_rail_changed");
assert.equal(createCalls.length, 0);
failCreation = 2;
failUndo = "new-1";
assert.equal(
	context.processRequest(entity, {}, request([1, 2])),
	"rollback_failed:undo_rail_changed",
);
assert(
	context.undoRecords.get(entity),
	"Failed rollback preserves the remaining created rail for recovery",
);
failUndo = "";
assert.equal(context.processRequest(entity, {}, { action: "undo" }), "undo_ok");
assert.deepEqual(deleted, ["new-1"]);
assert(!deleted.includes("source-a") && !deleted.includes("source-b"));
// Exercise the actual target implementations: a valid source model must never
// rescue a missing held item in the platform-only mode.
function method(file, name) {
	const code = fs.readFileSync(file, "utf8"),
		marker = code.indexOf("." + name + " = function (");
	assert(marker >= 0, name);
	const lineStart = code.lastIndexOf("\n", marker) + 1,
		indent = code.slice(lineStart).match(/^ */)[0];
	const start = code.indexOf("function (", marker),
		end = code.indexOf("\n" + indent + "};", start);
	assert(end > start, name);
	return vm.runInNewContext(
		"(" + code.slice(start, end + indent.length + 2) + ")",
		{
			SRBXFreeEndpointPolicy: {
				normalizePoint: (p) => p,
				isBoundary: () => true,
			},
		},
	);
}
const free = {
	kind: "free",
	position: [0, 0, 0],
	anchorYaw: 0,
	anchorLength: 1,
};
const end = { ...free, position: [0, 0, 40] };
let endpointFallbackCalled = false;
const apiFixture = {
	validateBuilderPoint: () => "ok",
	validatePoint: () => "ok",
	createBuilderSourceProperty: () => ({ model: "existing" }),
	propertyFromSource: () => ({ model: "existing" }),
	createBuilderProperty: () => null,
	propertyFromPlayer: () => null,
	createBuilderEndpointProperty: () => {
		endpointFallbackCalled = true;
	},
	propertyFromPoint: () => {
		endpointFallbackCalled = true;
	},
};
const targets = "dist/assets/minecraft/__targets__/";
const ae = method(
	targets +
		"appleextended/scripts/superrailbuilderx/AppleExtendedRailCompat.js",
	"createNormalRail",
);
assert.equal(
	ae.call(apiFixture, {}, {}, free, end, {}, {}, true, undefined, false, true)
		.status,
	"hold_rail_item",
);
const kp = method(
	targets +
		"kaizpatch/scripts/superrailbuilderx/SRBXApiCompat.__rtmx_kaizpatch_164islx.compat.js",
	"createBuilderRail",
);
assert.equal(
	kp.call(
		apiFixture,
		{ blockExists: () => true, func_72899_e: () => true },
		{},
		free,
		end,
		[],
		{},
		{},
		false,
		true,
		false,
		undefined,
		undefined,
		false,
		true,
	).status,
	"hold_rail_item",
);
assert.equal(endpointFallbackCalled, false);
console.log(
	"platform builder geometry, server validation, protection and Undo: ok",
);
