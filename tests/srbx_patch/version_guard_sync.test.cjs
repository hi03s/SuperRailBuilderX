const fs = require("fs"),
	vm = require("vm"),
	assert = require("assert");
const script = fs
	.readFileSync(
		"dist/assets/minecraft/scripts/superrailbuilderx/SRBXVersionGuard.js",
		"utf8",
	)
	.replace(/^var \w+ = Packages\.[^;]+;\r?\n/gm, "");
let now = 0,
	serial = 0;
function side() {
	const notices = [],
		packets = [];
	const data = {
		values: {},
		getString(k) {
			return this.values[k] || "";
		},
		setString(k, v, flag) {
			this.values[k] = v;
			if (flag === 1) packets.push([k, v]);
		},
	};
	const context = vm.createContext({
		System: { nanoTime: () => now * 1000000 },
		UUID: { randomUUID: () => `sync-${++serial}` },
		WeakHashMap: class extends Map {
			put(k, v) {
				this.set(k, v);
			}
		},
		SRBX_TOOL_REQUESTS: ["builder1Request"],
		NGTLog: {
			sendChatMessage(_, m) {
				notices.push(m);
			},
			debug() {},
		},
		NGTOBuilderUtil: {
			sendJsonData(d, k, r) {
				d.setString(k, JSON.stringify(r), 1);
			},
			getJsonData(d, k) {
				return JSON.parse(d.getString(k));
			},
			resetJsonData(d, k) {
				d.setString(k, "", 1);
			},
		},
	});
	vm.runInContext(script, context);
	return { guard: context.SRBXVersionGuard, data, notices, packets };
}
function deliver(from, to) {
	while (from.packets.length) {
		const [k, v] = from.packets.shift();
		to.data.values[k] = v;
	}
}
for (const [environment, delay] of [
	["AE integrated", 50],
	["AE dedicated", 300],
	["Kaiz integrated", 50],
	["Kaiz dedicated", 300],
]) {
	now = 0;
	const client = side(),
		server = side();
	// Advertisements can arrive before the first render/first mouse press.
	server.guard.publish(server.data);
	deliver(server, client);
	assert.equal(
		client.guard.clientStatus(client.data),
		"pending",
		environment,
	);
	for (let frame = 0; frame < 4; frame++) {
		client.guard.notifyClient(client.data, {});
		assert.equal(
			client.guard.send(client.data, "builder1Request", {
				action: "apply",
			}),
			false,
		);
	}
	assert.equal(client.notices.length, 0, environment + ": no startup error");
	now = delay;
	deliver(client, server);
	server.guard.publish(server.data);
	now = delay * 2;
	deliver(server, client);
	assert.equal(client.guard.clientStatus(client.data), "ok");
	assert(
		client.guard.send(client.data, "builder1Request", { action: "apply" }),
	);
	deliver(client, server);
	assert.equal(server.guard.rejectServerRequests(server.data, {}), false);
	// A new tool script starts a fresh handshake, without warning on the same pack.
	const switched = side();
	switched.data.values = { ...client.data.values };
	assert.equal(switched.guard.clientStatus(switched.data), "pending");
	switched.guard.notifyClient(switched.data, {});
	assert.equal(switched.notices.length, 0);
	deliver(switched, server);
	server.guard.publish(server.data);
	deliver(server, switched);
	assert.equal(switched.guard.clientStatus(switched.data), "ok");
}
// Missing/old server: continue blocking, warn once after the deadline, and recover.
now = 0;
const waiting = side();
assert.equal(waiting.guard.clientStatus(waiting.data), "pending");
now = 4999;
waiting.guard.notifyClient(waiting.data, {});
assert.equal(waiting.notices.length, 0);
now = 5000;
assert.equal(waiting.guard.clientStatus(waiting.data), "version_unverified");
waiting.guard.notifyClient(waiting.data, {});
waiting.guard.notifyClient(waiting.data, {});
assert.equal(waiting.notices.length, 1);
assert.equal(waiting.guard.send(waiting.data, "builder1Request", {}), false);
waiting.guard.publish(waiting.data);
assert.equal(waiting.guard.clientStatus(waiting.data), "ok");
waiting.guard.notifyClient(waiting.data, {});
assert.equal(waiting.data.getString("srbxVersionNotice"), "");
// A real version/protocol mismatch is reported after the fresh response.
for (const field of ["srbxServerVersion", "srbxServerProtocol"]) {
	const mismatch = side();
	mismatch.guard.clientStatus(mismatch.data);
	mismatch.guard.publish(mismatch.data);
	mismatch.data.values[field] = "old";
	assert.equal(
		mismatch.guard.clientStatus(mismatch.data),
		"version_mismatch",
	);
	mismatch.guard.notifyClient(mismatch.data, {});
	assert.equal(mismatch.notices.length, 1);
	assert.equal(
		mismatch.guard.send(mismatch.data, "builder1Request", {}),
		false,
	);
}
const order = side();
order.guard.clientStatus(order.data);
order.packets.length = 0;
order.guard.publish(order.data);
assert.equal(order.packets[order.packets.length - 1][0], "srbxVersionAck");
console.log(
	"Version guard asynchronous sync: startup/tool change silence, delayed response, timeout/recovery and real mismatch passed (AE/Kaiz single/multi timing)",
);
