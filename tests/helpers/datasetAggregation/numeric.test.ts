import { describe, expect, it } from "vitest";
import {
	aggregateAirQuality,
	aggregateBroadband,
	aggregateChildPoverty,
	aggregateClaimantCount,
	aggregateFuelPoverty,
	aggregateHomelessness,
	aggregateSchoolPerformance,
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
	it("averages coverage over the records that report full fibre", () => {
		const result = aggregateBroadband([
			{ pctSuperfast: 90, pctUltrafast: 60, pctFullFibre: 40, pctGigabit: 50 },
			{ pctSuperfast: 80, pctUltrafast: 40, pctFullFibre: 20, pctGigabit: 30 },
			// Skipped entirely: no full fibre figure to anchor the record.
			{ pctSuperfast: 100, pctUltrafast: 100, pctFullFibre: null, pctGigabit: 100 },
		] as any);

		expect(result).toEqual({
			pctSuperfast: 85,
			pctUltrafast: 50,
			pctFullFibre: 30,
			pctGigabit: 40,
		});
	});

	it("treats missing optional measures as zero", () => {
		expect(
			aggregateBroadband([{ pctFullFibre: 30 }] as any),
		).toEqual({
			pctSuperfast: 0,
			pctUltrafast: 0,
			pctFullFibre: 30,
			pctGigabit: 0,
		});
	});

	it("returns null when no record reports full fibre", () => {
		expect(aggregateBroadband([{ pctFullFibre: null }] as any)).toBeNull();
		expect(aggregateBroadband([])).toBeNull();
	});
});

describe("aggregateAirQuality", () => {
	it("averages each pollutant over the records that report it", () => {
		const result = aggregateAirQuality([
			{ no2Mean: 20, pm25Mean: 10, pm10Mean: 16 },
			{ no2Mean: 30, pm25Mean: 14, pm10Mean: null },
		] as any);

		expect(result).toEqual({ no2Mean: 25, pm25Mean: 12, pm10Mean: 16 });
	});

	it("reports null for a pollutant no record measures", () => {
		expect(
			aggregateAirQuality([{ no2Mean: 20, pm25Mean: null, pm10Mean: null }] as any),
		).toEqual({ no2Mean: 20, pm25Mean: null, pm10Mean: null });
	});

	it("returns null when no record measures NO2", () => {
		expect(aggregateAirQuality([{ no2Mean: null, pm25Mean: 10 }] as any)).toBeNull();
	});
});

describe("aggregateClaimantCount", () => {
	it("sums claimant counts but averages the rates", () => {
		const result = aggregateClaimantCount([
			{ totalCount: 100, totalRate: 4, youthCount: 20, youthRate: 6 },
			{ totalCount: 300, totalRate: 6, youthCount: 40, youthRate: 8 },
		] as any);

		expect(result).toEqual({
			totalCount: 400,
			totalRate: 5,
			youthCount: 60,
			youthRate: 7,
		});
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
			aggregateChildPoverty([{ childCount: 0, childrenPopulation: 0 }] as any),
		).toBeNull();
	});
});

describe("aggregateHomelessness", () => {
	it("sums household counts and averages the per-thousand rate", () => {
		const result = aggregateHomelessness([
			{
				householdsInTemporaryAccommodation: 100,
				householdsPerThousand: 2,
				householdsWithChildren: 40,
				childrenInTemporaryAccommodation: 90,
			},
			{
				householdsInTemporaryAccommodation: 200,
				householdsPerThousand: 6,
				householdsWithChildren: 60,
				childrenInTemporaryAccommodation: 110,
			},
		] as any);

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
			aggregateFuelPoverty([{ householdCount: 0, fuelPoorHouseholdCount: 0 }] as any),
		).toBeNull();
	});
});

describe("aggregateSchoolPerformance", () => {
	it("averages over the records with a basics measure", () => {
		const result = aggregateSchoolPerformance([
			{ ptL2basics94: 40, ptL2basics95: 30, avgAtt8: 50, avgP8score: 0.2 },
			{ ptL2basics94: 60, ptL2basics95: 50, avgAtt8: 46, avgP8score: -0.4 },
			{ ptL2basics94: null, ptL2basics95: 100, avgAtt8: 100, avgP8score: 2 },
		] as any);

		expect(result).toEqual({
			ptL2basics94: 50,
			ptL2basics95: 40,
			avgAtt8: 48,
			avgP8score: -0.1,
		});
	});

	it("returns null when no record has a basics measure", () => {
		expect(aggregateSchoolPerformance([{ ptL2basics94: null }] as any)).toBeNull();
	});
});
