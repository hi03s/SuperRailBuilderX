const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const root = process.env.SRBX_TEST_DIST || "dist/assets/minecraft/";
const read = (path) => fs.readFileSync(root + path, "utf8");
class RailBase {
	getRailCore() {
		return this;
	}
}
let loaded = [];
const tiles = { size: () => loaded.length, get: (i) => loaded[i] };
const world = { loadedTileEntityList: tiles, field_147482_g: tiles };
const context = vm.createContext({
	TileEntityLargeRailBase: RailBase,
	TileEntityLargeRailSwitchCore: class SwitchCore {},
	UUID: { randomUUID: () => ({ toString: () => "token" }) },
	Packages: {
		java: {
			util: { UUID: { randomUUID: () => ({ toString: () => "token" }) } },
		},
	},
});
context.Packages.jp = {
	ngt: {
		rtm: {
			rail: {
				TileEntityLargeRailBase: RailBase,
				TileEntityLargeRailSwitchCore:
					context.TileEntityLargeRailSwitchCore,
			},
		},
		ngtlib: { io: { NGTLog: { debug() {} } } },
	},
};
context.NGTLog = context.Packages.jp.ngt.ngtlib.io.NGTLog;
vm.runInContext(
	read("scripts/superrailbuilderx/SRBXCrossoverValidation.js").replace(
		/^.*(?:require\(|include <).*$/gm,
		"",
	),
	context,
);
let source = read(
	"__targets__/appleextended/scripts/superrailbuilderx/AppleExtendedRailToolsCompat.js",
);
vm.runInContext(
	source.slice(source.indexOf("var AppleExtendedRailToolsCompat =")),
	context,
);
const tools = context.AppleExtendedRailToolsCompat;
const point = (x, z, yaw) => ({
	kind: "free",
	position: [x, 4, z],
	markerPosition: [x, 4, z],
	direction: yaw === 0 ? 0 : 4,
	anchorYaw: yaw,
	anchorPitch: 0,
	anchorLength: 10,
	anchorLengthVertical: 10,
});
const plan = () => ({
	points: [
		point(0, 0, 0),
		point(0, 40, 180),
		point(4, 0, 0),
		point(4, 40, 180),
	],
	switchTypes: [1, 1, 1, 1],
});
let removed = [],
	created = [],
	restored = 0,
	conflict = false,
	fail = false,
	occupied = false;
const property = { autoSplit: true },
	subRail = { name: "sub" };
const positions = [
	{
		posX: 0,
		posY: 4,
		posZ: 0,
		anchorYaw: 0,
		anchorLengthHorizontal: 10,
		anchorLengthVertical: 10,
	},
	{
		posX: 0,
		posY: 4,
		posZ: 40,
		anchorYaw: 180,
		anchorLengthHorizontal: 10,
		anchorLengthVertical: 10,
	},
];
const sourceCore = {
	key: "source",
	positions,
	subRails: { size: () => 1, get: () => subRail },
	getResourceState: () => property,
	getSignal: () => 7,
	isLogicalRailOccupied: () => occupied,
};
const madeCore = {
	setSignal(value) {
		this.signal = value;
	},
	addSubRail(value) {
		this.sub = value;
	},
	markDirty() {},
	func_70296_d() {},
	sendPacket() {},
};
const switchCore = Object.assign(new context.TileEntityLargeRailSwitchCore(), {
	key: "switch",
	positions: [{ posX: 4, posY: 4, posZ: 0 }],
	isLogicalRailOccupied: () => occupied,
});
const helper = (context.AppleExtendedRailCompat = {
	normalizeDegrees: (a) => ((a + 540) % 360) - 180,
	getCore: (_world, pos) =>
		pos[0] === 99 ? sourceCore : pos[0] === 100 ? switchCore : madeCore,
	coreKey: (core) => core.key,
	getLogicalPositions: (core) => core.positions,
	getLogicalRailMap: () => ({ getRailPitch: () => 0 }),
	cloneRailPosition: (rp) => ({ ...rp }),
	propertyFromPlayer: () => property,
	resolveBuilderPoint: (_world, p) => ({
		posX: p.position[0],
		posY: p.position[1],
		posZ: p.position[2],
		anchorPitch: p.anchorPitch,
	}),
	planCreation: () => (conflict ? null : {}),
	createFromPositions: (_world, _player, rps, prop) => {
		created.push({ rps, prop });
		return fail ? null : { core: [1, 0, 0], key: "made" };
	},
	undoNormalRail: (_world, pos, key) => {
		removed.push(key);
		return "ok";
	},
	validateUndoNormalRail: () => (occupied ? "rail_occupied" : "ok"),
});
tools.switchPosition = (rp, type) => ({ ...rp, switchType: type });
tools.connectedEndpoints = () => [];
tools.restoreRecord = () => {
	restored++;
	return { core: [99, 0, 0], key: "restored" };
};
function existing(p = plan()) {
	p.source = {
		core: [99, 0, 0],
		railKey: "source",
		startPosition: [0, 4, 0],
		endPosition: [0, 4, 40],
	};
	return p;
}

// Dedicated placement tests exercise rollback. Here verify authoritative source
// validation, minimum native length and routing for all three native layouts.
let nativeLength = 40,
	planned = [];
context.RailMapBasic = class {
	getLength() {
		return nativeLength;
	}
};
context.Packages.jp.ngt.rtm.rail.util = { RailMapBasic: context.RailMapBasic };
context.SRBXSingleCrossoverSplit = {
	fromPoints(points, mask) {
		return { kind: "single", points, mask };
	},
	scissorsFromPoints(points) {
		return { kind: "scissors", points };
	},
};
tools.createSplitCrossover = (_w, _p, plan, record, prepare, retainUndo) => {
	assert.equal(retainUndo, false);
	planned.push({ plan, record });
	return { status: "ok" };
};
for (const mask of [
	[1, 0, 0, 1],
	[0, 1, 1, 0],
	[1, 1, 1, 1],
]) {
	const input = plan();
	input.switchTypes = mask;
	assert.equal(
		tools.createCrossoverBuilderRail(world, {}, input).status,
		"ok",
	);
	assert.equal(
		planned.at(-1).plan.kind,
		mask.every((x) => x === 1) ? "scissors" : "single",
	);
	assert.equal(
		tools.undoCrossoverBuilderRail(world, {}, "token"),
		"undo_disabled",
	);
}
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, existing()).status,
	"ok",
);
assert.equal(planned.at(-1).record.signal, 7);
assert.equal(planned.at(-1).record.subRails[0], subRail);
const count = planned.length;
const stale = existing();
stale.points[0].anchorLength = 11;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, stale).status,
	"rail_changed",
);
occupied = true;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, existing()).status,
	"rail_occupied",
);
occupied = false;
nativeLength = 19;
assert.equal(
	tools.createCrossoverBuilderRail(world, {}, plan()).status,
	"rail_too_short",
);
assert.equal(planned.length, count);
assert.equal(removed.length, 0);
console.log(
	"AE crossover authoritative source, minimum length, divided layout routing and disabled Undo passed",
);
