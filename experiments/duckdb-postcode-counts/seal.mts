import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fingerprint } from "../../shared/duckdbDatabaseIntegrity";
import { validateShards } from "../../shared/validatePostcodeCountInputs";

const sealPath = process.argv[2];
if (!sealPath) throw new Error("Provide an output path for the integrity seal");
const started = performance.now();
const root = resolve(".");
const database = join(root, "data/build/atlas.sqlite");
const before = await fingerprint(database);
const { index, areas } = validateShards(root);
if ((await fingerprint(database)) !== before)
	throw new Error("Database changed during validation");
writeFileSync(
	sealPath,
	JSON.stringify({
		schemaVersion: 1,
		databaseSha256: before,
		postcodeIndex: index.contentHash,
		postcodeAreas: areas.contentHash,
	}) + "\n",
	{ flag: "wx" },
);
console.log(
	JSON.stringify({
		districts: index.shards.length,
		seconds: (performance.now() - started) / 1000,
		nodePeakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
	}),
);
