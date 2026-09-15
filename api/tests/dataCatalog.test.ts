import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
	compileDataCatalog,
	onApril2023Authorities,
	type DataCatalogInputs,
} from "../src/dataCatalog";

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

/** Every qualification level, summing to the residents aged 16 and over. */
const qualificationBreakdown = (level4Plus: number) => ({
	noQualifications: 20,
	level1: 10,
	level2: 10,
	apprenticeship: 5,
	level3: 15,
	level4Plus,
	other: 5,
	total: level4Plus + 65,
});

/** All nineteen census ethnic groups, as the compiled dataset nests them. */
const ethnicGroups = (whiteBritish: number) => {
	const group = (names: string[]) =>
		Object.fromEntries(
			names.map((name) => [name, { ethnicity: name, population: 1 }]),
		);
	return {
		"Asian, Asian British or Asian Welsh": group([
			"Bangladeshi",
			"Chinese",
			"Indian",
			"Pakistani",
			"Other Asian",
		]),
		"Black, Black British, Black Welsh, Caribbean or African": group([
			"African",
			"Caribbean",
			"Other Black",
		]),
		"Mixed or Multiple ethnic groups": group([
			"White and Asian",
			"White and Black African",
			"White and Black Caribbean",
			"Other Mixed or Multiple ethnic groups",
		]),
		White: {
			...group([
				"Irish",
				"Gypsy or Irish Traveller",
				"Roma",
				"Other White",
			]),
			"English, Welsh, Scottish, Northern Irish or British": {
				ethnicity:
					"English, Welsh, Scottish, Northern Irish or British",
				population: whiteBritish,
			},
		},
		"Other ethnic group": group(["Arab", "Any other ethnic group"]),
	};
};

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

/** A year of total jobs; Northern Ireland is left out unless asked for. */
const jobsYear = (year: number, northernIreland: boolean) => ({
	year,
	boundaryYear: 2023,
	boundaryType: "localAuthority",
	data: {
		E06000001: { ladCode: "E06000001", totalJobs: 45000 },
		...(northernIreland
			? { N09000001: { ladCode: "N09000001", totalJobs: 68000 } }
			: {}),
		S12000001: { ladCode: "S12000001", totalJobs: 30000 },
		W06000001: { ladCode: "W06000001", totalJobs: 20000 },
	},
});

const writeSources = (
	directory: string,
	wardRecordCount = 2,
): DataCatalogInputs => {
	const manifest = join(directory, "dataset-manifest.json");
	const population = join(directory, "population.json");
	const populationUk = join(directory, "population-uk.json");
	const ghgEmissions = join(directory, "ghg-emissions.json");
	const mobileCoverage = join(directory, "mobile-coverage.json");
	const jobs = join(directory, "jobs.json");
	const landArea = join(directory, "land-area.json");
	const housePrice = join(directory, "house-price.json");
	const imd = join(directory, "imd.json");
	const nimdm = join(directory, "nimdm.json");
	const wimd = join(directory, "wimd.json");
	const simd = join(directory, "simd.json");
	const lifeExpectancySeries = join(directory, "life-expectancy-series.json");
	const populationConstituency = join(
		directory,
		"population-constituency.json",
	);
	const generalElection = join(directory, "general-election.json");
	const localElection = join(directory, "local-election.json");
	const censusPaths = {
		"travel-to-work": join(directory, "travel-to-work.json"),
		"car-availability": join(directory, "car-availability.json"),
		qualification: join(directory, "qualification.json"),
		ethnicity: join(directory, "ethnicity.json"),
	};
	const broadband = join(directory, "broadband.json");
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
				dataset("qualification", 2, 1, 2025),
				dataset("ethnicity", 2, 1, 2024),
				dataset("broadband", 4, 1, 2024),
				dataset("jobs", 7, 2, 2023),
				dataset("land-area", 2, 1, 2024),
				dataset("house-price", 3, 1, 2021),
				dataset("imd", 3, 1, 2011),
				dataset("nimdm", 2, 1, 2011),
				dataset("wimd", 1, 1, 2011),
				dataset("simd", 1, 1, 2011),
				dataset("life-expectancy-series", 4, 2, 2021),
				dataset("population-constituency", 4, 2, 2024),
				dataset("general-election", 4, 2, 2019),
				dataset("local-election", 5, 2, 2019),
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
		censusPaths.qualification,
		JSON.stringify({
			"2021": {
				year: 2021,
				boundaryYear: 2025,
				boundaryType: "localAuthority",
				data: {
					E06000001: { breakdown: qualificationBreakdown(35) },
					W06000001: { breakdown: qualificationBreakdown(25) },
				},
			},
		}),
	);
	writeFileSync(
		censusPaths.ethnicity,
		JSON.stringify({
			"2021": {
				year: 2021,
				boundaryYear: 2024,
				boundaryType: "localAuthority",
				data: {
					E06000001: ethnicGroups(900),
					W06000001: ethnicGroups(700),
				},
			},
		}),
	);
	writeFileSync(
		broadband,
		JSON.stringify({
			"2025": {
				year: 2025,
				boundaryYear: 2024,
				boundaryType: "localAuthority",
				data: Object.fromEntries(
					["E06000001", "N09000001", "S12000001", "W06000001"].map(
						(code, index) => [
							code,
							{
								ladCode: code,
								pctSuperfast: 90 + index,
								pctUltrafast: 70,
								pctFullFibre: index === 2 ? null : 60,
								pctGigabit: 65,
							},
						],
					),
				),
			},
		}),
	);
	writeFileSync(
		jobs,
		JSON.stringify({
			"2019": jobsYear(2019, false),
			"2020": jobsYear(2020, true),
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
					E05013018: {
						sourceWardCode: "E05000759",
						prices: { "2022": 179500 },
					},
				},
			},
		}),
	);
	writeFileSync(
		imd,
		JSON.stringify({
			"2019": {
				year: 2019,
				boundaryYear: 2011,
				boundaryType: "lsoa",
				data: {
					E01000001: { imdRank: 1, imdDecile: 1 },
					// A tie, exactly as the published file carries 26 of them.
					E01000002: { imdRank: 2, imdDecile: 1 },
					E01000003: { imdRank: 2, imdDecile: 1 },
				},
			},
		}),
	);
	writeFileSync(
		nimdm,
		JSON.stringify({
			"2017": {
				year: 2017,
				boundaryYear: 2011,
				boundaryType: "superOutputArea",
				data: {
					// NISRA codes, not GSS: a ward suffix and a split suffix.
					"95ZZ06W1": { nimdmRank: 1, nimdmDecile: 1 },
					"95AA01S1": { nimdmRank: 516, nimdmDecile: 6 },
				},
			},
		}),
	);
	writeFileSync(
		wimd,
		JSON.stringify({
			"2019": {
				year: 2019,
				boundaryYear: 2011,
				boundaryType: "lsoa",
				data: { W01000001: { wimdRank: 885, wimdDecile: 5 } },
			},
		}),
	);
	writeFileSync(
		simd,
		JSON.stringify({
			"2020": {
				year: 2020,
				boundaryYear: 2011,
				boundaryType: "dataZone",
				data: { S01010891: { simdRank: 1, simdDecile: 1 } },
			},
		}),
	);
	const estimate = (value: number) => ({
		value,
		lower: value - 0.7,
		upper: value + 0.7,
	});
	const lifeExpectancyPeriod = (year: number, offset: number) => ({
		year,
		period: `${year - 2}-${year}`,
		boundaryType: "localAuthority",
		boundaryYear: 2021,
		data: {
			E07000028: {
				male: estimate(77.29 - offset),
				female: estimate(81.5 - offset),
			},
			E06000001: {
				male: estimate(75.97 - offset),
				female: estimate(80.08 - offset),
			},
		},
	});
	writeFileSync(
		lifeExpectancySeries,
		JSON.stringify({
			"2003": lifeExpectancyPeriod(2003, 2),
			"2022": lifeExpectancyPeriod(2022, 0),
		}),
	);
	const constituencyYear = (year: number, offset: number) => ({
		year,
		boundaryType: "constituency",
		boundaryYear: 2024,
		data: {
			E14001063: { total: 119256 - offset },
			W07000081: { total: 90000 - offset },
		},
	});
	writeFileSync(
		populationConstituency,
		JSON.stringify({
			"2021": constituencyYear(2021, 1000),
			"2022": constituencyYear(2022, 0),
		}),
	);
	writeFileSync(
		generalElection,
		JSON.stringify({
			"2019": {
				year: 2019,
				boundaryType: "constituency",
				boundaryYear: 2019,
				data: {
					E14000001: {
						validVotes: 100,
						turnoutPercent: 70,
						partyVotes: { CON: 60, LAB: 40 },
					},
					W07000001: {
						validVotes: 80,
						turnoutPercent: 64,
						partyVotes: { LAB: 50, LD: 30 },
					},
				},
				results: { E14000001: "CON", W07000001: "LAB" },
			},
			"2024": {
				year: 2024,
				boundaryType: "constituency",
				boundaryYear: 2024,
				data: {
					E14001001: {
						validVotes: 110,
						turnoutPercent: 62,
						partyVotes: { CON: 40, LAB: 70 },
					},
					N06000001: {
						validVotes: 90,
						turnoutPercent: 58,
						partyVotes: { DUP: 45, SF: 45 },
					},
				},
				results: { E14001001: "LAB", N06000001: "DUP" },
			},
		}),
	);
	writeFileSync(
		localElection,
		JSON.stringify({
			"2019": {
				year: 2019,
				boundaryType: "ward",
				boundaryYear: 2019,
				data: {
					E05000001: {
						totalVotes: 100,
						turnoutPercent: 0,
						partyVotes: { CON: 60, LAB: 40 },
					},
					W05000001: {
						totalVotes: 80,
						turnoutPercent: 0,
						partyVotes: { LAB: 50, LD: 30 },
					},
					E58000050: {
						totalVotes: 50,
						turnoutPercent: 0,
						partyVotes: { CON: 30, LAB: 20 },
					},
				},
				results: {
					E05000001: "CON",
					W05000001: "LAB",
					E58000050: "CON",
				},
			},
			"2024": {
				year: 2024,
				boundaryType: "ward",
				boundaryYear: 2024,
				data: {
					E05001001: {
						totalVotes: 120,
						turnoutPercent: 42,
						partyVotes: { CON: 50, LAB: 70 },
					},
					W05001001: {
						totalVotes: 90,
						turnoutPercent: 39,
						partyVotes: { LAB: 45, PC: 45 },
					},
				},
				results: { E05001001: "LAB", W05001001: "LAB" },
			},
		}),
	);
	return {
		manifest,
		population,
		populationUk,
		ghgEmissions,
		mobileCoverage,
		travelToWork: censusPaths["travel-to-work"],
		carAvailability: censusPaths["car-availability"],
		qualification: censusPaths.qualification,
		ethnicity: censusPaths.ethnicity,
		broadband,
		jobs,
		landArea,
		housePrice,
		imd,
		nimdm,
		wimd,
		simd,
		lifeExpectancySeries,
		populationConstituency,
		generalElection,
		localElection,
	};
};

test("publishes source-exact ward and UK local-authority population partitions", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		const result = compileDataCatalog(sources);
		assert.equal(result.catalog.datasets.length, 20);
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
			{
				datasetId: "population-constituency",
				periods: ["2021", "2022"],
				sourceGeography: { type: "constituency", boundaryYear: 2024 },
				coverage: {
					kind: "partial",
					countries: ["GB-ENG", "GB-WLS"],
					recordCount: 2,
					note: "Published by ONS for the constituencies first contested in July 2024, in England and Wales only. These are ONS's own estimates for each constituency, not ward estimates added up: wards do not nest within these constituencies, and the published ward lookup splits some wards between them without weights.",
				},
			},
		]);
		assert.deepEqual(
			result.populationConstituencyObservations.periods[1]?.records,
			[
				{ areaCode: "E14001063", value: 119256, status: "observed" },
				{ areaCode: "W07000081", value: 90000, status: "observed" },
			],
		);
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
		const sources = writeSources(directory, 3);
		assert.throws(() => compileDataCatalog(sources), /expected 3 records/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("publishes source-exact election turnout and party vote counts", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const result = compileDataCatalog(writeSources(directory));
		const measure = (id: string) =>
			result.catalog.measures.find((candidate) => candidate.id === id);

		const generalVotes = measure("general-election-valid-votes");
		assert.equal(generalVotes?.aggregation.kind, "extensive");
		assert.deepEqual(
			generalVotes?.sources.map((source) => [
				source.sourceGeography,
				source.periods,
			]),
			[
				[{ type: "constituency", boundaryYear: 2019 }, ["2019"]],
				[{ type: "constituency", boundaryYear: 2024 }, ["2024"]],
			],
		);
		assert.equal(measure("general-election-lab-votes")?.unit, "votes");
		assert.equal(measure("local-election-pc-votes")?.valueKind, "count");
		assert.equal(
			measure("local-election-candidate-votes")?.sources[0]?.coverage
				.recordCount,
			2,
		);
		assert.match(
			measure("local-election-candidate-votes")?.notes?.[1] ?? "",
			/county-electoral-division codes is excluded/,
		);

		// The archive's older local-election files lack turnout; zero is not a
		// result, so 2019 is absent from that measure.
		assert.deepEqual(
			measure("local-election-turnout")?.sources.map(
				(source) => source.periods,
			),
			[["2024"]],
		);
		assert.equal(
			measure("local-election-turnout")?.aggregation.kind,
			"intensive",
		);

		const labour2019 = result.electionObservations.find(
			(artifact) =>
				artifact.measureId === "general-election-lab-votes" &&
				artifact.sourceGeography.boundaryYear === 2019,
		);
		assert.deepEqual(labour2019?.periods[0]?.records, [
			{ areaCode: "E14000001", value: 40, status: "observed" },
			{ areaCode: "W07000001", value: 50, status: "observed" },
		]);
		const reform2019 = result.electionObservations.find(
			(artifact) =>
				artifact.measureId === "general-election-sf-votes" &&
				artifact.sourceGeography.boundaryYear === 2019,
		);
		assert.deepEqual(
			reform2019?.periods[0]?.records.map((record) =>
				"value" in record ? record.value : undefined,
			),
			[0, 0],
		);
		const winners2019 = result.electionObservations.find(
			(artifact) =>
				artifact.measureId === "general-election-winning-party" &&
				artifact.sourceGeography.boundaryYear === 2019,
		);
		assert.deepEqual(winners2019?.periods[0]?.records, [
			{ areaCode: "E14000001", category: "CON", status: "observed" },
			{ areaCode: "W07000001", category: "LAB", status: "observed" },
		]);
		assert.deepEqual(
			measure("general-election-winning-party")?.aggregation,
			{
				kind: "categorical",
				available: false,
				note: "A winning-party label has no numeric order and cannot be summed, averaged, ranked or converted across areas.",
			},
		);
		const conservativeShare2019 = result.electionObservations.find(
			(artifact) =>
				artifact.measureId === "general-election-con-vote-share" &&
				artifact.sourceGeography.boundaryYear === 2019,
		);
		assert.deepEqual(conservativeShare2019?.periods[0]?.records, [
			{ areaCode: "E14000001", value: 60, status: "observed" },
			{ areaCode: "W07000001", value: 0, status: "observed" },
		]);
		assert.deepEqual(
			measure("general-election-con-vote-share")?.aggregation,
			{
				kind: "intensive",
				operation: "weighted-mean",
				weight: {
					description:
						"The area's valid ballot papers for the same election.",
					datasetField: "validVotes",
					measureId: "general-election-valid-votes",
				},
				available: true,
			},
		);
		assert.equal(measure("local-election-con-vote-share"), undefined);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("rejects local-authority population data whose codes change between periods", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		const source = JSON.parse(readFileSync(sources.populationUk, "utf8"));
		delete source["2024"].data.N09000001;
		writeFileSync(sources.populationUk, JSON.stringify(source));
		assert.throws(
			() => compileDataCatalog(sources),
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
			() => compileDataCatalog(sources),
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
			() => compileDataCatalog(sources),
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
		const result = compileDataCatalog(sources);

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

test("publishes total jobs with Northern Ireland absent, not zero, outside its years", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const result = compileDataCatalog(writeSources(directory));
		const periods = result.jobsObservations.periods;

		assert.deepEqual(
			periods.map((period) =>
				period.records.map((record) => record.areaCode),
			),
			[
				["E06000001", "S12000001", "W06000001"],
				["E06000001", "N09000001", "S12000001", "W06000001"],
			],
		);
		assert.deepEqual(periods[1]?.records[1], {
			areaCode: "N09000001",
			value: 68000,
			status: "observed",
		});

		const measure = result.catalog.measures.find(
			(candidate) => candidate.id === "total-jobs",
		);
		assert.equal(measure?.valueKind, "count");
		assert.equal(measure?.aggregation.kind, "extensive");
		assert.deepEqual(measure?.sources[0]?.coverage.countries, [
			"GB-ENG",
			"GB-NIR",
			"GB-SCT",
			"GB-WLS",
		]);
		assert.equal(measure?.sources[0]?.coverage.recordCount, 4);
		assert.match(
			measure?.sources[0]?.coverage.note ?? "",
			/Northern Ireland is published for 2020 only/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("refuses jobs where a British district is missing from a year", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		const source = JSON.parse(readFileSync(sources.jobs, "utf8"));
		delete source["2019"].data.W06000001;
		source["2020"].data.W06000002 = { totalJobs: 1000 };
		writeFileSync(sources.jobs, JSON.stringify(source));

		// Only a whole nation may be absent; anything else is a gap the
		// coverage note does not describe.
		assert.throws(
			() => compileDataCatalog(sources),
			/2019: GB-WLS districts do not match/,
		);
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
		const result = compileDataCatalog(sources);
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

test("publishes deprivation rank and decile as they were published", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		const result = compileDataCatalog(sources);
		const [rank, decile] = result.imdObservations;

		assert.equal(rank?.measureId, "imd-rank");
		assert.deepEqual(rank?.sourceGeography, {
			type: "lsoa",
			boundaryYear: 2011,
		});
		// Ties are served as published, not re-ranked into 1, 2, 3.
		assert.deepEqual(
			rank?.periods[0]?.records.map((record) => record.value),
			[1, 2, 2],
		);
		assert.equal(decile?.measureId, "imd-decile");

		for (const id of ["imd-rank", "imd-decile"]) {
			const measure = result.catalog.measures.find(
				(candidate) => candidate.id === id,
			);
			assert.equal(measure?.valueKind, "ordinal");
			assert.equal(measure?.aggregation.kind, "non-aggregatable");
			// The comparability limit is stated, not left to the caller.
			assert.match(measure?.notes?.[0] ?? "", /within England alone/);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("publishes the northern irish rank on its own nisra codes", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		const result = compileDataCatalog(sources);
		assert.deepEqual(
			result.nimdmObservations.periods[0]?.records.map((record) => [
				record.areaCode,
				record.value,
			]),
			[
				["95AA01S1", 516],
				["95ZZ06W1", 1],
			],
		);
		const measure = result.catalog.measures.find(
			(candidate) => candidate.id === "nimdm-rank",
		);
		// A NISRA code carries no country letter but is still Northern Ireland.
		assert.deepEqual(measure?.sources[0]?.coverage.countries, ["GB-NIR"]);
		// Only the rank is published; the decile is not NISRA's.
		assert.equal(
			result.catalog.measures.some(
				(candidate) => candidate.id === "nimdm-decile",
			),
			false,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("publishes each nation's index as its own family on its own geography", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		const result = compileDataCatalog(sources);
		const measure = (id: string) =>
			result.catalog.measures.find((candidate) => candidate.id === id);

		assert.deepEqual(measure("wimd-rank")?.sources[0]?.sourceGeography, {
			type: "lsoa",
			boundaryYear: 2011,
		});
		assert.deepEqual(measure("simd-decile")?.sources[0]?.sourceGeography, {
			type: "dataZone",
			boundaryYear: 2011,
		});
		assert.deepEqual(measure("simd-rank")?.sources[0]?.coverage.countries, [
			"GB-SCT",
		]);
		// Each says which nation it is a position within.
		assert.match(
			measure("wimd-rank")?.notes?.[0] ?? "",
			/within Wales alone/,
		);
		assert.match(
			measure("simd-rank")?.notes?.[0] ?? "",
			/within Scotland alone/,
		);
		assert.equal(
			measure("simd-rank")?.unit,
			"rank of 1 data zones, where 1 is the most deprived",
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("publishes the life expectancy series with each published interval", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		const result = compileDataCatalog(sources);
		const [male, female] = result.lifeExpectancyObservations;

		assert.equal(male?.measureId, "life-expectancy-male");
		assert.deepEqual(
			male?.periods.map((period) => period.period),
			["2001-2003", "2020-2022"],
		);
		const latest = male?.periods.at(-1)?.records[0];
		assert.equal(latest?.areaCode, "E06000001");
		assert.equal(latest?.value, 75.97);
		assert.ok(
			Math.abs((latest?.confidenceInterval?.lower ?? 0) - 75.27) < 1e-9,
		);
		assert.equal(female?.periods[0]?.records[0]?.value, 78.08);

		const measure = result.catalog.measures.find(
			(candidate) => candidate.id === "life-expectancy-female",
		);
		assert.equal(measure?.aggregation.kind, "non-aggregatable");
		assert.deepEqual(measure?.uncertainty?.kind, "confidence-interval");
		assert.equal(measure?.uncertainty?.level, 0.95);
		assert.equal(measure?.sources[0]?.datasetId, "life-expectancy-series");
		assert.equal(
			result.catalog.measures.some(
				(candidate) => candidate.id === "life-expectancy-total",
			),
			false,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("refuses an interval that does not contain its estimate", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const sources = writeSources(directory);
		const series = JSON.parse(
			readFileSync(sources.lifeExpectancySeries, "utf8"),
		);
		series["2022"].data.E06000001.male = {
			value: 75.97,
			lower: 76,
			upper: 77,
		};
		writeFileSync(sources.lifeExpectancySeries, JSON.stringify(series));
		assert.throws(
			() => compileDataCatalog(sources),
			/interval 76 to 77 does not contain 75.97/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("serves April 2023 authorities without the districts they replaced", () => {
	const observed = (areaCode: string, value: number) => ({
		areaCode,
		value,
		status: "observed" as const,
	});
	const period = {
		period: "2021",
		records: [
			observed("E06000001", 50),
			observed("E06000063", 60),
			observed("E07000026", 10),
			observed("E07000028", 20),
			observed("E07000029", 30),
		],
	};
	assert.deepEqual(
		onApril2023Authorities(period, ["E06000001", "E06000063"]).records,
		[observed("E06000001", 50), observed("E06000063", 60)],
	);
	// A successor that is not its predecessors' sum is not a merger to trust.
	assert.throws(
		() =>
			onApril2023Authorities(
				{
					...period,
					records: period.records.map((record) =>
						record.areaCode === "E06000063"
							? observed("E06000063", 61)
							: record,
					),
				},
				["E06000001", "E06000063"],
			),
		/E06000063 is not the sum of its predecessors/,
	);
	// Districts with no successor beside them are the wrong vintage.
	assert.throws(
		() =>
			onApril2023Authorities(
				{
					...period,
					records: period.records.filter(
						(record) => record.areaCode !== "E06000063",
					),
				},
				["E06000001", "E06000063"],
			),
		/does not hold exactly the April 2023 authorities/,
	);
});

test("publishes census qualifications and ethnic groups as counts on April 2023 codes", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const result = compileDataCatalog(writeSources(directory));
		const measure = (id: string) =>
			result.catalog.measures.find((candidate) => candidate.id === id);
		const values = (id: string) =>
			result.censusObservations
				.find((artifact) => artifact.measureId === id)
				?.periods[0]?.records.map((record) => [
					record.areaCode,
					"value" in record ? record.value : undefined,
				]);

		assert.equal(
			measure("qualification-level-4-plus")?.unit,
			"usual residents aged 16 and over",
		);
		assert.deepEqual(values("qualification-level-4-plus"), [
			["E06000001", 35],
			["W06000001", 25],
		]);
		assert.deepEqual(values("qualification-total"), [
			["E06000001", 100],
			["W06000001", 90],
		]);

		// Nineteen ethnic groups, and no separate total: they are exhaustive.
		const ethnicMeasures = result.catalog.measures.filter((candidate) =>
			candidate.id.startsWith("ethnicity-"),
		);
		assert.equal(ethnicMeasures.length, 19);
		assert.deepEqual(values("ethnicity-white-british"), [
			["E06000001", 900],
			["W06000001", 700],
		]);
		for (const candidate of [
			...ethnicMeasures,
			measure("qualification-total"),
		])
			assert.deepEqual(candidate?.sources[0]?.sourceGeography, {
				type: "localAuthority",
				boundaryYear: 2023,
			});
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("publishes a single-period indicator and names the authorities it has no value for", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "uk-data-atlas-data-catalog-"),
	);
	try {
		const result = compileDataCatalog(writeSources(directory));
		const measure = (id: string) =>
			result.catalog.measures.find((candidate) => candidate.id === id);
		const records = (id: string) =>
			result.indicatorObservations.find(
				(artifact) => artifact.measureId === id,
			)?.periods;

		assert.deepEqual(records("broadband-superfast-availability"), [
			{
				period: "2025-07",
				records: [
					{ areaCode: "E06000001", value: 90, status: "observed" },
					{ areaCode: "N09000001", value: 91, status: "observed" },
					{ areaCode: "S12000001", value: 92, status: "observed" },
					{ areaCode: "W06000001", value: 93, status: "observed" },
				],
			},
		]);
		assert.equal(
			measure("broadband-superfast-availability")?.sources[0]?.coverage
				.kind,
			"source-reported",
		);
		// A share is weighted, never summed, and is not offered for aggregation.
		assert.equal(
			measure("broadband-gigabit-availability")?.aggregation.kind,
			"intensive",
		);
		assert.equal(
			measure("broadband-gigabit-availability")?.availability.aggregation,
			false,
		);

		const fullFibre = measure("broadband-full-fibre-availability")
			?.sources[0]?.coverage;
		assert.equal(fullFibre?.kind, "partial");
		assert.equal(fullFibre?.recordCount, 3);
		assert.match(
			fullFibre?.note ?? "",
			/No value is published for 1 of the 4 authorities: S12000001\./,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
