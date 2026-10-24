const fs = require("fs"),
	path = require("path"),
	vm = require("vm"),
	assert = require("assert");
const sourceRoot = "src/common/assets/minecraft/scripts/superrailbuilderx";
const distRoot = "dist/assets/minecraft/scripts/superrailbuilderx";
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
const servers = [
	"server_builder1",
	"server_rail_splitter",
	"server_rail_mover",
	"server_double_track_copy",
	"server_cant_formatter",
	"server_branch_builder",
	"server_platform_builder",
	"server_crossover_builder",
];
const renderers = [
	"render_builder1",
	"render_rail_splitter",
	"render_rail_mover",
	"render_double_track_copy",
	"render_cant_formatter",
	"render_branch_builder",
	"render_platform_builder",
];
const read = (root, name, extension) =>
	fs.readFileSync(path.join(root, name + extension), "utf8");
const packageVersion = JSON.parse(
	fs.readFileSync("package.json", "utf8"),
).version;
for (const name of servers.concat(renderers)) {
	const source = read(sourceRoot, name, ".ts");
	const declaredVersion = source.match(/const VERSION = "([^"]+)"/);
	if (servers.includes(name))
		assert(declaredVersion, `${name}: missing version`);
	if (declaredVersion)
		assert.equal(
			declaredVersion[1],
			packageVersion,
			`${name}: package version consistency`,
		);
}
const guardScript = read(distRoot, "SRBXVersionGuard", ".js");
assert(
	!/\bexports\./.test(guardScript),
	"runtime module must not depend on CommonJS exports",
);
const switchScript = read(distRoot, "SRBXToolSwitchServer", ".js");
const withoutImports = (text) =>
	text.replace(/^var \w+ = Packages\.[^;]+;\r?\n/gm, "");
class Data {
	constructor() {
		this.values = {};
	}
	getString(key) {
		return this.values[key] || "";
	}
	setString(key, value) {
		this.values[key] = value;
	}
	getBoolean(key) {
		return this.values[key] === true;
	}
	setBoolean(key, value) {
		this.values[key] = value;
	}
}
const util = {
	getJsonData(data, key) {
		try {
			return JSON.parse(data.getString(key).split("☆").join(","));
		} catch (_) {
			return null;
		}
	},
	resetJsonData(data, key) {
		data.setString(key, "");
	},
};
function fixture(onUpdateScript) {
	const data = new Data();
	const host = {};
	const entity = { getResourceState: () => ({ getDataMap: () => data }) };
	let edits = 0;
	const forbidden = () => {
		edits++;
		throw new Error("request reached editing state");
	};
	const compat = {
		getRider: () => null,
		getRidingEntity: () => null,
		doFollowing() {},
	};
	const context = vm.createContext({
		System: { nanoTime: () => 0 },
		UUID: { randomUUID: () => "fixture-nonce" },
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
		NGTLog: { debug() {}, sendChatMessage() {} },
		EntityPlayer: class {},
		VERSION: packageVersion,
		hosts: { get: () => host, put() {} },
		undoRecords: { get: forbidden },
		undos: { get: forbidden },
		processRequest: forbidden,
		process: forbidden,
		SRBXApiCompat: compat,
	});
	for (const alias of (switchScript + onUpdateScript).match(
		/RTMX_COMPAT_\w+/g,
	) || [])
		context[alias] = { SRBXApiCompat: compat };
	vm.runInContext(withoutImports(guardScript), context);
	vm.runInContext(withoutImports(switchScript), context);
	vm.runInContext(onUpdateScript, context);
	return { data, host, entity, context, edits: () => edits };
}
let executions = 0;
for (const server of servers) {
	const source = read(sourceRoot, server, ".ts");
	const compiled = read(distRoot, server, ".js");
	const start = compiled.indexOf("function onUpdate(");
	assert(start >= 0, server);
	const remainder = compiled.slice(start);
	const nextFunction = remainder.slice(1).search(/^function /m);
	const updateScript =
		nextFunction < 0 ? remainder : remainder.slice(0, nextFunction + 1);
	assert(
		source.includes(
			"if (SRBXToolSwitchServer.update(entity, host)) return;",
		),
		server,
	);
	const hook = updateScript.indexOf(
		"SRBXToolSwitchServer.update(entity, host)",
	);
	const parse = updateScript.indexOf("NGTOBuilderUtil.getJsonData");
	assert(
		hook >= 0 && parse > hook,
		`${server}: guard must run before parsing/editing`,
	);
	for (const key of requests) {
		for (const request of [
			{ action: "apply" },
			{ action: "apply", srbxVersion: "0.3.2", srbxProtocol: "1" },
			{ action: "apply", srbxVersion: packageVersion, srbxProtocol: "1" },
			{
				action: "apply",
				srbxVersion: packageVersion,
				srbxProtocol: "1",
				srbxNonce: "old-nonce",
			},
		]) {
			const f = fixture(updateScript);
			f.data.setString(key, JSON.stringify(request));
			f.context.onUpdate(f.entity, {});
			assert.equal(
				f.edits(),
				0,
				`${server}/${key}: no edit or Undo access`,
			);
			assert.equal(
				f.data.getString(key),
				"",
				`${server}/${key}: request consumed`,
			);
			const result =
				key === "railPositionMove"
					? "applyResult"
					: key.replace(/Request$/, "Result");
			assert.equal(
				f.data.getString(result),
				request.srbxVersion === "0.3.2"
					? "version_mismatch"
					: "version_unverified",
			);
			assert.equal(f.data.getString("srbxServerVersion"), packageVersion);
			executions++;
		}
	}
}
// The shared central hook permits a fully stamped request without consuming it.
const matched = fixture("");
matched.context.SRBXVersionGuard.clientStatus(matched.data);
matched.context.SRBXVersionGuard.publish(matched.data);
matched.data.setString(
	"builder1Request",
	JSON.stringify({
		action: "apply",
		srbxVersion: packageVersion,
		srbxProtocol: "1",
		srbxNonce: "fixture-nonce",
	}),
);
assert.equal(
	matched.context.SRBXToolSwitchServer.update(matched.entity, matched.host),
	false,
);
assert(matched.data.getString("builder1Request"));

for (const renderer of renderers) {
	const source = read(sourceRoot, renderer, ".ts");
	assert(source.includes("SRBXVersionGuard.send("), renderer);
	assert(
		!source.includes("NGTOBuilderUtil.sendJsonData("),
		`${renderer}: no unguarded JSON request route`,
	);
}
const wheel = read(sourceRoot, "SRBXToolWheel", ".ts");
assert(wheel.includes("SRBXVersionGuard.send("));
assert(/SRBXVersionGuard\.clientStatus\(\w+\)/.test(wheel));
assert(
	!/setString\(\s*"srbxToolSwitchRequest"/.test(wheel),
	"wheel must send a versioned JSON request",
);
const modelNames = fs
	.readdirSync("src/common/json")
	.filter((name) => /^ModelVehicle_SuperRailBuilderX.*\.json$/.test(name));
assert.equal(modelNames.length, 9);
const usedServers = new Set();
for (const name of modelNames) {
	const model = JSON.parse(
		fs.readFileSync(path.join("src/common/json", name), "utf8"),
	);
	const server = path.basename(model.serverScriptPath, ".js");
	assert(servers.includes(server), name);
	usedServers.add(server);
}
assert.equal(usedServers.size, 8);
console.log(
	`SRBX version routes: ${executions} real server update rejections, 9 models, 8 server and all renderer request routes passed`,
);
