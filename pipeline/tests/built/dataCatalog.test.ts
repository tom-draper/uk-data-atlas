import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "vitest";
import {
	compileDataCatalog,
	type DataCatalogInputs,
} from "../../src/catalog/compileDataCatalog";
import { onApril2023Authorities } from "../../src/catalog/authorityChanges";
import { CENSUS_BREAKDOWNS } from "../../src/catalog/census";
import { fileURLToPath } from "node:url";
import type { DataCatalog } from "@uk-data-atlas/catalogue/node";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import {
	crimeSeries,
	DATASET_DECLARATIONS,
	energyConsumptionSeries,
	roadCollisionSeries,
} from "@uk-data-atlas/datasets";
import {
	fixtureRows,
	type FixtureContest,
	type FixtureGap,
	type FixtureSeries,
} from "../catalog/rowFixtures.ts";

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

/** The districts replaced in April 2023, which an April 2021 partition holds. */
const UNEMPLOYMENT_DISTRICTS_2023 = [
	"E07000026",
	"E07000027",
	"E07000028",
	"E07000029",
	"E07000030",
	"E07000031",
	"E07000163",
	"E07000164",
	"E07000165",
	"E07000166",
	"E07000167",
	"E07000168",
	"E07000169",
	"E07000187",
	"E07000188",
	"E07000189",
	"E07000246",
];

/** The districts replaced in April 2020 and 2021, only in an April 2019 partition. */
const UNEMPLOYMENT_DISTRICTS_2021 = [
	"E07000004",
	"E07000005",
	"E07000006",
	"E07000007",
	"E07000150",
	"E07000151",
	"E07000152",
	"E07000153",
	"E07000154",
	"E07000155",
	"E07000156",
];

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

const GB_CODES = ["E06000001", "S12000001", "W06000001"];

/** The nominal Northern Ireland value, present in one jobs year only. */
const jobsSeries = (): FixtureSeries => ({
	dataset: "jobs",
	measure: "total-jobs",
	geography: "localAuthority",
	release: "2023-uk-bfc",
	periods: {
		"2019": { E06000001: 45000, S12000001: 30000, W06000001: 20000 },
		// Northern Ireland is published for 2020 only.
		"2020": {
			E06000001: 45000,
			N09000001: 68000,
			S12000001: 30000,
			W06000001: 20000,
		},
	},
});

/** The population and the land area (in hectares) density divides it by. */
const densitySeries = (): FixtureSeries[] => [
	{
		dataset: "population-uk",
		measure: "population",
		geography: "localAuthority",
		release: "2023-uk-bfc",
		periods: Object.fromEntries(
			["2023", "2024"].map((year) => [
				year,
				{
					E06000001: 7,
					N09000001: 7,
					S12000001: 7,
					W06000001: 9,
				},
			]),
		),
	},
	{
		dataset: "land-area",
		measure: "area",
		geography: "localAuthority",
		release: "2024-uk-bfc",
		members: { surface: "land" },
		periods: {
			"2024": {
				E06000001: 1000,
				N09000001: 2000,
				S12000001: 4000,
				W06000001: 5000,
			},
		},
	},
];

const houseSeries = (): FixtureSeries => ({
	dataset: "house-price",
	measure: "house-price-median",
	geography: "ward",
	release: "2020-uk-bfc",
	periods: {
		"2021": { E05008945: 90000 },
		"2022": {
			E05008945: 95000,
			// Compiled under Salford's 2021 code; published under E05000759.
			E05013018: 179500,
			// Temple Newsam's published 2021 code is safe to correct to
			// its identical December 2020 ward geometry.
			E05013831: 200000,
			// Garforth & Swillington changed geometry, so it must not be
			// moved to its earlier code.
			E05013830: 210000,
		},
		// The year ending March 2023 is not a comparable period.
		"2023": { E05008945: 99000 },
	},
});

/** Male and female life expectancy, with the interval the publisher gives. */
const lifeSeries = (): FixtureSeries[] => {
	const estimate = (value: number) => ({
		value,
		lower: value - 0.7,
		upper: value + 0.7,
	});
	const period = (offset: number, male: number, female: number) =>
		({
			male: {
				E06000063: estimate(male + 1.32 - offset),
				E06000001: estimate(male - offset),
			},
			female: {
				E06000063: estimate(female + 1.42 - offset),
				E06000001: estimate(female - offset),
			},
		}) as const;
	const early = period(2, 75.97, 80.08);
	const late = period(0, 75.97, 80.08);
	return (["male", "female"] as const).map((sex) => ({
		dataset: "life-expectancy-series",
		measure: "life-expectancy",
		geography: "localAuthority",
		release: "2025-uk-bgc",
		members: { sex },
		periods: { "2001-2003": early[sex], "2020-2022": late[sex] },
	}));
};

/** Two ITL areas per tier over two years, the same areas in both. */
const regionalSeries = (): FixtureSeries[] =>
	(
		[
			["itl1", ["TLC", "TLL"]],
			["itl2", ["TLC3", "TLL1"]],
			["itl3", ["TLC31", "TLL11"]],
		] as const
	).flatMap(([geography, codes]) =>
		(
			[
				["gva", 100],
				["gdp", 110],
			] as const
		).map(([measure, base]) => ({
			dataset: "regional-gdp",
			measure,
			geography,
			release: "2025-uk-itl",
			periods: Object.fromEntries(
				["2022", "2023"].map((year, index) => [
					year,
					Object.fromEntries(
						codes.map((code, area) => [code, base + index + area]),
					),
				]),
			),
		})),
	);

/** Gas leaves one authority out of the later year, as the publisher does. */
const energySeries = (): FixtureSeries[] =>
	energyConsumptionSeries().map((series) => ({
		dataset: series.measure,
		measure: series.measure,
		geography: "localAuthority",
		release: "2025-uk-bfc",
		members: series.dimensions,
		periods: {
			"2023": { E06000001: 12, W06000001: 13 },
			"2024": {
				E06000001: 13,
				...(series.measure === "gas-consumption"
					? {}
					: { W06000001: 14 }),
			},
		},
	}));

/**
 * Modelled unemployment: the April 2019 districts over every period, and the
 * April 2021 authorities, which the fixture holds as the same districts less
 * those replaced in 2020 and 2021, over the two years all are estimated.
 */
const unemploymentSeries = (): FixtureSeries[] => {
	const areaReleases = {
		...Object.fromEntries(
			[...GB_CODES, ...UNEMPLOYMENT_DISTRICTS_2023].map((code) => [
				code,
				["2019-uk-bfc", "2021-uk-bfc"],
			]),
		),
		...Object.fromEntries(
			UNEMPLOYMENT_DISTRICTS_2021.map((code) => [code, ["2019-uk-bfc"]]),
		),
	};
	const every = Object.keys(areaReleases);
	const cells = (value: number, only = every) =>
		Object.fromEntries(only.map((code) => [code, value]));
	const series = (
		measure: string,
		[financial, calendar, last]: [number, number, number | undefined],
	): FixtureSeries => ({
		dataset: "unemployment",
		measure,
		geography: "localAuthority",
		release: "2019-uk-bfc",
		areaReleases,
		periods: {
			// Only the three standing authorities have a financial-year
			// estimate, and the latest year has no interval.
			"2003-04": cells(financial, GB_CODES),
			"2020": cells(calendar),
			...(last === undefined ? {} : { "2021": cells(last) }),
		},
	});
	return [
		series("unemployment-rate", [6, 4, 5]),
		series("unemployment-rate-interval", [1.5, 1, undefined]),
		series("unemployed-people", [900, 1000, 1100]),
		series("unemployed-people-interval", [300, 200, undefined]),
	];
};

/**
 * The ward and constituency estimates. The local-authority ones are the
 * density fixture's, which divides them.
 */
const populationRows = (): FixtureSeries[] => {
	const constituencies = (offset: number) => ({
		E14001063: 119256 - offset,
		W07000081: 90000 - offset,
	});
	return [
		{
			dataset: "population",
			measure: "population",
			geography: "ward",
			release: "2023-12-uk-bgc",
			periods: { "2022": { W05000001: 7, E05000001: 7 } },
		},
		{
			dataset: "population-constituency",
			measure: "population",
			geography: "constituency",
			release: "2024-07-uk-bgc",
			periods: {
				"2021": constituencies(1000),
				"2022": constituencies(0),
			},
		},
	];
};

/** One election's party votes, valid votes and turnout, by polling day. */
const electionSeries = (
	dataset: "general-election" | "local-election",
	geography: string,
	release: string,
	pollingDay: string,
	areas: Record<
		string,
		{ valid: number; turnout?: number; votes: Record<string, number> }
	>,
): FixtureSeries[] => {
	const parties = [
		...new Set(
			Object.values(areas).flatMap((area) => Object.keys(area.votes)),
		),
	];
	const column = (
		measure: string,
		pick: (area: (typeof areas)[string]) => number | undefined,
		members?: Record<string, string>,
	): FixtureSeries[] => {
		const cells = Object.fromEntries(
			Object.entries(areas).flatMap(([code, area]) =>
				pick(area) === undefined ? [] : [[code, pick(area)!]],
			),
		);
		return Object.keys(cells).length === 0
			? []
			: [
					{
						dataset,
						measure,
						geography,
						release,
						...(members ? { members } : {}),
						periods: { [pollingDay]: cells },
					},
				];
	};
	return [
		...(dataset === "general-election"
			? [
					...column("valid-votes", (area) => area.valid),
					...column("electorate", (area) =>
						area.turnout === undefined
							? undefined
							: (area.valid * 100) / area.turnout,
					),
					...column("rejected-ballots", (area) =>
						area.turnout === undefined ? undefined : 0,
					),
				]
			: column("turnout", (area) => area.turnout)),
		...parties.flatMap((party) =>
			column("party-votes", (area) => area.votes[party], { party }),
		),
	];
};

/** The 2019 and 2024 polls the election tests read, with a county division beside the 2019 wards. */
const electionRows = (): FixtureSeries[] => [
	...electionSeries(
		"general-election",
		"constituency",
		"2019-uk-bfc",
		"2019-12-12",
		{
			E14000001: { valid: 100, turnout: 70, votes: { con: 60, lab: 40 } },
			W07000001: { valid: 80, turnout: 64, votes: { lab: 50, ld: 30 } },
		},
	),
	...electionSeries(
		"general-election",
		"constituency",
		"2024-uk-bfc",
		"2024-07-04",
		{
			E14001001: { valid: 110, turnout: 62, votes: { con: 40, lab: 70 } },
			N06000001: { valid: 90, turnout: 58, votes: { dup: 45, sf: 45 } },
		},
	),
	...electionSeries("local-election", "ward", "2019-uk-bfc", "2019-05-02", {
		E05000001: { valid: 100, votes: { con: 60, lab: 40 } },
		W05000001: { valid: 80, votes: { lab: 50, ld: 30 } },
		E05013831: { valid: 70, votes: { con: 25, lab: 45 } },
	}),
	...electionSeries(
		"local-election",
		"countyElectoralDivision",
		"2019-uk-bfc",
		"2019-05-02",
		{
			E58000050: { valid: 50, votes: { con: 30, lab: 20 } },
		},
	),
	...electionSeries("local-election", "ward", "2024-uk-bfc", "2024-05-02", {
		E05001001: { valid: 120, turnout: 42, votes: { con: 50, lab: 70 } },
		E05011348: { valid: 75, turnout: 41, votes: { con: 35, lab: 40 } },
		W05001001: { valid: 90, turnout: 39, votes: { lab: 45, pc: 45 } },
	}),
];

const electionContests = (): FixtureContest[] =>
	[
		[
			"general-election",
			"constituency",
			"2019-12-12",
			{ E14000001: "CON", W07000001: "LAB" },
		],
		[
			"general-election",
			"constituency",
			"2024-07-04",
			{ E14001001: "LAB", N06000001: "DUP" },
		],
		[
			"local-election",
			"ward",
			"2019-05-02",
			{ E05000001: "CON", W05000001: "LAB", E05013831: "LAB" },
		],
		[
			"local-election",
			"ward",
			"2024-05-02",
			{ E05001001: "LAB", E05011348: "LAB", W05001001: "LAB" },
		],
	].flatMap(([dataset, geography, pollingDay, winners]) =>
		Object.entries(winners as Record<string, string>).map(
			([code, winner]) => ({
				dataset: dataset as string,
				geography: geography as string,
				pollingDay: pollingDay as string,
				code,
				winner,
			}),
		),
	);

/**
 * The monthly claimant history: two months on the April 2023 authorities,
 * the rate suppressed for one authority in the first.
 */
const claimantHistorySeries = (): FixtureSeries[] => {
	const base = {
		dataset: "claimant-count-history",
		geography: "localAuthority",
		release: "2023-uk-bfc",
	};
	return [
		{
			...base,
			measure: "claimants",
			members: { "age-group": "16-plus" },
			periods: {
				"2013-01": { E06000001: 2000, S12000001: 3000 },
				"2026-10": { E06000001: 1500, S12000001: 2500 },
			},
		},
		{
			...base,
			measure: "claimant-rate",
			periods: {
				"2013-01": { E06000001: 4.1 },
				"2026-10": { E06000001: 3.2, S12000001: 2.8 },
			},
		},
	];
};

const migratedSeries = (): FixtureSeries[] => [
	...electionRows(),
	...populationRows(),
	jobsSeries(),
	...densitySeries(),
	houseSeries(),
	...lifeSeries(),
	...regionalSeries(),
	...energySeries(),
	...unemploymentSeries(),
	...claimantHistorySeries(),
	...collisionRows(),
	...crimeRows(),
];

const collisionRows = (): FixtureSeries[] =>
	roadCollisionSeries().flatMap(
		({ measure, dimensions }): FixtureSeries[] => {
			const base = {
				dataset: "road-collisions",
				measure,
				members: dimensions,
			};
			const severity = dimensions?.["collision-severity"];
			const lsoa = { all: 4, fatal: 0, serious: 1, slight: 3 }[
				severity ?? "all"
			]!;
			const authority = { all: 6, fatal: 1, serious: 2, slight: 3 }[
				severity ?? "all"
			]!;
			return [
				{
					...base,
					geography: "localAuthority",
					release: "2024-05-uk-bgc",
					periods: {
						"2025": { E06000001: authority, S12000001: authority },
					},
				},
				{
					...base,
					geography: "lsoa",
					release: "2021-12-ew-bgc-v5",
					periods: { "2025": { E01000001: lsoa } },
				},
			];
		},
	);

const collisionGaps = (): FixtureGap[] => [
	{
		dataset: "road-collisions",
		edition: "2025",
		kind: "collision-area",
		code: "EHEATHROW",
		count: 1,
	},
];

// One partnership over several authorities has a count the force cancelled
// below zero.
const crimeRows = (): FixtureSeries[] =>
	crimeSeries().map(({ measure, dimensions }) => {
		const total = dimensions?.offence === "total";
		const count = (fallback: number) =>
			total
				? fallback
				: dimensions?.offence === "public-order-offences"
					? -1
					: 1;
		return {
			dataset: "crime",
			measure,
			members: dimensions,
			geography: "communitySafetyPartnership",
			release: "2023-12-ew-bgc",
			periods: {
				"year-ending-2026-03": {
					E22000100: count(20000),
					E22000362: count(10997),
				},
			},
		};
	});

const migratedGaps = (): FixtureGap[] => [...collisionGaps()];

/** One source file's periods, as the compiled dataset held them. */
type SourceFile = Record<
	string,
	{ boundaryYear?: number; data: Record<string, unknown> }
>;

/** A number at a dotted path of a record, or nothing where it is absent or null. */
const numberAt = (record: unknown, path: string): number | undefined => {
	let value: unknown = record;
	for (const key of path.split("."))
		value = (value as Record<string, unknown> | undefined)?.[key];
	return typeof value === "number" ? value : undefined;
};

const observations = (
	data: Record<string, unknown>,
	path: string,
): Record<string, number> =>
	Object.fromEntries(
		Object.entries(data).flatMap(([code, record]) => {
			const value = numberAt(record, path);
			return value === undefined ? [] : [[code, value]];
		}),
	);

/** The rows a declared dataset's indicators are read from, one series each. */
const declaredSeries = (id: string, source: SourceFile): FixtureSeries[] => {
	const declaration = DATASET_DECLARATIONS.find(
		(candidate) => candidate.id === id,
	)!;
	const { period } = declaration.catalogue!;
	return declaration.catalogue!.indicators.map((indicator) => ({
		dataset: id,
		measure: indicator.measure,
		members: indicator.members,
		geography: declaration.boundary.type,
		release: `${declaration.boundary.year}-uk-bfc`,
		periods: Object.fromEntries(
			Object.values(source).map(({ data }, index) => [
				// A single-period dataset is labelled as its catalogue says.
				period ?? Object.keys(source)[index]!,
				observations(data, indicator.field),
			]),
		),
	}));
};

/** The rows a census breakdown is read from, on the April 2023 codes. */
const censusSeries = (
	datasetId: string,
	data: Record<string, unknown>,
): FixtureSeries[] => {
	const breakdown = CENSUS_BREAKDOWNS.find(
		(candidate) => candidate.datasetId === datasetId,
	)!;
	return (
		breakdown.categories as readonly (readonly [
			string,
			string,
			string,
			string?,
		])[]
	).map(([suffix, field, , member]) => ({
		dataset: datasetId,
		measure: breakdown.measure,
		members: { [breakdown.dimension]: member ?? suffix },
		geography: "localAuthority",
		release: "2023-12-uk-bgc",
		periods: {
			"2021-census": observations(
				data,
				breakdown.field ? `${breakdown.field}.${field}` : field,
			),
		},
	}));
};

const writeSources = (
	wardRecordCount = 2,
	rowSeries: FixtureSeries[] = migratedSeries(),
): DataCatalogInputs => {
	const authorities = ["E06000001", "N09000001", "S12000001", "W06000001"];
	const simple = (
		boundaryYear: number,
		year: string,
		data: Record<string, unknown>,
	): SourceFile => ({ [year]: { boundaryYear, data } });
	const hartlepool = (value: number) => ({
		E06000001: { code: "E06000001", name: "Hartlepool", value },
	});
	const income = simple(2025, "2025", {
		E06000001: {
			annual: { median: 29000, mean: 33000 },
			hourly: { median: 15, mean: 17 },
		},
	});
	const declared: [string, SourceFile][] = [
		[
			"ghg-emissions",
			{ "2023": emissionsYear(2023), "2024": emissionsYear(2024) },
		],
		[
			"mobile-coverage",
			simple(2024, "2025", {
				E06000001: { pct4GIndoorAll: 96.5, pct5GOutdoorAll: 40 },
				S12000001: { pct4GIndoorAll: 51.7, pct5GOutdoorAll: 0 },
			}),
		],
		[
			"broadband",
			simple(
				2024,
				"2025",
				Object.fromEntries(
					authorities.map((code, index) => [
						code,
						{
							ladCode: code,
							pctSuperfast: 90 + index,
							pctUltrafast: 70,
							pctFullFibre: index === 2 ? null : 60,
							pctGigabit: 65,
						},
					]),
				),
			),
		],
		["business-activity", simple(2025, "2025", hartlepool(123))],
		["electric-vehicle-chargers", simple(2026, "2026", hartlepool(123))],
		["adult-social-care-outcomes", simple(2025, "2025", hartlepool(18.3))],
		["adult-social-care-activity", simple(2025, "2025", hartlepool(1234))],
		["local-government-finance", simple(2026, "2026", hartlepool(12345))],
		["net-additional-dwellings", simple(2025, "2025", hartlepool(123))],
		["council-tax", simple(2026, "2026", hartlepool(2100))],
		[
			"claimant-count",
			simple(
				2024,
				"2026",
				Object.fromEntries(
					authorities.map((code) => [
						code,
						{ ladCode: code, totalCount: 1000, youthCount: 200 },
					]),
				),
			),
		],
		[
			"homelessness",
			simple(2025, "2026", {
				E06000001: {
					ladCode: "E06000001",
					householdsInTemporaryAccommodation: 62,
					householdsPerThousand: 0.7,
					householdsWithChildren: 30,
					childrenInTemporaryAccommodation: 54,
				},
			}),
		],
		["income", income],
		["workplace-income", income],
		[
			"waste",
			simple(2025, "2025", {
				E06000001: { value: 1234.5 },
				E06000002: { value: 8 },
			}),
		],
		[
			"planning-applications",
			simple(2025, "2025", {
				E06000001: { value: 321 },
				E06000002: { value: 8 },
			}),
		],
		[
			"air-quality",
			simple(
				2024,
				"2024",
				Object.fromEntries(
					authorities.map((code, index) => [
						code,
						{
							ladCode: code,
							gridCells: 100 * (index + 1),
							no2Mean: 10 + index,
							pm10Mean: 9,
							pm25Mean: 5,
							pm25PopulationWeighted: 5.5,
							pm25PopulationWeightedAnthropogenic: 5,
						},
					]),
				),
			),
		],
		[
			"imd",
			simple(2021, "2025", {
				E01000001: { imdRank: 1, imdDecile: 1 },
				E01000002: { imdRank: 2, imdDecile: 1 },
				E01000003: { imdRank: 3, imdDecile: 1 },
			}),
		],
		[
			"nimdm",
			simple(2011, "2017", {
				// NISRA codes, not GSS: a ward suffix and a split suffix.
				"95ZZ06W1": { nimdmRank: 1, nimdmDecile: 1 },
				"95AA01S1": { nimdmRank: 516, nimdmDecile: 6 },
			}),
		],
		[
			"wimd",
			simple(2011, "2019", {
				W01000001: { wimdRank: 885, wimdDecile: 5 },
			}),
		],
		[
			"simd",
			simple(2011, "2020", {
				S01010891: { simdRank: 1, simdDecile: 1 },
			}),
		],
	];
	const census: [string, Record<string, unknown>][] = [
		[
			"travel-to-work",
			{
				E06000001: { breakdown: travelBreakdown(240) },
				W06000001: { breakdown: travelBreakdown(120) },
			},
		],
		[
			"car-availability",
			{
				E06000001: { breakdown: carBreakdown(100) },
				W06000001: { breakdown: carBreakdown(50) },
			},
		],
		[
			"qualification",
			{
				E06000001: { breakdown: qualificationBreakdown(35) },
				W06000001: { breakdown: qualificationBreakdown(25) },
			},
		],
		[
			"ethnicity",
			{
				E06000001: ethnicGroups(900),
				W06000001: ethnicGroups(700),
			},
		],
	];
	return {
		rows: fixtureRows(
			[
				...rowSeries,
				...declared.flatMap(([id, source]) =>
					declaredSeries(id, source),
				),
				...census.flatMap(([id, data]) => censusSeries(id, data)),
			],
			migratedGaps(),
			electionContests(),
		),
		manifest: JSON.stringify({
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
				dataset("claimant-count", 4, 1, 2024),
				dataset("claimant-count-history", 2, 1, 2023),
				dataset("council-tax", 1, 1, 2026),
				dataset("net-additional-dwellings", 1, 1, 2025),
				dataset("local-government-finance", 1, 1, 2026),
				dataset("adult-social-care-activity", 1, 1, 2025),
				dataset("adult-social-care-outcomes", 1, 1, 2025),
				dataset("electric-vehicle-chargers", 1, 1, 2026),
				dataset("business-activity", 1, 1, 2025),
				dataset("homelessness", 1, 1, 2025),
				dataset("road-collisions", 2, 1, 2024),
				dataset("income", 2, 1, 2025),
				dataset("workplace-income", 2, 1, 2025),
				dataset("waste", 2, 1, 2025),
				dataset("planning-applications", 2, 1, 2025),
				dataset("crime", 1, 1, 2026),
				dataset("unemployment", 1, 1, 2024),
				dataset("air-quality", 4, 1, 2024),
				dataset("jobs", 7, 2, 2023),
				dataset("land-area", 2, 1, 2024),
				dataset("house-price", 3, 1, 2021),
				dataset("imd", 3, 1, 2021),
				dataset("nimdm", 2, 1, 2011),
				dataset("wimd", 1, 1, 2011),
				dataset("simd", 1, 1, 2011),
				dataset("life-expectancy-series", 4, 2, 2025),
				dataset("population-constituency", 4, 2, 2024),
				dataset("general-election", 4, 2, 2019),
				dataset("local-election", 7, 2, 2019),
				dataset("regional-gdp", 12, 6, 2025),
				dataset("electricity-consumption", 4, 2, 2025),
				dataset("gas-consumption", 3, 2, 2025),
			],
		}),
	};
};

test("publishes source-exact ward and UK local-authority population partitions", () => {
	const sources = writeSources();
	const result = compileDataCatalog(sources);
	assert.equal(result.catalog.datasets.length, 41);
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
			observationArtifact: "population-local-authority-observations",
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
			observationArtifact: "population-constituency-observations",
			coverage: {
				kind: "partial",
				countries: ["GB-ENG", "GB-WLS"],
				recordCount: 2,
				note: "Published by ONS for the constituencies first contested in July 2024, in England and Wales only. These are ONS's own estimates for each constituency, not ward estimates added up: wards do not nest within these constituencies, and the published ward lookup splits some wards between them without weights.",
			},
		},
	]);
	const [ward, localAuthority, constituency] = result.populationObservations;
	assert.deepEqual(constituency?.periods[1]?.records, [
		{ areaCode: "E14001063", value: 119256, status: "observed" },
		{ areaCode: "W07000081", value: 90000, status: "observed" },
	]);
	assert.deepEqual(ward?.periods, [
		{
			period: "2022",
			records: [
				{ areaCode: "E05000001", value: 7, status: "observed" },
				{ areaCode: "W05000001", value: 7, status: "observed" },
			],
		},
	]);
	assert.equal(localAuthority?.periods.length, 2);
	assert.deepEqual(localAuthority?.periods[1]?.records[1], {
		areaCode: "N09000001",
		value: 7,
		status: "observed",
	});
	assert.match(result.catalog.contentHash, /^sha256:[a-f0-9]{64}$/);
	assert.match(localAuthority?.contentHash ?? "", /^sha256:[a-f0-9]{64}$/);
});

test("rejects a population source whose record count disagrees with its manifest", () => {
	const sources = writeSources(3);
	assert.throws(() => compileDataCatalog(sources), /expected 3 records/);
});

test("publishes source-exact election turnout and party vote counts", () => {
	const result = compileDataCatalog(writeSources());
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
		measure("local-election-effective-votes")?.sources[0]?.coverage
			.recordCount,
		3,
	);
	assert.match(
		measure("local-election-effective-votes")?.notes?.[1] ?? "",
		/county-electoral-division codes is excluded/,
	);
	const localVotes2019 = result.electionObservations.find(
		(artifact) =>
			artifact.measureId ===
				measureSeriesKey({
					measure: "party-votes",
					dimensions: { party: "con" },
					datasetId: "local-election",
				}) && artifact.sourceGeography.boundaryYear === 2019,
	);
	assert.deepEqual(
		localVotes2019?.periods[0]?.records.find(
			(record) => record.areaCode === "E05011412",
		),
		{
			areaCode: "E05011412",
			sourceAreaCode: "E05013831",
			value: 25,
			status: "observed",
		},
	);
	const localWinners2019 = result.electionObservations.find(
		(artifact) =>
			artifact.measureId ===
				measureSeriesKey({
					measure: "winning-party",
					datasetId: "local-election",
				}) && artifact.sourceGeography.boundaryYear === 2019,
	);
	assert.deepEqual(
		localWinners2019?.periods[0]?.records.find(
			(record) => record.areaCode === "E05011412",
		),
		{
			areaCode: "E05011412",
			sourceAreaCode: "E05013831",
			category: "LAB",
			status: "observed",
		},
	);
	const localVotes2024 = result.electionObservations.find(
		(artifact) =>
			artifact.measureId ===
				measureSeriesKey({
					measure: "party-votes",
					dimensions: { party: "con" },
					datasetId: "local-election",
				}) && artifact.sourceGeography.boundaryYear === 2024,
	);
	assert.deepEqual(
		localVotes2024?.periods[0]?.records.find(
			(record) => record.areaCode === "E05011348",
		),
		{
			areaCode: "E05011348",
			value: 35,
			status: "observed",
		},
	);
	const localWinners2024 = result.electionObservations.find(
		(artifact) =>
			artifact.measureId ===
				measureSeriesKey({
					measure: "winning-party",
					datasetId: "local-election",
				}) && artifact.sourceGeography.boundaryYear === 2024,
	);
	assert.deepEqual(
		localWinners2024?.periods[0]?.records.find(
			(record) => record.areaCode === "E05011348",
		),
		{
			areaCode: "E05011348",
			category: "LAB",
			status: "observed",
		},
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
			artifact.measureId ===
				measureSeriesKey({
					measure: "party-votes",
					dimensions: { party: "lab" },
					datasetId: "general-election",
				}) && artifact.sourceGeography.boundaryYear === 2019,
	);
	assert.deepEqual(labour2019?.periods[0]?.records, [
		{ areaCode: "E14000001", value: 40, status: "observed" },
		{ areaCode: "W07000001", value: 50, status: "observed" },
	]);
	const reform2019 = result.electionObservations.find(
		(artifact) =>
			artifact.measureId ===
				measureSeriesKey({
					measure: "party-votes",
					dimensions: { party: "sf" },
					datasetId: "general-election",
				}) && artifact.sourceGeography.boundaryYear === 2019,
	);
	assert.deepEqual(
		reform2019?.periods[0]?.records.map((record) =>
			"value" in record ? record.value : undefined,
		),
		[0, 0],
	);
	const winners2019 = result.electionObservations.find(
		(artifact) =>
			artifact.measureId ===
				measureSeriesKey({
					measure: "winning-party",
					datasetId: "general-election",
				}) && artifact.sourceGeography.boundaryYear === 2019,
	);
	assert.deepEqual(winners2019?.periods[0]?.records, [
		{ areaCode: "E14000001", category: "CON", status: "observed" },
		{ areaCode: "W07000001", category: "LAB", status: "observed" },
	]);
	assert.deepEqual(measure("general-election-winning-party")?.aggregation, {
		kind: "categorical",
		available: false,
		note: "A winning-party label has no numeric order and cannot be summed, averaged, ranked or converted across areas.",
	});
	const conservativeShare2019 = result.electionObservations.find(
		(artifact) =>
			artifact.measureId ===
				measureSeriesKey({
					measure: "party-vote-share",
					dimensions: { party: "con" },
					datasetId: "general-election",
				}) && artifact.sourceGeography.boundaryYear === 2019,
	);
	assert.deepEqual(conservativeShare2019?.periods[0]?.records, [
		{ areaCode: "E14000001", value: 60, status: "observed" },
		{ areaCode: "W07000001", value: 0, status: "observed" },
	]);
	assert.deepEqual(measure("general-election-con-vote-share")?.aggregation, {
		kind: "intensive",
		operation: "weighted-mean",
		weight: {
			description:
				"The area's valid ballot papers for the same election.",
			datasetField: "validVotes",
			measureId: "general-election-valid-votes",
		},
		available: true,
	});
	assert.equal(measure("local-election-con-vote-share"), undefined);
});

test("rejects local-authority population data whose codes change between periods", () => {
	const rows = migratedSeries().map((series) =>
		series.dataset === "population-uk"
			? {
					...series,
					periods: {
						...series.periods,
						"2024": {
							E06000001: 7,
							S12000001: 7,
							W06000001: 9,
						},
					},
				}
			: series,
	);
	const sources = writeSources(2, rows);
	assert.throws(
		() => compileDataCatalog(sources),
		/local-authority codes change between periods/,
	);
});

/** The fixture rows with the land area replaced by the given values. */
const withLandArea = (hectares: Record<string, number>) =>
	migratedSeries().map((series) =>
		series.dataset === "land-area"
			? { ...series, periods: { "2024": hectares } }
			: series,
	);

test("refuses to derive density when the denominator misses an area", () => {
	// Drop one authority the population partition publishes.
	const sources = writeSources(
		2,
		withLandArea({
			E06000001: 1000,
			N09000001: 2000,
			S12000001: 4000,
		}),
	);

	assert.throws(
		() => compileDataCatalog(sources),
		/W06000001 has no area to divide population-density by/,
	);
});

test("refuses to derive density from an area with no land", () => {
	// A zero denominator would publish Infinity as a density.
	const sources = writeSources(
		2,
		withLandArea({
			E06000001: 0,
			N09000001: 2000,
			S12000001: 4000,
			W06000001: 5000,
		}),
	);

	assert.throws(
		() => compileDataCatalog(sources),
		/E06000001 has no area to divide population-density by/,
	);
});

test("derives density and marks the values as derived, not observed", () => {
	const sources = writeSources();
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
});

test("publishes total jobs with Northern Ireland absent, not zero, outside its years", () => {
	const result = compileDataCatalog(writeSources());
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
});

test("refuses jobs where a British district is missing from a year", () => {
	const jobs = jobsSeries();
	delete jobs.periods["2019"]!.W06000001;
	jobs.periods["2020"]!.W06000002 = 1000;
	const sources = writeSources(2, [
		jobs,
		...migratedSeries().filter((series) => series.dataset !== "jobs"),
	]);

	// Only a whole nation may be absent; anything else is a gap the
	// coverage note does not describe.
	assert.throws(
		() => compileDataCatalog(sources),
		/2019: GB-WLS districts do not match/,
	);
});

test("publishes house prices under the publisher's own codes and years", () => {
	const sources = writeSources();
	const result = compileDataCatalog(sources);
	const periods = result.housePriceObservations.periods;

	// The year ending March 2023 is not a comparable period.
	assert.deepEqual(
		periods.map((period) => period.period),
		["2021", "2022"],
	);
	// Salford's value is restored to the code it was published against,
	// because its wards were redrawn in 2021. Temple Newsam is the one
	// safe code-only correction; Garforth stays on the later source code.
	assert.deepEqual(periods[1]?.records, [
		{ areaCode: "E05000759", value: 179500, status: "observed" },
		{ areaCode: "E05008945", value: 95000, status: "observed" },
		{
			areaCode: "E05011412",
			sourceAreaCode: "E05013831",
			value: 200000,
			status: "observed",
		},
		{ areaCode: "E05013830", value: 210000, status: "observed" },
	]);

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
});

test("publishes deprivation rank and decile as they were published", () => {
	const sources = writeSources();
	const result = compileDataCatalog(sources);
	const [rank, decile] = ["imd-rank", "imd-decile"].map((measure) =>
		result.yearlyIndicatorObservations.find(
			(artifact) => artifact.measureId === measureSeriesKey({ measure }),
		),
	);

	assert.equal(rank?.measureId, measureSeriesKey({ measure: "imd-rank" }));
	assert.deepEqual(rank?.sourceGeography, {
		type: "lsoa",
		boundaryYear: 2021,
	});
	// Published ranks are served directly rather than derived from scores.
	assert.deepEqual(
		rank?.periods[0]?.records.map((record) => record.value),
		[1, 2, 3],
	);
	assert.equal(
		decile?.measureId,
		measureSeriesKey({ measure: "imd-decile" }),
	);

	for (const id of ["imd-rank", "imd-decile"]) {
		const measure = result.catalog.measures.find(
			(candidate) => candidate.id === id,
		);
		assert.equal(measure?.valueKind, "ordinal");
		assert.equal(measure?.aggregation.kind, "non-aggregatable");
		// The comparability limit is stated, not left to the caller.
		assert.match(measure?.notes?.[0] ?? "", /within England alone/);
	}
});

test("publishes the northern irish rank on its own nisra codes", () => {
	const sources = writeSources();
	const result = compileDataCatalog(sources);
	assert.deepEqual(
		result.yearlyIndicatorObservations
			.find(
				(artifact) =>
					artifact.measureId ===
					measureSeriesKey({ measure: "nimdm-rank" }),
			)
			?.periods[0]?.records.map((record) => [
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
});

test("publishes each nation's index as its own family on its own geography", () => {
	const sources = writeSources();
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
	assert.match(measure("wimd-rank")?.notes?.[0] ?? "", /within Wales alone/);
	assert.match(
		measure("simd-rank")?.notes?.[0] ?? "",
		/within Scotland alone/,
	);
	assert.equal(
		measure("simd-rank")?.unit,
		"rank of 1 data zones, where 1 is the most deprived",
	);
});

test("publishes the life expectancy series with each published interval", () => {
	const sources = writeSources();
	const result = compileDataCatalog(sources);
	const [male, female] = result.lifeExpectancyObservations;

	assert.equal(
		male?.measureId,
		measureSeriesKey({
			measure: "life-expectancy",
			dimensions: { sex: "male" },
		}),
	);
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
	const result = compileDataCatalog(writeSources());
	const measure = (id: string) =>
		result.catalog.measures.find((candidate) => candidate.id === id);
	const values = (measure: string, dimension: string, member: string) =>
		result.censusObservations
			.find(
				(artifact) =>
					artifact.measureId ===
					measureSeriesKey({
						measure,
						dimensions: { [dimension]: member },
					}),
			)
			?.periods[0]?.records.map((record) => [
				record.areaCode,
				"value" in record ? record.value : undefined,
			]);

	assert.equal(
		measure("qualification-level-4-plus")?.unit,
		"usual residents aged 16 and over",
	);
	assert.deepEqual(
		values(
			"usual-residents-16-plus",
			"highest-qualification",
			"level-4-plus",
		),
		[
			["E06000001", 35],
			["W06000001", 25],
		],
	);
	assert.deepEqual(
		values("usual-residents-16-plus", "highest-qualification", "total"),
		[
			["E06000001", 100],
			["W06000001", 90],
		],
	);

	// Nineteen ethnic groups, and no separate total: they are exhaustive.
	const ethnicMeasures = result.catalog.measures.filter((candidate) =>
		candidate.id.startsWith("ethnicity-"),
	);
	assert.equal(ethnicMeasures.length, 19);
	assert.deepEqual(
		values(
			"usual-residents",
			"ethnic-group",
			"english-welsh-scottish-northern-irish-or-british",
		),
		[
			["E06000001", 900],
			["W06000001", 700],
		],
	);
	for (const candidate of [...ethnicMeasures, measure("qualification-total")])
		assert.deepEqual(candidate?.sources[0]?.sourceGeography, {
			type: "localAuthority",
			boundaryYear: 2023,
		});
});

test("publishes a single-period indicator and names the authorities it has no value for", () => {
	const result = compileDataCatalog(writeSources());
	const measure = (id: string) =>
		result.catalog.measures.find((candidate) => candidate.id === id);
	const records = (id: string) =>
		result.indicatorObservations.find((artifact) => {
			const indicator = DATASET_DECLARATIONS.flatMap(
				(declaration) => declaration.catalogue?.indicators ?? [],
			).find((candidate) => candidate.id === id);
			return (
				indicator &&
				artifact.measureId ===
					measureSeriesKey({
						measure: indicator.measure,
						dimensions: indicator.members,
					})
			);
		})?.periods;

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
		measure("broadband-superfast-availability")?.sources[0]?.coverage.kind,
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

	assert.deepEqual(measure("adult-social-care-outcomes")?.aggregation, {
		kind: "non-aggregatable",
		statistic: "median",
		note: "This is a survey outcome score, not a count that can be summed.",
		available: false,
	});

	const fullFibre = measure("broadband-full-fibre-availability")?.sources[0]
		?.coverage;
	assert.equal(fullFibre?.kind, "partial");
	assert.equal(fullFibre?.recordCount, 3);
	assert.match(
		fullFibre?.note ?? "",
		/No value is published for 1 of the 4 authorities: S12000001\./,
	);
});

test("publishes final annual road collisions for Great Britain by severity", () => {
	const result = compileDataCatalog(writeSources());
	const measure = (id: string) =>
		result.catalog.measures.find((candidate) => candidate.id === id);
	assert.deepEqual(
		result.indicatorObservations.find(
			(artifact) =>
				artifact.measureId ===
					measureSeriesKey({
						measure: "road-collisions",
						dimensions: { "collision-severity": "fatal" },
					}) && artifact.sourceGeography.type === "localAuthority",
		)?.periods,
		[
			{
				period: "2025",
				records: [
					{ areaCode: "E06000001", value: 1, status: "observed" },
					{ areaCode: "S12000001", value: 1, status: "observed" },
				],
			},
		],
	);
	const source = measure("road-collisions")?.sources[0];
	assert.deepEqual(source?.sourceGeography, {
		type: "localAuthority",
		boundaryYear: 2024,
	});
	// Northern Ireland is outside the source, so only the missing Welsh
	// authority is named.
	assert.match(
		source?.coverage.note ?? "",
		/No value is published for 1 of the 3 authorities: W06000001\./,
	);
	assert.equal(measure("road-collisions")?.aggregation.kind, "extensive");
	assert.match(
		measure("road-collisions-serious")?.notes?.join(" ") ?? "",
		/two different systems/,
	);

	// The LSOA counts are a second partition of the same measure, with
	// their own artifact, and notes shared by both appear once.
	const lsoa = measure("road-collisions")?.sources[1];
	assert.equal(measure("road-collisions")?.sources.length, 2);
	assert.deepEqual(lsoa?.sourceGeography, {
		type: "lsoa",
		boundaryYear: 2021,
	});
	assert.equal(
		lsoa?.observationArtifact,
		"road-collisions-lsoa-2021-observations",
	);
	assert.match(
		lsoa?.coverage.note ?? "",
		/Scotland has no LSOAs and is not in this partition/,
	);
	assert.equal(
		measure("road-collisions")?.notes?.filter((note) =>
			note.startsWith("Final annual"),
		).length,
		1,
	);
	assert.deepEqual(
		result.indicatorObservations.find(
			(artifact) =>
				artifact.measureId ===
					measureSeriesKey({
						measure: "road-collisions",
						dimensions: { "collision-severity": "serious" },
					}) && artifact.sourceGeography.type === "lsoa",
		)?.periods,
		[
			{
				period: "2025",
				records: [
					{ areaCode: "E01000001", value: 1, status: "observed" },
				],
			},
		],
	);
});

test("publishes median pay for authorities only", () => {
	const result = compileDataCatalog(writeSources());
	const periods = (measure: string) =>
		[
			...result.indicatorObservations,
			...result.yearlyIndicatorObservations,
		].find(
			(artifact) =>
				artifact.measureId ===
				measureSeriesKey({
					measure,
					dimensions: {
						"earnings-place": "residence",
						"pay-statistic": "median",
					},
				}),
		)?.periods;
	assert.deepEqual(periods("gross-annual-pay"), [
		{
			period: "2025",
			records: [
				{ areaCode: "E06000001", value: 29000, status: "observed" },
			],
		},
	]);
	assert.deepEqual(periods("gross-hourly-pay"), [
		{
			period: "2025",
			records: [{ areaCode: "E06000001", value: 15, status: "observed" }],
		},
	]);
	const hourly = result.catalog.measures.find(
		(measure) => measure.id === "median-hourly-pay",
	);
	assert.equal(hourly?.aggregation.kind, "non-aggregatable");
	assert.match(
		hourly?.sources[0]?.coverage.note ?? "",
		/England, Wales and Scotland, from 2012/,
	);
});

test("publishes recorded crime by community safety partnership", () => {
	const result = compileDataCatalog(writeSources());
	const crimeMeasures = result.catalog.measures.filter((measure) =>
		measure.id.startsWith("crime-"),
	);
	assert.equal(crimeMeasures.length, 23);
	assert.deepEqual(crimeMeasures[0]?.sources[0]?.sourceGeography, {
		type: "communitySafetyPartnership",
		boundaryYear: 2023,
	});
	const records = (id: string) =>
		result.indicatorObservations.find(
			(artifact) => artifact.measureId === id,
		)?.periods;
	assert.deepEqual(
		records(
			measureSeriesKey({
				measure: "recorded-crimes",
				dimensions: { offence: "total" },
			}),
		),
		[
			{
				period: "year-ending-2026-03",
				records: [
					{
						areaCode: "E22000100",
						value: 20000,
						status: "observed",
					},
					{
						areaCode: "E22000362",
						value: 10997,
						status: "observed",
					},
				],
			},
		],
	);
	assert.equal(
		records(
			measureSeriesKey({
				measure: "recorded-crimes",
				dimensions: { offence: "public-order-offences" },
			}),
		)?.[0]?.records[0]?.value,
		-1,
	);
});

test("publishes modelled unemployment in the two code vintages the workbook holds", () => {
	const result = compileDataCatalog(writeSources());
	const rate = result.catalog.measures.find(
		(measure) => measure.id === "unemployment-rate",
	);
	assert.deepEqual(
		rate?.sources.map((source) => [
			source.sourceGeography.boundaryYear,
			source.periods,
		]),
		[
			[2019, ["2003-04", "2020", "2021"]],
			[2021, ["2020", "2021"]],
		],
	);
	assert.equal(rate?.aggregation.kind, "intensive");
	const partition = (boundaryYear: number) =>
		result.indicatorObservations.find(
			(artifact) =>
				artifact.measureId ===
					measureSeriesKey({ measure: "unemployment-rate" }) &&
				artifact.sourceGeography.boundaryYear === boundaryYear,
		);
	const codes = (boundaryYear: number, period: string) =>
		partition(boundaryYear)
			?.periods.find((candidate) => candidate.period === period)
			?.records.map((record) => record.areaCode);
	// The April 2020 and 2021 districts are in the 2019 partition only, and
	// no derived April 2023 authority is served in either.
	assert.ok(codes(2019, "2021")?.includes("E07000004"));
	assert.ok(!codes(2021, "2021")?.includes("E07000004"));
	for (const boundaryYear of [2019, 2021])
		assert.ok(!codes(boundaryYear, "2020")?.includes("E06000063"));
	assert.deepEqual(codes(2019, "2003-04"), [
		"E06000001",
		"S12000001",
		"W06000001",
	]);
	assert.deepEqual(
		partition(2019)?.periods.find((period) => period.period === "2003-04")
			?.records[0],
		{
			areaCode: "E06000001",
			value: 6,
			status: "observed",
			confidenceInterval: { lower: 4.5, upper: 7.5 },
		},
	);
});

test("publishes grid area means as derived, weighted by their grid cells", () => {
	const result = compileDataCatalog(writeSources());
	const measure = (id: string) =>
		result.catalog.measures.find((candidate) => candidate.id === id);
	const statuses = (series: Parameters<typeof measureSeriesKey>[0]) => [
		...new Set(
			result.indicatorObservations
				.find(
					(artifact) =>
						artifact.measureId === measureSeriesKey(series),
				)
				?.periods[0]?.records.map((record) => record.status),
		),
	];

	const no2 = measure("no2-background-mean");
	assert.deepEqual(no2?.aggregation, {
		kind: "intensive",
		operation: "weighted-mean",
		weight: {
			description:
				"The authority's count of 1x1 km grid cells, over which its mean is taken, so a weighted mean is the area mean over the combined authorities.",
			datasetField: "gridCells",
			measureId: "air-quality-grid-cells",
		},
		available: true,
	});
	assert.deepEqual(
		statuses({
			measure: "background-concentration",
			dimensions: { pollutant: "no2" },
		}),
		["derived"],
	);
	assert.deepEqual(statuses({ measure: "air-quality-grid-cells" }), [
		"derived",
	]);
	// Defra's own table is served as published, and not combined.
	assert.deepEqual(statuses({ measure: "pm25-population-weighted" }), [
		"observed",
	]);
	assert.equal(
		measure("pm25-population-weighted")?.availability.aggregation,
		false,
	);
});

test("names what covers the nations a measure does not", () => {
	// Four nations publish four deprivation indices. A caller who asks for
	// England's and then looks for Scotland must be told where to look and
	// warned off putting the two on one scale, because nothing in the numbers
	// themselves says they cannot be.
	const catalog = JSON.parse(
		readFileSync(
			join(
				artifactDirectory(
					resolve(
						dirname(fileURLToPath(import.meta.url)),
						"../../..",
					),
				),
				"data-catalog.json",
			),
			"utf8",
		),
	) as DataCatalog;
	const byId = new Map(catalog.measures.map((m) => [m.id, m]));
	const england = byId.get("imd-rank");
	assert.ok(england, "imd-rank is no longer published");
	assert.equal(england!.concept, "index-of-multiple-deprivation-rank");

	const covered: string[] = [];
	for (const source of england!.sources)
		if (source.coverage.kind === "partial")
			covered.push(...source.coverage.countries);
	const mine = new Set(covered);

	const elsewhere = england!.elsewhere ?? [];
	assert.deepEqual(
		elsewhere.map((entry) => entry.measureId).sort(),
		["nimdm-rank", "simd-rank", "wimd-rank"],
		"the other three nations' indices are not all named",
	);
	for (const entry of elsewhere) {
		// Every link must lead to a measure that exists and really covers
		// ground this one does not.
		const other = byId.get(entry.measureId);
		assert.ok(other, `${entry.measureId} is linked but not published`);
		assert.equal(entry.href, `/v1/measures/${entry.measureId}`);
		assert.ok(
			entry.countries.length > 0,
			`${entry.measureId} covers nowhere`,
		);
		assert.deepEqual(
			entry.countries.filter((country) => mine.has(country)),
			[],
			`${entry.measureId} is offered for a nation imd-rank already covers`,
		);
		// The warning is the point: these are never comparable, and the reason
		// travels with the link rather than living in documentation.
		assert.equal(entry.comparable, false);
		assert.ok(entry.reason.length > 40, "the reason explains nothing");
	}

	// The relationship runs both ways, so a caller arriving at any of them is
	// told about the rest.
	for (const id of ["wimd-rank", "simd-rank", "nimdm-rank"]) {
		const linked = (byId.get(id)?.elsewhere ?? []).map((e) => e.measureId);
		assert.ok(linked.includes("imd-rank"), `${id} does not link back`);
	}

	// A measure with no national variant carries neither field, rather than an
	// empty one a client would have to interpret.
	const population = byId.get("population");
	assert.equal(population?.elsewhere, undefined);
	assert.equal(population?.concept, undefined);
});

test("publishes the claimant history's count and rate over every month on April 2023 authorities", () => {
	const result = compileDataCatalog(writeSources());
	const sourceOf = (id: string, datasetId: string) =>
		result.catalog.measures
			.find((measure) => measure.id === id)
			?.sources.find((source) => source.datasetId === datasetId);
	for (const id of ["claimant-count", "claimant-rate"])
		assert.deepEqual(
			{
				periods: sourceOf(id, "claimant-count-history")?.periods,
				geography: sourceOf(id, "claimant-count-history")
					?.sourceGeography,
			},
			{
				periods: ["2013-01", "2026-10"],
				geography: { type: "localAuthority", boundaryYear: 2023 },
			},
		);
	const rate = result.catalog.measures.find(
		(measure) => measure.id === "claimant-rate",
	);
	assert.equal(rate?.aggregation.kind, "intensive");
	assert.equal(rate?.availability.aggregation, false);
});
