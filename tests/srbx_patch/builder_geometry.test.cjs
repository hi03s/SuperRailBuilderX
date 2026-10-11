const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const context = vm.createContext({
	builderB: false,
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
// B lengths retain tenths and clamp safely at the allowed limits.
vm.runInContext(fn(builder, "changeDesignLength"), context);
const b = { designLength: 40 };
context.changeDesignLength(b, 0.1);
context.changeDesignLength(b, 0.1);
assert.equal(b.designLength, 40.2);
context.changeDesignLength(b, -1000);
assert.equal(b.designLength, 1);
context.changeDesignLength(b, 10000);
assert.equal(b.designLength, 2048);
// Exercise the real B key/mouse handler, including a single-click start and Enter.
let wheel = 0,
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
	Keyboard: { KEY_LCONTROL: 29, isKeyDown: () => ctrl },
	NGTLog: { sendChatMessage: () => {} },
	keys: { pressed: (key) => key === pressed, down: () => false },
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
for (const name of [
	"createDefaultState",
	"getDesign",
	"getDesignPair",
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
assert.equal(input.designLength, 40);
wheel = 120;
handle();
assert.equal(input.designLength, 41);
wheel = -120;
ctrl = true;
handle();
assert.equal(input.designLength, 31);
ctrl = false;
held.add("lengthDecrease");
handle();
assert.equal(input.designLength, 30.9);
held.clear();
held.add("lengthIncrease");
handle();
assert.equal(input.designLength, 31);
held.clear();
handle(true);
assert.equal(input.selected.length, 1);
handle(true);
assert.equal(input.selected.length, 1, "B has no independent end selection");
pressed = "build";
assert(
	context.getDesignPair(input),
	JSON.stringify({ input, design: context.getDesign(input) }),
);
handle();
assert.equal(sent.design.length, 31);
assert.equal(sent.start.position[0], start.position[0]);
assert(Math.abs(sent.end.position[0] - sent.start.position[0] - 31) < 1e-8);
assert.equal(
	input.selected.length,
	1,
	"Undo stores the start, not a computed endpoint",
);
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
