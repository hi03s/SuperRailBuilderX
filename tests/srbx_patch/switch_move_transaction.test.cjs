const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const source = fs.readFileSync(dir + "server_rail_mover.js", "utf8");
class Base {
	getRailCore() {
		return this;
	}
}
class WeakMap extends Map {
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
const normal = new Base(),
	sw = new Base();
normal.key = "normal";
sw.key = "switch";
normal.core = [10, 4, 0];
sw.core = [20, 4, 0];
const tiles = new Map([
	[normal.core.join(), normal],
	[sw.core.join(), sw],
]);
const reset = () => {
	for (const c of [normal, sw]) c.positions = [{ posX: 0, posY: 4, posZ: 0 }];
};
reset();
let calls = [],
	moved = [],
	fail = true,
	throws = false;
const api = {
	getWorld: () => ({}),
	getTileEntity: (_w, x, y, z) => tiles.get([x, y, z].join()),
	getLoadedRailCores: () => [normal, sw],
	getRailPositionCandidateKey: (c) => c.key,
	getRailCorePos: (c) => c.core,
	getEditableRailPositions: (c) => c.positions,
	getRailPositionUnsupportedReason: (c) => (c === sw ? "switch" : ""),
	validateRailPositionMove: () => "ok",
	consumeLastRailPositionMoveCores: () => {
		const r = moved;
		moved = [];
		return r;
	},
	moveRailPosition: (c, _i, _x, _y, _z, x, y, z, _p, undo) => {
		calls.push([c.key, !!undo]);
		moved = [c.core];
		if (c === normal && fail && !undo) {
			if (throws) throw Error("native failure");
			return "rail_overlap";
		}
		c.positions = [{ posX: x, posY: y, posZ: z }];
		return "ok";
	},
};
const ctx = vm.createContext({
	Packages: {
		java: { util: { WeakHashMap: WeakMap } },
		jp: {
			ngt: {
				rtm: { rail: { TileEntityLargeRailBase: Base } },
				ngtlib: { io: { NGTLog: { debug() {} } } },
			},
		},
		net: { minecraft: { entity: { player: { EntityPlayer: class {} } } } },
	},
	NGTOBuilderUtil: {
		resetJsonData: (d, k) => delete d[k],
		sendJsonData: (d, k, v) => (d[k] = JSON.parse(JSON.stringify(v))),
	},
});
ctx[source.match(/(RTMX_COMPAT_\w+)\.SRBXApiCompat/)[1]] = {
	SRBXApiCompat: api,
};
vm.runInContext(source, ctx);
ctx.snapshotEndpoint = () => ({
	kind: "free",
	position: [0, 4, 0],
	ownerBlock: [0, 3, 0],
	markerPosition: [0, 4, 0],
	direction: 0,
	anchorYaw: 0,
	anchorPitch: 0,
	anchorLength: 1,
});
const data = {},
	entity = { getResourceState: () => ({ getDataMap: () => data }) };
const request = {
	action: "move",
	mode: "endpoint",
	destination: [1, 4, 0],
	targets: [normal, sw].map((c) => ({
		core: c.core,
		railKey: c.key,
		index: 0,
		original: [0, 4, 0],
	})),
};
const previous = { operations: [] };
ctx.undoRecords.put(entity, previous);
assert.equal(
	ctx.applyRequest(entity, {}, request),
	"target_1:rail_overlap:rolled_back",
);
assert.deepEqual(calls, [
	["switch", false],
	["normal", false],
	["switch", true],
]);
assert.equal(sw.positions[0].posX, 0);
assert.equal(normal.positions[0].posX, 0);
assert.equal(
	ctx.undoRecords.get(entity),
	previous,
	"previous Undo survives failed transaction",
);
assert(data.railPositionUpdatedCores.some((p) => p[0] === 10));
assert(data.railPositionUpdatedCores.some((p) => p[0] === 20));
calls = [];
throws = true;
assert.equal(
	ctx.applyRequest(entity, {}, request),
	"target_1:internal_error:rolled_back",
);
assert.equal(sw.positions[0].posX, 0);
calls = [];
fail = false;
assert.equal(ctx.applyRequest(entity, {}, request), "ok");
assert.deepEqual(calls, [
	["switch", false],
	["normal", false],
]);
assert.equal(ctx.applyUndo(entity, {}, data), "undo_ok");
assert.equal(sw.positions[0].posX, 0);
assert.equal(normal.positions[0].posX, 0);
// Delayed NBT arrival must invalidate a same-position switch cache again.
const client = fs.readFileSync(dir + "render_rail_mover.js", "utf8");
const start = client.indexOf("function retrySwitchRefresh("),
	end = client.indexOf("\n}", start) + 2;
let refreshes = 0,
	exists = false;
const clientContext = vm.createContext({
	TileEntityLargeRailBase: Base,
	Packages: {
		jp: { ngt: { rtm: { rail: { TileEntityLargeRailBase: Base } } } },
	},
});
clientContext[client.match(/(RTMX_COMPAT_\w+)\.SRBXApiCompat/)[1]] = {
	SRBXApiCompat: {
		...api,
		getTileEntity: () => (exists ? sw : null),
		refreshRailCoreClient: () => refreshes++,
	},
};
vm.runInContext(client.slice(start, end), clientContext);
const state = {
		switchRefresh: [{ core: sw.core, nextTick: 2, untilTick: 100 }],
	},
	e = { field_70173_aa: 0 };
clientContext.retrySwitchRefresh(e, state);
assert.equal(refreshes, 0);
e.field_70173_aa = 2;
clientContext.retrySwitchRefresh(e, state);
assert.equal(refreshes, 0);
exists = true;
e.field_70173_aa = 12;
clientContext.retrySwitchRefresh(e, state);
assert.equal(refreshes, 1);
clientContext.retrySwitchRefresh(e, state);
assert.equal(refreshes, 1, "multiple render passes do not repeat refresh");
e.field_70173_aa = 22;
clientContext.retrySwitchRefresh(e, state);
assert.equal(refreshes, 2);
e.field_70173_aa = 101;
clientContext.retrySwitchRefresh(e, state);
assert.equal(state.switchRefresh.length, 0);
console.log(
	"Switch-first connected endpoint transaction, failure rollback/Undo retention and bounded late-packet refresh passed",
);
