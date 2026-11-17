import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";

const definition = CHART_DATASET_DEFINITIONS.find(
	(candidate) => candidate.type === "unemployment",
)!;

const withMeasure = (measure: "rate" | "count") =>
	({
		...DEFAULT_MAP_OPTIONS,
		unemployment: { ...DEFAULT_MAP_OPTIONS.unemployment, measure },
	}) as MapOptions;

describe("a declared history card", () => {
	it("draws the generic series chart, not a dataset's own", () => {
		expect(definition.chart!.componentPath).toBe(
			"@/components/measures/MeasureSeriesChart",
		);
	});

	it("reads the measure for the selected rate or count", () => {
		const rate = definition.chart?.seriesForOptions?.(withMeasure("rate"));
		const count = definition.chart?.seriesForOptions?.(
			withMeasure("count"),
		);
		expect(rate?.request).toEqual({
			measure: "unemployment-rate",
			datasetId: "unemployment",
			geography: "localAuthority",
			boundaryYear: 2024,
		});
		expect(count?.request.measure).toBe("unemployed-people");
	});

	it("takes its wording from the declaration", () => {
		const series = definition.chart?.seriesForOptions?.(
			withMeasure("rate"),
		);
		expect(series?.heading).toBe("Historic Unemployment");
		expect(series?.period).toBe("1996-2021");
		expect(series?.line).toBe("#3b82f6");
	});
});
