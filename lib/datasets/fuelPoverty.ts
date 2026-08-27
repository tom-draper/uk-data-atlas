import { loadFuelPoverty } from "@/lib/data/fuel-poverty/loader";
import type { FuelPovertyDataset } from "@/lib/types/fuelPoverty";
import type { ScalarDatasetDefinition } from "./types";

export const fuelPovertyDefinition: ScalarDatasetDefinition<FuelPovertyDataset> = {
	type: "fuelPoverty",
	precompiledFile: "fuel-poverty",
	sourcePath: "economics/fuel-poverty/fuel-poverty-2024.ods",
	sourceFormat: "ods",
	chart: {
		group: "Economics",
		key: "economics-fuelPoverty",
		label: "Fuel Poverty [2024]",
		defaultVisible: true,
	},
	load: loadFuelPoverty,
};
