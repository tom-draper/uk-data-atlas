import { describe, expect, it } from "vitest";
import {
	catalogueMetadata,
	chartMetadata,
} from "@/scripts/dataset-registry-metadata";

describe("dataset registry metadata", () => {
	it("reads catalogue metadata from the exported definition value", () => {
		expect(
			catalogueMetadata("example.ts", {
				exampleDatasetDefinition: {
					type: "example",
					precompile: async () => ({}),
				},
			}),
		).toEqual({ name: "exampleDatasetDefinition", type: "example" });
	});

	it("reads every chart from a multi-chart definition", () => {
		expect(
			chartMetadata("example.ts", {
				exampleDefinition: {
					type: "example",
					chart: {
						key: "example-current",
						componentPath: "@/components/Current",
					},
					charts: [
						{
							key: "example-current",
							componentPath: "@/components/Current",
						},
						{
							key: "example-history",
							componentPath: "@/components/History",
						},
					],
				},
			}),
		).toEqual({
			name: "exampleDefinition",
			type: "example",
			charts: [
				{
					key: "example-current",
					componentPath: "@/components/Current",
				},
				{
					key: "example-history",
					componentPath: "@/components/History",
				},
			],
		});
	});

	it("rejects incomplete chart metadata", () => {
		expect(() =>
			chartMetadata("example.ts", {
				exampleDefinition: {
					type: "example",
					chart: { key: "example" },
				},
			}),
		).toThrow("string chart keys and component paths");
	});
});
