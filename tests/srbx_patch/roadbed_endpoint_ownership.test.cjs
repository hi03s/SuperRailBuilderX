const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
class Compound {
	constructor(values = {}) {
		this.values = values;
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
	func_82580_o(k) {
		delete this.values[k];
	}
}
const cores = new Map();
class Base {
	constructor(owner) {
		this.owner = owner;
		this.data = new Compound();
	}
	getStartPoint() {
		return this.owner;
	}
	getRailCore() {
		return cores.get(this.owner.join(",")) || null;
	}
	setStartPoint(...p) {
		this.owner = p;
	}
	func_70296_d() {}
}
class Core extends Base {
	constructor(owner, key) {
		super(owner);
		this.key = key;
		cores.set(owner.join(","), this);
	}
}
const context = {
	Packages: {
		jp: {
			ngt: {
				rtm: {
					rail: {
						TileEntityLargeRailBase: Base,
						TileEntityLargeRailCore: Core,
					},
				},
			},
		},
		net: { minecraft: { nbt: { NBTTagCompound: Compound } } },
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
const policy = context.SRBXRoadbedOwnership,
	keyOf = (c) => c.key;
const a = new Core([0, 4, 0], "a"),
	b = new Core([20, 4, 0], "b"),
	c = new Core([40, 4, 0], "c");
const roadbed = new Base(a.owner.slice());
const promotion = policy.capturePromotion(roadbed, 7, 0, keyOf, (_tile, nbt) =>
	nbt.func_74768_a("spX", 0),
);
assert.equal(promotion.func_74779_i("key"), "a");
policy.attachPromotion(b.data, promotion);
const secondPromotion = policy.capturePromotion(
	roadbed,
	7,
	1,
	keyOf,
	(_tile, nbt) => nbt.func_74768_a("spX", 0),
);
policy.attachPromotion(b.data, secondPromotion);
b.data = reload(b.data);
const promoted = policy.promotions(
	{ size: () => 2, get: (i) => (i ? b : a) },
	"b",
	keyOf,
	(c) => c.data,
);
assert.equal(
	promoted.length,
	2,
	"all promoted switch bases survive save/reload",
);
assert.equal(
	policy.capturePromotion(a, 7, 0, keyOf, () => {
		throw Error("must not write core");
	}),
	null,
);
const list = { size: () => 1, get: () => roadbed };
const release = (key) =>
	policy.release(
		list,
		key,
		(p) => cores.get(p.join(",")) || null,
		keyOf,
		(tile) => tile.data,
	);
function transfer(core) {
	policy.transfer(roadbed, core.owner, keyOf, roadbed.data);
}
transfer(b);
assert.equal(roadbed.getRailCore(), b);
assert.equal(
	policy.transfer(a, b.owner, keyOf, a.data),
	false,
	"Existing cores cannot be reassigned",
);
release("b");
assert.equal(
	roadbed.getRailCore(),
	a,
	"Moving/splitting/undoing B restores A before destructive deletion",
);
assert(!roadbed.data.func_74764_b("SRBXEndpointRoadbedLoan"));
transfer(b);
transfer(c);
release("c");
assert.equal(roadbed.getRailCore(), b);
release("b");
assert.equal(roadbed.getRailCore(), a);
transfer(b);
transfer(c);
cores.delete(b.owner.join(","));
release("c");
assert.equal(roadbed.getRailCore(), a, "Missing intermediate owner is skipped");
cores.set(b.owner.join(","), b);
transfer(b);
// Emulate unload/save/reload: metadata must not rely on a script's memory.
function reload(value) {
	if (value instanceof Compound)
		return new Compound(
			Object.fromEntries(
				Object.entries(value.values).map(([k, v]) => [k, reload(v)]),
			),
		);
	return value;
}
roadbed.data = reload(roadbed.data);
release("b");
assert.equal(roadbed.getRailCore(), a);
transfer(b);
cores.set(a.owner.join(","), new Core(a.owner, "replacement"));
release("b");
assert.equal(
	roadbed.getRailCore(),
	b,
	"Do not restore stale records to a different logical rail",
);
for (const [start, end] of [
	[
		[-0.2, 4.0625, 0.5],
		[-20.2, 4.0625, 0.5],
	],
	[
		[0, 4.0625, 0.5],
		[20, 4.0625, 0.5],
	],
	[
		[20, 4.0625, 0.5],
		[0, 4.0625, 0.5],
	],
]) {
	const map = {
		getLength: () => 20,
		getRailPos: (n, i) => [
			start[2],
			start[0] + ((end[0] - start[0]) * i) / n,
		],
		getRailHeight: () => 4.0625,
	};
	const tiles = Array.from(policy.endpointTiles(map), (p) => Array.from(p));
	assert.equal(tiles.length, 2);
	assert(tiles.every((p) => p[1] === 4 && p[2] === 0));
	if (start[0] === 0)
		assert.deepEqual(
			tiles,
			[
				[0, 4, 0],
				[19, 4, 0],
			],
			"Boundary endpoints use tiles inside the rail",
		);
	if (start[0] === 20)
		assert.deepEqual(tiles, [
			[19, 4, 0],
			[0, 4, 0],
		]);
}
console.log(
	"Endpoint ownership, core protection, stacked loans, save/reload and destructive-operation restoration passed",
);
