package jp.hi03.srbxmod;

import java.lang.reflect.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Reflection keeps Minecraft/SRG references out of the coremod. Metadata is cached per class;
 * worlds, cores, maps and bogies are never cached. A failure delegates to KaizPatch.
 */
public final class FreeEndpointHook {
    private static final AtomicBoolean warned = new AtomicBoolean();
    private static volatile boolean healthy = true;
    public static boolean isHealthy() { return healthy; }
    private static final ClassValue<Members> members = new ClassValue<Members>() {
        protected Members computeValue(Class<?> type) { return new Members(type); }
    };
    public static Object retainCurrent(Object bogie, double x, double y, double z) {
        if (!EndpointGeometry.finite(x) || !EndpointGeometry.finite(y) || !EndpointGeometry.finite(z)) return null;
        try {
            Object world = field(bogie, "worldObj", "field_70170_p");
            if (world == null || (Boolean) field(world, "isRemote", "field_72995_K")) return null;
            Object core = field(bogie, "currentRailObj"), map = field(bogie, "currentRailMap");
            int split = ((Number) field(bogie, "split")).intValue();
            int previous = ((Number) field(bogie, "prevPosIndex")).intValue();
            if (core == null || map == null || split <= 0 || previous < 0 || previous > split) return null;
            int cx = number(core, "xCoord", "field_145851_c").intValue();
            int cy = number(core, "yCoord", "field_145848_d").intValue();
            int cz = number(core, "zCoord", "field_145849_e").intValue();
            if (!(Boolean) call(world, "blockExists|func_72899_e", cx, cy, cz)) return null;
            if (call(world, "getTileEntity|func_147438_o", cx, cy, cz) != core) return null;
            Object maps = call(core, "getAllRailMaps");
            boolean live = false;
            if (maps != null) for (int i = 0; i < Array.getLength(maps); i++) live |= Array.get(maps, i) == map;
            if (!live) return null;
            Object start = call(map, "getStartRP"), end = call(map, "getEndRP");
            double sx = number(start, "posX").doubleValue(), sz = number(start, "posZ").doubleValue();
            double ex = number(end, "posX").doubleValue(), ez = number(end, "posZ").doubleValue();
            double bx = number(bogie, "posX", "field_70165_t").doubleValue();
            double bz = number(bogie, "posZ", "field_70161_v").doubleValue();
            double movement = Math.hypot(x - bx, z - bz);
            if (!EndpointGeometry.finite(movement) || movement > 10.0) return null;
            int margin = (int) Math.ceil((movement + 1.0) * 360.0);
            if (previous > margin && split - previous > margin) return null;
            double sy = ((Number) call(map, "getRailYaw", split, Math.min(1, split))).doubleValue();
            double ey = ((Number) call(map, "getRailYaw", split, Math.max(0, split - 1))).doubleValue();
            if (!EndpointGeometry.finite(sy) || !EndpointGeometry.finite(ey)) return null;
            boolean freeStart = previous <= margin && EndpointGeometry.freeInteriorEndpoint(sx, sz, sy);
            boolean freeEnd = split - previous <= margin && EndpointGeometry.freeInteriorEndpoint(ex, ez, ey);
            if (!freeStart && !freeEnd) return null;
            // Test only the nearby endpoint planes. A distant curve may cross its own tangent plane.
            if (previous <= margin && !EndpointGeometry.interior(x, z, sx, sz, x, z, sy, ey)) return null;
            if (split - previous <= margin && !EndpointGeometry.interior(x, z, x, z, ex, ez, sy, ey)) return null;
            int search = (int) Math.ceil((movement + 0.25) * 360.0);
            int low = Math.max(0, previous - search), high = Math.min(split, previous + search);
            double best = Double.MAX_VALUE;
            int nearest = previous;
            Method sample = members.get(map.getClass()).method("getRailPos", 2);
            double[] previousPoint = (double[]) sample.invoke(map, split, previous);
            if (Math.hypot(bx - previousPoint[1], bz - previousPoint[0]) > 0.25) return null;
            for (int i = low; i <= high; i++) {
                double[] point = (double[]) sample.invoke(map, split, i);
                double dx = x - point[1], dz = z - point[0];
                double distance = dx * dx + dz * dz;
                if (distance < best) { best = distance; nearest = i; }
            }
            if (best > 0.015625) return null; // 0.125m maximum horizontal deviation
            double railY = ((Number) call(map, "getRailHeight", split, nearest)).doubleValue();
            double offset = number(bogie, "yOffset", "field_70129_M").doubleValue();
            if (!EndpointGeometry.finite(railY) || Math.abs(y - (railY + offset)) > 0.75) return null;
            return core;
        } catch (ReflectiveOperationException | RuntimeException error) {
            healthy = false;
            if (warned.compareAndSet(false, true))
                System.err.println("[SRBXMod] hook unavailable; delegating to KaizPatch: " + error);
            return null;
        }
    }
    private static Number number(Object object, String... names) throws ReflectiveOperationException {
        return (Number) field(object, names);
    }
    private static Object field(Object object, String... names) throws ReflectiveOperationException {
        return members.get(object.getClass()).field(names).get(object);
    }
    private static Object call(Object object, String names, Object... args) throws ReflectiveOperationException {
        return members.get(object.getClass()).method(names, args.length).invoke(object, args);
    }
    private static final class Members {
        private final Class<?> type;
        private final java.util.Map<String, Field> fields = new java.util.HashMap<String, Field>();
        private final java.util.Map<String, Method> methods = new java.util.HashMap<String, Method>();
        Members(Class<?> type) { this.type = type; }
        synchronized Field field(String[] names) throws NoSuchFieldException {
            String key = names[0];
            if (fields.containsKey(key)) return fields.get(key);
            for (String name : names) for (Class<?> t = type; t != null; t = t.getSuperclass()) {
                try {
                    Field f = t.getDeclaredField(name); f.setAccessible(true); fields.put(key, f); return f;
                } catch (NoSuchFieldException ignored) {}
            }
            throw new NoSuchFieldException(type.getName() + "." + key);
        }
        synchronized Method method(String names, int count) throws NoSuchMethodException {
            String key = names + "/" + count;
            if (methods.containsKey(key)) return methods.get(key);
            for (String name : names.split("\\|")) for (Method m : type.getMethods()) {
                if (m.getName().equals(name) && m.getParameterTypes().length == count) {
                    m.setAccessible(true); methods.put(key, m); return m;
                }
            }
            throw new NoSuchMethodException(type.getName() + "." + key);
        }
    }
}
