const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const ts = require("../../node_modules/.pnpm/node_modules/typescript");
const source = fs.readFileSync(
	"src/common/assets/minecraft/scripts/superrailbuilderx/SRBXCopyOrientation.ts",
	"utf8",
);
const context = { exports: {} };
vm.runInNewContext(
	ts.transpileModule(source, {
		compilerOptions: {
			target: ts.ScriptTarget.ES5,
			module: ts.ModuleKind.CommonJS,
		},
	}).outputText,
	context,
);
const directions = (rails) =>
	Array.from(context.exports.SRBXCopyOrientation.directions(rails));
const rail = (start, end) => ({ start, end });
assert.deepStrictEqual(directions([]), []);
assert.deepStrictEqual(
	directions([rail([0, 0, 0], [0, 0, 10]), rail([0, 0, 10], [0, 0, 20])]),
	[1, 1],
);
// End-end and start-start connections both reverse local expansion direction.
const reversedChain = [
	rail([0, 0, 0], [0, 0, 10]),
	rail([0, 0, 20], [0, 0, 10]),
	rail([0, 0, 20], [0, 0, 30]),
];
assert.deepStrictEqual(directions(reversedChain), [1, -1, 1]);
// Selection order need not follow the chain.
assert.deepStrictEqual(
	directions([reversedChain[0], reversedChain[2], reversedChain[1]]),
	[1, 1, -1],
);
assert.deepStrictEqual(
	directions([reversedChain[1], reversedChain[0], reversedChain[2]]),
	[1, -1, -1],
);
// Propagate endpoint order around a curve even when the final heading is reversed.
assert.deepStrictEqual(
	directions([
		rail([0, 0, 0], [0, 0, 10]),
		rail([10, 0, 10], [10, 0, 0]),
		rail([10, 0, 10], [0, 0, 10]),
	]),
	[1, 1, -1],
);
// Equal XZ but different heights are not a connection; 1 cm drift is tolerated.
assert.deepStrictEqual(
	directions([
		rail([0, 0, 0], [0, 0, 10]),
		rail([0, 1, 20], [0, 1, 10]),
		rail([0, 0, 20], [0.009, 0, 10]),
		rail([0, 0, 30], [0.011, 0, 10]),
	]),
	[1, 1, -1, 1],
);
// With the actual copy normal convention, reversed local yaw produces the
// same physical displacement after orientation correction, for either side.
for (const spacing of [4, -4, 8]) {
	const signs = directions(reversedChain);
	const yaws = [0, 180, 0];
	const offsets = yaws.map((yaw, i) => [
		Math.cos((yaw * Math.PI) / 180) * spacing * signs[i],
		-Math.sin((yaw * Math.PI) / 180) * spacing * signs[i],
	]);
	for (const offset of offsets) {
		assert(Math.abs(offset[0] - spacing) < 1e-8);
		assert(Math.abs(offset[1]) < 1e-8);
	}
}
console.log("copy_orientation.test: OK");
