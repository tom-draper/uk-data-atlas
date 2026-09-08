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
});
