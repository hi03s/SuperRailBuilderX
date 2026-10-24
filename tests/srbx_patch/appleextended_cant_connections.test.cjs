const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
class RailBase {
	getRailCore() {
		return this;
	}
}
class SwitchCore extends RailBase {}
class SectionCore extends RailBase {}
const list = (values) => ({ size: () => values.length, get: (i) => values[i] });
let cores = [],
	removed = 0,
	uuid = 0;
const helper = {
	cloneRailPosition: (rp) => ({ ...rp }),
	coreKey: (core) => core.key,
	getLogicalPositions: (core) => core.positions,
	getCore: (_world, pos) => cores.find((core) => core.id === pos[0]) || null,
	isSectionCore: () => false,
	validateUndoNormalRail: (_world, pos, key) => {
		const core = helper.getCore(null, pos);
		return core && core.key === key ? "ok" : "undo_rail_changed";
	},
	undoNormalRail: () => {
		removed++;
		return "ok";
	},
};
const context = {
	AppleExtendedRailCompat: helper,
	Packages: {
		jp: {
			ngt: {
				rtm: {
					rail: {
						TileEntityLargeRailBase: RailBase,
						TileEntityLargeRailSwitchCore: SwitchCore,
					},
				},
			},
			apple: {
				appleextended: {
					rail: { TileEntityLargeRailSectionCore: SectionCore },
				},
			},
		},
		java: {
			util: {
				UUID: {
					randomUUID: () => ({ toString: () => `token-${++uuid}` }),
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
	context.AppleExtendedRailCompat.areBoundaryPositions = () => true;
vm.runInContext(
	fs.readFileSync(
		"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx/AppleExtendedRailToolsCompat.js",
		"utf8",
	),
	context,
);
const tools = context.AppleExtendedRailToolsCompat;
function rp(x, yaw) {
	return {
		posX: x,
		posY: 4,
		posZ: 0,
		anchorYaw: yaw,
		cantEdge: 0,
		cantCenter: 0,
		cantRandom: 0,
		getNeighborBlockPos: () => ({}),
	};
}
function core(id, key, positions) {
	return Object.assign(new RailBase(), {
		id,
		key,
		positions,
		func_174877_v: () => ({
			func_177958_n: () => id,
			func_177956_o: () => 4,
			func_177952_p: () => 0,
		}),
		isLogicalRailOccupied: () => false,
		setRailPositions(values) {
			this.positions = values;
		},
		createRailMap() {},
		func_70296_d() {},
		sendPacket() {},
	});
}
const source = core(1, "section:source", [rp(0, 0), rp(30, 180)]);
const sourceOtherSection = core(2, source.key, source.positions);
const neighbor = core(3, "section:neighbor", [rp(0, 180), rp(-30, 0)]);
const sameOrientation = core(4, "core:other", [rp(0, 0), rp(60, 180)]);
cores = [source, sourceOtherSection, neighbor, sameOrientation];
const loaded = list(cores);
const world = {
	func_175625_s: () => sourceOtherSection,
	loadedTileEntityList: loaded,
	field_147482_g: loaded,
};
const target = {
	core: [1, 4, 0],
	railKey: source.key,
	index: 0,
	position: [0, 4, 0],
	angle: 5,
	yaw: 0,
	mode: "edge",
};
const result = tools.applyRailCants(world, [target]);
assert.equal(result.status, "ok");
assert.equal(
	source.positions[0].cantEdge,
	5,
	"another section of the same logical rail must not invert the selected endpoint",
);
assert.equal(
	neighbor.positions[0].cantEdge,
	-5,
	"opposite endpoint orientation reverses cant",
);
assert.equal(
	sameOrientation.positions[0].cantEdge,
	5,
	"same endpoint orientation preserves cant",
);
assert.equal(
	tools.cantUndoRecords[result.undoToken].length,
	3,
	"each logical rail is saved exactly once",
);
assert.equal(tools.undoRailCants(world, result.undoToken), "undo_ok");
assert.equal(neighbor.positions[0].cantEdge, 0);
const center = tools.applyRailCants(world, [
	{ ...target, mode: "center", index: -1, position: [15, 4, 0], angle: 3 },
]);
assert.equal(center.status, "ok", "center is not an endpoint index");
assert.equal(source.positions[0].cantCenter, 3);
assert.equal(source.positions[1].cantCenter, 3);
assert.equal(source.positions[0].cantEdge, 0);
assert.equal(
	neighbor.positions[0].cantCenter,
	0,
	"center only updates the selected rail",
);
const beforeBoundaryReject = JSON.stringify(
	cores.map((core) => core.positions),
);
helper.areBoundaryPositions = () => false;
assert.equal(
	tools.applyRailCants(world, [target]).status,
	"endpoint_not_on_block_boundary",
);
assert.equal(
	JSON.stringify(cores.map((core) => core.positions)),
	beforeBoundaryReject,
	"boundary rejection leaves every connected rail untouched",
);
assert.equal(tools.consumeLastCantClientUpdate().length, 0);
helper.areBoundaryPositions = () => true;

tools.splitUndoRecords.branch = {
	created: [{ core: [1, 4, 0], key: source.key }],
	cants: [
		{
			core: [3, 4, 0],
			railKey: "previous-neighbor",
			positions: neighbor.positions,
		},
	],
};
assert.equal(
	tools.undoSplitBuilderRail(world, {}, "branch"),
	"undo_rail_changed",
);
assert.equal(
	removed,
	0,
	"external cant validation must precede deleting replacements",
);
assert(tools.splitUndoRecords.branch, "failed Undo remains available");
class Compound {
	constructor() {
		this.tags = {};
	}
	func_74775_l(key) {
		return this.tags[key];
	}
	func_74782_a(key, value) {
		this.tags[key] = value;
	}
}
context.Packages.net = { minecraft: { nbt: { NBTTagCompound: Compound } } };
const sectionA = Object.assign(
	new SectionCore(),
	core(11, "section:group", [rp(0, 0), rp(30, 180)]),
);
const sectionB = Object.assign(
	new SectionCore(),
	core(12, sectionA.key, [rp(0, 0), rp(30, 180)]),
);
cores = [sectionA, sectionB];
helper.isSectionCore = (value) => value instanceof SectionCore;
for (const section of cores) {
	section.getRailGroupCorePositions = () =>
		list([
			[11, 4, 0],
			[12, 4, 0],
		]);
	section.func_145831_w = () => world;
	section.writeSectionData = (nbt) => {
		nbt.tags.RailSection = new Compound();
	};
	section.readSectionData = (nbt) => {
		const data = nbt.tags.RailSection.tags;
		section.positions = [data.LogicalStartRP, data.LogicalEndRP];
	};
	for (const position of section.positions)
		position.writeToNBT = function () {
			return { ...this };
		};
}
const updated = sectionA.positions.map((position) => ({
	...position,
	cantEdge: 4,
	cantCenter: 2,
}));
assert.equal(tools.updateCants(world, sectionA, updated).length, 2);
assert.equal(
	sectionB.positions[0].cantEdge,
	4,
	"cant NBT reaches every physical section member",
);
assert.equal(sectionB.positions[1].cantCenter, 2);
console.log("AppleExtended cant connections: passed");

// Exercise the real split geometry and replacement transaction for interior branches.
class Position {
	constructor(x, y, z, direction = 2) {
		Object.assign(this, {
			blockX: x,
			blockY: y,
			blockZ: z,
			direction,
			posX: x,
			posY: y,
			posZ: z,
			anchorYaw: 90,
			anchorPitch: 0,
			anchorLengthHorizontal: 40 / 3,
			cantEdge: 0,
			cantCenter: 0,
			cantRandom: 0,
		});
	}
	setPosition(x, y, z) {
		this.posX = x;
		this.posY = y;
		this.posZ = z;
	}
	getNeighborBlockPos() {
		return {};
	}
}
context.Packages.jp.ngt.rtm.rail.util = { RailPosition: Position };
helper.cloneRailPosition = (rp) => Object.assign(new Position(), rp);
context.Packages.jp.ngt.ngtlib = { io: { NGTLog: { debug() {} } } };
helper.normalizeDegrees = (yaw) => ((yaw % 360) + 360) % 360;
helper.isSectionCore = () => false;
const dynamic = { size: () => cores.length, get: (i) => cores[i] };
const branchWorld = {
	...world,
	func_175625_s: () => null,
	loadedTileEntityList: dynamic,
	field_147482_g: dynamic,
};
const originalSwitchPosition = tools.switchPosition;
tools.switchPosition = (rp, type) => ({
	...rp,
	switchType: type,
	cantEdge: 0,
	cantCenter: 0,
	cantRandom: 0,
});
const originalRestore = tools.restoreRecord;
let calls, failedCreation, failedRemoval;
helper.getLogicalRailMap = () => ({
	getLength: () => 40,
	getRailPos: (n, i) => [0, (40 * i) / n],
	getRailHeight: () => 4,
	getCant: () => 0,
	getRailPitch: () => 0,
});
helper.undoNormalRail = (_world, pos, expected) => {
	const validation = helper.validateUndoNormalRail(null, pos, expected);
	if (validation !== "ok") return validation;
	if (expected === failedRemoval) return "rail_occupied";
	cores = cores.filter((item) => item.key !== expected);
	return "ok";
};
helper.createFromPositions = (_world, _player, positions) => {
	calls.push(positions.map((rp) => ({ ...rp })));
	if (calls.length === failedCreation) return null;
	const id = 100 + calls.length;
	const item = core(id, `replacement-${id}`, positions);
	item.setSignal = () => {};
	item.addSubRail = () => {};
	cores.push(item);
	return { core: [id, 4, 0], key: item.key };
};
function interiorBranch(toStart, failure = 0) {
	calls = [];
	failedCreation = failure;
	failedRemoval = null;
	const start = new Position(0, 4, 0),
		end = new Position(40, 4, 0);
	end.anchorYaw = 270;
	const source = core(1, "original", [start, end]);
	source.getResourceState = () => ({});
	source.getSignal = () => 0;
	source.subRails = list([]);
	const external = core(3, "external", [
		new Position(0, 4, 0),
		new Position(-20, 4, 0),
	]);
	external.positions[0].cantEdge = 5;
	cores = [source, external];
	const branchEnd = new Position(toStart ? 5 : 35, 4, 10);
	const result = tools.splitBuilderRail(
		branchWorld,
		{},
		[1, 4, 0],
		source.key,
		0.5,
		{
			request: {
				branchEnd: { kind: "free", position: [branchEnd.posX, 4, 10] },
			},
			end: branchEnd,
			property: {},
		},
	);
	return { result, external };
}
for (const direction of [true, false]) {
	const { result, external } = interiorBranch(direction);
	assert.equal(result.status, "ok");
	assert.equal(
		calls.length,
		2,
		"no temporary split half is created and deleted",
	);
	assert.equal(
		calls[0].length,
		3,
		"switch reserves its root before the retained half",
	);
	assert.equal(calls[0][0].posX, 20);
	assert.equal(calls[0][1].posX, direction ? 0 : 40);
	assert.equal(calls[1].length, 2);
	const record = tools.splitUndoRecords[result.undoToken];
	assert.deepEqual(
		Array.from(record.cants, (item) => item.railKey),
		["external"],
		"only original external connections enter cant Undo",
	);
	assert.equal(
		cores.filter((item) => item.key.startsWith("replacement")).length,
		2,
	);
	assert.equal(external.positions[0].cantEdge, 0);
	assert.equal(
		tools.undoBranchBuilderRail(branchWorld, {}, result.undoToken),
		"undo_ok",
	);
	assert.equal(external.positions[0].cantEdge, 5);
	assert.equal(
		cores.length,
		2,
		"Undo removes both final replacements and restores the original",
	);
}
for (const failure of [1, 2]) {
	const { result, external } = interiorBranch(true, failure);
	assert.equal(result.status, "create_failed");
	const rollbackUpdate = tools.consumeLastSplitClientUpdate();
	assert(
		rollbackUpdate,
		"failed generation must synchronize restored rail geometry",
	);
	assert(rollbackUpdate.removed.some((rail) => rail.key === "original"));
	assert.equal(rollbackUpdate.refreshed.length, 1);
	assert.equal(external.positions[0].cantEdge, 5);
	assert.equal(
		cores.length,
		2,
		"failed generation restores original and keeps its neighbor",
	);
	assert.equal(
		cores.filter((item) => item.key.startsWith("replacement")).length,
		1,
	);
}
// A replacement changed by another action must never be deleted during rollback.
interiorBranch(true);
const record = { created: [{ core: [101, 4, 0], key: "previous-key" }] };
const beforeRollback = cores.slice(),
	beforeCalls = calls.length;
assert.equal(tools.rollbackBranch(branchWorld, {}, record), false);
assert.deepEqual(cores, beforeRollback);
assert.equal(
	calls.length,
	beforeCalls,
	"blocked cleanup must not attempt original restoration",
);
tools.switchPosition = originalSwitchPosition;
tools.restoreRecord = originalRestore;
console.log(
	"AppleExtended interior branch generation, Undo and rollback: passed",
);

// Client-only fields are removed from dedicated-server rail cores.
for (const sectioned of [false, true]) {
	const member = sectioned
		? Object.assign(
				new SectionCore(),
				core(99, "guard", [rp(0, 0), rp(20, 180)]),
			)
		: core(99, "guard", [rp(0, 0), rp(20, 180)]);
	let clientWrites = 0,
		maps = 0,
		dirty = 0,
		packets = 0;
	const sideWorld = { field_72995_K: false };
	Object.defineProperty(member, "shouldRerenderRail", {
		set(value) {
			assert(
				sideWorld.field_72995_K,
				"Server must never write a client-only render field",
			);
			assert.equal(value, true);
			clientWrites++;
		},
	});
	member.getRailGroupCorePositions = () => list([[99, 4, 0]]);
	member.writeSectionData = (nbt) => {
		nbt.tags.RailSection = new Compound();
	};
	member.readSectionData = () => {};
	member.createRailMap = () => maps++;
	member.func_70296_d = () => dirty++;
	member.sendPacket = () => packets++;
	helper.getCore = () => member;
	helper.getLogicalPositions = (c) => c.positions;
	helper.isSectionCore = () => sectioned;
	for (const position of member.positions)
		position.writeToNBT = function () {
			return { ...this };
		};
	tools.updateCants(sideWorld, member, member.positions);
	assert.equal(clientWrites, 0);
	sideWorld.field_72995_K = true;
	tools.updateCants(sideWorld, member, member.positions);
	assert.equal(clientWrites, 1);
	assert.deepEqual([maps, dirty, packets], [2, 2, 2]);
}
console.log(
	"AE normal/section cant updates keep server synchronization without client fields",
);
