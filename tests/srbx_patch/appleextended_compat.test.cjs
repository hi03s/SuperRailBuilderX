const fs = require("fs");
const vm = require("vm");
const path = require("path");
const assert = require("assert");
const root = "dist/assets/minecraft/__targets__/appleextended/scripts";
class ArrayList {
	constructor() {
		this.values = [];
	}
	add(value) {
		this.values.push(value);
	}
	get(index) {
		return this.values[index];
	}
}
class RailMapBasic {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}
	getRailBlockList() {
		return { size: () => 0 };
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
	getRailPos(split, index) {
		const t = index / split;
		return [
			this.start.posZ + (this.end.posZ - this.start.posZ) * t,
			this.start.posX + (this.end.posX - this.start.posX) * t,
		];
	}
	getRailHeight(split, index) {
		return (
			this.start.posY +
			((this.end.posY - this.start.posY) * index) / split
		);
	}
}
class RailMapSection extends RailMapBasic {
	constructor(_source, start, end) {
		super(start, end);
	}
}
class SectionCore {}
class RailBase {}
class RailCore extends RailBase {}
class SwitchCore extends RailCore {}
class BlockPos {
	constructor(x, y, z) {
		this.x = x;
		this.y = y;
		this.z = z;
	}
}
const world = { func_175625_s: () => null, func_175623_d: () => false };
class Thread {
	constructor(task) {
		this.task = task;
	}
	setDaemon() {}
	start() {
		this.task();
	}
}
const messages = [];
let scheduled = false;
const context = {
	AppleExtendedRoadbedPlacement: { hasExisting: () => false },
	AppleExtendedSectionPlacementCompat: { plan: () => null },
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		java: { util: { ArrayList }, lang: { Thread } },
		jp: {
			ngt: {
				ngtlib: {
					io: {
						NGTLog: { debug: (message) => messages.push(message) },
					},
				},
				rtm: {
					RTMCore: { railGeneratingDistance: 64 },
					item: {
						ItemRail: {
							getDefaultProperty: () => ({ readFromNBT() {} }),
						},
					},
					rail: {
						TileEntityLargeRailBase: RailBase,
						TileEntityLargeRailCore: RailCore,
						TileEntityLargeRailSwitchCore: SwitchCore,
						BlockMarker: { createRail: () => false },
						util: { RailMapBasic },
					},
				},
			},
			apple: {
				rail: {
					TileEntityLargeRailSectionCore: SectionCore,
					util: {
						RailMapSection,
						RailChunkSectioner: {
							split: () => ({ size: () => 0 }),
						},
					},
				},
			},
		},
		net: {
			minecraft: {
				nbt: { NBTTagCompound: class {} },
				util: { math: { BlockPos } },
				client: {
					Minecraft: {
						func_71410_x: () => ({
							func_152343_a(task) {
								scheduled = true;
								task();
							},
						}),
					},
				},
			},
		},
	},
};
context.java = {
	lang: {
		reflect: { Array: { newInstance: (_type, n) => Array(n).fill(0) } },
		Integer: { TYPE: "int" },
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

if (
	context.AppleExtendedRailCompat &&
	!context.AppleExtendedRailCompat.areBoundaryPositions
)
	context.AppleExtendedRailCompat.areBoundaryPositions = () => true;
function load(relative) {
	vm.runInContext(
		fs.readFileSync(path.join(root, relative), "utf8"),
		context,
	);
}
function loadCompat(dir, prefix) {
	load(
		`${dir}/${fs.readdirSync(path.join(root, dir)).find((name) => name.startsWith(prefix) && name.endsWith(".compat.js"))}`,
	);
}
load("superrailbuilderx/AppleExtendedRailProtection.js");
vm.runInContext(
	fs.readFileSync(
		"dist/assets/minecraft/scripts/superrailbuilderx/SRBXRoadbedOwnership.js",
		"utf8",
	),
	context,
);
load("superrailbuilderx/AppleExtendedRailCompat.js");
loadCompat("superrailbuilderx", "SRBXApiCompat.");
const api = Object.values(context.RTMX_COMPAT_TARGETS.appleextended)[0]
	.SRBXApiCompat;
api.hasFreeEndpointPatch = () => true;
const helper = context.AppleExtendedRailCompat;
// Planning must honor the actual RTM config and try reversed sections before
// normal fallback. All callbacks here are read-only; no creation API is used.
{
	const rp = (x) => ({
		blockX: Math.floor(x),
		blockY: 4,
		blockZ: 0,
		posX: x,
		posY: 4.0625,
		posZ: 0.5,
	});
	const config = context.Packages.jp.ngt.rtm.RTMCore;
	const freeWorld = { func_175625_s: () => null };
	assert.equal(
		helper.planCreation(freeWorld, [rp(0.35), rp(80.35)], {
			autoSplit: false,
		}),
		null,
	);
	config.railGeneratingDistance = 96;
	assert(
		helper.planCreation(freeWorld, [rp(0.35), rp(80.35)], {
			autoSplit: false,
		}),
	);
	config.railGeneratingDistance = 64;
	const sectioner = context.Packages.jp.apple.rail.util.RailChunkSectioner;
	const oldSplit = sectioner.split,
		oldPlan = context.AppleExtendedSectionPlacementCompat.plan;
	const conflict = new RailCore();
	conflict.getRailCore = () => conflict;
	const conflictWorld = {
		func_175625_s: (p) => (p.x === 32 ? conflict : null),
	};
	sectioner.split = (map) => ({
		size: () => 2,
		get: (i) => ({ getStartRP: () => (i ? rp(32.35) : map.start) }),
	});
	let reversed = null;
	context.AppleExtendedSectionPlacementCompat.plan = (_w, start, end) => {
		reversed = [start.posX, end.posX];
		return { source: new RailMapBasic(start, end), sections: [{ start }] };
	};
	const prop = { autoSplit: true, writeToNBT: () => ({}) };
	assert(
		helper.planCreation(conflictWorld, [rp(0.35), rp(80.35)], prop)
			.sections,
	);
	assert.deepEqual(reversed, [0.35, 80.35]);
	context.AppleExtendedSectionPlacementCompat.plan = () => null;
	assert.equal(
		helper.planCreation(conflictWorld, [rp(0.35), rp(80.35)], prop),
		null,
	);
	const fallback = helper.planCreation(
		conflictWorld,
		[rp(0.35), rp(50.35)],
		prop,
	);
	assert.equal(fallback.property.autoSplit, false);
	sectioner.split = oldSplit;
	context.AppleExtendedSectionPlacementCompat.plan = oldPlan;
}
// Connecting reverses the endpoint heading; edge cant must reverse with it.
const savedClone = helper.cloneRailPosition;
helper.cloneRailPosition = (rp) => ({ ...rp });
const connectionCore = new RailBase();
connectionCore.getRailCore = () => connectionCore;
const savedTileLookup = world.func_175625_s;
world.func_175625_s = () => connectionCore;
for (const edge of [-8, 0, 8])
	for (const index of [0, 1]) {
		const source = {
			posX: 1,
			posY: 4.5,
			posZ: 2.75,
			direction: 2,
			anchorYaw: 90,
			anchorPitch: 3,
			cantEdge: edge,
			cantCenter: 5,
			getNeighborBlockPos: () => ({
				func_177958_n: () => 2,
				func_177956_o: () => 4,
				func_177952_p: () => 2,
			}),
			setPosition(x, y, z) {
				this.posX = x;
				this.posY = y;
				this.posZ = z;
			},
		};
		connectionCore.getLogicalRailPositions = () => [source, source];
		const result = helper.resolveBuilderPoint(world, {
			kind: "rail",
			core: [1, 4, 2],
			index,
			position: [1, 4.5, 2.75],
		});
		assert.strictEqual(result.cantEdge, -edge);
		assert.strictEqual(result.cantCenter, 5);
		assert.strictEqual(result.anchorYaw, 270);
		for (const center of [0, -5, 5]) {
			const request = {
				kind: "rail",
				core: [1, 4, 2],
				index,
				position: [1, 4.5, 2.75],
				cantCenter: center,
				cantRandom: 0.25,
			};
			const copied = helper.resolveBuilderPoint(world, request);
			assert.strictEqual(copied.cantEdge, -edge);
			assert.strictEqual(
				copied.cantCenter,
				center,
				"AE copy center must survive endpoint snapping",
			);
			assert.strictEqual(copied.cantRandom, 0.25);
			for (const copyEdge of [-2, 0, 2]) {
				const snappedCopy = helper.resolveRailPoint(
					world,
					{ ...request, cantEdge: copyEdge },
					true,
				);
				assert.strictEqual(
					snappedCopy.cantEdge,
					copyEdge,
					"AE copy endpoint cant is deliberately independent of the neighbour",
				);
				assert.strictEqual(snappedCopy.cantCenter, center);
			}
			assert.strictEqual(
				helper.resolveRailPoint(
					world,
					{ ...request, cantEdge: NaN },
					true,
				),
				null,
			);
			assert.strictEqual(
				source.cantCenter,
				5,
				"Existing rail is never modified",
			);
			for (const field of ["cantCenter", "cantRandom"])
				assert.strictEqual(
					helper.resolveBuilderPoint(world, {
						...request,
						[field]: NaN,
					}),
					null,
				);
		}
		assert.strictEqual(
			source.cantEdge,
			edge,
			"source rail stays unchanged",
		);
		// getRailRoll uses start.cantEdge and -end.cantEdge in AE 2.5.3.
		for (const newEnd of [false, true]) {
			const oldRoll = index === 0 ? edge : -edge;
			const newRoll = newEnd ? -result.cantEdge : result.cantEdge;
			const reverseTravel = index === (newEnd ? 1 : 0);
			assert.strictEqual(newRoll, reverseTravel ? -oldRoll : oldRoll);
		}
	}
const faceSource = {
	posX: 1,
	posY: 4.0625,
	posZ: 2.75,
	direction: 2,
	anchorYaw: 45,
	anchorPitch: 0,
	cantEdge: 0,
	cantCenter: 0,
	setPosition(x, y, z) {
		this.posX = x;
		this.posY = y;
		this.posZ = z;
	},
};
connectionCore.getLogicalRailPositions = () => [faceSource, faceSource];
const faceConnection = helper.resolveBuilderPoint(world, {
	kind: "rail",
	core: [1, 4, 2],
	index: 0,
	position: [1, 4.0625, 2.75],
});
assert.strictEqual(
	faceConnection.direction,
	6,
	"a single X-face connection must not cross a Z cell",
);
assert.strictEqual(
	faceConnection.anchorYaw,
	225,
	"actual diagonal tangent is preserved",
);
assert.deepStrictEqual(
	[faceConnection.blockX, faceConnection.blockY, faceConnection.blockZ],
	[0, 4, 2],
);
faceSource.posX = 1.25;
const interiorConnection = helper.resolveBuilderPoint(world, {
	kind: "rail",
	core: [1, 4, 2],
	index: 0,
	position: [1.25, 4.0625, 2.75],
});
assert(interiorConnection, "precise interior endpoints remain connectable");
assert.deepStrictEqual(
	[interiorConnection.posX, interiorConnection.posY, interiorConnection.posZ],
	[1.25, 4.0625, 2.75],
);
assert.equal(
	faceSource.posX,
	1.25,
	"resolving an endpoint must not move the source",
);
world.func_175625_s = savedTileLookup;
helper.cloneRailPosition = savedClone;
const positions = [
	{ blockX: 1, blockY: 4, blockZ: 2, posY: 4 },
	{ blockX: 1, blockY: 4, blockZ: 82, posY: 4 },
];
for (const section of [new SectionCore(), new SectionCore()]) {
	section.getLogicalRailPositions = () => positions;
	section.getAllRailMaps = () => {
		throw new Error("physical section maps must not be used");
	};
	const map = api.getLogicalRailMap(section);
	assert.strictEqual(map.start, positions[0]);
	assert.strictEqual(map.end, positions[1]);
}
assert.strictEqual(api.getLogicalRailMap(null), null);
assert.strictEqual(
	api.getLogicalRailMap({ getLogicalRailPositions: () => null }),
	null,
);
assert.strictEqual(
	api.getLogicalRailMap({ getLogicalRailPositions: () => [null, null] }),
	null,
);
const core = {
	func_174877_v: () => ({
		func_177958_n: () => 1,
		func_177956_o: () => 4,
		func_177952_p: () => 2,
	}),
};
helper.coreKey = () => "created";
helper.isSectionCore = () => true;
let cores = [null, core];
helper.getCore = () => cores.shift();
const player = { field_71075_bZ: { field_75098_d: true } };
assert.strictEqual(
	helper.createFromPositions(world, player, positions, {}).key,
	"created",
);
assert(
	messages.some((message) =>
		message.includes("creation confirmed: apiResult=false"),
	),
);
for (const pair of [
	[null, null],
	[core, core],
]) {
	cores = pair.slice();
	assert.strictEqual(
		helper.createFromPositions(world, player, positions, {}),
		null,
	);
}
// AE selects the second endpoint at equal block height, regardless of posY.
for (const heights of [
	[4, 4],
	[4.9, 4.1],
	[4.1, 4.9],
]) {
	const endpoints = positions.map((position, index) => ({
		...position,
		posY: heights[index],
	}));
	let createdAt = null;
	context.Packages.jp.ngt.rtm.rail.BlockMarker.createRail = (
		_world,
		x,
		y,
		z,
		list,
	) => {
		const a = list.get(0),
			b = list.get(1);
		const owner = a.blockY >= b.blockY ? b : a;
		createdAt = [owner.blockX, owner.blockY, owner.blockZ];
		return false;
	};
	helper.getCore = (_world, position) =>
		createdAt &&
		position.every((value, index) => value === createdAt[index])
			? core
			: null;
	assert.strictEqual(
		helper.createFromPositions(world, player, endpoints, {}).key,
		"created",
	);
}
// A real failure must not yield an Undo record.
context.Packages.jp.ngt.rtm.rail.BlockMarker.createRail = () => false;
helper.getCore = () => null;
assert.strictEqual(
	helper.createFromPositions(world, player, positions, {}),
	null,
);
// Offset endpoints can have a different first Section owner than logical blockZ.
const sectionOwners = [
	{ ...positions[1], blockZ: 81 },
	{ ...positions[0], blockZ: 32 },
];
context.Packages.jp.apple.rail.util.RailChunkSectioner.split = () => ({
	size: () => 2,
	get: (index) => ({
		getStartRP: () => sectionOwners[index],
		getEndRP: () => positions[0],
		getStartRatio: () => index / 2,
		getEndRatio: () => (index + 1) / 2,
	}),
});
const autoProperty = { autoSplit: true, writeToNBT: () => ({}) };
let createdOwner = null;
let receivedProperty = null;
let apiCalls = 0;
const foreign = new RailCore();
foreign.getRailCore = () => core;
context.Packages.jp.ngt.rtm.rail.BlockMarker.createRail = (
	_world,
	x,
	y,
	z,
	list,
	property,
) => {
	apiCalls++;
	receivedProperty = property;
	const a = list.get(0),
		b = list.get(1);
	createdOwner = property.autoSplit
		? sectionOwners[0]
		: a.blockY >= b.blockY
			? b
			: a;
	return false;
};
helper.getCore = (_world, p) =>
	createdOwner && p[2] === createdOwner.blockZ ? core : null;
assert.strictEqual(
	helper.createFromPositions(world, player, positions, autoProperty).key,
	"created",
);
assert.strictEqual(createdOwner.blockZ, 81);
createdOwner = null;
world.func_175625_s = (pos) => (pos.z === 32 ? foreign : null);
assert.strictEqual(
	helper.createFromPositions(world, player, positions, autoProperty).key,
	"created",
);
assert.strictEqual(
	receivedProperty.autoSplit,
	false,
	"Section collision must fall back before any owner replacement",
);
assert.strictEqual(
	autoProperty.autoSplit,
	true,
	"held model must remain unchanged",
);
createdOwner = null;
world.func_175625_s = (pos) => (pos.z === 82 ? foreign : null);
assert.strictEqual(
	helper.createFromPositions(world, player, positions, {
		writeToNBT: () => ({}),
	}).key,
	"created",
);
assert.strictEqual(
	createdOwner.blockZ,
	2,
	"use the unoccupied opposite endpoint at equal height",
);
createdOwner = null;
world.func_175625_s = () => foreign;
const beforeCalls = apiCalls;
assert.strictEqual(
	helper.createFromPositions(world, player, positions, autoProperty),
	null,
);
assert.strictEqual(
	apiCalls,
	beforeCalls,
	"all occupied owners must reject without world mutation",
);
// A native Section failure first retries the same logical section geometry.
world.func_175625_s = () => null;
createdOwner = null;
let manualSectionAttempts = 0,
	lastManualSectionPlan,
	manualSectionsSucceed = false;
context.AppleExtendedSectionPlacementCompat.create = (_world, placement) => {
	manualSectionAttempts++;
	lastManualSectionPlan = placement;
	if (!manualSectionsSucceed) return false;
	createdOwner = placement.sections[0].start;
	return true;
};
const normalApi = context.Packages.jp.ngt.rtm.rail.BlockMarker.createRail;
context.Packages.jp.ngt.rtm.rail.BlockMarker.createRail = (...args) => {
	if (args[5].autoSplit) {
		apiCalls++;
		return false;
	}
	return normalApi(...args);
};
const retryCalls = apiCalls;
assert.strictEqual(
	helper.createFromPositions(world, player, positions, autoProperty).key,
	"created",
);
assert.strictEqual(apiCalls - retryCalls, 2);
assert.strictEqual(receivedProperty.autoSplit, false);
assert.strictEqual(autoProperty.autoSplit, true);
assert.equal(manualSectionAttempts, 1);
const longPositions = positions.map((p, i) => ({
	...p,
	posX: i * 300,
	posZ: 0.5,
	anchorLengthHorizontal: 120 + i * 10,
	anchorLengthVertical: 0,
}));
manualSectionsSucceed = true;
createdOwner = null;
const longNativeCalls = apiCalls;
const longBeforeRetry = JSON.stringify(longPositions);
assert.equal(
	helper.createFromPositions(world, player, longPositions, autoProperty).key,
	"created",
);
assert.equal(
	apiCalls - longNativeCalls,
	1,
	"retry does not repeat native placement",
);
assert.equal(manualSectionAttempts, 2);
assert.deepEqual(
	[
		lastManualSectionPlan.source.start.anchorLengthHorizontal,
		lastManualSectionPlan.source.end.anchorLengthHorizontal,
	].sort(),
	[120, 130],
	"section retry preserves the designed logical controls",
);
assert.equal(JSON.stringify(longPositions), longBeforeRetry);
manualSectionsSucceed = false;
createdOwner = null;
const failedNativeCalls = apiCalls;
assert.equal(
	helper.createFromPositions(world, player, longPositions, autoProperty),
	null,
);
assert.equal(
	apiCalls - failedNativeCalls,
	1,
	"over-limit rail must not retry as a normal rail",
);
assert.equal(manualSectionAttempts, 3, "manual placement retries at most once");
createdOwner = null;
let livePartial = false;
world.func_175625_s = (pos) =>
	livePartial && pos.z === sectionOwners[1].blockZ ? foreign : null;
context.Packages.jp.ngt.rtm.rail.BlockMarker.createRail = () => {
	apiCalls++;
	livePartial = true;
	return false;
};
const partialCalls = apiCalls;
const partialManualCalls = manualSectionAttempts;
assert.strictEqual(
	helper.createFromPositions(world, player, positions, autoProperty),
	null,
);
assert.strictEqual(
	apiCalls - partialCalls,
	1,
	"partial group must not be replaced by fallback",
);
assert.equal(
	manualSectionAttempts,
	partialManualCalls,
	"partial cores prevent manual retry",
);
context.Packages.jp.ngt.rtm.rail.BlockMarker.createRail = normalApi;

// Overlapping roadbeds select the preserving placement path, including failure.
const foreignRoadbed = new RailBase();
context.AppleExtendedRoadbedPlacement = {
	createNormal() {
		return context.Packages.jp.ngt.rtm.rail.BlockMarker.createRail();
	},
};
world.func_175625_s = (pos) => (pos.z === 77 ? foreignRoadbed : null);
let foreignOwner = [44, 4, 55];
foreignRoadbed.getStartPoint = () => foreignOwner;
foreignRoadbed.func_70296_d = () => {};
world.func_180495_p = () => ({});
world.func_184138_a = () => {};
foreignRoadbed.setStartPoint = (...owner) => {
	foreignOwner = owner;
};
RailMapBasic.prototype.getRailBlockList = () => ({
	size: () => 1,
	get: () => [1, 4, 77],
});
for (const fail of [false, true]) {
	createdOwner = null;
	context.Packages.jp.ngt.rtm.rail.BlockMarker.createRail = () => {
		foreignOwner = [1, 4, 82];
		if (fail) throw new Error("placement failed");
		createdOwner = positions[1];
		return false;
	};
	const result = helper.createFromPositions(world, player, positions, {});
	assert.strictEqual(result === null, fail);
	assert.deepStrictEqual(foreignOwner, [44, 4, 55]);
}
world.func_175625_s = () => null;
// Multi-rail Undo must not delete the first member if a later one changed.
load("superrailbuilderx/AppleExtendedRailToolsCompat.js");
const railTools = context.AppleExtendedRailToolsCompat;
let removedCount = 0;
helper.undoNormalRail = () => {
	removedCount++;
	return "ok";
};
helper.validateUndoNormalRail = (_world, _pos, key) =>
	key === "changed" ? "undo_rail_changed" : "ok";
railTools.splitUndoRecords.regression = {
	created: [
		{ core: [0, 0, 0], key: "ok" },
		{ core: [1, 0, 0], key: "changed" },
	],
};
assert.strictEqual(
	railTools.undoSplitBuilderRail({}, player, "regression"),
	"undo_rail_changed",
);
assert.strictEqual(removedCount, 0);
assert(railTools.splitUndoRecords.regression);
railTools.cantUndoRecords.regression = [
	{ core: [0, 0, 0], railKey: "ok" },
	{ core: [1, 0, 0], railKey: "changed" },
];
helper.getCore = () => {
	throw new Error("cant must not be mutated before full validation");
};
assert.strictEqual(
	railTools.undoRailCants({}, "regression"),
	"undo_rail_changed",
);
assert(railTools.cantUndoRecords.regression);
loadCompat("srbx_patch", "platform.");
const platform = Object.values(context.RTMX_COMPAT_TARGETS.appleextended).find(
	(value) => value.SRBXPatchPlatform,
).SRBXPatchPlatform;
const railType = {};
const parentRailType = {};
railType.parent = parentRailType;
const engine = {};
let registryLockHeld = false;
let registryUnlocks = 0;
let railModels = [
	{
		modelObj: { renderer: { getScript: () => engine } },
		getConfig: () => ({
			getName: () => "scripted",
			model: { rendererPath: "rail.js" },
		}),
	},
	{
		modelObj: { renderer: null },
		getConfig: () => ({ getName: () => "dummy", model: {} }),
	},
	{
		modelObj: null,
		getConfig: () => ({ getName: () => "failed", model: {} }),
	},
];
const manager = {
	modelConstructed: false,
	getType: () => railType,
	// SMP's server allowlist is empty before joining the world. It is not
	// the source of local renderer engines, even when NGTUtil.isSMP is true.
	getModelList: () => {
		throw new Error("patch must not use the world-dependent SMP allowlist");
	},
	modelSetMapLock: {
		readLock: () => ({
			lock: () => {
				registryLockHeld = true;
			},
			unlock: () => {
				registryLockHeld = false;
				registryUnlocks++;
			},
		}),
	},
	allModelSetMap: {
		get: (type) => {
			assert.strictEqual(type, parentRailType);
			assert.strictEqual(registryLockHeld, true);
			return {
				values: () => ({
					iterator: () => {
						let index = 0;
						return {
							hasNext: () => index < railModels.length,
							next: () => railModels[index++],
						};
					},
				}),
			};
		},
	},
};
context.Packages.jp.ngt.rtm.modelpack = {
	ModelPackManager: { INSTANCE: manager },
};
assert.strictEqual(
	platform.isReady(),
	false,
	"construction must finish before patching",
);
manager.modelConstructed = true;
assert.strictEqual(
	platform.isReady(),
	true,
	"rendererless dummy/failed models must not block all scripted models",
);
const targets = platform.getRailPatchTargets();
assert.strictEqual(registryLockHeld, false);
assert.strictEqual(registryUnlocks, 1);
assert.strictEqual(targets.length, 3);
assert.strictEqual(targets[0].engine, engine);
assert.strictEqual(targets[1].engine, null);
assert.strictEqual(targets[2].engine, null);
assert(
	messages.some((line) => line.includes("no constructed renderer: failed")),
);
railModels = [];
assert.strictEqual(platform.getRailPatchTargets().length, 0);
assert.strictEqual(registryUnlocks, 2);
const normalRegistryGet = manager.allModelSetMap.get;
manager.allModelSetMap.get = () => {
	throw new Error("registry failure");
};
assert.throws(() => platform.getRailPatchTargets(), /registry failure/);
assert.strictEqual(
	registryLockHeld,
	false,
	"failed registry reads must release the lock",
);
assert.strictEqual(registryUnlocks, 3);
manager.allModelSetMap.get = normalRegistryGet;
assert.strictEqual(
	platform.isReady(),
	true,
	"an empty rail list must complete without a timeout",
);
let ran = false;
platform.scheduleWhenReady(
	() => {
		ran = true;
	},
	(error) => {
		throw error;
	},
);
assert(
	scheduled && ran,
	"bootstrap must schedule using the SRG Callable overload",
);
console.log("AppleExtended creation, logical hover and bootstrap tests passed");

// Public compat must forward Undo mode and the trusted server endpoint snapshot.
const undoPositions = [
	{ posX: 0, posY: 4, posZ: 2, anchorYaw: 90 },
	{ posX: 4, posY: 4, posZ: 2, anchorYaw: 270 },
];
context.AppleExtendedRailCompat.getLogicalPositions = () => undoPositions;
api.canMoveRailPosition = () => true;
let undoArgs;
context.AppleExtendedRailMoveCompat = {
	consumeUpdated() {},
	point: (rp) => ({
		kind: "free",
		position: [rp.posX, rp.posY, rp.posZ],
		direction: 2,
		ownerBlock: [0, 4, 2],
	}),
	move(...args) {
		undoArgs = args;
		return "ok";
	},
};
api.getRailPositionCandidateKey = () => "undo";
const savedPoint = {
	kind: "free",
	position: [0.25, 4, 2],
	direction: 7,
	ownerBlock: [-8, 4, 13],
};
assert.strictEqual(
	api.moveRailPosition(
		{ isLogicalRailOccupied: () => false },
		0,
		0,
		4,
		2,
		0.25,
		4,
		2,
		{},
		true,
		savedPoint,
	),
	"ok",
);
assert.strictEqual(undoArgs[7], true);
assert.strictEqual(undoArgs[4].direction, 7);
assert.deepStrictEqual(Array.from(undoArgs[4].ownerBlock), [-8, 4, 13]);
assert.deepStrictEqual(Array.from(undoArgs[4].position), [0.25, 4, 2]);
console.log("AppleExtended public endpoint Undo preserves owner and direction");

// A third switch endpoint must not accidentally overwrite the second endpoint.
undoPositions.push({ posX: 8, posY: 4, posZ: 6, anchorYaw: 270 });
api.canMoveRailPosition = () => false;
const endpointSwitch = new SwitchCore();
endpointSwitch.isLogicalRailOccupied = () => false;
assert.strictEqual(
	api.moveRailPosition(endpointSwitch, 2, 8, 4, 6, 9, 4, 6, {}),
	"ok",
);
assert.strictEqual(undoArgs[8].index, 2);
assert.deepStrictEqual(Array.from(undoArgs[8].point.position), [9, 4, 6]);
assert.deepStrictEqual(Array.from(undoArgs[5].position), [4, 4, 2]);
console.log(
	"AppleExtended public switch endpoint dispatch preserves route indices",
);

api.hasFreeEndpointPatch = () => false;
assert.equal(
	api.createBuilderRail({}, {}, {}, {}).status,
	"srbxpatch_required",
);
assert.equal(
	api.validateRailPositionMove({}, 0, 0, 0, 0, 0, 0, 0),
	"srbxpatch_required",
);
assert.equal(
	api.splitBuilderRail({}, {}, [0, 0, 0], "", 0.5).status,
	"srbxpatch_required",
);
assert.equal(api.applyRailCants({}, []).status, "srbxpatch_required");
assert.equal(
	api.createBranchBuilderRail({}, {}, {}).status,
	"srbxpatch_required",
);
console.log("AppleExtended separate patch capability guards passed");

// A snapped design inherits its neighbour's heading, not its control lengths.
{
	const names = [
		"validatePoint",
		"propertyFromPlayer",
		"resolveRailPoint",
		"createFreePoint",
		"areBoundaryPositions",
		"createFromPositions",
	];
	const saved = Object.fromEntries(names.map((n) => [n, helper[n]]));
	const neighbour = { anchorLengthHorizontal: 2, anchorLengthVertical: 3 };
	let captured;
	Object.assign(helper, {
		validatePoint: () => "ok",
		propertyFromPlayer: () => ({ writeToNBT: () => ({}) }),
		resolveRailPoint: (_w, p) => ({
			...neighbour,
			posX: p.position[0],
			posY: p.position[1],
			posZ: p.position[2],
			anchorYaw: p.anchorYaw,
			anchorPitch: p.anchorPitch,
		}),
		createFreePoint: (p) => ({
			posX: p.position[0],
			posY: p.position[1],
			posZ: p.position[2],
			anchorYaw: p.anchorYaw,
			anchorPitch: p.anchorPitch,
		}),
		areBoundaryPositions: () => true,
		createFromPositions: (_w, _p, positions) => {
			captured = positions;
			return { core: [0, 4, 0], key: "new-design" };
		},
	});
	try {
		for (const kinds of [
			["rail", "free"],
			["free", "rail"],
			["rail", "rail"],
		]) {
			const a = {
				kind: kinds[0],
				position: [0.5, 4.0625, 0.5],
				anchorYaw: 30,
				anchorPitch: 0,
				anchorLength: 110,
				anchorLengthVertical: 0,
			};
			const b = {
				kind: kinds[1],
				position: [180.5, 4.0625, 210.5],
				anchorYaw: 210,
				anchorPitch: 0,
				anchorLength: 130,
			};
			assert.equal(helper.createNormalRail({}, {}, a, b).status, "ok");
			assert.deepEqual(
				Array.from(captured, (p) => p.anchorLengthHorizontal),
				[110, 130],
			);
			assert.deepEqual(
				Array.from(captured, (p) => p.anchorLengthVertical),
				[0, 130],
			);
			assert.deepEqual(
				Array.from(captured, (p) => p.anchorYaw),
				[30, 210],
			);
			assert.deepEqual(neighbour, {
				anchorLengthHorizontal: 2,
				anchorLengthVertical: 3,
			});
		}
	} finally {
		Object.assign(helper, saved);
	}
	console.log(
		"AE connected long-curve design retains requested horizontal/vertical controls on either end",
	);
}
