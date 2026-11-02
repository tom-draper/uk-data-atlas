import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { wasteCard, wasteDefinition } from "@/lib/datasets/waste";
import { aggregateWaste, wasteValue } from "@/lib/helpers/waste";
import type {
	IndicatorDataset,
	IndicatorRecord,
} from "@uk-data-atlas/datasets/types/indicator";
import type { WasteOptions } from "@/lib/types/mapOptions";

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
const dataset: IndicatorDataset<"waste"> = {
	id: "waste2025",
	type: "waste",
	year: 2025,
	boundaryType: "localAuthority",
	boundaryYear: 2025,
	data: Object.fromEntries(records.map((record) => [record.code, record])),
};
const options = (
	metric: WasteOptions["metric"],
	measure: WasteOptions["measure"] = "total",
): WasteOptions => ({ ...DEFAULT_MAP_OPTIONS.waste, metric, measure });

describe("waste measures", () => {
	it.each([
		["collected", "total", 100, "tonnes"],
		["collected", "perPopulation", 1000, "tonnes per 100k"],
		["recycled", "total", 80, "tonnes"],
		["recycled", "perPopulation", 800, "tonnes per 100k"],
		["recyclingShare", "total", 80, "% recycled"],
		["recyclingShare", "perPopulation", 80, "% recycled"],
	] as const)(
		"keeps the card and map aligned for %s / %s",
		(metric, measure, value, unit) => {
			const waste = options(metric, measure);
			const mapOptions = { ...DEFAULT_MAP_OPTIONS, waste };
			expect(
				wasteDefinition.map!.valueFor!(dataset, "E1", mapOptions),
			).toBe(value);
			expect(wasteCard(waste).fromRecord(dataset, "E1")?.value).toBe(
				value,
			);
			expect(wasteCard(waste).unit).toBe(unit);
		},
	);
	it("calculates a regional share from tonnages rather than averaging authority percentages", () => {
		const aggregate = aggregateWaste(records);
		expect(aggregate?.value).toBe(1000);
		expect(aggregate?.metrics?.recycledTonnes).toBe(260);
		expect(
			wasteCard(options("recyclingShare")).fromAggregate(aggregate)
				?.value,
		).toBe(26);
		expect(
			wasteCard(options("collected", "perPopulation")).fromAggregate(
				aggregate,
			)?.value,
		).toBe(2500);
		expect(
			wasteCard(options("recycled", "perPopulation")).fromAggregate(
				aggregate,
			)?.value,
		).toBe(650);
	});
	it("does not show an incomplete recycling total or share", () => {
		const aggregate = aggregateWaste([
			records[0],
			{ code: "E3", name: "Missing", value: 200 },
		]);
		expect(wasteValue(aggregate!, options("collected"))).toBe(300);
		expect(wasteValue(aggregate!, options("recycled"))).toBeNull();
		expect(wasteValue(aggregate!, options("recyclingShare"))).toBeNull();
		expect(
			wasteValue(aggregate!, options("collected", "perPopulation")),
		).toBeNull();
	});
	it("preserves zero recycling and distinguishes it from missing data", () => {
		expect(
			wasteValue(
				{ value: 100, metrics: { recycledTonnes: 0 } },
				options("recyclingShare"),
			),
		).toBe(0);
		expect(wasteValue({ value: 100 }, options("recycled"))).toBeNull();
		expect(wasteValue(undefined, options("recycled"))).toBeNull();
		expect(
			wasteValue(
				{ value: 0, metrics: { recycledTonnes: 0 } },
				options("recyclingShare"),
			),
		).toBeNull();
		expect(aggregateWaste([])).toBeNull();
	});
	it("invalidates map values when switching metrics or population scaling", () => {
		const map = wasteDefinition.map!;
		const modes = [
			options("collected"),
			options("recycled"),
			options("recyclingShare"),
			options("recycled", "perPopulation"),
		].map((waste) =>
			map.sourceMode!(dataset, { ...DEFAULT_MAP_OPTIONS, waste }),
		);
		expect(new Set(modes).size).toBe(4);
		expect(
			map.legend.format(26, {
				...DEFAULT_MAP_OPTIONS,
				waste: options("recyclingShare"),
			}),
		).toBe("26.0% recycled");
	});
});
