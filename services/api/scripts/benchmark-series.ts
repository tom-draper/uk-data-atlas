import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createApiServer } from "../src/apiServer";
import type {
	DataCatalog,
	MeasureObservationArtifact,
	SourceGeography,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	tableMeasureObservations,
	type MeasureTableArtifact,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { dataCatalog, testContext } from "../tests/routeFixtures";

// Synthetic national-scale tables. From services/api, run:
// node --expose-gc --import tsx scripts/benchmark-series.ts
// For production timings, bundle with esbuild as build-runtime.mjs does, then
// run the bundle with node --expose-gc to exclude tsx overhead.
const areaCount = 35_000;
const measureCount = 14;
const periods = ["2019", "2020", "2021"];
const sourceGeography: SourceGeography = { type: "lsoa", boundaryYear: 2011 };
const template = dataCatalog.measures.find(
	(measure) => measure.id === "small-area-fixture",
);
assert.ok(template);
const measures = Array.from({ length: measureCount }, (_, index) => ({
	...template,
	id: `series-${index}`,
	sources: template.sources.map((source) => ({
		...source,
		periods,
		sourceGeography,
	})),
}));
const catalog: DataCatalog = { ...dataCatalog, measures };
const codeFor = (index: number) =>
	`E${String(1000000 + index).padStart(8, "0")}`;
const tables: MeasureTableArtifact[] = periods.map((period) => ({
	schemaVersion: 1,
	kind: "measure-table",
	contentHash: `sha256:synthetic-${period}`,
	id: `synthetic-${period}`,
	datasetId: "small-area",
	sourceGeography,
	period,
	measures: measures.map((measure) => measure.id),
	records: Array.from({ length: areaCount }, (_, index) => [
		codeFor(index),
		...measures.map((_, column) => index + column),
	]),
}));
const observations = measures.map((measure): MeasureObservationArtifact => ({
	schemaVersion: 1,
	contentHash: "sha256:synthetic-series",
	measureId: measure.id,
	sourceGeography,
	periods: tables.flatMap<MeasureObservationArtifact["periods"][number]>(
		(table) => tableMeasureObservations(table, measure.id).periods,
	),
}));
const server = createApiServer(
	testContext({ dataCatalog: catalog, measureObservations: observations }),
	{ responseCacheBytes: 0 },
);
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}`;
let successful = 0;
const hash = createHash("sha256");
const read = async (index: number) => {
	const column = index % measureCount;
	const area = (areaCount - 1 - index * 37 + areaCount) % areaCount;
	const response = await fetch(
		`${base}/v1/data/series-${column}/series?place=${codeFor(area)}&geography=lsoa&codeYear=2011`,
		{ headers: { "accept-encoding": "identity" } },
	);
	assert.equal(response.status, 200);
	const body = await response.text();
	const result: unknown = JSON.parse(body);
	assert.ok(result && typeof result === "object" && "data" in result);
	const data = result.data;
	assert.ok(data && typeof data === "object" && "series" in data);
	assert.deepEqual(
		data.series,
		periods.map((period) => ({
			period,
			areaCode: codeFor(area),
			value: area + column,
			status: "observed",
		})),
	);
	assert.ok("provenance" in data);
	const provenance = data.provenance;
	assert.ok(
		provenance && typeof provenance === "object" && "source" in provenance,
	);
	const source = provenance.source;
	assert.ok(source && typeof source === "object" && "observations" in source);
	assert.deepEqual(source.observations, {
		artifact: `series-${column}-observations`,
		contentHash: "sha256:synthetic-series",
		periods,
	});
	successful++;
	return body;
};
try {
	const coldStarted = performance.now();
	hash.update(await read(0));
	const coldMs = performance.now() - coldStarted;
	// Touch every column before measuring repeated requests for different areas.
	for (let index = 1; index < measureCount; index++) await read(index);
	globalThis.gc?.();
	const heapBytes = process.memoryUsage().heapUsed;
	const cpuStarted = process.cpuUsage();
	const started = performance.now();
	for (let index = 0; index < 280; index += 8) {
		const bodies = await Promise.all(
			Array.from({ length: 8 }, (_, offset) => read(index + offset)),
		);
		for (const body of bodies) hash.update(body);
	}
	const warmMs = performance.now() - started;
	const cpu = process.cpuUsage(cpuStarted);
	console.log(
		JSON.stringify({
			areaCount,
			measureCount,
			periods: periods.length,
			concurrency: 8,
			successful,
			failures: 0,
			coldMs,
			warmMs,
			cpuMs: (cpu.user + cpu.system) / 1000,
			heapBytes,
			sha256: hash.digest("hex"),
		}),
	);
} finally {
	server.closeAllConnections();
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
}
