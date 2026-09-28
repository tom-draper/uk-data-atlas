import { describe, expect, it } from "vitest";
import {
	aggregateAirQuality,
	aggregateBroadband,
	aggregateChildPoverty,
	aggregateClaimantCount,
	aggregateFuelPoverty,
	aggregateHomelessness,
	aggregateSchoolPerformance,
	aggregateSchoolPerformanceGap,
	collectBoundaryRecords,
} from "@/lib/helpers/datasetAggregation/numeric";
import { CODE_KEY, features } from "./fixtures";

describe("collectBoundaryRecords", () => {
	it("collects records for the covered boundaries in feature order", () => {
		const records = collectBoundaryRecords(
			features(["E1", "E2"]),
			{ E2: "second", E1: "first" },
			CODE_KEY,
		);
		expect(records).toEqual(["first", "second"]);
	});

	it("skips boundaries with no record", () => {
		const records = collectBoundaryRecords(
			features(["E1", "missing"]),
			{ E1: "first" },
			CODE_KEY,
		);
		expect(records).toEqual(["first"]);
	});
});

describe("aggregateBroadband", () => {
	it("weights coverage by each authority's premises", () => {
		const result = aggregateBroadband([
			{
				pctSuperfast: 90,
				pctUltrafast: 60,
				pctFullFibre: 40,
				pctGigabit: 50,
				premisesCount: 1000,
			},
			{
				pctSuperfast: 80,
				pctUltrafast: 40,
				pctFullFibre: 20,
				pctGigabit: 30,
				premisesCount: 3000,
			},
			// Skipped entirely: no full fibre figure to anchor the record.
			{
				pctSuperfast: 100,
				pctUltrafast: 100,
				pctFullFibre: null,
				pctGigabit: 100,
				premisesCount: 5000,
			},
		] as any);

		// (90×1000 + 80×3000) / 4000, not the flat mean of 85.
		expect(result).toEqual({
			pctSuperfast: 82.5,
			pctUltrafast: 45,
			pctFullFibre: 25,
			pctGigabit: 35,
		});
	});

	it("leaves a missing measure out of that measure's weights", () => {
		expect(
			aggregateBroadband([
				{ pctFullFibre: 30, pctGigabit: null, premisesCount: 100 },
				{ pctFullFibre: 10, pctGigabit: 60, premisesCount: 300 },
			] as any),
		).toMatchObject({ pctFullFibre: 15, pctGigabit: 60 });
	});

	it("returns null when no record reports full fibre with premises", () => {
		expect(aggregateBroadband([{ pctFullFibre: null }] as any)).toBeNull();
		expect(
			aggregateBroadband([
				{ pctFullFibre: 30, premisesCount: null },
			] as any),
		).toBeNull();
		expect(aggregateBroadband([])).toBeNull();
	});
});

describe("aggregateAirQuality", () => {
	it("weights each pollutant by the grid cells its mean covers", () => {
		const result = aggregateAirQuality([
			{ no2Mean: 20, pm25Mean: 10, pm10Mean: 16, gridCells: 3 },
			{ no2Mean: 40, pm25Mean: 14, pm10Mean: null, gridCells: 1 },
		] as any);

		// (20×3 + 40×1) / 4, the mean over every cell, not the flat mean of 30.
		expect(result).toEqual({ no2Mean: 25, pm25Mean: 11, pm10Mean: 16 });
	});

	it("reports null for a pollutant no record measures", () => {
		expect(
			aggregateAirQuality([
				{ no2Mean: 20, pm25Mean: null, pm10Mean: null, gridCells: 5 },
			] as any),
		).toEqual({ no2Mean: 20, pm25Mean: null, pm10Mean: null });
	});

	it("returns null when no record measures NO2", () => {
		expect(
			aggregateAirQuality([
				{ no2Mean: null, pm25Mean: 10, gridCells: 5 },
			] as any),
		).toBeNull();
	});
});

describe("aggregateClaimantCount", () => {
	it("sums counts and pools the residents each rate is taken over", () => {
		const result = aggregateClaimantCount([
			// 100 claimants at 4% are 2,500 residents; 300 at 6% are 5,000.
			{ totalCount: 100, totalRate: 4, youthCount: 20, youthRate: 0.8 },
			{ totalCount: 300, totalRate: 6, youthCount: 40, youthRate: 0.8 },
		] as any);

		expect(result?.totalCount).toBe(400);
		expect(result?.youthCount).toBe(60);
		// 400 of 7,500 residents, not the flat mean of 5%.
		expect(result?.totalRate).toBeCloseTo(5.3333, 4);
		expect(result?.youthRate).toBeCloseTo(0.8, 4);
	});

	it("returns null with no records", () => {
		expect(aggregateClaimantCount([])).toBeNull();
	});
});

describe("aggregateChildPoverty", () => {
	it("pools the child population before taking a rate", () => {
		const result = aggregateChildPoverty([
			{ childCount: 100, childrenPopulation: 1000 },
			{ childCount: 500, childrenPopulation: 1000 },
		] as any);

		// Pooled (600/2000), not the mean of 10% and 50%.
		expect(result).toEqual({ childCount: 600, childPovertyRate: 30 });
	});

	it("returns null when the covered areas have no children", () => {
		expect(
			aggregateChildPoverty([
				{ childCount: 0, childrenPopulation: 0 },
			] as any),
		).toBeNull();
	});
});

describe("aggregateHomelessness", () => {
	it("sums household counts and pools the households each rate is over", () => {
		const result = aggregateHomelessness([
			// 100 per 2 a thousand is 50,000 households; 200 per 8 is 25,000.
			{
				householdsInTemporaryAccommodation: 100,
				householdsPerThousand: 2,
				householdsWithChildren: 40,
				childrenInTemporaryAccommodation: 90,
			},
			{
				householdsInTemporaryAccommodation: 200,
				householdsPerThousand: 8,
				householdsWithChildren: 60,
				childrenInTemporaryAccommodation: 110,
			},
		] as any);

		// 300 of 75,000 households, not the flat mean of 5 per thousand.
		expect(result).toEqual({
			householdsInTemporaryAccommodation: 300,
			householdsPerThousand: 4,
			householdsWithChildren: 100,
			childrenInTemporaryAccommodation: 200,
		});
	});

	it("returns null with no records", () => {
		expect(aggregateHomelessness([])).toBeNull();
	});
});

describe("aggregateFuelPoverty", () => {
	it("pools households before taking a rate", () => {
		const result = aggregateFuelPoverty([
			{ householdCount: 1000, fuelPoorHouseholdCount: 100 },
			{ householdCount: 3000, fuelPoorHouseholdCount: 900 },
		] as any);

		// Pooled (1000/4000), not the mean of 10% and 30%.
		expect(result).toEqual({
			householdCount: 4000,
			fuelPoorHouseholdCount: 1000,
			fuelPovertyRate: 25,
		});
	});

	it("returns null when the covered areas have no households", () => {
		expect(
			aggregateFuelPoverty([
				{ householdCount: 0, fuelPoorHouseholdCount: 0 },
			] as any),
		).toBeNull();
	});
});

describe("aggregateSchoolPerformance", () => {
	it("weights each measure by the pupils in the records with a basics measure", () => {
		const result = aggregateSchoolPerformance([
			{
				ptL2basics94: 40,
				ptL2basics95: 30,
				avgAtt8: 50,
				avgP8score: 0.2,
				pupils: 300,
			},
			{
				ptL2basics94: 60,
				ptL2basics95: 50,
				avgAtt8: 46,
				avgP8score: -0.4,
				pupils: 100,
			},
			{
				ptL2basics94: null,
				ptL2basics95: 100,
				avgAtt8: 100,
				avgP8score: 2,
				pupils: 1000,
			},
		] as any);

		expect(result?.ptL2basics94).toBe(45);
		expect(result?.ptL2basics95).toBe(35);
		expect(result?.avgAtt8).toBe(49);
		expect(result?.avgP8score).toBeCloseTo(0.05, 10);
	});

	it("returns null when no record has a basics measure", () => {
		expect(
			aggregateSchoolPerformance([{ ptL2basics94: null }] as any),
		).toBeNull();
	});
});

describe("aggregateSchoolPerformanceGap", () => {
	it("pools each group over its own pupils and takes the gap between them", () => {
		const result = aggregateSchoolPerformanceGap([
			{
				att8Disadvantaged: 30,
				att8NotDisadvantaged: 50,
				att8Gap: 20,
				disadvantagedPupils: 300,
				notDisadvantagedPupils: 100,
			},
			{
				att8Disadvantaged: 40,
				att8NotDisadvantaged: 50,
				att8Gap: 10,
				disadvantagedPupils: 100,
				notDisadvantagedPupils: 300,
			},
		] as any);

		// Disadvantaged pupils score 32.5 pooled, the rest 50: a gap of 17.5,
		// not the flat mean gap of 15.
		expect(result).toEqual({
			att8Gap: 17.5,
			att8Disadvantaged: 32.5,
			att8NotDisadvantaged: 50,
		});
	});

	it("returns null when no district's gap could be measured", () => {
		expect(
			aggregateSchoolPerformanceGap([{ att8Gap: null }] as any),
		).toBeNull();
	});
});
