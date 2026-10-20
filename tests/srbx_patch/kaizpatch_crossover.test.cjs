const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
class Base {
	getRailCore() {
		return this;
	}
}
class Core extends Base {
	isLogicalRailOccupied() {
		return this.occupied || false;
	}
}
class SwitchCore extends Core {}
class List extends Array {
	add(v) {
		this.push(v);
	}
	size() {
		return this.length;
	}
	get(i) {
		return this[i];
	}
}
let nativeValid = true;
class Maker {
	getSwitch() {
		return nativeValid ? { getAllRailMap: () => [{}] } : null;
	}
}
const context = vm.createContext({
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		java: {
			util: {
				ArrayList: List,
				UUID: { randomUUID: () => ({ toString: () => "token" }) },
			},
		},
		jp: {
			ngt: {
				ngtlib: { io: { NGTLog: { debug() {} } } },
				rtm: {
					rail: {
						TileEntityLargeRailBase: Base,
						TileEntityLargeRailCore: Core,
						TileEntityLargeRailSwitchCore: SwitchCore,
						util: {
							RailMaker: Maker,
							RailMapBasic: { fixRTMRailMapVersionCurrent: 1 },
						},
					},
				},
			},
		},
	},
});
context.java = context.Packages.java;
const root = "dist/assets/minecraft/";
vm.runInContext(
	fs.readFileSync(
		root + "scripts/superrailbuilderx/SRBXCrossoverValidation.js",
		"utf8",
	),
	context,
);
const dir = root + "__targets__/kaizpatch/scripts/superrailbuilderx/";
vm.runInContext(
	fs.readFileSync(
		dir +
			fs
				.readdirSync(dir)
				.find(
					(n) =>
						n.startsWith("SRBXApiCompat.") &&
						n.endsWith(".compat.js"),
				),
		"utf8",
	),
	context,
);
const api = Object.values(context.RTMX_COMPAT_TARGETS.kaizpatch)[0]
	.SRBXApiCompat;
// Native SwitchCore keeps an independent, private map cache after NBT has
// replaced its RailPositions. Recreating a normal core map alone does nothing.
const cachedSwitch = new SwitchCore();
cachedSwitch.switchObj = { geometry: "old" };
cachedSwitch.openedRails = new List("old route");
cachedSwitch.geometry = "moved";
cachedSwitch.xCoord = 1;
cachedSwitch.yCoord = 2;
cachedSwitch.zCoord = 3;
cachedSwitch.getClass = () => ({
	getName: () => "jp.ngt.rtm.rail.TileEntityLargeRailSwitchCore",
	getDeclaredField: (name) => ({
		setAccessible() {},
		get: (object) => object[name],
		set: (object, value) => (object[name] = value),
	}),
});
cachedSwitch.createRailMap = () => {
	if (!cachedSwitch.switchObj)
		cachedSwitch.switchObj = { geometry: cachedSwitch.geometry };
};
cachedSwitch.openedRails.clear = function () {
	this.length = 0;
};
const getCoreWorldForRefresh = api.getCoreWorld;
let switchUpdates = 0;
api.getCoreWorld = () => ({
	markBlockForUpdate: () => switchUpdates++,
	func_147471_g: () => switchUpdates++,
});
api.refreshRailCoreClient(cachedSwitch);
assert.equal(cachedSwitch.switchObj.geometry, "moved");
assert.equal(cachedSwitch.openedRails.length, 0);
assert.equal(cachedSwitch.shouldRerenderRail, true);
assert.equal(switchUpdates, 1);
cachedSwitch.geometry = "packet arrived later";
api.refreshRailCoreClient(cachedSwitch);
assert.equal(cachedSwitch.switchObj.geometry, "packet arrived later");
api.getCoreWorld = getCoreWorldForRefresh;
const staleCells = new Map();
const staleKey = (p) => p.join(",");
const staleCore = new SwitchCore();
staleCore.key = "core:0,0,0";
const staleBeds = [1, 2, 3, 4].map((x) => {
	const tile = new Base();
	tile.xCoord = tile.field_145851_c = x;
	tile.yCoord = tile.field_145848_d = 0;
	tile.zCoord = tile.field_145849_e = 0;
	tile.getStartPoint = () => [0, 0, 0];
	tile.getRailCore = () => staleCells.get("0,0,0") || null;
	staleCells.set(`${x},0,0`, tile);
	return tile;
});
staleCells.set("0,0,0", staleCore);
const replacement = new Base();
const foreignOwner = new Core();
foreignOwner.key = "foreign";
const sameKeyReplacementOwner = new SwitchCore();
sameKeyReplacementOwner.key = staleCore.key;
staleCore.breakLogicalRail = () => {
	staleCells.delete("0,0,0");
	staleBeds[1].getRailCore = () => foreignOwner;
	staleCells.set("3,0,0", replacement);
	staleBeds[3].getRailCore = () => sameKeyReplacementOwner;
};
context.SRBXRoadbedOwnership = { promotions: () => [] };
const oldRelease = api.releaseBorrowedRoadbeds;
const oldCandidateKey = api.getRailPositionCandidateKey;
api.releaseBorrowedRoadbeds = () => {};
api.getRailPositionCandidateKey = (core) => core.key;
api.getCoreWorld = () => ({
	field_147482_g: { size: () => staleBeds.length, get: (i) => staleBeds[i] },
	loadedTileEntityList: {
		size: () => staleBeds.length,
		get: (i) => staleBeds[i],
	},
	func_147438_o: (...p) => staleCells.get(staleKey(p)) || null,
	getTileEntity: (...p) => staleCells.get(staleKey(p)) || null,
	func_147468_f: (...p) => staleCells.delete(staleKey(p)),
	setBlockToAir: (...p) => staleCells.delete(staleKey(p)),
	func_147471_g() {},
	markBlockForUpdate() {},
});
context.SRBXKaizRoadbedData = { remove() {} };
api.breakOwnedRail(staleCore);
assert.equal(staleCells.has("1,0,0"), false, "old-map leftover is removed");
assert.equal(staleCells.get("2,0,0"), staleBeds[1], "new owner is preserved");
assert.equal(
	staleCells.get("4,0,0"),
	staleBeds[3],
	"same-key replacement owner is preserved",
);
assert.equal(
	staleCells.get("3,0,0"),
	replacement,
	"replacement tile is preserved",
);
api.releaseBorrowedRoadbeds = oldRelease;
api.getRailPositionCandidateKey = oldCandidateKey;
api.getCoreWorld = getCoreWorldForRefresh;

assert.equal(api.undoCrossoverBuilderRail({}, {}, "any"), "undo_disabled");
console.log(
	"Kaiz crossover renderer/cache/roadbed protection and generation Undo disabled passed",
);
