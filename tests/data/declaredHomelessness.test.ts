import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";

const definition = CHART_DATASET_DEFINITIONS.find(
	({ type }) => type === "homelessness",
)!;

const dataset = {
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			householdsInTemporaryAccommodation: 500,
			householdsPerThousand: 8,
			householdsWithChildren: 250,
			childrenInTemporaryAccommodation: 4200,
		},
	},
} as never;

const withMeasure = (measure: "rate" | "count"): MapOptions => ({
	...DEFAULT_MAP_OPTIONS,
	homelessness: { ...DEFAULT_MAP_OPTIONS.homelessness, measure },
});

const cardFor = (measure: "rate" | "count") =>
	definition.chart.cardForOptions!(withMeasure(measure));

describe("homelessness card", () => {
	it("is drawn by the shared value card, not a bespoke chart", () => {
		expect(definition.chart.componentPath).toContain("ValueCard");
	});

	it("shows the rate on a per-1k bar with children in TA", () => {
		const card = cardFor("rate");
		const stats = card.fromRecord(dataset, "E1");
		expect(stats?.value).toBe(8);
		expect(stats?.secondary).toBe("4k children in TA");
		expect(card.unit).toBe("per 1k households");
		expect(card.maximum).toBe(15);
		expect(card.heading).toBe("Homelessness");
	});

	it("shows the count against the 2,500 bar", () => {
		const card = cardFor("count");
		expect(card.fromRecord(dataset, "E1")?.value).toBe(500);
		expect(card.unit).toBe("households in TA");
		expect(card.maximum).toBe(2500);
		expect(card.format?.(12345)).toBe("12,345");
	});

	it("keeps the aggregate for an unselected area", () => {
		const stats = cardFor("count").fromAggregate({
			householdsInTemporaryAccommodation: 1000,
			householdsPerThousand: 5,
			childrenInTemporaryAccommodation: 900,
		});
		expect(stats?.value).toBe(1000);
	});
});
