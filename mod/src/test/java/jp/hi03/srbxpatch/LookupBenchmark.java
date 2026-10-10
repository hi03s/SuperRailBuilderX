package jp.hi03.srbxpatch;

import java.net.*;
import java.io.File;
import java.lang.reflect.Method;
import java.util.*;

/** Same synthetic bogie/map, same JVM and reflection call site; not a Minecraft TPS benchmark. */
public final class LookupBenchmark {
    public static void main(String[] args) throws Exception {
        final URL root = new File(args[0]).toURI().toURL();
        URLClassLoader loader = new URLClassLoader(new URL[]{root}, LookupBenchmark.class.getClassLoader()) {
            protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
                if (!name.startsWith("jp.hi03.srbxpatch.FreeEndpointHook")) return super.loadClass(name,resolve);
                Class<?> c=findLoadedClass(name);if(c==null)c=findClass(name);if(resolve)resolveClass(c);return c;
            }
        };
        Method old=loader.loadClass("jp.hi03.srbxpatch.FreeEndpointHook").getMethod("retainCurrent",Object.class,double.class,double.class,double.class);
        Method now=FreeEndpointHook.class.getMethod("retainCurrent",Object.class,double.class,double.class,double.class);
        PatchTest.Bogie b=new PatchTest.Bogie();
        old.invoke(null,b,0.3,4.0625,0.26); int oldSamples=b.currentRailMap.samples;
        b.currentRailMap.samples=0;now.invoke(null,b,0.3,4.0625,0.26);int newSamples=b.currentRailMap.samples;
        for(int i=0;i<10000;i++){old.invoke(null,b,0.3,4.0625,0.26);now.invoke(null,b,0.3,4.0625,0.26);}
        long[] before=new long[7],after=new long[7];
        for(int r=0;r<7;r++) {
            if((r&1)==0){before[r]=measure(old,b);after[r]=measure(now,b);}
            else {after[r]=measure(now,b);before[r]=measure(old,b);}
        }
        Arrays.sort(before);Arrays.sort(after);
        System.out.printf("Synthetic lookup: old samples=%d new samples=%d; median of 7 x 50000 calls old=%.3fms new=%.3fms ratio=%.3f%n",oldSamples,newSamples,before[3]/1e6,after[3]/1e6,(double)after[3]/before[3]);
        if(args.length>1) {
            final URL prototypeRoot=new File(args[1]).toURI().toURL();
            URLClassLoader prototypeLoader=new URLClassLoader(new URL[]{prototypeRoot},LookupBenchmark.class.getClassLoader()) {
                protected Class<?> loadClass(String name,boolean resolve) throws ClassNotFoundException {
                    if(!name.startsWith("jp.hi03.srbxpatch.FreeEndpointHook"))return super.loadClass(name,resolve);
                    Class<?> c=findLoadedClass(name);if(c==null)c=findClass(name);if(resolve)resolveClass(c);return c;
                }
            };
            Method prototype=prototypeLoader.loadClass("jp.hi03.srbxpatch.FreeEndpointHook").getMethod("retainCurrent",Object.class,double.class,double.class,double.class);
            crossingComparison(old,prototype);
            prototypeLoader.close();
        }
        loader.close();
    }
    private static Object nativeNeighbor(PatchTest.Bogie b) {
        // Java mirror of v1.10.4 normal-core forward lookup, with a no-op chunk load.
        PatchTest.RP endpoint=b.currentRailMap.end;
        double travel=Math.toDegrees(Math.atan2(0.3-b.posX,10.21-b.posZ));
        List<Boolean> exits=new ArrayList<Boolean>();
        if(b.split-b.prevPosIndex<=Math.ceil((Math.hypot(0.3-b.posX,10.21-b.posZ)+0.5)*360)
            && Math.abs(travel)<=90)exits.add(true);
        for(boolean towardEnd:exits) {
            if(!towardEnd || 10.21<=endpoint.posZ+1e-7)continue;
            int[] neighbor=endpoint.getNeighborPos();
            Set<Long> cells=new LinkedHashSet<Long>();
            cells.add(((long)neighbor[0]<<32)^(neighbor[2]&0xffffffffL));
            for(int i=0;i<8;i++){
                int z=(int)Math.floor(endpoint.posZ+Math.min((i+1)*0.25,2-1e-7));
                cells.add(((long)(int)Math.floor(endpoint.posX)<<32)^(z&0xffffffffL));
            }
            Set<Integer> ys=new LinkedHashSet<Integer>();ys.add(neighbor[1]);
            for(int dy:new int[]{0,1,-1,2,-2,3,-3})ys.add((int)Math.floor(endpoint.posY)+dy);
            for(long cell:cells)for(int y:ys) {
                Object tile=b.worldObj.getTileEntity((int)(cell>>32),y,(int)cell);
                if(!(tile instanceof PatchTest.World.Tile))continue;
                Object core=((PatchTest.World.Tile)tile).getRailCore();
                if(core==b.currentRailObj)continue;
                for(Object map:((PatchTest.Core)core).getAllRailMaps())
                    if(b.currentRailMap.canConnect(map))return core;
            }
        }
        return null;
    }
    private static void crossingComparison(Method old,Method now) throws Exception {
        PatchTest.Bogie b=new PatchTest.Bogie();b.prevPosIndex=3582;b.posZ=10.15;
        PatchTest.Core next=new PatchTest.Core();next.map.start.posZ=10.2;
        b.worldObj.neighbor=new PatchTest.World.Tile(next);
        for(int i=0;i<10000;i++){old.invoke(null,b,0.3,4.0625,10.21);nativeNeighbor(b);now.invoke(null,b,0.3,4.0625,10.21);}
        long[] nativeTimes=new long[7],directTimes=new long[7];
        for(int r=0;r<7;r++){
            long t=System.nanoTime();
            for(int i=0;i<50000;i++){Object result=old.invoke(null,b,0.3,4.0625,10.21);if(result==null)result=nativeNeighbor(b);if(result!=next)throw new AssertionError();}
            nativeTimes[r]=System.nanoTime()-t;t=System.nanoTime();
            for(int i=0;i<50000;i++)if(now.invoke(null,b,0.3,4.0625,10.21)!=next)throw new AssertionError();
            directTimes[r]=System.nanoTime()-t;
        }
        Arrays.sort(nativeTimes);Arrays.sort(directTimes);
        System.out.printf("Synthetic crossing (native Java mirror, no chunk I/O): native=%.3fms direct=%.3fms ratio=%.3f%n",nativeTimes[3]/1e6,directTimes[3]/1e6,(double)directTimes[3]/nativeTimes[3]);
    }
    private static long measure(Method method,PatchTest.Bogie b) throws Exception {
        long start=System.nanoTime();for(int i=0;i<50000;i++)if(method.invoke(null,b,0.3,4.0625,0.26)!=b.currentRailObj)throw new AssertionError();return System.nanoTime()-start;
    }
}
