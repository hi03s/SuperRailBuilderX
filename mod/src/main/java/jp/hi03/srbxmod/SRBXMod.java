package jp.hi03.srbxmod;

import cpw.mods.fml.common.Mod;

/** No packets or client classes: vanilla KaizPatch clients remain accepted. */
@Mod(modid = "srbxmod", name = "SRBX Free Endpoint", version = "0.1.0-experimental",
     acceptableRemoteVersions = "*", dependencies = "required-after:RTM")
public final class SRBXMod {
    public static boolean isFreeEndpointEnabled() {
        try { Class.forName("jp.ngt.rtm.entity.train.EntityBogie", false, SRBXMod.class.getClassLoader()); }
        catch (ClassNotFoundException e) { return false; }
        return BogieTransformer.isApplied();
    }
}
