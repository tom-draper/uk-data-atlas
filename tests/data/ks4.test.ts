import { describe, expect, it } from "vitest";
import { endYear, measureSeries, readMeasures } from "@/lib/data/education/ks4";
import type { SchoolPerformanceMeasures } from "@/lib/types/schoolPerformance";

describe("endYear", () => {
	it("uses the final calendar year of an academic-year identifier", () => {
		expect(endYear("202425")).toBe(2025);
	});

	it("rejects malformed and implausible identifiers", () => {
		expect(endYear("unknown")).toBeNull();
		expect(endYear("189900")).toBeNull();
	});
});

describe("readMeasures", () => {
	it("converts blank and suppressed values to null", () => {
		expect(
			readMeasures({
				engmath_94_percent: "68.2",
				engmath_95_percent: "",
				attainment8_average: "SUPP",
				progress8_average: "-0.14",
				pupil_count: "123",
			}),
		).toEqual({
			ptL2basics94: 68.2,
			ptL2basics95: null,
			avgAtt8: null,
			avgP8score: -0.14,
			pupils: 123,
		});
	});
});

describe("measureSeries", () => {
	it("keeps only the shared measures and skips unavailable years", () => {
		const byYear = new Map<
			number,
			Map<string, SchoolPerformanceMeasures & { ladName: string }>
		>([
			[
				2024,
				new Map([
					[
						"E06000001",
						{
							ptL2basics94: 61,
							ptL2basics95: 44,
							avgAtt8: 45.7,
							avgP8score: 0.2,
							pupils: 900,
							ladName: "Hartlepool",
						},
					],
				]),
			],
			[
				2025,
				new Map([
					[
						"E06000001",
						{
							ptL2basics94: 63,
							ptL2basics95: 46,
							avgAtt8: 46.3,
							avgP8score: null,
							pupils: 880,
							ladName: "Hartlepool",
						},
					],
				]),
			],
		]);

		expect(measureSeries(byYear, [2023, 2024, 2025], "E06000001")).toEqual({
			2024: {
				ptL2basics94: 61,
				ptL2basics95: 44,
				avgAtt8: 45.7,
				avgP8score: 0.2,
				pupils: 900,
			},
			2025: {
				ptL2basics94: 63,
				ptL2basics95: 46,
				avgAtt8: 46.3,
				avgP8score: null,
				pupils: 880,
			},
		});
	});
});
