import { describe, expect, it } from "vitest";
import { validatePrecompiledDataset } from "@/lib/datasets/ingestion";
import type { ChartDatasetDefinition } from "@/lib/datasets/types";

type TestDataset = {
	type: "test";
	boundaryType: "ward";
	boundaryYear: number;
	data: Record<string, { value: number }>;
};

const definition: ChartDatasetDefinition<TestDataset> = {
	type: "test",
	precompiledFile: "test",
	chart: {
		group: "Test", key: "test", label: "Test", defaultVisible: true,
		componentPath: "@/tests/TestChart", boundaryType: "ward",
		calculateStats: () => null, year: 2025,
	},
	source: { name: "Test", source: "Test", sourceUrl: "https://example.test", year: "2025", licence: "Test", licenceUrl: "https://example.test/licence", description: "Test" },
	ingestion: { minimumDataRecords: 2, expectedBoundaryYears: [2024], requiredDataFields: ["value"] },
	precompile: async () => ({}),
};

describe("validatePrecompiledDataset", () => {
	it("summarises a valid geography-keyed output", () => {
		expect(validatePrecompiledDataset(definition, {
			"2025": { type: "test", boundaryType: "ward", boundaryYear: 2024, data: { A: { value: 1 }, B: { value: 2 } } },
		})).toEqual({ datasetCount: 1, dataRecordCount: 2, boundaryYears: [2024] });
	});

	it("rejects a dataset joined to the wrong geography", () => {
		expect(() => validatePrecompiledDataset(definition, {
			"2025": { type: "test", boundaryType: "localAuthority", boundaryYear: 2024, data: { A: { value: 1 }, B: { value: 2 } } } as unknown as TestDataset,
		})).toThrow("uses localAuthority boundaries");
	});

	it("rejects missing required data fields", () => {
		expect(() => validatePrecompiledDataset(definition, {
			"2025": { type: "test", boundaryType: "ward", boundaryYear: 2024, data: { A: {}, B: { value: 2 } } } as unknown as TestDataset,
		})).toThrow("A is missing value");
	});
});
