import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createApiServer } from "../src/apiServer";
import {
	tableMeasureObservations,
	type MeasureTableArtifact,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { dataCatalog, testContext } from "../tests/routeFixtures";

// From services/api: node --expose-gc --import tsx scripts/benchmark-observation-tables.ts
// For production timings, bundle as build-runtime.mjs does and run with node --expose-gc.
const areaCount = 35_000;
const measureCount = 14;
const template = dataCatalog.measures.find(
	(measure) => measure.id === "small-area-fixture",
);
assert.ok(template);
const measures = Array.from({ length: measureCount }, (_, index) => ({
	...template,
	id: `table-${index}`,
}));
const table: MeasureTableArtifact = {
	schemaVersion: 1,
	kind: "measure-table",
	contentHash: "sha256:synthetic-table",
	id: "synthetic-table",
	datasetId: "small-area",
	sourceGeography: { type: "lsoa", boundaryYear: 2011 },
	period: "2019",
	measures: measures.map((measure) => measure.id),
	records: Array.from({ length: areaCount }, (_, index) => [
		`E${String(1000000 + index).padStart(8, "0")}`,
		...measures.map((_, column) => index + column),
	]),
};
const server = createApiServer(
	testContext({
		dataCatalog: { ...dataCatalog, measures },
		measureObservations: measures.map((measure) =>
			tableMeasureObservations(table, measure.id),
		),
	}),
	{ responseCacheBytes: 0 },
);
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}`;
const hash = createHash("sha256");
let successful = 0;
const readPages = async () => {
	const started = performance.now();
	for (let column = 0; column < measureCount; column++) {
		const response = await fetch(
			`${base}/v1/data/table-${column}?period=2019&geography=lsoa&codeYear=2011&limit=100`,
			{ headers: { "accept-encoding": "identity" } },
		);
		assert.equal(response.status, 200);
		const body = await response.text();
		const result: unknown = JSON.parse(body);
		assert.ok(result && typeof result === "object" && "data" in result);
		const data = result.data;
		assert.ok(data && typeof data === "object" && "records" in data);
		assert.deepEqual(
			data.records,
			table.records.slice(0, 100).map((row, index) => ({
				areaCode: row[0],
				value: index + column,
				status: "observed",
			})),
		);
		hash.update(body);
		successful++;
	}
	return performance.now() - started;
};
try {
	// Initialise the HTTP client and server without touching the table views.
	const health = await fetch(`${base}/healthz`);
	assert.equal(health.status, 200);
	await health.text();
	globalThis.gc?.();
	const cpuStarted = process.cpuUsage();
	const coldMs = await readPages();
	const cpu = process.cpuUsage(cpuStarted);
	const warmMs = await readPages();
	console.log(
		JSON.stringify({
			areaCount,
			measureCount,
			pageSize: 100,
			concurrency: 1,
			successful,
			failures: 0,
			coldMs,
			warmMs,
			coldCpuMs: (cpu.user + cpu.system) / 1000,
			sha256: hash.digest("hex"),
		}),
	);
} finally {
	server.closeAllConnections();
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
}
