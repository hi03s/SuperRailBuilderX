const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const context = vm.createContext({});
for (const name of ["SRBXRailBoundary", "SRBXFreeEndpointPolicy", "SRBXMath"])
	vm.runInContext(
		fs.readFileSync(
			`dist/assets/minecraft/scripts/superrailbuilderx/${name}.js`,
			"utf8",
		),
		context,
	);
const policy = context.SRBXFreeEndpointPolicy;
const precise = {
	kind: "free",
	position: [-713.8595, 4.0625, 27.8595],
	anchorYaw: 45,
	anchorPitch: 2,
	direction: 1,
	anchorLength: 10,
	markerPosition: [-713.5, 4.0625, 27.5],
	ownerBlock: [-714, 4, 27],
};
assert.strictEqual(policy.normalizePoint(precise), precise);
assert(policy.isBoundary(precise.position, precise.anchorYaw));
assert(!policy.isBoundary([NaN, 4, 2], 90));
const map = {
	getRailPos: (split, index) => [
		27.25 + index / split,
		-713.25 + index / split,
	],
	getRailHeight: (split, index) => 4.0625 + index / split,
};
const sample = policy.findMapBoundary(map, 0.37, 0.1, 0.9);
assert.equal(sample.ratio, 0.37);
assert.deepStrictEqual(Array.from(sample.position), [-712.88, 4.4325, 27.62]);
assert.equal(policy.findMapBoundary(map, 0.01, 0.1, 0.9), null);
assert.equal(
	policy.direction([0, 4, 2.75], 45),
	2,
	"native boundary direction remains compatible",
);
assert.equal(
	policy.direction(precise.position, 45),
	1,
	"interior endpoint keeps marker heading without snapping",
);
const other = {
	...precise,
	position: [-703.8595, 5.0625, 37.8595],
	anchorYaw: 225,
	anchorPitch: -2,
};
const plan = context.SRBXMath.planVerticalRailSegments(precise, other, false);
assert.deepStrictEqual(Array.from(plan[0][0].position), precise.position);
assert.deepStrictEqual(Array.from(plan[0][1].position), other.position);
for (const target of ["kaizpatch", "appleextended"]) {
	const dir = `dist/assets/minecraft/__targets__/${target}/scripts/superrailbuilderx`;
	const source = fs.readFileSync(
		`${dir}/${fs.readdirSync(dir).find((n) => n.startsWith("SRBXApiCompat.") && n.endsWith(".compat.js"))}`,
		"utf8",
	);
	assert.match(
		source,
		/requiresRailBoundarySnap = function \(\) \{\s*return false;/,
	);
	assert(source.includes("jp.hi03.srbxpatch.SRBXPatch"));
}
assert(
	!fs.existsSync(
		"src/common/json/ModelTrain_SuperRailBuilderX_TrainDebug.json",
	),
);
console.log(
	"Precise free endpoints, matching patch capability and retired debug registration passed",
);
