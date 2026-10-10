const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const directory =
	"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx";
class RailCore {}
class SwitchCore extends RailCore {}
class SectionCore extends RailCore {}
const context = {
	RTMX_COMPAT_TARGETS: {},
	Packages: {
		jp: {
			ngt: {
				rtm: {
					rail: {
						TileEntityLargeRailCore: RailCore,
						TileEntityLargeRailSwitchCore: SwitchCore,
					},
				},
			},
		},
	},
	AppleExtendedRailCompat: {
		getLogicalPositions: (core) => core.positions,
		isSectionCore: (core) => core instanceof SectionCore,
	},
};
vm.createContext(context);
const filename = fs
	.readdirSync(directory)
	.find(
		(name) =>
			name.startsWith("SRBXApiCompat.") && name.endsWith(".compat.js"),
	);
vm.runInContext(
	fs.readFileSync(path.join(directory, filename), "utf8"),
	context,
);
const api = Object.values(context.RTMX_COMPAT_TARGETS.appleextended)[0]
	.SRBXApiCompat;
const start = { posX: 1, posY: 4, posZ: 2 };
const end = { posX: 25, posY: 4, posZ: 2 };
const section = new SectionCore();
section.positions = [start, end];
section.relocateRail = () => {
	throw new Error("physical relocation must not mutate a section group");
};

// Builder A, branch, cant and mover selectors share this eligibility check.
assert.strictEqual(api.getRailPositionUnsupportedReason(section), "");
assert.strictEqual(api.getEditableRailPositions(section)[0], start);
assert.strictEqual(api.getEditableRailPositions(section)[1], end);
assert.strictEqual(api.canMoveRailPosition(section), true);

// Builder A accepts the common 'switch' reason for endpoint-only selection.
assert.strictEqual(
	api.getRailPositionUnsupportedReason(new SwitchCore()),
	"switch",
);
assert.strictEqual(api.getRailPositionUnsupportedReason(null), "missing_core");
for (const positions of [null, [], [start], [null, end], [start, null]]) {
	const invalid = new SectionCore();
	invalid.positions = positions;
	assert.strictEqual(
		api.getRailPositionUnsupportedReason(invalid),
		"invalid_positions",
	);
}
const normal = new RailCore();
normal.positions = [start, end];
assert.strictEqual(api.getRailPositionUnsupportedReason(normal), "");
assert.strictEqual(api.canMoveRailPosition(normal), true);
console.log("AppleExtended logical rail selection tests passed");
