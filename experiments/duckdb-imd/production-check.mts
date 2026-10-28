import { strict as assert } from "node:assert";
import { performance } from "node:perf_hooks";
import { loadIMD } from "../../packages/datasets/src/data/imd/loader";
import { withDuckdbImd } from "../../pipeline/src/precompile/duckdbDatasetCsv.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";
const node = createTrackedReader();
let start = performance.now();
const expected = await loadIMD(node.reader.text);
const nodeSeconds = (performance.now() - start) / 1000;
const duckdb = createTrackedReader();
start = performance.now();
const actual = await withDuckdbImd(duckdb.reader, duckdb.artifacts, (reader) =>
	loadIMD(reader.text),
);
const duckdbSeconds = (performance.now() - start) / 1000;
assert.deepEqual(actual, expected);
assert.equal(JSON.stringify(actual), JSON.stringify(expected));
assert.deepEqual([...duckdb.artifacts], [...node.artifacts]);
assert.ok(Object.keys(actual[2025]!.data).length > 30000);
console.log(
	JSON.stringify({
		nodeSeconds,
		duckdbSeconds,
		areas: Object.keys(actual[2025]!.data).length,
		artifacts: duckdb.artifacts.size,
	}),
);
