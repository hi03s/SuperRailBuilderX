const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const directory =
	"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx";
const tiles = new Map();
const blocks = new Set();
class RailCore {
	constructor(pos, key) {
		this.pos = pos;
		this.key = key;
		this.deleted = 0;
		this.invalid = false;
		this.glLists = ["old-display-list"];
	}
	func_174877_v() {
		return this.pos;
	}
	breakLogicalRail() {
		throw new Error(
			"Client ghost cleanup must never delete shared rail beds",
		);
	}
	func_145837_r() {
		return this.invalid;
	}
	func_145843_s() {
		this.invalid = true;
		this.glLists = [];
		this.deleted++;
	}
	getRailGroupCorePositions() {
		return {
			size: () => 2,
			get: (i) =>
				[
					[16, 4, 0],
					[32, 4, 0],
				][i],
		};
	}
}
const context = {
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		java: {
			util: {
				WeakHashMap: class {
					constructor() {
						this.values = new WeakMap();
					}
					containsKey(key) {
						return this.values.has(key);
					}
					put(key, value) {
						this.values.set(key, value);
					}
				},
			},
		},
		jp: {
			ngt: {
				ngtlib: { io: { NGTLog: { debug() {} } } },
				rtm: {
					rail: {
						TileEntityLargeRailCore: RailCore,
						TileEntityLargeRailSwitchCore: class extends RailCore {},
					},
				},
			},
		},
	},
	AppleExtendedRailCompat: {
		getCore: (_w, pos) => tiles.get(pos.join(",")) || null,
		coreKey: (c) => c.key,
		isSectionCore: (c) => c.key === "old",
	},
};
vm.createContext(context);
const filename = fs
	.readdirSync(directory)
	.find((n) => n.startsWith("SRBXApiCompat.") && n.endsWith(".compat.js"));
vm.runInContext(
	fs.readFileSync(path.join(directory, filename), "utf8"),
	context,
);
const api = Object.values(context.RTMX_COMPAT_TARGETS.appleextended)[0]
	.SRBXApiCompat;
assert.strictEqual(api.needsRailClientGhostRetry("section:old"), true);
assert.strictEqual(api.needsRailClientGhostRetry("core:0,4,0"), false);
const replacement = new RailCore("0,4,0", "new");
const old1 = new RailCore("16,4,0", "old"),
	old2 = new RailCore("32,4,0", "old");
const stale = new RailCore("0,4,0", "old");
// old2 is in the chunk map but is not yet in the loaded tile list.
const loaded = [replacement, old1, stale];
const world = {
	field_72995_K: true,
	field_147482_g: { size: () => loaded.length, get: (i) => loaded[i] },
	func_175625_s: (pos) => tiles.get(pos),
	func_175713_t: () => {
		throw new Error("Tile-only removal leaves a recreatable core block");
	},
	func_175698_g: (pos) => {
		tiles.delete(pos);
		return blocks.delete(pos);
	},
	func_180495_p: () => ({}),
	func_184138_a() {},
};
for (const tile of [replacement, old1, old2]) {
	tiles.set(tile.pos, tile);
	blocks.add(tile.pos);
}
api.removeRailClientGhost(world, [0, 4, 0], "old");
assert.strictEqual(tiles.size, 1);
assert.deepStrictEqual(
	[...blocks],
	[replacement.pos],
	"old blocks cannot recreate empty tile entities",
);
assert.strictEqual(tiles.get("0,4,0"), replacement);
assert.strictEqual(old1.deleted, 1);
assert.strictEqual(old2.deleted, 1);
assert.strictEqual(stale.deleted, 1);
assert.strictEqual(
	stale.glLists.length,
	0,
	"detached render references release their GL lists",
);
api.removeRailClientGhost(world, [0, 4, 0], "old");
assert.strictEqual(replacement.deleted, 0);
assert.strictEqual(
	stale.deleted,
	1,
	"retries do not repeatedly invalidate detached references",
);
const late = new RailCore("48,4,0", "old");
tiles.set(late.pos, late);
blocks.add(late.pos);
loaded.push(late);
api.removeRailClientGhost(world, [0, 4, 0], "old");
assert.strictEqual(
	tiles.has(late.pos),
	false,
	"bounded retry removes a late old-group packet",
);
assert.strictEqual(replacement.deleted, 0);
tiles.set(old1.pos, old1);
world.field_72995_K = false;
api.removeRailClientGhost(world, [0, 4, 0], "old");
assert.strictEqual(tiles.get(old1.pos), old1);
console.log("AppleExtended replaced-root ghost cleanup tests passed");
