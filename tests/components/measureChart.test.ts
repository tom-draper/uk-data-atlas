import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MeasureChart } from "@/components/measures/MeasureChart";
import {
	NO_DATA_COLOR,
	SEQUENTIAL_COLORS,
	buildScale,
	categoryCounts,
	chartKindFor,
	formatMeasureValue,
	histogram,
	legendEntries,
	topAreas,
} from "@/lib/measures/presentation";
import type { MeasureValuesPayload } from "@/lib/measures/types";

const payload = (
	valueKind: MeasureValuesPayload["measure"]["valueKind"],
	unit: string,
	columns: MeasureValuesPayload["columns"],
	areas = ["E1", "E2", "E3"],
): MeasureValuesPayload =>
	({
		measure: { id: "m", label: "M", valueKind, unit, dimensions: [] },
		series: { id: "m", dimensions: {} },
		source: {
			datasetId: "d",
			geography: "localAuthority",
			boundaryYear: 2023,
			periods: columns.map((column) => column.period),
		},
		statuses: ["observed", "derived", "aggregated", "partial", "missing"],
		periods: columns.map((column) => column.period),
		areas,
		columns,
		extent: null,
		contentHash: "x",
	}) as unknown as MeasureValuesPayload;

describe("measure scale", () => {
	it("makes equal-count classes for a skewed amount", () => {
		const scale = buildScale("count", [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000])!;
		expect(scale.colors).toEqual([...SEQUENTIAL_COLORS]);
		[2.8, 4.6, 6.4, 8.2].forEach((expected, index) =>
			expect(scale.breaks[index]).toBeCloseTo(expected, 10),
		);
		expect(scale.breaks).toHaveLength(4);
		expect(scale.colorFor(1)).toBe(SEQUENTIAL_COLORS[0]);
		expect(scale.colorFor(1000)).toBe(SEQUENTIAL_COLORS[4]);
		expect(scale.colorFor(null)).toBe(NO_DATA_COLOR);
	});

	it("makes equal-width classes for a rank", () => {
		const scale = buildScale("ordinal", [1, 100])!;
		[20.8, 40.6, 60.4, 80.2].forEach((expected, index) =>
			expect(scale.breaks[index]).toBeCloseTo(expected, 10),
		);
	});

	it("drops classes that would be empty and handles no values", () => {
		const flat = buildScale("count", [5, 5, 5, 5])!;
		expect(flat.colors).toHaveLength(2);
		expect(flat.colorFor(5)).toBe(flat.colors[1]);
		expect(buildScale("count", [])).toBeNull();
	});

	it("labels each class with the formatted bounds", () => {
		const scale = buildScale("ordinal", [0, 10])!;
		expect(legendEntries(scale, (value) => String(value))[0]).toEqual({
			color: SEQUENTIAL_COLORS[0],
			label: "0 to 2",
		});
	});
});

describe("measure values as text", () => {
	it("formats by value kind and unit", () => {
		expect(formatMeasureValue("count", "people", 1234567)).toBe(
			"1,234,567",
		);
		expect(formatMeasureValue("ratio", "% of premises", 87.25)).toBe(
			"87.3%",
		);
		expect(formatMeasureValue("ratio", "percent", 4)).toBe("4%");
		expect(formatMeasureValue("currency", "gbp", 250000)).toBe("£250,000");
		expect(formatMeasureValue("quantity", "years", 41.56)).toBe("41.6");
		expect(formatMeasureValue("ordinal", "rank", 12)).toBe("12");
		expect(formatMeasureValue("count", "people", null)).toBe("No data");
	});
});

describe("chart helpers", () => {
	it("picks a chart by value kind", () => {
		expect(chartKindFor("count")).toBe("ranked-bars");
		expect(chartKindFor("ratio")).toBe("ranked-bars");
		expect(chartKindFor("ordinal")).toBe("histogram");
		expect(chartKindFor("categorical")).toBe("categories");
	});

	it("ranks the highest areas and skips missing values", () => {
		expect(
			topAreas(
				[
					{ code: "A", value: 1 },
					{ code: "B", value: null },
					{ code: "C", value: 3 },
					{ code: "D", value: 3 },
				],
				2,
			),
		).toEqual([
			{ code: "C", value: 3 },
			{ code: "D", value: 3 },
		]);
	});

	it("bins values and counts categories", () => {
		const bins = histogram([0, 1, 2, 3, 4, 10], 2);
		expect(bins.map((bin) => bin.count)).toEqual([5, 1]);
		expect(categoryCounts(["a", "b", "a", null])).toEqual([
			{ category: "a", count: 2 },
			{ category: "b", count: 1 },
		]);
	});
});

describe("MeasureChart", () => {
	const render = (props: Parameters<typeof MeasureChart>[0]) =>
		renderToStaticMarkup(createElement(MeasureChart, props));

	it("draws ranked bars for an amount, named where names are known", () => {
		const html = render({
			payload: payload("count", "people", [
				{ period: "2023", values: [10, 30, null], status: [0, 0, 4] },
			]),
			period: "2023",
			names: new Map([["E2", "Leeds"]]),
		});
		expect(html).toContain('data-chart="ranked-bars"');
		expect(html.indexOf("Leeds")).toBeLessThan(html.indexOf("E1"));
		expect(html).toContain("30");
		expect(html).not.toContain("E3");
	});

	it("draws a histogram for a rank", () => {
		const html = render({
			payload: payload("ordinal", "rank", [
				{ period: "2023", values: [1, 50, 100], status: [0, 0, 0] },
			]),
			period: "2023",
		});
		expect(html).toContain('data-chart="histogram"');
		expect(html).toContain("<rect");
	});

	it("draws counts for a category", () => {
		const html = render({
			payload: payload("categorical", "", [
				{
					period: "2023",
					categories: ["Lab", "Con", "Lab"],
					status: [0, 0, 0],
				},
			]),
			period: "2023",
		});
		expect(html).toContain('data-chart="categories"');
		expect(html.indexOf("Lab")).toBeLessThan(html.indexOf("Con"));
	});

	it("draws the selected area's history when there are several periods", () => {
		const history = payload(
			"count",
			"people",
			[
				{ period: "2022", values: [100], status: [0] },
				{ period: "2023", values: [110], status: [0] },
			],
			["E1"],
		);
		const html = render({
			payload: payload(
				"count",
				"people",
				[{ period: "2023", values: [110], status: [0] }],
				["E1"],
			),
			period: "2023",
			selected: "E1",
			history,
		});
		expect(html).toContain("<polyline");
		expect(html).toContain("2022: 100");
		expect(html).toContain("2023: 110");
	});

	it("says so when the period is absent", () => {
		const html = render({
			payload: payload("count", "people", [
				{ period: "2023", values: [1, 2, 3], status: [0, 0, 0] },
			]),
			period: "1999",
		});
		expect(html).toContain("No data for 1999");
	});
});
