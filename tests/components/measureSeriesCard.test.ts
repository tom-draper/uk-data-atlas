import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	breakPositions,
	MeasureSeriesCard,
	seriesView,
} from "@/components/measures/MeasureSeriesCard";
import { SparklineBackground } from "@/components/measures/SparklineBackground";
import type { MeasureValuesPayload } from "@/lib/measures/types";

const payload = (
	valueKind: string,
	unit: string,
	columns: Array<{ period: string; values: Array<number | null> }>,
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
		statuses: ["observed"],
		periods: columns.map((column) => column.period),
		areas: ["E1"],
		columns: columns.map((column) => ({
			...column,
			status: column.values.map(() => 0),
		})),
		extent: null,
		contentHash: "x",
	}) as unknown as MeasureValuesPayload;

describe("seriesView", () => {
	it("reads the latest value by the measure's own kind and unit", () => {
		const view = seriesView(
			payload("ratio", "percent", [
				{ period: "2019", values: [4.1] },
				{ period: "2020", values: [5.26] },
				{ period: "2021", values: [null] },
			]),
			"E1",
		)!;
		expect(view.value).toBe("5.3%");
		expect(view.period).toBe("2020");
		expect(view.line).not.toBeNull();
	});

	it("formats counts and amounts without a dataset-specific rule", () => {
		expect(
			seriesView(
				payload("count", "people", [
					{ period: "2020", values: [1234] },
					{ period: "2021", values: [2345] },
				]),
				"E1",
			)!.value,
		).toBe("2,345");
		expect(
			seriesView(
				payload("currency", "gbp", [
					{ period: "2021", values: [250000] },
				]),
				"E1",
			)!.value,
		).toBe("£250,000");
	});

	it("has no line for a single period, and no view without values", () => {
		const single = seriesView(
			payload("count", "people", [{ period: "2021", values: [3] }]),
			"E1",
		)!;
		expect(single.line).toBeNull();
		expect(
			seriesView(
				payload("count", "people", [
					{ period: "2021", values: [null] },
				]),
				"E1",
			),
		).toBeNull();
		expect(
			seriesView(
				payload("count", "people", [{ period: "2021", values: [3] }]),
				"E9",
			),
		).toBeNull();
	});
});

describe("series breaks", () => {
	it("falls halfway between the last period before a break and the first from it", () => {
		expect(
			breakPositions(
				["2019", "2020", "2021", "2022", "2023"],
				[{ period: "2021" }],
			),
		).toEqual([37.5]);
	});

	it("is not drawn before the line starts, after it ends or on one point", () => {
		const years = ["2019", "2020", "2021"];
		expect(breakPositions(years, [{ period: "2010" }])).toEqual([]);
		expect(breakPositions(years, [{ period: "2030" }])).toEqual([]);
		expect(breakPositions(["2021"], [{ period: "2021" }])).toEqual([]);
	});

	it("falls among the periods that have values, as the line is drawn", () => {
		const view = seriesView(
			payload("currency", "gbp", [
				{ period: "2019", values: [null] },
				{ period: "2020", values: [100] },
				{ period: "2021", values: [110] },
				{ period: "2022", values: [120] },
			]),
			"E1",
			null,
			undefined,
			[{ period: "2021" }],
		)!;
		expect(view.breaks).toEqual([25]);
	});

	it("draws each break as a dashed line across the card", () => {
		const html = renderToStaticMarkup(
			createElement(SparklineBackground, {
				sparkline: {
					linePath: "M 0,0 L 100,100",
					areaPath: "",
					last: { x: 100, y: 100 },
				},
				color: "#000",
				gradientId: "g",
				fade: [],
				strokeWidth: 1,
				breaks: [40],
			}),
		);
		expect(html).toContain('x1="40"');
		expect(html).toContain("stroke-dasharray");
	});
});

describe("seriesView with no area", () => {
	const summable = (
		unit: string,
		columns: Array<{ period: string; values: Array<number | null> }>,
	) => {
		const base = payload("count", unit, columns);
		return {
			...base,
			areas: ["E1", "E2"],
			measure: {
				...base.measure,
				aggregation: { kind: "extensive", available: true },
			},
		} as MeasureValuesPayload;
	};

	it("totals a measure that adds up over the areas in scope", () => {
		const view = seriesView(
			summable("people", [
				{ period: "2020", values: [100, 200] },
				{ period: "2021", values: [150, 250] },
			]),
			null,
		)!;
		expect(view.value).toBe("400");
		expect(view.period).toBe("2021");
		expect(view.line).not.toBeNull();
	});

	it("weights a rate by the base its counts imply", () => {
		const rates = {
			...summable("percent", [{ period: "2021", values: [5, 10] }]),
			measure: {
				id: "r",
				valueKind: "ratio",
				unit: "percent",
				dimensions: [],
				aggregation: { kind: "non-aggregatable" },
			},
		} as unknown as MeasureValuesPayload;
		const counts = summable("people", [
			{ period: "2021", values: [5, 30] },
		]);
		// 35 of a base of 100 + 300 is 8.75%
		expect(seriesView(rates, null, counts)!.value).toBe("8.8%");
	});

	it("averages a measure that cannot be added up when the card says to", () => {
		const base = payload("currency", "gbp", [
			{ period: "2022", values: [200000, 300000] },
			{ period: "2023", values: [250000, 350000] },
		]);
		const prices = {
			...base,
			areas: ["E1", "E2"],
			measure: {
				...base.measure,
				aggregation: { kind: "non-aggregatable" },
			},
		} as unknown as MeasureValuesPayload;
		expect(seriesView(prices, null)).toBeNull();
		const view = seriesView(prices, null, null, "mean")!;
		expect(view.value).toBe("£300,000");
		expect(view.period).toBe("2023");
	});

	it("shows nothing for a rate with no counts to combine by", () => {
		const rates = {
			...summable("percent", [{ period: "2021", values: [5, 10] }]),
			measure: {
				id: "r",
				valueKind: "ratio",
				unit: "percent",
				dimensions: [],
				aggregation: { kind: "non-aggregatable" },
			},
		} as unknown as MeasureValuesPayload;
		expect(seriesView(rates, null)).toBeNull();
	});
});

describe("MeasureSeriesCard", () => {
	const render = (scope: string[] | null) =>
		renderToStaticMarkup(
			createElement(MeasureSeriesCard, {
				request: {
					measure: "unemployment-rate",
					datasetId: "unemployment",
					geography: "localAuthority",
					boundaryYear: 2024,
				},
				scope,
				area: null,
				heading: "Unemployment",
				accent: "#1e40af",
				color: "#3b82f6",
				isActive: false,
				onClick: () => {},
			}),
		);

	it("no longer asks for an area before it draws anything", () => {
		const html = render(["E1"]);
		expect(html).toContain("Unemployment");
		expect(html).not.toContain("Select an area");
	});

	it("waits while the areas in scope are unknown, and says so when none are", () => {
		expect(render(null)).not.toContain("No data available");
		expect(render([])).toContain("No data available");
	});
});
