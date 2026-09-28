import { describe, expect, it } from "vitest";
import {
	accumulatePopulation,
	aggregatePopulation,
	buildPopulationStats,
	type PopulationTotals,
} from "@/lib/helpers/datasetAggregation/population";
import { polygonAreaSqKm } from "@/lib/helpers/population";
import { CODE_KEY, SQUARE, features } from "./fixtures";

const ward = (
	males: Record<string, number>,
	females: Record<string, number>,
) => {
	const total: Record<string, number> = { ...males };
	for (const [age, count] of Object.entries(females)) {
		total[age] = (total[age] ?? 0) + count;
	}
	return { total, males, females, wardName: "", ladCode: "", ladName: "" };
};

const data = {
	W1: ward({ "10": 2, "40": 3 }, { "10": 1, "70": 4 }),
	W2: ward({ "25": 5 }, { "70": 6 }),
} as any;

const emptyTotals = (): PopulationTotals => ({
	totalPop: 0,
	malesPop: 0,
	femalesPop: 0,
	totalArea: 0,
	ageGroups: {
		total: { "0-17": 0, "18-29": 0, "30-44": 0, "45-64": 0, "65+": 0 },
		males: { "0-17": 0, "18-29": 0, "30-44": 0, "45-64": 0, "65+": 0 },
		females: { "0-17": 0, "18-29": 0, "30-44": 0, "45-64": 0, "65+": 0 },
	},
	ageData: {},
	males: {},
	females: {},
});

describe("accumulatePopulation", () => {
	it("sums headline counts across the covered wards", () => {
		const totals = accumulatePopulation(
			features(["W1", "W2"]),
			CODE_KEY,
			data,
		);

		expect(totals.totalPop).toBe(21);
		expect(totals.malesPop).toBe(10);
		expect(totals.femalesPop).toBe(11);
	});

	it("sums the single-year age counts by sex", () => {
		const totals = accumulatePopulation(
			features(["W1", "W2"]),
			CODE_KEY,
			data,
		);

		expect(totals.ageData).toEqual({ "10": 3, "25": 5, "40": 3, "70": 10 });
		expect(totals.males).toEqual({ "10": 2, "25": 5, "40": 3 });
		expect(totals.females).toEqual({ "10": 1, "70": 10 });
	});

	it("sums the age bands by sex", () => {
		const totals = accumulatePopulation(
			features(["W1", "W2"]),
			CODE_KEY,
			data,
		);

		expect(totals.ageGroups.total).toEqual({
			"0-17": 3,
			"18-29": 5,
			"30-44": 3,
			"45-64": 0,
			"65+": 10,
		});
		expect(totals.ageGroups.males["18-29"]).toBe(5);
		expect(totals.ageGroups.females["65+"]).toBe(10);
	});

	it("adds up the area of the wards it counted", () => {
		const totals = accumulatePopulation(
			features(["W1", "W2"], SQUARE),
			CODE_KEY,
			data,
		);

		expect(totals.totalArea).toBeCloseTo(
			2 * polygonAreaSqKm({ type: "Polygon", coordinates: SQUARE }),
			6,
		);
	});

	it("skips features with no population record, area included", () => {
		const totals = accumulatePopulation(
			features(["missing"], SQUARE),
			CODE_KEY,
			data,
		);

		expect(totals.totalPop).toBe(0);
		expect(totals.totalArea).toBe(0);
		expect(totals.ageData).toEqual({});
	});
});

describe("buildPopulationStats", () => {
	it("carries the headline counts and bands into the stats", () => {
		const totals = accumulatePopulation(
			features(["W1", "W2"]),
			CODE_KEY,
			data,
		);
		const { populationStats } = buildPopulationStats(totals);

		expect(populationStats.total).toBe(21);
		expect(populationStats.males).toBe(10);
		expect(populationStats.females).toBe(11);
		expect(populationStats.ageGroups).toEqual(totals.ageGroups);
		expect(populationStats.isWardSpecific).toBe(false);
	});

	it("emits a single-year curve for ages 0-99, zero where unreported", () => {
		const totals = { ...emptyTotals(), ageData: { "10": 5 } };
		const { ages } = buildPopulationStats(totals);

		expect(ages).toHaveLength(100);
		expect(ages[0]).toEqual({ age: 0, count: 0 });
		expect(ages[10]).toEqual({ age: 10, count: 5 });
	});

	it("spreads the 90+ bucket over ages 90-99 without losing anyone", () => {
		const totals = { ...emptyTotals(), ageData: { "90": 100 } };
		const { ages } = buildPopulationStats(totals);

		const tail = ages.slice(90);
		expect(
			tail.reduce((sum: number, entry: any) => sum + entry.count, 0),
		).toBeCloseTo(100, 6);
		// The spread decays with age rather than being flat.
		expect(tail[0].count).toBeGreaterThan(tail[9].count);
	});

	it("pairs male and female counts for ages 0-90", () => {
		const totals = {
			...emptyTotals(),
			males: { "30": 4 },
			females: { "30": 6 },
		};
		const { genderAgeData } = buildPopulationStats(totals);

		expect(genderAgeData).toHaveLength(91);
		expect(genderAgeData[30]).toEqual({ age: 30, males: 4, females: 6 });
		expect(genderAgeData[0]).toEqual({ age: 0, males: 0, females: 0 });
	});

	it("takes the median age at the halfway point of the curve", () => {
		const totals = {
			...emptyTotals(),
			totalPop: 4,
			ageData: { "0": 1, "1": 1, "2": 1, "3": 1 },
		};

		expect(buildPopulationStats(totals).medianAge).toBe(1);
	});

	it("reports a zero median age for an empty selection", () => {
		expect(buildPopulationStats(emptyTotals()).medianAge).toBe(0);
	});

	it("divides population by area for density", () => {
		const totals = { ...emptyTotals(), totalPop: 500, totalArea: 2.5 };

		expect(buildPopulationStats(totals).density).toBe(200);
	});

	it("reports zero density when the selection has no area", () => {
		const totals = { ...emptyTotals(), totalPop: 500 };

		expect(buildPopulationStats(totals).density).toBe(0);
	});
});

describe("aggregatePopulation", () => {
	it("accumulates and derives in one pass over the boundaries", () => {
		const result = aggregatePopulation(
			features(["W1", "W2"], SQUARE),
			CODE_KEY,
			data,
		);

		expect(result.populationStats.total).toBe(21);
		expect(result.medianAge).toBe(40);
		expect(result.totalArea).toBeCloseTo(
			2 * polygonAreaSqKm({ type: "Polygon", coordinates: SQUARE }),
			6,
		);
		expect(result.density).toBeCloseTo(21 / result.totalArea, 6);
	});
});

describe("aggregatePopulation across geographies", () => {
	it("aggregates records that carry no ward fields", () => {
		// Local authority records hold only the age-by-sex counts, so the
		// aggregation must not depend on a ward's name or parent codes.
		const localAuthorities = {
			W1: {
				total: { "10": 3, "70": 5 },
				males: { "10": 2, "70": 1 },
				females: { "10": 1, "70": 4 },
			},
		};

		const stats = aggregatePopulation(
			features(["W1"]),
			CODE_KEY,
			localAuthorities,
		);

		expect(stats.populationStats.total).toBe(8);
		expect(stats.populationStats.males).toBe(3);
		expect(stats.populationStats.females).toBe(5);
	});
});
