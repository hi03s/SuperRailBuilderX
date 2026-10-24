import { NGTLog } from "jp.ngt.ngtlib.io";
import { UUID, WeakHashMap } from "java.util";
import { DataMap } from "jp.ngt.rtm.modelpack.state";
import { ICommandSender } from "net.minecraft.command";
import { NGTOBuilderUtil } from "../lib_hi03toolkit_1_0/lib_NGTOBuilderUtil";
import { SRBX_TOOL_REQUESTS } from "./SRBXTools";

const SRBX_LOCAL_VERSION = "0.4.0";
const SRBX_LOCAL_PROTOCOL = "1";
export const SRBX_VERSION = SRBX_LOCAL_VERSION;
export const SRBX_PROTOCOL = SRBX_LOCAL_PROTOCOL;
type Status = "ok" | "version_mismatch" | "version_unverified";
type Stamp = {
	srbxVersion?: unknown;
	srbxProtocol?: unknown;
	srbxNonce?: unknown;
};

export class SRBXVersionGuard {
	private static clientNonces = new WeakHashMap<DataMap, string>();
	private static clientNonce(data: DataMap): string {
		let nonce = this.clientNonces.get(data);
		if (!nonce) {
			nonce = String(UUID.randomUUID());
			this.clientNonces.put(data, nonce);
		}
		if (String(data.getString("srbxVersionChallenge")) !== nonce)
			data.setString("srbxVersionChallenge", nonce, 1);
		return nonce;
	}
	static publish(data: DataMap): void {
		const challenge = String(data.getString("srbxVersionChallenge"));
		if (String(data.getString("srbxVersionAck")) !== challenge)
			data.setString("srbxVersionAck", challenge, 1);
		if (String(data.getString("srbxServerVersion")) !== SRBX_LOCAL_VERSION)
			data.setString("srbxServerVersion", SRBX_LOCAL_VERSION, 1);
		if (
			String(data.getString("srbxServerProtocol")) !== SRBX_LOCAL_PROTOCOL
		)
			data.setString("srbxServerProtocol", SRBX_LOCAL_PROTOCOL, 1);
	}
	private static status(version: unknown, protocol: unknown): Status {
		if (
			typeof version !== "string" ||
			!version ||
			typeof protocol !== "string" ||
			!protocol
		)
			return "version_unverified";
		return version === SRBX_LOCAL_VERSION &&
			protocol === SRBX_LOCAL_PROTOCOL
			? "ok"
			: "version_mismatch";
	}
	static clientStatus(data: DataMap): Status {
		const nonce = this.clientNonce(data);
		const status = this.status(
			String(data.getString("srbxServerVersion")),
			String(data.getString("srbxServerProtocol")),
		);
		return status === "ok" &&
			String(data.getString("srbxVersionAck")) !== nonce
			? "version_unverified"
			: status;
	}
	static send(data: DataMap, key: string, request: object): boolean {
		if (this.clientStatus(data) !== "ok") return false;
		const stamped: { [key: string]: unknown } = {};
		Object.keys(request).forEach((name) => {
			stamped[name] = (request as { [key: string]: unknown })[name];
		});
		stamped.srbxVersion = SRBX_LOCAL_VERSION;
		stamped.srbxProtocol = SRBX_LOCAL_PROTOCOL;
		stamped.srbxNonce = this.clientNonce(data);
		NGTOBuilderUtil.sendJsonData(data, key, stamped);
		return true;
	}
	static notifyClient(data: DataMap, sender: unknown): void {
		const status = this.clientStatus(data);
		if (status === "ok") {
			if (data.getString("srbxVersionNotice"))
				data.setString("srbxVersionNotice", "", 0);
			return;
		}
		const server = String(data.getString("srbxServerVersion"));
		const protocol = String(data.getString("srbxServerProtocol"));
		const notice = `${status}:${server}:${protocol}`;
		if (String(data.getString("srbxVersionNotice")) === notice) return;
		data.setString("srbxVersionNotice", notice, 0);
		const message = `[SuperRailBuilderX] ${status === "version_mismatch" ? "バージョンが一致しないため操作できません" : "サーバーのバージョンを確認できないため操作できません"}。両側を同じ最新パックへ更新してください (client=${SRBX_LOCAL_VERSION}/${SRBX_LOCAL_PROTOCOL}, server=${server || "unknown"}/${protocol || "unknown"})`;
		NGTLog.sendChatMessage(sender as ICommandSender, `§c${message}`);
		NGTLog.debug(message);
	}
	static rejectServerRequests(data: DataMap, sender: unknown): boolean {
		let rejected = false;
		const requests = SRBX_TOOL_REQUESTS.concat(["srbxToolSwitchRequest"]);
		for (let i = 0; i < requests.length; i++) {
			const key = requests[i];
			if (!data.getString(key)) continue;
			const request = NGTOBuilderUtil.getJsonData<Stamp>(data, key);
			const object =
				request &&
				typeof request === "object" &&
				!Array.isArray(request)
					? request
					: null;
			let status = object
				? this.status(object.srbxVersion, object.srbxProtocol)
				: "version_unverified";
			if (
				status === "ok" &&
				(!object ||
					typeof object.srbxNonce !== "string" ||
					!object.srbxNonce ||
					object.srbxNonce !==
						String(data.getString("srbxVersionChallenge")) ||
					object.srbxNonce !==
						String(data.getString("srbxVersionAck")))
			)
				status = "version_unverified";
			if (status === "ok") continue;
			rejected = true;
			NGTOBuilderUtil.resetJsonData(data, key);
			const result =
				key === "railPositionMove"
					? "applyResult"
					: key.replace(/Request$/, "Result");
			const update =
				key === "railPositionMove"
					? "railPositionUpdatedCores"
					: key.replace(/Request$/, "ClientUpdate");
			NGTOBuilderUtil.resetJsonData(data, update);
			if (key === "railPositionMove")
				NGTOBuilderUtil.resetJsonData(data, "railPositionRemovedRails");
			if (key === "cantFormatterRequest")
				NGTOBuilderUtil.resetJsonData(
					data,
					"cantFormatterRemovedRails",
				);
			if (
				key === "doubleTrackCopyRequest" ||
				key === "platformBuilderRequest"
			)
				NGTOBuilderUtil.resetJsonData(
					data,
					key.replace(/Request$/, "RemovedRails"),
				);
			data.setString(result, status, 1);
			const message = `[SuperRailBuilderX] バージョンを確認できないか一致しない要求を拒否しました。両側を同じ最新パックへ更新してください (request=${key}, status=${status}, client=${object ? String(object.srbxVersion) : "unknown"}/${object ? String(object.srbxProtocol) : "unknown"}, server=${SRBX_LOCAL_VERSION}/${SRBX_LOCAL_PROTOCOL})`;
			NGTLog.sendChatMessage(sender as ICommandSender, `§c${message}`);
			NGTLog.debug(message);
		}
		return rejected;
	}
}
