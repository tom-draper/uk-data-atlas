import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";

const cardOf = (type: string, measure?: string) => {
	const definition = CHART_DATASET_DEFINITIONS.find(
		(candidate) => candidate.type === type,
	)!;
	const options = {
		...DEFAULT_MAP_OPTIONS,
		...(measure
			? {
					[type]: {
						...(DEFAULT_MAP_OPTIONS as Record<string, object>)[
							type
						],
						measure,
					},
				}
			: {}),
	} as MapOptions;
	return definition.chart.cardForOptions
		? definition.chart.cardForOptions(options)
		: definition.chart.card!;
};

describe("census cards read in other nations", () => {
	it("asks for each declared member of the general health dimension", () => {
		const nations = cardOf("general-health").nations!;
		expect(nations.covers).toEqual(["E", "W"]);
		expect(nations.measure).toBe("usual-residents");
		expect(nations.dimension).toBe("general-health");
		expect(nations.members).toContainEqual({
			key: "veryGood",
			code: "very-good",
		});
	});

	it("reads good health as a share once the members are summed", () => {
		const nations = cardOf("general-health").nations!;
		const stats = nations.fromMetrics({
			total: 1000,
			veryGood: 450,
			good: 300,
			fair: 150,
			bad: 70,
			veryBad: 30,
		});
		expect(stats?.value).toBeCloseTo(75);
	});

	it("leaves a category a nation does not publish without a figure", () => {
		const nations = cardOf("housing-tenure", "owned").nations!;
		expect(
			nations.fromMetrics({ total: 200, outright: 80, shared: 2 }),
		).toBeNull();
		const outright = cardOf("housing-tenure", "outright").nations!;
		expect(
			outright.fromMetrics({ total: 200, outright: 80 })?.value,
		).toBeCloseTo(40);
	});
});
