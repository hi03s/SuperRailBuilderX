const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
class Base {
	getRailCore() {
		return this;
	}
}
class Core extends Base {
	isLogicalRailOccupied() {
		return this.occupied || false;
	}
}
class SwitchCore extends Core {}
class List extends Array {
	add(v) {
		this.push(v);
	}
	size() {
		return this.length;
	}
	get(i) {
		return this[i];
	}
}
let nativeValid = true;
class Maker {
	getSwitch() {
		return nativeValid ? { getAllRailMap: () => [{}] } : null;
	}
}
const context = vm.createContext({
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		java: {
			util: {
				ArrayList: List,
				UUID: { randomUUID: () => ({ toString: () => "token" }) },
			},
		},
		jp: {
			ngt: {
				ngtlib: { io: { NGTLog: { debug() {} } } },
				rtm: {
					rail: {
						TileEntityLargeRailBase: Base,
						TileEntityLargeRailCore: Core,
						TileEntityLargeRailSwitchCore: SwitchCore,
						util: {
							RailMaker: Maker,
							RailMapBasic: { fixRTMRailMapVersionCurrent: 1 },
						},
					},
				},
			},
		},
	},
});
context.java = context.Packages.java;
const root = "dist/assets/minecraft/";
vm.runInContext(
	fs.readFileSync(
		root + "scripts/superrailbuilderx/SRBXCrossoverValidation.js",
		"utf8",
	),
	context,
);
const dir = root + "__targets__/kaizpatch/scripts/superrailbuilderx/";
vm.runInContext(
	fs.readFileSync(
		dir +
			fs
				.readdirSync(dir)
				.find(
					(n) =>
						n.startsWith("SRBXApiCompat.") &&
						n.endsWith(".compat.js"),
				),
		"utf8",
	),
	context,
);
const api = Object.values(context.RTMX_COMPAT_TARGETS.kaizpatch)[0]
	.SRBXApiCompat;
const point = (x, z, yaw) => ({
	kind: "free",
	position: [x, 4, z],
	markerPosition: [x, 4, z],
	direction: yaw === 180 ? 4 : 0,
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
	switchTypes: [1, 0, 0, 1],
});
const rp = (p) => ({
	posX: p.position[0],
	posY: p.position[1],
	posZ: p.position[2],
	blockX: Math.floor(p.position[0]),
	blockY: 3,
	blockZ: Math.floor(p.position[2]),
	anchorYaw: p.anchorYaw,
	anchorPitch: 0,
	anchorLengthHorizontal: 10,
	anchorLengthVertical: 10,
});
let tiles = new Map(),
	removed = 0,
	restored = 0,
	made = 0,
	fail = false,
	loaded = true;
const world = { getTileEntity: (x, y, z) => tiles.get([x, y, z].join(",")) };
world.func_147438_o = world.getTileEntity;
const source = new Core();
source.key = "source";
source.subRails = new List({ name: "sub" });
source.getProperty = () => ({ name: "original" });
source.getSignal = () => 7;
const created = new SwitchCore();
created.key = "created";
created.setSignal = (v) => (created.signal = v);
created.addSubRail = () => {};
Object.assign(api, {
	hasFreeEndpointPatch: () => true,
	validateBuilderPoint: () => "ok",
	createBuilderProperty: () => ({ name: "held" }),
	cloneRailProperty: (p) => ({ ...p }),
	createBuilderFreePoint: rp,
	withSwitchType: (p, t) => ({ ...p, switchType: t }),
	toRailPositionArray: (p) => p,
	isBuilderRoadbedLoaded: () => loaded,
	getRailPositionCandidateKey: (c) => c.key,
	getRailPositionUnsupportedReason: () => "",
	isFlatBuilderRail: () => true,
	isSectionCore: () => true,
	getEditableRailPositions: () => plan().points.slice(0, 2).map(rp),
	copyRailPositions: (p) => p.map((x) => ({ ...x })),
	builderAngleDifference: (a, b) => a - b,
	getBuilderMoveProtectedRailKeys: () => [],
	findConnectedCantEndpoints: () => [],
	breakOwnedRail: () => {
		removed++;
		tiles.delete("0,3,0");
	},
	createBuilderBasicSwitch: (w, p, prop) => {
		made++;
		assert.equal(p.length, 4);
		assert.equal(prop.autoSplit, false);
		return fail ? null : created;
	},
	restoreSplitSource: () => {
		restored++;
		return { core: [0, 3, 0], key: "restored" };
	},
	getRailCorePos: () => [0, 3, 0],
	markCoreDirty: () => {},
	sendRailCorePacket: () => {},
	zeroRailCants: () => [],
	restoreCantRecords: () => ({ status: "ok", refreshed: [] }),
	undoBuilderRail: () => "ok",
});
for (const mask of [
	[1, 0, 0, 1],
	[0, 1, 1, 0],
	[1, 1, 1, 1],
]) {
	const p = plan();
	p.switchTypes = mask;
	assert.equal(api.createCrossoverBuilderRail(world, {}, p).status, "ok");
	assert.equal(api.undoCrossoverBuilderRail(world, {}, "token"), "undo_ok");
}
assert.equal(removed, 0);
let p = plan();
p.points[2].position[1]++;
assert.equal(
	api.createCrossoverBuilderRail(world, {}, p).status,
	"sloped_or_changed_rail",
);
p = plan();
p.switchTypes = [1, 1, 0, 0];
assert.equal(
	api.createCrossoverBuilderRail(world, {}, p).status,
	"invalid_switch_layout",
);
p = plan();
p.source = {
	core: [NaN, 3, 0],
	railKey: "source",
	startPosition: [0, 4, 0],
	endPosition: [0, 4, 40],
};
assert.equal(
	api.createCrossoverBuilderRail(world, {}, p).status,
	"invalid_source_rail",
);
const sourced = () => ({
	...plan(),
	source: {
		core: [0, 3, 0],
		railKey: "source",
		startPosition: [0, 4, 0],
		endPosition: [0, 4, 40],
	},
});
tiles.set("0,3,0", source);
p = sourced();
p.points[0].anchorYaw = 45;
assert.equal(
	api.createCrossoverBuilderRail(world, {}, p).status,
	"rail_changed",
);
assert.equal(removed, 0);
nativeValid = false;
assert.equal(
	api.createCrossoverBuilderRail(world, {}, sourced()).status,
	"invalid_switch_layout",
);
assert.equal(removed, 0);
nativeValid = true;
loaded = false;
assert.equal(
	api.createCrossoverBuilderRail(world, {}, sourced()).status,
	"path_unloaded",
);
assert.equal(removed, 0);
loaded = true;
tiles.set("4,3,0", new Core());
assert.equal(
	api.createCrossoverBuilderRail(world, {}, sourced()).status,
	"rail_overlap",
);
assert.equal(removed, 0);
tiles.delete("4,3,0");
fail = true;
assert.equal(
	api.createCrossoverBuilderRail(world, {}, sourced()).status,
	"switch_create_failed",
);
assert.equal(removed, 1);
assert.equal(restored, 1);
fail = false;
tiles.set("0,3,0", source);
const previousRestored = restored;
created.setSignal = () => {
	throw Error("metadata");
};
assert.equal(
	api.createCrossoverBuilderRail(world, {}, sourced()).status,
	"switch_create_failed",
);
assert.equal(
	restored,
	previousRestored + 1,
	"post-create exception restores original baseline",
);
created.setSignal = (v) => (created.signal = v);
const neighbor = new Core();
neighbor.occupied = true;
api.findConnectedCantEndpoints = () => [{ core: neighbor, index: 0 }];
tiles.set("0,3,0", source);
const previousRemoved = removed;
assert.equal(
	api.createCrossoverBuilderRail(world, {}, sourced()).status,
	"rail_occupied",
);
assert.equal(
	removed,
	previousRemoved,
	"occupied connected rail rejects before baseline deletion",
);
api.findConnectedCantEndpoints = () => [];
tiles.set("0,3,0", source);
assert.equal(api.createCrossoverBuilderRail(world, {}, sourced()).status, "ok");
assert.equal(created.signal, 7);
const record = api.splitUndoRecords.token;
assert.equal(record.property.name, "original");
assert.equal(record.subRails.size(), 1);
assert.equal(record.wasSectioned, true);
let undoCalled = 0;
api.undoSplitBuilderRail = () => {
	undoCalled++;
	return "undo_ok";
};
assert.equal(api.undoCrossoverBuilderRail(world, {}, "token"), "undo_ok");
assert.equal(undoCalled, 1);
assert.equal(
	api.undoCrossoverBuilderRail(world, {}, "token"),
	"nothing_to_undo",
);
assert.equal(
	context.validateCrossoverPlan({ ...plan(), points: [null] }),
	"invalid_request",
);
api.createBuilderProperty = () => null;
const adjacent = new Core();
adjacent.key = "adjacent";
adjacent.getProperty = () => ({ name: "adjacent model" });
tiles.clear();
tiles.set("-1,3,0", adjacent);
api.getLoadedRailCores = () => [];
api.resolveBuilderRailPoint = (_world, p) => rp(p);
const connected = plan();
connected.points[0] = {
	...connected.points[0],
	kind: "rail",
	core: [-1, 3, 0],
	index: 0,
};
api.createBuilderBasicSwitch = (_w, _p, property) => {
	assert.equal(property.name, "adjacent model");
	return created;
};
assert.equal(
	api.createCrossoverBuilderRail(world, {}, connected).status,
	"ok",
	"connected baseline inherits rail model without held item",
);
console.log(
	"Kaiz crossover native layouts, source revalidation, owner/loaded preflight, rollback and Undo passed",
);
