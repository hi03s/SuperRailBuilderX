const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
class RailBlock {}
class NBT {}
class Base {
	getStartPoint() {
		return [10, 4, 10];
	}
	getRailCore() {
		return this;
	}
}
class Core extends Base {
	isLogicalRailOccupied() {
		return this.occupied || false;
	}
	getProperty() {
		return this.property;
	}
	getSignal() {
		return 7;
	}
}
class SwitchCore extends Core {}
class List extends Array {
	size() {
		return this.length;
	}
	get(i) {
		return this[i];
	}
	add(v) {
		this.push(v);
	}
}
class Maker {
	constructor(w, p) {
		this.positions = p;
	}
	getSwitch() {
		return { getAllRailMap: () => [{ positions: this.positions }] };
	}
}
class Basic {
	constructor(a, b) {
		this.a = a;
		this.b = b;
	}
	getLength() {
		return Math.hypot(this.a.posX - this.b.posX, this.a.posZ - this.b.posZ);
	}
}
const context = vm.createContext({
	RTMX_COMPAT_TARGETS: {},
	java: {
		util: { UUID: { randomUUID: () => ({ toString: () => "token" }) } },
	},
	Packages: {
		net: { minecraft: { nbt: { NBTTagCompound: NBT } } },
		java: { util: { ArrayList: List } },
		jp: {
			ngt: {
				ngtlib: { io: { NGTLog: { debug() {} } } },
				rtm: {
					RTMConfig: { railGeneratingDistance: 64 },
					block: { BlockLargeRailBase: RailBlock },
					rail: {
						TileEntityLargeRailBase: Base,
						TileEntityLargeRailCore: Core,
						TileEntityLargeRailSwitchCore: SwitchCore,
						BlockLargeRailBase: RailBlock,
						util: { RailMaker: Maker, RailMapBasic: Basic },
					},
				},
			},
		},
	},
});
Basic.fixRTMRailMapVersionCurrent = 1;
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

api.toRailPositionArray = (p) => p;
api.getBuilderRoadbedBlocks = () => [
	[11, 4, 10],
	[12, 4, 10],
	[13, 4, 10],
];
api.restorePromotedRoadbed = () => {
	throw new Error("no promotions expected");
};
for (const replace of [false, true]) {
	const original = { name: "original" },
		foreign = new Base();
	let restoredNBT = null,
		updates = 0;
	const oldTile = {
		func_145841_b(n) {
			n.value = 123;
		},
	};
	const cells = new Map([
		["11,4,10", { block: original, metadata: 7, tile: oldTile }],
		["12,4,10", { block: new RailBlock(), metadata: 0, tile: foreign }],
	]);
	const at = (p) => cells.get(p.join(","));
	const world = {
		func_147438_o: (...p) => at(p)?.tile || null,
		func_147439_a: (...p) => at(p)?.block || original,
		func_72805_g: (...p) => at(p)?.metadata || 0,
		func_147437_c: (...p) => !at(p),
		func_147465_d(x, y, z, block, metadata) {
			cells.set([x, y, z].join(","), {
				block,
				metadata,
				tile: {
					func_145839_a(n) {
						restoredNBT = n.value;
					},
					func_70296_d() {},
				},
			});
		},
		func_147471_g() {
			updates++;
		},
	};
	const replacement = {
		block: { name: "replacement" },
		metadata: 2,
		tile: {},
	};
	api.placeBuilderRoadbed = (
		_w,
		_map,
		_x,
		_y,
		_z,
		_prop,
		_protected,
		_section,
		_a,
		_overwrite,
		onPlaced,
	) => {
		const placed = new Base();
		cells.set("11,4,10", {
			block: new RailBlock(),
			metadata: 0,
			tile: placed,
		});
		onPlaced([11, 4, 10], placed);
		if (replace) cells.set("11,4,10", replacement);
		throw new Error("injected placement failure");
	};
	assert.throws(
		() =>
			api.createBuilderBasicSwitch(
				world,
				[
					{ blockX: 10, blockY: 4, blockZ: 10 },
					{ blockX: 20, blockY: 4, blockZ: 20 },
				],
				{},
				[],
			),
		/injected placement failure/,
	);
	assert.strictEqual(cells.get("12,4,10").tile, foreign);
	if (replace) {
		assert.strictEqual(cells.get("11,4,10"), replacement);
		assert.strictEqual(updates, 0);
	} else {
		assert.strictEqual(cells.get("11,4,10").block, original);
		assert.strictEqual(cells.get("11,4,10").metadata, 7);
		assert.strictEqual(restoredNBT, 123);
		assert.strictEqual(updates, 1);
	}
}
console.log(
	"Kaiz switch placement failure restores non-rail block/NBT and preserves foreign rails/replacements",
);
