const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const directory =
	"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx";
const tiles = new Map();
class RailCore {
	constructor(pos, key) {
		this.pos = pos;
		this.key = key;
		this.deleted = 0;
	}
	func_174877_v() {
		return this.pos;
	}
	breakLogicalRail() {
		this.deleted++;
		for (const [pos, tile] of tiles)
			if (tile.key === this.key) tiles.delete(pos);
	}
}
const context = {
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		jp: {
			ngt: {
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
const replacement = new RailCore("0,4,0", "new");
const old1 = new RailCore("16,4,0", "old"),
	old2 = new RailCore("32,4,0", "old");
const stale = new RailCore("0,4,0", "old");
const loaded = [replacement, old1, old2, stale];
const world = {
	field_72995_K: true,
	field_147482_g: { size: () => loaded.length, get: (i) => loaded[i] },
	func_175625_s: (pos) => tiles.get(pos),
};
for (const tile of [replacement, old1, old2]) tiles.set(tile.pos, tile);
api.removeRailClientGhost(world, [0, 4, 0], "old");
assert.strictEqual(tiles.size, 1);
assert.strictEqual(tiles.get("0,4,0"), replacement);
assert.strictEqual(old1.deleted, 1);
assert.strictEqual(old2.deleted, 0);
assert.strictEqual(stale.deleted, 0);
api.removeRailClientGhost(world, [0, 4, 0], "old");
assert.strictEqual(replacement.deleted, 0);
tiles.set(old1.pos, old1);
world.field_72995_K = false;
api.removeRailClientGhost(world, [0, 4, 0], "old");
assert.strictEqual(tiles.get(old1.pos), old1);
console.log("AppleExtended replaced-root ghost cleanup tests passed");
