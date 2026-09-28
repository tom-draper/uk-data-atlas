import { describe, expect, it } from "vitest";
import { APRIL_2023_LAD_MERGERS } from "@/lib/data/localAuthority/reorganisations";
import { addMergedLifeExpectancyAuthorities } from "@/lib/data/life-expectancy/loader";
import { addMergedQualificationAuthorities } from "@/lib/data/qualification/loader";
import {
	addMergedUnemploymentAuthorities,
	normaliseUnemploymentBoundaryCodes,
} from "@/lib/data/unemployment/loader";
import type { LifeExpectancyLADData } from "@/lib/types/lifeExpectancy";
import type { QualificationBreakdown } from "@/lib/types/qualification";
import type { UnemploymentLADData } from "@/lib/types/unemployment";

const predecessors = Object.values(APRIL_2023_LAD_MERGERS).flatMap(
	({ predecessors }) => predecessors,
);

describe("2023 reorganised authority loader records", () => {
	it("uses current Scottish boundary codes for unchanged authorities", () => {
		const data: Record<string, UnemploymentLADData> = {
			S12000024: {
				ladCode: "S12000024",
				ladName: "Perth and Kinross",
				rates: { 2021: 3.1 },
			},
			S12000044: {
				ladCode: "S12000044",
				ladName: "North Lanarkshire",
				rates: { 2021: 4.1 },
			},
		};

		normaliseUnemploymentBoundaryCodes(data);

		expect(data.S12000048).toMatchObject({
			ladCode: "S12000048",
			ladName: "Perth and Kinross",
			rates: { 2021: 3.1 },
		});
		expect(data.S12000050).toMatchObject({
			ladCode: "S12000050",
			ladName: "North Lanarkshire",
			rates: { 2021: 4.1 },
		});
		expect(data.S12000024).toBeUndefined();
		expect(data.S12000044).toBeUndefined();
	});

	it("weights predecessor unemployment rates by economically active residents", () => {
		const data = Object.fromEntries(
			predecessors.map((code, index) => [
				code,
				{
					ladCode: code,
					ladName: code,
					// Every other district is ten times the size of its neighbour.
					rates: { 2020: index % 2 === 0 ? 2 : 10 },
					levels: { 2020: index % 2 === 0 ? 2000 : 1000 },
				},
			]),
		) as Record<string, UnemploymentLADData>;

		addMergedUnemploymentAuthorities(data, [2020]);

		for (const [target, { predecessors: source }] of Object.entries(
			APRIL_2023_LAD_MERGERS,
		)) {
			const unemployed = source.reduce(
				(sum, code) => sum + data[code].levels![2020]!,
				0,
			);
			const active = source.reduce(
				(sum, code) =>
					sum +
					(data[code].levels![2020]! / data[code].rates[2020]!) * 100,
				0,
			);
			expect(data[target].rates[2020]).toBe(
				Number(((unemployed / active) * 100).toFixed(1)),
			);
			expect(data[target].levels![2020]).toBe(unemployed);
			expect(data[target].derivedFromPredecessors).toEqual([...source]);
		}
	});

	it("gives a merged authority no rate for a year a predecessor is unestimated", () => {
		const data = Object.fromEntries(
			predecessors.map((code) => [
				code,
				{
					ladCode: code,
					ladName: code,
					rates: { 2020: 4 },
					levels: { 2020: 100 },
				},
			]),
		) as Record<string, UnemploymentLADData>;
		data.E07000026.rates[2020] = null;

		addMergedUnemploymentAuthorities(data, [2020]);

		expect(data.E06000063.rates[2020]).toBeNull();
		expect(data.E06000064.rates[2020]).toBe(4);
	});

	it("averages predecessor life-expectancy estimates", () => {
		const data = Object.fromEntries(
			predecessors.map((code, index) => [
				code,
				{
					ladCode: code,
					ladName: code,
					maleBirthLE: 70 + index,
					femaleBirthLE: 80 + index,
				},
			]),
		) as Record<string, LifeExpectancyLADData>;

		addMergedLifeExpectancyAuthorities(data);

		for (const [target, { predecessors: source }] of Object.entries(
			APRIL_2023_LAD_MERGERS,
		)) {
			const expectedMale =
				source.reduce((sum, code) => sum + data[code].maleBirthLE, 0) /
				source.length;
			expect(data[target].maleBirthLE).toBe(expectedMale);
			// Marked, so nothing downstream mistakes it for a published estimate.
			expect(data[target].derivedFromPredecessors).toEqual(source);
		}
		for (const code of predecessors)
			expect(data[code]).not.toHaveProperty("derivedFromPredecessors");
	});

	it("sums every qualification category", () => {
		const breakdownFor = (value: number): QualificationBreakdown => ({
			noQualifications: value,
			level1: value,
			level2: value,
			apprenticeship: value,
			level3: value,
			level4Plus: value,
			other: value,
			total: value,
		});
		const data = Object.fromEntries(
			predecessors.map((code, index) => [code, breakdownFor(index + 1)]),
		) as Record<string, QualificationBreakdown>;

		addMergedQualificationAuthorities(data);

		for (const [target, { predecessors: source }] of Object.entries(
			APRIL_2023_LAD_MERGERS,
		)) {
			const expected = source.reduce(
				(sum, code) => sum + data[code].total,
				0,
			);
			expect(data[target].total).toBe(expected);
		}
	});
});
