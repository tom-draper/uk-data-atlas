import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";

const record = {
	ladCode: "E1",
	ladName: "Area",
	allMetersGwh: 100,
	domesticGwh: 40,
	nonDomesticGwh: 60,
	metersThousands: 2,
	metrics: { per100kPopulation: 200 },
};
const dataset = (data: object) => ({ data }) as never;

const withMeasure = (type: string, measure: string): MapOptions => {
	const options = DEFAULT_MAP_OPTIONS as unknown as Record<string, object>;
	return {
		...DEFAULT_MAP_OPTIONS,
		[type]: { ...options[type], measure },
	} as MapOptions;
};

describe.each(["electricity-consumption", "gas-consumption"])("%s", (type) => {
	const definition = CHART_DATASET_DEFINITIONS.find(
		(candidate) => candidate.type === type,
	)!;
	const valueFor = (measure: string, data: object = { E1: record }) =>
		definition.map!.valueFor!(
			dataset(data),
			"E1",
			withMeasure(type, measure),
		);

	it("opens on the total of all meters", () => {
		expect(valueFor("all")).toBe(100);
		expect(definition.map!.colorRange.min).toBe(0);
	});

	it("reads each meter type's total", () => {
		expect(valueFor("domestic")).toBe(40);
		expect(valueFor("non-domestic")).toBe(60);
	});

	it("shares the whole area's rate out by each meter type's part", () => {
		expect(valueFor("all-per-100k")).toBe(200);
		expect(valueFor("domestic-per-100k")).toBe(80);
		expect(valueFor("non-domestic-per-100k")).toBe(120);
	});

	it("leaves an area without a population rate missing, not zero", () => {
		const noRate = { E1: { ...record, metrics: undefined } };
		expect(valueFor("domestic-per-100k", noRate)).toBeNull();
		expect(valueFor("domestic", noRate)).toBe(40);
	});

	it("handles an area with no consumption without dividing by zero", () => {
		const idle = {
			E1: {
				...record,
				allMetersGwh: 0,
				domesticGwh: 0,
				nonDomesticGwh: 0,
			},
		};
		expect(valueFor("domestic-per-100k", idle)).toBe(0);
		expect(
			valueFor("domestic-per-100k", {
				E1: { ...idle.E1, domesticGwh: 5 },
			}),
		).toBeNull();
	});

	it("labels the legend by the unit and keeps the source mode per measure", () => {
		const total = withMeasure(type, "all");
		const rate = withMeasure(type, "all-per-100k");
		expect(definition.map!.legend.format(200, total)).toBe("200 GWh");
		expect(definition.map!.legend.format(2_000, rate)).toBe(
			"2k GWh per 100k",
		);
		expect(definition.map!.sourceMode!(dataset({}), rate)).not.toBe(
			definition.map!.sourceMode!(dataset({}), total),
		);
	});

	it("keeps the card on the meter type's total even for a rate measure", () => {
		const card = definition.chart.cardForOptions!(
			withMeasure(type, "domestic-per-100k"),
		);
		expect(card.fromRecord(dataset({ E1: record }), "E1")).toEqual({
			value: 40,
			secondary: "Domestic meters total",
		});
		expect(
			card.fromAggregate({
				domesticGwh: 300,
				nonDomesticGwh: 200,
				allMetersGwh: 500,
				metersThousands: 125,
			}),
		).toEqual({ value: 300, secondary: "Domestic meters total" });
	});
});
