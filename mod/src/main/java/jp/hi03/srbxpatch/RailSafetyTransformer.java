package jp.hi03.srbxpatch;

import net.minecraft.launchwrapper.IClassTransformer;
import org.objectweb.asm.*;
import org.objectweb.asm.tree.*;

/** Temporary KaizPatch geometry correction and null-map render guard. */
public final class RailSafetyTransformer implements IClassTransformer {
    private static final String GEOMETRY = "jp.kaiz.kaizpatch.fixrtm.util.GeometrixKt";
    private static final String RENDERER = "jp.ngt.rtm.render.RailPartsRenderer";
    private static final String VECTOR = "jp/kaiz/kaizpatch/fixrtm/util/Vec2d";
    private static final String CROSS = "__srbxCross";
    private static final String GUARD = "__srbxNullMapGuard";

    public byte[] transform(String name, String transformedName, byte[] bytes) {
        if (bytes == null || (!GEOMETRY.equals(transformedName) && !RENDERER.equals(transformedName))) return bytes;
        ClassNode node = new ClassNode();
        new ClassReader(bytes).accept(node, 0);
        boolean changed = GEOMETRY.equals(transformedName) ? fixIntersection(node) : guardRendering(node);
        if (!changed) return bytes;
        ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        node.accept(writer);
        System.out.println("[SRBXPatch] rail safety patch installed: " + transformedName);
        return writer.toByteArray();
    }

    private static boolean fixIntersection(ClassNode node) {
        MethodNode target = null;
        String descriptor = "(L" + VECTOR + ";L" + VECTOR + ";L" + VECTOR + ";L" + VECTOR + ";)Z";
        for (Object entry : node.methods) {
            MethodNode method = (MethodNode) entry;
            if (method.name.equals(CROSS)) return false;
            if (method.name.equals("crossStraightLineAndLineSegments") && method.desc.equals(descriptor)) target = method;
        }
        if (target == null) return false;
        java.util.List<MethodInsnNode> calls = new java.util.ArrayList<MethodInsnNode>();
        for (AbstractInsnNode i = target.instructions.getFirst(); i != null; i = i.getNext()) {
            if (!(i instanceof MethodInsnNode)) continue;
            MethodInsnNode call = (MethodInsnNode)i;
            if (call.getOpcode() == Opcodes.INVOKEVIRTUAL && call.owner.equals(VECTOR) && call.name.equals("dot")
                    && call.desc.equals("(L" + VECTOR + ";)D")) calls.add(call);
        }
        // Only the known erroneous implementation. An upstream cross-product fix is left intact.
        if (calls.size() != 2) return false;
        String helperDesc = "(L" + VECTOR + ";L" + VECTOR + ";)D";
        for (MethodInsnNode call : calls)
            target.instructions.set(call, new MethodInsnNode(Opcodes.INVOKESTATIC, node.name, CROSS, helperDesc, false));
        MethodNode helper = new MethodNode(Opcodes.ACC_PRIVATE | Opcodes.ACC_STATIC | Opcodes.ACC_SYNTHETIC,
            CROSS, helperDesc, null, null);
        helper.instructions.add(new VarInsnNode(Opcodes.ALOAD, 0));
        helper.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, VECTOR, "getX", "()D", false));
        helper.instructions.add(new VarInsnNode(Opcodes.ALOAD, 1));
        helper.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, VECTOR, "getY", "()D", false));
        helper.instructions.add(new InsnNode(Opcodes.DMUL));
        helper.instructions.add(new VarInsnNode(Opcodes.ALOAD, 0));
        helper.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, VECTOR, "getY", "()D", false));
        helper.instructions.add(new VarInsnNode(Opcodes.ALOAD, 1));
        helper.instructions.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, VECTOR, "getX", "()D", false));
        helper.instructions.add(new InsnNode(Opcodes.DMUL));
        helper.instructions.add(new InsnNode(Opcodes.DSUB));
        helper.instructions.add(new InsnNode(Opcodes.DRETURN));
        helper.maxLocals = 2;
        node.methods.add(helper);
        return true;
    }

    private static boolean guardRendering(ClassNode node) {
        for (Object field : node.fields) if (((FieldNode)field).name.equals(GUARD)) return false;
        MethodNode target = null;
        for (Object entry : node.methods) {
            MethodNode method = (MethodNode)entry;
            if (method.name.equals("renderRail") && method.desc.equals("(Ljp/ngt/rtm/rail/TileEntityLargeRailCore;IDDDF)V")) target = method;
        }
        if (target == null) return false;
        LabelNode present = new LabelNode(), ready = new LabelNode();
        InsnList guard = new InsnList();
        guard.add(new VarInsnNode(Opcodes.ALOAD, 1));
        guard.add(new JumpInsnNode(Opcodes.IFNONNULL, present));
        guard.add(new InsnNode(Opcodes.RETURN));
        guard.add(present);
        guard.add(new FrameNode(Opcodes.F_SAME, 0, null, 0, null));
        guard.add(new VarInsnNode(Opcodes.ALOAD, 1));
        guard.add(new MethodInsnNode(Opcodes.INVOKEVIRTUAL, "jp/ngt/rtm/rail/TileEntityLargeRailCore",
            "getAllRailMaps", "()[Ljp/ngt/rtm/rail/util/RailMap;", false));
        guard.add(new JumpInsnNode(Opcodes.IFNONNULL, ready));
        guard.add(new InsnNode(Opcodes.RETURN));
        guard.add(ready);
        guard.add(new FrameNode(Opcodes.F_SAME, 0, null, 0, null));
        target.instructions.insert(guard);
        node.fields.add(new FieldNode(Opcodes.ACC_PRIVATE | Opcodes.ACC_STATIC | Opcodes.ACC_FINAL | Opcodes.ACC_SYNTHETIC,
            GUARD, "Z", null, Integer.valueOf(1)));
        return true;
    }
}
