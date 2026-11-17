import { it, expect } from "vitest";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import type { FuelPovertyDataset } from "@uk-data-atlas/datasets";
const fuelPovertyDefinition = CHART_DATASET_DEFINITIONS.find(
	(definition) => definition.type === "fuel-poverty",
)!;

it("maps rate or household count without filling absent areas", () => {
	const dataset = {
		data: { E1: { fuelPovertyRate: 12.5, fuelPoorHouseholdCount: 125 } },
	} as unknown as FuelPovertyDataset;
	const options = {
		...DEFAULT_MAP_OPTIONS,
		"fuel-poverty": {
			...DEFAULT_MAP_OPTIONS["fuel-poverty"],
			measure: "count",
		},
	};
	expect(fuelPovertyDefinition.map?.valueFor?.(dataset, "E1", options)).toBe(
		125,
	);
	expect(
		fuelPovertyDefinition.map?.valueFor?.(dataset, "missing", options),
	).toBeNull();
	expect(
		fuelPovertyDefinition.map?.valueFor?.(
			dataset,
			"E1",
			DEFAULT_MAP_OPTIONS,
		),
	).toBe(12.5);
});
