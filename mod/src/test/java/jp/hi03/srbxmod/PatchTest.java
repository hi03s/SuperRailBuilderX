package jp.hi03.srbxmod;

import java.lang.reflect.Method;
import org.objectweb.asm.*;
import org.objectweb.asm.tree.*;
import org.objectweb.asm.tree.analysis.*;

/** Behavioral tests plus JVM verification/execution of transformed bytecode. */
public final class PatchTest {
    public static class RP {
        public double posX = 0.3, posZ, posY = 4.0625;
        public byte direction;
        public int[] getNeighborPos() { return new int[]{(int)Math.floor(posX),4,(int)Math.floor(posZ+(direction==4?0.5:-0.5))}; }
        RP(double z) { posZ = z; }
    }
    public static class Map {
        public RP start = new RP(0.2), end = new RP(10.2);
        public int samples;
        public Map() { end.direction=4; }
        public boolean canConnect(Object other) { return other instanceof Map; }
        public Object getStartRP() { return start; }
        public Object getEndRP() { return end; }
        public float getRailYaw(int split, int index) { return 0; }
        public double[] getRailPos(int split, int index) { samples++; return new double[]{start.posZ + (end.posZ-start.posZ)*index/split, 0.3}; }
        public double getRailHeight(int split, int index) { return 4.0625; }
    }
    public static class Core {
        public int xCoord, yCoord = 4, zCoord;
        public Map map = new Map();
        public boolean section;
        public boolean isRailSection() { return section; }
        public boolean isSameLogicalRail(Object other) { return false; }
        public Object[] getAllRailMaps() { return new Object[]{map}; }
    }
    public static class World {
        public boolean isRemote, loaded = true;
        public Object core, neighbor;
        public int neighborZ = 10, tileReads;
        public static class Tile {
            public Object core;
            Tile(Object core) { this.core=core; }
            public Object getRailCore() { return core; }
        }
        public boolean blockExists(int x, int y, int z) { return loaded; }
        public Object getTileEntity(int x, int y, int z) { tileReads++; return neighbor!=null && z==neighborZ ? neighbor : core; }
    }
    public static class Bogie {
        public World worldObj = new World();
        public Object currentRailObj;
        public Map currentRailMap;
        public int split = 3600, prevPosIndex = 18;
        public double posX = 0.3, posZ = 0.25;
        public float yOffset;
        public Bogie() {
            Core core = new Core();
            currentRailObj = core; currentRailMap = core.map; worldObj.core = core;
        }
    }
    private static void expect(boolean condition, String name) {
        if (!condition) throw new AssertionError(name);
    }
    public static void main(String[] args) throws Exception {
        Bogie b = new Bogie();
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 0.26) == b.currentRailObj, "same-cell old roadbed must not win");
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 0.19) == null, "reverse exit delegates");
        b.prevPosIndex = 3582; b.posZ = 10.15;
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 10.16) == b.currentRailObj, "near end interior");
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 10.21) == null, "forward exit delegates");
        expect(FreeEndpointHook.retainCurrent(b, 0.7, 4.0625, 10.16) == null, "parallel track is not retained");
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 6.0, 10.16) == null, "different vertical track");
        b.worldObj.isRemote = true;
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 10.16) == null, "logical client no-op");
        b.worldObj.isRemote = false; b.worldObj.loaded = false;
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 10.16) == null, "unloaded core");
        b.worldObj.loaded = true; b.worldObj.core = new Core();
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 10.16) == null, "removed/replaced core");
        b = new Bogie(); b.currentRailMap = new Map();
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 0.26) == null, "rebuilt map is not pinned");
        b = new Bogie(); b.currentRailMap.start.posZ = 0; b.currentRailMap.end.posZ = 10;
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 0.26) == null, "standard boundary map unchanged");
        b = new Bogie(); b.currentRailMap.end.posZ = 0.4; b.split = 72; b.prevPosIndex = 18;
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 0.26) == b.currentRailObj, "0.2m section");
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 0.41) == null, "short-section exit");
        expect(FreeEndpointHook.retainCurrent(b, Double.NaN, 4, 0.26) == null, "nonfinite rejected");
        expect(EndpointGeometry.freeInteriorEndpoint(0, 0.3, 0), "parallel block face is not a rail boundary");
        expect(!EndpointGeometry.freeInteriorEndpoint(0, 0.3, 90), "crossed block face is standard");
        b = new Bogie(); b.currentRailMap.start.posZ = 0;
        expect(FreeEndpointHook.retainCurrent(b, 0.3, 4.0625, 0.26) == null, "distant free end does not affect normal start");
        verifyLookupWork();
        verifyTransformer();
        if (args.length > 0) verifyRealJar(args[0]);
        System.out.println("SRBXMod behavioral and bytecode tests passed");
    }
    private static void verifyLookupWork() {
        Bogie middle=new Bogie();middle.prevPosIndex=1800;middle.posZ=5.2;
        expect(FreeEndpointHook.retainCurrent(middle,0.3,4.0625,5.21)==null,"middle delegates early");
        expect(middle.worldObj.tileReads==0 && middle.currentRailMap.samples==0,"middle avoids tile/map lookup");
        Bogie b=new Bogie();
        expect(FreeEndpointHook.retainCurrent(b,0.3,4.0625,0.26)==b.currentRailObj,"projected retention");
        expect(b.currentRailMap.samples==2,"projected path uses two position samples");
        Bogie curve=new Bogie();
        Map uneven=new Map(){public double[] getRailPos(int split,int index){samples++;double t=(double)index/split;return new double[]{0.2+10*t*t,0.3};}};
        ((Core)curve.currentRailObj).map=uneven;curve.currentRailMap=uneven;curve.posZ=0.20025;
        expect(FreeEndpointHook.retainCurrent(curve,0.3,4.0625,0.21)==curve.currentRailObj,"nonuniform parameter uses dense fallback");
        expect(uneven.samples>2,"projection miss keeps dense search");
        System.out.println("Lookup work: interior position samples old=114 new="+b.currentRailMap.samples);
        b=new Bogie();b.prevPosIndex=3582;b.posZ=10.15;
        Core next=new Core();next.map.start.posZ=10.2;
        b.worldObj.neighbor=new World.Tile(next);
        expect(FreeEndpointHook.retainCurrent(b,0.3,4.0625,10.21)==null,"native neighbor path retained");
        expect(b.currentRailMap.samples==0 && b.worldObj.tileReads==1,"crossing delegates without additional tile search");
        System.out.println("Lookup work: crossing rail samples=0 additional neighbor tile probes=0");
    }
    private static byte[] type(String name, String parent, boolean bogie, boolean resolver) {
        ClassWriter w = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        w.visit(Opcodes.V1_8, Opcodes.ACC_PUBLIC, name, null, parent, null);
        MethodVisitor m = w.visitMethod(Opcodes.ACC_PUBLIC, "<init>", "()V", null, null);
        m.visitCode(); m.visitVarInsn(Opcodes.ALOAD, 0); m.visitMethodInsn(Opcodes.INVOKESPECIAL, parent, "<init>", "()V", false);
        m.visitInsn(Opcodes.RETURN); m.visitMaxs(0,0); m.visitEnd();
        String ret = "Ljp/ngt/rtm/rail/TileEntityLargeRailCore;";
        if (resolver) for (String method : new String[]{"findCrossedConnectedCore", "keepCurrentSectionCore"}) {
            m = w.visitMethod(Opcodes.ACC_PUBLIC | Opcodes.ACC_STATIC, method, "()"+ret, null, null);
            m.visitCode(); m.visitInsn(Opcodes.ACONST_NULL); m.visitInsn(Opcodes.ARETURN); m.visitMaxs(0,0); m.visitEnd();
        }
        if (bogie) {
            m = w.visitMethod(Opcodes.ACC_PUBLIC, "getRail", "(DDD)"+ret, null, null);
            m.visitCode();
            m.visitMethodInsn(Opcodes.INVOKESTATIC, "jp/kaiz/kaizpatch/rtm/rail/util/RailTransitionResolver", "findCrossedConnectedCore", "()"+ret, false);
            m.visitInsn(Opcodes.POP);
            m.visitMethodInsn(Opcodes.INVOKESTATIC, "jp/kaiz/kaizpatch/rtm/rail/util/RailTransitionResolver", "keepCurrentSectionCore", "()"+ret, false);
            m.visitInsn(Opcodes.ARETURN); m.visitMaxs(0,0); m.visitEnd();
        }
        w.visitEnd(); return w.toByteArray();
    }
    private static final class Loader extends ClassLoader {
        Class<?> define(String name, byte[] code) { return defineClass(name, code, 0, code.length); }
    }
    private static void verifyTransformer() throws Exception {
        Loader l = new Loader();
        String coreName = "jp.ngt.rtm.rail.TileEntityLargeRailCore";
        Class<?> coreType = l.define(coreName, type(coreName.replace('.', '/'), "jp/hi03/srbxmod/PatchTest$Core", false, false));
        String resolver = "jp.kaiz.kaizpatch.rtm.rail.util.RailTransitionResolver";
        l.define(resolver, type(resolver.replace('.', '/'), "java/lang/Object", false, true));
        String name = "jp.ngt.rtm.entity.train.EntityBogie";
        byte[] original = type(name.replace('.', '/'), "jp/hi03/srbxmod/PatchTest$Bogie", true, false);
        BogieTransformer t = new BogieTransformer();
        byte[] patched = t.transform(name, name, original);
        expect(java.util.Arrays.equals(patched, t.transform(name,name,patched)), "idempotence");
        Class<?> clazz = l.define(name, patched);
        Bogie b = (Bogie) clazz.getDeclaredConstructor().newInstance();
        Core core = (Core) coreType.getDeclaredConstructor().newInstance();
        b.currentRailObj = core; b.currentRailMap = core.map; b.worldObj.core = core;
        Method get = clazz.getMethod("getRail", double.class,double.class,double.class);
        expect(get.invoke(b,0.3,4.0625,0.26) == core, "transformed class returns retained core");
        expect(get.invoke(b,0.3,4.0625,0.19) == null, "transformed class executes native fallback");
        b.worldObj.isRemote = true;
        expect(get.invoke(b,0.3,4.0625,0.26) == null, "transformed client behavior preserved");
    }
    private static void verifyRealJar(String path) throws Exception {
        java.util.zip.ZipFile jar = new java.util.zip.ZipFile(path);
        java.io.InputStream input = jar.getInputStream(jar.getEntry("jp/ngt/rtm/entity/train/EntityBogie.class"));
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192]; int n;
        while ((n = input.read(buffer)) >= 0) out.write(buffer,0,n);
        input.close(); jar.close();
        byte[] original = out.toByteArray();
        String name = "jp.ngt.rtm.entity.train.EntityBogie";
        byte[] patched = new BogieTransformer().transform(name,name,original);
        expect(!java.util.Arrays.equals(original,patched), "real KaizPatch shape accepted");
        ClassNode before = new ClassNode(), after = new ClassNode();
        new ClassReader(original).accept(before, 0); new ClassReader(patched).accept(after, 0);
        MethodNode previous = null;
        for (Object value : before.methods) if (((MethodNode)value).name.equals("getRail")) previous=(MethodNode)value;
        for (Object value : after.methods) {
            MethodNode method = (MethodNode)value;
            if (!method.name.equals("getRail")) continue;
            new Analyzer(new BasicVerifier()).analyze(after.name,method);
            java.util.List<String> callsBefore = nativeCalls(previous), callsAfter = nativeCalls(method);
            expect(callsBefore.equals(callsAfter), "all native/CrossTie invocation sites preserved");
        }
        System.out.println("Real KaizPatch getRail bytecode/dataflow and native call preservation verified");
    }
    private static java.util.List<String> nativeCalls(MethodNode method) {
        java.util.List<String> calls = new java.util.ArrayList<String>();
        for (AbstractInsnNode i = method.instructions.getFirst(); i != null; i=i.getNext()) if(i instanceof MethodInsnNode) {
            MethodInsnNode c=(MethodInsnNode)i;
            if (!c.owner.equals("jp/hi03/srbxmod/FreeEndpointHook")) calls.add(c.owner+"."+c.name+c.desc);
        }
        return calls;
    }
}
