const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const requests = [
	"builder1Request",
	"railSplitterRequest",
	"railPositionMove",
	"doubleTrackCopyRequest",
	"cantFormatterRequest",
	"branchBuilderRequest",
	"platformBuilderRequest",
	"crossoverBuilderRequest",
	"srbxToolSwitchRequest",
];
const chats = [],
	logs = [],
	sent = [];
class Data {
	constructor() {
		this.values = {};
		this.writes = [];
	}
	getString(key) {
		return this.values[key] || "";
	}
	setString(key, value, flag) {
		this.values[key] = value;
		this.writes.push([key, value, flag]);
	}
}
const util = {
	sendJsonData(data, key, request) {
		sent.push(request);
		data.setString(key, JSON.stringify(request).split(",").join("☆"), 1);
	},
	getJsonData(data, key) {
		try {
			return JSON.parse(data.getString(key).split("☆").join(","));
		} catch (_) {
			return null;
		}
	},
	resetJsonData(data, key) {
		data.setString(key, "", 1);
	},
};
let now = 0;
const context = vm.createContext({
	System: { nanoTime: () => now },
	UUID: {
		randomUUID: (() => {
			let next = 0;
			return () => `nonce-${++next}`;
		})(),
	},
	WeakHashMap: class {
		constructor() {
			this.map = new Map();
		}
		get(key) {
			return this.map.get(key) || null;
		}
		put(key, value) {
			this.map.set(key, value);
		}
	},
	SRBX_TOOL_REQUESTS: requests.slice(0, 8),
	NGTOBuilderUtil: util,
	NGTLog: {
		sendChatMessage: (_, text) => chats.push(text),
		debug: (text) => logs.push(text),
	},
});
vm.runInContext(
	fs
		.readFileSync(
			"dist/assets/minecraft/scripts/superrailbuilderx/SRBXVersionGuard.js",
			"utf8",
		)
		.replace(/^var \w+ = Packages\.[^;]+;\r?\n/gm, ""),
	context,
);
const guard = context.SRBXVersionGuard;
const stamp = {
	srbxVersion: "0.4.0",
	srbxProtocol: "1",
	srbxNonce: "test-nonce",
};
assert.equal(
	context.SRBX_VERSION,
	JSON.parse(fs.readFileSync("package.json", "utf8")).version,
);
const put = (data, key, value) => util.sendJsonData(data, key, value);
const resultKey = (key) =>
	key === "railPositionMove"
		? "applyResult"
		: key.replace(/Request$/, "Result");
const updateKey = (key) =>
	key === "railPositionMove"
		? "railPositionUpdatedCores"
		: key.replace(/Request$/, "ClientUpdate");

const data = new Data();
data.setString("srbxServerVersion", "0.3.2", 1);
data.setString("srbxServerProtocol", "old", 1);
data.setString("VERSIONS", "0.4.0", 1);
assert.equal(guard.clientStatus(data), "pending");
guard.publish(data);
assert.equal(guard.clientStatus(data), "ok");
assert(
	data.writes.some(
		(w) => w[0] === "srbxServerVersion" && w[1] === "0.4.0" && w[2] === 1,
	),
);
assert(
	data.writes.some(
		(w) => w[0] === "srbxServerProtocol" && w[1] === "1" && w[2] === 1,
	),
);
const original = {
	action: "apply",
	target: "tool",
	srbxVersion: "stale",
	srbxProtocol: "stale",
	nested: [1, 2],
};
const before = JSON.stringify(original);
assert(guard.send(data, "builder1Request", original));
assert.equal(JSON.stringify(original), before);
assert.equal(sent[sent.length - 1].srbxVersion, "0.4.0");
assert.equal(sent[sent.length - 1].srbxProtocol, "1");
assert.equal(sent[sent.length - 1].target, "tool");
assert.equal(sent[sent.length - 1].srbxNonce, data.getString("srbxVersionAck"));
assert(data.writes.some((w) => w[0] === "srbxVersionChallenge" && w[2] === 1));
assert(data.writes.some((w) => w[0] === "srbxVersionAck" && w[2] === 1));
const fresh = new Data();
fresh.values = { ...data.values };
assert.equal(
	guard.clientStatus(fresh),
	"pending",
	"a new DataMap must not trust a copied handshake",
);
assert.notEqual(
	fresh.getString("srbxVersionChallenge"),
	data.getString("srbxVersionChallenge"),
);
assert.equal(guard.send(fresh, "builder1Request", original), false);
guard.publish(fresh);
assert.equal(guard.clientStatus(fresh), "ok");
data.setString("srbxServerVersion", "0.3.2", 1);
const count = sent.length;
assert.equal(guard.send(data, "builder1Request", original), false);
assert.equal(sent.length, count);
guard.notifyClient(data, {});
guard.notifyClient(data, {});
assert.equal(chats.length, 1);
assert.equal(logs.length, 1);
data.setString("srbxServerProtocol", "2", 1);
guard.notifyClient(data, {});
assert.equal(chats.length, 2);
data.setString("srbxServerVersion", "", 1);
guard.notifyClient(data, {});
assert.equal(guard.clientStatus(data), "version_unverified");
assert.equal(chats.length, 3);
guard.publish(data);
guard.notifyClient(data, {});
assert.equal(data.getString("srbxVersionNotice"), "");

const cases = [
	[{ action: "apply", ...stamp }, null],
	[{ ...stamp, srbxVersion: "0.3.2" }, "version_mismatch"],
	[{ ...stamp, srbxProtocol: "2" }, "version_mismatch"],
	[{}, "version_unverified"],
	[{ srbxVersion: "0.4.0" }, "version_unverified"],
	[{ ...stamp, srbxProtocol: 1 }, "version_unverified"],
	[{ ...stamp, srbxNonce: undefined }, "version_unverified"],
	[{ ...stamp, srbxNonce: "wrong-nonce" }, "version_unverified"],
	[{ ...stamp, srbxNonce: 1 }, "version_unverified"],
	[[], "version_unverified"],
	[null, "version_unverified"],
	["tool", "version_unverified"],
	[1, "version_unverified"],
];
for (const key of requests) {
	for (const [request, status] of cases) {
		const map = new Data();
		map.setString("srbxVersionChallenge", "test-nonce", 1);
		guard.publish(map);
		put(map, key, request);
		map.setString(updateKey(key), "stale", 1);
		assert.equal(
			guard.rejectServerRequests(map, {}),
			!!status,
			`${key}: ${JSON.stringify(request)}`,
		);
		if (status) {
			assert.equal(map.getString(key), "");
			assert.equal(map.getString(resultKey(key)), status);
			assert.equal(map.getString(updateKey(key)), "");
			assert.equal(guard.rejectServerRequests(map, {}), false);
		} else {
			assert(map.getString(key));
			assert.equal(map.getString(updateKey(key)), "stale");
		}
	}
	const map = new Data();
	map.setString(key, "broken JSON", 1);
	assert(guard.rejectServerRequests(map, {}));
	assert.equal(map.getString(resultKey(key)), "version_unverified");
}
const mixed = new Data();
mixed.setString("srbxVersionChallenge", "test-nonce", 1);
guard.publish(mixed);
put(mixed, requests[0], stamp);
put(mixed, requests[1], {});
put(mixed, requests[2], { ...stamp, srbxVersion: "old" });
assert(guard.rejectServerRequests(mixed, {}));
assert(mixed.getString(requests[0]));
assert.equal(mixed.getString(requests[1]), "");
assert.equal(mixed.getString(requests[2]), "");
// A previously verified request never authorizes a later unversioned one.
put(mixed, requests[0], {});
assert(guard.rejectServerRequests(mixed, {}));
assert.equal(mixed.getString(requests[0]), "");
for (const [challenge, ack] of [
	["test-nonce", "stale"],
	["stale", "test-nonce"],
]) {
	const map = new Data();
	map.setString("srbxVersionChallenge", challenge, 1);
	map.setString("srbxVersionAck", ack, 1);
	put(map, requests[0], stamp);
	assert(
		guard.rejectServerRequests(map, {}),
		"request nonce must match both challenge and acknowledgement",
	);
	assert.equal(map.getString("builder1Result"), "version_unverified");
}
console.log(
	"SRBX version guard: request stamps, strict rejection, advertisements and client notices passed",
);
