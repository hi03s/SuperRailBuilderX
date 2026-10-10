package jp.hi03.srbxmod;

import net.minecraft.launchwrapper.IClassTransformer;
import org.objectweb.asm.*;
import org.objectweb.asm.tree.*;

/** Add one early-return hook; retain native calls and every CrossTie injection site. */
public final class BogieTransformer implements IClassTransformer {
    private static volatile boolean applied;
    public static boolean isApplied() { return applied; }

    public byte[] transform(String name, String transformedName, byte[] bytes) {
        if (bytes == null || !"jp.ngt.rtm.entity.train.EntityBogie".equals(transformedName)) return bytes;
        ClassNode node = new ClassNode();
        new ClassReader(bytes).accept(node, 0);
        String descriptor = "(DDD)Ljp/ngt/rtm/rail/TileEntityLargeRailCore;";
        MethodNode target = null;
        int matches = 0;
        boolean crossed = false, section = false;
        for (Object entry : node.methods) {
            MethodNode method = (MethodNode) entry;
            if (!method.name.equals("getRail") || !method.desc.equals(descriptor)) continue;
            target = method;
            matches++;
            for (AbstractInsnNode i = method.instructions.getFirst(); i != null; i = i.getNext()) {
                if (i instanceof MethodInsnNode) {
                    MethodInsnNode call = (MethodInsnNode) i;
                    if (call.owner.equals("jp/hi03/srbxmod/FreeEndpointHook")) return bytes;
                    if (call.owner.equals("jp/kaiz/kaizpatch/rtm/rail/util/RailTransitionResolver")) {
                        crossed |= call.name.equals("findCrossedConnectedCore");
                        section |= call.name.equals("keepCurrentSectionCore");
                    }
                }
            }
        }
        if (matches != 1 || !crossed || !section) {
            System.err.println("[SRBXMod] unsupported EntityBogie bytecode; free endpoints disabled");
            return bytes;
        }
        // A null result means fall through. No exception table or branch is removed.
        LabelNode fallback = new LabelNode();
        InsnList hook = new InsnList();
        hook.add(new VarInsnNode(Opcodes.ALOAD, 0));
        hook.add(new VarInsnNode(Opcodes.DLOAD, 1));
        hook.add(new VarInsnNode(Opcodes.DLOAD, 3));
        hook.add(new VarInsnNode(Opcodes.DLOAD, 5));
        hook.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "jp/hi03/srbxmod/FreeEndpointHook", "retainCurrent",
            "(Ljava/lang/Object;DDD)Ljava/lang/Object;", false));
        hook.add(new InsnNode(Opcodes.DUP));
        hook.add(new JumpInsnNode(Opcodes.IFNULL, fallback));
        hook.add(new TypeInsnNode(Opcodes.CHECKCAST, "jp/ngt/rtm/rail/TileEntityLargeRailCore"));
        hook.add(new InsnNode(Opcodes.ARETURN));
        hook.add(fallback);
        hook.add(new FrameNode(Opcodes.F_SAME1, 0, null, 1, new Object[]{"java/lang/Object"}));
        hook.add(new InsnNode(Opcodes.POP));
        target.instructions.insert(hook);
        // Preserve original (and other mods') frames. No class loading/common-superclass guesses.
        ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        node.accept(writer);
        applied = true;
        System.out.println("[SRBXMod] KaizPatch EntityBogie hook installed (server-world guard)");
        return writer.toByteArray();
    }
}
