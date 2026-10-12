const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const ts = require("../../node_modules/.pnpm/node_modules/typescript");
const source = fs.readFileSync(
	"src/common/assets/minecraft/scripts/superrailbuilderx/SRBXAcceleratedRepeat.ts",
	"utf8",
);
const context = { exports: {} };
vm.runInNewContext(
	ts.transpileModule(source, {
		compilerOptions: {
			target: ts.ScriptTarget.ES5,
			module: ts.ModuleKind.CommonJS,
		},
	}).outputText,
	context,
);
const Repeat = context.exports.SRBXAcceleratedRepeat;
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8);
const repeat = new Repeat();
close(repeat.update(0, 1, 0.1), 0.1);
close(repeat.update(349, 1, 0.1), 0);
close(repeat.update(350, 1, 0.1), 0.1);
close(repeat.update(350, 1, 0.1), 0);
close(repeat.update(424, 1, 0.1), 0);
close(repeat.update(425, 1, 0.1), 0.1);
// The fortieth change still uses 0.1 m; the next uses 1 m.
close(repeat.update(3200, 1, 0.1), 3.7);
close(repeat.update(3275, 1, 0.1), 1);
close(repeat.update(5900, 1, 0.1), 35);
close(repeat.update(5975, 1, 0.1), 1);
close(repeat.update(120050, 1, 0.1), 1521);
close(repeat.update(120125, 1, 0.1), 1);
// Direction, Ctrl, key release and backwards clocks start a new hold.
close(repeat.update(6300, -1, 0.1), -0.1);
close(repeat.update(6320, -1, 10), -10);
close(repeat.update(6400, 0, 10), 0);
close(repeat.update(6500, 1, 10), 10);
close(repeat.update(6499, 1, 10), 10);
repeat.reset();
close(repeat.update(0, 1, 10), 10);
close(repeat.update(3200, 1, 10), 390);
close(repeat.update(3275, 1, 10), 100);
// Different render rates produce the same accumulated changes.
function totalAt(interval) {
	const input = new Repeat();
	let total = input.update(0, 1, 0.1);
	for (let now = interval; now < 7000; now += interval)
		total += input.update(now, 1, 0.1);
	return total + input.update(7000, 1, 0.1);
}
close(totalAt(16), totalAt(1500));
close(totalAt(1500), totalAt(7000));
close(repeat.update(NaN, 1, 10), 0);
close(repeat.update(7000, 1, 0), 0);
close(repeat.update(7001, 1, 0.1), 0.1);
console.log("Accelerated numeric key repeat regression passed");
