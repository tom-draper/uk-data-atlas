import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets/generated";
import { aggregateHousePrices } from "@uk-data-atlas/datasets";
import type { HousePriceDataset } from "@uk-data-atlas/datasets";

const definition = CHART_DATASET_DEFINITIONS.find(
	(candidate) => candidate.type === "house-price",
)!;

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
		const valueFor = definition.map?.valueFor;
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

	it("labels the legend in thousands of pounds", () => {
		expect(definition.map!.legend.format(250000, DEFAULT_MAP_OPTIONS)).toBe(
			"£250k",
		);
	});
});

describe("aggregateHousePrices", () => {
	const ward = (prices: number | undefined, mean: number | undefined) =>
		({
			prices: prices === undefined ? {} : { 2023: prices },
			meanPrices: mean === undefined ? {} : { 2023: mean },
		}) as never;

	it("averages the wards priced in 2023", () => {
		expect(
			aggregateHousePrices([
				ward(240000, 290000),
				ward(260000, 310000),
				ward(undefined, undefined),
			]),
		).toEqual({
			averagePrice: 250000,
			averageMeanPrice: 300000,
			wardCount: 2,
		});
	});

	it("reports zero when no ward has a price", () => {
		expect(aggregateHousePrices([])).toEqual({
			averagePrice: 0,
			averageMeanPrice: 0,
			wardCount: 0,
		});
	});
});
