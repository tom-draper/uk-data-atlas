import { describe, expect, it } from "vitest";
import { income, workplaceIncome } from "@uk-data-atlas/datasets";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";

describe("income declaration", () => {
	it("offers the same four pay measures as workplace pay", () => {
		const ids = income.display?.measures.map((measure) => measure.id);
		expect(ids).toEqual([
			"annualMedian",
			"annualMean",
			"hourlyMedian",
			"hourlyMean",
		]);
		expect(ids).toEqual(
			workplaceIncome.display?.measures.map((measure) => measure.id),
		);
	});

	it("starts on annual median pay and is drawn from its declaration", () => {
		expect(DEFAULT_MAP_OPTIONS.income).toMatchObject({
			measure: "annualMedian",
			colorRange: { min: 25_000, max: 45_000 },
		});
		const chart = CHART_DATASET_DEFINITIONS.find(
			(definition) => definition.type === "income",
		);
		expect(chart?.chart.key).toBe("economy-income");
	});
});
