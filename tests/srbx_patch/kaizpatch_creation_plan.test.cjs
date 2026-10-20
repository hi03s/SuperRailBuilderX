const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert"),
	path = require("path");
class Base {
	getRailCore() {
		return this;
	}
}
class Core extends Base {
	isSameLogicalRail(other) {
		return this === other || (!!this.group && this.group === other.group);
	}
}
class Block {
	constructor(core = false) {
		this.core = core;
	}
	isCore() {
		return this.core;
	}
}
class MapBasic {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}
	getLength() {
		return Math.hypot(
			this.end.posX - this.start.posX,
			this.end.posY - this.start.posY,
			this.end.posZ - this.start.posZ,
		);
	}
	getStartRP() {
		return this.start;
	}
	getEndRP() {
		return this.end;
	}
}
const list = (a) => ({ size: () => a.length, get: (i) => a[i] });
const config = { railGeneratingDistance: 64 },
	messages = [];
const context = {
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		java: {
			util: {
				ArrayList: class extends Array {
					add(value) {
						this.push(value);
					}
				},
			},
		},
		jp: {
			ngt: {
				ngtlib: { io: { NGTLog: { debug: (s) => messages.push(s) } } },
				rtm: {
					RTMConfig: config,
					rail: {
						TileEntityLargeRailBase: Base,
						TileEntityLargeRailCore: Core,
						BlockLargeRailBase: Block,
						util: { RailMapBasic: MapBasic },
					},
				},
			},
			kaiz: {
				kaizpatch: {
					rtm: {
						rail: {
							util: {
								RailMapSection: class extends MapBasic {
									constructor(_source, start, end) {
										super(start, end);
									}
								},
								RailChunkSectioner: {
									split: (map) =>
										list(
											[map.start, map.end].map((rp) => ({
												getStartRP: () => rp,
												getEndRP: () => map.end,
												getStartRatio: () => 0,
												getEndRatio: () => 1,
											})),
										),
								},
							},
						},
					},
				},
			},
		},
	},
};
vm.createContext(context);
vm.runInContext(
	fs.readFileSync(
		"dist/assets/minecraft/scripts/superrailbuilderx/SRBXRailBoundary.js",
		"utf8",
	),
	context,
);
vm.runInContext(
	fs.readFileSync(
		"dist/assets/minecraft/scripts/superrailbuilderx/SRBXFreeEndpointPolicy.js",
		"utf8",
	),
	context,
);
const dir =
	"dist/assets/minecraft/__targets__/kaizpatch/scripts/superrailbuilderx";
vm.runInContext(
	fs.readFileSync(
		path.join(
			dir,
			fs
				.readdirSync(dir)
				.find(
					(n) =>
						n.startsWith("SRBXApiCompat.") &&
						n.endsWith(".compat.js"),
				),
		),
		"utf8",
	),
	context,
);
const api = Object.values(context.RTMX_COMPAT_TARGETS.kaizpatch)[0]
	.SRBXApiCompat;
const tiles = new Map(),
	world = {
		func_147465_d() {
			throw Error("Planning must not mutate the world");
		},
		func_72899_e: () => true,
		func_147438_o: (x, y, z) => tiles.get([x, y, z].join(",")) || null,
		func_147439_a: (x, y, z) =>
			new Block(tiles.get([x, y, z].join(",")) instanceof Core),
	};
const point = (x) => ({
	kind: "free",
	position: [x, 4.0625, 0.5],
	anchorLength: 1,
	anchorPitch: 0,
	anchorYaw: 90,
	direction: 2,
	markerPosition: [x, 4, 0],
});
const toRP = (p) => ({
	posX: p.position[0],
	posY: p.position[1],
	posZ: p.position[2],
	blockX: Math.floor(p.position[0]),
	blockY: 4,
	blockZ: 0,
	anchorYaw: p.anchorYaw,
	anchorPitch: 0,
	direction: 2,
});
let preparation = "reverse",
	attempts = [],
	created = [];
const resultCore = new Core();
Object.assign(api, {
	hasFreeEndpointPatch: () => true,
	validateBuilderPoint: () => "ok",
	createBuilderSourceProperty: () => null,
	createBuilderProperty: () => ({ autoSplit: true }),
	createBuilderFreePoint: toRP,
	getBuilderProtectedRailKeys: () => ({}),
	hasOnlyBuilderSectionCoreCrossings: () => false,
	prepareBuilderSectionCorePositions: (_w, map) => {
		attempts.push(map.start.posX);
		return preparation === "reverse" && map.start.posX > map.end.posX
			? "ok"
			: "section_core_conflict";
	},
	isBuilderRoadbedLoaded: () => true,
	validateBuilderPlacement: () => "ok",
	createBuilderSectionedRail: (_w, map) => {
		created.push({ mode: "section", map });
		return resultCore;
	},
	createBuilderNormalRail: (_w, map) => {
		created.push({ mode: "normal", map });
		return resultCore;
	},
	assignEndpointRoadbeds: () => {},
	getRailCorePos: () => [99, 4, 0],
	getRailPositionCandidateKey: () => "created",
	logBuilderTransitionState: () => {},
});
const generate = (length, force = false, endHeight = 4.0625) =>
	api.createBuilderRail(
		world,
		{},
		point(0.35),
		{ ...point(length + 0.35), position: [length + 0.35, endHeight, 0.5] },
		undefined,
		undefined,
		undefined,
		force,
		false,
		false,
		undefined,
		undefined,
		true,
	);
function reset() {
	attempts = [];
	created = [];
	tiles.clear();
}
reset();
assert.equal(generate(50).status, "ok");
assert.deepEqual(attempts, [0.35, 50.35]);
assert.equal(created[0].mode, "section");
assert.equal(created[0].map.start.posX, 50.35);
preparation = "blocked";
reset();
assert.equal(generate(50).status, "ok");
assert.equal(created[0].mode, "normal");
assert.equal(attempts.length, 2);
reset();
assert.equal(generate(70).status, "section_core_conflict");
assert.equal(
	created.length,
	0,
	"Both section plans fail: over-cap fallback must not mutate",
);
config.railGeneratingDistance = 96;
reset();
assert.equal(generate(80).status, "ok");
assert.equal(
	created[0].mode,
	"normal",
	"Use configured cap rather than hard-coded 64",
);
config.railGeneratingDistance = 64;
reset();
assert.equal(generate(80, true).status, "normal_rail_too_long");
assert.equal(created.length, 0);
reset();
assert.equal(generate(20, true, 4.062499999999999).status, "ok");
assert.equal(
	created[0].map.start.posX,
	0.35,
	"Horizontal curve rounding must retain the reserved normal core",
);
assert.equal(
	created[0].map.end.posY,
	4.062499999999999,
	"Ordering tolerance does not move precise endpoints",
);
reset();
assert.equal(generate(20, true, 4.0615).status, "ok");
assert.equal(
	created[0].map.start.posX,
	20.35,
	"A real descent still starts at its lower endpoint",
);
reset();
tiles.set("0,4,0", new Core());
assert.equal(generate(20, true).status, "ok");
assert.equal(
	created[0].map.start.posX,
	20.35,
	"Normal core also chooses the unoccupied opposite endpoint",
);
reset();
tiles.set("0,4,0", new Core());
tiles.set("20,4,0", new Core());
assert.equal(generate(20, true).status, "section_core_conflict");
assert.equal(created.length, 0);
console.log(
	"KaizPatch reverse planning, configured normal fallback cap and occupied endpoint core protection passed",
);

// Switch endpoints must reject conflicting owners before deleting the source.
api.getCoreWorld = () => world;
const endpointSource = new Core();
const planSwitchOwners = api.planSwitchMoveOwners;
api.planSwitchMoveOwners = (_core, positions) => positions;
const owners = [0, 20, 30].map((x) => ({ blockX: x, blockY: 4, blockZ: 0 }));
tiles.clear();
tiles.set("20,4,0", new Core());
assert.strictEqual(
	api.validateSwitchMovePath(endpointSource, owners),
	"rail_overlap",
);
assert.strictEqual(
	api.validateSwitchMovePath(endpointSource, [owners[0], owners[0]]),
	"switch_owner_overlap",
);

// A native creation exception must restore all original switch endpoints and
// publish the replacement identity so a subsequent Undo can find it.
const switchPositions = [0, 20, 30].map((x) => ({
	posX: x,
	posY: 4,
	posZ: 0,
	setPosition(x, y, z) {
		this.posX = x;
		this.posY = y;
		this.posZ = z;
	},
}));
endpointSource.getProperty = () => ({});
endpointSource.getSignal = () => 7;
endpointSource.subRails = list([]);
api.getEditableRailPositions = () => switchPositions;
api.copyRailPositions = (rps) => rps.map((rp) => ({ ...rp }));
api.cloneRailProperty = (p) => ({ ...p });
const updateOwner = api.updateBoundaryOwner;
api.updateBoundaryOwner = () => {};
api.getBuilderMoveProtectedRailKeys = () => ["foreign"];
let sourceBreaks = 0,
	switchAttempts = 0,
	restoredPoints,
	synchronized;
const replacementSwitch = {};
api.breakOwnedRail = () => sourceBreaks++;
api.createBuilderBasicSwitch = (_world, positions, _prop, protectedKeys) => {
	assert(protectedKeys.includes("foreign"));
	if (++switchAttempts === 1) throw Error("native switch creation failed");
	restoredPoints = positions.map((rp) => rp.posX);
	return replacementSwitch;
};
api.getRailCorePos = () => [0, 4, 0];
api.applyBuilderRailState = (_w, _result, signal) => {
	assert.strictEqual(signal, 7);
	return true;
};
api.recordLastRailPositionMoveCores = (core) => {
	synchronized = core;
};
assert.strictEqual(
	api.moveSwitchRailPosition(endpointSource, 2, 35, 4, 0),
	"switch_rebuild_failed",
);
assert.deepStrictEqual(restoredPoints, [0, 20, 30]);
assert.deepStrictEqual(
	switchPositions.map((rp) => rp.posX),
	[0, 20, 30],
);
assert.strictEqual(sourceBreaks, 1);
assert.strictEqual(synchronized, replacementSwitch);
assert(
	tiles.get("20,4,0") instanceof Core,
	"connected foreign rail remains intact",
);
console.log(
	"KaizPatch switch endpoint owner protection and exception rollback passed",
);

// Use native offset decoding so serialization cannot conceal owner changes.
const revisions = [
	[0, -0.5],
	[-0.5, -0.5],
	[-0.5, 0],
	[-0.5, 0.5],
	[0, 0.5],
	[0.5, 0.5],
	[0.5, 0],
	[0.5, -0.5],
];
const offsetPosition = (x, y, z, direction = 2) => ({
	blockX: -37,
	blockY: 4,
	blockZ: 851,
	direction,
	height: 0,
	anchorYaw: 247.3,
	posX: x,
	posY: y,
	posZ: z,
	setPosition(x, y, z) {
		this.offsetX = x - (this.blockX + 0.5 + revisions[this.direction][0]);
		this.offsetY = y - (this.blockY + (this.height + 1) / 16);
		this.offsetZ = z - (this.blockZ + 0.5 + revisions[this.direction][1]);
		this.posX = x;
		this.posY = y;
		this.posZ = z;
	},
	decode() {
		return [
			this.blockX + 0.5 + revisions[this.direction][0] + this.offsetX,
			this.blockY + (this.height + 1) / 16 + this.offsetY,
			this.blockZ + 0.5 + revisions[this.direction][1] + this.offsetZ,
		];
	},
});
for (const destination of [
	[-34.39, 4.0625, 842.51],
	[18, 7.0625, -2.125],
]) {
	const rp = offsetPosition(...destination);
	rp.setPosition(...destination);
	updateOwner.call(api, rp);
	assert.deepStrictEqual(
		rp.decode(),
		destination,
		"Moved coordinates survive native NBT decoding",
	);
	api.restoreMovedPoint(rp, { ownerBlock: [-37, 4, 851], direction: 7 });
	assert.deepStrictEqual(
		rp.decode(),
		destination,
		"Undo owner restoration also rebases offsets",
	);
}
api.planSwitchMoveOwners = planSwitchOwners;
api.toRailPositionArray = (rps) => rps;
let footprint = [
	[0, 4, 0],
	[20, 4, 0],
	[21, 4, 0],
	[30, 4, 0],
];
context.Packages.jp.ngt.rtm.rail.util.RailMaker = class {
	getSwitch() {
		return {
			getAllRailMap: () => [{ getRailBlockList: () => list(footprint) }],
		};
	}
};
const conflictEndpoints = [0, 20, 30].map((x) => {
	const rp = offsetPosition(x + 0.25, 4.0625, 0.5);
	rp.blockX = x;
	rp.blockZ = 0;
	rp.setPosition(x + 0.25, 4.0625, 0.5);
	return rp;
});
tiles.clear();
const foreignOwner = new Core();
tiles.set("20,4,0", foreignOwner);
const planned = planSwitchOwners.call(api, endpointSource, conflictEndpoints);
assert(planned);
assert.equal(
	planned[1].blockX,
	21,
	"Auxiliary switch base avoids connected normal core",
);
assert.deepStrictEqual(planned[1].decode(), [20.25, 4.0625, 0.5]);
assert.equal(
	conflictEndpoints[1].blockX,
	20,
	"Planning preserves input and existing core",
);
assert.equal(tiles.get("20,4,0"), foreignOwner);
footprint = [
	[0, 4, 0],
	[20, 4, 0],
	[30, 4, 0],
];
assert.equal(
	planSwitchOwners.call(api, endpointSource, conflictEndpoints),
	null,
	"No safe auxiliary owner fails without removing rails",
);
tiles.set("0,4,0", new Core());
assert.equal(
	planSwitchOwners.call(api, endpointSource, conflictEndpoints),
	null,
	"A foreign root core is always protected",
);
console.log(
	"KaizPatch endpoint NBT round-trip and connected switch auxiliary-owner relocation passed",
);

// Crossover replacement may share an endpoint owner with a connected core.
footprint = [
	[0, 4, 0],
	[20, 4, 0],
	[21, 4, 0],
	[30, 4, 0],
	[40, 4, 0],
];
tiles.clear();
tiles.set("20,4,0", foreignOwner);
const crossoverEndpoints = conflictEndpoints.concat(
	offsetPosition(40.25, 4.0625, 0.5),
);
const crossoverOwners = planSwitchOwners.call(
	api,
	endpointSource,
	crossoverEndpoints,
);
assert(crossoverOwners);
assert.equal(crossoverOwners.length, 4);
assert.equal(crossoverOwners[1].blockX, 21);
assert.deepStrictEqual(crossoverOwners[1].decode(), [20.25, 4.0625, 0.5]);
assert.equal(tiles.get("20,4,0"), foreignOwner);
const section = new Core();
section.group = endpointSource.group = "baseline";
tiles.set("20,4,0", section);
const sectionOwners = planSwitchOwners.call(
	api,
	endpointSource,
	crossoverEndpoints,
);
assert.equal(
	sectionOwners[1].blockX,
	20,
	"Own section cores are removed with source; no unnecessary relocation",
);
console.log(
	"Crossover four-endpoint owner planning preserves connected cores, precise coordinates and source sections",
);
