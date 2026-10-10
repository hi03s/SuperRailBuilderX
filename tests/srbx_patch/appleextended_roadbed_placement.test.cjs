const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
class RailBlock {}
class RailBase {
	constructor(owner = null) {
		this.owner = owner;
		this.writes = 0;
		this.dirty = 0;
	}
	getStartPoint() {
		return this.owner;
	}
	setStartPoint(...pos) {
		this.writes++;
		this.owner = pos;
	}
	func_70296_d() {
		this.dirty++;
	}
}
class RailCore extends RailBase {
	func_145839_a(nbt) {
		if (failInitialize)
			throw new Error("injected core initialization failure");
		this.nbt = nbt.values;
	}
	createRailMap() {
		this.maps = (this.maps || 0) + 1;
	}
	sendPacket() {
		this.packets = (this.packets || 0) + 1;
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
}
const normalBlock = new RailBlock(),
	coreBlock = new RailBlock();
const key = (x, y, z) => `${x},${y},${z}`;
let cells = new Map(),
	writes = [],
	suppressTile = false;
let failInitialize = false,
	cleaned = 0;
const world = {
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
		writes.push({ pos: [x, y, z], block, meta, flags });
		cells.set(key(x, y, z), {
			block,
			tile: suppressTile
				? null
				: block === coreBlock
					? new RailCore()
					: new RailBase(),
		});
		return true;
	},
};
const context = {
	Packages: {
		jp: {
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
				nbt: { NBTTagCompound: Compound },
				util: {
					math: {
						BlockPos: class {
							constructor(x, y, z) {
								this.x = x;
								this.y = y;
								this.z = z;
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
console.log(
	"AppleExtended roadbed placement ownership and normal core NBT tests passed",
);
