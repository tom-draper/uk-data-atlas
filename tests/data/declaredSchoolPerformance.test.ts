import { describe, expect, it } from "vitest";
import { schoolPerformance } from "@uk-data-atlas/datasets";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";

const dataset = {
	id: "school-performance2025",
	type: "school-performance",
	year: 2025,
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
} as never;

const definition = CHART_DATASET_DEFINITIONS.find(
	(candidate) => candidate.type === "school-performance",
)!;

const withMeasure = (measure: string): MapOptions => ({
	...DEFAULT_MAP_OPTIONS,
	"school-performance": {
		...DEFAULT_MAP_OPTIONS["school-performance"],
		measure,
	},
});

describe("school performance declaration", () => {
	it("is a kebab-case education dataset with four measures", () => {
		expect(schoolPerformance.id).toBe("school-performance");
		expect(schoolPerformance.module).toBe("education");
		expect(schoolPerformance.display?.measures.map((m) => m.id)).toEqual([
			"grade4",
			"grade5",
			"attainment8",
			"progress8",
		]);
	});

	it("starts on grade 4 and colours the map by the chosen measure", () => {
		expect(DEFAULT_MAP_OPTIONS["school-performance"]).toMatchObject({
			measure: "grade4",
			colorRange: { min: 50, max: 80 },
		});
		const valueFor = definition.map?.valueFor;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(65);
		for (const [measure, expected] of [
			["grade5", 45],
			["attainment8", 48],
			["progress8", 0.2],
		] as const) {
			expect(valueFor?.(dataset, "E1", withMeasure(measure))).toBe(
				expected,
			);
		}
	});

	it("shows the grade 5 share under the grade 4 headline only", () => {
		const card = (measure: string) =>
			definition.chart.cardForOptions?.(withMeasure(measure));
		expect(card("grade4")?.fromRecord(dataset, "E1")).toEqual({
			value: 65,
			secondary: "45.0% grade 5+",
		});
		expect(card("grade5")?.fromRecord(dataset, "E1")).toEqual({
			value: 45,
		});
	});
});
