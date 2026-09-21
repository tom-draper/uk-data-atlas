import assert from "node:assert/strict";
import test from "node:test";
import type { DataCatalog, Measure } from "../src/dataCatalog";
import { resolveAggregationMeasure } from "../src/aggregationMeasure";

const measure = (aggregation: Measure["aggregation"]) =>
	({
		id: "measure.example",
		label: "Example measure",
		valueKind: "quantity",
		unit: "units",
		aggregation,
		sources: [],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: true,
		},
		links: { data: "/v1/data/measure.example" },
	}) as Measure;

const catalog = (...measures: Measure[]) =>
	({
		schemaVersion: 1,
		contentHash: "sha256:catalog",
		source: {
			artifact: "data/precompiled/dataset-manifest.json",
			manifestVersion: 1,
		},
		datasets: [],
		measures,
	}) as DataCatalog;

test("resolves available sum and weighted-mean policies", () => {
	const sum = resolveAggregationMeasure({
		dataCatalog: catalog(
			measure({ kind: "extensive", operation: "sum", available: true }),
		),
		measureId: "measure.example",
	});
	assert.equal("status" in sum, false);

	const weighted = resolveAggregationMeasure({
		dataCatalog: catalog(
			measure({
				kind: "intensive",
				operation: "weighted-mean",
				available: true,
				weight: {
					description: "Population",
					datasetField: "population",
					measureId: "population-estimate",
				},
			}),
		),
		measureId: "measure.example",
	});
	assert.equal("status" in weighted, false);
	if ("status" in weighted) return;
	assert.equal(
		weighted.weightedAggregation?.weight.measureId,
		"population-estimate",
	);
});

test("reports missing, unknown and unsupported measures", () => {
	assert.equal(
		resolveAggregationMeasure({ measureId: "measure.example" }).status,
		503,
	);
	assert.equal(
		resolveAggregationMeasure({
			dataCatalog: catalog(),
			measureId: "measure.example",
		}).status,
		404,
	);
	const unsupported = resolveAggregationMeasure({
		dataCatalog: catalog(
			measure({
				kind: "non-aggregatable",
				statistic: "median",
				note: "Median cannot be summed.",
				available: false,
			}),
		),
		measureId: "measure.example",
	});
	assert.equal(unsupported.status, 422);
});
