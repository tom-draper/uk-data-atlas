import { loadFuelPoverty } from "@/lib/data/fuel-poverty/loader";
import type { FuelPovertyDataset } from "@/lib/types/fuelPoverty";
import type { ScalarDatasetDefinition } from "./types";

export const fuelPovertyDefinition: ScalarDatasetDefinition<FuelPovertyDataset> = {
	type: "fuelPoverty",
	precompiledFile: "fuel-poverty",
	chart: {
		group: "Economics",
		key: "economics-fuelPoverty",
		label: "Fuel Poverty [2024]",
		defaultVisible: true,
		componentPath: "@/components/economics/fuel-poverty/FuelPovertyChart",
		boundaryType: "lsoa",
		calculateStats: (mapManager, geojson, data, location, datasetId) =>
			mapManager.calculateFuelPovertyStats(geojson, data, location, datasetId),
		year: 2024,
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
	map: {
		valueKey: "fuelPovertyRate",
		colorRange: { min: 5, max: 15 },
		legend: { min: 0, max: 30, format: (value) => `${value.toFixed(0)}% households` },
	},
	precompile: async (reader) =>
		loadFuelPoverty(await reader.odsContent("economics/fuel-poverty/fuel-poverty-2024.ods")),
};
