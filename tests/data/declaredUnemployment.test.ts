import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { aggregateUnemployment } from "@uk-data-atlas/datasets";
import type {
	UnemploymentDataset,
	UnemploymentLADData,
} from "@uk-data-atlas/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";

const definition = CHART_DATASET_DEFINITIONS.find(
	(candidate) => candidate.type === "unemployment",
)!;

const dataset: UnemploymentDataset = {
	id: "unemployment",
	type: "unemployment",
	year: 2021,
	boundaryType: "localAuthority",
	boundaryYear: 2024,
	years: [2021],
	latestYear: 2021,
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			rates: { 2021: 4.5 },
			levels: { 2021: 2250 },
		},
	},
};

describe("unemployment map metric", () => {
	it("uses the selected rate or count", () => {
		const valueFor = definition.map?.valueFor;
		expect(valueFor?.(dataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(4.5);
		expect(
			valueFor?.(dataset, "E1", {
				...DEFAULT_MAP_OPTIONS,
				unemployment: {
					...DEFAULT_MAP_OPTIONS.unemployment,
					measure: "count",
				},
			} as MapOptions),
		).toBe(2250);
	});

	it("words the legend for each measure", () => {
		const { format } = definition.map!.legend;
		expect(format(4.5, DEFAULT_MAP_OPTIONS)).toBe("4.5%");
		expect(
			format(2250, {
				...DEFAULT_MAP_OPTIONS,
				unemployment: {
					...DEFAULT_MAP_OPTIONS.unemployment,
					measure: "count",
				},
			} as MapOptions),
		).toMatch(/^2.?250 unemployed$/);
	});
});

describe("aggregateUnemployment", () => {
	// E1 has 10,000 economically active residents in 2022 (400 at 4%), E2
	// 50,000 (3,000 at 6%).
	const record = (
		rates: UnemploymentLADData["rates"],
		levels: UnemploymentLADData["levels"],
	): UnemploymentLADData => ({
		ladCode: "",
		ladName: "",
		rates,
		levels,
	});
	const e1 = record({ 2022: 4, 2023: 5 }, { 2022: 400, 2023: 500 });
	const e2 = record({ 2022: 6, 2023: null }, { 2022: 3000, 2023: null });

	it("weights each year's rate by the economically active residents reporting it", () => {
		const result = aggregateUnemployment([e1, e2]);

		// 3,400 of 60,000, not the flat mean of 5%.
		expect(result?.years).toEqual([2022, 2023]);
		expect(result?.latestYear).toBe(2023);
		expect(result?.rates[2022]).toBeCloseTo(5.6667, 4);
		expect(result?.rates[2023]).toBeCloseTo(5, 10);
		expect(result?.levels[2022]).toBe(3400);
		expect(result?.levels[2023]).toBe(500);
	});

	it("omits a year no covered area reports", () => {
		expect(aggregateUnemployment([e2])?.rates).toEqual({ 2022: 6 });
	});

	it("returns null when no covered area has a record", () => {
		expect(aggregateUnemployment([])).toBeNull();
	});
});
