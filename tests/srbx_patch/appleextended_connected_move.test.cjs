const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const list = (values) => ({ size: () => values.length, get: (i) => values[i] });
const tiles = new Map();
let serial = 0,
	breaks = 0;
class BlockPos {
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
const key = (pos) => pos.join(",");
const world = {
	func_175667_e: () => true,
	func_175625_s: (p) => tiles.get(key(p.xyz)) || null,
};
class Base {
	constructor(owner) {
		this.owner = owner;
	}
	getRailCore() {
		return this.owner;
	}
}
const property = () => ({
	autoSplit: true,
	writeToNBT() {
		return { autoSplit: this.autoSplit };
	},
	readFromNBT(nbt) {
		this.autoSplit = nbt.autoSplit;
	},
});
class Core extends Base {
	constructor(positions, owner, section = true) {
		super(null);
		this.owner = this;
		this.positions = positions;
		this.xyz = owner;
		this.key = "rail:" + ++serial;
		this.section = section;
		this.prop = property();
		this.prop.autoSplit = section;
		this.subRails = list([]);
	}
	func_174877_v() {
		return new BlockPos(...this.xyz);
	}
	func_145831_w() {
		return world;
	}
	isLogicalRailOccupied() {
		return false;
	}
	getRailGroupCorePositions() {
		return list([this.xyz]);
	}
	getResourceState() {
		return this.prop;
	}
	getSignal() {
		return 1;
	}
	setSignal() {}
	addSubRail() {}
	func_70296_d() {}
	sendPacket() {}
	breakLogicalRail() {
		breaks++;
		for (const [k, tile] of tiles)
			if (tile.getRailCore() === this) tiles.delete(k);
	}
}
class SwitchCore extends Core {}
class MapBasic {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}
}
// Native split owners include the shared endpoint, while its logical other end is free.
const split = (map) =>
	list([map.start, map.end].map((owner) => ({ getStartRP: () => owner })));
const context = {
	AppleExtendedSectionPlacementCompat: { plan: () => null },
	Packages: {
		jp: {
			ngt: {
				rtm: {
					rail: {
						TileEntityLargeRailBase: Base,
						TileEntityLargeRailCore: Core,
						TileEntityLargeRailSwitchCore: SwitchCore,
						util: { RailMapBasic: MapBasic },
					},
					item: { ItemRail: { getDefaultProperty: property } },
				},
				ngtlib: { io: { NGTLog: { debug() {} } } },
			},
			apple: {
				rail: {
					TileEntityLargeRailSectionCore: Core,
					util: { RailChunkSectioner: { split } },
				},
			},
		},
		net: { minecraft: { util: { math: { BlockPos } } } },
		java: { util: { ArrayList: class {} } },
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

const dir =
	"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx/";
for (const name of ["AppleExtendedRailCompat", "AppleExtendedRailMoveCompat"])
	vm.runInContext(fs.readFileSync(dir + name + ".js", "utf8"), context);
const helper = context.AppleExtendedRailCompat,
	mover = context.AppleExtendedRailMoveCompat;
helper.coreKey = (c) => c.key;
helper.isSectionCore = (c) => c.section;
helper.getLogicalPositions = (c) => c.positions;
helper.getCore = (_w, xyz) => tiles.get(key(xyz))?.getRailCore() || null;
helper.cloneRailPosition = (rp) => ({ ...rp });
helper.resolveBuilderPoint = (_w, p) =>
	rp(p.position[0], p.ownerBlock?.[0] ?? Math.floor(p.position[0]));
helper.createFromPositions = (_w, _player, positions, prop) => {
	const plan = helper.planCreation(world, positions, prop);
	if (!plan) return null;
	const xyz = [plan.root.blockX, plan.root.blockY, plan.root.blockZ];
	const created = new Core(
		Array.from(plan.ordered, (p) => ({ ...p })),
		xyz,
		plan.property.autoSplit,
	);
	tiles.set(key(xyz), created);
	// Preserve a live foreign roadbed exactly as the real creation protection does.
	for (const p of positions) {
		const k = key([p.blockX, p.blockY, p.blockZ]);
		if (!tiles.has(k)) tiles.set(k, new Base(created));
	}
	return { core: xyz, key: created.key };
};
function rp(x, owner = x) {
	return {
		posX: x,
		posY: 4,
		posZ: 0,
		blockX: owner,
		blockY: 4,
		blockZ: 0,
		direction: 2,
		anchorYaw: 90,
		anchorPitch: 0,
		anchorLengthHorizontal: 3,
		anchorLengthVertical: 3,
		cantEdge: 0,
		cantCenter: 0,
		cantRandom: 0,
	};
}
function install(core) {
	tiles.set(key(core.xyz), core);
	for (const p of core.positions) {
		const k = key([p.blockX, p.blockY, p.blockZ]);
		if (!tiles.has(k)) tiles.set(k, new Base(core));
	}
	return core;
}
function moveEndpoint(core, oldX, newX) {
	const original = core.positions.map((p) => [p.posX, p.posY, p.posZ]);
	const points = core.positions.map((p) => mover.point(p));
	const index = core.positions.findIndex((p) => p.posX === oldX);
	assert(index >= 0);
	points[index].position = [newX, 4, 0];
	delete points[index].ownerBlock;
	const result = mover.move(core, core.key, ...original, ...points, {});
	const updated = mover.consumeUpdated();
	return {
		result,
		core: updated.length ? helper.getCore(world, updated[0]) : core,
	};
}
const first = install(new Core([rp(0), rp(20)], [20, 4, 0]));
const second = install(new Core([rp(20), rp(40)], [40, 4, 0]));
let a = moveEndpoint(first, 20, 21);
assert.equal(a.result, "ok");
const firstOwnerAtJoin = tiles.get("21,4,0").getRailCore();
assert.strictEqual(firstOwnerAtJoin, a.core);
let b = moveEndpoint(second, 20, 21);
assert.equal(
	b.result,
	"ok",
	"second rail must accept the first rail roadbed at their shared endpoint",
);
assert.strictEqual(
	tiles.get("21,4,0").getRailCore(),
	a.core,
	"second movement preserves first owner",
);
assert.equal(
	b.core.section,
	false,
	"foreign split owner uses safe normal fallback",
);
assert.deepEqual(
	b.core.positions.map((p) => p.posX).sort((x, y) => x - y),
	[21, 40],
);
b = moveEndpoint(b.core, 21, 20);
assert.equal(b.result, "ok");
a = moveEndpoint(a.core, 21, 20);
assert.equal(
	a.result,
	"ok",
	"reverse Undo order also permits connected roadbeds",
);
assert.deepEqual(
	a.core.positions.map((p) => p.posX).sort((x, y) => x - y),
	[0, 20],
);
assert.deepEqual(
	b.core.positions.map((p) => p.posX).sort((x, y) => x - y),
	[20, 40],
);
// Both actual candidate core owners occupied by unrelated rails: reject before deletion.
const foreign1 = install(new Core([rp(5), rp(15)], [5, 4, 0], false));
const foreign2 = install(new Core([rp(45), rp(55)], [45, 4, 0], false));
const source = install(new Core([rp(60), rp(80)], [80, 4, 0]));
const count = breaks;
assert.equal(
	mover.move(
		source,
		source.key,
		[60, 4, 0],
		[80, 4, 0],
		{ ...mover.point(rp(5)), ownerBlock: [5, 4, 0] },
		{ ...mover.point(rp(45)), ownerBlock: [45, 4, 0] },
		{},
	),
	"rail_overlap",
);
assert.equal(breaks, count);
assert.strictEqual(tiles.get("80,4,0"), source);
assert.strictEqual(tiles.get("5,4,0"), foreign1);
assert.strictEqual(tiles.get("45,4,0"), foreign2);
console.log(
	"AppleExtended connected endpoint movement, reverse Undo and protected-owner tests passed",
);
