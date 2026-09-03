import { describe, expect, it } from "vitest";
import {
	childPovertyDatasetDefinition,
	populationDatasetDefinition,
} from "@/lib/data/catalog/definitions";
import { validatePrecompiledDataset } from "@/lib/data/catalog";
import { CATALOGUE_DATASET_DEFINITIONS } from "@/lib/data/catalog";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import type { DatasetDefinition } from "@/lib/data/catalog";

type TestDataset = {
	type: "test";
	boundaryType: "ward";
	boundaryYear: number;
	data: Record<string, { value: number }>;
};

const definition: DatasetDefinition<TestDataset> = {
	type: "test",
	precompiledFile: "test",
	boundaryType: "ward",
	source: {
		name: "Test",
		source: "Test",
		sourceUrl: "https://example.test",
		year: "2025",
		licence: "Test",
		licenceUrl: "https://example.test/licence",
		description: "Test",
	},
	ingestion: { minimumDataRecords: 2, expectedBoundaryYears: [2024], requiredDataFields: ["value"] },
	precompile: async () => ({}),
};

describe("dataset catalogue", () => {
	it("keeps dataset core free of chart presentation", () => {
		for (const dataset of [populationDatasetDefinition, childPovertyDatasetDefinition]) {
			expect(dataset).not.toHaveProperty("chart");
			expect(dataset).not.toHaveProperty("map");
		}
	});

	it("provides every registered dataset through a presentation-free registry", () => {
		expect(CATALOGUE_DATASET_DEFINITIONS.map((definition) => definition.type)).toEqual(
			CHART_DATASET_DEFINITIONS.map((definition) => definition.type),
		);
		for (const definition of CATALOGUE_DATASET_DEFINITIONS) {
			expect(definition).not.toHaveProperty("chart");
			expect(definition).not.toHaveProperty("charts");
			expect(definition).not.toHaveProperty("map");
			expect(definition.boundaryType).toBeTruthy();
		}
		for (const definition of CHART_DATASET_DEFINITIONS) {
			for (const chart of getChartDefinitions(definition)) {
				expect(chart).not.toHaveProperty("boundaryType");
			}
		}
	});

	it("validates compiled output without a chart definition", () => {
		expect(
			validatePrecompiledDataset(definition, {
				"2025": {
					type: "test",
					boundaryType: "ward",
					boundaryYear: 2024,
					data: { A: { value: 1 }, B: { value: 2 } },
				},
			}),
		).toEqual({ datasetCount: 1, dataRecordCount: 2, boundaryYears: [2024] });
	});
});
