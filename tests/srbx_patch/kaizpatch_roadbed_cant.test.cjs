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
const directory =
	"dist/assets/minecraft/__targets__/kaizpatch/scripts/superrailbuilderx";
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
