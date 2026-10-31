import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createApiServer } from "../src/apiServer";
import type { DataCatalog } from "@uk-data-atlas/atlas-runtime/catalogue";
import { canonicalMeasureId } from "../src/catalogue/measureTerms";
import { dataCatalog, testContext } from "../tests/routeFixtures";

// From services/api: node --import tsx scripts/benchmark-measure-lookup.ts
// For production timings, bundle as build-runtime.mjs does and run with node.
const measureCount = 1000;
const template = dataCatalog.measures[0];
assert.ok(template);
const catalog: DataCatalog = {
	...dataCatalog,
	measures: Array.from({ length: measureCount }, (_, index) => ({
		...template,
		id: `measure-${index}`,
		aliases: [`alias-${index}`],
	})),
};
const terms = catalog.measures.flatMap((measure) => [
	measure.id,
	...(measure.aliases ?? []),
]);
// Warm the catalogue lookup before either timed section.
assert.equal(canonicalMeasureId(catalog, "alias-999"), "measure-999");
let checksum = 0;
const lookupStarted = performance.now();
for (let index = 0; index < 100_000; index++) {
	const found = canonicalMeasureId(catalog, terms[index % terms.length]!);
	assert.equal(found, `measure-${Math.floor((index % terms.length) / 2)}`);
	checksum += found.length;
}
const lookupMs = performance.now() - lookupStarted;
assert.equal(checksum, 1_089_000);
const server = createApiServer(testContext({ dataCatalog: catalog }), {
	responseCacheBytes: 32 * 1024 * 1024,
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}`;
let successful = 0;
const hash = createHash("sha256");
try {
	const health = await fetch(`${base}/healthz`);
	assert.equal(health.status, 200);
	await health.text();
	const cpuStarted = process.cpuUsage();
	const started = performance.now();
	for (let index = 0; index < measureCount; index += 8) {
		const bodies = await Promise.all(
			Array.from({ length: 8 }, async (_, offset) => {
				const id = index + offset;
				const response = await fetch(
					`${base}/v1/measures/alias-${id}`,
					{
						headers: { "accept-encoding": "identity" },
					},
				);
				assert.equal(response.status, 200);
				assert.equal(
					response.headers.get("content-location"),
					`/v1/measures/measure-${id}`,
				);
				const body = await response.text();
				const result: unknown = JSON.parse(body);
				assert.ok(
					result && typeof result === "object" && "data" in result,
				);
				const data = result.data;
				assert.ok(data && typeof data === "object" && "id" in data);
				assert.equal(data.id, `measure-${id}`);
				assert.ok("aliases" in data);
				assert.deepEqual(data.aliases, [`alias-${id}`]);
				assert.ok("sources" in data && Array.isArray(data.sources));
				assert.equal(data.sources.length, 2);
				successful++;
				return body;
			}),
		);
		for (const body of bodies) hash.update(body);
	}
	const httpMs = performance.now() - started;
	const cpu = process.cpuUsage(cpuStarted);
	console.log(
		JSON.stringify({
			measureCount,
			lookups: 100_000,
			checksum,
			lookupMs,
			httpMs,
			httpCpuMs: (cpu.user + cpu.system) / 1000,
			concurrency: 8,
			successful,
			failures: 0,
			sha256: hash.digest("hex"),
		}),
	);
} finally {
	server.closeAllConnections();
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
}
