const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
class SwitchCore {}
class BlockPos {
	constructor(x, y, z) {
		this.position = [x, y, z];
	}
}
const property = () => ({
	writeToNBT() {
		return {};
	},
	readFromNBT() {},
});
const messages = [];
const clone = (rp) => ({ ...rp });
const coordinate = (rp) => [rp.posX, rp.posY, rp.posZ];
let current;
let attempts;
let failures;
let breaks;
const world = { func_175667_e: () => true };
function makeCore(positions, key) {
	return {
		positions,
		key,
		section: true,
		func_145831_w: () => world,
		func_174877_v: () => ({
			func_177958_n: () => 1,
			func_177956_o: () => 4,
			func_177952_p: () => 2,
		}),
		isLogicalRailOccupied: () => false,
		getRailGroupCorePositions: () => ({
			size: () => 1,
			get: () => [1, 4, 2],
		}),
		getResourceState: property,
		getSignal: () => 3,
		subRails: { size: () => 1, get: property },
		setSignal(value) {
			this.signal = value;
		},
		addSubRail(value) {
			this.savedSubRails = (this.savedSubRails || []).concat(value);
		},
		func_70296_d() {},
		sendPacket() {},
		breakLogicalRail() {
			breaks++;
			current = null;
		},
	};
}
const helper = {
	coreKey: (core) => core.key,
	getCore: (_world, position) => (position[0] === 9 ? null : current),
	getLogicalPositions: (core) => core.positions,
	isSectionCore: (core) => core.section,
	cloneRailPosition: clone,
	resolveBuilderPoint: (_world, point) => ({
		posX: point.position[0],
		posY: point.position[1],
		posZ: point.position[2],
		blockX: Math.floor(point.position[0]),
		blockY: 4,
		blockZ: 2,
	}),
	createFromPositions(_world, _player, positions) {
		attempts.push(Array.from(positions, coordinate));
		if (failures-- > 0) return null;
		current = makeCore(positions.map(clone), `rebuilt:${attempts.length}`);
		return { core: [1, 4, 2], key: current.key };
	},
};
const context = {
	AppleExtendedRailCompat: helper,
	Packages: {
		jp: {
			ngt: {
				rtm: {
					rail: { TileEntityLargeRailSwitchCore: SwitchCore },
					item: { ItemRail: { getDefaultProperty: property } },
				},
				ngtlib: {
					io: {
						NGTLog: { debug: (message) => messages.push(message) },
					},
				},
			},
		},
		net: { minecraft: { util: { math: { BlockPos } } } },
	},
};
vm.createContext(context);
vm.runInContext(
	fs.readFileSync(
		"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx/AppleExtendedRailMoveCompat.js",
		"utf8",
	),
	context,
);
const api = context.AppleExtendedRailMoveCompat;
const original = [
	{ posX: 1, posY: 4, posZ: 2 },
	{ posX: 25, posY: 4, posZ: 2 },
];
const point = (x) => ({
	kind: "free",
	position: [x, 4, 2],
	anchorYaw: 90,
	anchorPitch: 0,
	anchorLength: 4,
});
function reset(failedAttempts = 0) {
	current = makeCore(original.map(clone), "source");
	attempts = [];
	failures = failedAttempts;
	breaks = 0;
}
function move() {
	return api.move(
		current,
		"source",
		[1, 4, 2],
		[25, 4, 2],
		point(2),
		point(26),
		{},
	);
}
reset();
assert.strictEqual(move(), "ok");
assert.strictEqual(breaks, 1);
assert.deepStrictEqual(attempts[0], [
	[2, 4, 2],
	[26, 4, 2],
]);
assert.strictEqual(current.signal, 3);
assert.strictEqual(current.savedSubRails.length, 1);
assert.strictEqual(api.consumeUpdated().length, 1);

reset();
current.section = false;
assert.strictEqual(move(), "ok");
assert.strictEqual(breaks, 1);

reset();
current.getRailGroupCorePositions = () => ({
	size: () => 2,
	get: (index) => (index === 0 ? [1, 4, 2] : [9, 4, 2]),
});
assert.strictEqual(move(), "rail_changed");
assert.strictEqual(breaks, 0);

reset(1);
assert.strictEqual(move(), "move_failed_rolled_back");
assert.deepStrictEqual(attempts[1], original.map(coordinate));
assert.strictEqual(current.signal, 3);
assert.strictEqual(api.consumeUpdated().length, 1);
reset(2);
assert.strictEqual(move(), "move_failed_rollback_failed");
assert.strictEqual(current, null);

reset();
current.isLogicalRailOccupied = () => true;
assert.strictEqual(move(), "occupied");
assert.strictEqual(breaks, 0);
reset();
current.key = "changed";
assert.strictEqual(move(), "rail_changed");
assert.strictEqual(breaks, 0);
reset();
current.positions[0].posX = 99;
assert.strictEqual(move(), "rail_changed");
assert.strictEqual(breaks, 0);
console.log("AppleExtended logical rail move and rollback tests passed");
