import { loadFuelPoverty } from "../../fuel-poverty/loader";
import type { FuelPovertyDataset } from "@/lib/types/fuelPoverty";
import type { DatasetDefinition } from "../types";

export const fuelPovertyDatasetDefinition: DatasetDefinition<FuelPovertyDataset> =
	{
		type: "fuelPoverty",
		precompiledFile: "fuel-poverty",
		boundaryType: "lsoa",
		source: {
			name: "Fuel Poverty",
			source: "Department for Energy Security and Net Zero",
			sourceUrl:
				"https://www.gov.uk/government/collections/fuel-poverty-statistics",
			year: "2024",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Fuel poverty estimates by Lower-layer Super Output Area in England.",
		},
		precompile: async (reader) =>
			loadFuelPoverty(
				await reader.odsContent(
					"economics/fuel-poverty/fuel-poverty-2024.ods",
				),
			),
	};
