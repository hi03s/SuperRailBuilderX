package jp.hi03.srbxpatch;
import net.minecraftforge.fml.common.Mod;
@Mod(modid="srbxpatch",name="SRBXPatch",version="1.0",acceptableRemoteVersions="*",dependencies="required-after:RTM")
public final class SRBXPatch {
 public static boolean isFreeEndpointEnabled() {
  try { Class.forName("jp.ngt.rtm.entity.train.EntityBogie", false, SRBXPatch.class.getClassLoader()); }
  catch (ClassNotFoundException e) { return false; }
  return AEBogieTransformer.isApplied() && AEFreeEndpointHook.isHealthy();
 }
}
