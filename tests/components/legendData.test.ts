import { describe, expect, it } from "vitest";
import {
	categoryLegendItems,
	partyLegendItems,
} from "@/components/legend/legendData";

describe("legend data selectors", () => {
	it("sorts active-election parties by their aggregated vote totals", () => {
		const parties = partyLegendItems(
			{ type: "local-election", year: 2024 } as any,
			{
				"local-election": {
					2024: {
						partyVotes: { LAB: 12, CON: 30, OTHER: 5, GRN: 0 },
					},
				},
			},
		);

		expect(parties.map(({ id }: { id: string }) => id)).toEqual([
			"CON",
			"LAB",
			"OTHER",
		]);
		expect(parties.at(-1)?.name).toBe("Other");
	});

	it("lists the groups with people in them, in the order given", () => {
		const shares = [
			["asian", "Asian", 40],
			["white", "White", 25],
			["other", "Other", 0],
		].map(([key, label, count]) => ({
			key: key as string,
			label: label as string,
			color: `#${key}`,
			count: count as number,
			pct: 0,
		}));
		expect(
			categoryLegendItems({ period: "2021", total: 65, shares }),
		).toEqual([
			{ id: "Asian", color: "#asian", name: "Asian" },
			{ id: "White", color: "#white", name: "White" },
		]);
	});

	it("has no category legend until there is a breakdown", () => {
		expect(categoryLegendItems(null)).toEqual([]);
	});

	it("returns no party legend for an unrelated dataset", () => {
		expect(
			partyLegendItems({ type: "housePrice", year: 2024 } as any, {}),
		).toEqual([]);
	});
});
