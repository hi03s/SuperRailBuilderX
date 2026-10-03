const fs = require("fs");
const vm = require("vm");

// Exercise the built dispatcher, including target priority and compat fallback.
for (const file of [
	"dist/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat.compat.js",
	"dist/assets/minecraft/scripts/srbx_patch/platform.compat.js",
]) {
	const source = fs.readFileSync(file, "utf8");
	for (const [version, mods, expected] of [
		["2.4.24", ["applelib"], "appleextended"],
		["2.4.24", [], "mc1122"],
		["1.7.10", [], "mc1710"],
		["KaizPatchX", [], "kaizpatch"],
		["KaizPatchX", ["applelib"], "kaizpatch"],
	]) {
		const context = {
			Packages: {
				jp: { ngt: { rtm: { RTMCore: { VERSION: version } } } },
				net: {
					minecraftforge: {
						fml: {
							common: {
								Loader: {
									isModLoaded: (id) => mods.includes(id),
								},
							},
						},
					},
				},
			},
		};
		vm.runInNewContext(source, context);
		for (const name of Object.keys(context)) {
			const match =
				/^RTMX_loadCompatTarget_(kaizpatch|mc1710|appleextended|mc1122)_/.exec(
					name,
				);
			if (match) context[name] = () => ({ selectedTarget: match[1] });
		}
		const selector = Object.keys(context).find((name) =>
			name.startsWith("RTMX_selectCompatTarget_"),
		);
		if (!selector) throw new Error(`dispatcher selector missing: ${file}`);
		const actual = context[selector]().selectedTarget;
		if (actual !== expected)
			throw new Error(
				`${file}: ${version}/${mods}: expected ${expected}, got ${actual}`,
			);
	}
}
console.log("runtime dispatch tests passed");
