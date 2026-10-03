const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// The official dev JAR uses MCP names; do not deobfuscate it a second time.
const artifacts = [
	{
		filename: "AppleExtended-forge1.12.2-2.5.3-dev.jar",
		url: "https://github.com/Kirtmuna/AppleExtended/releases/download/v2.5.3/AppleExtended-forge1.12.2-2.5.3-dev.jar",
		sha256: "b0f5a9584687a4eac57168821306e0e2ce9235fbe504c2067e2eb71348830215",
	},
	{
		filename: "groovy-all-2.4.15.jar",
		url: "https://repo.maven.apache.org/maven2/org/codehaus/groovy/groovy-all/2.4.15/groovy-all-2.4.15.jar",
		sha256: "51d6c4e71782e85674239189499854359d380fb75e1a703756e3aaa5b98a5af0",
	},
];

function matches(data, sha256) {
	return crypto.createHash("sha256").update(data).digest("hex") === sha256;
}

async function main() {
	for (const { filename, url, sha256 } of artifacts) {
		const destination = path.resolve(
			__dirname,
			"../.cache/appleextended",
			filename,
		);
		if (
			fs.existsSync(destination) &&
			matches(fs.readFileSync(destination), sha256)
		)
			continue;
		console.log(`[SRBX] Downloading ${filename}`);
		const response = await fetch(url, {
			signal: AbortSignal.timeout(120000),
		});
		if (!response.ok)
			throw new Error(`AE download failed: HTTP ${response.status}`);
		const data = Buffer.from(await response.arrayBuffer());
		if (!matches(data, sha256))
			throw new Error(`${filename} checksum mismatch`);
		fs.mkdirSync(path.dirname(destination), { recursive: true });
		fs.writeFileSync(destination, data);
	}
	console.log("[SRBX] Verified AE v2.5.3 dev JAR and Groovy (SHA-256)");
	fs.rmSync(path.resolve(__dirname, "../generated"), {
		recursive: true,
		force: true,
	});
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
