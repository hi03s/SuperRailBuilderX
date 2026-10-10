const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const context = vm.createContext({});
for (const name of ["SRBXRailBoundary", "SRBXMath"])
	vm.runInContext(
		fs.readFileSync(
			`dist/assets/minecraft/scripts/superrailbuilderx/${name}.js`,
			"utf8",
		),
		context,
	);
const B = context.SRBXRailBoundary,
	M = context.SRBXMath;
const array = (value) => Array.from(value);
for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315, 12.3, -27.1]) {
	const p = B.snap([-713.8595, 4.0625, 27.8595], yaw, 2);
	assert(B.isBoundary(p, yaw));
	assert.deepEqual(array(B.snap(p, yaw, 2)), array(p));
	const opposite = B.snap([-713.8595, 4.0625, 27.8595], yaw + 180, -2);
	for (let i = 0; i < 3; i++) assert(Math.abs(p[i] - opposite[i]) < 1e-10);
}
assert(
	!B.isBoundary([0, 4, 2.5], 0),
	"a tangent parallel to the face cannot cross it",
);
assert.equal(B.direction([0, 4.0625, 2.5], 45), 2);
assert.equal(B.direction([0, 4.0625, 2.5], 225), 6);
assert.deepEqual(array(B.owner([0, 4.0625, 2.5], 45)), [0, 4, 2]);
assert.deepEqual(array(B.owner([0, 4.0625, 2.5], 225)), [-1, 4, 2]);
const shared = B.snapShared([0.3, 4.0625, 2.2], [0, 90]);
assert(B.isBoundary(shared, 0) && B.isBoundary(shared, 90));
const revisions = [
	[0, -0.5],
	[-0.5, -0.5],
	[-0.5, 0],
	[-0.5, 0.499999],
	[0, 0.499999],
	[0.499999, 0.499999],
	[0.499999, 0],
	[0.499999, -0.5],
];
for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
	const p = B.snap([-3.2, 4.0625, -1.7], yaw),
		own = B.owner(p, yaw),
		other = B.owner(p, yaw + 180);
	const d = B.direction(p, yaw),
		offset = revisions[d];
	assert.equal(Math.floor(p[0] + offset[0]), other[0]);
	assert.equal(Math.floor(p[2] + offset[1]), other[2]);
	assert.notDeepEqual(array(own), array(other));
}
const map = {
	getLength: () => 10,
	getRailPos: (split, index) => [
		2.3 + (6 * index) / split,
		0.2 + (8 * index) / split,
	],
	getRailHeight: (split, index) => 4.0625 + index / split,
};
const crossing = B.findMapBoundary(map, 0.51, 0.3, 0.7);
assert(crossing && crossing.ratio >= 0.3 && crossing.ratio <= 0.7);
assert(B.isBoundary(crossing.position, (Math.atan2(8, 6) * 180) / Math.PI));
assert(Math.abs(crossing.position[1] - (4.0625 + crossing.ratio)) < 1e-7);
assert.equal(B.findMapBoundary(map, 0.1, 0.8, 0.2), null);
for (const radius of [25, -25, 1000, -1000]) {
	const circle = B.findCircularBoundary([0, 4.0625, 0.25], 45, radius, 12.7);
	assert(circle && B.isBoundary(circle.position, circle.endYaw));
	const expected = M.continueCircularCurve(
		[0, 4.0625, 0.25],
		45,
		radius,
		circle.arcLength,
	);
	assert(M.horizontalDistance(expected.position, circle.position) < 1e-8);
}
const point = (position, yaw, pitch) => ({
	kind: "free",
	position,
	anchorYaw: yaw,
	anchorPitch: pitch,
	direction: 0,
	anchorLength: 30,
	markerPosition: position,
});
const start = point([0.2, 4.0625, 0.25], 0, 0),
	end = point([0.2, 4.0625, 100.25], 180, -1);
end.slopeTarget = true;
end.verticalCurveRadius = 1000;
const original = JSON.stringify([start, end]);
const plan = M.planVerticalRailSegments(start, end, true);
assert.equal(plan.length, 2);
assert.equal(
	JSON.stringify([start, end]),
	original,
	"planning must not mutate requests",
);
for (const pair of plan)
	for (const p of pair) assert(B.isBoundary(p.position, p.anchorYaw));
assert.deepEqual(array(plan[0][1].position), array(plan[1][0].position));
assert.deepEqual(
	array(B.owner(plan[0][1].position, plan[0][1].anchorYaw)),
	array(plan[0][1].ownerBlock),
);
assert.equal(plan[0][1].anchorPitch, -plan[1][0].anchorPitch);
console.log(
	"Rail boundary geometry, native neighbor ownership, circular radius and vertical joins passed",
);

const rawPlan = M.planVerticalRailSegments(
	B.normalizePoint(start),
	B.normalizePoint(end),
);
assert(
	Math.abs(
		plan[0][0].anchorLengthVertical - rawPlan[0][0].anchorLengthVertical,
	) > 1e-5,
	"shared snap must scale vertical anchors using the original section length",
);
const legacyPlan = M.planVerticalRailSegments(
	point([0.2, 4, 0.25], 0, 0),
	point([0.2, 4, 10.25], 180, 0),
);
assert.deepEqual(array(legacyPlan[0][0].position), [0.2, 4, 0.25]);
assert.equal(
	M.planVerticalRailSegments(
		point([0.2, 4, 0.25], 0, 0),
		point([0.2, 4, 0.26], 180, 0),
		true,
	).length,
	0,
);
