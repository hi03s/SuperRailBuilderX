const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const root = process.env.SRBX_TEST_DIST || "dist/assets/minecraft/";
const source = fs.readFileSync(
	root +
		"__targets__/appleextended/scripts/superrailbuilderx/AppleExtendedRailToolsCompat.js",
	"utf8",
);
class SwitchCore {}
class Position {
	constructor(x, y, z, direction, switchType) {
		Object.assign(this, {
			blockX: x,
			blockY: y,
			blockZ: z,
			direction,
			switchType,
			posX: x + 0.5,
			posY: y,
			posZ: z + 0.5,
			anchorYaw: 0,
			anchorPitch: 0,
			anchorLengthHorizontal: 5,
			anchorLengthVertical: 0,
		});
	}
	setPosition(x, y, z) {
		this.posX = x;
		this.posY = y;
		this.posZ = z;
		this.offsetX = x - this.blockX;
		this.offsetZ = z - this.blockZ;
	}
	writeToNBT() {
		const n = { ...this };
		n.setByte = (key, value) => (n.switchType = value);
		n.func_74774_a = n.setByte;
		return n;
	}
	static readFromNBT(n) {
		return Object.assign(new Position(), n);
	}
}
class RailMap {
	getRailBlockList() {
		const blocks = [];
		for (let x = -2; x < 50; x++)
			for (let z = -2; z < 9; z++) blocks.push([x, 4, z]);
		return { size: () => blocks.length, get: (i) => blocks[i] };
	}
}
const map = new RailMap();
const context = vm.createContext({
	exports: {},
	TileEntityLargeRailSwitchCore: SwitchCore,
	TileEntityLargeRailCore: SwitchCore,
	RailPosition: Position,
	RailMapBasic: RailMap,
	RailMaker: class {
		getSwitch() {
			return { getAllRailMap: () => [map, map] };
		}
	},
	ArrayList: class {
		add() {}
	},
	BlockPos: class {
		constructor(x, y, z) {
			Object.assign(this, { x, y, z });
		}
	},
	ItemRail: {
		getDefaultProperty: () => ({ readFromNBT() {}, autoSplit: true }),
	},
	UUID: { randomUUID: () => ({ toString: () => "token" }) },
	NGTLog: { debug() {} },
});
context.Packages = {
	java: { util: { ArrayList: context.ArrayList, UUID: context.UUID } },
	jp: {
		ngt: {
			rtm: {
				item: { ItemRail: context.ItemRail },
				rail: {
					TileEntityLargeRailCore: SwitchCore,
					TileEntityLargeRailSwitchCore: SwitchCore,
					util: {
						RailPosition: Position,
						RailMaker: context.RailMaker,
						RailMapBasic: RailMap,
					},
				},
			},
			ngtlib: { io: { NGTLog: context.NGTLog } },
		},
	},
	net: { minecraft: { util: { math: { BlockPos: context.BlockPos } } } },
};
vm.runInContext(source, context);
const tools = context.AppleExtendedRailToolsCompat;
const rp = (x, z) => new Position(x, 4, z, 0, 0);
const point = (x, z, anchorYaw = 0) => ({
	anchorYaw,
	kind: "free",
	ownerBlock: [x, 4, z],
	position: [x + 0.5, 4, z + 0.5],
	direction: 0,
});
const plan = {
	switches: [
		[point(0, 0, 90), point(10, 0, -90), point(10, 3, -90)],
		[point(20, 5, -90), point(10, 5, 90), point(10, 3, 90)],
	],
	normals: [
		[point(20, 0, -90), point(10, 0, 90)],
		[point(0, 5, 90), point(10, 5, -90)],
	],
};
const nativeSplitPlanner = tools.getSingleCrossoverSplitPlan;
tools.getSingleCrossoverSplitPlan = () => JSON.parse(JSON.stringify(plan));
tools.connectedEndpoints = () => [];
let expectedSignal = 7;
let created = [],
	removed = [],
	failAt = -1,
	occupied = false,
	changed = false,
	load = true,
	blocked = false,
	restores = 0;
const core = new SwitchCore();
Object.assign(core, {
	isLogicalRailOccupied: () => occupied,
	getResourceState: () => ({ writeToNBT: () => ({}) }),
	getSignal: () => 7,
	subRails: { size: () => 1, get: () => "sub" },
	getPos: () => ({ getX: () => 0, getY: () => 4, getZ: () => 0 }),
});
const compat = {
	coreKey: () => (changed ? "changed" : "source"),
	getLogicalPositions: () => [rp(0, 0), rp(20, 0), rp(20, 5), rp(0, 5)],
	resolveBuilderPoint: (_w, p) => {
		const r = rp(
			p.ownerBlock ? p.ownerBlock[0] : Math.floor(p.position[0]),
			p.ownerBlock ? p.ownerBlock[2] : Math.floor(p.position[2]),
		);
		r.posX = p.position[0];
		r.posZ = p.position[2];
		r.anchorYaw = p.anchorYaw;
		return r;
	},
	planCreation: (_w, g, property) =>
		blocked ? null : { root: g.length === 2 ? g[1] : g[0] },
	cloneRailPosition: (p) => Object.assign(new Position(), p),
	undoNormalRail: (_w, p, key) => {
		removed.push(key);
		return "ok";
	},
	createFromPositions: (_w, _p, g, property) => {
		if (g.length === 4) {
			restores++;
			return { core: [0, 4, 0], key: "restored" };
		}
		if (created.length === failAt) return null;
		const r = {
			core: [
				g[g.length === 2 ? 1 : 0].blockX,
				4,
				g[g.length === 2 ? 1 : 0].blockZ,
			],
			key: "new" + created.length,
		};
		created.push({ g, property, r });
		return r;
	},
	getCore: () => ({
		setSignal(v) {
			assert.equal(v, expectedSignal);
		},
		addSubRail(v) {
			assert.equal(v, "sub");
		},
		markDirty() {},
		func_70296_d() {},
		sendPacket() {},
	}),
	validateUndoNormalRail: () => "ok",
};
context.AppleExtendedRailCompat = compat;
const world = { isBlockLoaded: () => load, getTileEntity: () => null };
world.func_175667_e = world.isBlockLoaded;
world.func_175625_s = world.getTileEntity;
core.func_174877_v = () => ({
	func_177958_n: () => 0,
	func_177956_o: () => 4,
	func_177952_p: () => 0,
});
function reset() {
	created = [];
	removed = [];
	failAt = -1;
	occupied = changed = blocked = false;
	load = true;
	restores = 0;
}
reset();
assert.equal(
	tools.splitSingleCrossover(world, {}, core, "source").status,
	"ok",
);
assert.equal(created.length, 4);
assert.deepEqual(
	created.map((c) => c.g.length),
	[3, 3, 2, 2],
);
assert.deepEqual(
	created.map((c) => Array.from(c.r.core)),
	[
		[0, 4, 0],
		[20, 4, 5],
		[20, 4, 0],
		[0, 4, 5],
	],
);
assert.equal(created[2].property.autoSplit, false);
assert.equal(created[3].property.autoSplit, false);
const auxiliary = created
	.flatMap((c) => c.g.filter((_p, i) => i !== (c.g.length === 2 ? 1 : 0)))
	.map((p) => [p.blockX, p.blockY, p.blockZ].join(","));
assert.equal(new Set(auxiliary).size, auxiliary.length);
for (const c of created)
	for (const [i, p] of c.g.entries()) {
		if (i === (c.g.length === 2 ? 1 : 0)) continue;
		assert.equal(p.blockX + p.offsetX, p.posX);
		assert.equal(p.blockZ + p.offsetZ, p.posZ);
	}
for (let i = 0; i < 2; i++) {
	const branch = created[i].g[2];
	assert.ok(
		(branch.blockX + 0.5 - branch.posX) *
			Math.sin((branch.anchorYaw * Math.PI) / 180) >=
			-0.001,
	);
}
assert.equal(tools.undoSplitBuilderRail(world, {}, "token"), "undo_ok");
assert.equal(restores, 1);
assert.deepEqual(removed, ["source", "new3", "new2", "new1", "new0"]);
for (const [flag, status] of [
	["occupied", "rail_occupied"],
	["changed", "rail_changed"],
	["blocked", "core_conflict"],
	["load", "path_unloaded"],
]) {
	reset();
	if (flag === "occupied") occupied = true;
	if (flag === "changed") changed = true;
	if (flag === "blocked") blocked = true;
	if (flag === "load") load = false;
	assert.equal(
		tools.splitSingleCrossover(world, {}, core, "source").status,
		status,
	);
	assert.equal(removed.length, 0);
}
reset();
failAt = 2;
assert.equal(
	tools.splitSingleCrossover(world, {}, core, "source").status,
	"create_failed",
);
assert.equal(restores, 1);
assert.equal(removed.length, 3);
console.log("AE single crossover split transaction tests passed");

// Direct single-crossover creation shares the proven placement transaction and
// never classifies or creates a temporary four-position native switch.
context.validateCrossoverPlan = () => "ok";
let sampled = 0;
context.SRBXSingleCrossoverSplit = {
	fromPoints(points, mask, sample) {
		assert.equal(points.length, 4);
		assert.equal(mask.filter((x) => x === 1).length, 2);
		assert.equal(points[0].position[0], 0.5);
		sample(points[0], points[1]);
		sampled++;
		return JSON.parse(JSON.stringify(plan));
	},
};
RailMap.prototype.getRailPos = () => [0.5, 10.5];
RailMap.prototype.getRailHeight = () => 4;
RailMap.prototype.getLength = () => 30;
compat.propertyFromPlayer = () => ({ writeToNBT: () => ({}) });
compat.normalizeDegrees = (a) => a;
const nativeCore = { ...core };
const baseline = [rp(0, 0), rp(20, 0)];
compat.getLogicalPositions = () => baseline;
const originalGetCore = compat.getCore;
compat.getCore = (w, pos) =>
	pos[0] === 99 ? nativeCore : originalGetCore(w, pos);
tools.isFlat = () => true;
let restoredDirect = 0;
tools.restoreRecord = () => {
	restoredDirect++;
	return { core: [99, 4, 0], key: "restored" };
};
const directPlan = () => ({
	points: [point(0, 0), point(20, 0), point(0, 5), point(20, 5)].map((p) => ({
		...p,
		anchorPitch: 0,
		anchorLength: 5,
		anchorLengthVertical: 0,
	})),
	switchTypes: [1, 0, 0, 1],
});
for (const selected of [false, true])
	for (const mask of [
		[1, 0, 0, 1],
		[0, 1, 1, 0],
	]) {
		reset();
		expectedSignal = selected ? 7 : 0;
		const input = directPlan();
		input.switchTypes = mask;
		if (selected)
			input.source = {
				core: [99, 4, 0],
				railKey: "source",
				startPosition: [0.5, 4, 0.5],
				endPosition: [20.5, 4, 0.5],
			};
		const before = restoredDirect;
		const result = tools.createCrossoverBuilderRail(world, {}, input);
		assert.equal(result.status, "ok");
		assert.deepEqual(
			created.map((c) => c.g.length),
			[3, 3, 2, 2],
		);
		assert.equal(restores, 0, "no temporary four-point creation");
		assert.equal(created[2].property.autoSplit, false);
		assert.equal(
			tools.undoCrossoverBuilderRail(world, {}, "token"),
			"undo_disabled",
		);
		assert.equal(restoredDirect, before);
		assert.equal(removed.length, selected ? 1 : 0);
	}
reset();
expectedSignal = 0;
failAt = 3;
const beforeFreeFailure = restoredDirect;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, directPlan()).status,
	"create_failed",
);
assert.equal(removed.length, 3);
assert.equal(
	restoredDirect,
	beforeFreeFailure,
	"free rollback cannot create source",
);
reset();
expectedSignal = 7;
failAt = 2;
const selectedFailure = directPlan();
selectedFailure.source = {
	core: [99, 4, 0],
	railKey: "source",
	startPosition: [0.5, 4, 0.5],
	endPosition: [20.5, 4, 0.5],
};
const beforeSelectedFailure = restoredDirect;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, selectedFailure).status,
	"create_failed",
);
assert.equal(restoredDirect, beforeSelectedFailure + 1);
assert.ok(sampled >= 6);
console.log(
	"AE direct divided single crossover free/source creation and disabled Undo tests passed",
);

reset();
expectedSignal = 0;
let externalCant = 12;
const externalCore = { isLogicalRailOccupied: () => false };
compat.getCore = (w, pos) =>
	pos[0] === 50 ? externalCore : originalGetCore(w, pos);
tools.hasCrossoverConnection = () => false;
tools.zeroExternalCant = (c, i, records) => {
	assert.equal(c, externalCore);
	records.push({ saved: externalCant });
	externalCant = 0;
};
const previousRestoreCant = tools.restoreCantRecords;
tools.restoreCantRecords = (_world, records) => {
	for (const r of records || [])
		if (r.saved !== undefined) externalCant = r.saved;
	return true;
};
const snapped = directPlan();
Object.assign(snapped.points[2], { kind: "rail", core: [50, 4, 5], index: 0 });
assert.equal(tools.createCrossoverBuilderRail(world, {}, snapped).status, "ok");
assert.equal(externalCant, 0);
assert.equal(
	tools.undoCrossoverBuilderRail(world, {}, "token"),
	"undo_disabled",
);
assert.equal(
	externalCant,
	0,
	"generation Undo disabled and cannot edit external cant",
);
externalCant = 12;
reset();
failAt = 2;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, snapped).status,
	"create_failed",
);
assert.equal(externalCant, 12, "external cant restored on partial failure");
reset();
blocked = true;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, snapped).status,
	"core_conflict",
);
assert.equal(externalCant, 12, "preflight must not mutate connected cant");
tools.restoreCantRecords = previousRestoreCant;
console.log("AE direct single crossover external cant rollback tests passed");

// Connected rails can own all four original outer endpoint blocks. Each new
// piece keeps its physical endpoint and relocates only its owner inward.
reset();
expectedSignal = 0;
const foreignTiles = new Map();
for (const p of [
	[0, 4, 0],
	[20, 4, 5],
	[20, 4, 0],
	[0, 4, 5],
])
	foreignTiles.set(p.join(","), new SwitchCore());
const foreignWorld = {
	func_175667_e: () => true,
	func_175625_s: (p) => foreignTiles.get([p.x, p.y, p.z].join(",")) || null,
};
const oldPlanCreation = compat.planCreation;
compat.planCreation = (w, g, property, ignoredKey) => {
	const root = g[g.length === 2 ? 1 : 0];
	assert.ok(
		!foreignTiles.has([root.blockX, root.blockY, root.blockZ].join(",")),
		"root must move before native preflight",
	);
	return oldPlanCreation(w, g, property, ignoredKey);
};
const freeRecord = () => ({
	positions: [],
	property: compat.propertyFromPlayer(),
	signal: 0,
	subRails: [],
	created: [],
	cants: [],
});
const layout = JSON.parse(JSON.stringify(plan));
assert.equal(
	tools.createSplitCrossover(foreignWorld, {}, layout, freeRecord()).status,
	"ok",
);
assert.equal(created.length, 4);
for (const [i, c] of created.entries()) {
	const root = c.g[i < 2 ? 0 : 1];
	const outer = (i < 2 ? layout.switches[i] : layout.normals[i - 2])[0];
	assert.deepEqual([root.posX, root.posY, root.posZ], outer.position);
	assert.ok(
		!foreignTiles.has([root.blockX, root.blockY, root.blockZ].join(",")),
	);
	assert.equal(root.blockX + root.offsetX, root.posX);
	assert.equal(root.blockZ + root.offsetZ, root.posZ);
	const dx = root.blockX + 0.5 - root.posX,
		dz = root.blockZ + 0.5 - root.posZ;
	assert.ok(dx * dx + dz * dz < 6.25);
	assert.ok(
		dx * Math.sin((root.anchorYaw * Math.PI) / 180) +
			dz * Math.cos((root.anchorYaw * Math.PI) / 180) >=
			-0.001,
	);
}
assert.equal(foreignTiles.size, 4, "foreign cores retained");
assert.equal(tools.undoSplitBuilderRail(foreignWorld, {}, "token"), "undo_ok");
assert.equal(foreignTiles.size, 4);
reset();
const noSpaceWorld = {
	func_175667_e: () => true,
	func_175625_s: () => new SwitchCore(),
};
assert.equal(
	tools.createSplitCrossover(noSpaceWorld, {}, layout, freeRecord()).status,
	"core_conflict",
);
assert.equal(created.length, 0);
assert.equal(removed.length, 0);
compat.planCreation = oldPlanCreation;
console.log(
	"AE occupied outer-root relocation and safe rejection tests passed",
);

reset();
const duplicateLayout = JSON.parse(JSON.stringify(plan));
duplicateLayout.switches[1][0].ownerBlock =
	duplicateLayout.switches[0][0].ownerBlock.slice();
assert.equal(
	tools.createSplitCrossover(world, {}, duplicateLayout, freeRecord()).status,
	"ok",
);
assert.deepEqual(
	Array.from(created[0].r.core),
	[0, 4, 0],
	"unblocked earlier root reserved",
);
assert.deepEqual(
	Array.from(created[2].r.core),
	[20, 4, 0],
	"available normal root reserved before relocation",
);
assert.equal(new Set(created.map((c) => c.r.core.join(","))).size, 4);
assert.equal(created[1].g[0].posX, 20.5);
assert.equal(created[1].g[0].posZ, 5.5);
console.log("AE duplicate outer-root relocation tests passed");

// Scissors generation creates four native three-point switches and four basic
// normal middle pieces, including the two overlapping diagonal center pieces.
const scissors = {
	switches: [
		[point(0, 0, 90), point(10, 0, -90), point(10, 2, -90)],
		[point(30, 0, -90), point(20, 0, 90), point(20, 2, 90)],
		[point(0, 5, 90), point(10, 5, -90), point(10, 3, -90)],
		[point(30, 5, -90), point(20, 5, 90), point(20, 3, 90)],
	],
	normals: [
		[point(10, 0, 90), point(20, 0, -90)],
		[point(10, 5, 90), point(20, 5, -90)],
		[point(10, 2, 90), point(20, 3, -90)],
		[point(10, 3, 90), point(20, 2, -90)],
	],
};
context.SRBXSingleCrossoverSplit.scissorsFromPoints = (points, sample) => {
	assert.equal(points.length, 4);
	sample(points[0], points[1], 1 / 3);
	sample(points[0], points[1], 2 / 3);
	return JSON.parse(JSON.stringify(scissors));
};
compat.getCore = (w, pos) =>
	pos[0] === 99 ? nativeCore : originalGetCore(w, pos);
for (const selected of [false, true]) {
	reset();
	expectedSignal = selected ? 7 : 0;
	const input = directPlan();
	input.switchTypes = [1, 1, 1, 1];
	if (selected)
		input.source = {
			core: [99, 4, 0],
			railKey: "source",
			startPosition: [0.5, 4, 0.5],
			endPosition: [20.5, 4, 0.5],
		};
	const result = tools.createCrossoverBuilderRail(world, {}, input);
	assert.equal(result.status, "ok");
	assert.equal(result.undoToken, undefined);
	assert.deepEqual(
		created.map((c) => c.g.length),
		[3, 3, 3, 3, 2, 2, 2, 2],
	);
	for (const c of created.slice(4)) assert.equal(c.property.autoSplit, false);
	assert.equal(new Set(created.map((c) => c.r.core.join(","))).size, 8);
	assert.equal(restores, 0, "no temporary native four-point scissors");
	assert.equal(
		tools.undoCrossoverBuilderRail(world, {}, "token"),
		"undo_disabled",
	);
}
reset();
expectedSignal = 0;
failAt = 6;
const brokenScissors = directPlan();
brokenScissors.switchTypes = [1, 1, 1, 1];
const beforeScissorsFailure = restoredDirect;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, brokenScissors).status,
	"create_failed",
);
assert.equal(removed.length, 6);
assert.equal(restoredDirect, beforeScissorsFailure);
reset();
expectedSignal = 7;
compat.getLogicalPositions = () =>
	[rp(0, 0), rp(30, 0), rp(0, 5), rp(30, 5)].map((p) => {
		p.switchType = 1;
		return p;
	});
core.getWorld = () => world;
core.func_145831_w = core.getWorld;
context.SRBXSingleCrossoverSplit.orderScissors = (mains) => mains.flat();
const nativeEnds = compat.getLogicalPositions();
tools.getRailMapsForTool = () => [
	{
		startDir: 0,
		endDir: 4,
		getStartRP: () => nativeEnds[0],
		getEndRP: () => nativeEnds[1],
	},
	{
		startDir: 0,
		endDir: 4,
		getStartRP: () => nativeEnds[2],
		getEndRP: () => nativeEnds[3],
	},
	{ startDir: 1, endDir: 1 },
	{ startDir: 7, endDir: 7 },
];
tools.getSingleCrossoverSplitPlan = nativeSplitPlanner;
assert.equal(tools.getSingleCrossoverSplitPlan(core).switches.length, 4);
assert.equal(
	tools.splitSingleCrossover(world, {}, core, "source").status,
	"ok",
);
assert.deepEqual(
	created.map((c) => c.g.length),
	[3, 3, 3, 3, 2, 2, 2, 2],
);
assert.equal(
	tools.undoSplitBuilderRail(world, {}, "token"),
	"undo_ok",
	"splitter Undo retained",
);
console.log(
	"AE scissors eight-piece generation, rollback and native scissors split passed",
);
