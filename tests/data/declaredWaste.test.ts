import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { aggregateWaste } from "@uk-data-atlas/datasets";
import type { IndicatorRecord } from "@uk-data-atlas/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";

const definition = CHART_DATASET_DEFINITIONS.find(
	(candidate) => candidate.type === "waste",
)!;

const records: IndicatorRecord[] = [
	{
		code: "E1",
		name: "Small",
		value: 100,
		metrics: { recycledTonnes: 80, per100kPopulation: 1000 },
	},
	{
		code: "E2",
		name: "Large",
		value: 900,
		metrics: { recycledTonnes: 180, per100kPopulation: 3000 },
	},
];
const dataset = (data: IndicatorRecord[]) =>
	({
		data: Object.fromEntries(data.map((record) => [record.code, record])),
	}) as never;

const withMeasure = (measure: string): MapOptions => ({
	...DEFAULT_MAP_OPTIONS,
	waste: { ...DEFAULT_MAP_OPTIONS.waste, measure },
});

const valueFor = (measure: string, code = "E1", data = records) =>
	definition.map!.valueFor!(dataset(data), code, withMeasure(measure));

const cardFor = (measure: string) =>
	definition.chart.cardForOptions!(withMeasure(measure));

describe("waste", () => {
	it("opens on collected tonnes", () => {
		expect(valueFor("collected")).toBe(100);
		expect(DEFAULT_MAP_OPTIONS.waste.measure).toBe("collected");
	});

	it.each([
		["collected", 100, "tonnes"],
		["collected-per-100k", 1000, "tonnes per 100k"],
		["recycled", 80, "tonnes"],
		["recycled-per-100k", 800, "tonnes per 100k"],
		["recycling-share", 80, "% recycled"],
	] as const)(
		"keeps the card and map aligned for %s",
		(measure, value, unit) => {
			expect(valueFor(measure)).toBe(value);
			const card = cardFor(measure);
			expect(card.fromRecord(dataset(records), "E1")?.value).toBe(value);
			expect(card.unit).toBe(unit);
		},
	);

	it("calculates a regional share from tonnages rather than averaging authority percentages", () => {
		const aggregate = aggregateWaste(records);
		expect(aggregate?.value).toBe(1000);
		expect(aggregate?.metrics?.recycledTonnes).toBe(260);
		expect(cardFor("recycling-share").fromAggregate(aggregate)?.value).toBe(
			26,
		);
		expect(
			cardFor("collected-per-100k").fromAggregate(aggregate)?.value,
		).toBe(2500);
		expect(
			cardFor("recycled-per-100k").fromAggregate(aggregate)?.value,
		).toBe(650);
	});

	it("does not show an incomplete recycling total or share", () => {
		const aggregate = aggregateWaste([
			records[0],
			{ code: "E3", name: "Missing", value: 200 },
		]);
		expect(cardFor("collected").fromAggregate(aggregate)?.value).toBe(300);
		expect(cardFor("recycled").fromAggregate(aggregate)).toBeNull();
		expect(cardFor("recycling-share").fromAggregate(aggregate)).toBeNull();
		expect(
			cardFor("collected-per-100k").fromAggregate(aggregate),
		).toBeNull();
	});

	it("preserves zero recycling and distinguishes it from missing data", () => {
		const zero = [
			{
				code: "E1",
				name: "A",
				value: 100,
				metrics: { recycledTonnes: 0 },
			},
		];
		expect(valueFor("recycling-share", "E1", zero)).toBe(0);
		const none = [{ code: "E1", name: "A", value: 100 }];
		expect(valueFor("recycled", "E1", none)).toBeNull();
		expect(valueFor("recycling-share", "E1", none)).toBeNull();
		const idle = [
			{ code: "E1", name: "A", value: 0, metrics: { recycledTonnes: 0 } },
		];
		expect(valueFor("recycling-share", "E1", idle)).toBeNull();
		expect(aggregateWaste([])).toBeNull();
	});

	it("leaves an area without a population rate missing, not zero", () => {
		const noRate = [{ code: "E1", name: "A", value: 50 }];
		expect(valueFor("collected", "E1", noRate)).toBe(50);
		expect(valueFor("collected-per-100k", "E1", noRate)).toBeNull();
		expect(valueFor("recycled-per-100k", "E1", noRate)).toBeNull();
	});

	it("invalidates map values when switching measures and words the legend per measure", () => {
		const { map } = definition;
		const modes = [
			"collected",
			"collected-per-100k",
			"recycled",
			"recycled-per-100k",
			"recycling-share",
		].map((measure) =>
			map!.sourceMode!(dataset(records), withMeasure(measure)),
		);
		expect(new Set(modes).size).toBe(5);
		expect(map!.legend.format(26, withMeasure("recycling-share"))).toBe(
			"26.0% recycled",
		);
		expect(map!.legend.format(200_000, withMeasure("collected"))).toBe(
			"200,000 t",
		);
		expect(map!.legend.format(200, withMeasure("collected-per-100k"))).toBe(
			"200 t per 100k",
		);
	});
});
