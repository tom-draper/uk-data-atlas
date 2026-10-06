import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { businessActivityDefinition } from "@/lib/datasets/businessActivity";
import { electricVehicleChargersDefinition } from "@/lib/datasets/electricVehicleChargers";
import type { IndicatorDataset } from "@/lib/types/indicator";

const dataset = <T extends "businessActivity" | "electricVehicleChargers">(
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

describe("count metric maps", () => {
	it("switches businesses between total and per-population values", () => {
		const valueFor = businessActivityDefinition.map?.valueFor;
		expect(
			valueFor?.(dataset("businessActivity"), "E1", DEFAULT_MAP_OPTIONS),
		).toBe(200);
		expect(
			valueFor?.(dataset("businessActivity"), "E1", {
				...DEFAULT_MAP_OPTIONS,
				businessActivity: {
					...DEFAULT_MAP_OPTIONS.businessActivity,
					measure: "perPopulation",
				},
			}),
		).toBe(125);
	});

	it("switches EV chargers between total and per-population values", () => {
		const valueFor = electricVehicleChargersDefinition.map?.valueFor;
		expect(
			valueFor?.(
				dataset("electricVehicleChargers"),
				"E1",
				DEFAULT_MAP_OPTIONS,
			),
		).toBe(200);
		expect(
			valueFor?.(dataset("electricVehicleChargers"), "E1", {
				...DEFAULT_MAP_OPTIONS,
				electricVehicleChargers: {
					...DEFAULT_MAP_OPTIONS.electricVehicleChargers,
					measure: "perPopulation",
				},
			}),
		).toBe(125);
	});
});
