package jp.hi03.srbxpatch;

import java.lang.reflect.Method;
import java.util.Arrays;
import org.objectweb.asm.*;
import org.objectweb.asm.tree.*;
import org.objectweb.asm.tree.analysis.*;

/** JVM execution of render guards, real geometry regression, and ASM dataflow checks. */
public final class PatchTestRailSafety {
    private static void expect(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static final class Loader extends ClassLoader {
        Class<?> define(String name, byte[] bytes) { return defineClass(name, bytes, 0, bytes.length); }
    }
    private static byte[] empty(String name) {
        ClassWriter w = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        w.visit(Opcodes.V1_8, Opcodes.ACC_PUBLIC, name, null, "java/lang/Object", null);
        MethodVisitor m = w.visitMethod(Opcodes.ACC_PUBLIC, "<init>", "()V", null, null);
        m.visitCode(); m.visitVarInsn(Opcodes.ALOAD,0);
        m.visitMethodInsn(Opcodes.INVOKESPECIAL,"java/lang/Object","<init>","()V",false);
        m.visitInsn(Opcodes.RETURN); m.visitMaxs(0,0); m.visitEnd();
        w.visitEnd(); return w.toByteArray();
    }
    private static void verify(byte[] bytes) throws Exception {
        ClassNode node = new ClassNode(); new ClassReader(bytes).accept(node,0);
        for (Object entry : node.methods) {
            MethodNode method = (MethodNode)entry;
            if (method.instructions.size() > 0) new Analyzer(new BasicVerifier()).analyze(node.name,method);
        }
    }
    public static void run(String[] args) throws Exception {
        verifyGeometryShape();
        Loader loader = new Loader();
        String map = "jp/ngt/rtm/rail/util/RailMap", core = "jp/ngt/rtm/rail/TileEntityLargeRailCore";
        Class<?> mapType = loader.define(map.replace('/','.'),empty(map));
        ClassNode c = new ClassNode(); new ClassReader(empty(core)).accept(c,0);
        c.fields.add(new FieldNode(Opcodes.ACC_PUBLIC,"maps","[L"+map+";",null,null));
        MethodNode get = new MethodNode(Opcodes.ACC_PUBLIC,"getAllRailMaps","()[L"+map+";",null,null);
        get.instructions.add(new VarInsnNode(Opcodes.ALOAD,0));
        get.instructions.add(new FieldInsnNode(Opcodes.GETFIELD,core,"maps","[L"+map+";"));
        get.instructions.add(new InsnNode(Opcodes.ARETURN)); get.maxLocals=1; c.methods.add(get);
        ClassWriter w = new ClassWriter(ClassWriter.COMPUTE_MAXS); c.accept(w);
        Class<?> coreType=loader.define(core.replace('/','.'),w.toByteArray());
        String renderer="jp/ngt/rtm/render/RailPartsRenderer";
        c=new ClassNode(); new ClassReader(empty(renderer)).accept(c,0);
        c.fields.add(new FieldNode(Opcodes.ACC_PUBLIC,"calls","I",null,null));
        MethodNode render=new MethodNode(Opcodes.ACC_PUBLIC,"renderRail","(L"+core+";IDDDF)V",null,null);
        render.instructions.add(new VarInsnNode(Opcodes.ALOAD,0)); render.instructions.add(new InsnNode(Opcodes.DUP));
        render.instructions.add(new FieldInsnNode(Opcodes.GETFIELD,renderer,"calls","I"));
        render.instructions.add(new InsnNode(Opcodes.ICONST_1)); render.instructions.add(new InsnNode(Opcodes.IADD));
        render.instructions.add(new FieldInsnNode(Opcodes.PUTFIELD,renderer,"calls","I"));
        render.instructions.add(new InsnNode(Opcodes.RETURN)); render.maxLocals=10; c.methods.add(render);
        w=new ClassWriter(ClassWriter.COMPUTE_MAXS); c.accept(w);
        RailSafetyTransformer transformer=new RailSafetyTransformer();
        String name=renderer.replace('/','.');
        byte[] patched=transformer.transform(name,name,w.toByteArray()); verify(patched);
        expect(Arrays.equals(patched,transformer.transform(name,name,patched)),"render guard idempotent");
        Class<?> rendererType=loader.define(name,patched);
        Object instance=rendererType.newInstance(), tile=coreType.newInstance();
        Method draw=rendererType.getMethod("renderRail",coreType,int.class,double.class,double.class,double.class,float.class);
        draw.invoke(instance,null,0,0d,0d,0d,0f);
        draw.invoke(instance,tile,0,0d,0d,0d,0f);
        expect(rendererType.getField("calls").getInt(instance)==0,"null tile/map does not invoke model script");
        coreType.getField("maps").set(tile,java.lang.reflect.Array.newInstance(mapType,1));
        draw.invoke(instance,tile,0,0d,0d,0d,0f);
        expect(rendererType.getField("calls").getInt(instance)==1,"ready tile renders");
        coreType.getField("maps").set(tile,null); draw.invoke(instance,tile,0,0d,0d,0d,0f);
        expect(rendererType.getField("calls").getInt(instance)==1,"unload skips render without swallowing arbitrary script errors");
        if(args.length>0) verifyRealJar(args[0]);
        System.out.println("Rail safety render guard JVM verification passed");
    }
    private static void verifyGeometryShape() throws Exception {
        String vector="jp/kaiz/kaizpatch/fixrtm/util/Vec2d", name="jp.kaiz.kaizpatch.fixrtm.util.GeometrixKt";
        ClassNode node=new ClassNode(); new ClassReader(empty(name.replace('.','/'))).accept(node,0);
        MethodNode method=new MethodNode(Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC,"crossStraightLineAndLineSegments",
            "(L"+vector+";L"+vector+";L"+vector+";L"+vector+";)Z",null,null);
        for(int i=0;i<4;i+=2) {
            method.instructions.add(new VarInsnNode(Opcodes.ALOAD,i));
            method.instructions.add(new VarInsnNode(Opcodes.ALOAD,i+1));
            method.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL,vector,"dot","(L"+vector+";)D",false));
        }
        method.instructions.add(new InsnNode(Opcodes.DMUL)); method.instructions.add(new InsnNode(Opcodes.DCONST_0));
        method.instructions.add(new InsnNode(Opcodes.DCMPG)); method.instructions.add(new InsnNode(Opcodes.IRETURN));
        method.maxLocals=4; node.methods.add(method);
        ClassWriter w=new ClassWriter(ClassWriter.COMPUTE_MAXS); node.accept(w);
        RailSafetyTransformer t=new RailSafetyTransformer(); byte[] original=w.toByteArray(), patched=t.transform(name,name,original);
        expect(!Arrays.equals(original,patched),"known dot-product implementation patched"); verify(patched);
        expect(Arrays.equals(patched,t.transform(name,name,patched)),"geometry idempotence");
        byte[] unsupported=empty(name.replace('.','/'));
        expect(t.transform(name,name,unsupported)==unsupported,"unknown/upstream geometry left intact");
        String other="unrelated.Geometry";
        expect(t.transform(other,other,original)==original,"unrelated class untouched");
    }
    private static byte[] entry(java.util.zip.ZipFile jar,String name) throws Exception {
        java.io.InputStream in=jar.getInputStream(jar.getEntry(name.replace('.','/')+".class"));
        java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();
        byte[] b=new byte[8192]; int count; while((count=in.read(b))!=-1)out.write(b,0,count);
        in.close(); return out.toByteArray();
    }
    private static void verifyRealJar(String path) throws Exception {
        final java.util.zip.ZipFile jar=new java.util.zip.ZipFile(path);
        final RailSafetyTransformer t=new RailSafetyTransformer();
        final String geometry="jp.kaiz.kaizpatch.fixrtm.util.GeometrixKt";
        for(String name:new String[]{geometry,"jp.ngt.rtm.render.RailPartsRenderer"}) {
            byte[] original=entry(jar,name), patched=t.transform(name,name,original);
            expect(!Arrays.equals(original,patched),"real bytecode accepted: "+name);
            verify(patched);
            expect(Arrays.equals(patched,t.transform(name,name,patched)),"real idempotence");
        }
        final java.net.URL url=new java.io.File(path).toURI().toURL();
        java.net.URLClassLoader original=new java.net.URLClassLoader(new java.net.URL[]{url});
        java.net.URLClassLoader fixed=new java.net.URLClassLoader(new java.net.URL[]{url}) {
            protected Class<?> findClass(String name) throws ClassNotFoundException {
                if(!name.equals(geometry))return super.findClass(name);
                try { byte[] b=entry(jar,name); b=t.transform(name,name,b); return defineClass(name,b,0,b.length); }
                catch(Exception e){throw new ClassNotFoundException(name,e);}
            }
        };
        double[][] p={{-147.995,873.105},{-184.275,874.5550000000001},
            {-147.83525921631218,877.1018090875131},{-184.11525974851952,878.5518091087838}};
        // Log mask 0,1,1,0: native tests both normal endpoint permutations.
        expect(intersects(original,p[1],p[0],p[2],p[3]),"logged false intersection reproduced");
        expect(!intersects(fixed,p[1],p[0],p[2],p[3]),"parallel baseline pairing accepted");
        expect(!intersects(fixed,p[1],p[3],p[2],p[0]),"other endpoint pairing accepted");
        for(int angle=0;angle<360;angle+=5) {
            double r=Math.toRadians(angle),x=Math.cos(r),y=Math.sin(r);
            double[] a={0,0},b={40*x,40*y},d={-4*y,4*x},e={b[0]+d[0],b[1]+d[1]};
            expect(!intersects(fixed,a,b,d,e),"parallel rails angle "+angle);
            expect(intersects(fixed,a,e,b,d),"true crossing angle "+angle);
        }
        expect(!intersects(fixed,new double[]{0,0},new double[]{1,0},new double[]{2,0},new double[]{3,0}),"collinear disjoint");
        original.close(); fixed.close(); jar.close();
        System.out.println("Real Kaiz geometry: logged false rejection, 72 rotations, true crossings and bytecode verified");
    }
    private static boolean intersects(ClassLoader loader,double[] a,double[] b,double[] c,double[] d) throws Exception {
        Class<?> v=loader.loadClass("jp.kaiz.kaizpatch.fixrtm.util.Vec2d");
        java.lang.reflect.Constructor<?> ctor=v.getConstructor(double.class,double.class);
        Method method=loader.loadClass("jp.kaiz.kaizpatch.fixrtm.util.GeometrixKt").getMethod("crossLineSegments",v,v,v,v);
        return (Boolean)method.invoke(null,ctor.newInstance(a[0],a[1]),ctor.newInstance(b[0],b[1]),
            ctor.newInstance(c[0],c[1]),ctor.newInstance(d[0],d[1]));
    }
}
