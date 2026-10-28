import {
	mkdtempSync,
	mkdirSync,
	copyFileSync,
	symlinkSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { readSqlitePostcodeIndexArtifact } from "../../shared/atlasPostcodeIndexReader";
import { readSqlitePostcodeAreas } from "../../shared/atlasPostcodeAreaReader";
import { readCachePayload } from "../../shared/atlasCache";
import type { PostcodeCountsArtifact } from "../../shared/postcodeCountTypes";
import { storePostcodeCounts } from "../../shared/storePostcodeCounts";
import { aggregateCounts } from "../../shared/duckdbPostcodeCounts";
import { compileDuckDBCounts } from "../../shared/compileDuckdbPostcodeCounts";
import {
	fingerprint,
	readSeal,
	verifyFingerprint,
} from "../../shared/duckdbDatabaseIntegrity";
import { validateShards } from "../../shared/validatePostcodeCountInputs";

const root = resolve(".");
const api = join(root, "services/api");
const directory = mkdtempSync(join(tmpdir(), "atlas-duckdb-counts-"));
try {
	const started = performance.now();
	const sealPath = process.argv[2];
	if (!sealPath)
		throw new Error("Provide a trusted integrity seal path or --fresh");
	const database = join(root, "data/build/atlas.sqlite");
	let databaseSha256: string;
	let index: ReturnType<typeof readSqlitePostcodeIndexArtifact>;
	let areas: ReturnType<typeof readSqlitePostcodeAreas>;
	if (sealPath === "--fresh") {
		databaseSha256 = await fingerprint(database);
		({ index, areas } = validateShards(root));
		await verifyFingerprint(database, databaseSha256);
	} else {
		const seal = readSeal(sealPath);
		databaseSha256 = seal.databaseSha256;
		await verifyFingerprint(database, databaseSha256);
		index = readSqlitePostcodeIndexArtifact(api);
		areas = readSqlitePostcodeAreas(api);
		if (
			index.contentHash !== seal.postcodeIndex ||
			areas.contentHash !== seal.postcodeAreas
		)
			throw new Error("Postcode inventories differ from the seal");
	}
	const validationSeconds = (performance.now() - started) / 1000;
	const duckStarted = performance.now();
	const result = await aggregateCounts(database, 1);
	const duckSeconds = (performance.now() - duckStarted) / 1000;
	const afterDuckPeakRssMiB = Math.round(
		process.resourceUsage().maxRSS / 1024,
	);
	const { artifact, releases } = compileDuckDBCounts(index, areas, result);

	const reference = JSON.parse(
		readCachePayload(api, "postcode-counts", "postcode-counts"),
	) as PostcodeCountsArtifact;
	if (
		reference.postcodeIndex !== artifact.postcodeIndex ||
		reference.postcodeAreas !== artifact.postcodeAreas ||
		reference.contentHash !== artifact.contentHash
	)
		throw new Error(
			"DuckDB result differs from the current Node-built reference",
		);
	await verifyFingerprint(database, databaseSha256);
	const afterArtifactPeakRssMiB = Math.round(
		process.resourceUsage().maxRSS / 1024,
	);
	const build = join(directory, "data/build");
	mkdirSync(build, { recursive: true });
	symlinkSync(
		join(root, "data/build/atlas.sqlite"),
		join(build, "atlas.sqlite"),
	);
	copyFileSync(
		join(root, "data/build/atlas-cache.sqlite"),
		join(build, "atlas-cache.sqlite"),
	);
	const publishStarted = performance.now();
	storePostcodeCounts(directory, artifact);
	console.log(
		JSON.stringify({
			districts: index.shards.length,
			releases: releases.length,
			rows: result.counts.length,
			validationSeconds,
			duckSeconds,
			publishSeconds: (performance.now() - publishStarted) / 1000,
			totalSeconds: (performance.now() - started) / 1000,
			afterDuckPeakRssMiB,
			afterArtifactPeakRssMiB,
			nodePeakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
			contentHash: artifact.contentHash,
		}),
	);
} finally {
	rmSync(directory, { recursive: true, force: true });
}
