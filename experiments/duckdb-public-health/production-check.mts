import { strict as assert } from "node:assert";
import { performance } from "node:perf_hooks";
import { loadPublicHealth } from "../../packages/datasets/src/data/public-health/loader";
import { withDuckdbPublicHealth } from "../../pipeline/src/precompile/duckdbPublicHealth.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

const baseline = createTrackedReader();
let start = performance.now();
const expected = await loadPublicHealth(baseline.reader.csvRows);
console.log(`Node: ${((performance.now() - start) / 1000).toFixed(2)} seconds`);
const candidate = createTrackedReader();
start = performance.now();
const actual = await withDuckdbPublicHealth(
	candidate.reader,
	candidate.artifacts,
	(reader) => loadPublicHealth(reader.csvRows),
);
console.log(
	`DuckDB with source hashing: ${((performance.now() - start) / 1000).toFixed(2)} seconds`,
);
assert.equal(JSON.stringify(actual), JSON.stringify(expected));
assert.deepEqual([...candidate.artifacts], [...baseline.artifacts]);
assert.ok(Object.keys(actual[2025]!.data).length > 100);
console.log(
	`Output and ${candidate.artifacts.size} source artifacts match, ${Object.keys(actual[2025]!.data).length} areas`,
);
