import { Keyboard } from "org.lwjgl.input";
import { InputManager } from "../lib_hi03toolkit_1_0/lib_InputManager";

/** Accept either Ctrl key without changing the shared toolkit. */
export class SRBXInputManager extends InputManager {
	downOptionKey(): boolean {
		return (
			super.downOptionKey() ||
			(this.getOptionKeyCode() === Keyboard.KEY_LCONTROL &&
				Keyboard.isKeyDown(Keyboard.KEY_RCONTROL))
		);
	}
}
