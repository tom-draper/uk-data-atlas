import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";

const definition = (type: string) =>
	CHART_DATASET_DEFINITIONS.find((candidate) => candidate.type === type)!;

describe("declared share measures", () => {
	const tenure = definition("housing-tenure");
	const options = (measure: string) => ({
		...DEFAULT_MAP_OPTIONS,
		"housing-tenure": {
			...DEFAULT_MAP_OPTIONS["housing-tenure"],
			measure,
		},
	});
	const dataset = {
		data: { A: { metrics: { total: 200, owned: 150, social: 20 } } },
	} as never;

	it("reads one count over another as a percentage", () => {
		const valueFor = tenure.map!.valueFor!;
		expect(valueFor(dataset, "A", options("owned"))).toBe(75);
		expect(valueFor(dataset, "A", options("social"))).toBe(10);
	});

	it("has no value without the area, the count or a total", () => {
		const valueFor = tenure.map!.valueFor!;
		expect(valueFor(dataset, "missing", options("owned"))).toBeNull();
		expect(valueFor(dataset, "A", options("private"))).toBeNull();
		expect(
			valueFor(
				{ data: { A: { metrics: { total: 0, owned: 0 } } } } as never,
				"A",
				options("owned"),
			),
		).toBeNull();
	});

	it("shows the measure's own note on the card", () => {
		const card = tenure.chart.cardForOptions!(options("social"));
		expect(card.fromRecord(dataset as never, "A")?.secondary).toBe(
			"Social rented",
		);
	});
});

describe("declared public health card", () => {
	it("heads the card with the chosen measure and drops the note on an average", () => {
		const health = definition("public-health");
		const options = {
			...DEFAULT_MAP_OPTIONS,
			"public-health": {
				...DEFAULT_MAP_OPTIONS["public-health"],
				measure: "preventableMortality",
			},
		};
		const card = health.chart.cardForOptions!(options);
		expect(card.heading).toBe("Preventable mortality under 75");
		expect(card.period).toBe("2024");
		const dataset = {
			data: { A: { metrics: { preventableMortality: 250 } } },
		};
		expect(card.fromRecord(dataset as never, "A")).toEqual({
			value: 250,
			secondary: "County / unitary authority estimate",
		});
		expect(
			card.fromAggregate({
				metrics: { preventableMortality: 240 },
				isAverage: true,
			})?.secondary,
		).toBeUndefined();
	});
});
