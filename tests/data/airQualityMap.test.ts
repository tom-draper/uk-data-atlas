import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { airQualityDefinition } from "@/lib/datasets/airQuality";
import type { AirQualityDataset } from "@/lib/types/airQuality";

const dataset: AirQualityDataset = {
	id: "airQuality2024",
	type: "airQuality",
	year: 2024,
	boundaryType: "localAuthority",
	boundaryYear: 2024,
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			no2Mean: 12,
			pm25Mean: 8,
			pm10Mean: 15,
			gridCells: 4,
			pm25PopulationWeighted: 9,
			pm25PopulationWeightedAnthropogenic: 6,
		},
	},
};

describe("air-quality map metric", () => {
	it("uses the selected pollutant", () => {
		const valueFor = airQualityDefinition.map?.valueFor;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(12);

		for (const [measure, expected] of [
			["pm25", 8],
			["pm10", 15],
		] as const) {
			expect(
				valueFor?.(dataset, "E1", {
					...DEFAULT_MAP_OPTIONS,
					airQuality: {
						...DEFAULT_MAP_OPTIONS.airQuality,
						measure,
					},
				}),
			).toBe(expected);
		}
	});
});
