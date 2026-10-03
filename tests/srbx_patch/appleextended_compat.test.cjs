const fs = require("fs");
const vm = require("vm");
const path = require("path");
const assert = require("assert");
const root = "dist/assets/minecraft/__targets__/appleextended/scripts";
class ArrayList {
	constructor() {
		this.values = [];
	}
	add(value) {
		this.values.push(value);
	}
	get(index) {
		return this.values[index];
	}
}
class RailMapBasic {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}
}
class SectionCore {}
class Thread {
	constructor(task) {
		this.task = task;
	}
	setDaemon() {}
	start() {
		this.task();
	}
}
const messages = [];
let scheduled = false;
const context = {
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		java: { util: { ArrayList }, lang: { Thread } },
		jp: {
			ngt: {
				ngtlib: {
					io: {
						NGTLog: { debug: (message) => messages.push(message) },
					},
				},
				rtm: {
					rail: {
						BlockMarker: { createRail: () => false },
						util: { RailMapBasic },
					},
				},
			},
			apple: { rail: { TileEntityLargeRailSectionCore: SectionCore } },
		},
		net: {
			minecraft: {
				client: {
					Minecraft: {
						func_71410_x: () => ({
							func_152343_a(task) {
								scheduled = true;
								task();
							},
						}),
					},
				},
			},
		},
	},
};
vm.createContext(context);
function load(relative) {
	vm.runInContext(
		fs.readFileSync(path.join(root, relative), "utf8"),
		context,
	);
}
function loadCompat(dir, prefix) {
	load(
		`${dir}/${fs.readdirSync(path.join(root, dir)).find((name) => name.startsWith(prefix) && name.endsWith(".compat.js"))}`,
	);
}
load("superrailbuilderx/AppleExtendedRailCompat.js");
loadCompat("superrailbuilderx", "SRBXApiCompat.");
const api = Object.values(context.RTMX_COMPAT_TARGETS.appleextended)[0]
	.SRBXApiCompat;
const helper = context.AppleExtendedRailCompat;
const positions = [
	{ blockX: 1, blockY: 4, blockZ: 2, posY: 4 },
	{ blockX: 1, blockY: 4, blockZ: 82, posY: 4 },
];
for (const section of [new SectionCore(), new SectionCore()]) {
	section.getLogicalRailPositions = () => positions;
	section.getAllRailMaps = () => {
		throw new Error("physical section maps must not be used");
	};
	const map = api.getLogicalRailMap(section);
	assert.strictEqual(map.start, positions[0]);
	assert.strictEqual(map.end, positions[1]);
}
assert.strictEqual(api.getLogicalRailMap(null), null);
assert.strictEqual(
	api.getLogicalRailMap({ getLogicalRailPositions: () => null }),
	null,
);
assert.strictEqual(
	api.getLogicalRailMap({ getLogicalRailPositions: () => [null, null] }),
	null,
);
const core = {
	func_174877_v: () => ({
		func_177958_n: () => 1,
		func_177956_o: () => 4,
		func_177952_p: () => 2,
	}),
};
helper.coreKey = () => "created";
helper.isSectionCore = () => true;
let cores = [null, core];
helper.getCore = () => cores.shift();
const player = { field_71075_bZ: { field_75098_d: true } };
assert.strictEqual(
	helper.createFromPositions({}, player, positions, {}).key,
	"created",
);
assert(
	messages.some((message) =>
		message.includes("creation confirmed: apiResult=false"),
	),
);
for (const pair of [
	[null, null],
	[core, core],
]) {
	cores = pair.slice();
	assert.strictEqual(
		helper.createFromPositions({}, player, positions, {}),
		null,
	);
}
loadCompat("srbx_patch", "platform.");
const platform = Object.values(context.RTMX_COMPAT_TARGETS.appleextended).find(
	(value) => value.SRBXPatchPlatform,
).SRBXPatchPlatform;
platform.isReady = () => true;
let ran = false;
platform.scheduleWhenReady(
	() => {
		ran = true;
	},
	(error) => {
		throw error;
	},
);
assert(
	scheduled && ran,
	"bootstrap must schedule using the SRG Callable overload",
);
console.log("AppleExtended creation, logical hover and bootstrap tests passed");
