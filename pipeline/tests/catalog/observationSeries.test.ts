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
			[observed(third.id)],
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
