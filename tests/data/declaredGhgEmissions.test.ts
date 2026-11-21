import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";

const definition = CHART_DATASET_DEFINITIONS.find(
	(candidate) => candidate.type === "ghg-emissions",
)!;

const cardFor = (measure: string) =>
	definition.chart.cardForOptions!({
		...DEFAULT_MAP_OPTIONS,
		"ghg-emissions": { ...DEFAULT_MAP_OPTIONS["ghg-emissions"], measure },
	} as MapOptions);

const record = {
	totalKtCO2e: 4321.6,
	perPersonTCO2e: 5.25,
	transport: 1200.4,
	domestic: 900.2,
	industry: 300,
	waste: 80,
};
const dataset = { data: { E1: record } } as never;

describe("greenhouse gas emissions card", () => {
	it("is drawn by the shared value card with the sector pills", () => {
		expect(definition.chart.componentPath).toContain("ValueCard");
		const stats = cardFor("perPerson").fromRecord(dataset, "E1");
		expect(cardFor("perPerson").layout).toBe("pills");
		expect(stats?.value).toBe(5.25);
		expect(stats?.pills?.map((pill) => [pill.label, pill.value])).toEqual([
			["Transport", 1200.4],
			["Domestic", 900.2],
			["Industry", 300],
		]);
	});

	it("notes the total beside a per person figure, and the reverse", () => {
		expect(cardFor("perPerson").fromAggregate(record)?.secondary).toBe(
			"4,322 kt total",
		);
		const sector = cardFor("waste").fromRecord(dataset, "E1");
		expect(sector?.value).toBe(80);
		expect(sector?.secondary).toBe("5.3 t per person");
	});
});

describe("declared ghg emissions card identity", () => {
	// The value card caches per-authority totals against the card's functions,
	// so the same measure must give the same card on every render.
	it("returns one card per measure", () => {
		expect(cardFor("waste")).toBe(cardFor("waste"));
		expect(cardFor("waste")).not.toBe(cardFor("transport"));
	});
});
