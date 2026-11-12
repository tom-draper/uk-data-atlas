import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { housePriceDefinition } from "@/lib/datasets/housePrice";
import type { HousePriceDataset } from "@uk-data-atlas/datasets";

const dataset: HousePriceDataset = {
	id: "house-price2023",
	type: "house-price",
	year: 2023,
	boundaryYear: 2021,
	boundaryType: "ward",
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			wardCode: "E1",
			wardName: "Example ward",
			prices: { 2023: 250000 },
			meanPrices: { 2023: 320000 },
		},
	},
};

describe("house price map metric", () => {
	it("uses the selected median or mean price", () => {
		const valueFor = housePriceDefinition.map?.valueFor;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(250000);

		expect(
			valueFor?.(dataset, "E1", {
				...DEFAULT_MAP_OPTIONS,
				"house-price": {
					...DEFAULT_MAP_OPTIONS["house-price"],
					measure: "mean",
				},
			}),
		).toBe(320000);
	});
});
