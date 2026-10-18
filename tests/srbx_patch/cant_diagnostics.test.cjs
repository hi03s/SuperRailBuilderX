const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const context = vm.createContext({});
vm.runInContext(
	fs.readFileSync(
		"dist/assets/minecraft/scripts/superrailbuilderx/SRBXCantDiagnostics.js",
		"utf8",
	),
	context,
);
const diagnostics = context.SRBXCantDiagnostics;
// Reproduce the native distinction: height includes cant lift, pitch does not.
const rail = (start = 0, end = 1, constant = false, heightOffset = 0) =>
	Object.freeze({
		getLength: () => 40 * (end - start),
		getRailPos: (split, index) => [
			40 * (start + ((end - start) * index) / split),
			0,
		],
		getCant: (split, index) =>
			constant ? 5 : 10 * (start + ((end - start) * index) / split),
		getRailPitch: () => 0,
		getRailHeight(split, index) {
			return (
				4.0625 +
				Math.abs(
					Math.sin((this.getCant(split, index) * Math.PI) / 180) *
						1.5,
				) +
				heightOffset
			);
		},
	});
const profile = diagnostics.profile(rail());
assert(profile.includes("split=80"));
assert(Number(profile.match(/maxPitchMismatch=([^,]+)/)[1]) > 0.3);
assert(Number(profile.match(/maxHeightStep=([^,]+)/)[1]) > 0.003);
assert(diagnostics.profile(rail(0, 1, true)).includes("maxPitchMismatch=0,"));
assert(
	diagnostics
		.seams([rail(0, 0.3), rail(0.3, 0.7), rail(0.7, 1)])
		.includes("maxHeightGap=0, maxRollGap=0"),
);
assert(
	diagnostics
		.seams([rail(0, 0.3), rail(0.3, 1, false, 0.1)])
		.includes("maxHeightGap=0.1"),
);
const huge = { ...rail(), getLength: () => 1e9 };
assert(diagnostics.profile(huge).includes("split=2048"));
assert.throws(
	() => diagnostics.profile({ ...rail(), getRailHeight: () => NaN }),
	/non-finite/,
);
assert.throws(
	() => diagnostics.seams([rail(), { ...rail(), getCant: () => Infinity }]),
	/non-finite/,
);
console.log(
	"Cant lift/pitch mismatch, section continuity and bounded read-only diagnostics passed",
);
