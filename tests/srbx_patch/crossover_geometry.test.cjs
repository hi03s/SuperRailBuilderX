const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const context = vm.createContext({});
for (const name of ["SRBXMath", "SRBXCrossoverPlan", "SRBXCrossoverValidation"])
	vm.runInContext(fs.readFileSync(dir + name + ".js", "utf8"), context);
const point = (x, z, yaw) => ({
	kind: "free",
	position: [x, 4, z],
	markerPosition: [x, 4, z],
	direction: yaw === 180 ? 4 : 0,
	anchorYaw: yaw,
	anchorPitch: 0,
	anchorLength: 10,
	anchorLengthVertical: 10,
	cantEdge: 4,
	cantCenter: 2,
	cantRandom: 1,
});
const base = [point(0, 0, 0), point(0, 40, 180)];
const geometry = context.SRBXCrossoverGeometry;
const masks = [
	[1, 0, 0, 1],
	[0, 1, 1, 0],
	[1, 1, 1, 1],
	[0, 1, 1, 0],
	[1, 0, 0, 1],
	[1, 1, 1, 1],
];
for (let mode = 0; mode < 6; mode++) {
	const p = geometry.plan(base, 4, mode);
	assert.equal(
		p.points[2].position[0],
		mode < 3 ? -4 : 4,
		"parallel side follows forward heading",
	);
	assert.equal(p.points[3].position[0], mode < 3 ? -4 : 4);
	assert.deepEqual(Array.from(p.switchTypes), masks[mode]);
	assert.equal(context.validateCrossoverPlan(p), "ok");
	for (const endpoint of p.points)
		assert.deepEqual(
			[endpoint.cantEdge, endpoint.cantCenter, endpoint.cantRandom],
			[0, 0, 0],
		);
}
assert.equal(base[0].cantEdge, 4, "preview does not mutate source");
assert.equal(
	geometry.plan([{ ...base[0], anchorPitch: 1 }, base[1]], 4, 0),
	null,
);
assert.equal(
	geometry.plan([base[0], { ...base[1], position: [0, 5, 40] }], 4, 0),
	null,
);
assert.equal(geometry.plan(base, 0, 0), null);
assert.equal(geometry.plan(base, 4, 6), null);
const bent = [point(0, 0, 0), point(30, 30, 270)];
const p = geometry.plan(bent, 4, 3);
assert(p);
assert.equal(context.validateCrossoverPlan(p), "ok");
const chord = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
assert(
	Math.abs(
		p.points[2].anchorLength -
			(10 * chord(p.points[2].position, p.points[3].position)) /
				chord(bent[0].position, bent[1].position),
	) < 1e-9,
);
console.log(
	"Six crossover layouts, side/handedness, flat-only geometry, cant isolation and parallel anchors passed",
);
