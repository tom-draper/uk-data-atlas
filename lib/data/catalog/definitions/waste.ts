import { loadWaste } from "../../new-datasets/loader";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { DatasetDefinition } from "../types";

export const wasteDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"waste">
> = {
	type: "waste",
	precompiledFile: "waste",
	boundaryType: "localAuthority",
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Local authority collected waste management",
		source: "Department for Environment, Food and Rural Affairs",
		sourceUrl:
			"https://www.gov.uk/government/statistics/local-authority-collected-waste-management-annual-results",
		year: "2024-25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Local-authority collected waste in England; collection authorities only to avoid double counting.",
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	precompile: ({ odsContent }) => loadWaste(odsContent),
};
