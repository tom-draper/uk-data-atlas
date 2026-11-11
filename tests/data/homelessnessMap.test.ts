import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type { HomelessnessDataset } from "@uk-data-atlas/datasets";

const dataset: HomelessnessDataset = {
	id: "homelessness2026q1",
	type: "homelessness",
	year: 2026,
	quarter: "Jan-Mar 2026",
	boundaryType: "localAuthority",
	boundaryYear: 2025,
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			householdsInTemporaryAccommodation: 500,
			householdsPerThousand: 8,
			householdsWithChildren: 250,
			childrenInTemporaryAccommodation: 400,
		},
	},
};

const homelessnessDefinition = CHART_DATASET_DEFINITIONS.find(
	({ type }) => type === "homelessness",
)!;

describe("homelessness map metric", () => {
	it("uses the selected rate or count", () => {
		const valueFor = homelessnessDefinition.map?.valueFor;
		expect(valueFor?.(dataset as never, "E1", DEFAULT_MAP_OPTIONS)).toBe(8);
		expect(
			valueFor?.(dataset as never, "E1", {
				...DEFAULT_MAP_OPTIONS,
				homelessness: {
					...DEFAULT_MAP_OPTIONS.homelessness,
					measure: "count",
				},
			}),
		).toBe(500);
	});
});
