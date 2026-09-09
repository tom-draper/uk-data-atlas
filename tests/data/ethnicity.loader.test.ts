import { describe, expect, it } from "vitest";
import {
	addMergedEthnicityAuthorities,
	ETHNICITY_LAD_PREDECESSORS,
} from "@/lib/data/ethnicity/loader";

describe("addMergedEthnicityAuthorities", () => {
	const sourceData = () =>
		Object.fromEntries(
			Object.values(ETHNICITY_LAD_PREDECESSORS)
				.flat()
				.map((code, index) => [
					code,
					{
						White: {
							British: {
								ethnicity: "British",
								code: "13",
								population: index + 1,
							},
						},
					},
				]),
		) as Record<string, any>;

	it("sums each category into every 2023 unitary authority", () => {
		const data = sourceData();

		addMergedEthnicityAuthorities(data);

		for (const [target, predecessors] of Object.entries(
			ETHNICITY_LAD_PREDECESSORS,
		)) {
			const expected = predecessors.reduce(
				(sum, predecessor) =>
					sum + data[predecessor].White.British.population,
				0,
			);
			expect(data[target].White.British.population).toBe(expected);
		}
	});

	it("does not replace a record published under the current authority code", () => {
		const data = sourceData();
		data.E06000063 = {
			White: {
				British: { ethnicity: "British", code: "13", population: 99 },
			},
		};

		addMergedEthnicityAuthorities(data);

		expect(data.E06000063.White.British.population).toBe(99);
	});
});
