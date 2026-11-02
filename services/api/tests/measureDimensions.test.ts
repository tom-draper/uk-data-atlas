import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	measureDimensionProblems,
	totalMember,
	type MeasureDimensionsConfig,
	type StatisticsVocabulary,
} from "@uk-data-atlas/measures";
import { readMeasureDimensionsConfig } from "@uk-data-atlas/atlas-runtime/catalogue";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
	const { config: mapping, vocabulary: held } =
		readMeasureDimensionsConfig(apiRoot);
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
