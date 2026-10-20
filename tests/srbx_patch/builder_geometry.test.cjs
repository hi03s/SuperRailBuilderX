const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const context = vm.createContext({
	builderB: false,
	crossoverBuilder: false,
	DEFAULT_RAIL_HEIGHT: 1 / 16,
	snapAngles: [1, 5, 15],
});
const read = (name) => fs.readFileSync(dir + name + ".js", "utf8");
const fn = (text, name) => {
	const start = text.indexOf("function " + name + "(");
	assert(start >= 0, name);
	return text.slice(start, text.indexOf("\n}", start) + 2);
};
vm.runInContext(read("SRBXMath") + read("SRBXBuilderGeometry"), context);
const math = context.SRBXMath,
	geometry = context.SRBXBuilderGeometry;
const start = {
	kind: "free",
	position: [1.25, 8.0625, -2.25],
	anchorYaw: 0,
	anchorPitch: 0,
	direction: 0,
	anchorLength: 0,
	markerPosition: [1.5, 8.0625, -2.5],
};
const design = {
	length: 40,
	radius: 10000,
	yaw: 90,
	slopePermil: 0,
	verticalCurveRadius: 1000,
};
const saved = JSON.stringify(start);
let pair = geometry.plan(start, design);
assert(Math.abs(pair[1].position[0] - 41.25) < 1e-8);
assert.equal(pair[1].position[1], start.position[1]);
assert.equal(
	JSON.stringify(start),
	saved,
	"A preview never edits its selected source",
);
for (const sign of [1, -1]) {
	pair = geometry.plan(start, {
		...design,
		radius: 100 * sign,
		yaw: 0,
		slopePermil: 20,
	});
	assert.equal(
		Math.sign(pair[1].position[0] - start.position[0]),
		-sign,
		"L/R bend to opposite sides",
	);
	assert(Math.abs(math.permilFromPitch(pair[0].anchorPitch) - 20) < 1e-8);
	assert.equal(pair[0].anchorPitch, -pair[1].anchorPitch);
	assert(
		Math.abs(
			(pair[1].position[1] - pair[0].position[1]) /
				geometry.horizontalLength(...pair) -
				0.02,
		) < 1e-8,
	);
	const segments = math.planVerticalRailSegments(...pair);
	assert.equal(
		segments.length,
		1,
		"A free pair keeps a constant grade, without a vertical transition",
	);
	assert.equal(
		segments[0][0].anchorLengthVertical,
		pair[0].anchorLengthVertical,
	);
}
const connected = {
	...start,
	kind: "rail",
	anchorYaw: 30,
	anchorPitch: 3,
	core: [1, 8, -3],
	index: 0,
};
pair = geometry.plan(connected, design);
assert.equal(
	pair[0].anchorYaw,
	30,
	"A connected start retains rail heading rather than player heading",
);
assert.equal(pair[0].anchorPitch, 3);
assert.equal(pair[1].slopeTarget, true);
assert(math.planVerticalRailSegments(...pair).length > 0);
// Ground extension keeps the connected grade, then levels at the chosen height.
for (const sign of [1, -1]) {
	const source = { ...connected, anchorPitch: 3 * sign };
	for (const radius of [10000, 100, -100]) {
		const targetY = source.position[1] + 2 * sign;
		const length = geometry.groundDesignLength(
			source,
			targetY,
			radius,
			1000,
		);
		assert(length > 40 && length < 512);
		const ground = { ...design, length, radius, groundTargetY: targetY };
		const planned = geometry.plan(source, ground);
		assert(planned);
		assert.equal(planned[1].position[1], targetY);
		assert.equal(planned[1].anchorPitch, 0);
		assert.equal(planned[1].verticalProfile, "straight_circular");
		const segments = math.planVerticalRailSegments(...planned);
		assert.equal(segments.length, 2);
		assert(Math.abs(segments.at(-1)[1].position[1] - targetY) < 1e-6);
		assert.equal(
			geometry.plan(source, { ...ground, slopePermil: 10 }),
			null,
		);
		assert.equal(
			geometry.plan(source, { ...ground, length: length + 1 }),
			null,
		);
		assert.equal(geometry.plan(start, ground), null);
	}
}
assert.equal(geometry.groundDesignLength(connected, 100, 10000, 1000), null);
assert.equal(geometry.plan(connected, { ...design, groundTargetY: NaN }), null);
assert(geometry.plan(start, { ...design, length: 512 }));
assert.equal(geometry.plan(start, { ...design, length: 512.1 }), null);
for (const invalid of [
	{ length: NaN },
	{ length: 3000 },
	{ length: -1 },
	{ radius: 0 },
	{ radius: 2, length: 40 },
	{ slopePermil: Infinity },
])
	assert.equal(geometry.plan(start, { ...design, ...invalid }), null);
// Cursor Y derives from the selected start and grade, not the support under the cursor.
let looking = { posX: 11.25, posY: 100, posZ: -2.25 };
context.NGTOBuilderUtilClient = { getLookingPos: () => looking };
const builder = read("render_builder1");
const builderAlias = builder.match(
	/(\w+)\.SRBXApiCompat\.requiresRailBoundarySnap/,
)[1];
context[builderAlias] = {
	SRBXApiCompat: { requiresRailBoundarySnap: () => false },
};
vm.runInContext(
	fn(builder, "copyPoint") + fn(builder, "getFreeCursorPosition"),
	context,
);
const state = {
	selected: [start],
	slopePermil: 20,
	snapMode: "off",
	snapAngleIndex: 1,
};
assert(Math.abs(context.getFreeCursorPosition(0, state)[1] - 8.2625) < 0.001);
looking.posY = -20;
assert(Math.abs(context.getFreeCursorPosition(0, state)[1] - 8.2625) < 0.001);
state.snapMode = "block";
const cursor = context.getFreeCursorPosition(0, state);
assert.equal(cursor[0] * 2, Math.round(cursor[0] * 2));
assert(
	Math.abs(
		cursor[1] -
			(start.position[1] +
				math.horizontalDistance(start.position, cursor) * 0.02),
	) < 1e-8,
);
state.slopePermil = 0;
assert.equal(context.getFreeCursorPosition(0, state)[1], start.position[1]);
// A's endpoint planning must not feed subdivided horizontal anchors back
// into the full curve. Reproduce the logged 0 / 1 / 18 permil connection.
Object.assign(context, {
	MAX_CURVE_RADIUS: 10000,
	SRBXApiCompat: { requiresRailBoundarySnap: () => false },
	updateFreePointMarker: () => {},
	markerPositionForDirection: (p) => p.slice(),
});
for (const name of ["copyPoint", "orientPair"])
	vm.runInContext(fn(builder, name), context);
const loggedStart = {
	...start,
	kind: "rail",
	position: [-72.497, 4.063, 726.207],
	anchorYaw: 192.64657592773438,
	anchorPitch: 0,
};
const loggedEnd = {
	...start,
	position: [-84.65759076246961, 4.063, 681.7240074546563],
};
const controls = (p) => [
	p[0].position,
	math.pointAtYawPitchDistance(
		p[0].position,
		p[0].anchorYaw,
		0,
		p[0].anchorLength,
	),
	math.pointAtYawPitchDistance(
		p[1].position,
		p[1].anchorYaw,
		0,
		p[1].anchorLength,
	),
	p[1].position,
];
for (const reverse of [false, true]) {
	const sources = reverse
		? [loggedEnd, loggedStart]
		: [loggedStart, loggedEnd];
	const baseline = context.orientPair(...sources, {
		slopePermil: 0,
		verticalCurveRadius: 1000,
	});
	for (const grade of [-50, -18, -1, 1, 18, 50, 200]) {
		const oriented = context.orientPair(...sources, {
			slopePermil: grade,
			verticalCurveRadius: 1000,
		});
		assert(
			Math.abs(oriented[0].anchorLength - baseline[0].anchorLength) <
				1e-9,
		);
		assert(
			Math.abs(oriented[1].anchorLength - baseline[1].anchorLength) <
				1e-9,
		);
		const segments = math.planVerticalRailSegments(...oriented);
		const split =
			segments.length === 2
				? segments[0][0].anchorLength / baseline[0].anchorLength
				: 1;
		for (let i = 0; i < segments.length; i++) {
			for (let j = 0; j <= 20; j++) {
				const t = j / 20;
				const globalT = i === 0 ? t * split : split + t * (1 - split);
				const actual = math.cubicBezierPoint(
					...controls(segments[i]),
					t,
				);
				const expected = math.cubicBezierPoint(
					...controls(baseline),
					globalT,
				);
				assert(
					math.horizontalDistance(actual, expected) < 1e-7,
					`Horizontal cubic: reverse=${reverse}, grade=${grade}, piece=${i}`,
				);
			}
		}
	}
}
// Horizontal controls are independent of heights and pitches for all callers.
const circularFlat = math.circularConnection([0, 0, 0], 0, 0, [10, 0, 40]);
const circularGrade = math.circularConnection([0, 0, 0], 0, 15, [10, 20, 40]);
assert.equal(circularFlat.anchorLength, circularGrade.anchorLength);
assert.equal(circularFlat.radius, circularGrade.radius);
assert.equal(
	math.fixedPairAnchorLength([0, 0, 0], 0, 0, [10, 0, 40], 200, 0),
	math.fixedPairAnchorLength([0, 0, 0], 0, 15, [10, 20, 40], 200, -20),
);
// B lengths retain tenths and clamp safely at the allowed limits.
vm.runInContext(fn(builder, "changeDesignLength"), context);
const b = { designLength: 40 };
context.changeDesignLength(b, 0.1);
context.changeDesignLength(b, 0.1);
assert.equal(b.designLength, 40.2);
context.changeDesignLength(b, -1000);
assert.equal(b.designLength, 1);
context.changeDesignLength(b, 10000);
assert.equal(b.designLength, 512);
// Exercise the real B key/mouse handler, including a single-click start and Enter.
let wheel = 0,
	now = 1000,
	ctrl = false,
	held = new Set(),
	pressed = "",
	sent;
Object.assign(context, {
	builderB: true,
	MAX_CURVE_RADIUS: 10000,
	DEFAULT_VERTICAL_CURVE_RADIUS: 1000,
	Mouse: {
		getDWheel: () => {
			const value = wheel;
			wheel = 0;
			return value;
		},
	},
	System: { currentTimeMillis: () => now },
	Keyboard: {
		KEY_L: "L",
		KEY_J: "J",
		KEY_LEFT: "LEFT",
		KEY_RIGHT: "RIGHT",
		isKeyDown: (code) => held.has(code),
	},
	NGTLog: { sendChatMessage: () => {} },
	keys: {
		pressed: (key) => key === pressed,
		down: () => false,
		downOptionKey: () => ctrl,
	},
	repeatedKey: (s, key) => held.has(key),
	handleResult: () => {},
	boundaryPlanError: () => "",
	updateFreePointMarker: () => {},
	getHoverPoint: () => start,
	sendRequest: (e, s, request) => {
		sent = request;
		s.awaitingResult = true;
	},
});
vm.runInContext(read("SRBXAcceleratedRepeat"), context);
for (const name of [
	"createDefaultState",
	"getDesign",
	"getDesignPair",
	"changeCurveRadius",
	"initializeCurveStartYaw",
	"alignZeroSlopeEndpointToGround",
	"handleInput",
])
	vm.runInContext(fn(builder, name), context);
const input = context.createDefaultState();
context.getState = () => input;
const entity = {
	getResourceState: () => ({
		getDataMap: () => ({ getBoolean: () => false }),
	}),
};
const host = { rotationYaw: -90, field_70177_z: -90 };
const handle = (right = false) =>
	context.handleInput(host, entity, 0, right, false);
let guiRows;
context.SRBXToolGui = {
	render: (name, icon, rows) => {
		guiRows = rows;
	},
};
context.GUI_BUILDER2_ICON = 1;
vm.runInContext(fn(builder, "renderToolGui"), context);
// Minecraft yaw 0 faces +Z: left is +X, right is -X.
for (const [key, side, xSign] of [
	["LEFT", -1, 1],
	["RIGHT", 1, -1],
]) {
	Object.assign(input, context.createDefaultState());
	held.clear();
	handle();
	held.add(key);
	handle();
	assert.equal(input.curveSide, side);
	context.renderToolGui(input, null);
	assert.equal(guiRows[1].label, `${key === "LEFT" ? "L" : "R"} 9999 m`);
	const bent = geometry.plan(
		{ ...start, position: [0, 0, 0] },
		{
			...design,
			yaw: 0,
			radius: input.curveRadius * input.curveSide,
		},
	);
	assert.equal(Math.sign(bent[1].position[0]), xSign);
	// Overshoot straight with a Ctrl-sized step, then hold through repeats.
	held.clear();
	handle();
	held.add(key === "LEFT" ? "RIGHT" : "LEFT");
	ctrl = true;
	handle();
	assert.equal(input.curveRadius, 10000);
	assert.equal(input.radiusStraightStopped, true);
	now += 5000;
	handle();
	assert.equal(input.curveRadius, 10000, "Holding must stop at straight");
	ctrl = false;
	handle();
	assert.equal(
		input.curveRadius,
		10000,
		"Ctrl release alone cannot unlock straight",
	);
	held.clear();
	handle();
	held.add(key === "LEFT" ? "RIGHT" : "LEFT");
	handle();
	assert.equal(
		input.curveRadius,
		9999,
		"Release and repress continues beyond straight",
	);
	assert.equal(input.curveSide, -side);
}
held.clear();
ctrl = false;
Object.assign(input, context.createDefaultState());
handle();
assert.equal(input.designLength, 40);
wheel = 120;
handle();
assert.equal(input.designLength, 40, "Mouse wheel never changes B length");
wheel = -120;
ctrl = true;
handle();
assert.equal(input.designLength, 40);
ctrl = false;
held.add("J");
handle();
assert.equal(input.designLength, 39.9);
held.clear();
held.add("L");
handle();
assert.equal(input.designLength, 40);
held.clear();
handle();
ctrl = true;
held.add("L");
handle();
assert.equal(input.designLength, 50, "Ctrl starts at ten metres");
held.clear();
ctrl = false;
handle();
// A and B apply height keys only before selecting a free start.
held.add("startHeightUp");
handle();
assert.equal(input.heightOffsetSixteenths, 1);
held.clear();
held.add("startHeightDownFast");
handle();
assert.equal(input.heightOffsetSixteenths, -15);
held.clear();
handle(true);
assert.equal(input.selected.length, 1);
held.add("startHeightUp");
handle();
assert.equal(
	input.heightOffsetSixteenths,
	-15,
	"Height keys cannot move an already selected start",
);
held.clear();
handle(true);
assert.equal(input.selected.length, 1, "B has no independent end selection");
pressed = "build";
assert(
	context.getDesignPair(input),
	JSON.stringify({ input, design: context.getDesign(input) }),
);
handle();
assert.equal(sent.design.length, 50);
assert.equal(sent.start.position[0], start.position[0]);
assert(Math.abs(sent.end.position[0] - sent.start.position[0] - 50) < 1e-8);
assert.equal(
	input.selected.length,
	1,
	"Undo stores the start, not a computed endpoint",
);
input.awaitingResult = false;
input.selected = [connected];
input.designLength = 40;
input.slopePermil = 0;
input.curveRadius = 10000;
context.alignZeroSlopeEndpointToGround({}, input);
assert(
	input.groundTargetY !== undefined,
	"U can extend a preview too short for its vertical transition",
);
assert(input.designLength > 40 && input.designLength <= 512);
assert(context.getDesignPair(input));
const fixedStart = JSON.stringify(input.selected[0]);
context.changeDesignLength(input, 0.1);
assert.equal(
	input.groundTargetY,
	undefined,
	"Manual length changes clear ground extension",
);
assert.equal(JSON.stringify(input.selected[0]), fixedStart);
// A shares the capped repeat while its radius lock is active.
context.builderB = false;
input.selected = [];
input.curveRadiusLocked = true;
input.curveRadius = 100;
input.radiusRepeat.reset();
pressed = "";
held.add("RIGHT");
now = 20000;
handle();
assert.equal(input.curveRadius, 101);
now += 3200;
handle();
assert.equal(input.curveRadius, 140);
now += 75;
handle();
assert.equal(
	input.curveRadius,
	150,
	"A fixed radius uses 10m after the initial forty changes",
);
ctrl = true;
handle();
assert.equal(input.curveRadius, 250, "Ctrl resets A's repeat to a 100m start");
now += 3200;
handle();
assert.equal(input.curveRadius, 4150);
now += 75;
handle();
assert.equal(input.curveRadius, 4250, "Ctrl radius remains 100m per repeat");
input.curveRadius = 250;
input.curveRadiusLocked = false;
now += 10000;
handle();
assert.equal(
	input.curveRadius,
	250,
	"Unlocked radii do not change or accumulate repeats",
);
held.clear();
ctrl = false;
context.builderB = true;
// The server recomputes B geometry and ignores a forged endpoint from the client.
const server = read("server_builder1");
const alias = server.match(/(\w+)\.SRBXApiCompat\.getToolModel/)[1];
let createdPair,
	calls = 0;
const records = new Map();
const compat = {
	getWorld: () => ({}),
	getToolModel: () => "SuperRailBuilderX_builder2",
	requiresRailBoundarySnap: () => false,
	createBuilderRail: (w, h, a, b) => {
		calls++;
		createdPair = [a, b];
		return { status: "ok", undoCore: [0, 0, 0], undoKey: "rail" };
	},
	undoBuilderRail: () => "ok",
};
context[alias] = { SRBXApiCompat: compat };
context.undoRecords = {
	get: (e) => records.get(e),
	put: (e, r) => records.set(e, r),
	remove: (e) => records.delete(e),
};
context.NGTLog.debug = () => {};
vm.runInContext(fn(server, "processRequest"), context);
const serverEntity = {
	getResourceState: () => ({ getDataMap: () => ({ setBoolean: () => {} }) }),
};
assert.equal(
	context.processRequest(serverEntity, host, {
		action: "create",
		start,
		end: { position: [999999, 0, 0] },
		design,
	}),
	"ok",
);
assert(Math.abs(createdPair[1].position[0] - start.position[0] - 40) < 1e-8);
assert.equal(
	context.processRequest(serverEntity, host, {
		action: "create",
		start,
		end: start,
		design: { ...design, length: NaN },
	}),
	"invalid_design",
);
assert.equal(calls, 1, "Invalid designs do not write the world");
assert.equal(
	context.processRequest(serverEntity, host, { action: "undo" }),
	"undo_ok",
);
console.log(
	"Builder A target height/constant grade and B preset geometry/connection/validation passed",
);
