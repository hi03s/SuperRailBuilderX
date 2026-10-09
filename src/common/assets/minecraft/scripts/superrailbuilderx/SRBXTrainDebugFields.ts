/** Read-only private fields; callers supply names verified for their target. */
export class SRBXTrainDebugFields {
	private static fields: { [key: string]: java.lang.reflect.Field } = {};
	static read(object: unknown, name: string): any {
		if (!object) return null;
		let cls = (
			object as { getClass(): java.lang.Class<unknown> }
		).getClass();
		const key = String(cls.getName()) + ":" + name;
		let field = this.fields[key];
		if (!field) {
			while (cls) {
				try {
					field = cls.getDeclaredField(name);
					break;
				} catch (_) {
					cls = cls.getSuperclass() as typeof cls;
				}
			}
			if (!field) throw new Error("missing diagnostic field: " + key);
			field.setAccessible(true);
			this.fields[key] = field;
		}
		try {
			return field.get(object);
		} catch (_) {
			throw new Error("diagnostic field unavailable: " + key);
		}
	}
}
