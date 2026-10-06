import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { unemploymentDefinition } from "@/lib/datasets/unemployment";
import type { UnemploymentDataset } from "@/lib/types/unemployment";

const dataset: UnemploymentDataset = {
	id: "unemployment",
	type: "unemployment",
	year: 2021,
	boundaryType: "localAuthority",
	boundaryYear: 2024,
	years: [2021],
	latestYear: 2021,
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			rates: { 2021: 4.5 },
			levels: { 2021: 2250 },
		},
	},
};

describe("unemployment map metric", () => {
	it("uses the selected rate or count", () => {
		const valueFor = unemploymentDefinition.map?.valueFor;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(4.5);
		expect(
			valueFor?.(dataset, "E1", {
				...DEFAULT_MAP_OPTIONS,
				unemployment: {
					...DEFAULT_MAP_OPTIONS.unemployment,
					measure: "count",
				},
			}),
		).toBe(2250);
	});
});
