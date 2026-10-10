const fs = require("fs"),
	path = require("path"),
	vm = require("vm"),
	assert = require("assert");
class RailBase {
	constructor(owner = null) {
		this.owner = owner;
		this.writes = 0;
	}
	getStartPoint() {
		return this.start || [-1, -1, -1];
	}
	getRailCore() {
		return this.owner;
	}
	setStartPoint(...pos) {
		this.writes++;
		this.start = pos;
	}
	func_70296_d() {}
}
class RailCore extends RailBase {}
class RailBlock {
	isCore() {
		return false;
	}
}
class RailPosition {
	constructor(x, y, z, direction) {
		this.blockX = x;
		this.blockY = y;
		this.blockZ = z;
		this.direction = direction;
	}
	static REVISION = Array.from({ length: 8 }, (_, i) => [
		Math.sin((i * Math.PI) / 4),
		Math.cos((i * Math.PI) / 4),
	]);
	static readFromNBT(nbt) {
		return Object.assign(new RailPosition(), nbt);
	}
	writeToNBT() {
		return { ...this };
	}
	setPosition(x, y, z) {
		this.posX = x;
		this.posY = y;
		this.posZ = z;
	}
}
const context = {
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		jp: {
			ngt: {
				ngtlib: { io: { NGTLog: { debug() {} } } },
				rtm: {
					RTMRail: { largeRailBase0: new RailBlock() },
					rail: {
						TileEntityLargeRailBase: RailBase,
						TileEntityLargeRailCore: RailCore,
						BlockLargeRailBase: RailBlock,
						BlockMarker: class {},
						util: { RailPosition },
					},
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
const directory =
	"dist/assets/minecraft/__targets__/kaizpatch/scripts/superrailbuilderx";
vm.runInContext(
	fs.readFileSync(path.join(directory, "SRBXFreeEndpointPolicy.js"), "utf8"),
	context,
);
const file = fs
	.readdirSync(directory)
	.find(
		(name) =>
			name.startsWith("SRBXApiCompat.") && name.endsWith(".compat.js"),
	);
vm.runInContext(fs.readFileSync(path.join(directory, file), "utf8"), context);
const api = Object.values(context.RTMX_COMPAT_TARGETS.kaizpatch)[0]
	.SRBXApiCompat;
assert.equal(api.usesGeometryRailHighlight(), true);
api.getRailPositionUnsupportedReason = () => "";
for (const index of [0, 1])
	for (const angle of [-5, 0, 5]) {
		const positions = [0, 1].map((i) =>
			Object.assign(new RailPosition(), {
				blockX: i * 20,
				blockY: 4,
				blockZ: 0,
				posX: i * 20 + 0.5,
				posY: 4.0625,
				posZ: 0.5,
				direction: i * 4,
				anchorYaw: i * 180,
				anchorPitch: 2,
				cantEdge: angle,
				cantCenter: 3,
			}),
		);
		const before = positions.map((rp) => JSON.stringify(rp));
		const core = new RailCore();
		core.owner = core;
		api.getEditableRailPositions = () => positions;
		const source = positions[index];
		const target = api.resolveBuilderRailPoint(
			{ func_147438_o: () => core },
			{
				core: [0, 4, 0],
				index,
				position: [source.posX, source.posY, source.posZ],
				anchorYaw: api.normalizeDegrees(source.anchorYaw + 180),
				anchorPitch: -source.anchorPitch,
			},
		);
		assert(target);
		assert.equal(target.cantEdge, -angle);
		assert.equal(target.cantCenter, 3);
		assert.equal(target.direction, (source.direction + 4) & 7);
		assert.equal(
			JSON.stringify(positions[index]),
			before[index],
			"connection resolution must not mutate existing endpoints",
		);
		assert.notStrictEqual(target, source);
	}
const pos = [10, 4, 20];
api.getBuilderRoadbedBlocks = () => [pos];
api.getRailPositionCandidateKey = (core) => core.key;
api.isBuilderEndpointRoadbed = () => true;
const owner = Object.assign(new RailCore(), { key: "foreign" });
for (const scenario of [
	"foreign",
	"protected",
	"ownerless",
	"endpoint",
	"overwrite",
	"core",
	"missing_tile",
]) {
	const existing =
		scenario === "missing_tile"
			? null
			: scenario === "core"
				? owner
				: new RailBase(scenario === "ownerless" ? null : owner);
	let sets = 0;
	const world = {
		func_147438_o: () => existing,
		func_147439_a: () => new RailBlock(),
		func_147465_d: () => {
			sets++;
			throw new Error("existing roadbed must be retained");
		},
	};
	assert.equal(
		api.placeBuilderRoadbed(
			world,
			{},
			0,
			4,
			0,
			{},
			scenario === "protected" ? { foreign: true } : {},
			true,
			scenario === "endpoint" ? pos : undefined,
			scenario === "overwrite",
		),
		0,
		scenario,
	);
	assert.equal(sets, 0, scenario);
	if (existing)
		assert.equal(
			existing.writes,
			0,
			`${scenario}: ownership must remain unchanged`,
		);
}
let added = null,
	sets = 0;
const world = {
	func_147438_o: () => added,
	func_147439_a: () => ({}),
	func_72805_g: () => 0,
	func_147437_c: () => !added,
	func_147465_d: () => {
		sets++;
		added = new RailBase();
		return true;
	},
};
assert.equal(
	api.placeBuilderRoadbed(world, {}, 1, 4, 2, {}, {}, false, undefined, true),
	0,
);
assert.equal(sets, 1);
assert.deepEqual(added.start, [1, 4, 2]);
assert.equal(added.writes, 1);
const blockList = { size: () => 1, get: () => pos };
const occupiedWorld = {
	func_147437_c: () => false,
	func_147439_a: () => new RailBlock(),
	func_147465_d: () => {
		throw new Error("air-only paths must retain occupied roadbeds");
	},
};
assert.equal(
	api.placeRoadbedInAir(
		occupiedWorld,
		{ getRailBlockList: () => blockList },
		1,
		4,
		2,
		{},
		"test",
	),
	true,
);
api.getCoreWorld = () => occupiedWorld;
api.addMissingRoadbed({
	getRailMap: () => ({ getRailBlockList: () => blockList }),
	getProperty: () => ({}),
});
console.log(
	"KaizPatch roadbed ownership and reversed endpoint cant tests passed",
);

// Experimental branch requires the server hook before any world mutation.
assert.equal(api.requiresRailBoundarySnap(), false);
assert.equal(
	api.validateRailPositionMove({}, 0, 0, 0, 0, 0, 0, 0),
	"srbxmod_required",
);
assert.equal(api.createBuilderRail({}, {}, {}, {}).status, "srbxmod_required");
api.hasFreeEndpointPatch = () => true;
// Interior points are preserved after capability validation.
api.canMoveRailPosition = () => true;
api.isSectionCore = () => false;
context.Packages.jp.ngt.rtm.rail.TileEntityLargeRailSwitchCore = class {};
const boundaryPositions = [0, 1].map((i) =>
	Object.assign(new RailPosition(), {
		blockX: 0,
		blockY: 4,
		blockZ: i * 20,
		posX: 0.35,
		posY: 4.0625,
		posZ: i * 20,
		anchorYaw: i * 180,
		direction: i * 4,
	}),
);
api.getEditableRailPositions = () => boundaryPositions;
api.validateBuilderMovePath = (_, positions) => {
	assert.equal(positions[0].blockZ, 2);
	assert.equal(positions[0].posZ === 2 || positions[0].posZ === 2.3, true);
	return "ok";
};
const movable = { isLogicalRailOccupied: () => false };
assert.equal(
	api.validateRailPositionMove(movable, 0, 0.35, 4.0625, 0, 0.35, 4.0625, 2),
	"ok",
);
assert.equal(
	api.validateRailPositionMove(
		movable,
		0,
		0.35,
		4.0625,
		0,
		0.35,
		4.0625,
		2.3,
	),
	"ok",
);
api.validateBuilderMovePath = () => "ok";
assert.equal(
	api.validateRailPositionMove(
		movable,
		0,
		0.35,
		4.0625,
		0,
		0.35,
		4.0625,
		2.3,
		true,
	),
	"ok",
	"Undo must restore pre-existing interior endpoint exactly",
);
const railPoint = {
	kind: "rail",
	position: [0.35, 4.0625, 0.3],
	markerPosition: [0, 4, 0],
	anchorYaw: 0,
	anchorPitch: 0,
	anchorLength: 1,
	core: [0, 4, 0],
	index: 0,
};
const freePoint = {
	...railPoint,
	kind: "free",
	position: [0.35, 4.0625, 20.3],
};
api.hasFreeEndpointPatch = () => false;
assert.equal(
	api.createBuilderRail({}, {}, railPoint, freePoint).status,
	"srbxmod_required",
	"Missing server hook blocks free-point creation before writes",
);
api.hasFreeEndpointPatch = () => true;
console.log(
	"KaizPatch free-point validation and capability guard tests passed",
);

const angledBoundary = {
	kind: "free",
	position: [12, 4.0625, 20.35],
	markerPosition: [12, 4, 20],
	ownerBlock: [12, 4, 20],
	direction: 1,
	anchorYaw: 45,
	anchorPitch: 0,
	anchorLength: 1,
};
const freshBoundary = api.createBuilderFreePoint(angledBoundary);
assert.equal(
	freshBoundary.direction,
	2,
	"A single X face must use native east/west direction even with diagonal tangent",
);
assert.equal(
	freshBoundary.anchorYaw,
	45,
	"Native direction adaptation must retain the curve tangent",
);
assert.equal(
	api.createBuilderFreePoint(angledBoundary, true).direction,
	1,
	"Undo must retain original direction",
);

const storedPoint = {
	...angledBoundary,
	position: [0.35, 4.0625, 2.3],
	ownerBlock: [-8, 4, 13],
	direction: 7,
};
api.validateBuilderMovePath = (_, restored) => {
	assert.deepEqual(
		Array.from([
			restored[0].blockX,
			restored[0].blockY,
			restored[0].blockZ,
		]),
		[-8, 4, 13],
	);
	assert.equal(restored[0].direction, 7);
	return "ok";
};
assert.equal(
	api.validateRailPositionMove(
		movable,
		0,
		0.35,
		4.0625,
		0,
		0.35,
		4.0625,
		2.3,
		true,
		storedPoint,
	),
	"ok",
	"Endpoint Undo validation must use the stored owner and direction rather than the moved rail's metadata",
);
