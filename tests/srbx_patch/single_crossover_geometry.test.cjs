const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const context = vm.createContext({});
for (const name of [
	"SRBXMath",
	"SRBXCrossoverPlan",
	"SRBXSingleCrossoverSplit",
])
	vm.runInContext(fs.readFileSync(dir + name + ".js", "utf8"), context);
const math = context.SRBXMath;
const split = context.SRBXSingleCrossoverSplit;
const plain = (value) => JSON.parse(JSON.stringify(value));
const point = (x, z, yaw, length) => ({
	kind: "endpoint",
	core: [0, 0, 0],
	index: 0,
	position: [x, 4.0625, z],
	markerPosition: [x, 4, z],
	direction: math.directionFromYaw(yaw),
	anchorYaw: yaw,
	anchorPitch: 0,
	anchorLength: length,
	anchorLengthVertical: 0,
	cantEdge: 0,
	cantCenter: 0,
	cantRandom: 0,
});
const controls = (a, b) => [
	a.position,
	math.pointAtYawPitchDistance(a.position, a.anchorYaw, 0, a.anchorLength),
	math.pointAtYawPitchDistance(b.position, b.anchorYaw, 0, b.anchorLength),
	b.position,
];
const evaluate = (points, t) => plain(math.cubicBezierPoint(...points, t));
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const near = (a, b, message) => assert(distance(a, b) < 0.0001, message);
// Approximate the native RailMap half-length point rather than assuming t = .5.
function edge(start, end, startSwitch, endSwitch) {
	const curve = controls(start, end),
		samples = [evaluate(curve, 0)],
		lengths = [0];
	for (let i = 1; i <= 8192; i++) {
		samples.push(evaluate(curve, i / 8192));
		lengths.push(lengths[i - 1] + distance(samples[i], samples[i - 1]));
	}
	const length = lengths[lengths.length - 1];
	let index = 1;
	while (lengths[index] < length / 2) index++;
	const t =
		(index -
			1 +
			(length / 2 - lengths[index - 1]) /
				(lengths[index] - lengths[index - 1])) /
		8192;
	return {
		start: plain(start),
		end: plain(end),
		startSwitch,
		endSwitch,
		midpoint: evaluate(curve, t),
		length,
		t,
	};
}
const reverse = (e) => ({
	...e,
	start: e.end,
	end: e.start,
	startSwitch: e.endSwitch,
	endSwitch: e.startSwitch,
});
let cases = 0;
for (const base of [
	[point(0, 0, 0, 12), point(0, 40, 180, 12)],
	[point(0, 0, 5, 3), point(18, 40, 225, 20)],
]) {
	for (let mode = 0; mode < 6; mode++) {
		const source = context.SRBXCrossoverGeometry.plan(base, 4, mode);
		const points = source.points;
		const flags = Array.from(source.switchTypes, Boolean);
		const edges = [
			edge(points[0], points[1], flags[0], flags[1]),
			edge(points[2], points[3], flags[2], flags[3]),
		];
		const roots = flags.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
		if (roots.length === 4) {
			edges.push(
				edge(points[0], points[3], true, true),
				edge(points[1], points[2], true, true),
			);
			assert.equal(
				split.plan(edges),
				null,
				"Scissors cannot be split as a single crossover",
			);
			continue;
		}
		edges.push(edge(points[roots[0]], points[roots[1]], true, true));
		const direct = split.fromPoints(points, source.switchTypes, (a, b) =>
			edge(a, b, false, false),
		);
		assert.deepEqual(
			plain(direct),
			plain(split.plan(edges)),
			"Direct planning equals native-edge split without creating a four-point switch",
		);
		const preview = split.preview(points, source.switchTypes);
		assert(preview);
		for (let i = 0; i < 3; i++)
			assert(
				distance(preview.markers[i], direct.markers[i]) < 0.01,
				"Preview/native midpoint agreement",
			);

		const original = JSON.stringify(edges);
		for (const input of [edges, edges.map(reverse)]) {
			const plan = split.plan(input);
			assert(plan, "Single crossover has a valid split plan");
			assert.equal(plan.switches.length, 2);
			assert.equal(plan.normals.length, 2);
			assert.deepEqual(
				plain(plan.markers),
				edges.map((e) => e.midpoint),
			);
			assert.deepEqual(
				plain(plan.lengths),
				edges.slice(0, 2).map((e) => e.length),
			);
			for (let i = 0; i < 2; i++) {
				const sourceMain = input[i];
				const turnout = plan.switches[i],
					normal = plan.normals[i];
				assert.equal(turnout.length, 3);
				near(
					turnout[0].position,
					sourceMain.startSwitch
						? sourceMain.start.position
						: sourceMain.end.position,
					"Switch root stays at its original end",
				);
				near(
					normal[0].position,
					sourceMain.startSwitch
						? sourceMain.end.position
						: sourceMain.start.position,
					"Normal core is placed at original outer endpoint",
				);
				near(
					turnout[1].position,
					sourceMain.midpoint,
					"Main splits at actual half length",
				);
				near(
					normal[1].position,
					sourceMain.midpoint,
					"Normal and switch endpoints meet",
				);
				assert(
					Math.abs(
						math.normalizeDegrees(
							turnout[1].anchorYaw - normal[1].anchorYaw,
						) - 180,
					) < 0.000001,
					"Main half endpoints face in opposite directions",
				);
				for (const p of [...turnout, ...normal]) {
					assert.equal(p.kind, "free");
					assert.equal(p.core, undefined);
					assert.equal(p.index, undefined);
				}
				// Recover the original main curve in its original direction, including asymmetric controls.
				const first = sourceMain.startSwitch
					? [turnout[0], turnout[1]]
					: normal;
				const last = sourceMain.startSwitch
					? [normal[1], normal[0]]
					: [turnout[1], turnout[0]];
				const originalControls = controls(
					sourceMain.start,
					sourceMain.end,
				);
				const t =
					sourceMain.startSwitch === edges[i].startSwitch
						? edges[i].t
						: 1 - edges[i].t;
				for (let sample = 0; sample <= 16; sample++) {
					const u = sample / 16;
					near(
						evaluate(controls(...first), u),
						evaluate(originalControls, u * t),
						"First main half retains the original Bezier shape",
					);
					near(
						evaluate(controls(...last), u),
						evaluate(originalControls, t + u * (1 - t)),
						"Second main half retains the original Bezier shape",
					);
				}
			}
			near(
				plan.switches[0][2].position,
				plan.switches[1][2].position,
				"Both branches meet at diagonal midpoint",
			);
			assert(
				Math.abs(
					math.normalizeDegrees(
						plan.switches[0][2].anchorYaw -
							plan.switches[1][2].anchorYaw,
					) - 180,
				) < 0.000001,
				"Branch midpoint endpoints face opposite directions",
			);
			cases++;
		}
		assert.equal(
			JSON.stringify(edges),
			original,
			"Split planning does not mutate source endpoints",
		);
	}
}
assert.equal(split.plan([]), null);
const shortPoints = [
	point(0, 0, 0, 2),
	point(0, 6, 180, 2),
	point(4, 0, 0, 2),
	point(4, 6, 180, 2),
];
const minimum = [
	edge(shortPoints[0], shortPoints[1], true, false),
	edge(shortPoints[2], shortPoints[3], false, true),
	edge(shortPoints[0], shortPoints[3], true, true),
];
assert(split.plan(minimum), "Six-metre native mains are accepted");
assert.equal(
	split.plan(minimum.map((e, i) => (i === 0 ? { ...e, length: 5.99 } : e))),
	null,
	"Short halves are rejected",
);
assert.equal(
	split.plan(
		minimum.map((e, i) => (i === 0 ? { ...e, midpoint: [NaN, 4, 3] } : e)),
	),
	null,
	"Non-finite native midpoint is rejected",
);
console.log(
	`Single crossover split geometry: ${cases} straight/curved/oriented cases, outer cores, connected midpoints, unchanged source and scissors rejection passed`,
);
