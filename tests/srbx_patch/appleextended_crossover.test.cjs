const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const root = process.env.SRBX_TEST_DIST || "dist/assets/minecraft/";
const read = (path) => fs.readFileSync(root + path, "utf8");
class RailBase {
	getRailCore() {
		return this;
	}
}
let loaded = [];
const tiles = { size: () => loaded.length, get: (i) => loaded[i] };
const world = { loadedTileEntityList: tiles, field_147482_g: tiles };
const context = vm.createContext({
	TileEntityLargeRailBase: RailBase,
	TileEntityLargeRailSwitchCore: class SwitchCore {},
	UUID: { randomUUID: () => ({ toString: () => "token" }) },
	Packages: {
		java: {
			util: { UUID: { randomUUID: () => ({ toString: () => "token" }) } },
		},
	},
});
context.Packages.jp = {
	ngt: {
		rtm: {
			rail: {
				TileEntityLargeRailBase: RailBase,
				TileEntityLargeRailSwitchCore:
					context.TileEntityLargeRailSwitchCore,
			},
		},
		ngtlib: { io: { NGTLog: { debug() {} } } },
	},
};
context.NGTLog = context.Packages.jp.ngt.ngtlib.io.NGTLog;
vm.runInContext(
	read("scripts/superrailbuilderx/SRBXCrossoverValidation.js").replace(
		/^.*(?:require\(|include <).*$/gm,
		"",
	),
	context,
);
let source = read(
	"__targets__/appleextended/scripts/superrailbuilderx/AppleExtendedRailToolsCompat.js",
);
vm.runInContext(
	source.slice(source.indexOf("var AppleExtendedRailToolsCompat =")),
	context,
);
const tools = context.AppleExtendedRailToolsCompat;
const point = (x, z, yaw) => ({
	kind: "free",
	position: [x, 4, z],
	markerPosition: [x, 4, z],
	direction: yaw === 0 ? 0 : 4,
	anchorYaw: yaw,
	anchorPitch: 0,
	anchorLength: 10,
	anchorLengthVertical: 10,
});
const plan = () => ({
	points: [
		point(0, 0, 0),
		point(0, 40, 180),
		point(4, 0, 0),
		point(4, 40, 180),
	],
	switchTypes: [1, 1, 1, 1],
});
let removed = [],
	created = [],
	restored = 0,
	conflict = false,
	fail = false,
	occupied = false;
const property = { autoSplit: true },
	subRail = { name: "sub" };
const positions = [
	{
		posX: 0,
		posY: 4,
		posZ: 0,
		anchorYaw: 0,
		anchorLengthHorizontal: 10,
		anchorLengthVertical: 10,
	},
	{
		posX: 0,
		posY: 4,
		posZ: 40,
		anchorYaw: 180,
		anchorLengthHorizontal: 10,
		anchorLengthVertical: 10,
	},
];
const sourceCore = {
	key: "source",
	positions,
	subRails: { size: () => 1, get: () => subRail },
	getResourceState: () => property,
	getSignal: () => 7,
	isLogicalRailOccupied: () => occupied,
};
const madeCore = {
	setSignal(value) {
		this.signal = value;
	},
	addSubRail(value) {
		this.sub = value;
	},
	markDirty() {},
	func_70296_d() {},
	sendPacket() {},
};
const switchCore = Object.assign(new context.TileEntityLargeRailSwitchCore(), {
	key: "switch",
	positions: [{ posX: 4, posY: 4, posZ: 0 }],
	isLogicalRailOccupied: () => occupied,
});
const helper = (context.AppleExtendedRailCompat = {
	normalizeDegrees: (a) => ((a + 540) % 360) - 180,
	getCore: (_world, pos) =>
		pos[0] === 99 ? sourceCore : pos[0] === 100 ? switchCore : madeCore,
	coreKey: (core) => core.key,
	getLogicalPositions: (core) => core.positions,
	getLogicalRailMap: () => ({ getRailPitch: () => 0 }),
	cloneRailPosition: (rp) => ({ ...rp }),
	propertyFromPlayer: () => property,
	resolveBuilderPoint: (_world, p) => ({
		posX: p.position[0],
		posY: p.position[1],
		posZ: p.position[2],
		anchorPitch: p.anchorPitch,
	}),
	planCreation: () => (conflict ? null : {}),
	createFromPositions: (_world, _player, rps, prop) => {
		created.push({ rps, prop });
		return fail ? null : { core: [1, 0, 0], key: "made" };
	},
	undoNormalRail: (_world, pos, key) => {
		removed.push(key);
		return "ok";
	},
	validateUndoNormalRail: () => (occupied ? "rail_occupied" : "ok"),
});
tools.switchPosition = (rp, type) => ({ ...rp, switchType: type });
tools.connectedEndpoints = () => [];
tools.restoreRecord = () => {
	restored++;
	return { core: [99, 0, 0], key: "restored" };
};
function existing(p = plan()) {
	p.source = {
		core: [99, 0, 0],
		railKey: "source",
		startPosition: [0, 4, 0],
		endPosition: [0, 4, 40],
	};
	return p;
}
// Single-crossover transactions are covered by the native divided-placement fixture.
for (const mask of [[1, 1, 1, 1]]) {
	const p = plan();
	p.switchTypes = mask;
	assert.equal(tools.createCrossoverBuilderRail(world, {}, p).status, "ok");
	assert.deepEqual(
		created.at(-1).rps.map((rp) => rp.switchType),
		mask,
	);
	assert.equal(tools.undoCrossoverBuilderRail(world, {}, "token"), "undo_ok");
}
const snapPlan = plan();
Object.assign(snapPlan.points[2], {
	kind: "rail",
	core: [100, 0, 0],
	index: 0,
});
tools.zeroExternalCant = () => {
	throw new Error("normal cant helper must not mutate a switch");
};
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, snapPlan).status,
	"ok",
);
assert.equal(tools.undoCrossoverBuilderRail(world, {}, "token"), "undo_ok");
loaded = [
	Object.assign(new RailBase(), {
		key: "connected",
		positions: [{ posX: 4, posY: 4, posZ: 0 }],
	}),
];
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, snapPlan).status,
	"endpoint_already_connected",
);
loaded = [];
let p = plan();
p.points[1].anchorPitch = 1;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, p).status,
	"sloped_or_changed_rail",
);
conflict = true;
const n = removed.length;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, existing()).status,
	"core_conflict",
);
assert.equal(removed.length, n, "preflight conflict must preserve source");
conflict = false;
p = existing();
p.points[0].anchorLength = 11;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, p).status,
	"rail_changed",
);
fail = true;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, existing()).status,
	"switch_create_failed",
);
assert.equal(restored, 1, "failed replacement restores original source");
fail = false;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, existing()).status,
	"ok",
);
assert.strictEqual(created.at(-1).prop, property);
assert.equal(madeCore.signal, 7);
assert.strictEqual(madeCore.sub, subRail);
occupied = true;
const beforeUndo = removed.length;
assert.equal(
	tools.undoCrossoverBuilderRail(world, {}, "token"),
	"rail_occupied",
);
assert.equal(
	removed.length,
	beforeUndo,
	"failed Undo must preserve created switch",
);
occupied = false;
assert.equal(tools.undoCrossoverBuilderRail(world, {}, "token"), "undo_ok");
assert.equal(restored, 2);
for (const method of ["setSignal", "addSubRail"]) {
	const original = madeCore[method];
	madeCore[method] = () => {
		throw new Error("metadata failure");
	};
	const count = restored;
	const removedBefore = removed.length;
	assert.equal(
		tools.createCrossoverBuilderRail(world, {}, existing()).status,
		"switch_create_failed",
	);
	assert.equal(restored, count + 1, method + " exception restores source");
	assert.deepEqual(
		removed.slice(removedBefore),
		["source", "made"],
		"replacement switch removed before restoring source",
	);
	const sync = tools.consumeLastSplitClientUpdate();
	assert.equal(
		sync.refreshed[0].key,
		"restored",
		"rollback refreshes replacement source identity",
	);
	assert(sync.removed.some((rail) => rail.key === "made"));
	madeCore[method] = original;
}
let cantChanged = false;
const neighbor = { isLogicalRailOccupied: () => false };
tools.connectedEndpoints = () => [{ core: neighbor, index: 0 }];
tools.zeroExternalCant = (_core, _index, records) => {
	records.push({ core: [200, 0, 0], railKey: "neighbor", positions: [] });
	cantChanged = true;
	throw new Error("cant preparation failure");
};
tools.restoreCantRecords = (_world, records) => {
	assert(records.length > 0, "cant snapshot exists before failing write");
	cantChanged = false;
	return true;
};
const beforeCantFailure = removed.length;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, existing()).status,
	"cant_update_failed",
);
assert.equal(cantChanged, false);
assert.equal(
	removed.length,
	beforeCantFailure,
	"cant failure must not remove source",
);
console.log(
	"AE crossover native layouts, stale source, rollback, metadata and occupied Undo passed",
);
