const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
class RailBlock {
	func_176201_c() {
		return 0;
	}
}
class RailBase {
	constructor(owner = null) {
		this.owner = owner;
		this.writes = 0;
		this.dirty = 0;
	}
	getStartPoint() {
		return this.owner;
	}
	getRailCore() {
		const tile = this.owner && cells.get(this.owner.join(","))?.tile;
		return tile instanceof RailCore ? tile : null;
	}
	setStartPoint(...pos) {
		this.writes++;
		this.owner = pos;
	}
	func_70296_d() {
		this.dirty++;
	}
	func_189515_b(nbt) {
		for (const [i, name] of ["x", "y", "z"].entries())
			nbt.func_74768_a(name, this.xyz[i]);
		for (const [i, name] of ["spX", "spY", "spZ"].entries())
			nbt.func_74768_a(name, this.owner[i]);
		nbt.func_74782_a("ForgeData", this.data || new Compound());
	}
	func_145839_a(nbt) {
		this.xyz = ["x", "y", "z"].map((k) => nbt.func_74762_e(k));
		this.owner = ["spX", "spY", "spZ"].map((k) => nbt.func_74762_e(k));
		this.data = nbt.func_74775_l("ForgeData") || new Compound();
	}
	getTileData() {
		return this.data || (this.data = new Compound());
	}
	func_174877_v() {
		return new context.Packages.net.minecraft.util.math.BlockPos(
			...this.xyz,
		);
	}
}
class RailCore extends RailBase {
	func_145839_a(nbt) {
		if (failInitialize)
			throw new Error("injected core initialization failure");
		this.nbt = nbt.values;
		super.func_145839_a(nbt);
	}
	createRailMap() {
		this.maps = (this.maps || 0) + 1;
	}
	sendPacket() {
		this.packets = (this.packets || 0) + 1;
	}
	breakLogicalRail() {
		const owned = Array.from(cells).filter(
			([, value]) => value.tile?.getRailCore() === this,
		);
		for (const [pos] of owned) cells.delete(pos);
	}
}
class Compound {
	constructor() {
		this.values = {};
	}
	func_74768_a(key, value) {
		this.values[key] = value;
	}
	func_74774_a(key, value) {
		this.values[key] = value;
	}
	func_74782_a(key, value) {
		this.values[key] = value;
	}
	func_74778_a(k, v) {
		this.values[k] = v;
	}
	func_74764_b(k) {
		return k in this.values;
	}
	func_74775_l(k) {
		return this.values[k];
	}
	func_74762_e(k) {
		return this.values[k];
	}
	func_74779_i(k) {
		return this.values[k];
	}
}
const normalBlock = new RailBlock(),
	coreBlock = new RailBlock();
const key = (x, y, z) => `${x},${y},${z}`;
let cells = new Map(),
	writes = [],
	suppressTile = false;
let failInitialize = false,
	cleaned = 0;
let rejectCorePlacement = false;
const world = {
	func_180495_p: () => ({}),
	func_175625_s: (p) => cells.get(key(p.x, p.y, p.z))?.tile || null,
	func_175623_d: (p) => !cells.has(key(p.x, p.y, p.z)),
	func_184138_a() {},
	field_147482_g: {
		size: () => cells.size,
		get: (i) => Array.from(cells.values())[i].tile,
	},
	func_175698_g(pos) {
		cleaned++;
		cells.delete(key(pos.x, pos.y, pos.z));
		return true;
	},
};
const BlockUtil = {
	getTileEntity: (_world, x, y, z) => cells.get(key(x, y, z))?.tile || null,
	getBlock: (_world, x, y, z) => cells.get(key(x, y, z))?.block || {},
	setBlock: (_world, x, y, z, block, meta, flags) => {
		if (rejectCorePlacement && block === coreBlock) return false;
		const prior = cells.get(key(x, y, z))?.tile;
		if (prior && prior.getRailCore())
			prior.getRailCore().breakLogicalRail();
		writes.push({ pos: [x, y, z], block, meta, flags });
		cells.set(key(x, y, z), {
			block,
			tile: suppressTile
				? null
				: block === coreBlock
					? new RailCore()
					: new RailBase(),
		});
		if (cells.get(key(x, y, z)).tile)
			cells.get(key(x, y, z)).tile.xyz = [x, y, z];
		return true;
	},
};
const context = {
	Packages: {
		jp: {
			apple: { rail: { TileEntityLargeRailSectionCore: class {} } },
			ngt: {
				ngtlib: {
					block: { BlockUtil },
					io: { NGTLog: { debug() {} } },
				},
				rtm: {
					RTMRail: {
						largeRailBase: normalBlock,
						largeRailCore: coreBlock,
					},
					rail: {
						BlockLargeRailBase: RailBlock,
						TileEntityLargeRailBase: RailBase,
						TileEntityLargeRailCore: RailCore,
						util: {
							RailMapBasic: { fixRTMRailMapVersionCurrent: 7 },
						},
					},
				},
			},
		},
		net: {
			minecraft: {
				block: {
					Block: {
						func_149682_b: () => 1,
						func_149729_e: () => normalBlock,
					},
				},
				nbt: { NBTTagCompound: Compound },
				util: {
					math: {
						BlockPos: class {
							constructor(x, y, z) {
								this.x = x;
								this.y = y;
								this.z = z;
							}
							func_177958_n() {
								return this.x;
							}
							func_177956_o() {
								return this.y;
							}
							func_177952_p() {
								return this.z;
							}
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
		"dist/assets/minecraft/scripts/superrailbuilderx/SRBXRoadbedOwnership.js",
		"utf8",
	),
	context,
);
vm.runInContext(
	fs.readFileSync(
		"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx/AppleExtendedRoadbedPlacement.js",
		"utf8",
	),
	context,
);
const helper = context.AppleExtendedRoadbedPlacement;
const list = (positions) => ({
	size: () => positions.length,
	get: (i) => positions[i],
});
const owner = { blockX: 50, blockY: 4, blockZ: 60 };
const scenarios = [
	new RailBase([1, 4, 2]),
	new RailCore([3, 4, 4]),
	null,
	new RailBase(null),
];
const retained = scenarios.map((tile, i) => ({
	pos: [i, 4, 0],
	block: normalBlock,
	tile,
}));
for (const value of retained) cells.set(value.pos.join(","), value);
const addedPosition = [10, 4, 0];
const property = { writeToNBT: () => ({ model: "test-rail" }) };
helper.place(
	{},
	{
		getRailBlockList: () =>
			list([...retained.map((value) => value.pos), addedPosition]),
	},
	owner,
	property,
);
assert.equal(
	writes.length,
	1,
	"existing normal/core/missing-tile/ownerless rail beds must not be written",
);
assert.deepEqual(writes[0].pos, addedPosition);
const added = cells.get(addedPosition.join(",")).tile;
assert.deepEqual(added.owner, [50, 4, 60]);
assert.equal(added.writes, 1);
assert.equal(added.dirty, 1);
for (const value of retained) {
	assert.strictEqual(cells.get(value.pos.join(",")), value);
	if (value.tile) assert.equal(value.tile.writes, 0);
}
function rp(x) {
	return {
		blockX: x,
		blockY: 4,
		blockZ: 5,
		writeToNBT: () => ({ endpoint: x, cantEdge: x === 20 ? -5 : 5 }),
	};
}
const start = rp(20),
	end = rp(40);
let prepared = 0,
	allowed = true;
const map = {
	canPlaceRail: (_world, creative, givenProperty) => {
		assert.equal(creative, true);
		assert.strictEqual(givenProperty, property);
		return allowed;
	},
	getStartRP: () => start,
	getEndRP: () => end,
	prepareBaseBlocks: (_world, x, y, z) => {
		prepared++;
		assert.deepEqual([x, y, z], [20, 4, 5]);
	},
	getRailBlockList: () =>
		list([[21, 4, 5], ...retained.map((value) => value.pos)]),
};
writes = [];
assert.equal(helper.createNormal({}, map, property, true), true);
assert.equal(prepared, 1);
const core = cells.get("20,4,5").tile;
assert(core instanceof RailCore);
assert.deepEqual(core.nbt.RP0, start.writeToNBT());
assert.deepEqual(core.nbt.RP1, end.writeToNBT());
assert.deepEqual(core.nbt.State, property.writeToNBT());
assert.equal(core.nbt.fixRTMRailMapVersion, 7);
assert.equal(core.nbt.Size, 2);
assert.deepEqual([core.nbt.x, core.nbt.y, core.nbt.z], [20, 4, 5]);
assert.deepEqual([core.nbt.spX, core.nbt.spY, core.nbt.spZ], [20, 4, 5]);
assert.equal(core.maps, 1);
assert.equal(core.packets, 1);
assert(
	writes.some((value) => value.block === coreBlock),
	"core installation remains separate from roadbed ownership preservation",
);
for (const value of retained)
	assert.strictEqual(cells.get(value.pos.join(",")), value);
const existingRoot = cells.get("20,4,5");
writes = [];
assert.equal(
	helper.createNormal(world, map, property, true),
	false,
	"existing root core must not be overwritten",
);
assert.strictEqual(cells.get("20,4,5"), existingRoot);
assert.equal(writes.length, 0);
assert.equal(prepared, 1);
allowed = false;
writes = [];
assert.equal(helper.createNormal({}, map, property, true), false);
assert.equal(writes.length, 0);
assert.equal(prepared, 1);
allowed = true;
suppressTile = true;
cells.delete("20,4,5");
assert.equal(
	helper.createNormal({}, map, property, true),
	false,
	"missing installed core must report failure",
);
for (const value of retained) {
	assert.strictEqual(
		cells.get(value.pos.join(",")),
		value,
		"failed creation retains preexisting rail beds",
	);
	if (value.tile) assert.equal(value.tile.writes, 0);
}
suppressTile = false;
failInitialize = true;
cells.delete("20,4,5");
assert.throws(
	() => helper.createNormal(world, map, property, true),
	/injected core initialization failure/,
);
assert.equal(
	cleaned,
	1,
	"only newly installed core is removed after initialization fails",
);
assert.equal(cells.has("20,4,5"), false);
for (const value of retained)
	assert.strictEqual(cells.get(value.pos.join(",")), value);
// Native breakBlock is destructive: promoting another rail's ordinary bed must
// detach it first, and deletion/Undo or initialization failure must restore it.
vm.runInContext(
	fs.readFileSync(
		"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx/AppleExtendedRailCompat.js",
		"utf8",
	),
	context,
);
map.getRailBlockList = () => list([[21, 4, 5]]);
function donorSetup() {
	cells.clear();
	const donor = new RailCore([80, 4, 5]);
	donor.xyz = [80, 4, 5];
	cells.set("80,4,5", { block: coreBlock, tile: donor });
	const bed = new RailBase([80, 4, 5]);
	bed.xyz = [20, 4, 5];
	cells.set("20,4,5", { block: normalBlock, tile: bed });
	return donor;
}
failInitialize = false;
let donor = donorSetup();
assert.equal(helper.createNormal(world, map, property, true), true);
assert.strictEqual(
	cells.get("80,4,5").tile,
	donor,
	"promotion must not delete the donor rail",
);
const promoted = cells.get("20,4,5").tile;
assert(promoted.getTileData().func_74764_b("SRBXPromotedRoadbed"));
context.AppleExtendedRailCompat.breakRail(world, promoted);
assert.deepEqual(
	cells.get("20,4,5").tile.owner,
	[80, 4, 5],
	"Undo/deletion restores original ordinary bed",
);
assert.strictEqual(cells.get("80,4,5").tile, donor);
assert(!cells.has("21,4,5"));
donor = donorSetup();
failInitialize = true;
assert.throws(
	() => helper.createNormal(world, map, property, true),
	/injected core initialization failure/,
);
assert.deepEqual(
	cells.get("20,4,5").tile.owner,
	[80, 4, 5],
	"failed initialization restores donor bed",
);
assert.strictEqual(cells.get("80,4,5").tile, donor);
failInitialize = false;
donor = donorSetup();
rejectCorePlacement = true;
assert.equal(helper.createNormal(world, map, property, true), false);
assert.deepEqual(
	cells.get("20,4,5").tile.owner,
	[80, 4, 5],
	"rejected block placement restores detached owner",
);
assert.strictEqual(cells.get("80,4,5").tile, donor);
console.log(
	"AppleExtended roadbed placement ownership and normal core NBT tests passed",
);
