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
}
class RailMapSection extends RailMapBasic {
	constructor(_source, start, end) {
		super(start, end);
	}
}
class SectionCore {}
class RailBase {}
class BlockPos {
	constructor(x, y, z) {
		this.x = x;
		this.y = y;
		this.z = z;
	}
}
const world = { func_175625_s: () => null };
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
					item: {
						ItemRail: {
							getDefaultProperty: () => ({ readFromNBT() {} }),
						},
					},
					rail: {
						TileEntityLargeRailBase: RailBase,
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
vm.createContext(context);
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
load("superrailbuilderx/AppleExtendedRailCompat.js");
loadCompat("superrailbuilderx", "SRBXApiCompat.");
const api = Object.values(context.RTMX_COMPAT_TARGETS.appleextended)[0]
	.SRBXApiCompat;
const helper = context.AppleExtendedRailCompat;
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
			posX: 1.25,
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
			position: [1.25, 4.5, 2.75],
		});
		assert.strictEqual(result.cantEdge, -edge);
		assert.strictEqual(result.cantCenter, 5);
		assert.strictEqual(result.anchorYaw, 270);
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
const foreign = new RailBase();
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
// An opaque native Section failure may retry as normal only with no live owners.
world.func_175625_s = () => null;
createdOwner = null;
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
assert.strictEqual(
	helper.createFromPositions(world, player, positions, autoProperty),
	null,
);
assert.strictEqual(
	apiCalls - partialCalls,
	1,
	"partial group must not be replaced by fallback",
);
context.Packages.jp.ngt.rtm.rail.BlockMarker.createRail = normalApi;

// Placement may reassign shared roadbed tiles; restore their old ownership even on failure.
world.func_175625_s = (pos) => (pos.z === 77 ? foreign : null);
let foreignOwner = [44, 4, 55];
foreign.getStartPoint = () => foreignOwner;
foreign.setStartPoint = (...owner) => {
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
platform.isReady = () => true;
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
