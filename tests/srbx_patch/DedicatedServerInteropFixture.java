import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.*;
import javax.script.*;
import jdk.nashorn.api.scripting.NashornScriptEngineFactory;

/** Executes the compiled SRBX bridge with the game's Java 8 JS engine. */
public final class DedicatedServerInteropFixture {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) throws Exception {
        URL root = new File(args[0]).toURI().toURL();
        ClassLoader loader = new URLClassLoader(new URL[]{root}, null) {
            @Override protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
                if (name.startsWith("net.minecraft.client.")) throw new ClassNotFoundException("dedicated server excludes " + name);
                return super.loadClass(name, resolve);
            }
        };
        Class<?> marker = Class.forName("jp.ngt.rtm.rail.BlockMarker", false, loader);
        try {
            marker.getMethods();
            throw new AssertionError("fixture must reproduce the inherited missing client type");
        } catch (NoClassDefFoundError expected) {
            check(expected.getMessage().contains("ITooltipFlag"), "unexpected missing type");
        }
        Object world = Class.forName("net.minecraft.world.World", false, loader).getDeclaredConstructor().newInstance();
        Object property = Class.forName("jp.ngt.rtm.modelpack.state.ResourceStateRail", false, loader).getDeclaredConstructor().newInstance();
        List<String> positions = Arrays.asList("start", "end");
        ScriptEngine engine = new NashornScriptEngineFactory().getScriptEngine(loader);
        engine.eval(new String(Files.readAllBytes(Paths.get(args[1])), StandardCharsets.UTF_8));
        engine.put("world", world);
        engine.put("property", property);
        engine.put("positions", positions);
        try {
            engine.eval("Java.type('jp.ngt.rtm.rail.BlockMarker').createRail(world, -31, 4, 67, positions, property, true, false)");
            throw new AssertionError("normal Nashorn lookup must fail");
        } catch (NoClassDefFoundError expected) {
            check(expected.getMessage().contains("ITooltipFlag"), "unexpected direct lookup failure");
        }
        check(Boolean.TRUE.equals(engine.eval("bridge.createNativeRail(world, -31, 4, 67, positions, property, true, false)")), "native true result lost");
        Object[] actual = (Object[])marker.getDeclaredField("lastArgs").get(null);
        Object[] expected = {world, -31, 4, 67, positions, property, true, false};
        check(Arrays.equals(actual, expected), "native arguments changed");
        check(actual[0] == world && actual[4] == positions && actual[5] == property, "native object identity changed");
        check(Boolean.TRUE.equals(engine.eval("var cached = bridge.nativeCreateRailMethod; !bridge.createNativeRail(world, 1, 2, 3, positions, property, false, true) && cached === bridge.nativeCreateRailMethod")), "false result or cached method lost");
        Object exceptionPropagated = engine.eval("var propagated = false; try { bridge.createNativeRail(world, -2147483648, 0, 0, positions, property, true, true); } catch(e) { propagated = String(e).indexOf('InvocationTargetException') >= 0 || String(e).indexOf('native placement rejected') >= 0; } propagated");
        check(Boolean.TRUE.equals(exceptionPropagated), "native placement exception swallowed");
        System.out.println("Java 8/Nashorn dedicated-server bridge: direct lookup failure, native arguments, true/false, method cache and native exception propagation passed");
    }
}
