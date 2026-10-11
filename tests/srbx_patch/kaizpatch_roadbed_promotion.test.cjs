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
		return this.values[k];
	}
	func_74762_e(k) {
		return this.values[k];
	}
	func_74779_i(k) {
		return this.values[k];
	}
}
class Base {
	constructor(pos, owner = pos) {
		[this.field_145851_c, this.field_145848_d, this.field_145849_e] = pos;
		this.owner = owner;
		this.data = new Nbt();
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
	getTileData() {
		return this.data;
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
		nbt.func_74782_a("ForgeData", this.data);
	}
	func_145839_a(nbt) {
		this.owner = ["spX", "spY", "spZ"].map((k) => nbt.func_74762_e(k));
		this.data = nbt.func_74775_l("ForgeData");
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
class Section extends Core {}
class RailBlock {}
const baseBlock = new RailBlock(),
	coreBlock = new RailBlock();
const world = {
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
assert(core.getTileData().func_74764_b("SRBXPromotedRoadbed"));
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
console.log(
	"KaizPatch native-style destructive promotion, deletion/Undo and failed initialization protection passed",
);
