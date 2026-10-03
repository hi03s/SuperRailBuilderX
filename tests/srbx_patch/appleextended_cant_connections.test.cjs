const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
class RailBase {
	getRailCore() {
		return this;
	}
}
class SwitchCore extends RailBase {}
class SectionCore extends RailBase {}
const list = (values) => ({ size: () => values.length, get: (i) => values[i] });
let cores = [],
	removed = 0,
	uuid = 0;
const helper = {
	cloneRailPosition: (rp) => ({ ...rp }),
	coreKey: (core) => core.key,
	getLogicalPositions: (core) => core.positions,
	getCore: (_world, pos) => cores.find((core) => core.id === pos[0]) || null,
	isSectionCore: () => false,
	validateUndoNormalRail: (_world, pos, key) => {
		const core = helper.getCore(null, pos);
		return core && core.key === key ? "ok" : "undo_rail_changed";
	},
	undoNormalRail: () => {
		removed++;
		return "ok";
	},
};
const context = {
	AppleExtendedRailCompat: helper,
	Packages: {
		jp: {
			ngt: {
				rtm: {
					rail: {
						TileEntityLargeRailBase: RailBase,
						TileEntityLargeRailSwitchCore: SwitchCore,
					},
				},
			},
			apple: { rail: { TileEntityLargeRailSectionCore: SectionCore } },
		},
		java: {
			util: {
				UUID: {
					randomUUID: () => ({ toString: () => `token-${++uuid}` }),
				},
			},
		},
	},
};
vm.createContext(context);
vm.runInContext(
	fs.readFileSync(
		"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx/AppleExtendedRailToolsCompat.js",
		"utf8",
	),
	context,
);
const tools = context.AppleExtendedRailToolsCompat;
function rp(x, yaw) {
	return {
		posX: x,
		posY: 4,
		posZ: 0,
		anchorYaw: yaw,
		cantEdge: 0,
		cantCenter: 0,
		cantRandom: 0,
		getNeighborBlockPos: () => ({}),
	};
}
function core(id, key, positions) {
	return Object.assign(new RailBase(), {
		id,
		key,
		positions,
		func_174877_v: () => ({
			func_177958_n: () => id,
			func_177956_o: () => 4,
			func_177952_p: () => 0,
		}),
		isLogicalRailOccupied: () => false,
		setRailPositions(values) {
			this.positions = values;
		},
		createRailMap() {},
		func_70296_d() {},
		sendPacket() {},
	});
}
const source = core(1, "section:source", [rp(0, 0), rp(30, 180)]);
const sourceOtherSection = core(2, source.key, source.positions);
const neighbor = core(3, "section:neighbor", [rp(0, 180), rp(-30, 0)]);
const sameOrientation = core(4, "core:other", [rp(0, 0), rp(60, 180)]);
cores = [source, sourceOtherSection, neighbor, sameOrientation];
const loaded = list(cores);
const world = {
	func_175625_s: () => sourceOtherSection,
	loadedTileEntityList: loaded,
	field_147482_g: loaded,
};
const target = {
	core: [1, 4, 0],
	railKey: source.key,
	index: 0,
	position: [0, 4, 0],
	angle: 5,
	yaw: 0,
	mode: "edge",
};
const result = tools.applyRailCants(world, [target]);
assert.equal(result.status, "ok");
assert.equal(
	source.positions[0].cantEdge,
	5,
	"another section of the same logical rail must not invert the selected endpoint",
);
assert.equal(
	neighbor.positions[0].cantEdge,
	-5,
	"opposite endpoint orientation reverses cant",
);
assert.equal(
	sameOrientation.positions[0].cantEdge,
	5,
	"same endpoint orientation preserves cant",
);
assert.equal(
	tools.cantUndoRecords[result.undoToken].length,
	3,
	"each logical rail is saved exactly once",
);
assert.equal(tools.undoRailCants(world, result.undoToken), "undo_ok");
assert.equal(neighbor.positions[0].cantEdge, 0);
const center = tools.applyRailCants(world, [
	{ ...target, mode: "center", index: -1, position: [15, 4, 0], angle: 3 },
]);
assert.equal(center.status, "ok", "center is not an endpoint index");
assert.equal(source.positions[0].cantCenter, 3);
assert.equal(source.positions[1].cantCenter, 3);
assert.equal(source.positions[0].cantEdge, 0);
assert.equal(
	neighbor.positions[0].cantCenter,
	0,
	"center only updates the selected rail",
);
tools.splitUndoRecords.branch = {
	created: [{ core: [1, 4, 0], key: source.key }],
	cants: [
		{
			core: [3, 4, 0],
			railKey: "previous-neighbor",
			positions: neighbor.positions,
		},
	],
};
assert.equal(
	tools.undoSplitBuilderRail(world, {}, "branch"),
	"undo_rail_changed",
);
assert.equal(
	removed,
	0,
	"external cant validation must precede deleting replacements",
);
assert(tools.splitUndoRecords.branch, "failed Undo remains available");
class Compound {
	constructor() {
		this.tags = {};
	}
	func_74775_l(key) {
		return this.tags[key];
	}
	func_74782_a(key, value) {
		this.tags[key] = value;
	}
}
context.Packages.net = { minecraft: { nbt: { NBTTagCompound: Compound } } };
const sectionA = Object.assign(
	new SectionCore(),
	core(11, "section:group", [rp(0, 0), rp(30, 180)]),
);
const sectionB = Object.assign(
	new SectionCore(),
	core(12, sectionA.key, [rp(0, 0), rp(30, 180)]),
);
cores = [sectionA, sectionB];
helper.isSectionCore = (value) => value instanceof SectionCore;
for (const section of cores) {
	section.getRailGroupCorePositions = () =>
		list([
			[11, 4, 0],
			[12, 4, 0],
		]);
	section.func_145831_w = () => world;
	section.writeSectionData = (nbt) => {
		nbt.tags.RailSection = new Compound();
	};
	section.readSectionData = (nbt) => {
		const data = nbt.tags.RailSection.tags;
		section.positions = [data.LogicalStartRP, data.LogicalEndRP];
	};
	for (const position of section.positions)
		position.writeToNBT = function () {
			return { ...this };
		};
}
const updated = sectionA.positions.map((position) => ({
	...position,
	cantEdge: 4,
	cantCenter: 2,
}));
assert.equal(tools.updateCants(sectionA, updated).length, 2);
assert.equal(
	sectionB.positions[0].cantEdge,
	4,
	"cant NBT reaches every physical section member",
);
assert.equal(sectionB.positions[1].cantCenter, 2);
console.log("AppleExtended cant connections: passed");
