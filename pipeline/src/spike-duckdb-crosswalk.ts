import { DuckDBInstance } from "@duckdb/node-api";
import { readGeometries } from "@uk-data-atlas/atlas-runtime/areas";
import { readGeometrySourceLookup } from "@uk-data-atlas/atlas-runtime/geometry";
import { readCrosswalkAdapters } from "@uk-data-atlas/atlas-runtime/relationships";
import {
	apiRootOf,
	artifactDirectory,
} from "@uk-data-atlas/atlas-runtime/storage";
import {
	mkdtempSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compileAreaOverlapCrosswalk } from "./areaOverlap";
import { readCompiledAreaLookup } from "./crosswalk-build-inputs";
import { duckdbCrosswalkCandidates } from "./duckdbCrosswalkCandidates";

const root = resolve(import.meta.dirname, "../..");
const id = process.argv[2];
if (!id)
	throw new Error(
		"Usage: pnpm exec tsx pipeline/src/spike-duckdb-crosswalk.ts <area-overlap-id> <output.json>",
	);
const output = process.argv[3];
if (!output) throw new Error("An output path is required.");
const apiRoot = apiRootOf(root);
const adapter = readCrosswalkAdapters(
	join(apiRoot, "config/crosswalk-adapters.json"),
).find((entry) => entry.id === id);
if (!adapter || adapter.method !== "area-overlap")
	throw new Error(`${id} is not an area-overlap crosswalk.`);
if (
	adapter.sourceCodePattern &&
	adapter.from.geography === adapter.to.geography &&
	adapter.from.boundaryRelease === adapter.to.boundaryRelease
)
	throw new Error("The spike cannot use a source filter on a self-join.");
const geometrySources = readGeometrySourceLookup(apiRoot);
const { areaLookup } = readCompiledAreaLookup(artifactDirectory(root));
const sources = readGeometries(
	root,
	id,
	adapter.from,
	geometrySources,
	adapter.sourceCodePattern
		? new RegExp(adapter.sourceCodePattern)
		: undefined,
);
const targets = readGeometries(root, id, adapter.to, geometrySources);
const temp = mkdtempSync(join(tmpdir(), "atlas-duckdb-spike-"));
let peakTempBytes = 0;
const sampleTemp = () => {
	const bytes = readdirSync(temp).reduce(
		(sum, name) =>
			sum +
			(statSync(join(temp, name), { throwIfNoEntry: false })?.size ?? 0),
		0,
	);
	peakTempBytes = Math.max(peakTempBytes, bytes);
};
const sampler = setInterval(sampleTemp, 25);
const instance = await DuckDBInstance.create(":memory:");
const connection = await instance.connect();
try {
	await connection.run("SET memory_limit='2GB'");
	await connection.run(`SET temp_directory='${temp.replaceAll("'", "''")}'`);
	await connection.run("LOAD spatial");
	const candidates = await duckdbCrosswalkCandidates(
		connection,
		sources.geometries,
		targets.geometries,
	);
	const read: typeof readGeometries = (_root, _id, endpoint) =>
		endpoint.geography === adapter.from.geography &&
		endpoint.boundaryRelease === adapter.from.boundaryRelease
			? sources
			: targets;
	const artifact = compileAreaOverlapCrosswalk(
		root,
		adapter,
		geometrySources,
		areaLookup,
		read,
		candidates,
	);
	writeFileSync(output, JSON.stringify(artifact));
	console.log(
		JSON.stringify({
			id,
			candidates: [...candidates.values()].reduce(
				(sum, codes) => sum + codes.length,
				0,
			),
			records: artifact.records.length,
			peakSampledTempBytes: peakTempBytes,
			contentHash: artifact.contentHash,
		}),
	);
} finally {
	clearInterval(sampler);
	connection.closeSync();
	instance.closeSync();
	rmSync(temp, { recursive: true, force: true });
}
