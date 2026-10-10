import { EntityVehicle } from "jp.ngt.rtm.entity.vehicle";
import { NGTLog } from "jp.ngt.ngtlib.io";
import { NGTUtilClient, MCWrapperClient } from "jp.ngt.ngtlib.util";
import { GuiScreen } from "net.minecraft.client.gui";
import { Keyboard, Mouse } from "org.lwjgl.input";
import { SRBXToolGui } from "./SRBXToolGui";
import {
	SRBX_TOOLS,
	SRBX_TOOL_REQUESTS,
	toolIndex,
	wheelIndex,
} from "./SRBXTools";
import { SRBXApiCompat } from "@target/assets/minecraft/scripts/superrailbuilderx/SRBXApiCompat";

declare const Java: {
	extend(type: unknown, overrides: unknown): new () => GuiScreen;
};
let wheelActive = false;
let wheelReleased = false;
let wheelDisabled = false;

export class SRBXToolWheel {
	static update(entity: EntityVehicle, primaryPass: boolean): boolean {
		if (wheelActive) return true;
		const mc = NGTUtilClient.getMinecraft();
		const data = entity.getResourceState().getDataMap();
		if (wheelReleased || data.getBoolean("srbxWheelInputBlocked")) {
			if (
				Keyboard.isKeyDown(Keyboard.KEY_TAB) ||
				Keyboard.isKeyDown(Keyboard.KEY_LEFT) ||
				Keyboard.isKeyDown(Keyboard.KEY_RIGHT) ||
				Mouse.isButtonDown(0) ||
				Mouse.isButtonDown(1)
			)
				return true;
			wheelReleased = false;
			data.setBoolean("srbxWheelInputBlocked", false, 1);
		}
		if (wheelDisabled) return false;
		if (
			!primaryPass ||
			mc.currentScreen !== null ||
			!Keyboard.isKeyDown(Keyboard.KEY_TAB)
		)
			return false;
		for (let i = 0; i < SRBX_TOOL_REQUESTS.length; i++)
			if (data.getString(SRBX_TOOL_REQUESTS[i])) return true;
		const current = toolIndex(SRBXApiCompat.getToolModel(entity));
		if (current < 0) return false;
		let selected = current;
		let done = false;
		const finish = (apply: boolean): void => {
			if (done) return;
			done = true;
			wheelActive = false;
			wheelReleased = true;
			if (apply && selected !== current && !entity.isDead)
				data.setString(
					"srbxToolSwitchRequest",
					SRBX_TOOLS[selected].model,
					1,
				);
			mc.displayGuiScreen(null as GuiScreen);
			mc.setIngameFocus();
		};
		let oldX = -1,
			oldY = -1;
		const draw = (mouseX: number, mouseY: number): void => {
			try {
				const visible = SRBXToolGui.renderWheel(
					selected,
					(width, height) => {
						if (mouseX !== oldX || mouseY !== oldY)
							selected = wheelIndex(
								mouseX - width / 2,
								mouseY - height / 2,
								selected,
							);
						oldX = mouseX;
						oldY = mouseY;
						return selected;
					},
				);
				if (visible === false)
					throw new Error("GUI disabled after GL error");
			} catch (error) {
				wheelDisabled = true;
				NGTLog.debug(
					`[SuperRailBuilderX wheel] draw failed: ${String(error)}`,
				);
				finish(false);
			}
		};
		const tick = (): void => {
			const player = MCWrapperClient.getPlayer();
			if (
				!player ||
				entity.isDead ||
				data.getString("hostPlayerEntityId") !==
					String(player.getEntityId())
			)
				finish(false);
			else if (!Keyboard.isKeyDown(Keyboard.KEY_TAB)) finish(true);
		};
		const key = (text: string, code: number): void => {
			if (code === Keyboard.KEY_ESCAPE) finish(false);
			else if (code === Keyboard.KEY_LEFT) selected = (selected + 5) % 6;
			else if (code === Keyboard.KEY_RIGHT) selected = (selected + 1) % 6;
		};
		try {
			// Both mapped development and SRG runtime names use the same signatures.
			const Screen = Java.extend(GuiScreen, {
				drawScreen: draw,
				func_73863_a: draw,
				updateScreen: tick,
				func_73876_c: tick,
				keyTyped: key,
				func_73869_a: key,
				doesGuiPauseGame: () => false,
				func_73868_f: () => false,
				onGuiClosed: () => {
					wheelActive = false;
					wheelReleased = true;
				},
				func_146281_b: () => {
					wheelActive = false;
					wheelReleased = true;
				},
			});
			wheelActive = true;
			data.setBoolean("srbxWheelInputBlocked", true, 0);
			mc.displayGuiScreen(new Screen());
			Mouse.setCursorPosition(
				Math.floor(mc.displayWidth / 2),
				Math.floor(mc.displayHeight / 2),
			);
		} catch (error) {
			wheelActive = false;
			wheelDisabled = true;
			if (mc.currentScreen !== null) finish(false);
			NGTLog.debug(
				`[SuperRailBuilderX wheel] open failed: ${String(error)}`,
			);
		}
		return true;
	}
}
