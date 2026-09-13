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

/** Every travel mode, because the compiler reads each as its own measure. */
const travelBreakdown = (car: number) => ({
	workFromHome: 10,
	publicTransport: 20,
	car,
	taxi: 1,
	motorcycle: 2,
	bicycle: 3,
	onFoot: 4,
	other: 5,
	total: car + 45,
});

/** The same for every car-availability band. */
const carBreakdown = (noCar: number) => ({
	noCar,
	oneCar: 40,
	twoCars: 30,
	threeOrMoreCars: 10,
	total: noCar + 80,
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
	const landArea = join(directory, "land-area.json");
	const housePrice = join(directory, "house-price.json");
	const censusPaths = {
		"travel-to-work": join(directory, "travel-to-work.json"),
		"car-availability": join(directory, "car-availability.json"),
	};
	writeFileSync(
		manifest,
		JSON.stringify({
			version: 4,
			datasets: [
				dataset("population", wardRecordCount, 1),
				dataset("population-uk", 8, 2),
				dataset("ghg-emissions", 4, 2, 2025),
				dataset("mobile-coverage", 2, 1, 2024),
				dataset("travel-to-work", 2, 1, 2025),
				dataset("car-availability", 2, 1, 2025),
				dataset("land-area", 2, 1, 2024),
				dataset("house-price", 3, 1, 2021),
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
	writeFileSync(
		censusPaths["travel-to-work"],
		JSON.stringify({
			"2021": {
				year: 2021,
				boundaryYear: 2025,
				boundaryType: "localAuthority",
				data: {
					E06000001: { breakdown: travelBreakdown(240) },
					W06000001: { breakdown: travelBreakdown(120) },
				},
			},
		}),
	);
	writeFileSync(
		censusPaths["car-availability"],
		JSON.stringify({
			"2021": {
				year: 2021,
				boundaryYear: 2025,
				boundaryType: "localAuthority",
				data: {
					E06000001: { breakdown: carBreakdown(100) },
					W06000001: { breakdown: carBreakdown(50) },
				},
			},
		}),
	);
	writeFileSync(
		landArea,
		JSON.stringify({
			"2024": {
				year: 2024,
				boundaryYear: 2024,
				boundaryType: "localAuthority",
				data: {
					E06000001: { landSquareKm: 10 },
					N09000001: { landSquareKm: 20 },
					S12000001: { landSquareKm: 40 },
					W06000001: { landSquareKm: 50 },
				},
			},
		}),
	);
	writeFileSync(
		housePrice,
		JSON.stringify({
			"2023": {
				year: 2023,
				boundaryYear: 2021,
				boundaryType: "ward",
				data: {
					E05008945: {
						prices: { "2021": 90000, "2022": 95000, "2023": 99000 },
					},
					// Compiled under Salford's 2021 code; published under E05000759.
					E05013018: { prices: { "2022": 179500 } },
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
		censusPaths,
		landArea,
		housePrice,
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
			censusPaths,
			landArea,
			housePrice,
		} = writeSources(directory);
		const result = compileDataCatalog(
			manifest,
			population,
			populationUk,
			ghgEmissions,
			mobileCoverage,
			censusPaths,
			landArea,
			housePrice,
		);
		assert.equal(result.catalog.datasets.length, 8);
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
			censusPaths,
			landArea,
			housePrice,
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
			censusPaths,
			landArea,
			housePrice,
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
			censusPaths,
			landArea,
			housePrice,
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
			censusPaths,
			landArea,
			housePrice,
		),
			/local-authority codes change between periods/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("refuses to derive density when the denominator misses an area", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		// Drop one authority the population partition publishes.
		writeFileSync(
			sources.landArea,
			JSON.stringify({
				"2024": {
					year: 2024,
					boundaryYear: 2024,
					boundaryType: "localAuthority",
					data: {
						E06000001: { landSquareKm: 10 },
						N09000001: { landSquareKm: 20 },
						S12000001: { landSquareKm: 40 },
					},
				},
			}),
		);

		assert.throws(
			() =>
				compileDataCatalog(
					sources.manifest,
					sources.population,
					sources.populationUk,
					sources.ghgEmissions,
					sources.mobileCoverage,
					sources.censusPaths,
					sources.landArea,
					sources.housePrice,
				),
			/no land area for W06000001/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("refuses to derive density from an area with no land", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		writeFileSync(
			sources.landArea,
			JSON.stringify({
				"2024": {
					year: 2024,
					boundaryYear: 2024,
					boundaryType: "localAuthority",
					data: {
						E06000001: { landSquareKm: 0 },
						N09000001: { landSquareKm: 20 },
						S12000001: { landSquareKm: 40 },
						W06000001: { landSquareKm: 50 },
					},
				},
			}),
		);

		// A zero denominator would publish Infinity as a density.
		assert.throws(
			() =>
				compileDataCatalog(
					sources.manifest,
					sources.population,
					sources.populationUk,
					sources.ghgEmissions,
					sources.mobileCoverage,
					sources.censusPaths,
					sources.landArea,
					sources.housePrice,
				),
			/E06000001 has no land area/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("derives density and marks the values as derived, not observed", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		const result = compileDataCatalog(
			sources.manifest,
			sources.population,
			sources.populationUk,
			sources.ghgEmissions,
			sources.mobileCoverage,
			sources.censusPaths,
			sources.landArea,
			sources.housePrice,
		);

		const density = result.populationDensityObservations;
		const record = density.periods[0]?.records.find(
			(candidate) => candidate.areaCode === "E06000001",
		);
		// 7 people over 10 square kilometres.
		assert.equal(record?.value, 0.7);
		assert.equal(record?.status, "derived");

		const measure = result.catalog.measures.find(
			(candidate) => candidate.id === "population-density",
		);
		assert.equal(measure?.aggregation.kind, "intensive");
		// The denominator is attributable even though it is not a source.
		assert.deepEqual(measure?.derivedFrom?.datasetIds, [
			"population-uk",
			"land-area",
		]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("publishes house prices under the publisher's own codes and years", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		const result = compileDataCatalog(
			sources.manifest,
			sources.population,
			sources.populationUk,
			sources.ghgEmissions,
			sources.mobileCoverage,
			sources.censusPaths,
			sources.landArea,
			sources.housePrice,
		);
		const periods = result.housePriceObservations.periods;

		// The year ending March 2023 is not a comparable period.
		assert.deepEqual(
			periods.map((period) => period.period),
			["2021", "2022"],
		);
		// Salford's value is restored to the code it was published against,
		// because its wards were redrawn in 2021.
		assert.deepEqual(
			periods[1]?.records.map((record) => record.areaCode),
			["E05000759", "E05008945"],
		);

		const measure = result.catalog.measures.find(
			(candidate) => candidate.id === "house-price-median",
		);
		assert.equal(measure?.aggregation.kind, "non-aggregatable");
		assert.equal(
			measure?.aggregation.kind === "non-aggregatable"
				? measure.aggregation.statistic
				: undefined,
			"median",
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
