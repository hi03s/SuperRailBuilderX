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
	getProperty() {
		return this.property;
	}
	getSignal() {
		return 7;
	}
}
class SwitchCore extends Core {}
class List extends Array {
	size() {
		return this.length;
	}
	get(i) {
		return this[i];
	}
	add(v) {
		this.push(v);
	}
}
class Maker {
	constructor(w, p) {
		this.positions = p;
	}
	getSwitch() {
		return { getAllRailMap: () => [{ positions: this.positions }] };
	}
}
class Basic {
	getStartRP() {
		return this.a;
	}
	getEndRP() {
		return this.b;
	}

	getRailPos(split, index) {
		const t = index / split,
			u = 1 - t,
			a = this.a,
			b = this.b;
		const ay = (a.anchorYaw * Math.PI) / 180,
			by = (b.anchorYaw * Math.PI) / 180;
		const x =
			u * u * u * a.posX +
			3 * u * u * t * (a.posX + Math.sin(ay) * a.anchorLengthHorizontal) +
			3 * u * t * t * (b.posX + Math.sin(by) * b.anchorLengthHorizontal) +
			t * t * t * b.posX;
		const z =
			u * u * u * a.posZ +
			3 * u * u * t * (a.posZ + Math.cos(ay) * a.anchorLengthHorizontal) +
			3 * u * t * t * (b.posZ + Math.cos(by) * b.anchorLengthHorizontal) +
			t * t * t * b.posZ;
		return [z, x];
	}

	getRailHeight() {
		return this.a.posY;
	}
	constructor(a, b) {
		this.a = a;
		this.b = b;
		this.positions = [a, b];
	}
	getLength() {
		return Math.hypot(this.a.posX - this.b.posX, this.a.posZ - this.b.posZ);
	}
}
const context = vm.createContext({
	RTMX_COMPAT_TARGETS: {},
	java: {
		util: { UUID: { randomUUID: () => ({ toString: () => "token" }) } },
	},
	Packages: {
		java: { util: { ArrayList: List } },
		jp: {
			ngt: {
				ngtlib: { io: { NGTLog: { debug() {} } } },
				rtm: {
					RTMConfig: { railGeneratingDistance: 64 },
					rail: {
						TileEntityLargeRailBase: Base,
						TileEntityLargeRailCore: Core,
						TileEntityLargeRailSwitchCore: SwitchCore,
						util: { RailMaker: Maker, RailMapBasic: Basic },
					},
				},
			},
		},
	},
});
Basic.fixRTMRailMapVersionCurrent = 1;
const dir =
	"dist/assets/minecraft/__targets__/kaizpatch/scripts/superrailbuilderx/";
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
// The client uses this public API for selecting an existing crossover base.
const logicalMap = api.getLogicalRailMap;
assert.equal(typeof api.isHorizontalBuilderRail, "function");
for (const slope of [0, 0.01]) {
	api.getLogicalRailMap = () => ({ getRailPitch: () => slope });
	assert.equal(api.isHorizontalBuilderRail({}), slope === 0);
}
api.getLogicalRailMap = () => null;
assert.equal(api.isHorizontalBuilderRail({}), false);
api.getLogicalRailMap = logicalMap;
const nativeScissorsPlanMethod = api.getSingleCrossoverSplitPlan;
const originalRestoreMethod = api.restoreSplitSource;
const point = (x, z, yaw, owner = [x, 4, z]) => ({
	kind: "free",
	position: [x, 4.0625, z],
	ownerBlock: owner,
	markerPosition: [x, 4, z],
	direction: yaw === 180 ? 4 : 0,
	anchorYaw: yaw,
	anchorPitch: 0,
	anchorLength: 6.667,
	anchorLengthVertical: 0,
});
const rp = (p) => ({
	posX: p.position[0],
	posY: p.position[1],
	posZ: p.position[2],
	blockX: p.ownerBlock?.[0] ?? Math.floor(p.position[0]),
	blockY: 4,
	blockZ: p.ownerBlock?.[2] ?? Math.floor(p.position[2]),
	offsetX: p.position[0] - (p.ownerBlock?.[0] ?? Math.floor(p.position[0])),
	offsetZ: p.position[2] - (p.ownerBlock?.[2] ?? Math.floor(p.position[2])),
	anchorYaw: p.anchorYaw,
	anchorPitch: 0,
	anchorLengthHorizontal: p.anchorLength,
	anchorLengthVertical: 0,
	setPosition(x, y, z) {
		this.posX = x;
		this.posY = y;
		this.posZ = z;
		this.offsetX = x - this.blockX;
		this.offsetZ = z - this.blockZ;
	},
});
const plan = () => ({
	switches: [
		[point(0, 0, 0), point(0, 20, 180), point(2, 20, 180)],
		[point(4, 40, 180), point(4, 20, 0), point(2, 20, 0)],
	],
	normals: [
		[point(0, 40, 180), point(0, 20, 0)],
		[point(4, 0, 0), point(4, 20, 180)],
	],
	markers: [
		[0, 4.0625, 20],
		[4, 4.0625, 20],
		[2, 4.0625, 20],
	],
	lengths: [40, 40],
});
let tiles = new Map(),
	created = [],
	removed = [],
	broken = 0,
	loaded = true,
	failAt = 0,
	noSpace = false;
const key = (p) => p.join(","),
	world = { func_147438_o: (...p) => tiles.get(key(p)) };
const original = new SwitchCore();
original.pos = [0, 4, 0];
original.property = { autoSplit: true, name: "original" };
original.subRails = new List({ name: "sub" });
original.positions = [
	point(0, 0, 0),
	point(0, 40, 180),
	point(4, 0, 0),
	point(4, 40, 180),
].map(rp);
const reset = () => {
	tiles = new Map([[key(original.pos), original]]);
	created = [];
	removed = [];
	broken = 0;
	failAt = 0;
	loaded = true;
	noSpace = false;
	original.occupied = false;
};
const ref = (c) => ({ core: c.pos, key: "core:" + key(c.pos) });
Object.assign(api, {
	getSingleCrossoverSplitPlan: () => plan(),
	getRailCorePos: (c) => c.pos,
	getRailPositionCandidateKey: (c) => ref(c).key,
	getEditableRailPositions: (c) => c.positions,
	copyRailPositions: (p) => p.map((x) => ({ ...x })),
	cloneRailProperty: (p) => ({ ...p }),
	getBuilderMoveProtectedRailKeys: () => [],
	findConnectedCantEndpoints: () => [],
	createBuilderFreePoint: rp,
	withSwitchType: (p, t) => ({ ...p, switchType: t }),
	toRailPositionArray: (p) => p,
	isBuilderRoadbedLoaded: () => loaded,
	getBuilderRoadbedBlocks: (map) =>
		noSpace
			? []
			: map.positions.flatMap((p) =>
					[-1, 0, 1].flatMap((dx) =>
						[-1, 0, 1].map((dz) => [
							p.blockX + dx,
							4,
							p.blockZ + dz,
						]),
					),
				),
	breakOwnedRail: () => {
		broken++;
		tiles.delete(key(original.pos));
	},
	createBuilderBasicSwitch: (_w, p, property) => {
		if (p.length === 3 && failAt === created.length + 1) return null;
		const c = new SwitchCore();
		c.pos = [p[0].blockX, p[0].blockY, p[0].blockZ];
		c.positions = p;
		c.property = { ...property };
		c.subRails = new List();
		tiles.set(key(c.pos), c);
		created.push(c);
		return c;
	},
	createBuilderRail: (
		_w,
		_player,
		a,
		b,
		protectedKeys,
		_source,
		property,
		forceNormal,
		prefer,
		_overwrite,
		_propSource,
		_replace,
		preserve,
	) => {
		for (const c of created)
			if (tiles.get(key(c.pos)) === c)
				assert(
					protectedKeys.includes(ref(c).key),
					"overlapping central normals protect every previously created core",
				);
		assert.equal(forceNormal, true);
		assert.equal(prefer, true);
		assert.equal(preserve, true);
		assert.equal(property.autoSplit, false);
		if (failAt === created.length + 1)
			return { status: "injected_failure" };
		const c = new Core();
		c.pos = a.ownerBlock.slice();
		c.positions = [rp(a), rp(b)];
		c.property = { ...property };
		tiles.set(key(c.pos), c);
		created.push(c);
		return { status: "ok", undoCore: c.pos, undoKey: ref(c).key };
	},
	applyBuilderRailState: (_w, r, signal, sub) => {
		const c = tiles.get(key(r.undoCore));
		c.signal = signal;
		c.subs = sub;
		return true;
	},
	undoBuilderRail: (_w, x, y, z, k) => {
		const c = tiles.get(key([x, y, z]));
		if (!c || ref(c).key !== k) return "undo_rail_changed";
		tiles.delete(key([x, y, z]));
		removed.push(c);
		return "ok";
	},
	splitPointFromRailPosition: (p, h, v) => ({
		...point(p.posX, p.posZ, p.anchorYaw, [p.blockX, p.blockY, p.blockZ]),
		position: [p.posX, p.posY, p.posZ],
		anchorLength: h,
		anchorLengthVertical: v,
	}),
});
reset();
assert.equal(
	api.splitSingleCrossover(world, {}, original, "wrong").status,
	"rail_changed",
);
assert.equal(broken, 0);
original.occupied = true;
assert.equal(
	api.splitSingleCrossover(world, {}, original, ref(original).key).status,
	"rail_occupied",
);
assert.equal(broken, 0);
original.occupied = false;
api.findConnectedCantEndpoints = () => [
	{ core: { isLogicalRailOccupied: () => true } },
];
assert.equal(
	api.splitSingleCrossover(world, {}, original, ref(original).key).status,
	"rail_occupied",
);
assert.equal(broken, 0);
api.findConnectedCantEndpoints = () => [];
loaded = false;
assert.equal(
	api.splitSingleCrossover(world, {}, original, ref(original).key).status,
	"path_unloaded",
);
assert.equal(broken, 0);
loaded = true;
noSpace = true;
assert.equal(
	api.splitSingleCrossover(world, {}, original, ref(original).key).status,
	"switch_owner_overlap",
);
assert.equal(broken, 0);
noSpace = false;
context.Packages.jp.ngt.rtm.RTMConfig.railGeneratingDistance = 10;
assert.equal(
	api.splitSingleCrossover(world, {}, original, ref(original).key).status,
	"normal_rail_too_long",
);
assert.equal(broken, 0);
context.Packages.jp.ngt.rtm.RTMConfig.railGeneratingDistance = 64;
assert.equal(
	api.splitSingleCrossover(world, {}, original, ref(original).key).status,
	"ok",
);
assert.deepEqual(
	created.map((c) => c.positions.length),
	[3, 3, 2, 2],
);
assert.deepEqual(
	created.slice(2).map((c) => c.pos),
	[
		[0, 4, 40],
		[4, 4, 0],
	],
);
assert(created.every((c) => c.signal === 7 && c.subs[0].name === "sub"));
assert(created.slice(2).every((c) => c.property.autoSplit === false));
const owners = created
	.slice(0, 2)
	.flatMap((c) =>
		c.positions.map((p) => key([p.blockX, p.blockY, p.blockZ])),
	);
assert.equal(
	new Set(owners.concat(created.slice(2).map((c) => key(c.pos)))).size,
	8,
	"all four cores and auxiliary owners are distinct",
);
assert.equal(api.undoSplitBuilderRail(world, {}, "token"), "undo_ok");
assert.equal(created.at(-1).positions.length, 4);
assert.equal(created.at(-1).property.name, "original");
assert.equal(removed.length, 4);
reset();
failAt = 4;
assert.equal(
	api.splitSingleCrossover(world, {}, original, ref(original).key).status,
	"injected_failure",
);
assert.equal(created.at(-1).positions.length, 4);
assert.equal(removed.length, 3);
assert.equal(tiles.size, 1);
assert.equal(api.consumeLastSplitClientUpdate().refreshed.length, 1);
console.log(
	"Kaiz single crossover split: four owners, normal outer cores, metadata/Undo, preflight and partial failure restoration passed",
);

// Direct creation dispatch uses normal-map sampling, never a four-point native switch.
for (const name of [
	"SRBXMath",
	"SRBXSingleCrossoverSplit",
	"SRBXCrossoverValidation",
])
	vm.runInContext(
		fs.readFileSync(
			"dist/assets/minecraft/scripts/superrailbuilderx/" + name + ".js",
			"utf8",
		),
		context,
	);
const oldPositions = original.positions;
let restoredSources = 0,
	externalCant = 5,
	cantFailure = false;
const externalCore = new Core();
externalCore.pos = [99, 4, 0];
Object.assign(api, {
	validateBuilderPoint: () => "ok",
	getRailPositionUnsupportedReason: () => "",
	isFlatBuilderRail: () => true,
	isSectionCore: () => true,
	builderAngleDifference: (a, b) => a - b,
	createBuilderProperty: () => ({ name: "held", autoSplit: true }),
	zeroRailCants: (_w, core, _indices, records) => {
		records.push({ core, old: externalCant });
		externalCant = 0;
		if (cantFailure) throw Error("injected cant failure");
		return [externalCore.pos];
	},
	resolveCantRecordCore: (_w, r) => r.core,
	restoreCantRecords: (_w, records) => {
		for (const r of records) externalCant = r.old;
		return {
			status: "ok",
			refreshed: records.length ? [ref(externalCore)] : [],
		};
	},
	restoreSplitSource: (_w, _player, record) => {
		restoredSources++;
		assert.equal(record.positions.length, 2);
		assert.equal(record.wasSectioned, true);
		original.positions = record.positions;
		original.property = record.property;
		tiles.set(key(original.pos), original);
		return ref(original);
	},
});
const request = (mask, selected) => ({
	points: [
		point(0, 0, 0),
		point(0, 40, 180),
		point(4, 0, 0),
		point(4, 40, 180),
	],
	switchTypes: mask,
	...(selected
		? {
				source: {
					core: original.pos,
					railKey: ref(original).key,
					startPosition: [0, 4.0625, 0],
					endPosition: [0, 4.0625, 40],
				},
			}
		: {}),
});
// Existing fixture maker is deliberately made to reject all four-point layouts.
const savedMaker = context.Packages.jp.ngt.rtm.rail.util.RailMaker;
context.Packages.jp.ngt.rtm.rail.util.RailMaker = class extends savedMaker {
	getSwitch() {
		assert.equal(
			this.positions.length,
			3,
			"no native four-point classification or temporary core",
		);
		return super.getSwitch();
	}
};
for (const mask of [
	[1, 0, 0, 1],
	[0, 1, 1, 0],
])
	for (const selected of [false, true]) {
		reset();
		original.positions = oldPositions.slice(0, 2);
		if (!selected) tiles.clear();
		const beforeRestore = restoredSources;
		api.findConnectedCantEndpoints = () =>
			selected ? [{ core: externalCore, index: 0 }] : [];
		externalCant = 5;
		const result = api.createCrossoverBuilderRail(
			world,
			{},
			request(mask, selected),
		);
		assert.equal(result.status, "ok");
		assert.deepEqual(
			created.map((c) => c.positions.length),
			[3, 3, 2, 2],
		);
		assert.equal(broken, selected ? 1 : 0);
		assert.equal(
			api.undoCrossoverBuilderRail(world, {}, "any"),
			"undo_disabled",
		);
		assert.equal(result.undoToken, undefined);
		assert.equal(restoredSources, beforeRestore);
		assert.equal(externalCant, selected ? 0 : 5);
		assert.equal(tiles.size, 4);
	}
for (const selected of [false, true]) {
	reset();
	original.positions = oldPositions.slice(0, 2);
	if (!selected) tiles.clear();
	failAt = 4;
	api.findConnectedCantEndpoints = () => [];
	const beforeRestore = restoredSources;
	assert.equal(
		api.createCrossoverBuilderRail(
			world,
			{},
			request([1, 0, 0, 1], selected),
		).status,
		"injected_failure",
	);
	assert.equal(restoredSources, beforeRestore + (selected ? 1 : 0));
	assert.equal(tiles.size, selected ? 1 : 0);
}
reset();
original.positions = oldPositions.slice(0, 2);
externalCant = 5;
cantFailure = true;
api.findConnectedCantEndpoints = () => [{ core: externalCore, index: 0 }];
assert.equal(
	api.createCrossoverBuilderRail(world, {}, request([1, 0, 0, 1], true))
		.status,
	"cant_update_failed",
);
assert.equal(externalCant, 5);
assert.equal(tiles.size, 1);
console.log(
	"Kaiz direct single crossovers: free/selected, both hands, no four-point native calls, rollback, Undo and cant restoration passed",
);

// A selected section can have both physical ends sharing owner cells with
// separate connected cores. New switch and normal roots must all avoid them.
cantFailure = false;
const savedSourcePos = original.pos;
original.pos = [0, 4, 20];
for (const mask of [
	[1, 0, 0, 1],
	[0, 1, 1, 0],
]) {
	reset();
	original.positions = oldPositions.slice(0, 2);
	const foreign = [];
	for (const pos of [
		[0, 4, 0],
		[0, 4, 40],
		[4, 4, 0],
		[4, 4, 40],
	]) {
		const core = new Core();
		core.pos = pos;
		tiles.set(key(pos), core);
		foreign.push(core);
	}
	api.findConnectedCantEndpoints = () => [];
	const input = request(mask, true),
		expected = new Set(foreign.map((c) => key(c.pos)));
	const result = api.createCrossoverBuilderRail(world, {}, input);
	assert.equal(result.status, "ok");
	assert.equal(created.length, 4);
	for (const c of created) {
		assert(
			!expected.has(key(c.pos)),
			"existing core owner never overwritten",
		);
		const root = c.positions[0];
		assert.equal(
			root.blockX + root.offsetX,
			root.posX,
			"relocated root NBT X remains exact",
		);
		assert.equal(
			root.blockZ + root.offsetZ,
			root.posZ,
			"relocated root NBT Z remains exact",
		);
		const outer = input.points.find(
			(p) =>
				Math.hypot(
					p.position[0] - root.posX,
					p.position[2] - root.posZ,
				) < 0.001,
		);
		assert(
			outer,
			"core remains at its original outer endpoint side, not the midpoint",
		);
		const dx = c.pos[0] + 0.5 - root.posX,
			dz = c.pos[2] + 0.5 - root.posZ;
		assert(dx * dx + dz * dz < 6.25);
		assert(
			dx * Math.sin((root.anchorYaw * Math.PI) / 180) +
				dz * Math.cos((root.anchorYaw * Math.PI) / 180) >=
				-0.001,
		);
	}
	for (const c of foreign) assert.strictEqual(tiles.get(key(c.pos)), c);
	assert.equal(
		api.undoCrossoverBuilderRail(world, {}, "any"),
		"undo_disabled",
	);
	assert.equal(result.undoToken, undefined);
	for (const c of foreign)
		assert.strictEqual(
			tiles.get(key(c.pos)),
			c,
			"Undo preserves every connected core",
		);
	assert.equal(tiles.size, 8);
}
reset();
original.positions = oldPositions.slice(0, 2);
noSpace = true;
const protectedCore = new Core();
protectedCore.pos = [0, 4, 0];
tiles.set(key(protectedCore.pos), protectedCore);
assert.equal(
	api.createCrossoverBuilderRail(world, {}, request([1, 0, 0, 1], true))
		.status,
	"core_conflict",
);
assert.equal(broken, 0);
assert.strictEqual(tiles.get(key(protectedCore.pos)), protectedCore);
original.pos = savedSourcePos;
console.log(
	"Kaiz split crossover roots relocate within each outer footprint, retain NBT coordinates and protect connected cores through Undo/no-space failure",
);

original.pos = [0, 4, 20];
cantFailure = false;
for (const selected of [false, true]) {
	reset();
	original.positions = oldPositions.slice(0, 2);
	if (!selected) tiles.clear();
	api.findConnectedCantEndpoints = () => [];
	const result = api.createCrossoverBuilderRail(
		world,
		{},
		request([1, 1, 1, 1], selected),
	);
	assert.equal(result.status, "ok");
	assert.equal(result.undoToken, undefined);
	assert.deepEqual(
		created.map((c) => c.positions.length),
		[3, 3, 3, 3, 2, 2, 2, 2],
	);
	assert(created.slice(4).every((c) => !c.property.autoSplit));
	assert.equal(
		api.undoCrossoverBuilderRail(world, {}, "any"),
		"undo_disabled",
	);
}
for (const failure of [2, 5, 8])
	for (const selected of [false, true]) {
		reset();
		original.positions = oldPositions.slice(0, 2);
		if (!selected) tiles.clear();
		api.findConnectedCantEndpoints = () => [];
		failAt = failure;
		const result = api.createCrossoverBuilderRail(
			world,
			{},
			request([1, 1, 1, 1], selected),
		);
		assert.notEqual(result.status, "ok");
		assert.equal(tiles.size, selected ? 1 : 0);
		assert.equal(removed.length, failure - 1);
	}
console.log(
	"Kaiz scissors creation: eight non-section pieces, no native4, Undo disabled and early/mid/late failure restoration passed",
);

// Existing native four-point scissors can use the identical thirds placement.
reset();
original.pos = [0, 4, 0];
tiles = new Map([[key(original.pos), original]]);
original.positions = oldPositions.map((p) => ({ ...p, switchType: 1 }));
const map = (a, b, diagonal) => {
	const m = new Basic(original.positions[a], original.positions[b]);
	m.startDir = "LEFT";
	m.endDir = diagonal ? "LEFT" : "RIGHT";
	return m;
};
api.getRailMapsForTool = () => [
	map(0, 1, false),
	map(3, 2, false),
	map(0, 3, true),
	map(2, 1, true),
];
const nativePlan = nativeScissorsPlanMethod.call(api, original);
assert(nativePlan);
assert.equal(nativePlan.switches.length, 4);
assert.equal(nativePlan.normals.length, 4);
api.getSingleCrossoverSplitPlan = () => nativePlan;
api.restoreSplitSource = originalRestoreMethod;
const splitResult = api.splitSingleCrossover(
	world,
	{},
	original,
	ref(original).key,
);
assert.equal(splitResult.status, "ok");
assert(splitResult.undoToken);
assert.equal(created.length, 8);
assert.equal(
	api.undoSplitBuilderRail(world, {}, splitResult.undoToken),
	"undo_ok",
);
assert.equal(created.at(-1).positions.length, 4);
assert.equal(removed.length, 8);
console.log(
	"Kaiz native scissors split: reordered main routes, eight-piece placement and splitter Undo preserve original4 topology",
);

reset();
tiles.clear();
api.findConnectedCantEndpoints = () => [];
const minimum = request([1, 1, 1, 1], false);
for (const i of [1, 3]) {
	minimum.points[i].position[2] = 30;
	minimum.points[i].ownerBlock[2] = 30;
	minimum.points[i].markerPosition[2] = 30;
}
const minResult = api.createCrossoverBuilderRail(world, {}, minimum);
assert.equal(minResult.status, "ok");
assert.equal(created.length, 8);
reset();
tiles.clear();
const tooShort = request([1, 1, 1, 1], false);
for (const i of [1, 3]) {
	tooShort.points[i].position[2] = 29;
	tooShort.points[i].ownerBlock[2] = 29;
	tooShort.points[i].markerPosition[2] = 29;
}
assert.equal(
	api.createCrossoverBuilderRail(world, {}, tooShort).status,
	"rail_too_short",
);
assert.equal(created.length, 0);
assert.equal(broken, 0);
console.log(
	"Kaiz scissors30m accepted/29m rejected before mutation; central overlapping normal pieces protect prior cores",
);
