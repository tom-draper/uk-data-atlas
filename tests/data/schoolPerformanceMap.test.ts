import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { schoolPerformanceDefinition } from "@/lib/datasets/schoolPerformance";
import type { SchoolPerformanceDataset } from "@/lib/types/schoolPerformance";

const dataset: SchoolPerformanceDataset = {
	id: "schoolPerformance2025",
	type: "schoolPerformance",
	year: 2025,
	boundaryType: "localAuthority",
	boundaryYear: 2024,
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			ptL2basics94: 65,
			ptL2basics95: 45,
			avgAtt8: 48,
			avgP8score: 0.2,
			pupils: 100,
			series: {},
		},
	},
};

describe("school performance map metric", () => {
	it("uses the selected GCSE measure", () => {
		const valueFor = schoolPerformanceDefinition.map?.valueFor;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(65);
		for (const [measure, expected] of [
			["grade5", 45],
			["attainment8", 48],
			["progress8", 0.2],
		] as const) {
			expect(
				valueFor?.(dataset, "E1", {
					...DEFAULT_MAP_OPTIONS,
					schoolPerformance: {
						...DEFAULT_MAP_OPTIONS.schoolPerformance,
						measure,
					},
				}),
			).toBe(expected);
		}
	});
});
