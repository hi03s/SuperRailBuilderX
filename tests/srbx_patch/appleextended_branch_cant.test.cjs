const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const root =
	"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx/";
class NBT {
	constructor() {
		this.values = {};
	}
	func_74775_l(key) {
		return this.values[key];
	}
	func_74782_a(key, value) {
		this.values[key] = value;
	}
	func_74774_a(key, value) {
		this.values[key] = value;
	}
	func_74768_a(key, value) {
		this.values[key] = value;
	}
}
class RP {
	constructor(type = 0) {
		Object.defineProperty(this, "switchType", { value: type });
		this.blockX = type;
		this.blockY = 4;
		this.blockZ = 0;
		this.posX = type;
		this.posY = 4.0625;
		this.posZ = 0.5;
		this.direction = 2;
	}
	writeToNBT() {
		const nbt = new NBT();
		nbt.values.SwitchType = this.switchType;
		nbt.values.Position = { ...this };
		return nbt;
	}
	static readFromNBT(nbt) {
		return Object.assign(
			new RP(nbt.values.SwitchType),
			nbt.values.Position,
		);
	}
	setPosition(x, y, z) {
		this.posX = x;
		this.posY = y;
		this.posZ = z;
	}
}
class Section {}
class Base {
	getRailCore() {
		return core;
	}
}
class Core extends Base {}
class List {
	constructor() {
		this.values = [];
	}
	add(value) {
		this.values.push(value);
	}
}
let rejected = false;
let placeable = true;
let changes = 0;
let ownerOccupied = false;
const map = {
	canPlaceRail: () => placeable,
	setRail: () => changes++,
	prepareBaseBlocks: () => changes++,
	getRailBlockList: () => ({ size: () => 0 }),
};
class Maker {
	constructor(world, list, version) {
		this.list = list;
		this.fixRTMRailMapVersion = version;
	}
	getSwitch() {
		if (
			rejected ||
			this.list.values.filter((rp) => rp.switchType === 1).length !== 1
		)
			return null;
		return { getAllRailMap: () => [map, map] };
	}
}
const core = {
	get fixRTMRailMapVersion() {
		throw new Error("protected field is inaccessible");
	},
	set fixRTMRailMapVersion(value) {
		throw new Error("protected field is inaccessible");
	},
	func_145839_a(nbt) {
		this.nbt = nbt;
		this.positions = [];
		for (let i = 0; i < nbt.values.Size; i++)
			this.positions.push(RP.readFromNBT(nbt.values[`RP${i}`]));
	},
	setStartPoint() {},
	setRailPositions(positions) {
		this.positions = positions;
	},
	getResourceState: () => ({ readFromNBT() {} }),
	createRailMap() {},
	onBlockChanged() {},
	sendPacket() {},
};
const context = {
	AppleExtendedRoadbedPlacement: { place() {} },
	AppleExtendedRailCompat: {
		getLogicalPositions: (member) => member.positions,
		isSectionCore: (member) => member instanceof Section,
		getCore: () => section,
	},
	Packages: {
		java: { util: { ArrayList: List } },
		net: {
			minecraft: {
				nbt: { NBTTagCompound: NBT },
				util: { math: { BlockPos: class BlockPos {} } },
			},
		},
		jp: {
			apple: {
				appleextended: {
					rail: { TileEntityLargeRailSectionCore: Section },
				},
			},
			ngt: {
				ngtlib: {
					io: { NGTLog: { debug() {} } },
					block: {
						BlockUtil: {
							setBlock() {
								changes++;
							},
							getTileEntity: () =>
								ownerOccupied ? new Core() : core,
						},
					},
				},
				rtm: {
					RTMRail: {
						largeRailBase: 1,
						largeRailSwitchBase: 2,
						largeRailSwitchCore: 3,
					},
					rail: {
						TileEntityLargeRailBase: Base,
						TileEntityLargeRailCore: Core,
						util: {
							RailPosition: RP,
							RailMaker: Maker,
							RailMapBasic: { fixRTMRailMapVersionCurrent: 2 },
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

if (
	context.AppleExtendedRailCompat &&
	!context.AppleExtendedRailCompat.areBoundaryPositions
)
	context.AppleExtendedRailCompat.areBoundaryPositions = () => true;
for (const file of [
	"AppleExtendedRailProtection.js",
	"AppleExtendedRailToolsCompat.js",
	"AppleExtendedSwitchCompat.js",
])
	vm.runInContext(fs.readFileSync(root + file, "utf8"), context);
const tools = context.AppleExtendedRailToolsCompat;
const switched = tools.switchPosition(new RP(), 1);
assert.strictEqual(
	switched.switchType,
	1,
	"immutable Java switchType must be recreated",
);
assert.strictEqual(switched.cantEdge, 0);
const section = new Section();
section.positions = [new RP(), new RP()];
section.getRailGroupCorePositions = () => ({
	size: () => 1,
	get: () => [1, 4, 0],
});
section.func_145831_w = () => ({});
section.func_174877_v = () => ({
	func_177958_n: () => 1,
	func_177956_o: () => 4,
	func_177952_p: () => 0,
});
section.writeSectionData = (nbt) => {
	nbt.values.RailSection = new NBT();
};
section.readSectionData = (nbt) => {
	section.nbt = nbt;
};
section.createRailMap = () => {};
section.func_70296_d = () => {};
section.sendPacket = () => {};
const cantPositions = [
	{ cantEdge: 5, cantCenter: 2, cantRandom: 0 },
	{ cantEdge: -1, cantCenter: 2, cantRandom: 0 },
];
const updated = tools.updateCants(section, cantPositions);
assert.strictEqual(updated.length, 1);
assert.ok(
	section.nbt.values.RailSection.values.LogicalStartRP,
	"SRG-only NBT setTag must work",
);
assert.ok(section.nbt.values.RailSection.values.LogicalEndRP);
const property = { writeToNBT: () => new NBT() };
const world = { func_175625_s: () => null };
const player = { field_71075_bZ: { field_75098_d: true } };
const positions = [switched, new RP(), new RP()];
positions[1].blockX = 4;
positions[2].blockX = 8;
ownerOccupied = true;
assert.strictEqual(
	context.AppleExtendedSwitchCompat.create(
		world,
		player,
		positions,
		property,
	),
	false,
);
assert.strictEqual(changes, 0, "an existing core must not be overwritten");
ownerOccupied = false;
rejected = true;
assert.strictEqual(
	context.AppleExtendedSwitchCompat.create(
		world,
		player,
		positions,
		property,
	),
	false,
);
assert.strictEqual(
	changes,
	0,
	"invalid switch must not touch world or null player marker API",
);
rejected = false;
placeable = false;
assert.strictEqual(
	context.AppleExtendedSwitchCompat.create(
		world,
		player,
		positions,
		property,
	),
	false,
);
assert.strictEqual(changes, 0, "all paths must be checked before placement");
placeable = true;
assert.strictEqual(
	context.AppleExtendedSwitchCompat.create(
		world,
		player,
		positions,
		property,
	),
	true,
);
assert.strictEqual(core.positions.length, positions.length);
assert.strictEqual(core.positions[0].switchType, 1);
assert.strictEqual(core.nbt.values.fixRTMRailMapVersion, 2);
assert.ok(changes > 0);
console.log("appleextended branch/cant tests passed");

// A connected endpoint may use a foreign core's block. Only its auxiliary owner moves.
const switchTools = context.AppleExtendedSwitchCompat;
const blockUtil = context.Packages.jp.ngt.ngtlib.block.BlockUtil;
const foreign = new Core(),
	writes = [];
blockUtil.getTileEntity = (_world, x, y, z) => (x === 4 ? foreign : core);
blockUtil.setBlock = (_world, x, y, z) => {
	writes.push([x, y, z]);
	changes++;
};
map.getRailBlockList = () => ({
	size: () => 3,
	get: (i) =>
		[
			[4, 4, 0],
			[5, 4, 0],
			[8, 4, 0],
		][i],
});
positions[1].setPosition(4.25, 4.0625, 0.5);
const original = JSON.stringify(positions);
const planned = switchTools.planOwners(world, positions, [map], property);
assert.equal(planned[1].blockX, 5);
assert.equal(planned[1].posX, 4.25);
assert.equal(planned[1].posY, 4.0625);
assert.equal(planned[1].switchType, 0);
assert.equal(
	planned[0],
	positions[0],
	"The root and its lever location remain fixed",
);
assert.equal(
	JSON.stringify(positions),
	original,
	"Caller endpoints remain unchanged",
);
assert.equal(switchTools.create(world, player, positions, property), true);
assert(!writes.some((p) => p[0] === 4), "Foreign core is never overwritten");
assert.equal(
	core.positions[1].blockX,
	5,
	"Safe owner is persisted for later native reconciliation",
);
assert.equal(core.positions[1].posX, 4.25);
assert.equal(blockUtil.getTileEntity(world, 4, 4, 0), foreign);
// An occupied area with no in-footprint alternative must fail before mutation.
writes.length = 0;
map.getRailBlockList = () => ({
	size: () => 2,
	get: (i) =>
		[
			[4, 4, 0],
			[8, 4, 0],
		][i],
});
assert.equal(switchTools.create(world, player, positions, property), false);
assert.equal(writes.length, 0);
assert.equal(JSON.stringify(positions), original);
console.log(
	"AppleExtended protected auxiliary switch owner relocation and failure guard passed",
);
