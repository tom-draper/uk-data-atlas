import { describe, expect, it } from "vitest";
import {
	aggregateIMD,
	aggregateNIMDM,
	aggregateSIMD,
	aggregateWIMD,
} from "@/lib/helpers/datasetAggregation/deprivation";
import { CODE_KEY, features } from "./fixtures";

describe("aggregateSIMD", () => {
	const data = {
		S1: { simdRank: 100, simdQuintile: 1, simdDecile: 2 },
		S2: { simdRank: 300, simdQuintile: 3, simdDecile: 6 },
	} as any;

	it("averages rank, quintile and decile over the covered zones", () => {
		expect(aggregateSIMD(features(["S1", "S2"]), CODE_KEY, data)).toEqual({
			averageSIMDRank: 200,
			averageSIMDQuintile: 2,
			averageSIMDDecile: 4,
		});
	});

	it("ignores zones with no record", () => {
		expect(aggregateSIMD(features(["S1", "missing"]), CODE_KEY, data)).toEqual({
			averageSIMDRank: 100,
			averageSIMDQuintile: 1,
			averageSIMDDecile: 2,
		});
	});

	it("returns null when no covered zone has a record", () => {
		expect(aggregateSIMD(features(["missing"]), CODE_KEY, data)).toBeNull();
	});
});

describe("aggregateWIMD", () => {
	const data = {
		W1: { wimdScore: 10, wimdRank: 200, wimdDecile: 2 },
		W2: { wimdScore: 30, wimdRank: 400, wimdDecile: 4 },
	} as any;

	it("averages score, rank and decile over the covered areas", () => {
		expect(aggregateWIMD(features(["W1", "W2"]), CODE_KEY, data)).toEqual({
			averageWIMDScore: 20,
			averageWIMDRank: 300,
			averageWIMDDecile: 3,
		});
	});

	it("returns null when no covered area has a record", () => {
		expect(aggregateWIMD(features(["missing"]), CODE_KEY, data)).toBeNull();
	});
});

describe("aggregateNIMDM", () => {
	const data = {
		N1: { nimdmRank: 100, nimdmDecile: 1 },
		N2: { nimdmRank: 500, nimdmDecile: 5 },
	} as any;

	it("averages rank and decile over the covered areas", () => {
		expect(aggregateNIMDM(features(["N1", "N2"]), CODE_KEY, data)).toEqual({
			averageNIMDMRank: 300,
			averageNIMDMDecile: 3,
		});
	});

	it("returns null when no covered area has a record", () => {
		expect(aggregateNIMDM(features(["missing"]), CODE_KEY, data)).toBeNull();
	});
});

describe("aggregateIMD", () => {
	const data = {
		E1: { imdScore: 20, imdDecile: 2 },
		E2: { imdScore: 40, imdDecile: 8 },
	} as any;

	it("averages score and decile over the covered LSOAs", () => {
		expect(aggregateIMD(features(["E1", "E2"]), CODE_KEY, data)).toEqual({
			averageIMDScore: 30,
			averageIMDDecile: 5,
		});
	});

	it("reports zeros rather than null when nothing is covered", () => {
		expect(aggregateIMD(features(["missing"]), CODE_KEY, data)).toEqual({
			averageIMDScore: 0,
			averageIMDDecile: 0,
		});
	});
});
