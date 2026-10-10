const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const dir = "dist/assets/minecraft/scripts/superrailbuilderx/";
const read = (name) => fs.readFileSync(dir + name + ".js", "utf8");
const catalog = read("SRBXTools");
const alias = "RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_1js5ute";
function setup() {
	const values = { hostPlayerEntityId: "7" },
		held = new Set();
	const data = {
		getBoolean: (key) => !!values[key],
		setBoolean: (key, value) => (values[key] = value),
		getString: (key) => values[key] || "",
		setString: (key, value) => (values[key] = value),
	};
	const player = { getEntityId: () => 7, func_145782_y: () => 7 };
	const entity = {
		getResourceState: () => ({ getDataMap: () => data }),
		field_70128_L: false,
	};
	let focused = 0,
		selected = -1,
		model = "SuperRailBuilderX_builder1",
		rider = player;
	const mc = {
		field_71462_r: null,
		field_71443_c: 800,
		field_71440_d: 600,
		func_147108_a(screen) {
			if (this.field_71462_r) this.field_71462_r.func_146281_b();
			this.field_71462_r = screen;
		},
		func_71381_h: () => focused++,
	};
	const compat = {
		getToolModel: () => model,
		getRidingEntity: () => rider,
		switchToolModel: (e, name) => {
			model = name;
			return true;
		},
	};
	const context = vm.createContext({
		Keyboard: {
			isKeyDown: (key) => held.has(key),
			KEY_TAB: "TAB",
			KEY_LEFT: "LEFT",
			KEY_RIGHT: "RIGHT",
			KEY_ESCAPE: "ESC",
		},
		Mouse: { isButtonDown: () => false, setCursorPosition: () => {} },
		NGTUtilClient: { getMinecraft: () => mc },
		MCWrapperClient: { getPlayer: () => player },
		NGTLog: { debug: () => {} },
		GuiScreen: function () {},
		Java: {
			extend: (type, overrides) =>
				function () {
					Object.assign(this, overrides);
				},
		},
		SRBXToolGui: {
			renderWheel: (value, choose) => {
				selected = choose(400, 300);
			},
		},
		[alias]: { SRBXApiCompat: compat },
	});
	vm.runInContext(catalog, context);
	const wheel = read("SRBXToolWheel");
	vm.runInContext(wheel.slice(wheel.indexOf("var wheelActive =")), context);
	const server = read("SRBXToolSwitchServer");
	vm.runInContext(
		server.slice(server.indexOf("var SRBXToolSwitchServer =")),
		context,
	);
	return {
		values,
		held,
		data,
		entity,
		player,
		mc,
		compat,
		context,
		open() {
			held.add("TAB");
			assert(context.SRBXToolWheel.update(entity, true));
			return mc.field_71462_r;
		},
		selected: () => selected,
		focused: () => focused,
		model: () => model,
		setRider(value) {
			rider = value;
		},
	};
}
let s = setup();
for (let i = 0; i < 6; i++) {
	const a = (i * Math.PI) / 3;
	assert.equal(
		s.context.wheelIndex(Math.sin(a) * 100, -Math.cos(a) * 100, 3),
		i,
	);
}
assert.equal(s.context.wheelIndex(0, 0, 4), 4);
let screen = s.open();
assert.equal(screen.func_73868_f(), false, "Multiplayer keeps running");
assert.equal(
	s.values.srbxToolSwitchRequest,
	undefined,
	"TAB press does not switch",
);
screen.func_73863_a(200, 150, 0);
screen.func_73869_a("", "RIGHT");
screen.func_73863_a(200, 150, 0);
assert.equal(s.selected(), 1, "Stationary mouse preserves arrow selection");
assert.equal(
	s.context.SRBXToolWheel.update(s.entity, true),
	true,
	"Wheel blocks tool input",
);
s.held.delete("TAB");
screen.func_73876_c();
assert.equal(s.values.srbxToolSwitchRequest, "SuperRailBuilderX_RailSplitter");
assert.equal(s.mc.field_71462_r, null);
assert.equal(s.focused(), 1);
assert(s.context.SRBXToolSwitchServer.update(s.entity, s.player));
assert.equal(s.model(), "SuperRailBuilderX_RailSplitter");
assert.equal(s.values.srbxToolSwitchRequest, "");
assert.equal(s.values.srbxToolSwitchResult, "ok");
assert.equal(
	s.context.SRBXToolSwitchServer.update(s.entity, s.player),
	false,
	"One request only",
);
s = setup();
screen = s.open();
screen.func_73863_a(287, 200, 0);
assert.equal(s.selected(), 2, "Mouse selects clockwise rail mover sector");
s.held.delete("TAB");
screen.func_73876_c();
assert.equal(s.values.srbxToolSwitchRequest, "SuperRailBuilderX_RailMover");
s = setup();
s.values.srbxWheelInputBlocked = true;
s.context.Mouse.isButtonDown = () => true;
assert(
	s.context.SRBXToolWheel.update(s.entity, true),
	"New renderer waits for held mouse buttons",
);
assert.equal(s.mc.field_71462_r, null);
s.context.Mouse.isButtonDown = () => false;
assert.equal(s.context.SRBXToolWheel.update(s.entity, true), false);
assert.equal(s.values.srbxWheelInputBlocked, false);
s = setup();
screen = s.open();
screen.func_73869_a("", "ESC");
assert.equal(s.values.srbxToolSwitchRequest, undefined, "ESC cancels");
assert(
	s.context.SRBXToolWheel.update(s.entity, true),
	"Held TAB after cancel cannot reopen",
);
s.held.clear();
assert.equal(s.context.SRBXToolWheel.update(s.entity, true), false);
s = setup();
screen = s.open();
s.entity.field_70128_L = true;
screen.func_73876_c();
assert.equal(s.mc.field_71462_r, null);
assert.equal(s.values.srbxToolSwitchRequest, undefined);
s = setup();
s.values.railPositionMove = "pending";
s.held.add("TAB");
assert(s.context.SRBXToolWheel.update(s.entity, true));
assert.equal(s.mc.field_71462_r, null);
for (const [target, status, busy, owner] of [
	["outside_pack", "invalid_tool", false, true],
	["SuperRailBuilderX_CantFormatter", "busy", true, true],
	["SuperRailBuilderX_CantFormatter", "invalid_tool", false, false],
]) {
	s = setup();
	s.values.srbxToolSwitchRequest = target;
	if (busy) s.values.railPositionMove = "pending";
	if (!owner) s.setRider({});
	assert.equal(
		s.context.SRBXToolSwitchServer.update(s.entity, s.player),
		false,
	);
	assert.equal(s.values.srbxToolSwitchResult, status);
	assert.equal(s.model(), "SuperRailBuilderX_builder1");
}
for (const status of ["missing_model", "internal_error"]) {
	s = setup();
	s.values.srbxToolSwitchRequest = "SuperRailBuilderX_CantFormatter";
	s.compat.switchToolModel = () => {
		if (status === "internal_error") throw Error("missing");
		return false;
	};
	assert.equal(
		s.context.SRBXToolSwitchServer.update(s.entity, s.player),
		false,
	);
	assert.equal(s.values.srbxToolSwitchResult, status);
}
for (const visible of [false, "throw"]) {
	s = setup();
	screen = s.open();
	s.context.SRBXToolGui.renderWheel = () => {
		if (visible === "throw") throw Error("GL");
		return false;
	};
	screen.func_73863_a(200, 150, 0);
	assert.equal(
		s.mc.field_71462_r,
		null,
		"Invisible/failed menu cancels safely",
	);
	assert.equal(s.values.srbxToolSwitchRequest, undefined);
}
for (const tool of [
	"builder1",
	"rail_splitter",
	"rail_mover",
	"double_track_copy",
	"cant_formatter",
	"branch_builder",
]) {
	assert(
		read("render_" + tool).includes("SRBXToolWheel.update("),
		tool + " client hook",
	);
	assert(
		read("server_" + tool).includes("SRBXToolSwitchServer.update("),
		tool + " server hook",
	);
}
assert(
	!read("SRBXToolWheel").includes("mc.displayGuiScreen("),
	"Close and open calls use runtime SRG names",
);
const gui = read("SRBXToolGui");
assert(
	!gui.includes("Gui.drawRect("),
	"Wheel rectangles use runtime SRG names",
);
console.log(
	"Tool wheel mouse/arrows/release/cancel/input isolation and server ownership/busy/model guards passed",
);
