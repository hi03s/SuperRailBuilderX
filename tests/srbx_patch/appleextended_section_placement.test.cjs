const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const tiles = new Map(),
	events = [];
let failCore = -1,
	created = 0,
	packets = 0;
const list = (a) => ({ size: () => a.length, get: (i) => a[i] });
class ArrayList {
	constructor() {
		this.values = [];
	}
	add(v) {
		this.values.push(v);
	}
	size() {
		return this.values.length;
	}
	get(i) {
		return this.values[i];
	}
}
class Pos {
	constructor(x, y, z) {
		this.xyz = [x, y, z];
	}
	func_177958_n() {
		return this.xyz[0];
	}
	func_177956_o() {
		return this.xyz[1];
	}
	func_177952_p() {
		return this.xyz[2];
	}
}
const key = (p) => p.join(",");
const world = {
	func_180495_p: () => ({}),
	func_175667_e: () => true,
	func_175625_s: (p) => tiles.get(key(p.xyz)) || null,
	func_175698_g: (p) => {
		tiles.delete(key(p.xyz));
		return true;
	},
};
class Nbt {
	constructor() {
		this.data = {};
	}
	func_74768_a(k, v) {
		this.data[k] = v;
	}
	func_74774_a(k, v) {
		this.data[k] = v;
	}
	func_74782_a(k, v) {
		this.data[k] = v;
	}
}
class RP {
	constructor(x, y, z, d = 2, t = 0) {
		this.blockX = x;
		this.blockY = y;
		this.blockZ = z;
		this.direction = d;
		this.switchType = t;
		this.posX = x + 0.5;
		this.posY = y + 0.063;
		this.posZ = z;
		this.anchorYaw = 90;
	}
	writeToNBT() {
		return { ...this };
	}
	static readFromNBT(nbt) {
		return Object.assign(new RP(nbt.blockX, nbt.blockY, nbt.blockZ), nbt);
	}
	setPosition(x, y, z) {
		this.posX = x;
		this.posY = y;
		this.posZ = z;
	}
}
class Base {
	func_70296_d() {}
	constructor(xyz, owner) {
		this.xyz = xyz;
		this.owner = owner;
	}
	getRailCore() {
		const tile = tiles.get(key(this.owner));
		return tile instanceof CoreBase ? tile : null;
	}
	getStartPoint() {
		return this.owner;
	}
	setStartPoint(...p) {
		this.owner = p;
	}
}
class CoreBase extends Base {}
class Section extends CoreBase {
	constructor(xyz) {
		super(xyz, xyz);
		this.id = ++created;
		Object.defineProperty(this, "fixRTMRailMapVersion", {
			set() {
				throw Error("protected version must use NBT");
			},
		});
	}
	func_174877_v() {
		return new Pos(...this.xyz);
	}
	getRailCore() {
		return this;
	}
	func_145839_a(nbt) {
		if (this.id === failCore)
			throw Error("simulated section initialization failure");
		assert.equal(nbt.data.fixRTMRailMapVersion, 7);
		assert(nbt.data.RP0);
		this.state = nbt.data.State;
	}
	configureRailSection(group, logical, physical, from, to, owners) {
		this.group = group;
		this.logical = logical;
		this.physical = physical;
		this.from = from;
		this.to = to;
		this.owners = owners;
		events.push(this);
	}
	createRailMap() {}
	sendPacket() {
		packets++;
	}
	getRailGroupId() {
		return this.group;
	}
	getLogicalRailPositions() {
		return this.logical;
	}
}
class Basic {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}
	getStartRP() {
		return this.start;
	}
	getEndRP() {
		return this.end;
	}
	prepareBaseBlocks() {
		events.push("prepare");
	}
	getRailBlockList() {
		return list([
			[0, 4, 0],
			[1, 4, 0],
			[5, 4, 0],
			[6, 4, 0],
			[10, 4, 0],
		]);
	}
}
Basic.fixRTMRailMapVersionCurrent = 7;
const mid = new RP(5, 4, 0);
class SectionMap {
	constructor(source, start, end, from, to) {
		this.source = source;
		this.start = start;
		this.end = end;
		this.from = from;
		this.to = to;
	}
	getRailBlockList() {
		if (this.source.start.blockX > this.source.end.blockX)
			return list(
				this.from === 0
					? [
							[10, 4, 0],
							[9, 4, 0],
						]
					: [
							[5, 4, 0],
							[4, 4, 0],
							[0, 4, 0],
						],
			);
		return list(
			this.from === 0
				? [
						[0, 4, 0],
						[1, 4, 0],
					]
				: [
						[5, 4, 0],
						[6, 4, 0],
						[10, 4, 0],
					],
		);
	}
	canPlaceRail() {
		return true;
	}
	placeRailBlocks(_w, _block, x, y, z) {
		for (const p of this.getRailBlockList().get
			? Array.from({ length: this.getRailBlockList().size() }, (_, i) =>
					this.getRailBlockList().get(i),
				)
			: []) {
			const tile = tiles.get(key(p));
			if (tile instanceof Base) tile.setStartPoint(x, y, z);
			else tiles.set(key(p), new Base(p, [x, y, z]));
		}
	}
}
const split = (source) =>
	list([
		{
			getStartRP: () => source.start,
			getEndRP: () => mid,
			getStartRatio: () => 0,
			getEndRatio: () => 0.5,
		},
		{
			getStartRP: () => mid,
			getEndRP: () => source.end,
			getStartRatio: () => 0.5,
			getEndRatio: () => 1,
		},
	]);
const property = { autoSplit: true, writeToNBT: () => ({ model: "source" }) };
const context = { Packages: {} };
context.Packages.java = {
	util: {
		ArrayList,
		UUID: { randomUUID: () => ({ toString: () => "new-group" }) },
	},
};
context.Packages.jp = {
	ngt: {},
	apple: {
		rail: {
			TileEntityLargeRailSectionCore: Section,
			util: { RailMapSection: SectionMap, RailChunkSectioner: { split } },
		},
	},
};
context.Packages.jp.ngt.ngtlib = {
	io: { NGTLog: { debug() {} } },
	block: {
		BlockUtil: {
			setBlock(_w, x, y, z, _block, meta) {
				assert([0, 1].includes(meta));
				tiles.set(
					key([x, y, z]),
					meta === 1
						? new Section([x, y, z])
						: new Base([x, y, z], [x, y, z]),
				);
			},
			getTileEntity: (_w, x, y, z) => tiles.get(key([x, y, z])),
			getBlock: () => ({ func_176201_c: () => 0 }),
		},
	},
};
context.Packages.jp.ngt.rtm = {
	RTMRail: { largeRailBase: {}, largeRailCore: {} },
	rail: {
		TileEntityLargeRailBase: Base,
		BlockLargeRailBase: class {},
		TileEntityLargeRailCore: CoreBase,
		util: { RailPosition: RP, RailMapBasic: Basic },
	},
	item: {
		ItemRail: {
			getDefaultProperty: () => ({
				autoSplit: true,
				readFromNBT() {},
				writeToNBT: () => ({ model: "source" }),
			}),
		},
	},
};
context.Packages.net = {
	minecraft: {
		block: { Block: { func_149682_b: () => 1 } },
		util: { math: { BlockPos: Pos } },
		nbt: { NBTTagCompound: Nbt },
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
		"dist/assets/minecraft/scripts/superrailbuilderx/SRBXRoadbedOwnership.js",
		"utf8",
	),
	context,
);
const dir =
	"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx/";
for (const n of [
	"AppleExtendedRailProtection",
	"AppleExtendedRoadbedPlacement",
	"AppleExtendedSectionPlacementCompat",
	"AppleExtendedRailCompat",
])
	vm.runInContext(fs.readFileSync(dir + n + ".js", "utf8"), context);
const helper = context.AppleExtendedRailCompat,
	placement = context.AppleExtendedSectionPlacementCompat;
helper.coreKey = (core) => (core.foreign ? "foreign" : "section:new-group");
const start = new RP(0, 4, 0),
	end = new RP(10, 4, 0);
function reset() {
	tiles.clear();
	events.length = 0;
	created = 0;
	packets = 0;
	failCore = -1;
	for (const x of [0, 10]) {
		const foreign = new CoreBase([x, 4, 0], [x, 4, 0]);
		foreign.foreign = true;
		foreign.getRailCore = () => foreign;
		tiles.set(key(foreign.xyz), foreign);
	}
}
reset();
const foreignStart = tiles.get("0,4,0"),
	foreignEnd = tiles.get("10,4,0");
const plan = helper.planCreation(world, [start, end], property);
assert(
	plan.sections,
	"both logical endpoint owners occupied must try free section interior",
);
assert.equal(plan.root.blockX, 1);
assert.equal(
	plan.root.posX,
	start.posX,
	"logical source orientation remains the native equal-height orientation",
);
// A core conflict tries the reverse section plan before normal fallback.
const logicalBefore = JSON.stringify([start, end]);
assert.equal(placement.create(world, plan.sections, property, true), true);
assert.equal(events.filter((e) => e instanceof Section).length, 2);
assert.equal(packets, 2);
assert.strictEqual(tiles.get("0,4,0"), foreignStart);
assert.strictEqual(tiles.get("10,4,0"), foreignEnd);
assert.deepEqual(foreignStart.owner, [0, 4, 0]);
assert.deepEqual(foreignEnd.owner, [10, 4, 0]);
assert.equal(JSON.stringify([start, end]), logicalBefore);
for (const e of events.filter((e) => e instanceof Section)) {
	assert.equal(e.logical[0].posX, start.posX);
	assert.equal(e.logical[1].posX, end.posX);
	assert.equal(e.owners.size(), 2);
}
reset();
const blocked = placement.plan(world, start, end, property, () => true);
assert.equal(blocked, null);
assert.equal(created, 0);
reset();
const planned = placement.plan(
	world,
	start,
	end,
	property,
	(p) => !!tiles.get(key([p.blockX, p.blockY, p.blockZ]))?.getRailCore(),
);
const collision = new Section([1, 4, 0]);
const createdBeforeCollision = created;
collision.getRailCore = () => collision;
tiles.set("1,4,0", collision);
assert.equal(
	placement.create(world, planned, property, true),
	false,
	"all owners revalidated before any mutation",
);
assert.equal(created, createdBeforeCollision);
assert.strictEqual(
	tiles.get("1,4,0"),
	collision,
	"foreign Section core remains unchanged",
);
reset();
const failedPlan = placement.plan(
	world,
	start,
	end,
	property,
	(p) => !!tiles.get(key([p.blockX, p.blockY, p.blockZ]))?.getRailCore(),
);
failCore = 2;
assert.throws(
	() => placement.create(world, failedPlan, property, true),
	/simulated/,
);
assert.equal(
	packets,
	0,
	"partial initialization must not send completed rail packets",
);
assert(!tiles.get("1,4,0"));
assert(!tiles.get("5,4,0"));
assert.deepEqual(tiles.get("0,4,0").owner, [0, 4, 0]);
assert.deepEqual(tiles.get("10,4,0").owner, [10, 4, 0]);
console.log(
	"AppleExtended free section ownership, logical geometry, SRG NBT and failure protection tests passed",
);
