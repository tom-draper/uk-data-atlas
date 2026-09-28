import { loadGhgEmissions } from "../../ghg-emissions/loader";
import type { GhgEmissionsDataset } from "@/lib/types/ghgEmissions";
import type { DatasetDefinition } from "../types";

export const ghgEmissionsDatasetDefinition: DatasetDefinition<GhgEmissionsDataset> =
	{
		type: "ghgEmissions",
		precompiledFile: "ghg-emissions",
		boundaryType: "localAuthority",
		coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
		source: {
			name: "Greenhouse Gas Emissions",
			source: "Department for Energy Security and Net Zero",
			sourceUrl:
				"https://www.gov.uk/government/statistics/uk-local-authority-and-regional-greenhouse-gas-emissions-statistics-2005-to-2024",
			year: "2005-2024",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Territorial greenhouse gas emissions by local authority across the United Kingdom, 2005 to 2024, broken down by sector. Aggregated from the published sub-sector and gas detail to a sector total in kt CO2e.",
		},
		ingestion: {
			minimumDatasets: 20,
			minimumDataRecords: 361,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["totalKtCO2e", "perPersonTCO2e"],
		},
		precompile: ({ text }) => loadGhgEmissions(text),
	};
