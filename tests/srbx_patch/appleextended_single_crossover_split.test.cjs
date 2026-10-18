const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const root = process.env.SRBX_TEST_DIST || "dist/assets/minecraft/";
const source = fs.readFileSync(
	root +
		"__targets__/appleextended/scripts/superrailbuilderx/AppleExtendedRailToolsCompat.js",
	"utf8",
);
class SwitchCore {}
class Position {
	constructor(x, y, z, direction, switchType) {
		Object.assign(this, {
			blockX: x,
			blockY: y,
			blockZ: z,
			direction,
			switchType,
			posX: x + 0.5,
			posY: y,
			posZ: z + 0.5,
			anchorYaw: 0,
			anchorPitch: 0,
			anchorLengthHorizontal: 5,
			anchorLengthVertical: 0,
		});
	}
	setPosition(x, y, z) {
		this.posX = x;
		this.posY = y;
		this.posZ = z;
		this.offsetX = x - this.blockX;
		this.offsetZ = z - this.blockZ;
	}
	writeToNBT() {
		const n = { ...this };
		n.setByte = (key, value) => (n.switchType = value);
		n.func_74774_a = n.setByte;
		return n;
	}
	static readFromNBT(n) {
		return Object.assign(new Position(), n);
	}
}
class RailMap {
	getRailBlockList() {
		const blocks = [];
		for (let x = -2; x < 50; x++)
			for (let z = -2; z < 9; z++) blocks.push([x, 4, z]);
		return { size: () => blocks.length, get: (i) => blocks[i] };
	}
}
const map = new RailMap();
const context = vm.createContext({
	exports: {},
	TileEntityLargeRailSwitchCore: SwitchCore,
	TileEntityLargeRailCore: SwitchCore,
	RailPosition: Position,
	RailMapBasic: RailMap,
	RailMaker: class {
		getSwitch() {
			return { getAllRailMap: () => [map, map] };
		}
	},
	ArrayList: class {
		add() {}
	},
	BlockPos: class {
		constructor(x, y, z) {
			Object.assign(this, { x, y, z });
		}
	},
	ItemRail: {
		getDefaultProperty: () => ({ readFromNBT() {}, autoSplit: true }),
	},
	UUID: { randomUUID: () => ({ toString: () => "token" }) },
	NGTLog: { debug() {} },
});
context.Packages = {
	java: { util: { ArrayList: context.ArrayList, UUID: context.UUID } },
	jp: {
		ngt: {
			rtm: {
				item: { ItemRail: context.ItemRail },
				rail: {
					TileEntityLargeRailCore: SwitchCore,
					TileEntityLargeRailSwitchCore: SwitchCore,
					util: {
						RailPosition: Position,
						RailMaker: context.RailMaker,
						RailMapBasic: RailMap,
					},
				},
			},
			ngtlib: { io: { NGTLog: context.NGTLog } },
		},
	},
	net: { minecraft: { util: { math: { BlockPos: context.BlockPos } } } },
};
vm.runInContext(source, context);
const tools = context.AppleExtendedRailToolsCompat;
const rp = (x, z) => new Position(x, 4, z, 0, 0);
const point = (x, z, anchorYaw = 0) => ({
	anchorYaw,
	kind: "free",
	ownerBlock: [x, 4, z],
	position: [x + 0.5, 4, z + 0.5],
	direction: 0,
});
const plan = {
	switches: [
		[point(0, 0, 90), point(10, 0, -90), point(10, 3, -90)],
		[point(20, 5, -90), point(10, 5, 90), point(10, 3, 90)],
	],
	normals: [
		[point(20, 0, -90), point(10, 0, 90)],
		[point(0, 5, 90), point(10, 5, -90)],
	],
};
tools.getSingleCrossoverSplitPlan = () => JSON.parse(JSON.stringify(plan));
tools.connectedEndpoints = () => [];
let created = [],
	removed = [],
	failAt = -1,
	occupied = false,
	changed = false,
	load = true,
	blocked = false,
	restores = 0;
const core = new SwitchCore();
Object.assign(core, {
	isLogicalRailOccupied: () => occupied,
	getResourceState: () => ({ writeToNBT: () => ({}) }),
	getSignal: () => 7,
	subRails: { size: () => 1, get: () => "sub" },
	getPos: () => ({ getX: () => 0, getY: () => 4, getZ: () => 0 }),
});
const compat = {
	coreKey: () => (changed ? "changed" : "source"),
	getLogicalPositions: () => [rp(0, 0), rp(20, 0), rp(20, 5), rp(0, 5)],
	resolveBuilderPoint: (_w, p) => {
		const r = rp(
			p.ownerBlock ? p.ownerBlock[0] : Math.floor(p.position[0]),
			p.ownerBlock ? p.ownerBlock[2] : Math.floor(p.position[2]),
		);
		r.posX = p.position[0];
		r.posZ = p.position[2];
		r.anchorYaw = p.anchorYaw;
		return r;
	},
	planCreation: (_w, g, property) =>
		blocked ? null : { root: g.length === 2 ? g[1] : g[0] },
	cloneRailPosition: (p) => Object.assign(new Position(), p),
	undoNormalRail: (_w, p, key) => {
		removed.push(key);
		return "ok";
	},
	createFromPositions: (_w, _p, g, property) => {
		if (g.length === 4) {
			restores++;
			return { core: [0, 4, 0], key: "restored" };
		}
		if (created.length === failAt) return null;
		const r = {
			core: [
				g[g.length === 2 ? 1 : 0].blockX,
				4,
				g[g.length === 2 ? 1 : 0].blockZ,
			],
			key: "new" + created.length,
		};
		created.push({ g, property, r });
		return r;
	},
	getCore: () => ({
		setSignal(v) {
			assert.equal(v, 7);
		},
		addSubRail(v) {
			assert.equal(v, "sub");
		},
		markDirty() {},
		func_70296_d() {},
		sendPacket() {},
	}),
	validateUndoNormalRail: () => "ok",
};
context.AppleExtendedRailCompat = compat;
const world = { isBlockLoaded: () => load, getTileEntity: () => null };
world.func_175667_e = world.isBlockLoaded;
world.func_175625_s = world.getTileEntity;
core.func_174877_v = () => ({
	func_177958_n: () => 0,
	func_177956_o: () => 4,
	func_177952_p: () => 0,
});
function reset() {
	created = [];
	removed = [];
	failAt = -1;
	occupied = changed = blocked = false;
	load = true;
	restores = 0;
}
reset();
assert.equal(
	tools.splitSingleCrossover(world, {}, core, "source").status,
	"ok",
);
assert.equal(created.length, 4);
assert.deepEqual(
	created.map((c) => c.g.length),
	[3, 3, 2, 2],
);
assert.deepEqual(
	created.map((c) => Array.from(c.r.core)),
	[
		[0, 4, 0],
		[20, 4, 5],
		[20, 4, 0],
		[0, 4, 5],
	],
);
assert.equal(created[2].property.autoSplit, false);
assert.equal(created[3].property.autoSplit, false);
const auxiliary = created
	.flatMap((c) => c.g.filter((_p, i) => i !== (c.g.length === 2 ? 1 : 0)))
	.map((p) => [p.blockX, p.blockY, p.blockZ].join(","));
assert.equal(new Set(auxiliary).size, auxiliary.length);
for (const c of created)
	for (const [i, p] of c.g.entries()) {
		if (i === (c.g.length === 2 ? 1 : 0)) continue;
		assert.equal(p.blockX + p.offsetX, p.posX);
		assert.equal(p.blockZ + p.offsetZ, p.posZ);
	}
for (let i = 0; i < 2; i++) {
	const branch = created[i].g[2];
	assert.ok(
		(branch.blockX + 0.5 - branch.posX) *
			Math.sin((branch.anchorYaw * Math.PI) / 180) >=
			-0.001,
	);
}
assert.equal(tools.undoSplitBuilderRail(world, {}, "token"), "undo_ok");
assert.equal(restores, 1);
assert.deepEqual(removed, ["source", "new3", "new2", "new1", "new0"]);
for (const [flag, status] of [
	["occupied", "rail_occupied"],
	["changed", "rail_changed"],
	["blocked", "core_conflict"],
	["load", "path_unloaded"],
]) {
	reset();
	if (flag === "occupied") occupied = true;
	if (flag === "changed") changed = true;
	if (flag === "blocked") blocked = true;
	if (flag === "load") load = false;
	assert.equal(
		tools.splitSingleCrossover(world, {}, core, "source").status,
		status,
	);
	assert.equal(removed.length, 0);
}
reset();
failAt = 2;
assert.equal(
	tools.splitSingleCrossover(world, {}, core, "source").status,
	"create_failed",
);
assert.equal(restores, 1);
assert.equal(removed.length, 3);
console.log("AE single crossover split transaction tests passed");
