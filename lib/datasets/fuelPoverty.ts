import { loadFuelPoverty } from "@/lib/data/fuel-poverty/loader";
import type { FuelPovertyDataset } from "@/lib/types/fuelPoverty";
import type { ScalarDatasetDefinition } from "./types";

export const fuelPovertyDefinition: ScalarDatasetDefinition<FuelPovertyDataset> = {
	type: "fuelPoverty",
	precompiledFile: "fuel-poverty",
	sourcePath: "economics/fuel-poverty/fuel-poverty-2024.ods",
	chart: {
		group: "Economics",
		key: "economics-fuelPoverty",
		label: "Fuel Poverty [2024]",
		defaultVisible: true,
	},
	source: {
		name: "Fuel Poverty",
		source: "Department for Energy Security and Net Zero",
		sourceUrl: "https://www.gov.uk/government/collections/fuel-poverty-statistics",
		year: "2024",
		licence: "Open Government Licence v3.0",
		licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Fuel poverty estimates by Lower-layer Super Output Area in England.",
	},
	load: loadFuelPoverty,
	map: {
		codeLevel: "lsoa",
		valueKey: "fuelPovertyRate",
		mapOptionsKey: "fuelPoverty",
	},
};
