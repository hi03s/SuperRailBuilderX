const fs = require("fs");
const vm = require("vm");
const path = require("path");

// ModelPackManager.loadScript uses Matcher.replaceFirst without quoteReplacement.
// Reproduce its replacement-string escaping at every nested include boundary.
function javaReplacement(text) {
	if (text.includes("$"))
		throw new Error("unescaped Java replacement group reference");
	return text.replace(/\\([\s\S])/g, "$1");
}
function expandIncludes(file, replacement, active = []) {
	if (active.includes(file)) throw new Error(`cyclic include: ${file}`);
	const root = path.resolve("dist/assets/minecraft");
	return fs
		.readFileSync(file, "utf8")
		.replace(/\/\/include\s+<([^>]+)>/g, (_match, include) =>
			replacement(
				expandIncludes(path.join(root, include), replacement, [
					...active,
					file,
				]),
			),
		);
}
const generatedPatch = path.resolve(
	"dist/assets/minecraft/scripts/srbx_patch/patch_source.js",
);
if (!fs.existsSync(generatedPatch))
	throw new Error("run pnpm build before testing the distributed scripts");
const generatedContext = {};
const sourceContext = {};
vm.runInNewContext(fs.readFileSync(generatedPatch, "utf8"), sourceContext);
const source = sourceContext.RAIL_RENDER_PATCH_SOURCE;
if (typeof source !== "string")
	throw new Error("patch source was not serialized");
vm.runInNewContext(
	javaReplacement(fs.readFileSync(generatedPatch, "utf8")),
	generatedContext,
);
if (generatedContext.RAIL_RENDER_PATCH_SOURCE !== source)
	throw new Error("include expansion changed the serialized patch");
const normalizerContext = {
	Packages: { jp: { ngt: { ngtlib: { io: { NGTLog: {} } } } } },
};
vm.runInNewContext(
	javaReplacement(
		fs.readFileSync(
			"dist/assets/minecraft/scripts/srbx_patch/rail_render_patch.js",
			"utf8",
		),
	),
	normalizerContext,
);
if (
	normalizerContext.SRBXRailRenderPatch.normalize(
		"scripts\\rail\\renderer.js",
	) !== "scripts/rail/renderer.js"
)
	throw new Error("include expansion broke Windows exclude paths");
for (const renderer of fs.readdirSync(
	"dist/assets/minecraft/scripts/superrailbuilderx",
)) {
	if (!renderer.startsWith("render_") || !renderer.endsWith(".js")) continue;
	const filename = path.resolve(
		"dist/assets/minecraft/scripts/superrailbuilderx",
		renderer,
	);
	for (const replacement of [javaReplacement, (source) => source])
		new vm.Script(expandIncludes(filename, replacement), {
			filename: renderer,
		});
}
const translation = { x: 0, z: 0 };
const stack = [];
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
const context = {
	Number,
	isFinite,
	rp,
	GL11: {
		glPushMatrix() {
			stack.push({ ...translation });
		},
		glTranslatef(x, _y, z) {
			translation.x += x;
			translation.z += z;
		},
		glPopMatrix() {
			const previous = stack.pop();
			translation.x = previous.x;
			translation.z = previous.z;
		},
	},
};
vm.createContext(context);
vm.runInContext(
	`
function renderRailMapDynamic(target) {
    return { x: target.innerX, z: target.innerZ };
}
function renderRailDynamic2(target, x, y, z) {
    var outerX = x + (rp.posX - rp.blockX);
    var outerY = y + (rp.posY - rp.blockY - 0.0625);
    var outerZ = z + (rp.posZ - rp.blockZ);
    var branch = renderRailMapDynamic(target);
    return {
        branchX: outerX + branch.x,
        branchZ: outerZ + branch.z,
        nonBranchX: outerX,
        nonBranchY: outerY,
        nonBranchZ: outerZ
    };
}
`,
	context,
);

context.renderRailMapDynamic = (target) => ({
	x: translation.x + target.innerX,
	z: translation.z + target.innerZ,
});
vm.runInContext(source, context);

const offsetBranch = context.renderRailDynamic2(tile, 100, 200, 300);
if (
	offsetBranch.branchX !== 102.5 ||
	offsetBranch.branchZ !== 303.5 ||
	offsetBranch.nonBranchX !== 102.5 ||
	offsetBranch.nonBranchY !== 201 ||
	offsetBranch.nonBranchZ !== 303.5
)
	throw new Error(`offset branch mismatch: ${JSON.stringify(offsetBranch)}`);
if (translation.x !== 0 || translation.z !== 0 || stack.length !== 0)
	throw new Error("GL matrix state was not restored");

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
	zeroOffsetBranch.branchX !== 100.5 ||
	zeroOffsetBranch.branchZ !== 300.5 ||
	zeroOffsetBranch.nonBranchX !== 100.5 ||
	zeroOffsetBranch.nonBranchY !== 200 ||
	zeroOffsetBranch.nonBranchZ !== 300.5
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
if (nonSwitchResult.nonBranchX !== 1.5 || nonSwitchResult.nonBranchZ !== 3.5)
	throw new Error(`non-switch changed: ${JSON.stringify(nonSwitchResult)}`);

console.log("rail render patch source tests passed");
