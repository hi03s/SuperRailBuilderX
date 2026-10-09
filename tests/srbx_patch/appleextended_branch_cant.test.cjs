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
	}
	writeToNBT() {
		const nbt = new NBT();
		nbt.values.SwitchType = this.switchType;
		return nbt;
	}
	static readFromNBT(nbt) {
		return new RP(nbt.values.SwitchType);
	}
}
class Section {}
class Base {
	getRailCore() {
		return core;
	}
}
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
			apple: { rail: { TileEntityLargeRailSectionCore: Section } },
			ngt: {
				ngtlib: {
					io: { NGTLog: { debug() {} } },
					block: {
						BlockUtil: {
							setBlock() {
								changes++;
							},
							getTileEntity: () =>
								ownerOccupied ? new Base() : core,
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
vm.runInContext(fs.readFileSync("dist/assets/minecraft/scripts/superrailbuilderx/SRBXRailBoundary.js", "utf8"), context);
if (context.AppleExtendedRailCompat && !context.AppleExtendedRailCompat.areBoundaryPositions) context.AppleExtendedRailCompat.areBoundaryPositions = () => true;
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
const player = { field_71075_bZ: { field_75098_d: true } };
const positions = [switched, new RP(), new RP()];
ownerOccupied = true;
assert.strictEqual(
	context.AppleExtendedSwitchCompat.create({}, player, positions, property),
	false,
);
assert.strictEqual(
	changes,
	0,
	"a connected roadbed owner must not be overwritten",
);
ownerOccupied = false;
rejected = true;
assert.strictEqual(
	context.AppleExtendedSwitchCompat.create({}, player, positions, property),
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
	context.AppleExtendedSwitchCompat.create({}, player, positions, property),
	false,
);
assert.strictEqual(changes, 0, "all paths must be checked before placement");
placeable = true;
assert.strictEqual(
	context.AppleExtendedSwitchCompat.create({}, player, positions, property),
	true,
);
assert.strictEqual(core.positions.length, positions.length);
assert.strictEqual(core.positions[0].switchType, 1);
assert.strictEqual(core.nbt.values.fixRTMRailMapVersion, 2);
assert.ok(changes > 0);
console.log("appleextended branch/cant tests passed");
