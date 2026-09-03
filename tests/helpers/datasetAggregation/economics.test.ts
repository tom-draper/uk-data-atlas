import { describe, expect, it } from "vitest";
import {
	aggregateCrime,
	aggregateCustomDataset,
	aggregateHousePrices,
	aggregateIncome,
	aggregateUnemployment,
} from "@/lib/helpers/datasetAggregation/economics";
import { CODE_KEY, features } from "./fixtures";

describe("aggregateUnemployment", () => {
	const dataset = {
		years: [2022, 2023],
		latestYear: 2023,
		data: {
			E1: { rates: { 2022: 4, 2023: 5 } },
			E2: { rates: { 2022: 6, 2023: null } },
		},
	} as any;

	it("averages each year over the areas reporting a rate that year", () => {
		const result = aggregateUnemployment(
			features(["E1", "E2"]),
			CODE_KEY,
			dataset,
		);

		expect(result).toEqual({
			years: [2022, 2023],
			latestYear: 2023,
			rates: { 2022: 5, 2023: 5 },
		});
	});

	it("omits a year no covered area reports", () => {
		const result = aggregateUnemployment(
			features(["E2"]),
			CODE_KEY,
			dataset,
		);
		expect(result?.rates).toEqual({ 2022: 6 });
	});

	it("returns null when no covered area has a record", () => {
		expect(
			aggregateUnemployment(features(["missing"]), CODE_KEY, dataset),
		).toBeNull();
	});
});

describe("aggregateHousePrices", () => {
	const data = {
		E1: { prices: { 2021: 200000, 2023: 240000, 2024: 500000 } },
		E2: { prices: { 2021: 300000, 2023: 260000 } },
		E3: { prices: { 2021: 100000 } },
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
	});

	it("reports a zero average when no covered ward has a price", () => {
		const result = aggregateHousePrices(
			features(["missing"]),
			CODE_KEY,
			data,
		);
		expect(result).toEqual({
			averagePrice: 0,
			wardCount: 0,
			averagePrices: {},
		});
	});
});

describe("aggregateCrime", () => {
	const data = {
		E1: { totalRecordedCrime: 100 },
		E2: { totalRecordedCrime: 300 },
	} as any;

	it("averages recorded crime over the covered areas", () => {
		expect(aggregateCrime(features(["E1", "E2"]), CODE_KEY, data)).toEqual({
			averageRecordedCrime: 200,
		});
	});

	it("reports zero when no covered area has a record", () => {
		expect(aggregateCrime(features(["missing"]), CODE_KEY, data)).toEqual({
			averageRecordedCrime: 0,
		});
	});
});

describe("aggregateIncome", () => {
	const data = {
		E1: { annual: { median: 30000 } },
		E2: { annual: { median: 40000 } },
		E3: {},
	} as any;

	it("averages the annual median over the areas reporting one", () => {
		expect(
			aggregateIncome(features(["E1", "E2", "E3"]), CODE_KEY, data),
		).toEqual({ averageIncome: 35000 });
	});

	it("reports zero when no covered area reports an income", () => {
		expect(aggregateIncome(features(["E3"]), CODE_KEY, data)).toEqual({
			averageIncome: 0,
		});
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
