import { describe, expect, it } from "vitest";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import {
	NIMDM_MOST_DEPRIVED_RANK,
	summariseDeprivation,
	summariseDeprivationBy,
} from "@uk-data-atlas/datasets";
import { CODE_KEY, features } from "./fixtures";

/** A declared index's aggregate over the areas of the given boundary codes. */
const aggregate = (type: string, codes: string[], data: unknown): any =>
	CHART_DATASET_DEFINITIONS.find(
		(definition) => definition.type === type,
	)!.chart.calculateStats(
		{
			aggregate: (spec: { aggregate: (...args: unknown[]) => unknown }) =>
				spec.aggregate(features(codes), CODE_KEY, data),
		} as never,
		{ features: features(codes) } as never,
		data as never,
		null,
		type,
	);

describe("simd aggregation", () => {
	const data = {
		S1: { simdRank: 100, simdQuintile: 1, simdDecile: 1 },
		S2: { simdRank: 3000, simdQuintile: 3, simdDecile: 5 },
	} as any;

	it("counts zones in the published most deprived decile, not an average", () => {
		expect(aggregate("simd", ["S1", "S2"], data)).toEqual({
			areaCount: 2,
			mostDeprivedCount: 1,
		});
	});

	it("ignores zones with no record", () => {
		expect(aggregate("simd", ["S1", "missing"], data)).toEqual({
			areaCount: 1,
			mostDeprivedCount: 1,
		});
	});

	it("counts a zone once however many features carry its code", () => {
		expect(aggregate("simd", ["S1", "S1", "S2"], data)).toEqual({
			areaCount: 2,
			mostDeprivedCount: 1,
		});
	});

	it("returns null when no covered zone has a record", () => {
		expect(aggregate("simd", ["missing"], data)).toBeNull();
	});
});

describe("wimd aggregation", () => {
	const data = {
		W1: { wimdScore: 60, wimdRank: 20, wimdDecile: 1, population: 1000 },
		W2: { wimdScore: 30, wimdRank: 400, wimdDecile: 3, population: 2000 },
	} as any;

	it("counts areas in the published most deprived decile, and weights the average score by population", () => {
		expect(aggregate("wimd", ["W1", "W2"], data)).toEqual({
			areaCount: 2,
			mostDeprivedCount: 1,
			population: 3000,
			// (60 x 1,000 + 30 x 2,000) / 3,000, not the unweighted 45.
			averageScore: 40,
		});
	});
});

describe("imd aggregation", () => {
	const data = {
		E1: { imdScore: 70, imdRank: 10, imdDecile: 1, population: 1500 },
		E2: { imdScore: 60, imdRank: 50, imdDecile: 1, population: 1500 },
		E3: { imdScore: 5, imdRank: 30000, imdDecile: 10, population: 3000 },
	} as any;

	it("counts LSOAs in the published most deprived decile, and weights the average score by population", () => {
		expect(aggregate("imd", ["E1", "E2", "E3"], data)).toEqual({
			areaCount: 3,
			mostDeprivedCount: 2,
			population: 6000,
			averageScore: 35,
			domainScores: {
				incomeScore: null,
				employmentScore: null,
				educationScore: null,
				healthScore: null,
				crimeScore: null,
				housingScore: null,
				livingEnvironmentScore: null,
			},
		});
	});

	it("leaves an area without a population out of the average, not the share", () => {
		const summary = aggregate("imd", ["E1", "E3"], {
			...data,
			E3: { ...data.E3, population: Number.NaN },
		});
		expect(summary).toMatchObject({
			areaCount: 2,
			mostDeprivedCount: 1,
			population: 1500,
			averageScore: 70,
		});
	});

	it("has no average when no area has a population", () => {
		expect(
			aggregate("imd", ["E1"], {
				E1: { ...data.E1, population: 0 },
			})?.averageScore,
		).toBeNull();
	});
});

describe("nimdm aggregation", () => {
	// NISRA publishes no decile, so the most deprived tenth is read from rank.
	const data = {
		N1: { nimdmRank: NIMDM_MOST_DEPRIVED_RANK },
		N2: { nimdmRank: NIMDM_MOST_DEPRIVED_RANK + 1 },
	} as any;

	it("counts areas ranked within the most deprived tenth of 890", () => {
		expect(NIMDM_MOST_DEPRIVED_RANK).toBe(89);
		expect(aggregate("nimdm", ["N1", "N2"], data)).toEqual({
			areaCount: 2,
			mostDeprivedCount: 1,
		});
	});
});

describe("summariseDeprivationBy", () => {
	it("summarises each parent area separately", () => {
		const records = [
			{ lad: "A", decile: 1 },
			{ lad: "A", decile: 4 },
			{ lad: "B", decile: 1 },
		];
		expect(
			summariseDeprivationBy(
				records,
				(record) => record.lad,
				(group) =>
					summariseDeprivation(
						group,
						(record) => record.decile === 1,
					),
			),
		).toEqual({
			A: { areaCount: 2, mostDeprivedCount: 1 },
			B: { areaCount: 1, mostDeprivedCount: 1 },
		});
	});
});
