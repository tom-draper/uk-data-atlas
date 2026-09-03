import { describe, expect, it } from "vitest";
import {
	aggregateBrexit,
	aggregateBrexitConstituencies,
	aggregateGeneralElection,
	aggregateLocalElection,
} from "@/lib/helpers/datasetAggregation/elections";
import { CODE_KEY, features } from "./fixtures";

describe("aggregateLocalElection", () => {
	const data = {
		W1: {
			partyVotes: { LAB: 100, CON: 50, GREEN: 10 },
			electorate: 1000,
			totalVotes: 160,
		},
		W2: {
			partyVotes: { LAB: 20, LD: 30 },
			electorate: 500,
			totalVotes: 50,
		},
	} as any;

	it("sums party votes, electorate and turnout across the covered wards", () => {
		const stats = aggregateLocalElection(
			features(["W1", "W2"]),
			CODE_KEY,
			data,
		);

		expect(stats.partyVotes).toEqual({
			LAB: 120,
			CON: 50,
			LD: 30,
			GREEN: 10,
			REF: 0,
			IND: 0,
			DUP: 0,
			PC: 0,
			SNP: 0,
			SF: 0,
			APNI: 0,
			SDLP: 0,
		});
		expect(stats.electorate).toBe(1500);
		expect(stats.totalVotes).toBe(210);
	});

	it("returns a zeroed tally when no covered ward has a result", () => {
		const stats = aggregateLocalElection(
			features(["missing"]),
			CODE_KEY,
			data,
		);

		expect(stats.electorate).toBe(0);
		expect(stats.totalVotes).toBe(0);
		expect(stats.partyVotes.LAB).toBe(0);
	});
});

describe("aggregateGeneralElection", () => {
	const data = {
		C1: {
			partyVotes: { LAB: 20000, CON: 15000 },
			electorate: 70000,
			validVotes: 35000,
			invalidVotes: 100,
		},
		C2: {
			partyVotes: { CON: 18000, LAB: 12000, GREEN: 2000 },
			electorate: 60000,
			validVotes: 32000,
			invalidVotes: 200,
		},
	} as any;

	it("awards a seat to the leading party in each covered constituency", () => {
		const stats = aggregateGeneralElection(
			features(["C1", "C2"]),
			CODE_KEY,
			data,
		);

		expect(stats.totalSeats).toBe(2);
		expect(stats.partySeats).toEqual({ LAB: 1, CON: 1 });
	});

	it("sums the vote and electorate totals", () => {
		const stats = aggregateGeneralElection(
			features(["C1", "C2"]),
			CODE_KEY,
			data,
		);

		expect(stats.partyVotes).toEqual({
			LAB: 32000,
			CON: 33000,
			GREEN: 2000,
		});
		expect(stats.totalVotes).toBe(67000);
		expect(stats.electorate).toBe(130000);
		expect(stats.validVotes).toBe(67000);
		expect(stats.invalidVotes).toBe(300);
	});

	it("ignores votes for parties outside the tracked set", () => {
		const withUnknown = {
			C1: { ...data.C1, partyVotes: { LAB: 20000, MONSTER: 5000 } },
		} as any;
		const stats = aggregateGeneralElection(
			features(["C1"]),
			CODE_KEY,
			withUnknown,
		);

		expect(stats.partyVotes).toEqual({ LAB: 20000 });
		expect(stats.totalVotes).toBe(20000);
		// The seat still goes to whoever polled highest, tracked or not.
		expect(stats.partySeats).toEqual({ LAB: 1 });
	});
});

describe("aggregateBrexit", () => {
	const data = {
		E1: { leave: 6000, remain: 4000, validVotes: 10000, electorate: 12000 },
		E2: { leave: 4000, remain: 6000, validVotes: 10000, electorate: 13000 },
	} as any;

	it("takes the leave share from the pooled votes", () => {
		expect(aggregateBrexit(features(["E1", "E2"]), CODE_KEY, data)).toEqual(
			{
				totalLeave: 10000,
				totalRemain: 10000,
				totalVotes: 20000,
				electorate: 25000,
				pctLeave: 50,
				pctRemain: 50,
			},
		);
	});

	it("reports zero shares when no covered area voted", () => {
		const result = aggregateBrexit(features(["missing"]), CODE_KEY, data);
		expect(result.pctLeave).toBe(0);
		expect(result.pctRemain).toBe(0);
	});
});

describe("aggregateBrexitConstituencies", () => {
	const data = { C1: { pctLeave: 40 }, C2: { pctLeave: 60 } } as any;

	it("averages the estimated leave share across constituencies", () => {
		const result = aggregateBrexitConstituencies(
			features(["C1", "C2"]),
			CODE_KEY,
			data,
		);

		expect(result.pctLeave).toBe(50);
		expect(result.pctRemain).toBe(50);
		// Estimates carry no vote counts, so totalVotes is the constituency count.
		expect(result.totalVotes).toBe(2);
		expect(result.electorate).toBe(0);
	});

	it("reports zero shares when no covered constituency has an estimate", () => {
		const result = aggregateBrexitConstituencies(
			features(["missing"]),
			CODE_KEY,
			data,
		);
		expect(result.pctLeave).toBe(0);
		expect(result.pctRemain).toBe(0);
	});
});
