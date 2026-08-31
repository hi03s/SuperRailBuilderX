import { System } from "java.lang";
import { Keyboard } from "org.lwjgl.input";

type KeyEntry = {
	keyCode: number;
	useOptionKey: boolean;
	current: boolean;
	previous: boolean;
	pressedTime: number;
	description: string;
};

export class InputManager {
	private optionKeyCode: number;
	private entries: { [name: string]: KeyEntry };

	constructor() {
		this.optionKeyCode = Keyboard.KEY_NONE;
		this.entries = {};
	}

	register(
		name: string,
		keyCode: number,
		useOptionKey: boolean,
		description: string,
	): void {
		this.entries[name] = {
			keyCode: keyCode,
			useOptionKey: useOptionKey,
			current: false,
			previous: false,
			pressedTime: 0,
			description: description,
		};
	}

	getDescription(name: string): string {
		const entry = this.entries[name];
		if (!entry) return "NONE";
		return entry.useOptionKey
			? `[${Keyboard.getKeyName(this.optionKeyCode)} + ${Keyboard.getKeyName(entry.keyCode)}] ${entry.description}`
			: `[${Keyboard.getKeyName(entry.keyCode)}] ${entry.description}`;
	}

	setOptionKey(keyCode: number): void {
		this.optionKeyCode = keyCode;
	}

	getOptionKeyCode(): number {
		return this.optionKeyCode;
	}

	downOptionKey(): boolean {
		return Keyboard.isKeyDown(this.optionKeyCode);
	}

	update(): void {
		for (const key in this.entries) {
			const entry = this.entries[key];
			//previousの処理
			entry.previous = entry.current;

			//currentの処理
			const keyDown = Keyboard.isKeyDown(entry.keyCode);
			const optionDown = this.downOptionKey();
			entry.current = entry.useOptionKey
				? keyDown && optionDown
				: keyDown && !optionDown;
			if (!entry.previous && entry.current)
				entry.pressedTime = System.currentTimeMillis();
			if (entry.previous && !entry.current) entry.pressedTime = 0;
		}
	}

	down(name: string): boolean {
		const entry = this.entries[name];
		if (!entry) return false;
		return entry.current;
	}

	pressed(name: string): boolean {
		const entry = this.entries[name];
		if (!entry) return false;
		return !entry.previous && entry.current;
	}

	released(name: string): boolean {
		const entry = this.entries[name];
		if (!entry) return false;
		return entry.previous && !entry.current;
	}

	held(name: string, milliseconds: number): boolean {
		const entry = this.entries[name];
		if (!entry) return false;
		if (!entry.current) return false;
		if (entry.pressedTime <= 0) return false;
		const now = System.currentTimeMillis();
		return now - entry.pressedTime >= milliseconds;
	}
}
