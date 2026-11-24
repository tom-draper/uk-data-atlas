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

	it("names the counts a rate combines areas by, and none for a count", () => {
		const rate = definition.chart?.seriesForOptions?.(withMeasure("rate"));
		const count = definition.chart?.seriesForOptions?.(
			withMeasure("count"),
		);
		expect(rate?.countMeasure).toBe("unemployed-people");
		expect(count?.countMeasure).toBeUndefined();
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

const seriesOf = (type: string, measure: string) =>
	CHART_DATASET_DEFINITIONS.find(
		(candidate) => candidate.type === type,
	)!.chart?.seriesForOptions?.({
		...DEFAULT_MAP_OPTIONS,
		[type]: {
			...(DEFAULT_MAP_OPTIONS as Record<string, object>)[type],
			measure,
		},
	} as MapOptions);

describe("the claimant count history card", () => {
	it("reads the monthly history, not the single month the map shows", () => {
		expect(seriesOf("claimant-count", "rate")?.request).toEqual({
			measure: "claimant-rate",
			datasetId: "claimant-count-history",
			geography: "localAuthority",
			boundaryYear: 2023,
		});
		expect(seriesOf("claimant-count", "count")?.request).toEqual({
			measure: "claimants",
			datasetId: "claimant-count-history",
			geography: "localAuthority",
			boundaryYear: 2023,
			dimensions: { "age-group": ["16-plus"] },
		});
	});

	it("combines the rate over areas by the claimants it counts", () => {
		const rate = seriesOf("claimant-count", "rate");
		expect(rate?.countMeasure).toBe("claimants");
		expect(rate?.countDimensions).toEqual({ "age-group": ["16-plus"] });
		expect(
			seriesOf("claimant-count", "count")?.countMeasure,
		).toBeUndefined();
		expect(rate?.period).toBe("2013-2026");
		// The history is a dataset of its own, on one release.
		expect(rate?.earlier).toBeUndefined();
	});
});

describe("the pay history cards", () => {
	it.each([
		["income", "residence"],
		["workplace-income", "workplace"],
	])("read %s pay by the statistic and period chosen", (type, place) => {
		expect(seriesOf(type, "hourlyMean")?.request).toEqual({
			measure: "gross-hourly-pay",
			datasetId: type,
			geography: "localAuthority",
			boundaryYear: 2025,
			dimensions: {
				"pay-statistic": ["mean"],
				"earnings-place": [place],
			},
		});
		expect(seriesOf(type, "annualMedian")?.request).toMatchObject({
			measure: "gross-annual-pay",
			dimensions: { "pay-statistic": ["median"] },
		});
	});

	it("averages authorities, marks the SOC 2020 break and keeps the survey's caveats", () => {
		const series = seriesOf("income", "annualMedian");
		expect(series?.combine).toBe("mean");
		expect(series?.countMeasure).toBeUndefined();
		// Codes changed before 2025 are held on the earlier releases.
		expect(series?.earlier).toEqual([2020, 2019, 2016]);
		expect(series?.breaks?.map((at) => at.period)).toEqual(["2021"]);
		expect(series?.source).toContain("SOC 2020");
		expect(series?.source).toContain("furloughed");
		expect(series?.source).toContain("provisional");
	});
});
