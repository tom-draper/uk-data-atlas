import { describe, expect, it } from "vitest";
import { ratioSeries, readSeries, summedSeries } from "@/lib/measures/combine";
import { areaCodesInScope, requestAreas } from "@/lib/measures/scope";
import { MAX_AREAS } from "@/lib/measures/request";
import type { MeasureValuesPayload } from "@/lib/measures/types";

const payload = (
	areas: string[],
	columns: Array<{ period: string; values: Array<number | null> }>,
	aggregation: Record<string, unknown> = {
		kind: "extensive",
		available: true,
	},
): MeasureValuesPayload =>
	({
		measure: { id: "m", valueKind: "count", unit: "people", aggregation },
		areas,
		columns: columns.map((column) => ({
			...column,
			status: column.values.map(() => 0),
		})),
		statuses: ["observed"],
	}) as unknown as MeasureValuesPayload;

describe("summedSeries", () => {
	it("adds each period over every area, skipping areas with no value", () => {
		const sums = summedSeries(
			payload(
				["A", "B", "C"],
				[
					{ period: "2020", values: [1, 2, null] },
					{ period: "2021", values: [null, null, null] },
				],
			),
		);
		expect(sums).toEqual([
			{ period: "2020", value: 3 },
			{ period: "2021", value: null },
		]);
	});

	it("offers nothing for a measure that does not add up", () => {
		const rate = payload(["A"], [{ period: "2020", values: [5] }], {
			kind: "non-aggregatable",
			statistic: "median",
			note: "",
		});
		expect(summedSeries(rate)).toEqual([]);
		expect(readSeries(rate, null)).toEqual([]);
	});
});

describe("readSeries", () => {
	const both = payload(["A", "B"], [{ period: "2020", values: [1, 2] }]);

	it("reads one area when given one and the whole scope when not", () => {
		expect(readSeries(both, "B")).toEqual([{ period: "2020", value: 2 }]);
		expect(readSeries(both, null)).toEqual([{ period: "2020", value: 3 }]);
		expect(readSeries(both, "Z")).toEqual([]);
	});
});

describe("ratioSeries", () => {
	it("weights a rate by the base its count implies", () => {
		// A: 10 of 100 (10%), B: 30 of 100 (30%), so 40 of 200 is 20%
		const rates = payload(
			["A", "B"],
			[{ period: "2020", values: [10, 30] }],
		);
		const counts = payload(
			["A", "B"],
			[{ period: "2020", values: [10, 30] }],
		);
		expect(ratioSeries(rates, counts)).toEqual([
			{ period: "2020", value: 20 },
		]);
		// Unequal bases: A 5 of 100 (5%), B 30 of 300 (10%) gives 35 of 400
		const unequal = ratioSeries(
			payload(["A", "B"], [{ period: "2020", values: [5, 10] }]),
			payload(["A", "B"], [{ period: "2020", values: [5, 30] }]),
		);
		expect(unequal[0]!.value).toBeCloseTo(8.75, 10);
	});

	it("leaves out areas missing a count or with a rate of nothing", () => {
		const out = ratioSeries(
			payload(["A", "B", "C"], [{ period: "2020", values: [10, 0, 20] }]),
			payload(["A", "B"], [{ period: "2020", values: [10, 5] }]),
		);
		expect(out).toEqual([{ period: "2020", value: 10 }]);
	});

	it("is empty for a period with no counts", () => {
		expect(
			ratioSeries(
				payload(["A"], [{ period: "2020", values: [10] }]),
				payload(["A"], [{ period: "2019", values: [10] }]),
			),
		).toEqual([{ period: "2020", value: null }]);
	});
});

describe("areaCodesInScope", () => {
	const boundaryData = {
		localAuthority: {
			2024: {
				features: [
					{ properties: { LAD24CD: "E1" } },
					{ properties: { LAD24CD: "E2" } },
					{ properties: { LAD24CD: "E1" } },
					{ properties: {} },
				],
			},
		},
	} as never;

	it("lists each code the loaded boundaries hold, once", () => {
		expect(areaCodesInScope(boundaryData, "localAuthority", 2024)).toEqual([
			"E1",
			"E2",
		]);
	});

	it("is null until the boundaries load", () => {
		expect(
			areaCodesInScope(boundaryData, "localAuthority", 2023),
		).toBeNull();
		expect(areaCodesInScope(boundaryData, "region", 2024)).toBeNull();
	});
});

describe("requestAreas", () => {
	it("lists the codes, or reads the whole geography when there are too many", () => {
		expect(requestAreas(["A", "B"])).toEqual(["A", "B"]);
		expect(
			requestAreas(
				Array.from({ length: MAX_AREAS + 1 }, (_, i) => `E${i}`),
			),
		).toBeUndefined();
	});
});
