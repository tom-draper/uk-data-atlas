import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { ghgEmissionsDefinition } from "@/lib/datasets/ghgEmissions";
import type { GhgEmissionsDataset } from "@/lib/types/ghgEmissions";

const dataset: GhgEmissionsDataset = {
	id: "ghgEmissions2024",
	type: "ghgEmissions",
	year: 2024,
	boundaryType: "localAuthority",
	boundaryYear: 2025,
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			totalKtCO2e: 500,
			excludingLandUseKtCO2e: 550,
			perPersonTCO2e: 5,
			populationThousands: 100,
			transport: 200,
			domestic: 100,
			industry: 50,
			commercial: 50,
			publicSector: 25,
			agriculture: 50,
			waste: 25,
			landUse: -50,
		},
	},
};

describe("GHG emissions map metric", () => {
	it("uses the selected emissions measure", () => {
		const valueFor = ghgEmissionsDefinition.map?.valueFor;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(5);

		for (const [measure, expected] of [
			["total", 500],
			["excludingLandUse", 550],
		] as const) {
			expect(
				valueFor?.(dataset, "E1", {
					...DEFAULT_MAP_OPTIONS,
					ghgEmissions: {
						...DEFAULT_MAP_OPTIONS.ghgEmissions,
						measure,
					},
				}),
			).toBe(expected);
		}
	});
});
