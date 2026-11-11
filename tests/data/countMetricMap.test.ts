import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";

import { getChartDatasetDefinition } from "@/lib/datasets";
import type { IndicatorDataset } from "@uk-data-atlas/datasets";
import type { JobsDataset } from "@uk-data-atlas/datasets";

const dataset = <T extends "business-activity" | "electric-vehicle-chargers">(
	type: T,
): IndicatorDataset<T> => ({
	id: `${type}2026`,
	type,
	year: 2026,
	boundaryType: "localAuthority",
	boundaryYear: 2026,
	data: {
		E1: {
			code: "E1",
			name: "Example",
			value: 200,
			metrics: { per100kPopulation: 125 },
		},
	},
});

const jobsDataset: JobsDataset = {
	id: "jobs2024",
	type: "jobs",
	year: 2024,
	boundaryType: "localAuthority",
	boundaryYear: 2023,
	data: {
		E1: {
			ladCode: "E1",
			ladName: "Example",
			totalJobs: 200,
			metrics: { per100kPopulation: 125 },
		},
	},
};

describe("count metric maps", () => {
	it("switches businesses between total and per-population values", () => {
		const valueFor =
			getChartDatasetDefinition("business-activity")?.map?.valueFor;
		expect(
			valueFor?.(dataset("business-activity"), "E1", DEFAULT_MAP_OPTIONS),
		).toBe(200);
		expect(
			valueFor?.(dataset("business-activity"), "E1", {
				...DEFAULT_MAP_OPTIONS,
				"business-activity": {
					...DEFAULT_MAP_OPTIONS["business-activity"],
					measure: "perPopulation",
				},
			}),
		).toBe(125);
	});

	it("switches EV chargers between total and per-population values", () => {
		const valueFor = getChartDatasetDefinition("electric-vehicle-chargers")
			?.map?.valueFor;
		expect(
			valueFor?.(
				dataset("electric-vehicle-chargers"),
				"E1",
				DEFAULT_MAP_OPTIONS,
			),
		).toBe(200);
		expect(
			valueFor?.(dataset("electric-vehicle-chargers"), "E1", {
				...DEFAULT_MAP_OPTIONS,
				"electric-vehicle-chargers": {
					...DEFAULT_MAP_OPTIONS["electric-vehicle-chargers"],
					measure: "perPopulation",
				},
			}),
		).toBe(125);
	});

	it("keeps the business card on the total when the map uses population rates", () => {
		const chart = getChartDatasetDefinition("business-activity")!;
		const options = {
			...DEFAULT_MAP_OPTIONS,
			"business-activity": {
				...DEFAULT_MAP_OPTIONS["business-activity"],
				measure: "perPopulation",
			},
		};
		const card = chart.chart.cardForOptions?.(options);
		expect(card?.fromRecord(dataset("business-activity"), "E1")).toEqual({
			value: 200,
			secondary: undefined,
		});
	});
	it("keeps the EV card on the total when the map uses population rates", () => {
		const chart = getChartDatasetDefinition("electric-vehicle-chargers")!;
		const options = {
			...DEFAULT_MAP_OPTIONS,
			"electric-vehicle-chargers": {
				...DEFAULT_MAP_OPTIONS["electric-vehicle-chargers"],
				measure: "perPopulation",
			},
		};
		const card = chart.chart.cardForOptions?.(options);
		expect(
			card?.fromRecord(dataset("electric-vehicle-chargers"), "E1"),
		).toEqual({ value: 200, secondary: undefined });
	});
	it("switches jobs between total and per-population values", () => {
		const valueFor = getChartDatasetDefinition("jobs")?.map?.valueFor;
		expect(valueFor?.(jobsDataset, "E1", DEFAULT_MAP_OPTIONS)).toBe(200);
		expect(
			valueFor?.(jobsDataset, "E1", {
				...DEFAULT_MAP_OPTIONS,
				jobs: { ...DEFAULT_MAP_OPTIONS.jobs, measure: "perPopulation" },
			}),
		).toBe(125);
	});
});
