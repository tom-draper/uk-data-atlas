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
	type StatisticsVocabulary,
} from "@uk-data-atlas/measures";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	dimensionCatalogue,
	readMeasureDimensionsMapping,
	withDeclaredMeasureIds,
} from "@uk-data-atlas/measures";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("crime series come from the offence declaration", () => {
	const config = JSON.parse(
		readFileSync(join(apiRoot, "config/measure-dimensions.json"), "utf8"),
	) as MeasureDimensionsConfig;
	const merged = withDeclaredMeasureIds(config);
	const crime = Object.entries(merged.ids).filter(([id]) =>
		id.startsWith("crime-"),
	);
	assert.equal(crime.length, 23);
	assert.ok(crime.every(([id]) => !(id in config.ids)));
	assert.deepEqual(merged.ids["crime-theft-offences"], {
		measure: "recorded-crimes",
		dimensions: { offence: "theft" },
	});
	assert.deepEqual(
		merged.ids["crime-death-or-serious-injury-by-illegal-driving"],
		{
			measure: "recorded-crimes",
			dimensions: {
				offence: "death-or-serious-injury-by-unlawful-driving",
			},
		},
	);
});

test("energy series come from their meter declarations", () => {
	const config = JSON.parse(
		readFileSync(join(apiRoot, "config/measure-dimensions.json"), "utf8"),
	) as MeasureDimensionsConfig;
	const merged = withDeclaredMeasureIds(config);
	for (const fuel of ["electricity", "gas"])
		for (const member of ["all", "domestic", "non-domestic"]) {
			const id = `${fuel}-consumption${member === "all" ? "" : `-${member}`}`;
			assert.equal(config.ids[id], undefined);
			assert.deepEqual(merged.ids[id], {
				measure: `${fuel}-consumption`,
				dimensions: { "meter-type": member },
			});
		}
	assert.throws(
		() =>
			withDeclaredMeasureIds({
				...config,
				ids: {
					...config.ids,
					"gas-consumption": merged.ids["gas-consumption"]!,
				},
			}),
		/which a dataset declaration publishes/,
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

const source = (datasetId: string) => ({ datasetId });
const catalog = (ids: Record<string, string[]>) => ({
	measures: Object.entries(ids).map(([id, datasets]) => ({
		id,
		sources: datasets.map(source),
	})),
});

const config = (
	ids: MeasureDimensionsConfig["ids"],
	extra: Partial<MeasureDimensionsConfig> = {},
): MeasureDimensionsConfig => ({
	schemaVersion: 1,
	measures: {},
	dimensions: {},
	members: {},
	defaults: {},
	ids,
	...extra,
});

test("indexes canonical series separately from catalogue ids", () => {
	const mapping = {
		measure: "recorded-crimes",
		dimensions: { offence: "burglary" },
	};
	const indexed = dimensionCatalogue(
		catalog({ "crime-burglary": ["crime"] }) as Parameters<
			typeof dimensionCatalogue
		>[0],
		{ config: config({ "crime-burglary": mapping }), vocabulary },
	);
	const found = indexed.series(measureSeriesKey(mapping));
	assert.equal(found?.measure.id, "recorded-crimes");
	assert.equal(found?.series.catalogueMeasure.id, "crime-burglary");
	assert.equal(indexed.series("crime-burglary"), undefined);
	assert.deepEqual(indexed.catalogueSeries("crime-burglary"), found);
});

const problems = (
	ids: Record<string, string[]>,
	mapping: MeasureDimensionsConfig,
) =>
	measureDimensionProblems(
		catalog(ids) as Parameters<typeof measureDimensionProblems>[0],
		mapping,
		vocabulary,
	);

test("accepts a mapping that names every id's measure and members", () => {
	assert.deepEqual(
		problems(
			{ "crime-burglary": ["crime"], "crime-total": ["crime"] },
			config({
				"crime-burglary": {
					measure: "recorded-crimes",
					dimensions: { offence: "burglary" },
				},
				"crime-total": {
					measure: "recorded-crimes",
					dimensions: { offence: "total" },
				},
			}),
		),
		[],
	);
});

test("refuses a catalogue id with no mapping", () => {
	assert.deepEqual(problems({ "crime-robbery": ["crime"] }, config({})), [
		"Measure id crime-robbery has no mapping to a measure and its dimension members.",
	]);
});

test("refuses unknown measures, dimensions and members", () => {
	assert.deepEqual(
		problems(
			{ a: ["crime"], b: ["crime"], c: ["crime"] },
			config({
				a: { measure: "crime-count" },
				b: {
					measure: "recorded-crimes",
					dimensions: { "crime-type": "burglary" },
				},
				c: {
					measure: "recorded-crimes",
					dimensions: { offence: "arson" },
				},
			}),
		),
		[
			"a maps to an unknown measure crime-count.",
			"b names an unknown dimension crime-type.",
			"c names an unknown member offence=arson.",
		],
	);
});

test("refuses two ids that one measure and its members cannot tell apart", () => {
	assert.deepEqual(
		problems(
			{
				"general-election-lab-votes": ["general-election"],
				"local-election-lab-votes": ["local-election"],
			},
			config({
				"general-election-lab-votes": {
					measure: "party-votes",
					dimensions: { party: "lab" },
				},
				"local-election-lab-votes": {
					measure: "party-votes",
					dimensions: { party: "lab" },
				},
			}),
		),
		[
			"general-election-lab-votes and local-election-lab-votes map to the same measure and members; give each a datasetId or a member that tells them apart.",
		],
	);
	assert.deepEqual(
		problems(
			{
				"general-election-lab-votes": ["general-election"],
				"local-election-lab-votes": ["local-election"],
			},
			config({
				"general-election-lab-votes": {
					measure: "party-votes",
					dimensions: { party: "lab" },
					datasetId: "general-election",
				},
				"local-election-lab-votes": {
					measure: "party-votes",
					dimensions: { party: "lab" },
					datasetId: "local-election",
				},
			}),
		),
		[],
	);
});

test("refuses an id that is a measure's own id but maps elsewhere", () => {
	assert.deepEqual(
		problems(
			{ "party-votes": ["general-election"] },
			config({ "party-votes": { measure: "recorded-crimes" } }),
		),
		[
			"party-votes is a measure's own id, so it must map to that measure, not recorded-crimes.",
		],
	);
});

test("accepts members the API adds to a held dimension, under a held parent", () => {
	const mapping = config(
		{
			"crime-residential-burglary": {
				measure: "recorded-crimes",
				dimensions: { offence: "residential-burglary" },
			},
		},
		{
			members: {
				offence: [
					{
						code: "residential-burglary",
						label: "Residential burglary",
						parent: "burglary",
					},
				],
			},
		},
	);
	assert.deepEqual(
		problems({ "crime-residential-burglary": ["crime"] }, mapping),
		[],
	);
});

test("names the one member every other is part of as the total", () => {
	assert.equal(totalMember(vocabulary.dimensions.offence!.members), "total");
	assert.equal(totalMember(vocabulary.dimensions.party!.members), undefined);
});

test("the checked-in mapping is consistent with the checked-in vocabulary", () => {
	const mapping = readMeasureDimensionsMapping(resolve(apiRoot, "../.."));
	const held = JSON.parse(
		readFileSync(
			join(apiRoot, "config/statistics-vocabulary.json"),
			"utf8",
		),
	) as StatisticsVocabulary;
	const ids = Object.fromEntries(
		Object.entries(mapping.ids).map(([id, entry]) => [
			id,
			entry.datasetId ? [entry.datasetId] : ["any"],
		]),
	);
	assert.deepEqual(
		measureDimensionProblems(
			catalog(ids) as Parameters<typeof measureDimensionProblems>[0],
			mapping,
			held,
		),
		[],
	);
});
