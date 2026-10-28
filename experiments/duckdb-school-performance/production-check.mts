import { strict as assert } from "node:assert";
import { performance } from "node:perf_hooks";
import { loadSchoolPerformance } from "../../packages/datasets/src/data/school-performance/loader";
import { loadSchoolPerformanceDisadvantage } from "../../packages/datasets/src/data/school-performance-disadvantage/loader";
import { loadSchoolPerformanceConstituency } from "../../packages/datasets/src/data/school-performance-constituency/loader";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";
import { withDuckdbSchoolPerformance } from "../../pipeline/src/precompile/duckdbDatasetCsv.mts";

for (const [name, topic, load] of [
	["school performance", "Total", loadSchoolPerformance],
	["constituency", "Constituency", loadSchoolPerformanceConstituency],
	["disadvantage", "Disadvantage status", loadSchoolPerformanceDisadvantage],
] as const) {
	const baseline = createTrackedReader();
	let start = performance.now();
	const expected = await load(baseline.reader.text);
	const nodeSeconds = (performance.now() - start) / 1000;
	const candidate = createTrackedReader();
	start = performance.now();
	const actual = await withDuckdbSchoolPerformance(
		candidate.reader,
		candidate.artifacts,
		topic,
		(reader) => load(reader.text),
	);
	const duckdbSeconds = (performance.now() - start) / 1000;
	assert.deepEqual(actual, expected);
	assert.equal(JSON.stringify(actual), JSON.stringify(expected));
	assert.deepEqual([...candidate.artifacts], [...baseline.artifacts]);
	assert.ok(Object.keys(actual).length > 0);
	console.log(
		JSON.stringify({
			name,
			nodeSeconds,
			duckdbSeconds,
			sourceArtifacts: candidate.artifacts.size,
			years: Object.keys(actual),
		}),
	);
}
