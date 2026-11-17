import { describe, expect, it } from "vitest";
import {
	addMergedClaimantAuthorities,
	CLAIMANT_COUNT_LAD_PREDECESSORS,
} from "@uk-data-atlas/datasets";
import type { ClaimantFigures } from "@uk-data-atlas/datasets";

describe("addMergedClaimantAuthorities", () => {
	const sourceRecords = () =>
		Object.fromEntries(
			Object.values(CLAIMANT_COUNT_LAD_PREDECESSORS)
				.flatMap(({ predecessors }) => predecessors)
				.map((code, index) => [
					code,
					{
						name: code,
						totalCount: (index + 1) * 100,
						totalRate: 1,
						youthCount: (index + 1) * 10,
					},
				]),
		) as Record<string, ClaimantFigures>;
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
			name: "Somerset",
			totalCount: 6_200,
			youthCount: 620,
			totalRate: 15.5,
		});
	});

	it("does not replace a record supplied for the current authority", () => {
		const records = sourceRecords();
		records.E06000063 = {
			name: "Native Cumberland",
			totalCount: 99,
			totalRate: 1,
			youthCount: 9,
		};

		addMergedClaimantAuthorities(records, population());

		expect(records.E06000063.name).toBe("Native Cumberland");
	});
});
