package jp.hi03.srbxpatch;

import cpw.mods.fml.common.Mod;

/** No packets or client classes: vanilla KaizPatch clients remain accepted. */
@Mod(modid = "srbxpatch", name = "SRBXPatch", version = "1.0",
     acceptableRemoteVersions = "*", dependencies = "required-after:RTM")
public final class SRBXPatch {
    public static boolean isFreeEndpointEnabled() {
        try { Class.forName("jp.ngt.rtm.entity.train.EntityBogie", false, SRBXPatch.class.getClassLoader()); }
        catch (ClassNotFoundException e) { return false; }
        return BogieTransformer.isApplied() && FreeEndpointHook.isHealthy();
    }
}
