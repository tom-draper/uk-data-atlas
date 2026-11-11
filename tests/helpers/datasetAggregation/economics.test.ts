import { describe, expect, it } from "vitest";
import {
	aggregateCustomDataset,
	aggregateHousePrices,
	aggregateIncome,
} from "@/lib/helpers/datasetAggregation/economics";
import {
	aggregateCrime,
	aggregateJobs,
	aggregateNHSWaiting,
} from "@uk-data-atlas/datasets";
import { CODE_KEY, features } from "./fixtures";

describe("aggregateHousePrices", () => {
	const data = {
		E1: {
			prices: { 2021: 200000, 2023: 240000, 2024: 500000 },
			meanPrices: { 2021: 250000, 2023: 290000, 2024: 500000 },
		},
		E2: {
			prices: { 2021: 300000, 2023: 260000 },
			meanPrices: { 2021: 350000, 2023: 310000 },
		},
		E3: { prices: { 2021: 100000 }, meanPrices: { 2021: 150000 } },
	} as any;

	it("averages the headline price over the wards priced in 2023", () => {
		const result = aggregateHousePrices(
			features(["E1", "E2", "E3"]),
			CODE_KEY,
			data,
		);

		expect(result.averagePrice).toBe(250000);
		expect(result.wardCount).toBe(2);
	});

	it("averages each year and ignores years after 2023", () => {
		const result = aggregateHousePrices(
			features(["E1", "E2", "E3"]),
			CODE_KEY,
			data,
		);

		expect(result.averagePrices).toEqual({ 2021: 200000, 2023: 250000 });
		expect(result.averageMeanPrices).toEqual({
			2021: 250000,
			2023: 300000,
		});
	});

	it("reports a zero average when no covered ward has a price", () => {
		const result = aggregateHousePrices(
			features(["missing"]),
			CODE_KEY,
			data,
		);
		expect(result).toEqual({
			averagePrice: 0,
			averageMeanPrice: 0,
			wardCount: 0,
			averagePrices: {},
			averageMeanPrices: {},
		});
	});
});

describe("aggregateIncome", () => {
	const data = {
		E1: {
			annual: { median: 30000, mean: 35000 },
			hourly: { median: 15, mean: 20 },
		},
		E2: { annual: { median: 40000, mean: 50000 }, hourly: { median: 25 } },
		E3: {},
	} as any;

	it("averages annual and hourly pay over the areas reporting each", () => {
		expect(
			aggregateIncome(features(["E1", "E2", "E3"]), CODE_KEY, data),
		).toEqual({
			averageMedianIncome: 35000,
			averageMeanIncome: 42500,
			averageHourlyMedianIncome: 20,
			averageHourlyMeanIncome: 20,
		});
	});

	it("reports zero when no covered area reports an income", () => {
		expect(aggregateIncome(features(["E3"]), CODE_KEY, data)).toEqual({
			averageMedianIncome: 0,
			averageMeanIncome: 0,
			averageHourlyMedianIncome: null,
			averageHourlyMeanIncome: null,
		});
	});
});

describe("aggregateJobs", () => {
	it("sums workplace jobs across the covered local authorities", () => {
		expect(
			aggregateJobs([
				{ ladCode: "E1", ladName: "One", totalJobs: 120_000 },
				{ ladCode: "E2", ladName: "Two", totalJobs: 80_000 },
			]),
		).toEqual({ totalJobs: 200_000 });
	});

	it("returns null where no local authorities are covered", () => {
		expect(aggregateJobs([])).toBeNull();
	});
});

describe("aggregateCustomDataset", () => {
	it("counts and averages the covered values", () => {
		const result = aggregateCustomDataset(
			features(["E1", "E2", "missing"]),
			CODE_KEY,
			{ E1: 1, E2: 4 },
		);
		expect(result).toEqual({ count: 2, average: 2.5 });
	});

	it("keeps a zero value in the average", () => {
		expect(
			aggregateCustomDataset(features(["E1", "E2"]), CODE_KEY, {
				E1: 0,
				E2: 10,
			}),
		).toEqual({ count: 2, average: 5 });
	});

	it("reports zero when nothing is covered", () => {
		expect(
			aggregateCustomDataset(features(["missing"]), CODE_KEY, {}),
		).toEqual({
			count: 0,
			average: 0,
		});
	});
});

describe("aggregateCrime", () => {
	it("averages recorded crime over the covered areas", () => {
		expect(
			aggregateCrime([
				{ totalRecordedCrime: 100 },
				{ totalRecordedCrime: 300 },
			] as any),
		).toEqual({ totalRecordedCrime: 200 });
	});

	it("reports nothing when no covered area has a record", () => {
		expect(aggregateCrime([])).toBeNull();
	});
});

describe("aggregateNHSWaiting", () => {
	it("sums the boards and recomputes the share from the totals", () => {
		expect(
			aggregateNHSWaiting([
				{ total: 100, over18Weeks: 40 },
				{ total: 300, over18Weeks: 60 },
			] as any),
		).toEqual({ total: 400, over18Weeks: 100, pctOver18Weeks: 25 });
	});

	it("reports nothing when there are no waiting pathways", () => {
		expect(aggregateNHSWaiting([])).toBeNull();
		expect(
			aggregateNHSWaiting([{ total: 0, over18Weeks: 0 }] as any),
		).toBeNull();
	});
});
