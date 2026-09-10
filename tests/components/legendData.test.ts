import { describe, expect, it } from "vitest";
import {
	ethnicityLegendItems,
	partyLegendItems,
} from "@/components/legend/legendData";

describe("legend data selectors", () => {
	it("sorts active-election parties by their aggregated vote totals", () => {
		const parties = partyLegendItems(
			{ type: "localElection", year: 2024 } as any,
			{
				localElection: {
					2024: { partyVotes: { LAB: 12, CON: 30, GRN: 0 } },
				},
			},
		);

		expect(parties.map(({ id }) => id)).toEqual(["CON", "LAB"]);
	});

	it("combines and sorts ethnicity totals across local authorities", () => {
		const ethnicities = ethnicityLegendItems(
			{ type: "ethnicity", year: 2021 } as any,
			{
				ethnicity: {
					2021: {
						E1: {
							White: { population: 20 },
							Asian: { population: 10 },
						},
						E2: {
							White: { population: 5 },
							Asian: { population: 30 },
						},
					},
				},
			},
		);

		expect(ethnicities.map(({ id }) => id)).toEqual(["Asian", "White"]);
	});

	it("returns no category legend for an unrelated dataset", () => {
		expect(
			partyLegendItems({ type: "housePrice", year: 2024 } as any, {}),
		).toEqual([]);
		expect(
			ethnicityLegendItems({ type: "housePrice", year: 2024 } as any, {}),
		).toEqual([]);
	});
});
