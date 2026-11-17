import { expect, test } from "vitest";
import type {
	DataCatalog,
	Measure,
	MeasureSource,
	MeasureTableArtifact,
	AnyMeasureObservationArtifact,
} from "@uk-data-atlas/measures";
import { validateObservationSeries } from "../../src/catalog/observationSeries.ts";
import { measureSeriesKey } from "@uk-data-atlas/measures";

const source = (
	datasetId: string,
	observationArtifact?: string,
): MeasureSource => ({
	datasetId,
	periods: ["2021"],
	sourceGeography: { type: "lsoa", boundaryYear: 2021 },
	...(observationArtifact ? { observationArtifact } : {}),
	coverage: {
		kind: "source-reported",
		countries: ["GB-ENG"],
		recordCount: 1,
		note: "",
	},
});
const measure = (id: string, member: string, held: MeasureSource): Measure => ({
	id,
	label: id,
	valueKind: "count",
	unit: "people",
	aggregation: { kind: "extensive", operation: "sum", available: true },
	availability: { sourceExact: true, conversion: false, aggregation: true },
	links: { data: `/v1/data/${id}` },
	series: { measure: "residents", dimensions: { age: member } },
	sources: [held],
});
const catalog = (...measures: Measure[]) => ({ measures }) as DataCatalog;
const table: MeasureTableArtifact = {
	schemaVersion: 1,
	kind: "measure-table",
	contentHash: "hash",
	id: "census-table",
	datasetId: "census",
	sourceGeography: { type: "lsoa", boundaryYear: 2021 },
	period: "2021",
	measures: ["young", "older"].map((age) =>
		measureSeriesKey({ measure: "residents", dimensions: { age } }),
	),
	records: [],
};
const observed = (id: string): AnyMeasureObservationArtifact => ({
	schemaVersion: 1,
	contentHash: "hash",
	measureId: id,
	sourceGeography: { type: "lsoa", boundaryYear: 2021 },
	periods: [],
});

test("validates individual and shared table observations by canonical series and source", () => {
	const first = measure("old-young", "young", source("census", table.id));
	const second = measure("old-older", "older", source("census", table.id));
	const third = measure("old-total", "all", source("population"));
	expect(() =>
		validateObservationSeries(
			catalog(first, second, third),
			[observed(measureSeriesKey(third.series!))],
			[table],
		),
	).not.toThrow();
	expect(() =>
		validateObservationSeries(catalog(first, second, third), [], [table]),
	).toThrow(/Missing observation series/);
	expect(() =>
		validateObservationSeries(
			catalog(first, second),
			[],
			[{ ...table, measures: [table.measures[0]!, table.measures[0]!] }],
		),
	).toThrow(/duplicate observation series/);
});

test("rejects duplicate canonical identities even when legacy names differ", () => {
	const first = measure("old-a", "young", source("population"));
	const second = measure("old-b", "young", source("population"));
	expect(() =>
		validateObservationSeries(
			catalog(first, second),
			[observed(first.id), observed(second.id)],
			[],
		),
	).toThrow(/Duplicate catalogue series source/);
});

test("rejects legacy artifact identities", () => {
	const entry = measure("old-young", "young", source("population"));
	expect(() =>
		validateObservationSeries(catalog(entry), [observed(entry.id)], []),
	).toThrow(/No catalogue source matches/);
});

test("rejects ambiguous sources for an individual observation", () => {
	const first = measure("first", "young", source("dataset-a"));
	const second = measure("second", "young", source("dataset-b"));
	expect(() =>
		validateObservationSeries(
			catalog(first, second),
			[observed(measureSeriesKey(first.series!))],
			[],
		),
	).toThrow(/Ambiguous observation source/);
});

test("uses dataset provenance to distinguish otherwise identical sources", () => {
	const first = measure("first", "young", source("dataset-a"));
	const second = measure("second", "young", source("dataset-b"));
	const firstArtifact = observed(measureSeriesKey(first.series!));
	const secondArtifact = observed(measureSeriesKey(second.series!));
	const datasets = new Map([
		[firstArtifact, "dataset-a"],
		[secondArtifact, "dataset-b"],
	]);
	expect(() =>
		validateObservationSeries(
			catalog(first, second),
			[firstArtifact, secondArtifact],
			[],
			datasets,
		),
	).not.toThrow();
	datasets.set(secondArtifact, "dataset-c");
	expect(() =>
		validateObservationSeries(
			catalog(first, second),
			[firstArtifact, secondArtifact],
			[],
			datasets,
		),
	).toThrow(/No catalogue source matches/);
});
