const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const cells = new Map(),
	key = (p) => p.join(",");
class Nbt {
	constructor() {
		this.values = {};
	}
	func_74768_a(k, v) {
		this.values[k] = v;
	}
	func_74778_a(k, v) {
		this.values[k] = v;
	}
	func_74782_a(k, v) {
		this.values[k] = v;
	}
	func_74764_b(k) {
		return k in this.values;
	}
	func_74775_l(k) {
		return this.values[k] || new Nbt();
	}
	func_74762_e(k) {
		return this.values[k];
	}
	func_74779_i(k) {
		return this.values[k] || "";
	}
	func_82580_o(k) {
		delete this.values[k];
	}
}
class Base {
	constructor(pos, owner = pos) {
		[this.field_145851_c, this.field_145848_d, this.field_145849_e] = pos;
		this.owner = owner;
	}
	getStartPoint() {
		return this.owner;
	}
	setStartPoint(...p) {
		this.owner = p;
	}
	getRailCore() {
		const tile = cells.get(key(this.owner))?.tile;
		return tile instanceof Core ? tile : null;
	}
	func_145831_w() {
		return world;
	}
	func_70296_d() {}
	func_145841_b(nbt) {
		["x", "y", "z"].forEach((k, i) =>
			nbt.func_74768_a(
				k,
				[this.field_145851_c, this.field_145848_d, this.field_145849_e][
					i
				],
			),
		);
		["spX", "spY", "spZ"].forEach((k, i) =>
			nbt.func_74768_a(k, this.owner[i]),
		);
	}
	func_145839_a(nbt) {
		this.owner = ["spX", "spY", "spZ"].map((k) => nbt.func_74762_e(k));
	}
}
let fail = false;
let rejectCorePlacement = false;
class Core extends Base {
	setRailPositions(p) {
		this.positions = p;
	}
	setProperty(p) {
		this.property = p;
	}
	createRailMap() {
		if (fail) throw Error("injected initialization failure");
	}
	func_145831_w() {
		return world;
	}
	breakLogicalRail() {
		const owned = Array.from(cells).filter(
			([, cell]) => cell.tile.getRailCore() === this,
		);
		for (const [p] of owned) cells.delete(p);
	}
}
class Section extends Core {
	getRailGroupId() {
		return this.group;
	}
}
class RailBlock {}
const baseBlock = new RailBlock(),
	coreBlock = new RailBlock();
class SavedData {
	constructor(name) {
		this.name = name;
		this.root = new Nbt();
		this.dirty = false;
	}
	func_143041_a() {
		return this.root;
	}
	func_76185_a() {
		this.dirty = true;
	}
}
SavedData.class = SavedData;
const savedRecords = new Map();
const storage = {
	func_75742_a: (_class, name) => savedRecords.get(name) || null,
	func_75745_a: (name, data) => savedRecords.set(name, data),
};
const world = {
	field_72988_C: storage,
	field_73011_w: { field_76574_g: 0 },
	field_72995_K: false,
	field_147482_g: {
		size: () => cells.size,
		get: (i) => Array.from(cells.values())[i].tile,
	},
	func_147438_o: (...p) => cells.get(key(p))?.tile || null,
	func_147439_a: (...p) => cells.get(key(p))?.block || {},
	func_72805_g: () => 0,
	func_147437_c: (...p) => !cells.has(key(p)),
	func_147471_g() {},
	func_147468_f: (...p) => cells.delete(key(p)),
	func_147465_d(x, y, z, block) {
		if (rejectCorePlacement && block === coreBlock) return false;
		const p = [x, y, z],
			old = cells.get(key(p))?.tile;
		if (old?.getRailCore()) old.getRailCore().breakLogicalRail();
		cells.set(key(p), {
			block,
			tile: block === coreBlock ? new Core(p) : new Base(p),
		});
		return true;
	},
};
const context = {
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		net: {
			minecraft: {
				world: {
					gen: { structure: { MapGenStructureData: SavedData } },
				},
				nbt: { NBTTagCompound: Nbt },
				block: {
					Block: {
						func_149682_b: () => 1,
						func_149729_e: () => baseBlock,
					},
				},
			},
		},
		jp: {
			ngt: {
				ngtlib: { io: { NGTLog: { debug() {} } } },
				rtm: {
					RTMRail: {
						largeRailCore0: coreBlock,
						largeRailBase0: baseBlock,
					},
					rail: {
						TileEntityLargeRailBase: Base,
						TileEntityLargeRailCore: Core,
						BlockLargeRailBase: RailBlock,
					},
				},
			},
			kaiz: {
				kaizpatch: {
					rtm: { rail: { TileEntityLargeRailSectionCore: Section } },
				},
			},
		},
	},
};
vm.createContext(context);
vm.runInContext(
	fs.readFileSync(
		"dist/assets/minecraft/scripts/superrailbuilderx/SRBXRoadbedOwnership.js",
		"utf8",
	),
	context,
);
const dir =
	"dist/assets/minecraft/__targets__/kaizpatch/scripts/superrailbuilderx/";
vm.runInContext(
	fs.readFileSync(dir + "SRBXKaizRoadbedData.js", "utf8"),
	context,
);
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
api.getBuilderRoadbedBlocks = () => [[21, 4, 5]];
api.toRailPositionArray = (p) => p;
api.sendRailCorePacket = () => {};
const positions = [
		{ blockX: 20, blockY: 4, blockZ: 5 },
		{ blockX: 40, blockY: 4, blockZ: 5 },
	],
	property = {};
function setup() {
	cells.clear();
	const donor = new Core([80, 4, 5]);
	cells.set("80,4,5", { tile: donor, block: coreBlock });
	cells.set("20,4,5", {
		tile: new Base([20, 4, 5], [80, 4, 5]),
		block: baseBlock,
	});
	return donor;
}
let donor = setup();
const core = api.createBuilderNormalRail(
	world,
	{ fixRTMRailMapVersion: 1 },
	positions,
	property,
	{},
);
assert.strictEqual(
	cells.get("80,4,5").tile,
	donor,
	"promotion must not invoke donor deletion",
);
assert.equal(typeof core.getTileData, "undefined");
assert(
	context.SRBXKaizRoadbedData.get(core).func_74764_b("SRBXPromotedRoadbed"),
);
// Rebuild the saved-data container from detached NBT, as after world reload.
function cloneNbt(value) {
	if (!(value instanceof Nbt)) return value;
	const result = new Nbt();
	for (const [k, v] of Object.entries(value.values))
		result.values[k] = cloneNbt(v);
	return result;
}
function reloadSavedData() {
	for (const [name, data] of savedRecords) {
		const restored = new SavedData(name);
		restored.root = cloneNbt(data.root);
		savedRecords.set(name, restored);
	}
}
assert(savedRecords.get("SRBXRoadbedOwnership_0").dirty);
reloadSavedData();
api.breakOwnedRail(core);
assert.strictEqual(cells.get("80,4,5").tile, donor);
assert.deepEqual(
	cells.get("20,4,5").tile.owner,
	[80, 4, 5],
	"deletion/Undo restores donor bed",
);
assert(!cells.has("21,4,5"));
donor = setup();
fail = true;
assert.throws(
	() =>
		api.createBuilderNormalRail(
			world,
			{ fixRTMRailMapVersion: 1 },
			positions,
			property,
			{},
		),
	/injected initialization failure/,
);
assert.strictEqual(cells.get("80,4,5").tile, donor);
assert.deepEqual(
	cells.get("20,4,5").tile.owner,
	[80, 4, 5],
	"failed initialization restores donor bed",
);
fail = false;
donor = setup();
rejectCorePlacement = true;
assert.equal(
	api.createBuilderNormalRail(
		world,
		{ fixRTMRailMapVersion: 1 },
		positions,
		property,
		{},
	),
	null,
);
assert.deepEqual(
	cells.get("20,4,5").tile.owner,
	[80, 4, 5],
	"rejected core placement restores detached owner",
);
assert.strictEqual(cells.get("80,4,5").tile, donor);
rejectCorePlacement = false;

// Endpoint ownership must survive reload, then restore before native deletion.
donor = setup();
const borrower = new Core([40, 4, 5]);
cells.set("40,4,5", { tile: borrower, block: coreBlock });
let bed = cells.get("20,4,5").tile;
api.assignEndpointRoadbeds(
	world,
	{
		getLength: () => 20,
		getRailPos: (_split, i) => [5.1, i === 1 ? 20.1 : 40.1],
		getRailHeight: () => 4,
	},
	[positions[1], positions[1]],
);
assert.deepEqual(bed.owner, [40, 4, 5]);
assert(
	context.SRBXKaizRoadbedData.get(bed).func_74764_b(
		"SRBXEndpointRoadbedLoan",
	),
);
reloadSavedData();
api.breakOwnedRail(borrower);
assert.strictEqual(cells.get("20,4,5").tile, bed);
assert.deepEqual(bed.owner, [80, 4, 5]);
assert(
	!context.SRBXKaizRoadbedData.get(bed).func_74764_b(
		"SRBXEndpointRoadbedLoan",
	),
);
assert.strictEqual(cells.get("80,4,5").tile, donor);

const dataApi = context.SRBXKaizRoadbedData;
// Promotion of an already borrowed endpoint must also retain its older loan.
const nextBorrower = new Core([40, 4, 5]);
cells.set("40,4,5", { tile: nextBorrower, block: coreBlock });
api.assignEndpointRoadbeds(
	world,
	{
		getLength: () => 20,
		getRailPos: (_split, i) => [5.1, i === 1 ? 20.1 : 40.1],
		getRailHeight: () => 4,
	},
	[positions[1], positions[1]],
);
const promoted = api.createBuilderNormalRail(
	world,
	{ fixRTMRailMapVersion: 1 },
	positions,
	property,
	{},
);
reloadSavedData();
api.breakOwnedRail(promoted);
const restoredBorrowedBed = cells.get("20,4,5").tile;
assert.deepEqual(restoredBorrowedBed.owner, [40, 4, 5]);
assert(
	dataApi.get(restoredBorrowedBed).func_74764_b("SRBXEndpointRoadbedLoan"),
);
reloadSavedData();
api.breakOwnedRail(nextBorrower);
assert.strictEqual(cells.get("20,4,5").tile, restoredBorrowedBed);
assert.deepEqual(restoredBorrowedBed.owner, [80, 4, 5]);
assert.strictEqual(cells.get("80,4,5").tile, donor);
bed = restoredBorrowedBed;
const marker = new Nbt();
marker.func_74778_a("test", "retained");
dataApi.set(bed, marker);
bed.setStartPoint(90, 4, 5);
assert(
	!dataApi.get(bed).func_74764_b("test"),
	"different owner cannot inherit stale metadata",
);
bed.setStartPoint(80, 4, 5);
assert.equal(dataApi.get(bed).func_74779_i("test"), "retained");
world.field_73011_w.field_76574_g = 1;
assert(
	!dataApi.get(bed).func_74764_b("test"),
	"dimensions must have separate records",
);
world.field_73011_w.field_76574_g = 0;
world.field_72995_K = true;
dataApi.set(bed, new Nbt());
dataApi.remove(bed);
world.field_72995_K = false;
assert.equal(
	dataApi.get(bed).func_74779_i("test"),
	"retained",
	"client cleanup must not modify persistence",
);
const section = new Section([100, 4, 5]);
section.group = "first-group";
dataApi.set(section, marker);
section.group = "replacement-group";
assert(
	!dataApi.get(section).func_74764_b("test"),
	"section replacement cannot inherit metadata",
);
dataApi.remove(bed);
assert(!dataApi.get(bed).func_74764_b("test"));
console.log(
	"KaizPatch SRG-only persistence, reload, endpoint restoration, promotion/Undo and initialization protection passed",
);
