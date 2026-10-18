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
	constructor(a, b) {
		this.a = a;
		this.b = b;
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
	anchorYaw: p.anchorYaw,
	anchorPitch: 0,
	anchorLengthHorizontal: p.anchorLength,
	anchorLengthVertical: 0,
	setPosition(x, y, z) {
		this.posX = x;
		this.posY = y;
		this.posZ = z;
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
	hasFreeEndpointPatch: () => true,
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
