const fs = require("fs");
const vm = require("vm");

const text = fs.readFileSync(
	"src/common/assets/minecraft/scripts/srbx_patch/patch_source.ts",
	"utf8",
);
const source = text.slice(text.indexOf("`") + 1, text.lastIndexOf("`"));
const rp = {
	blockX: 10,
	blockY: 20,
	blockZ: 30,
	posX: 12.5,
	posY: 21.0625,
	posZ: 33.5,
	offsetX: 2,
	offsetY: 1,
	offsetZ: 3,
};
const tile = {
	getSwitch: () => ({}),
	getRailPositions: () => [rp],
	innerX: 2,
	innerZ: 3,
};
const original = (target, x, y, z) => ({
	x: x + (rp.posX - rp.blockX) + target.innerX,
	y: y + (rp.posY - rp.blockY - 0.0625),
	z: z + (rp.posZ - rp.blockZ) + target.innerZ,
});
const context = { Number, isFinite, renderRailDynamic2: original };
vm.createContext(context);

vm.runInContext(source, context);
const offsetBranch = context.renderRailDynamic2(tile, 100, 200, 300);
if (
	offsetBranch.x !== 102.5 ||
	offsetBranch.y !== 201 ||
	offsetBranch.z !== 303.5
)
	throw new Error(`offset branch mismatch: ${JSON.stringify(offsetBranch)}`);

const firstWrapper = context.renderRailDynamic2;
vm.runInContext(source, context);
if (context.renderRailDynamic2 !== firstWrapper)
	throw new Error("the same engine was patched twice");

rp.offsetX = rp.offsetY = rp.offsetZ = 0;
rp.posX = 10.5;
rp.posY = 20.0625;
rp.posZ = 30.5;
tile.innerX = tile.innerZ = 0;
const zeroOffsetBranch = context.renderRailDynamic2(tile, 100, 200, 300);
if (
	zeroOffsetBranch.x !== 100.5 ||
	zeroOffsetBranch.y !== 200 ||
	zeroOffsetBranch.z !== 300.5
)
	throw new Error(
		`zero-offset branch mismatch: ${JSON.stringify(zeroOffsetBranch)}`,
	);

const nonSwitch = {
	getSwitch: () => null,
	getRailPositions: () => [rp],
	innerX: 0,
	innerZ: 0,
};
const nonSwitchResult = context.renderRailDynamic2(nonSwitch, 1, 2, 3);
if (nonSwitchResult.x !== 1.5 || nonSwitchResult.z !== 3.5)
	throw new Error(`non-switch changed: ${JSON.stringify(nonSwitchResult)}`);

console.log("rail render patch source tests passed");
