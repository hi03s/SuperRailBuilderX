const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const source = fs.readFileSync(
	"dist/assets/minecraft/scripts/superrailbuilderx/server_rail_mover.js",
	"utf8",
);
class RailBase {
	getRailCore() {
		return this;
	}
}
class WeakHashMap extends Map {
	get(k) {
		return super.get(k) || null;
	}
	put(k, v) {
		this.set(k, v);
	}
	remove(k) {
		this.delete(k);
	}
}
const tiles = new Map();
const old = new RailBase();
old.key = "old";
tiles.set("0,4,0", old);
const restored = new RailBase();
restored.key = "restored";
let moved = [],
	fail = true;
const sent = {};
const api = {
	getWorld: () => ({}),
	getTileEntity: (_w, x, y, z) => tiles.get([x, y, z].join(",")),
	getLoadedRailCores: () => Array.from(tiles.values()),
	getRailPositionCandidateKey: (c) => c.key,
	moveRailPosition: () => {
		if (fail) {
			tiles.clear();
			tiles.set("16,4,0", restored);
			moved = [[16, 4, 0]];
			return "move_failed_rolled_back";
		}
		moved = [[16, 4, 0]];
		return "ok_sectioned";
	},
	consumeLastRailPositionMoveCores: () => moved,
};
const context = {
	Packages: {
		java: { util: { WeakHashMap } },
		jp: {
			ngt: {
				rtm: { rail: { TileEntityLargeRailBase: RailBase } },
				ngtlib: { io: { NGTLog: { debug() {} } } },
			},
		},
		net: { minecraft: { entity: { player: { EntityPlayer: class {} } } } },
	},
	NGTOBuilderUtil: {
		sendJsonData: (_d, k, v) => (sent[k] = JSON.parse(JSON.stringify(v))),
	},
};
const name = source.match(/(RTMX_COMPAT_\w+)\.SRBXApiCompat/)[1];
context[name] = { SRBXApiCompat: api };
vm.createContext(context);
vm.runInContext(source, context);
const entity = {};
const operation = {
	mode: "endpoint",
	core: [0, 4, 0],
	railKey: "old",
	index: 0,
	original: [1, 4, 0],
	destination: [0, 4, 0],
};
context.undoRecords.put(entity, { operations: [operation] });
assert.strictEqual(
	context.applyUndo(entity, {}, {}),
	"undo_0:move_failed_rolled_back",
);
assert.deepStrictEqual(sent.railPositionRemovedRails, [
	{ core: [0, 4, 0], key: "old" },
]);
assert.deepStrictEqual(sent.railPositionUpdatedCores, [[16, 4, 0]]);
assert.strictEqual(operation.railKey, "restored");
assert.deepStrictEqual(operation.core, [16, 4, 0]);
fail = false;
assert.strictEqual(context.applyUndo(entity, {}, {}), "undo_ok");
assert.strictEqual(context.undoRecords.get(entity), null);
console.log("Rail mover rollback synchronization and Undo retry tests passed");
