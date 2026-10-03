const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const down = new Set();
const Keyboard = {
	KEY_NONE: 0,
	KEY_LCONTROL: 29,
	KEY_RCONTROL: 157,
	KEY_Z: 44,
	isKeyDown: (key) => down.has(key),
};
const context = {
	Packages: {
		org: { lwjgl: { input: { Keyboard } } },
		java: { lang: { System: { currentTimeMillis: () => 1 } } },
	},
};
vm.createContext(context);
for (const file of [
	"lib_hi03toolkit_1_0/lib_InputManager.js",
	"superrailbuilderx/SRBXInputManager.js",
])
	vm.runInContext(
		fs.readFileSync(`dist/assets/minecraft/scripts/${file}`, "utf8"),
		context,
	);
const keys = new context.SRBXInputManager();
keys.setOptionKey(Keyboard.KEY_LCONTROL);
keys.register("undo", Keyboard.KEY_Z, true, "undo");
for (const control of [Keyboard.KEY_LCONTROL, Keyboard.KEY_RCONTROL]) {
	down.add(control);
	down.add(Keyboard.KEY_Z);
	keys.update();
	assert.strictEqual(keys.pressed("undo"), true);
	keys.update();
	assert.strictEqual(keys.pressed("undo"), false);
	down.clear();
	keys.update();
}
down.add(Keyboard.KEY_Z);
keys.update();
assert.strictEqual(keys.pressed("undo"), false);
console.log("Undo Ctrl input edge tests passed");
