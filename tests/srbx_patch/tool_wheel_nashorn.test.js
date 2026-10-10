// jjs -cp artifacts/test-classes -scripting tests/srbx_patch/tool_wheel_nashorn.test.js
var GuiScreen = Java.type("ToolWheelScreenFixture");
var values = { hostPlayerEntityId: "7" },
	tab = true;
var data = {
	getBoolean: function (key) {
		return !!values[key];
	},
	setBoolean: function (key, value) {
		values[key] = value;
	},
	getString: function (key) {
		return values[key] || "";
	},
	setString: function (key, value) {
		values[key] = value;
	}
};
var entity = {
	field_70128_L: false,
	getResourceState: function () {
		return {
			getDataMap: function () {
				return data;
			}
		};
	}
};
var mc = {
	field_71462_r: null,
	field_71443_c: 800,
	field_71440_d: 600,
	func_147108_a: function (screen) {
		if (this.field_71462_r) this.field_71462_r.func_146281_b();
		this.field_71462_r = screen;
	},
	func_71381_h: function () {}
};
var NGTUtilClient = {
	getMinecraft: function () {
		return mc;
	}
};
var MCWrapperClient = {
	getPlayer: function () {
		return {
			func_145782_y: function () {
				return 7;
			}
		};
	}
};
var NGTLog = { debug: function () {} };
var Keyboard = {
	KEY_TAB: 15,
	KEY_LEFT: 203,
	KEY_RIGHT: 205,
	KEY_ESCAPE: 1,
	isKeyDown: function (key) {
		return key === 15 && tab;
	}
};
var Mouse = {
	isButtonDown: function () {
		return false;
	},
	setCursorPosition: function () {}
};
var SRBXToolGui = {
	renderWheel: function (selected, choose) {
		choose(400, 300);
	}
};
var RTMX_COMPAT_scripts_superrailbuilderx_SRBXApiCompat_1js5ute = {
	SRBXApiCompat: {
		getToolModel: function () {
			return "SuperRailBuilderX_builder1";
		}
	}
};
eval(readFully("dist/assets/minecraft/scripts/superrailbuilderx/SRBXTools.js"));
var source = readFully(
	"dist/assets/minecraft/scripts/superrailbuilderx/SRBXToolWheel.js"
);
eval(source.slice(source.indexOf("var wheelActive =")));
if (!SRBXToolWheel.update(entity, true)) throw new Error("Wheel not opened");
var screen = mc.field_71462_r;
if (screen.func_73868_f()) throw new Error("Wheel pauses game");
screen.func_73863_a(200, 150, 0);
screen.press(205);
screen.func_73863_a(200, 150, 0);
if (values.srbxToolSwitchRequest) throw new Error("Switch before release");
tab = false;
screen.func_73876_c();
if (values.srbxToolSwitchRequest !== "SuperRailBuilderX_RailSplitter")
	throw new Error("SRG callback release failed");
if (mc.field_71462_r !== null) throw new Error("Screen did not close");
print(
	"Legacy Java 8 Nashorn Java.extend SRG screen dispatch, arrows, release and non-pausing behavior passed"
);
SRBXToolWheel.update(entity, true);
tab = true;
SRBXToolWheel.update(entity, true);
screen = mc.field_71462_r;
screen.click(287, 200, 0);
if (
	values.srbxToolSwitchRequest !== "SuperRailBuilderX_RailMover" ||
	mc.field_71462_r !== null
)
	throw new Error("SRG left-click callback failed");
print("Legacy Nashorn left-click decision and SRG screen dimensions passed");
