import assert from "node:assert/strict";
import test from "node:test";
import { readDatasetCoverage } from "../src/datasetCoverage";

const codes = ["E00000001", "E00000002", "E00000003", "E00000004", "E00000005"];
const values = Object.fromEntries(codes.map((code) => [code, 1]));

test("deduplicates coverage, keeps years descending and preserves equal title order", async () => {
	const data: Record<string, unknown> = {
		"dataset-manifest": {
			datasets: [
				{ output: "z", source: { name: "Same" } },
				{ output: "a", source: { name: "Same" } },
				{ output: "z", source: { name: "Ignored" } },
			],
		},
		z: {
			2021: { values, duplicate: values },
			2023: { values },
			invalid: { values },
		},
		a: {
			first: { year: 2022, values },
			sparse: { year: 2020, values: { E00000001: 1 } },
		},
	};
	const lookup = await readDatasetCoverage((key) =>
		JSON.stringify(data[key]),
	);
	assert.deepEqual(lookup(codes[0]!), [
		{ slug: "z", title: "Same", years: [2023, 2021] },
		{ slug: "a", title: "Same", years: [2022] },
	]);
	assert.deepEqual(lookup("E99999999"), []);
});
