import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type { AirQualityDataset } from "@uk-data-atlas/datasets";

const airQualityDefinition = CHART_DATASET_DEFINITIONS.find(
	({ type }) => type === "air-quality",
)!;

const dataset: AirQualityDataset = {
	id: "air-quality2024",
	type: "air-quality",
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
		expect(valueFor?.(dataset as never, "E1", DEFAULT_MAP_OPTIONS)).toBe(
			12,
		);

		for (const [measure, expected] of [
			["pm25", 8],
			["pm10", 15],
		] as const) {
			expect(
				valueFor?.(dataset as never, "E1", {
					...DEFAULT_MAP_OPTIONS,
					"air-quality": {
						...DEFAULT_MAP_OPTIONS["air-quality"],
						measure,
					},
				}),
			).toBe(expected);
		}
	});
});
