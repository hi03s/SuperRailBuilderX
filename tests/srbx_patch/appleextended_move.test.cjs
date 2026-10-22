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
// Match the real Java final switchType field and its SwitchType NBT tag.
function serializedPosition(values, role = 0) {
	const position = { ...values };
	Object.defineProperty(position, "switchType", {
		value: role,
		enumerable: true,
	});
	position.writeToNBT = () => ({
		values: { ...position },
		role,
		func_74774_a(name, value) {
			assert.equal(name, "SwitchType");
			this.role = value;
		},
	});
	return position;
}
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
	breakRail: (_world, core) => core.breakLogicalRail(),
	coreKey: (core) => core.key,
	planCreation: () => ({}),
	getCore: (_world, position) => (position[0] === 9 ? null : current),
	getLogicalPositions: (core) => core.positions,
	isSectionCore: (core) => core.section,
	cloneRailPosition: clone,
	resolveBuilderPoint: (_world, point) =>
		serializedPosition({
			posX: point.position[0],
			posY: point.position[1],
			posZ: point.position[2],
			blockX: Math.floor(point.position[0]),
			blockY: 4,
			blockZ: 2,
			direction: point.direction,
			anchorYaw: point.anchorYaw,
			anchorPitch: point.anchorPitch,
			anchorLengthHorizontal: point.anchorLength,
			anchorLengthVertical:
				point.anchorLengthVertical ?? point.anchorLength,
			cantEdge: point.cantEdge,
			cantCenter: point.cantCenter,
			cantRandom: point.cantRandom,
		}),
	createFromPositions(_world, _player, positions) {
		attempts.push(Array.from(positions, coordinate));
		if (failures-- > 0) return null;
		current = makeCore(positions.map(clone), `rebuilt:${attempts.length}`);
		if (positions.length > 2) {
			Object.setPrototypeOf(current, SwitchCore.prototype);
			current.section = false;
		}
		return { core: [1, 4, 2], key: current.key };
	},
};
const context = {
	AppleExtendedRailCompat: helper,
	Packages: {
		jp: {
			ngt: {
				rtm: {
					rail: {
						TileEntityLargeRailSwitchCore: SwitchCore,
						util: {
							RailPosition: {
								readFromNBT: (nbt) =>
									serializedPosition(nbt.values, nbt.role),
							},
							RailMaker: class {
								constructor(_world, positions) {
									this.positions = positions;
								}
								getSwitch() {
									if (
										this.positions.filter(
											(rp) => rp.switchType === 1,
										).length !== 1
									)
										return null;
									return {
										getAllRailMap: () => [
											{
												getRailBlockList: () => ({
													size: () => 1,
													get: () => [99, 4, 2],
												}),
											},
										],
									};
								}
							},
							RailMapBasic: {},
						},
					},
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
		java: {
			util: {
				ArrayList: class extends Array {
					add(value) {
						this.push(value);
					}
				},
			},
		},
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

if (
	context.AppleExtendedRailCompat &&
	!context.AppleExtendedRailCompat.areBoundaryPositions
)
	context.AppleExtendedRailCompat.areBoundaryPositions = (positions) =>
		positions.every((rp) =>
			context.SRBXFreeEndpointPolicy.isBoundary(
				[rp.posX, rp.posY, rp.posZ],
				rp.anchorYaw === undefined ? 90 : rp.anchorYaw,
			),
		);
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

// The restored free-point policy preserves interior endpoints during apply and Undo.
reset();
const interiorMove = (preserve = false) =>
	api.move(
		current,
		"source",
		[1, 4, 2],
		[25, 4, 2],
		point(2.25),
		point(26.25),
		{},
		preserve,
	);
assert.strictEqual(interiorMove(), "ok");
assert.deepStrictEqual(attempts[0], [
	[2.25, 4, 2],
	[26.25, 4, 2],
]);

// Move the third switch endpoint without translating the other routes.
function resetSwitch(failedAttempts = 0) {
	reset(failedAttempts);
	current.positions = [1, 25, 31].map((x, index) => ({
		posX: x,
		posY: 4,
		posZ: 2,
		blockX: x,
		blockY: 4,
		blockZ: 2,
		direction: 2,
		anchorYaw: 90,
		anchorPitch: 0,
		anchorLengthHorizontal: 4,
		anchorLengthVertical: 4,
		cantEdge: index,
		cantCenter: 3,
		cantRandom: 0,
		switchType: index === 0 ? 1 : 0,
	}));
	Object.setPrototypeOf(current, SwitchCore.prototype);
	current.section = false;
}
function moveSwitch(x, preserve = false, index = 2) {
	const positions = current.positions;
	const destination = api.point(positions[index]);
	destination.position = [x, 4, 2];
	return api.move(
		current,
		current.key,
		coordinate(positions[0]),
		coordinate(positions[1]),
		api.point(positions[0]),
		api.point(positions[1]),
		{},
		preserve,
		{ index, point: destination },
	);
}
resetSwitch();
assert.strictEqual(
	move(),
	"unsupported",
	"whole-switch translation stays disabled",
);
assert.strictEqual(breaks, 0);
assert.strictEqual(moveSwitch(35), "ok");
assert.deepStrictEqual(attempts[0], [
	[1, 4, 2],
	[25, 4, 2],
	[35, 4, 2],
]);
assert.strictEqual(current.positions[0].switchType, 1);
assert.strictEqual(current.positions[2].switchType, 0);
assert.strictEqual(current.signal, 3);
assert.strictEqual(current.savedSubRails.length, 1);
assert.strictEqual(api.consumeUpdated().length, 1);
assert.strictEqual(
	moveSwitch(31, true),
	"ok",
	"Undo restores only the moved endpoint",
);
assert.deepStrictEqual(attempts[1], [
	[1, 4, 2],
	[25, 4, 2],
	[31, 4, 2],
]);
resetSwitch(1);
assert.strictEqual(moveSwitch(35), "move_failed_rolled_back");
assert.deepStrictEqual(attempts[1], [
	[1, 4, 2],
	[25, 4, 2],
	[31, 4, 2],
]);
assert.strictEqual(
	api.consumeUpdated().length,
	1,
	"rollback identity is synchronized",
);
resetSwitch();
world.func_175667_e = (pos) => pos.position[0] !== 99;
assert.strictEqual(moveSwitch(35), "path_unloaded");
assert.strictEqual(breaks, 0, "unloaded route cannot delete the source switch");
world.func_175667_e = () => true;
resetSwitch();
assert.strictEqual(
	moveSwitch(5, false, 0),
	"ok",
	"root role survives immutable Java field",
);
assert.strictEqual(current.positions[0].switchType, 1);
assert.deepStrictEqual(attempts[0], [
	[5, 4, 2],
	[25, 4, 2],
	[31, 4, 2],
]);
assert.strictEqual(
	moveSwitch(1, true, 0),
	"ok",
	"root Undo keeps the switch role",
);
assert.strictEqual(current.positions[0].switchType, 1);
resetSwitch();
current.positions[0].switchType = 0;
assert.strictEqual(moveSwitch(35), "invalid_switch");
assert.strictEqual(breaks, 0);
assert(
	messages.some((line) =>
		line.includes("switch validation failed: stage=layout"),
	),
);
console.log(
	"AppleExtended switch endpoint move, rollback, and Undo tests passed",
);
reset();
assert.strictEqual(interiorMove(true), "ok");
assert.deepStrictEqual(attempts[0], [
	[2.25, 4, 2],
	[26.25, 4, 2],
]);
