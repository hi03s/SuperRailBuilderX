package jp.hi03.srbxpatch;
import java.util.*;
import java.util.zip.*;
import org.objectweb.asm.*;
import org.objectweb.asm.tree.*;
import org.objectweb.asm.tree.analysis.*;
public final class AEPatchTest {
 public static class Pos { public int x,y,z; public Pos(int x,int y,int z){this.x=x;this.y=y;this.z=z;} public String toString(){return x+","+y+","+z;} }
 public static class RP { public double posX=.3,posY=4.0625,posZ; RP(double z){posZ=z;} }
 public static class Map {
  public RP start,end; Map(double a,double b){start=new RP(a);end=new RP(b);}
  public Object getStartRP(){return start;} public Object getEndRP(){return end;}
  public double getLength(){return Math.abs(end.posZ-start.posZ);}
  public float getRailYaw(int s,int i){return end.posZ>start.posZ?0:180;}
  public double[] getRailPos(int s,int i){return new double[]{start.posZ+(end.posZ-start.posZ)*i/s,.3};}
  public double getRailHeight(int s,int i){return 4.0625;}
 }
 public static class Core {
  public Map map; public Pos position; public boolean invalid;
  Core(Map m,Pos p){map=m;position=p;}
  public Object getPos(){return position;} public boolean isInvalid(){return invalid;}
  public Object getRailCore(){return this;} public Object[] getAllRailMaps(){return new Object[]{map};}
  public Object getRailMap(Object b){return map;}
 }
 public static class Curve extends Map {
  int samples;
  Curve(){super(.2,5.2);end.posX=5.3;}
  public double getLength(){return Math.PI*2.5;}
  public float getRailYaw(int s,int i){return (float)(90.0*i/s);}
  public double[] getRailPos(int s,int i){samples++;double a=Math.PI*.5*i/s;return new double[]{.2+5*Math.sin(a),.3+5*(1-Math.cos(a))};}
 }
 public static class SwitchCore extends Core {
  public Map active; SwitchCore(Map inactive,Map active,Pos p){super(inactive,p);this.active=active;}
  public Object getSwitch(){return this;} public Object getNearestPoint(Object bogie){return this;}
  public Object getActiveRailMap(Object world){return active;}
 }
 public static class Tile { Core core; Tile(Core c){core=c;} public Object getRailCore(){return core;} }
 public static class SectionCore extends Core {
  String group; List<int[]> positions;
  SectionCore(Map m,Pos p,String group,List<int[]> positions){super(m,p);this.group=group;this.positions=positions;}
  public boolean isRailSection(){return true;}
  public List<int[]> getRailGroupCorePositions(){return positions;}
  public boolean isSameLogicalRail(Object core){return core instanceof SectionCore && group.equals(((SectionCore)core).group);}
 }
 public static class World {
  public boolean isRemote,loaded=true; public java.util.Map<String,Object> tiles=new HashMap<String,Object>();
  public boolean isBlockLoaded(Pos p){return loaded;} public Object getTileEntity(Pos p){return tiles.get(p.toString());}
  void put(Pos p,Object t){tiles.put(p.toString(),t);}
 }
 public static class Bogie {
  public World world=new World(); public Core currentRailObj; public Map currentRailMap;
  public int split=3600,prevPosIndex=3590; public double posX=.3,posZ=10.18;
  public double getYOffset(){return 0;}
  Bogie(){currentRailMap=new Map(.2,10.2);currentRailObj=new Core(currentRailMap,new Pos(0,4,5));world.put(currentRailObj.position,currentRailObj);}
 }
 static void expect(boolean b,String s){if(!b)throw new AssertionError(s);}
 static Core next(Bogie b){Core c=new Core(new Map(10.2,20.2),new Pos(0,4,15));b.world.put(c.position,c);b.world.put(new Pos(0,4,11),new Tile(c));return c;}
 static String annotationValue(ClassNode node,String key) {
  if(node.visibleAnnotations!=null) for(Object entry:node.visibleAnnotations) {
   AnnotationNode annotation=(AnnotationNode)entry;
   if(!annotation.desc.equals("Lnet/minecraftforge/fml/common/Mod;"))continue;
   for(int i=0;i<annotation.values.size();i+=2)
    if(key.equals(annotation.values.get(i)))return String.valueOf(annotation.values.get(i+1));
  }
  return null;
 }
 static void verifyModMetadata(String[] args)throws Exception {
  ClassNode patch=new ClassNode();
  try(java.io.InputStream in=AEPatchTest.class.getResourceAsStream("SRBXPatch.class")) {
   new ClassReader(in).accept(patch,ClassReader.SKIP_CODE);
  }
  String dependency=annotationValue(patch,"dependencies");
  expect("required-after:rtm".equals(dependency),"Forge 1.12 dependency must use lowercase RTM modid");
  expect("*".equals(annotationValue(patch,"acceptableRemoteVersions")),"server-only installation accepts unpatched clients");
  if(args.length>0)try(ZipFile jar=new ZipFile(args[0]);java.io.InputStream in=jar.getInputStream(jar.getEntry("jp/ngt/rtm/RTMCore.class"))) {
   ClassNode rtm=new ClassNode();new ClassReader(in).accept(rtm,ClassReader.SKIP_CODE);
   expect(dependency.equals("required-after:"+annotationValue(rtm,"modid")),"dependency matches actual AE RTM modid");
  }
 }
 public static void main(String[] args)throws Exception {
  verifyModMetadata(args);
  // A conflicting bed in the middle must not replace the map already followed.
  Bogie overlap=new Bogie();overlap.prevPosIndex=1800;overlap.posZ=5.2;
  overlap.currentRailObj.position=new Pos(0,4,0);overlap.world.put(overlap.currentRailObj.position,overlap.currentRailObj);
  Core foreign=new Core(new Map(.2,10.2),new Pos(1,4,5));
  overlap.world.put(foreign.position,foreign);overlap.world.put(new Pos(0,4,5),new Tile(foreign));
  expect(AEFreeEndpointHook.resolve(overlap,.3,4.0625,5.21)==overlap.currentRailObj,"overlapping middle bed retains current map forward");
  expect(AEFreeEndpointHook.resolve(overlap,.3,4.0625,5.19)==overlap.currentRailObj,"overlapping middle bed retains current map reverse");
  expect(AEFreeEndpointHook.resolve(overlap,.5,4.0625,5.21)==null,"off-line middle prediction falls back");
  Map originalMap=overlap.currentRailObj.map;overlap.currentRailObj.map=new Map(.2,10.2);
  expect(AEFreeEndpointHook.resolve(overlap,.3,4.0625,5.21)==null,"replaced middle map falls back");
  overlap.currentRailObj.map=originalMap;overlap.currentRailMap=null;
  expect(AEFreeEndpointHook.resolve(overlap,.3,4.0625,5.21)==null,"initial rail acquisition remains native");
  Bogie boundary=new Bogie();boundary.currentRailMap=boundary.currentRailObj.map=new Map(0,10);boundary.posZ=9.98;
  expect(AEFreeEndpointHook.resolve(boundary,.3,4.0625,9.99)==boundary.currentRailObj,"boundary-ended rail retains inside");
  expect(AEFreeEndpointHook.resolve(boundary,.3,4.0625,10.01)==null,"boundary end crossing stays native");
  boundary.prevPosIndex=8;boundary.posZ=.02;
  expect(AEFreeEndpointHook.resolve(boundary,.3,4.0625,-.01)==null,"boundary start crossing stays native");
  Bogie curved=new Bogie();Curve curve=new Curve();curved.currentRailMap=curved.currentRailObj.map=curve;
  curved.split=(int)(curve.getLength()*360);curved.prevPosIndex=curved.split/2;
  double[] previousCurve=curve.getRailPos(curved.split,curved.prevPosIndex),nextCurve=curve.getRailPos(curved.split,curved.prevPosIndex+3);
  curved.posX=previousCurve[1];curved.posZ=previousCurve[0];curve.samples=0;
  expect(AEFreeEndpointHook.resolve(curved,nextCurve[1],4.0625,nextCurve[0])==curved.currentRailObj,"curve middle retention follows local tangent");
  expect(curve.samples<=3,"curve local tangent avoids dense scan on a matching prediction");
  Bogie sectioned=new Bogie();List<int[]> groupPositions=Arrays.asList(new int[]{0,4,5},new int[]{0,4,15});
  SectionCore first=new SectionCore(new Map(.2,10),new Pos(0,4,5),"group-a",groupPositions);
  SectionCore second=new SectionCore(new Map(10,20),new Pos(0,4,15),"group-a",groupPositions);
  sectioned.world.put(first.position,first);sectioned.world.put(second.position,second);
  sectioned.currentRailObj=first;sectioned.currentRailMap=first.map;sectioned.split=(int)(first.map.getLength()*360);
  sectioned.prevPosIndex=sectioned.split-3;sectioned.posZ=first.map.getRailPos(sectioned.split,sectioned.prevPosIndex)[0];
  Core crossing=new Core(new Map(10,20),new Pos(1,4,10));sectioned.world.put(crossing.position,crossing);
  sectioned.world.put(new Pos(0,4,10),new Tile(crossing));
  expect(AEFreeEndpointHook.resolve(sectioned,.3,4.0625,10.01)==second,"boundary transition selects same group core despite foreign ballast");
  second.group="group-b";
  expect(AEFreeEndpointHook.resolve(sectioned,.3,4.0625,10.01)==null,"stale group position cannot select another group");
  second.group="group-a";second.invalid=true;
  expect(AEFreeEndpointHook.resolve(sectioned,.3,4.0625,10.01)==null,"deleted section core not selected");
  second.invalid=false;second.map.start.posZ=10.02;
  expect(AEFreeEndpointHook.resolve(sectioned,.3,4.0625,10.01)==null,"group membership alone cannot bridge disconnected endpoints");
  second.map.start.posZ=10;sectioned.currentRailObj=second;sectioned.currentRailMap=second.map;
  sectioned.split=3600;sectioned.prevPosIndex=3;sectioned.posZ=10+3.0/360;
  expect(AEFreeEndpointHook.resolve(sectioned,.3,4.0625,9.99)==first,"reverse boundary transition selects previous group member");
  Bogie b=new Bogie();Core c=next(b);
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.19)==b.currentRailObj,"retain before exact endpoint despite next bed");
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.21)==c,"cross exact endpoint despite old bed");
  b.currentRailObj=c;b.currentRailMap=c.map;b.split=3600;b.prevPosIndex=4;b.posZ=10.21;
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.22)==c,"next tick does not return to old map");
  b=new Bogie();c=next(b);c.map.start.posZ+=.02;
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.21)==null,"nearby disconnected rail rejected");
  b=new Bogie();c=next(b);c.invalid=true;
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.21)==null,"removed core rejected");
  b=new Bogie();next(b);b.world.isRemote=true;
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.21)==null,"client no-op");
  b=new Bogie();next(b);b.world.loaded=false;
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.21)==null,"unloaded no-op");
  b=new Bogie();next(b);
  expect(AEFreeEndpointHook.resolve(b,.3,8,10.21)==null,"wrong height rejected");
  b.prevPosIndex=8;b.posZ=.22;
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,.21)==b.currentRailObj,"reverse stays until endpoint");
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,.19)==null,"unconnected reverse exit native fallback");
  b=new Bogie();next(b);b.posZ=9.8;
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.21)==null,"stale previous sample must not force transition");
  b=new Bogie();c=next(b);Core other=new Core(new Map(10.2,20.2),new Pos(1,4,15));b.world.put(other.position,other);b.world.put(new Pos(1,4,11),new Tile(other));
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.21)==null,"multiple matching cores are ambiguous");
  b=new Bogie();SwitchCore sw=new SwitchCore(new Map(10.2,20.2),new Map(11,21),new Pos(0,4,15));b.world.put(sw.position,sw);b.world.put(new Pos(0,4,11),new Tile(sw));
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.21)==null,"inactive branch map must not be chosen");
  sw.active=new Map(10.2,20.2);
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.21)==sw,"active switch route accepted");
  b=new Bogie();c=next(b);b.world.put(new Pos(0,4,10),new Tile(b.currentRailObj));Core old=b.currentRailObj;b.currentRailObj=c;b.currentRailMap=c.map;b.prevPosIndex=4;b.posZ=10.21;
  expect(AEFreeEndpointHook.resolve(b,.3,4.0625,10.19)==old,"reverse crossing picks connected old map");
  expect(AEFreeEndpointHook.isHealthy(),"valid fixture metadata");
  byte[] unsupported={1,2,3};expect(new AEBogieTransformer().transform("","jp.ngt.rtm.entity.train.EntityBogie",unsupported)==unsupported,"malformed bytecode fails closed");
  if(args.length>0){try(ZipFile jar=new ZipFile(args[0])){
   java.io.InputStream in=jar.getInputStream(jar.getEntry("jp/ngt/rtm/entity/train/EntityBogie.class"));java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);
   byte[] original=out.toByteArray(), transformed=new AEBogieTransformer().transform("","jp.ngt.rtm.entity.train.EntityBogie",original);
   expect(!Arrays.equals(original,transformed),"real AE bytecode patched");
   ClassNode node=new ClassNode();new ClassReader(transformed).accept(node,0);int hooks=0;
   for(Object o:node.methods){MethodNode m=(MethodNode)o;if(m.name.equals("getRail")){new Analyzer(new BasicVerifier()).analyze(node.name,m);for(AbstractInsnNode i=m.instructions.getFirst();i!=null;i=i.getNext())if(i instanceof MethodInsnNode && ((MethodInsnNode)i).owner.equals("jp/hi03/srbxpatch/AEFreeEndpointHook"))hooks++;}}
   expect(hooks==1,"exactly one valid hook");expect(Arrays.equals(transformed,new AEBogieTransformer().transform("","jp.ngt.rtm.entity.train.EntityBogie",transformed)),"idempotent");
  }}
  System.out.println("AE patch behavior and bytecode tests passed");
 }
}
