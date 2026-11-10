import assert from "node:assert/strict";
import { test } from "vitest";
import {
	measureSeriesKey,
	type DataCatalog,
	type Measure,
	type MeasureCompatibilityInventory,
	type MeasureDimensionsConfig,
} from "@uk-data-atlas/measures";
import { resolveObservations } from "../src/observationResolution/observationPlan";
import { seriesCompatibility } from "../src/seriesCompatibility";
import { identityDimensions } from "@uk-data-atlas/measures";
import { readWeightedSource } from "../src/weightedSource";

test("plans the selected series without looking it up by catalogue id", () => {
	const source = {
		datasetId: "census",
		sourceGeography: { type: "ward", boundaryYear: 2021 },
		periods: ["2021"],
	};
	const measure = {
		id: "legacy-id",
		sources: [source],
	} as unknown as Measure;
	const dataCatalog = { measures: [] } as unknown as DataCatalog;
	const result = resolveObservations(
		{ dataCatalog },
		{
			measureId: "households",
			measure,
			periods: ["2021"],
			geography: "ward",
			boundaryYear: "2021",
		},
	);
	assert.equal(result.kind, "plan");
	if (result.kind === "plan") {
		assert.equal(result.plan.measure, measure);
		assert.equal(result.plan.source, source);
	}
});

test("selects weights using their canonical identity instead of the old id", () => {
	const source = {
		datasetId: "fixture",
		periods: ["2024"],
		sourceGeography: { type: "ward", boundaryYear: 2024 },
	};
	const measure = { id: "actual-weight", label: "Weight", sources: [source] };
	const catalog = { measures: [measure] } as unknown as DataCatalog;
	const result = readWeightedSource({
		context: {
			dataCatalog: catalog,
			measureDimensions: identityDimensions(catalog),
		} as Parameters<typeof readWeightedSource>[0]["context"],
		dataCatalog: catalog,
		weightMeasureId: "wrong-id",
		weightSeriesIdentity: { measure: "actual-weight" },
		measureId: "ratio",
		period: "2024",
		source: source as Parameters<typeof readWeightedSource>[0]["source"],
		artifacts: {
			measureObservations: [
				{
					schemaVersion: 1,
					contentHash: "hash",
					measureId: "actual-weight",
					sourceGeography: source.sourceGeography as Parameters<
						typeof readWeightedSource
					>[0]["source"]["sourceGeography"],
					periods: [
						{
							period: "2024",
							records: [
								{
									areaCode: "E1",
									value: 3,
									status: "observed",
								},
							],
						},
					],
				},
			],
		},
	});
	assert.ok(!("status" in result));
	assert.equal(result.measure.id, "actual-weight");
});

test("selects compatibility by canonical series instead of the supplied old id", () => {
	const first = { measureId: "legacy-owned", sources: [] };
	const second = { measureId: "legacy-rented", sources: [] };
	const inventory = {
		measures: [first, second],
	} as unknown as MeasureCompatibilityInventory;
	const config = {
		ids: {
			"legacy-owned": {
				measure: "households",
				dimensions: { tenure: "owned" },
			},
			"legacy-rented": {
				measure: "households",
				dimensions: { tenure: "rented" },
			},
		},
	} as unknown as MeasureDimensionsConfig;
	const key = measureSeriesKey({
		measure: "households",
		dimensions: { tenure: "rented" },
	});
	assert.equal(
		seriesCompatibility(inventory, config, key, "legacy-owned"),
		second,
	);
	assert.equal(
		seriesCompatibility(
			inventory,
			config,
			measureSeriesKey({ measure: "missing" }),
			"legacy-owned",
		),
		undefined,
	);
});

test("selects published canonical compatibility without the legacy mapping", () => {
	const key = measureSeriesKey({
		measure: "households",
		dimensions: { tenure: "rented" },
	});
	const entry = { measureId: "legacy-rented", seriesKey: key, sources: [] };
	const inventory = {
		measures: [entry],
	} as unknown as MeasureCompatibilityInventory;
	assert.equal(
		seriesCompatibility(inventory, undefined, key, "unrelated"),
		entry,
	);
	assert.equal(
		seriesCompatibility(
			inventory,
			undefined,
			measureSeriesKey({ measure: "missing" }),
			"legacy-rented",
		),
		undefined,
	);
});

test("plans a geometry join from the selected series compatibility", () => {
	const source = {
		datasetId: "census",
		sourceGeography: { type: "ward", boundaryYear: 2021 },
		periods: ["2021"],
	};
	const measure = {
		id: "not-in-inventory",
		sources: [source],
	} as unknown as Measure;
	const identity = {
		measure: "households",
		dimensions: { tenure: "rented" },
	};
	const config = {
		ids: { "legacy-rented": identity },
	} as unknown as MeasureDimensionsConfig;
	const inventory = {
		measures: [
			{
				measureId: "legacy-rented",
				sources: [
					{
						...source,
						candidates: [
							{
								boundaryRelease: "ward-2021",
								status: "exact-code-set",
								unmatchedSourceCodeCount: 0,
								matchedSourceShare: 1,
								candidateOnlyCodeCount: 0,
							},
						],
					},
				],
			},
		],
	} as unknown as MeasureCompatibilityInventory;
	const result = resolveObservations(
		{
			dataCatalog: { measures: [] } as unknown as DataCatalog,
			measureCompatibilityInventory: inventory,
			measureDimensions: {
				config,
				vocabulary: { schemaVersion: 1, measures: {}, dimensions: {} },
			},
		},
		{
			measureId: "households",
			measure,
			seriesKey: measureSeriesKey(identity),
			periods: ["2021"],
			geography: "ward",
			boundaryYear: "2021",
			release: "ward-2021",
		},
	);
	assert.equal(result.kind, "plan");
	if (result.kind === "plan")
		assert.equal(result.plan.join?.boundaryRelease, "ward-2021");
});
