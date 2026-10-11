const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert"),
	path = require("path");
class Base {
	getRailCore() {
		return this;
	}
}
class Core extends Base {}
class Block {
	constructor(core = false) {
		this.core = core;
	}
	isCore() {
		return this.core;
	}
}
class MapBasic {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}
	getLength() {
		return Math.hypot(
			this.end.posX - this.start.posX,
			this.end.posY - this.start.posY,
			this.end.posZ - this.start.posZ,
		);
	}
	getStartRP() {
		return this.start;
	}
	getEndRP() {
		return this.end;
	}
}
const list = (a) => ({ size: () => a.length, get: (i) => a[i] });
const config = { railGeneratingDistance: 64 },
	messages = [];
const context = {
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		jp: {
			ngt: {
				ngtlib: { io: { NGTLog: { debug: (s) => messages.push(s) } } },
				rtm: {
					RTMConfig: config,
					rail: {
						TileEntityLargeRailBase: Base,
						TileEntityLargeRailCore: Core,
						BlockLargeRailBase: Block,
						util: { RailMapBasic: MapBasic },
					},
				},
			},
			kaiz: {
				kaizpatch: {
					rtm: {
						rail: {
							util: {
								RailMapSection: class extends MapBasic {
									constructor(_source, start, end) {
										super(start, end);
									}
								},
								RailChunkSectioner: {
									split: (map) =>
										list(
											[map.start, map.end].map((rp) => ({
												getStartRP: () => rp,
												getEndRP: () => map.end,
												getStartRatio: () => 0,
												getEndRatio: () => 1,
											})),
										),
								},
							},
						},
					},
				},
			},
		},
	},
};
vm.createContext(context);
const dir =
	"dist/assets/minecraft/__targets__/kaizpatch/scripts/superrailbuilderx";
vm.runInContext(
	fs.readFileSync(
		path.join(
			dir,
			fs
				.readdirSync(dir)
				.find(
					(n) =>
						n.startsWith("SRBXApiCompat.") &&
						n.endsWith(".compat.js"),
				),
		),
		"utf8",
	),
	context,
);
const api = Object.values(context.RTMX_COMPAT_TARGETS.kaizpatch)[0]
	.SRBXApiCompat;
const tiles = new Map(),
	world = {
		func_147465_d() {
			throw Error("Planning must not mutate the world");
		},
		func_72899_e: () => true,
		func_147438_o: (x, y, z) => tiles.get([x, y, z].join(",")) || null,
		func_147439_a: (x, y, z) =>
			new Block(tiles.get([x, y, z].join(",")) instanceof Core),
	};
const point = (x) => ({
	kind: "free",
	position: [x, 4.0625, 0.5],
	anchorLength: 1,
	anchorPitch: 0,
	anchorYaw: 90,
	direction: 2,
	markerPosition: [x, 4, 0],
});
const toRP = (p) => ({
	posX: p.position[0],
	posY: p.position[1],
	posZ: p.position[2],
	blockX: Math.floor(p.position[0]),
	blockY: 4,
	blockZ: 0,
	anchorYaw: p.anchorYaw,
	anchorPitch: 0,
	direction: 2,
});
let preparation = "reverse",
	attempts = [],
	created = [];
const resultCore = new Core();
Object.assign(api, {
	hasFreeEndpointPatch: () => true,
	validateBuilderPoint: () => "ok",
	createBuilderSourceProperty: () => null,
	createBuilderProperty: () => ({ autoSplit: true }),
	createBuilderFreePoint: toRP,
	getBuilderProtectedRailKeys: () => ({}),
	hasOnlyBuilderSectionCoreCrossings: () => false,
	prepareBuilderSectionCorePositions: (_w, map) => {
		attempts.push(map.start.posX);
		return preparation === "reverse" && map.start.posX > map.end.posX
			? "ok"
			: "section_core_conflict";
	},
	isBuilderRoadbedLoaded: () => true,
	validateBuilderPlacement: () => "ok",
	createBuilderSectionedRail: (_w, map) => {
		created.push({ mode: "section", map });
		return resultCore;
	},
	createBuilderNormalRail: (_w, map) => {
		created.push({ mode: "normal", map });
		return resultCore;
	},
	assignEndpointRoadbeds: () => {},
	getRailCorePos: () => [99, 4, 0],
	getRailPositionCandidateKey: () => "created",
	logBuilderTransitionState: () => {},
});
const generate = (length, force = false) =>
	api.createBuilderRail(
		world,
		{},
		point(0.35),
		point(length + 0.35),
		undefined,
		undefined,
		undefined,
		force,
		false,
		false,
		undefined,
		undefined,
		true,
	);
function reset() {
	attempts = [];
	created = [];
	tiles.clear();
}
reset();
assert.equal(generate(50).status, "ok");
assert.deepEqual(attempts, [0.35, 50.35]);
assert.equal(created[0].mode, "section");
assert.equal(created[0].map.start.posX, 50.35);
preparation = "blocked";
reset();
assert.equal(generate(50).status, "ok");
assert.equal(created[0].mode, "normal");
assert.equal(attempts.length, 2);
reset();
assert.equal(generate(70).status, "section_core_conflict");
assert.equal(
	created.length,
	0,
	"Both section plans fail: over-cap fallback must not mutate",
);
config.railGeneratingDistance = 96;
reset();
assert.equal(generate(80).status, "ok");
assert.equal(
	created[0].mode,
	"normal",
	"Use configured cap rather than hard-coded 64",
);
config.railGeneratingDistance = 64;
reset();
assert.equal(generate(80, true).status, "normal_rail_too_long");
assert.equal(created.length, 0);
reset();
tiles.set("0,4,0", new Core());
assert.equal(generate(20, true).status, "ok");
assert.equal(
	created[0].map.start.posX,
	20.35,
	"Normal core also chooses the unoccupied opposite endpoint",
);
reset();
tiles.set("0,4,0", new Core());
tiles.set("20,4,0", new Core());
assert.equal(generate(20, true).status, "section_core_conflict");
assert.equal(created.length, 0);
console.log(
	"KaizPatch reverse planning, configured normal fallback cap and occupied endpoint core protection passed",
);
