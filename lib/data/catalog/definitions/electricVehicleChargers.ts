import { loadElectricVehicleChargers } from "../../new-datasets/loader";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { DatasetDefinition } from "../types";

export const electricVehicleChargersDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"electricVehicleChargers">
> = {
	type: "electricVehicleChargers",
	precompiledFile: "electric-vehicle-chargers",
	boundaryType: "localAuthority",
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	source: {
		name: "Public electric vehicle chargers by local authority",
		source: "Department for Transport",
		sourceUrl:
			"https://www.gov.uk/government/collections/electric-vehicle-charging-infrastructure-statistics",
		year: "1 July 2026",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Publicly available electric-vehicle chargers by local authority.",
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2026],
		requiredDataFields: ["value"],
	},
	precompile: ({ odsContent }) => loadElectricVehicleChargers(odsContent),
};
