// Run after pnpm build: node tests/srbx_patch/dedicated_server_interop.test.cjs <JDK 8 home>
// JAVA8_HOME or JAVA_HOME may also specify the JDK. Generated files stay in .cache.
const fs = require("fs"),
	path = require("path"),
	assert = require("assert"),
	{ spawnSync } = require("child_process");
const home = process.argv[2] || process.env.JAVA8_HOME || process.env.JAVA_HOME;
assert(home, "Specify a JDK 8 home argument or set JAVA8_HOME");
const exe = (name) =>
	path.join(home, "bin", name + (process.platform === "win32" ? ".exe" : ""));
function run(command, args) {
	const result = spawnSync(command, args, { encoding: "utf8" });
	if (result.error) throw result.error;
	assert.equal(result.status, 0, result.stdout + result.stderr);
	return result.stdout + result.stderr;
}
assert.match(run(exe("java"), ["-version"]), /version "1\.8\./);
const root = path.resolve(".cache/dedicated-server-interop"),
	fixtureDir = path.join(root, "fixtures"),
	harnessDir = path.join(root, "harness");
fs.mkdirSync(fixtureDir, { recursive: true });
fs.mkdirSync(harnessDir, { recursive: true });
const fixtureSources = {
	"net/minecraft/client/util/ITooltipFlag.java":
		"package net.minecraft.client.util; public interface ITooltipFlag {}",
	"net/minecraft/world/World.java":
		"package net.minecraft.world; public class World {}",
	"jp/ngt/rtm/modelpack/state/ResourceStateRail.java":
		"package jp.ngt.rtm.modelpack.state; public class ResourceStateRail {}",
	"jp/ngt/rtm/rail/BadBase.java":
		"package jp.ngt.rtm.rail; public class BadBase { public void addInformation(net.minecraft.client.util.ITooltipFlag flag) {} }",
	"jp/ngt/rtm/rail/BlockMarker.java": `package jp.ngt.rtm.rail;
public class BlockMarker extends BadBase {
  public static Object[] lastArgs;
  public static boolean createRail(net.minecraft.world.World world, int x, int y, int z,
      java.util.List positions, jp.ngt.rtm.modelpack.state.ResourceStateRail property,
      boolean setRail, boolean creative) {
    if(x == Integer.MIN_VALUE) throw new IllegalStateException("native placement rejected");
    lastArgs = new Object[]{world, x, y, z, positions, property, setRail, creative};
    return setRail;
  }
}`,
};
const files = Object.entries(fixtureSources).map(([name, source]) => {
	const filename = path.join(fixtureDir, name);
	fs.mkdirSync(path.dirname(filename), { recursive: true });
	fs.writeFileSync(filename, source);
	return filename;
});
run(exe("javac"), ["-d", fixtureDir, ...files]);
run(exe("javac"), [
	"-d",
	harnessDir,
	"tests/srbx_patch/DedicatedServerInteropFixture.java",
]);
const dist =
	"dist/assets/minecraft/__targets__/appleextended/scripts/superrailbuilderx";
const compiledFile = fs
	.readdirSync(dist)
	.find((name) => /^AppleExtendedRailCompat(?:\.|\.js$)/.test(name));
assert(compiledFile, "Build AppleExtendedRailCompat before running this test");
const source = fs.readFileSync(path.join(dist, compiledFile), "utf8"),
	match =
		/^([\t ]*)AppleExtendedRailCompat\.createNativeRail = (function )/m.exec(
			source,
		);
assert(match, "Missing compiled native rail bridge");
const begin = match.index + match[0].length - match[2].length,
	end = source.indexOf("\n" + match[1] + "};", begin);
assert(end > begin, "Missing compiled native rail bridge closing brace");
const bridge = source.slice(begin, end + 1 + match[1].length + 1);
const bridgeFile = path.join(root, "bridge.js");
fs.writeFileSync(
	bridgeFile,
	`var bridge = {nativeCreateRailMethod: null, createNativeRail: ${bridge}};`,
);
process.stdout.write(
	run(exe("java"), [
		"-cp",
		harnessDir,
		"DedicatedServerInteropFixture",
		fixtureDir,
		bridgeFile,
	]),
);
