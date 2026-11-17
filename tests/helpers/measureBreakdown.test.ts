import { describe, expect, it } from "vitest";
import { breakdownView, memberLabels } from "@/lib/measures/breakdown";
import type { MeasureValuesPayload } from "@/lib/measures/types";

const payload = (
	values: Array<number | null>,
	period = "2021",
): MeasureValuesPayload =>
	({
		measure: {
			id: "m",
			label: "M",
			valueKind: "count",
			unit: "people",
			dimensions: [
				{
					id: "method",
					label: "Method",
					total: "total",
					members: [
						{ code: "total", label: "Everyone" },
						{ code: "car", label: "Car or van" },
						{ code: "bike", label: "Bicycle" },
					],
				},
			],
		},
		source: { periods: [period] },
		statuses: ["observed"],
		periods: [period],
		areas: ["E1"],
		columns: [{ period, values, status: values.map(() => 0) }],
	}) as unknown as MeasureValuesPayload;

const parts = [
	{ code: "car", color: "#f00" },
	{ code: "bike", color: "#0f0", label: "Cycle" },
];

describe("breakdownView", () => {
	it("splits the total into shares, named by the measure's metadata", () => {
		const view = breakdownView(
			{
				total: payload([200]),
				car: payload([150]),
				bike: payload([50]),
			},
			"E1",
			"method",
			"total",
			parts,
		)!;
		expect(view.period).toBe("2021");
		expect(view.total).toBe(200);
		expect(view.shares).toEqual([
			{
				key: "car",
				label: "Car or van",
				color: "#f00",
				count: 150,
				pct: 75,
			},
			{
				key: "bike",
				label: "Cycle",
				color: "#0f0",
				count: 50,
				pct: 25,
			},
		]);
	});

	it("takes the total as the sum of the parts when none is declared", () => {
		const view = breakdownView(
			{ car: payload([30]), bike: payload([10]) },
			"E1",
			"method",
			undefined,
			parts,
		)!;
		expect(view.total).toBe(40);
		expect(view.period).toBe("2021");
		expect(view.shares.map((share) => share.pct)).toEqual([75, 25]);
	});

	it("draws the largest part first when asked", () => {
		const view = breakdownView(
			{ car: payload([10]), bike: payload([30]) },
			"E1",
			"method",
			undefined,
			parts,
			{ order: "largest" },
		)!;
		expect(view.shares.map((share) => share.key)).toEqual(["bike", "car"]);
	});

	it("shares what is left once parts are filtered out", () => {
		const view = breakdownView(
			{ car: payload([30]), bike: payload([10]) },
			"E1",
			"method",
			undefined,
			parts,
			{ includes: (label) => label !== "Car or van" },
		)!;
		expect(view.shares.map((share) => [share.key, share.pct])).toEqual([
			["bike", 100],
		]);
		expect(
			breakdownView(
				{ car: payload([30]), bike: payload([10]) },
				"E1",
				"method",
				undefined,
				parts,
				{ includes: () => false },
			),
		).toBeNull();
	});

	it("shows nothing when the total is zero or missing", () => {
		const others = { car: payload([1]), bike: payload([1]) };
		expect(
			breakdownView(
				{ ...others, total: payload([0]) },
				"E1",
				"method",
				"total",
				parts,
			),
		).toBeNull();
		expect(
			breakdownView(
				{ ...others, total: payload([null]) },
				"E1",
				"method",
				"total",
				parts,
			),
		).toBeNull();
	});

	it("shows nothing when a part has no value or the area is absent", () => {
		const base = { total: payload([10]), car: payload([5]) };
		expect(
			breakdownView(
				{ ...base, bike: payload([null]) },
				"E1",
				"method",
				"total",
				parts,
			),
		).toBeNull();
		expect(
			breakdownView(
				{ ...base, bike: payload([5]) },
				"E2",
				"method",
				"total",
				parts,
			),
		).toBeNull();
	});
});

describe("memberLabels", () => {
	it("maps member codes to labels", () => {
		expect(memberLabels(payload([1]), "method").get("car")).toBe(
			"Car or van",
		);
		expect(memberLabels(payload([1]), "other").size).toBe(0);
	});
});
