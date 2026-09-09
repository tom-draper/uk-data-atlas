import { describe, expect, it } from "vitest";
import { mergeDatasetPayloads } from "@/lib/data/mergeDatasetPayloads";

describe("mergeDatasetPayloads", () => {
	it("merges data and results from every regional payload", () => {
		const merged = mergeDatasetPayloads([
			{
				"2024": {
					id: "localElection2024",
					data: { E1: { wardName: "North East ward" } },
					results: { E1: "LAB" },
				},
			},
			{
				"2024": {
					id: "localElection2024",
					data: { E2: { wardName: "North West ward" } },
					results: { E2: "CON" },
				},
			},
		]);

		expect(merged["2024"]).toMatchObject({
			data: {
				E1: { wardName: "North East ward" },
				E2: { wardName: "North West ward" },
			},
			results: { E1: "LAB", E2: "CON" },
		});
	});

	it("uses a payload layout's additional code-keyed fields", () => {
		const merged = mergeDatasetPayloads(
			[
				{
					"2024": {
						data: { E1: { value: 1 } },
						summaries: { E1: "A" },
					},
				},
				{
					"2024": {
						data: { E2: { value: 2 } },
						summaries: { E2: "B" },
					},
				},
			],
			{ codeKeyedFields: ["data", "summaries"] },
		);

		expect(merged["2024"]).toMatchObject({
			data: { E1: { value: 1 }, E2: { value: 2 } },
			summaries: { E1: "A", E2: "B" },
		});
	});
});
