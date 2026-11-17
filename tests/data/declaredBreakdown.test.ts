import { describe, expect, it } from "vitest";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";

const definition = CHART_DATASET_DEFINITIONS.find(
	(candidate) => candidate.type === "travel-to-work",
)!;

describe("a declared breakdown card", () => {
	it("draws the generic breakdown chart, not a dataset's own", () => {
		expect(definition.chart!.componentPath).toBe(
			"@/components/measures/MeasureBreakdownChart",
		);
	});

	it("reads the measure's dimension at the dataset's own geography", () => {
		const { breakdown } = definition.chart!;
		expect(breakdown?.request).toEqual({
			measure: "people-in-employment",
			datasetId: "travel-to-work",
			geography: "localAuthority",
			boundaryYear: 2025,
		});
		expect(breakdown?.dimension).toBe("travel-method");
		expect(breakdown?.total).toBe("total");
	});

	it("draws the parts in the declared order, led by the accent", () => {
		const { breakdown } = definition.chart!;
		expect(breakdown?.parts.map((part) => part.code)).toEqual([
			"car",
			"home",
			"public-transport",
			"on-foot",
			"bicycle",
			"taxi",
			"motorcycle",
			"other",
		]);
		expect(breakdown?.accent).toBe("car");
		expect(breakdown?.heading).toBe("Travel to Work");
	});
});

describe.each([
	["car-availability", "households", "cars-or-vans", 4],
	["qualification", "usual-residents-16-plus", "highest-qualification", 7],
] as const)("the %s breakdown card", (type, measure, dimension, parts) => {
	const chart = CHART_DATASET_DEFINITIONS.find(
		(candidate) => candidate.type === type,
	)!.chart!;

	it("is drawn by the generic breakdown chart", () => {
		expect(chart.componentPath).toBe(
			"@/components/measures/MeasureBreakdownChart",
		);
	});

	it("reads the declared measure and dimension", () => {
		expect(chart.breakdown?.request.measure).toBe(measure);
		expect(chart.breakdown?.dimension).toBe(dimension);
		expect(chart.breakdown?.parts).toHaveLength(parts);
		expect(
			chart.breakdown?.parts.some(
				(part) => part.code === chart.breakdown?.accent,
			),
		).toBe(true);
	});
});
