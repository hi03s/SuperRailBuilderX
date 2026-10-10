const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const source = fs.readFileSync(dir + "render_builder1.js", "utf8");
let looking = { posX: -2.24, posY: 4.21, posZ: 3.76 };
const context = vm.createContext({
	DEFAULT_RAIL_HEIGHT: 1 / 16,
	snapAngles: [1, 5, 15],
	NGTOBuilderUtilClient: { getLookingPos: () => looking },
});
vm.runInContext(fs.readFileSync(dir + "SRBXMath.js", "utf8"), context);
vm.runInContext(
	source.slice(
		source.indexOf("function copyPoint("),
		source.indexOf("function freeMarkerPosition("),
	),
	context,
);
const state = {
	snapMode: "block",
	snapAngleIndex: 1,
	heightOffsetSixteenths: 0,
	selected: [],
};
const cursor = () => Array.from(context.getFreeCursorPosition(0, state));
assert.deepStrictEqual(cursor(), [-2, 4.0625, 4]);
state.selected = [{ kind: "free", position: [0.13, 4.0625, 0.27] }];
assert.deepStrictEqual(
	cursor(),
	[-2, 4.0625, 4],
	"World grid ignores free start position",
);
state.snapAngleIndex = 2;
assert.deepStrictEqual(
	cursor(),
	[-2, 4.0625, 4],
	"Block mode ignores angle setting",
);
state.selected = [{ kind: "rail", position: [0, 1, 0], anchorPitch: 20 }];
assert.deepStrictEqual(
	cursor(),
	[-2, 4.0625, 4],
	"Block grid does not inherit endpoint pitch",
);
state.heightOffsetSixteenths = 8;
assert.deepStrictEqual(
	cursor(),
	[-2, 4.5625, 4],
	"Height offset is applied before grid snapping",
);
state.heightOffsetSixteenths = 0;
state.snapMode = "off";
state.selected = [];
looking = { posX: 2.2344, posY: 4, posZ: 3.7654 };
assert.deepStrictEqual(
	cursor(),
	[2.234, 4.063, 3.765],
	"OFF retains precise cursor",
);
state.snapMode = "distance";
assert.deepStrictEqual(
	cursor(),
	[2, 4.0625, 4],
	"Distance mode keeps legacy first-point grid",
);
const start = { kind: "free", position: [0, 4.0625, 0] };
state.selected = [start];
state.snapAngleIndex = 1;
const math = context.SRBXMath;
const result = cursor();
assert(
	Math.abs(math.distance(start.position, result) - 4.5) < 0.001,
	"Distance remains snapped to 0.5 m",
);
assert(
	Math.abs(math.horizontalYaw(start.position, result) - 30) < 0.01,
	"Yaw remains snapped to 5 degrees",
);
state.snapMode = "block";
assert.deepStrictEqual(cursor(), [2, 4.0625, 4]);
assert(
	Math.abs(math.distance(start.position, cursor()) - 4.5) > 0.01,
	"Block mode does not snap distance",
);
assert(
	Math.abs(math.horizontalYaw(start.position, cursor()) - 30) > 0.01,
	"Block mode does not snap yaw",
);
assert.deepStrictEqual(
	start.position,
	[0, 4.0625, 0],
	"Cursor never changes selected endpoint",
);
looking = null;
assert.equal(context.getFreeCursorPosition(0, state), null);
// Exercise the real key handler: selection clear preserves the mode; reset restores OFF.
Object.assign(context, {
	MAX_CURVE_RADIUS: 10000,
	DEFAULT_VERTICAL_CURVE_RADIUS: 1000,
	repeatedKey: () => false,
	handleResult: () => {},
	NGTLog: { sendChatMessage: () => {} },
});
vm.runInContext(
	source.slice(
		source.indexOf("function createDefaultState("),
		source.indexOf("function copyPoint("),
	),
	context,
);
const inputState = context.createDefaultState();
context.states = { get: () => inputState };
let pressed = "snap";
context.keys = { pressed: (name) => name === pressed, down: () => false };
vm.runInContext(
	source.slice(
		source.indexOf("function handleInput("),
		source.indexOf("function render("),
	),
	context,
);
const entity = { getResourceState: () => ({ getDataMap: () => ({}) }) };
const handle = () => context.handleInput({}, entity, 0, false, false);
for (const mode of ["distance", "block", "off", "distance", "block"]) {
	handle();
	assert.equal(inputState.snapMode, mode);
}
pressed = "clear";
inputState.selected = [start];
handle();
assert.equal(inputState.snapMode, "block");
assert.equal(inputState.selected.length, 0);
pressed = "reset";
inputState.lastBuiltSelection = [start];
handle();
assert.equal(inputState.snapMode, "off");
assert.equal(
	inputState.lastBuiltSelection[0],
	start,
	"Reset retains Undo selection",
);
console.log(
	"Builder1 block grid, negative coordinates, endpoint pitch and legacy distance/OFF snapping passed",
);
