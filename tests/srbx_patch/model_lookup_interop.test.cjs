// Run after pnpm build: node tests/srbx_patch/model_lookup_interop.test.cjs <JDK 8 home>
const fs = require("fs"),
	path = require("path"),
	assert = require("assert"),
	{ spawnSync } = require("child_process");
const vm = require("vm");
for (const target of ["kaizpatch", "mc1710"]) {
	const dir = `dist/assets/minecraft/__targets__/${target}/scripts/superrailbuilderx`;
	const file = fs
		.readdirSync(dir)
		.find((name) => /^SRBXApiCompat(?:\.|\.js$)/.test(name));
	const compiled = fs.readFileSync(path.join(dir, file), "utf8");
	const method = compiled.match(
		/SRBXApiCompat\.switchToolModel = function \(entity, model\) \{[\s\S]*?\n\s+\};/,
	);
	assert(method, target + ": compiled switch method missing");
	for (const available of [false, true]) {
		const calls = [];
		const vehicle = {
			getModelType: () => "ModelVehicle",
			setModelName: (name) => calls.push(["set", name]),
			getModelSet: () => calls.push(["refresh"]),
		};
		const context = vm.createContext({
			SRBXApiCompat: {},
			SRBXServerModelLookup: {
				hasModel(entity, type, model) {
					assert.strictEqual(entity, vehicle);
					assert.equal(type, "ModelVehicle");
					assert.equal(model, "target");
					return available;
				},
			},
		});
		vm.runInContext(method[0], context);
		assert.equal(
			context.SRBXApiCompat.switchToolModel(vehicle, "target"),
			available,
		);
		assert.deepEqual(
			calls,
			available ? [["set", "target"], ["refresh"]] : [],
		);
	}
}
const home = process.argv[2] || process.env.JAVA8_HOME || process.env.JAVA_HOME;
assert(home, "Specify a JDK 8 home argument or JAVA8_HOME");
const exe = (name) =>
	path.join(home, "bin", name + (process.platform === "win32" ? ".exe" : ""));
function run(command, args) {
	const result = spawnSync(command, args, { encoding: "utf8" });
	if (result.error) throw result.error;
	assert.equal(result.status, 0, result.stdout + result.stderr);
	return result.stdout + result.stderr;
}
assert.match(run(exe("java"), ["-version"]), /version "1\.8\./);
const root = path.resolve(".cache/model-lookup-interop"),
	fixtures = path.join(root, "fixtures"),
	harness = path.join(root, "harness");
fs.mkdirSync(fixtures, { recursive: true });
fs.mkdirSync(harness, { recursive: true });
const sources = {
	"jp/ngt/ngtlib/renderer/model/IModelNGT.java":
		"package jp.ngt.ngtlib.renderer.model; public interface IModelNGT {}",
	"fixture/Context.java": "package fixture; public class Context {}",
	"jp/ngt/rtm/modelpack/modelset/ModelSetBase.java": `package jp.ngt.rtm.modelpack.modelset;
public class ModelSetBase {
  private final boolean dummy;
  public ModelSetBase(boolean value) { dummy = value; }
  public boolean isDummy() { return dummy; }
  public jp.ngt.ngtlib.renderer.model.IModelNGT renderer() { return null; }
}`,
	"jp/ngt/rtm/modelpack/ModelPackManager.java": `package jp.ngt.rtm.modelpack;
import jp.ngt.rtm.modelpack.modelset.ModelSetBase;
public class ModelPackManager {
  public static final ModelPackManager INSTANCE = new ModelPackManager();
  public static int calls;
  public ModelSetBase getModelSet(String type, String model) {
    calls++;
    if (!"ModelVehicle".equals(type)) throw new IllegalArgumentException("model type changed");
    if ("throw".equals(model)) throw new IllegalStateException("native model lookup rejected");
    if (model == null || "missing".equals(model)) return null;
    return new ModelSetBase("dummy".equals(model));
  }
  public jp.ngt.ngtlib.renderer.model.IModelNGT renderer() { return null; }
}`,
};
const files = Object.entries(sources).map(([name, source]) => {
	const file = path.join(fixtures, name);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, source);
	return file;
});
run(exe("javac"), ["-d", fixtures, ...files]);
const javaSource = `import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import javax.script.*;
import jdk.nashorn.api.scripting.NashornScriptEngineFactory;
public class ModelLookupInteropFixture {
  static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  public static void main(String[] args) throws Exception {
    ClassLoader loader = new URLClassLoader(new URL[]{new File(args[0]).toURI().toURL()}, null) {
      protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
        if (name.equals("jp.ngt.ngtlib.renderer.model.IModelNGT")) throw new ClassNotFoundException("dedicated server excludes " + name);
        return super.loadClass(name, resolve);
      }
    };
    Class<?> manager = Class.forName("jp.ngt.rtm.modelpack.ModelPackManager", false, loader);
    try { manager.getMethods(); throw new AssertionError("fixture must reproduce client class resolution failure"); }
    catch (NoClassDefFoundError expected) { check(expected.getMessage().contains("IModelNGT"), "wrong missing class"); }
    ScriptEngine engine = new NashornScriptEngineFactory().getScriptEngine(loader);
    engine.put("context", Class.forName("fixture.Context", false, loader).newInstance());
    try {
      engine.eval("Java.type('jp.ngt.rtm.modelpack.ModelPackManager').INSTANCE.getModelSet('ModelVehicle', 'valid')");
      throw new AssertionError("direct Nashorn lookup must fail");
    } catch (NoClassDefFoundError expected) { check(expected.getMessage().contains("IModelNGT"), "wrong direct lookup failure"); }
    engine.eval(new String(Files.readAllBytes(Paths.get(args[1])), StandardCharsets.UTF_8));
    check(Boolean.FALSE.equals(engine.eval("SRBXServerModelLookup.hasModel(context, 'ModelVehicle', 'missing')")), "missing model accepted");
    check(Boolean.FALSE.equals(engine.eval("SRBXServerModelLookup.hasModel(context, 'ModelVehicle', null)")), "null model accepted");
    check(Boolean.FALSE.equals(engine.eval("SRBXServerModelLookup.hasModel(context, 'ModelVehicle', 'dummy')")), "dummy model accepted");
    check(Boolean.TRUE.equals(engine.eval("SRBXServerModelLookup.hasModel(context, 'ModelVehicle', 'valid')")), "valid model rejected");
    check(Boolean.TRUE.equals(engine.eval("var cachedMethods = SRBXServerModelLookup.methods; SRBXServerModelLookup.hasModel(context, 'ModelVehicle', 'valid') && cachedMethods === SRBXServerModelLookup.methods")), "cached lookup failed");
    check(Boolean.FALSE.equals(engine.eval("SRBXServerModelLookup.hasModel(context, 'ModelVehicle', 'dummy')")), "cached lookup reused previous result");
    Object propagated = engine.eval("var propagated = false; try { SRBXServerModelLookup.hasModel(context, 'ModelVehicle', 'throw'); } catch (e) { propagated = String(e).indexOf('InvocationTargetException') >= 0 || String(e).indexOf('native model lookup rejected') >= 0; } propagated");
    check(Boolean.TRUE.equals(propagated), "native lookup exception swallowed");
    System.out.println("Java 8/Nashorn model lookup: direct missing IModelNGT reproduced; missing/null/dummy/valid, repeated cache access and native exception propagation passed");
  }
}`;
const harnessFile = path.join(root, "ModelLookupInteropFixture.java");
fs.writeFileSync(harnessFile, javaSource);
run(exe("javac"), ["-d", harness, harnessFile]);
const compiled = path.resolve(
	"dist/assets/minecraft/scripts/superrailbuilderx/SRBXServerModelLookup.js",
);
assert(
	fs.existsSync(compiled),
	"Build SRBXServerModelLookup before running this test",
);
process.stdout.write(
	run(exe("java"), [
		"-cp",
		harness,
		"ModelLookupInteropFixture",
		fixtures,
		compiled,
	]),
);
