package jp.hi03.srbxmod;

/** Pure geometry shared by the runtime and regression tests. */
public final class EndpointGeometry {
    private EndpointGeometry() {}
    public static boolean finite(double value) { return !Double.isNaN(value) && !Double.isInfinite(value); }
    public static boolean interior(double x, double z, double sx, double sz, double ex, double ez,
                                   double startYaw, double endYaw) {
        double s = Math.toRadians(startYaw), e = Math.toRadians(endYaw);
        // RailMap yaw is the forward tangent at both ends. Crossing keeps native resolution.
        return (x - sx) * Math.sin(s) + (z - sz) * Math.cos(s) >= -1.0E-7
            && (x - ex) * Math.sin(e) + (z - ez) * Math.cos(e) <= 1.0E-7;
    }
    public static boolean freeInteriorEndpoint(double x, double z) {
        return Math.abs(x - Math.rint(x)) > 1.0E-7 && Math.abs(z - Math.rint(z)) > 1.0E-7;
    }
}
