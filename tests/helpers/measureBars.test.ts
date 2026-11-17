import { describe, expect, it } from "vitest";
import { barsView, position, rampColor, scaleOf } from "@/lib/measures/bars";
import { meanSeries, readSeries } from "@/lib/measures/combine";
import type { MeasureValuesPayload } from "@/lib/measures/types";

const payload = (
	areas: string[],
	columns: Array<{ period: string; values: Array<number | null> }>,
): MeasureValuesPayload =>
	({
		measure: {
			id: "life-expectancy",
			valueKind: "mean",
			unit: "years",
			aggregation: {
				kind: "non-aggregatable",
				statistic: "mean",
				note: "",
			},
		},
		areas,
		columns: columns.map((column) => ({
			...column,
			status: column.values.map(() => 0),
		})),
		statuses: ["observed"],
	}) as unknown as MeasureValuesPayload;

const male = payload(
	["A", "B", "C"],
	[{ period: "2024", values: [76, 80, 78] }],
);
const female = payload(
	["A", "B", "C"],
	[{ period: "2024", values: [80, 84, 82] }],
);
const bars = [
	{ code: "male", label: "M" },
	{ code: "female", label: "F" },
];

describe("meanSeries", () => {
	it("is the plain mean over areas with a value, per period", () => {
		expect(
			meanSeries(
				payload(
					["A", "B", "C"],
					[
						{ period: "2023", values: [2, 4, null] },
						{ period: "2024", values: [null, null, null] },
					],
				),
			),
		).toEqual([
			{ period: "2023", value: 3 },
			{ period: "2024", value: null },
		]);
	});

	it("is what no area combines to when a mean is declared", () => {
		expect(readSeries(male, null, "mean")).toEqual([
			{ period: "2024", value: 78 },
		]);
		expect(readSeries(male, "B", "mean")).toEqual([
			{ period: "2024", value: 80 },
		]);
	});
});

describe("scaleOf", () => {
	it("runs from the lowest to the highest value over every member", () => {
		expect(scaleOf([male, female])).toEqual({ min: 76, max: 84 });
	});

	it("follows the areas in the payload, so a narrower scope narrows it", () => {
		const some = payload(["A"], [{ period: "2024", values: [76] }]);
		const other = payload(["A"], [{ period: "2024", values: [80] }]);
		expect(scaleOf([some, other])).toEqual({ min: 76, max: 80 });
	});

	it("reads each member's latest period with a value", () => {
		const aged = payload(
			["A", "B"],
			[
				{ period: "2023", values: [1, 99] },
				{ period: "2024", values: [70, 72] },
				{ period: "2025", values: [null, null] },
			],
		);
		expect(scaleOf([aged])).toEqual({ min: 70, max: 72 });
	});

	it("is null when nothing has a value", () => {
		expect(
			scaleOf([payload(["A"], [{ period: "2024", values: [null] }])]),
		).toBeNull();
	});
});

describe("position", () => {
	it("places a value between the ends and holds it inside", () => {
		expect(position(80, { min: 76, max: 84 })).toBe(50);
		expect(position(70, { min: 76, max: 84 })).toBe(0);
		expect(position(90, { min: 76, max: 84 })).toBe(100);
		expect(position(5, { min: 5, max: 5 })).toBe(50);
	});
});

describe("barsView", () => {
	const config = { bars, combine: "mean" as const };
	const payloads = { male, female };

	it("shows the mean over the areas in scope before one is chosen", () => {
		const view = barsView(payloads, null, config)!;
		expect(view.bars.map((bar) => bar.value)).toEqual([78, 82]);
		expect(view.bars.map((bar) => bar.label)).toEqual(["M", "F"]);
		expect(view.scale).toEqual({ min: 76, max: 84 });
		expect(view.bars.map((bar) => bar.pct)).toEqual([25, 75]);
		expect(view.meanPct).toBe(50);
		expect(view.period).toBe("2024");
	});

	it("shows one area's values, on the same scale as the scope", () => {
		const view = barsView(payloads, "A", config)!;
		expect(view.bars.map((bar) => bar.value)).toEqual([76, 80]);
		expect(view.bars.map((bar) => bar.pct)).toEqual([0, 50]);
	});

	it("is null for an area the payloads do not hold, or a missing member", () => {
		expect(barsView(payloads, "Z", config)).toBeNull();
		expect(barsView({ male }, null, config)).toBeNull();
	});
});

describe("rampColor", () => {
	const ramp = { low: "#000000", high: "#ffffff" };
	it("runs along the ramp", () => {
		expect(rampColor(ramp, 0).hex).toBe("#000000");
		expect(rampColor(ramp, 100).hex).toBe("#ffffff");
		expect(rampColor(ramp, 50)).toMatchObject({ r: 128, g: 128, b: 128 });
	});
});
