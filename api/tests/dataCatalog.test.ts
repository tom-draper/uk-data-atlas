import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { compileDataCatalog } from "../src/dataCatalog";

test("publishes dataset lineage and source-exact England and Wales population observations", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const manifest = join(directory, "dataset-manifest.json");
		const population = join(directory, "population.json");
		writeFileSync(
			manifest,
			JSON.stringify({
				version: 4,
				datasets: [
					{
						output: "population",
						source: {
							name: "Population",
							source: "Office for National Statistics",
							sourceUrl: "https://example.com/population",
							year: "2022",
							licence: "Open Government Licence v3.0",
							licenceUrl: "https://example.com/licence",
						},
						inputs: [
							{
								kind: "xlsxSheet",
								path: "population.xlsx#data",
								bytes: 12,
								sha256: "input",
							},
						],
						summary: {
							datasetCount: 1,
							dataRecordCount: 2,
							boundaryYears: [2023],
						},
						compiled: { bytes: 10, sha256: "compiled" },
					},
				],
			}),
		);
		writeFileSync(
			population,
			JSON.stringify({
				"2022": {
					boundaryYear: 2023,
					boundaryType: "ward",
					data: {
						W05000001: { total: { "0": 5, "90": 2 } },
						E05000001: { total: { "0": 4, "90": 3 } },
					},
				},
			}),
		);

		const { catalog, populationObservations } = compileDataCatalog(
			manifest,
			population,
		);
		assert.equal(catalog.datasets.length, 1);
		assert.equal(catalog.measures[0]?.coverage.kind, "partial");
		assert.deepEqual(catalog.measures[0]?.coverage.countries, [
			"GB-ENG",
			"GB-WLS",
		]);
		assert.deepEqual(populationObservations.records, [
			{ areaCode: "E05000001", value: 7, status: "observed" },
			{ areaCode: "W05000001", value: 7, status: "observed" },
		]);
		assert.match(catalog.contentHash, /^sha256:[a-f0-9]{64}$/);
		assert.match(
			populationObservations.contentHash,
			/^sha256:[a-f0-9]{64}$/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("rejects a population source whose record count disagrees with its manifest", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const manifest = join(directory, "dataset-manifest.json");
		const population = join(directory, "population.json");
		writeFileSync(
			manifest,
			JSON.stringify({
				version: 1,
				datasets: [
					{
						output: "population",
						source: {
							name: "Population",
							source: "ONS",
							sourceUrl: "https://example.com",
							year: "2022",
							licence: "OGL",
						},
						inputs: [],
						summary: {
							datasetCount: 1,
							dataRecordCount: 2,
							boundaryYears: [2023],
						},
						compiled: { bytes: 1, sha256: "x" },
					},
				],
			}),
		);
		writeFileSync(
			population,
			JSON.stringify({
				"2022": {
					boundaryYear: 2023,
					boundaryType: "ward",
					data: { E05000001: { total: { "0": 1 } } },
				},
			}),
		);
		assert.throws(
			() => compileDataCatalog(manifest, population),
			/expected 2 records/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
