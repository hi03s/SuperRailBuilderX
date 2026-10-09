const fs = require("fs"),
	path = require("path"),
	vm = require("vm"),
	assert = require("assert");
const root = "dist/assets/minecraft/scripts/superrailbuilderx/";
const c = vm.createContext({});
vm.runInContext(fs.readFileSync(root + "SRBXTrainDebugRecorder.js", "utf8"), c);
const rec = new c.SRBXTrainDebugRecorder();
function frame(tick, x = 0, notch = 0, key = "a", speed = 0) {
	return {
		tick,
		key,
		speed,
		notch,
		position: [x, 0, 0],
		text: "tick=" + tick,
	};
}
assert.equal(rec.record(frame(0)).reason, "start");
for (let i = 1; i < 100; i++) assert.equal(rec.record(frame(i)), null);
assert.equal(rec.record(frame(100)).reason, "sample");
assert.equal(rec.record(frame(101, 0, 1)), null);
let stall;
for (let i = 102; i <= 145; i++) {
	const e = rec.record(frame(i, 0, 1));
	if (e && e.reason === "possible-stall") stall = e;
}
assert(stall);
assert.equal(stall.context.length, 20);
assert.equal(stall.context[19], "tick=139");
assert.equal(rec.record(frame(146, 0, 1)), null);
assert.equal(rec.record(frame(147, 0.01, 1, "b", 0.01)).reason, "transition");
assert.equal(rec.record(frame(148, 0.02, 1, "c", 0.01)).reason, "transition");
let repeated = 0;
for (let i = 149; i <= 190; i++) {
	const e = rec.record(frame(i, 0.02, 1, "c"));
	if (e && e.reason === "possible-stall") repeated++;
}
assert.equal(repeated, 1);

for (const target of ["kaizpatch", "appleextended"]) {
	const logs = [],
		reads = [];
	let writes = 0,
		fail = false;
	class JavaWeakMap {
		constructor() {
			this.map = new Map();
		}
		get(k) {
			return this.map.has(k) ? this.map.get(k) : null;
		}
		put(k, v) {
			this.map.set(k, v);
		}
	}
	function reflect(object, name) {
		object.getClass = () => ({
			getName: () => name,
			getDeclaredField: (field) => ({
				setAccessible() {},
				get(obj) {
					reads.push(field);
					if (fail) throw Error("blocked");
					return obj[field];
				},
			}),
		});
		return object;
	}
	class Bed {
		getStartPoint() {
			return [10, 4, 20];
		}
		getRailCore() {
			return core;
		}
	}
	const core = { key: "section:group", pos: [10, 4, 20] };
	const rp = (x) => ({ posX: x, posY: 4.0625, posZ: 20.5, cantEdge: 2 });
	const map = {
		getClass: () => ({ getSimpleName: () => "RailMapSection" }),
		getStartRP: () => rp(10),
		getEndRP: () => rp(30),
		getLength: () => 20,
	};
	const bogie = reflect(
		{
			posX: 19.5,
			posY: 4.0625,
			posZ: 20.5,
			currentRailObj: core,
			currentRailMap: map,
			split: 7200,
			prevPosIndex: 3400,
			rotationRoll: 2,
			getEntityId: () => 2,
			getPosBuf: () => Object.freeze([19.5, 4.0625, 20.5]),
		},
		"Bogie",
	);
	const controller = reflect(
		{
			bogies: [bogie, bogie],
			getBogie() {
				writes++;
				throw Error("must not create bogies");
			},
		},
		"Controller",
	);
	const world = { isRemote: false };
	const train = {
		bogieController: controller,
		ticksExisted: 0,
		posX: 19,
		posY: 4,
		posZ: 20,
		getEntityId: () => 1,
		getSpeed: () => 0.01,
		getNotch: () => 1,
		getTrainDirection: () => 0,
		getBogie() {
			writes++;
			throw Error("must not create bogies");
		},
	};
	const ctx = vm.createContext({
		RTMX_COMPAT_TARGETS: {},
		Packages: {
			java: { util: { WeakHashMap: JavaWeakMap } },
			jp: {
				ngt: {
					ngtlib: { io: { NGTLog: { debug: (s) => logs.push(s) } } },
					rtm: { rail: { TileEntityLargeRailBase: Bed } },
				},
			},
		},
		SRBXApiCompat: {
			getWorld: () => world,
			getTileEntity: () => new Bed(),
			getRailCorePos: (x) => x.pos,
			getRailPositionCandidateKey: (x) => x.key,
			getRailPositionCantEdge: (rp) => rp.cantEdge,
		},
	});
	for (const f of ["SRBXTrainDebugFields.js", "SRBXTrainDebugRecorder.js"])
		vm.runInContext(fs.readFileSync(root + f, "utf8"), ctx);
	const dir =
		"dist/assets/minecraft/__targets__/" +
		target +
		"/scripts/superrailbuilderx";
	const file = fs
		.readdirSync(dir)
		.find(
			(f) =>
				f.startsWith("SRBXTrainDebugCompat.") &&
				f.endsWith(".compat.js"),
		);
	vm.runInContext(fs.readFileSync(path.join(dir, file), "utf8"), ctx);
	ctx.SRBXTrainDebugCompat = Object.values(
		ctx.RTMX_COMPAT_TARGETS[target],
	)[0].SRBXTrainDebugCompat;
	const server = fs.readFileSync(root + "server_TrainDebug.js", "utf8");
	for (const name of server.match(
		/RTMX_COMPAT_scripts_superrailbuilderx_\w+/g,
	)) {
		ctx[name] = name.includes("SRBXTrainDebugCompat")
			? { SRBXTrainDebugCompat: ctx.SRBXTrainDebugCompat }
			: { SRBXApiCompat: ctx.SRBXApiCompat };
	}
	vm.runInContext(server, ctx);
	for (const object of [train, bogie, world]) {
		for (const [field, srg] of Object.entries({
			posX: "field_70165_t",
			posY: "field_70163_u",
			posZ: "field_70161_v",
			ticksExisted: "field_70173_aa",
			isRemote: "field_72995_K",
		})) {
			Object.defineProperty(object, srg, { get: () => object[field] });
		}
		if (object.getEntityId) object.func_145782_y = object.getEntityId;
	}
	ctx.onUpdate(train);
	assert(logs[0].includes("start target=" + target));
	assert(logs[0].includes("core=10,4,20,logical=section:group"));
	assert(logs[0].includes("index=3400/7200"));
	assert(logs[0].includes("kmh_20tps=0.720"));
	assert(reads.includes("currentRailMap"));
	assert.equal(writes, 0);
	controller.bogies[0] = null;
	train.ticksExisted = 1;
	ctx.onUpdate(train);
	assert(logs.at(-1).includes("b=1,"), "nearby must retain back bogie index");
	controller.bogies[0] = bogie;
	const count = logs.length;
	world.isRemote = true;
	ctx.onUpdate(train);
	assert.equal(logs.length, count);
	world.isRemote = false;
	fail = true;
	train.ticksExisted = 1;
	ctx.onUpdate(train);
	const errorCount = logs.length;
	assert(logs.at(-1).includes("observation unavailable"));
	train.ticksExisted = 2;
	ctx.onUpdate(train);
	assert.equal(logs.length, errorCount);
	fail = false;
	train.ticksExisted = 10;
	ctx.onUpdate(train);
	assert(logs.length > errorCount);
	assert.equal(writes, 0);
}
const config = JSON.parse(
	fs.readFileSync(
		"src/common/json/ModelTrain_SuperRailBuilderX_TrainDebug.json",
		"utf8",
	),
);
assert.equal(config.trainType, "EC");
assert.equal(config.maxSpeed.length, 5);
assert.equal(config.useVariableAcceleration, false);
assert(
	config.accelerateion > 0.0002,
	"tractive acceleration must exceed native coasting resistance",
);
for (const model of [config.trainModel2, config.bogieModel2])
	assert(fs.existsSync("dist/assets/minecraft/models/" + model.modelFile));
assert(fs.existsSync("dist/assets/minecraft/" + config.serverScriptPath));
console.log(
	"Train debug observation, rate limits, stall history, client exclusion and recovery passed",
);
