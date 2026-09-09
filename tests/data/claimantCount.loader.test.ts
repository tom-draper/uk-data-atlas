import { describe, expect, it } from "vitest";
import {
	addMergedClaimantAuthorities,
	CLAIMANT_COUNT_LAD_PREDECESSORS,
} from "@/lib/data/claimant-count/loader";
import type { ClaimantCountLADData } from "@/lib/types/claimantCount";

describe("addMergedClaimantAuthorities", () => {
	const sourceRecords = () =>
		Object.fromEntries(
			Object.values(CLAIMANT_COUNT_LAD_PREDECESSORS)
				.flatMap(({ predecessors }) => predecessors)
				.map((code, index) => [
					code,
					{
						ladCode: code,
						ladName: code,
						totalCount: (index + 1) * 100,
						totalRate: 1,
						youthCount: (index + 1) * 10,
						youthRate: 0.1,
					},
				]),
		) as Record<string, ClaimantCountLADData>;
	const population = () =>
		Object.fromEntries(
			Object.entries(CLAIMANT_COUNT_LAD_PREDECESSORS).map(
				([target, { predecessors }]) => [
					target,
					predecessors.length * 10_000,
				],
			),
		) as Record<string, number>;

	it("sums abolished districts and derives the replacement authority rate", () => {
		const records = sourceRecords();

		addMergedClaimantAuthorities(records, population());

		const somerset = records.E06000066;
		expect(somerset).toMatchObject({
			ladName: "Somerset",
			totalCount: 6_200,
			youthCount: 620,
			totalRate: 15.5,
			youthRate: 1.55,
		});
	});

	it("does not replace a record supplied for the current authority", () => {
		const records = sourceRecords();
		records.E06000063 = {
			ladCode: "E06000063",
			ladName: "Native Cumberland",
			totalCount: 99,
			totalRate: 1,
			youthCount: 9,
			youthRate: 0.1,
		};

		addMergedClaimantAuthorities(records, population());

		expect(records.E06000063.ladName).toBe("Native Cumberland");
	});
});
