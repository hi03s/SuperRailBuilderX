declare const Java: { type(name: string): unknown };
type PublicModelHandle = {
	invokeWithArguments(args: java.util.List<unknown>): unknown;
};
type PublicModelLookup = {
	findVirtual(
		owner: java.lang.Class<unknown>,
		name: string,
		type: unknown,
	): PublicModelHandle;
	findStaticGetter(
		owner: java.lang.Class<unknown>,
		name: string,
		type: java.lang.Class<unknown>,
	): PublicModelHandle;
};

/** Resolve public server metadata without enumerating client-only signatures. */
export class SRBXServerModelLookup {
	private static methods: {
		manager: unknown;
		lookup: PublicModelHandle;
		dummy: PublicModelHandle;
	} | null = null;
	static hasModel(context: unknown, type: string, model: string): boolean {
		if (!this.methods) {
			const loader = (context as { getClass(): java.lang.Class<unknown> })
				.getClass()
				.getClassLoader();
			const clazz = (name: string) =>
				java.lang.Class.forName(name, false, loader);
			const handles = Java.type("java.lang.invoke.MethodHandles") as {
				publicLookup(): PublicModelLookup;
			};
			const types = Java.type("java.lang.invoke.MethodType") as {
				methodType(
					result: java.lang.Class<unknown>,
					parameters: java.lang.Class<unknown>[],
				): unknown;
			};
			const lookup = handles.publicLookup();
			const manager = clazz("jp.ngt.rtm.modelpack.ModelPackManager");
			const base = clazz("jp.ngt.rtm.modelpack.modelset.ModelSetBase");
			const parameters = java.lang.reflect.Array.newInstance(
				clazz("java.lang.Class"),
				2,
			) as java.lang.Class<unknown>[];
			parameters[0] = parameters[1] = clazz("java.lang.String");
			const empty = java.lang.reflect.Array.newInstance(
				clazz("java.lang.Class"),
				0,
			) as java.lang.Class<unknown>[];
			const bool = clazz("java.lang.Boolean")
				.getDeclaredField("TYPE")
				.get(null) as java.lang.Class<unknown>;
			// getDeclaredMethod would also resolve the manager's other declarations.
			// MethodHandles resolves the exact public descriptor without that scan.
			this.methods = {
				manager: lookup
					.findStaticGetter(manager, "INSTANCE", manager)
					.invokeWithArguments(new java.util.ArrayList<unknown>()),
				lookup: lookup.findVirtual(
					manager,
					"getModelSet",
					types.methodType(base, parameters),
				),
				dummy: lookup.findVirtual(
					base,
					"isDummy",
					types.methodType(bool, empty),
				),
			};
		}
		const args = new java.util.ArrayList<unknown>();
		args.add(this.methods.manager);
		args.add(type);
		args.add(model);
		const set = this.methods.lookup.invokeWithArguments(args);
		if (!set) return false;
		const dummyArgs = new java.util.ArrayList<unknown>();
		dummyArgs.add(set);
		return (
			String(this.methods.dummy.invokeWithArguments(dummyArgs)) !== "true"
		);
	}
}
