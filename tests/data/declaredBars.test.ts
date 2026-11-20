import { describe, expect, it } from "vitest";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";

const chart = CHART_DATASET_DEFINITIONS.find(
	(candidate) => candidate.type === "life-expectancy",
)!.chart!;

describe("the life expectancy card", () => {
	it("draws the generic bars chart, not a dataset's own", () => {
		expect(chart.componentPath).toBe(
			"@/components/measures/MeasureBarsChart",
		);
	});

	it("reads life expectancy or healthy life expectancy by the dataset in use", () => {
		expect(chart.bars?.measures).toEqual({
			le: "life-expectancy",
			hle: "healthy-life-expectancy",
		});
		expect(chart.bars?.views).toEqual({ hle: "healthy-life-expectancy" });
	});

	it("reads the declared release, one bar a sex, averaging areas as it always has", () => {
		expect(chart.bars?.request).toEqual({
			datasetId: "life-expectancy-series",
			geography: "localAuthority",
			boundaryYear: 2025,
		});
		expect(chart.bars?.dimension).toBe("sex");
		expect(chart.bars?.bars.map((bar) => bar.code)).toEqual([
			"male",
			"female",
		]);
		expect(chart.bars?.combine).toBe("mean");
	});
});
