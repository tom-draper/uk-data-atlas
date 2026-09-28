import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { excludedCategoriesForMapOptions } from "@/components/ui-overlay/excludedCategories";

describe("excludedCategoriesForMapOptions", () => {
	it("derives selected and excluded legend categories from map options", () => {
		const categories = excludedCategoriesForMapOptions({
			...DEFAULT_MAP_OPTIONS,
			generalElection: {
				...DEFAULT_MAP_OPTIONS.generalElection,
				mode: "percentage",
				selected: "labour",
				excluded: ["conservative"],
			},
			ethnicity: {
				...DEFAULT_MAP_OPTIONS.ethnicity,
				mode: "percentage",
				selected: "asian",
				excluded: ["white"],
			},
			custom: {
				...DEFAULT_MAP_OPTIONS.custom,
				selectedPointValue: 10,
				excludedPointValues: [20],
			},
		});

		expect(categories.selectedGeneralParty).toBe("labour");
		expect(categories.excludedGeneralParties).toEqual(
			new Set(["conservative"]),
		);
		expect(categories.selectedEthnicity).toBe("asian");
		expect(categories.excludedEthnicities).toEqual(new Set(["white"]));
		expect(categories.selectedPointValue).toBe(10);
		expect(categories.excludedPointValues).toEqual(new Set([20]));
	});

	it("does not expose a selected category in majority mode", () => {
		const categories = excludedCategoriesForMapOptions({
			...DEFAULT_MAP_OPTIONS,
			localElection: {
				...DEFAULT_MAP_OPTIONS.localElection,
				mode: "majority",
				selected: "labour",
			},
		});

		expect(categories.selectedLocalParty).toBeUndefined();
	});
});
