import { strict as assert } from "node:assert";
import { performance } from "node:perf_hooks";
import { loadRoadCollisionsByAuthority } from "../../packages/datasets/src/data/road-safety/authorityLoader";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";
import { compileDuckdbRoadCollisions } from "../../pipeline/src/precompile/duckdbRoadCollisions.mts";

const baseline = createTrackedReader();
let start = performance.now();
const expected = await loadRoadCollisionsByAuthority(baseline.reader.text);
console.log(`Node: ${((performance.now() - start) / 1000).toFixed(2)} seconds`);
const candidate = createTrackedReader();
start = performance.now();
const actual = await compileDuckdbRoadCollisions(candidate.artifacts);
console.log(
	`DuckDB with source hashing: ${((performance.now() - start) / 1000).toFixed(2)} seconds`,
);
assert.deepEqual(actual, expected);
assert.equal(JSON.stringify(actual), JSON.stringify(expected));
assert.deepEqual(
	[...candidate.artifacts].sort(),
	[...baseline.artifacts].sort(),
);
console.log(`Output and ${candidate.artifacts.size} source artifacts match`);
