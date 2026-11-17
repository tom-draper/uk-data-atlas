import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	MeasureSeriesCard,
	seriesView,
} from "@/components/measures/MeasureSeriesCard";
import { MAX_PERIODS } from "@/lib/measures/request";
import type { MeasureValuesPayload } from "@/lib/measures/types";
import { historyPeriods } from "@/lib/measures/useMeasureSeries";

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

describe("historyPeriods", () => {
	it("keeps the newest periods when a source holds more than a request may name", () => {
		const periods = Array.from({ length: MAX_PERIODS + 5 }, (_, i) =>
			String(1900 + i),
		);
		const kept = historyPeriods(periods);
		expect(kept).toHaveLength(MAX_PERIODS);
		expect(kept.at(-1)).toBe(periods.at(-1));
		expect(kept[0]).toBe(periods[5]);
	});
});

describe("MeasureSeriesCard", () => {
	it("asks for an area before it has one", () => {
		const html = renderToStaticMarkup(
			createElement(MeasureSeriesCard, {
				request: { measure: "unemployment-rate" },
				area: null,
				heading: "Unemployment",
				accent: "#1e40af",
				color: "#3b82f6",
				isActive: false,
				onClick: () => {},
			}),
		);
		expect(html).toContain("Unemployment");
		expect(html).toContain("Select an area");
	});
});
