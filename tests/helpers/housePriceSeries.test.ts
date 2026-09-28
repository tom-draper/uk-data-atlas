import { describe, expect, it, vi } from "vitest";
import {
	HousePriceSeriesCache,
	resolveHousePriceSeries,
	type HousePriceSeriesInput,
} from "@/lib/helpers/housePriceSeries";
import type { HousePriceDataset, SelectedArea } from "@/lib/types";

const wardData = (
	wardCode: string,
	prices: Record<number, number>,
	meanPrices: Record<number, number> = {},
) => ({
	ladCode: "LAD",
	ladName: "Example authority",
	wardCode,
	wardName: wardCode,
	prices,
	meanPrices,
});

const dataset = (data: HousePriceDataset["data"]): HousePriceDataset => ({
	id: "housePrice2023",
	type: "housePrice",
	year: 2023,
	boundaryYear: 2022,
	boundaryType: "ward",
	data,
});

const selectedArea = (type: SelectedArea["type"], code: string): SelectedArea =>
	({ type, code, name: code, data: null }) as SelectedArea;

describe("resolveHousePriceSeries", () => {
	it("uses the national aggregate when no area is selected", () => {
		const series = resolveHousePriceSeries({
			dataset: dataset({}),
			aggregatedData: {
				2023: {
					averagePrice: 200000,
					averagePrices: { 2023: 200000, 2021: 150000 },
					averageMeanPrice: 250000,
					averageMeanPrices: { 2023: 250000, 2021: 190000 },
					wardCount: 2,
				},
			},
			selectedArea: null,
			measure: "median",
		});

		expect(series).toEqual({
			priceData: [
				{ year: 2021, price: 150000 },
				{ year: 2023, price: 200000 },
			],
			currentPrice: 200000,
		});
	});

	it("uses mean prices when the mean measure is selected", () => {
		const series = resolveHousePriceSeries({
			dataset: dataset({
				W1: wardData("W1", { 2023: 175000 }, { 2023: 225000 }),
			}),
			aggregatedData: null,
			selectedArea: selectedArea("ward", "W1"),
			measure: "mean",
		});

		expect(series.currentPrice).toBe(225000);
	});

	it("maps a selected ward to the dataset boundary vintage", () => {
		const getCodeForYear = vi.fn(() => "W-2022");
		const series = resolveHousePriceSeries({
			dataset: dataset({
				"W-2022": wardData("W-2022", { 2023: 175000 }),
			}),
			aggregatedData: null,
			selectedArea: selectedArea("ward", "W-current"),
			measure: "median",
			codeMapper: {
				getCodeForYear,
				getWardsForLad: () => [],
				getWardsForConstituency: () => [],
			},
		});

		expect(getCodeForYear).toHaveBeenCalledWith("ward", "W-current", 2022);
		expect(series).toEqual({
			priceData: [{ year: 2023, price: 175000 }],
			currentPrice: 175000,
		});
	});

	it("calculates per-year medians for a local authority", () => {
		const series = resolveHousePriceSeries({
			dataset: dataset({
				W1: wardData("W1", { 2022: 100000, 2023: 150000 }),
				W2: wardData("W2", { 2022: 200000, 2023: 250000 }),
				W3: wardData("W3", { 2022: 500000, 2023: 550000 }),
			}),
			aggregatedData: null,
			selectedArea: selectedArea("localAuthority", "LAD"),
			measure: "median",
			codeMapper: {
				getCodeForYear: () => undefined,
				getWardsForLad: () => ["W1", "W2", "W3"],
				getWardsForConstituency: () => [],
			},
		});

		expect(series).toEqual({
			priceData: [
				{ year: 2022, price: 200000 },
				{ year: 2023, price: 250000 },
			],
			currentPrice: 250000,
		});
	});

	it("uses the constituency's ward membership at the dataset boundary vintage", () => {
		const getWardsForConstituency = vi.fn(() => ["W1", "W2"]);
		const series = resolveHousePriceSeries({
			dataset: dataset({
				W1: wardData("W1", { 2023: 100000 }),
				W2: wardData("W2", { 2023: 300000 }),
			}),
			aggregatedData: null,
			selectedArea: selectedArea("constituency", "C1"),
			measure: "median",
			codeMapper: {
				getCodeForYear: () => undefined,
				getWardsForLad: () => [],
				getWardsForConstituency,
			},
		});

		expect(getWardsForConstituency).toHaveBeenCalledWith("C1", 2022);
		expect(series.currentPrice).toBe(200000);
	});
});

describe("HousePriceSeriesCache", () => {
	it("invalidates a cached area lookup when mappings change", () => {
		const getWardsForLad = vi.fn(() => ["W1"]);
		const input: HousePriceSeriesInput = {
			dataset: dataset({ W1: wardData("W1", { 2023: 100000 }) }),
			aggregatedData: null,
			selectedArea: selectedArea("localAuthority", "LAD"),
			measure: "median",
			codeMapper: {
				getCodeForYear: () => undefined,
				getWardsForLad,
				getWardsForConstituency: () => [],
			},
		};
		const cache = new HousePriceSeriesCache();

		cache.resolve(input, 0);
		cache.resolve(input, 0);
		cache.resolve(input, 1);

		expect(getWardsForLad).toHaveBeenCalledTimes(2);
	});
});
