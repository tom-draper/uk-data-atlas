import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { test } from "vitest";
import { fileURLToPath } from "node:url";
import {
	measureDimensionProblems,
	measureSeriesKey,
	measureSeriesSourceKey,
	totalMember,
	type MeasureDimensionsConfig,
	type MeasureSeriesIdentity,
	type StatisticsVocabulary,
} from "@uk-data-atlas/measures";
import {
	airQualitySeries,
	crimeSeries,
	declaredLifeExpectancySeries,
	energyConsumptionSeries,
	homelessnessSeries,
	medianPaySeries,
	roadCollisionSeries,
	travelToWorkSeries,
} from "@uk-data-atlas/datasets";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	dimensionCatalogue,
	identityDimensions,
} from "@uk-data-atlas/measures";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A declaration's series by catalogue id. */
const declared = (
	series: Array<{ id: string } & MeasureSeriesIdentity>,
): Record<string, MeasureSeriesIdentity> =>
	Object.fromEntries(series.map(({ id, ...identity }) => [id, identity]));

test("travel to work series come from the travel method declaration", () => {
	const ids = declared(travelToWorkSeries());
	for (const member of [
		"bicycle",
		"car",
		"home",
		"motorcycle",
		"on-foot",
		"other",
		"public-transport",
		"taxi",
		"total",
	])
		assert.deepEqual(ids[`travel-to-work-${member}`], {
			measure: "people-in-employment",
			dimensions: { "travel-method": member },
		});
});

test("temporary accommodation series come from the homelessness fields", () => {
	const ids = declared(homelessnessSeries());
	assert.deepEqual(ids["temporary-accommodation-children"], {
		measure: "children-in-temporary-accommodation",
	});
	assert.deepEqual(ids["temporary-accommodation-households"], {
		measure: "households-in-temporary-accommodation",
		dimensions: { "household-type": "all" },
	});
	assert.deepEqual(ids["temporary-accommodation-households-with-children"], {
		measure: "households-in-temporary-accommodation",
		dimensions: { "household-type": "with-children" },
	});
});

test("median pay series come from the pay fields", () => {
	const ids = declared(medianPaySeries());
	for (const place of ["residence", "workplace"])
		for (const period of ["annual", "hourly"])
			assert.deepEqual(
				ids[
					`median-${place === "workplace" ? "workplace-" : ""}${period}-pay`
				],
				{
					measure: `gross-${period}-pay`,
					dimensions: {
						"pay-statistic": "median",
						"earnings-place": place,
					},
				},
			);
});

test("life expectancy series come from the sex declaration", () => {
	const ids = declared(declaredLifeExpectancySeries());
	for (const member of ["female", "male"])
		assert.deepEqual(ids[`life-expectancy-${member}`], {
			measure: "life-expectancy",
			dimensions: { sex: member },
		});
	assert.equal(ids["life-expectancy-all"], undefined);
});

test("air quality series come from the pollutant declaration", () => {
	const ids = declared(airQualitySeries());
	for (const member of ["no2", "pm10", "pm25"])
		assert.deepEqual(ids[`${member}-background-mean`], {
			measure: "background-concentration",
			dimensions: { pollutant: member },
		});
});

test("road collision series come from the severity declaration", () => {
	const ids = declared(roadCollisionSeries());
	for (const member of ["all", "fatal", "serious", "slight"])
		assert.deepEqual(
			ids[`road-collisions${member === "all" ? "" : `-${member}`}`],
			{
				measure: "road-collisions",
				dimensions: { "collision-severity": member },
			},
		);
});

test("crime series come from the offence declaration", () => {
	const ids = declared(crimeSeries());
	assert.equal(Object.keys(ids).length, 23);
	assert.deepEqual(ids["crime-theft-offences"], {
		measure: "recorded-crimes",
		dimensions: { offence: "theft" },
	});
	assert.deepEqual(ids["crime-death-or-serious-injury-by-illegal-driving"], {
		measure: "recorded-crimes",
		dimensions: {
			offence: "death-or-serious-injury-by-unlawful-driving",
		},
	});
});

test("energy series come from their meter declarations", () => {
	const ids = declared(energyConsumptionSeries());
	for (const fuel of ["electricity", "gas"])
		for (const member of ["all", "domestic", "non-domestic"])
			assert.deepEqual(
				ids[
					`${fuel}-consumption${member === "all" ? "" : `-${member}`}`
				],
				{
					measure: `${fuel}-consumption`,
					dimensions: { "meter-type": member },
				},
			);
});

test("series keys sort members and distinguish datasets", () => {
	const dimensions = { party: "lab", sex: "female" };
	const reordered = { sex: "female", party: "lab" };
	assert.equal(
		measureSeriesKey({ measure: "votes", dimensions }),
		measureSeriesKey({ measure: "votes", dimensions: reordered }),
	);
	assert.notEqual(
		measureSeriesKey({ measure: "votes", dimensions }),
		measureSeriesKey({ measure: "votes", dimensions, datasetId: "local" }),
	);
});

test("series source keys distinguish dataset and geography partitions", () => {
	const series = {
		measure: "votes",
		dimensions: { party: "lab", sex: "female" },
	};
	const source = {
		datasetId: "local-election",
		sourceGeography: { type: "ward" as const, boundaryYear: 2023 },
	};
	const key = measureSeriesSourceKey(series, source);
	assert.equal(
		key,
		measureSeriesSourceKey(
			{ measure: "votes", dimensions: { sex: "female", party: "lab" } },
			source,
		),
	);
	assert.notEqual(
		key,
		measureSeriesSourceKey(series, {
			...source,
			datasetId: "general-election",
		}),
	);
	assert.notEqual(
		key,
		measureSeriesSourceKey(series, {
			...source,
			sourceGeography: {
				...source.sourceGeography,
				type: "constituency",
			},
		}),
	);
	assert.notEqual(
		key,
		measureSeriesSourceKey(series, {
			...source,
			sourceGeography: { ...source.sourceGeography, boundaryYear: 2024 },
		}),
	);
	assert.notEqual(
		key,
		measureSeriesSourceKey(
			{ ...series, datasetId: "local-election" },
			source,
		),
	);
});

const vocabulary: StatisticsVocabulary = {
	schemaVersion: 1,
	measures: {
		"recorded-crimes": {
			label: "Police recorded crime",
			description: "Offences recorded by the police.",
			unit: "offences",
			valueKind: "count",
			aggregation: "sum",
		},
		"party-votes": {
			label: "Party votes",
			description: "Votes cast for a party.",
			unit: "votes",
			valueKind: "count",
			aggregation: "sum",
		},
	},
	dimensions: {
		offence: {
			label: "Offence",
			members: [
				{ code: "total", label: "All recorded crime" },
				{ code: "theft", label: "Theft offences", parent: "total" },
				{ code: "burglary", label: "Burglary", parent: "theft" },
			],
		},
		party: {
			label: "Party",
			members: [
				{ code: "lab", label: "Labour" },
				{ code: "con", label: "Conservative" },
			],
		},
	},
};

type Fixture = {
	id: string;
	datasets: string[];
	series?: MeasureSeriesIdentity;
};

const catalog = (measures: Fixture[]) => ({
	measures: measures.map(({ id, datasets, series }) => ({
		id,
		sources: datasets.map((datasetId) => ({ datasetId })),
		...(series ? { series } : {}),
	})),
});

const config = (
	extra: Partial<MeasureDimensionsConfig> = {},
): MeasureDimensionsConfig => ({
	measures: {},
	dimensions: {},
	members: {},
	defaults: {},
	...extra,
});

const burglary = {
	measure: "recorded-crimes",
	dimensions: { offence: "burglary" },
};

test("indexes canonical series separately from catalogue ids", () => {
	const indexed = dimensionCatalogue(
		catalog([
			{ id: "crime-burglary", datasets: ["crime"], series: burglary },
		]) as unknown as Parameters<typeof dimensionCatalogue>[0],
		{ config: config(), vocabulary },
	);
	const found = indexed.series(measureSeriesKey(burglary));
	assert.equal(found?.measure.id, "recorded-crimes");
	assert.equal(found?.series.catalogueMeasure.id, "crime-burglary");
	assert.equal(indexed.series("crime-burglary"), undefined);
	assert.deepEqual(indexed.catalogueSeries("crime-burglary"), found);
});

test("ignores catalogue measures that carry no series identity", () => {
	const indexed = dimensionCatalogue(
		catalog([
			{ id: "crime-burglary", datasets: ["crime"] },
		]) as unknown as Parameters<typeof dimensionCatalogue>[0],
		{ config: config(), vocabulary },
	);
	assert.equal(indexed.series(measureSeriesKey(burglary)), undefined);
});

test("builds fallback dimensions from embedded series identities", () => {
	const data = {
		measures: [
			{
				id: "old-id",
				label: "Burglary",
				series: burglary,
				sources: [{ datasetId: "crime" }],
			},
		],
	} as unknown as Parameters<typeof dimensionCatalogue>[0];
	const indexed = dimensionCatalogue(data, identityDimensions(data));
	assert.equal(
		indexed.measure("recorded-crimes")?.dimensions[0]?.members[0]?.code,
		"burglary",
	);
});

const problems = (
	measures: Fixture[],
	mapping: MeasureDimensionsConfig = config(),
) =>
	measureDimensionProblems(
		catalog(measures) as Parameters<typeof measureDimensionProblems>[0],
		mapping,
		vocabulary,
	);

test("accepts measures whose series name a known measure and members", () => {
	assert.deepEqual(
		problems([
			{ id: "crime-burglary", datasets: ["crime"], series: burglary },
			{
				id: "crime-total",
				datasets: ["crime"],
				series: {
					measure: "recorded-crimes",
					dimensions: { offence: "total" },
				},
			},
		]),
		[],
	);
});

test("refuses a catalogue measure with no series identity", () => {
	assert.deepEqual(problems([{ id: "crime-robbery", datasets: ["crime"] }]), [
		"Measure id crime-robbery has no series identity naming a measure and its dimension members.",
	]);
});

test("refuses unknown measures, dimensions and members", () => {
	assert.deepEqual(
		problems([
			{
				id: "a",
				datasets: ["crime"],
				series: { measure: "crime-count" },
			},
			{
				id: "b",
				datasets: ["crime"],
				series: {
					measure: "recorded-crimes",
					dimensions: { "crime-type": "burglary" },
				},
			},
			{
				id: "c",
				datasets: ["crime"],
				series: {
					measure: "recorded-crimes",
					dimensions: { offence: "arson" },
				},
			},
		]),
		[
			"a maps to an unknown measure crime-count.",
			"b names an unknown dimension crime-type.",
			"c names an unknown member offence=arson.",
		],
	);
});

test("refuses two ids that one measure and its members cannot tell apart", () => {
	const votes = { measure: "party-votes", dimensions: { party: "lab" } };
	assert.deepEqual(
		problems([
			{
				id: "general-election-lab-votes",
				datasets: ["general-election"],
				series: votes,
			},
			{
				id: "local-election-lab-votes",
				datasets: ["local-election"],
				series: votes,
			},
		]),
		[
			"general-election-lab-votes and local-election-lab-votes map to the same measure and members; give each a datasetId or a member that tells them apart.",
		],
	);
	assert.deepEqual(
		problems([
			{
				id: "general-election-lab-votes",
				datasets: ["general-election"],
				series: { ...votes, datasetId: "general-election" },
			},
			{
				id: "local-election-lab-votes",
				datasets: ["local-election"],
				series: { ...votes, datasetId: "local-election" },
			},
		]),
		[],
	);
});

test("refuses an id that is a measure's own id but maps elsewhere", () => {
	assert.deepEqual(
		problems([
			{
				id: "party-votes",
				datasets: ["general-election"],
				series: { measure: "recorded-crimes" },
			},
		]),
		[
			"party-votes is a measure's own id, so it must map to that measure, not recorded-crimes.",
		],
	);
});

test("accepts members the API adds to a held dimension, under a held parent", () => {
	const mapping = config({
		members: {
			offence: [
				{
					code: "residential-burglary",
					label: "Residential burglary",
					parent: "burglary",
				},
			],
		},
	});
	assert.deepEqual(
		problems(
			[
				{
					id: "crime-residential-burglary",
					datasets: ["crime"],
					series: {
						measure: "recorded-crimes",
						dimensions: { offence: "residential-burglary" },
					},
				},
			],
			mapping,
		),
		[],
	);
});

test("names the one member every other is part of as the total", () => {
	assert.equal(totalMember(vocabulary.dimensions.offence!.members), "total");
	assert.equal(totalMember(vocabulary.dimensions.party!.members), undefined);
});

test("the declared series are consistent with the checked-in vocabulary", () => {
	const held = JSON.parse(
		readFileSync(
			join(apiRoot, "config/statistics-vocabulary.json"),
			"utf8",
		),
	) as StatisticsVocabulary;
	const series: Array<{ id: string } & MeasureSeriesIdentity> = [
		...travelToWorkSeries(),
		...homelessnessSeries(),
		...medianPaySeries(),
		...declaredLifeExpectancySeries(),
		...airQualitySeries(),
		...roadCollisionSeries(),
		...crimeSeries(),
		...energyConsumptionSeries(),
	];
	assert.deepEqual(
		measureDimensionProblems(
			catalog(
				series.map(({ id, ...identity }) => ({
					id,
					datasets: identity.datasetId
						? [identity.datasetId]
						: ["any"],
					series: identity,
				})),
			) as Parameters<typeof measureDimensionProblems>[0],
			config(),
			held,
		),
		[],
	);
});
