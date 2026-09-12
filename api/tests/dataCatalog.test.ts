import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { compileDataCatalog } from "../src/dataCatalog";

const dataset = (
	output: string,
	dataRecordCount: number,
	datasetCount: number,
	boundaryYear = 2023,
) => ({
	output,
	source: {
		name: output,
		source: "Office for National Statistics",
		sourceUrl: `https://example.com/${output}`,
		year: output === "population" ? "2022" : "2011-2024",
		licence: "Open Government Licence v3.0",
	},
	inputs: [],
	summary: { datasetCount, dataRecordCount, boundaryYears: [boundaryYear] },
	compiled: { bytes: 10, sha256: "compiled" },
});

/** One authority-year of emissions, with a land-use sink that pulls it down. */
const emissionsYear = (year: number) => ({
	year,
	boundaryYear: 2025,
	boundaryType: "localAuthority",
	data: {
		E06000001: { totalKtCO2e: 400 },
		S12000001: { totalKtCO2e: -5 },
	},
});

const writeSources = (directory: string, wardRecordCount = 2) => {
	const manifest = join(directory, "dataset-manifest.json");
	const population = join(directory, "population.json");
	const populationUk = join(directory, "population-uk.json");
	const ghgEmissions = join(directory, "ghg-emissions.json");
	const mobileCoverage = join(directory, "mobile-coverage.json");
	writeFileSync(
		manifest,
		JSON.stringify({
			version: 4,
			datasets: [
				dataset("population", wardRecordCount, 1),
				dataset("population-uk", 8, 2),
				dataset("ghg-emissions", 4, 2, 2025),
				dataset("mobile-coverage", 2, 1, 2024),
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
	const localAuthorities = {
		E06000001: { total: { "0": 4, "90": 3 } },
		N09000001: { total: { "0": 5, "90": 2 } },
		S12000001: { total: { "0": 6, "90": 1 } },
		W06000001: { total: { "0": 7, "90": 2 } },
	};
	writeFileSync(
		populationUk,
		JSON.stringify({
			"2023": {
				year: 2023,
				boundaryYear: 2023,
				boundaryType: "localAuthority",
				data: localAuthorities,
			},
			"2024": {
				year: 2024,
				boundaryYear: 2023,
				boundaryType: "localAuthority",
				data: localAuthorities,
			},
		}),
	);
	writeFileSync(
		ghgEmissions,
		JSON.stringify({
			"2023": emissionsYear(2023),
			"2024": emissionsYear(2024),
		}),
	);
	writeFileSync(
		mobileCoverage,
		JSON.stringify({
			"2025": {
				year: 2025,
				boundaryYear: 2024,
				boundaryType: "localAuthority",
				data: {
					E06000001: { pct4GIndoorAll: 96.5, pct5GOutdoorAll: 40 },
					S12000001: { pct4GIndoorAll: 51.7, pct5GOutdoorAll: 0 },
				},
			},
		}),
	);
	return {
		manifest,
		population,
		populationUk,
		ghgEmissions,
		mobileCoverage,
	};
};

test("publishes source-exact ward and UK local-authority population partitions", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const {
			manifest,
			population,
			populationUk,
			ghgEmissions,
			mobileCoverage,
		} = writeSources(directory);
		const result = compileDataCatalog(
			manifest,
			population,
			populationUk,
			ghgEmissions,
			mobileCoverage,
		);
		assert.equal(result.catalog.datasets.length, 4);
		assert.deepEqual(result.catalog.measures[0]?.sources, [
			{
				datasetId: "population",
				periods: ["2022"],
				sourceGeography: { type: "ward", boundaryYear: 2023 },
				coverage: {
					kind: "partial",
					countries: ["GB-ENG", "GB-WLS"],
					recordCount: 2,
					note: "Published source records are available for England and Wales only; this endpoint does not infer Scottish or Northern Irish values.",
				},
			},
			{
				datasetId: "population-uk",
				periods: ["2023", "2024"],
				sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
				coverage: {
					kind: "source-reported",
					countries: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"],
					recordCount: 4,
					note: "Published source records cover all four UK nations for every available period. Historic values remain keyed to the source's 2023 local-authority code vintage.",
				},
			},
		]);
		assert.deepEqual(result.populationObservations.records, [
			{ areaCode: "E05000001", value: 7, status: "observed" },
			{ areaCode: "W05000001", value: 7, status: "observed" },
		]);
		assert.equal(
			result.populationLocalAuthorityObservations.periods.length,
			2,
		);
		assert.deepEqual(
			result.populationLocalAuthorityObservations.periods[1]?.records[1],
			{ areaCode: "N09000001", value: 7, status: "observed" },
		);
		assert.match(result.catalog.contentHash, /^sha256:[a-f0-9]{64}$/);
		assert.match(
			result.populationLocalAuthorityObservations.contentHash,
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
		const {
			manifest,
			population,
			populationUk,
			ghgEmissions,
			mobileCoverage,
		} = writeSources(
			directory,
			3,
		);
		assert.throws(
			() => compileDataCatalog(
			manifest,
			population,
			populationUk,
			ghgEmissions,
			mobileCoverage,
		),
			/expected 3 records/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("rejects local-authority population data whose codes change between periods", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const {
			manifest,
			population,
			populationUk,
			ghgEmissions,
			mobileCoverage,
		} = writeSources(directory);
		const source = JSON.parse(readFileSync(populationUk, "utf8"));
		delete source["2024"].data.N09000001;
		writeFileSync(populationUk, JSON.stringify(source));
		assert.throws(
			() => compileDataCatalog(
			manifest,
			population,
			populationUk,
			ghgEmissions,
			mobileCoverage,
		),
			/local-authority codes change between periods/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
