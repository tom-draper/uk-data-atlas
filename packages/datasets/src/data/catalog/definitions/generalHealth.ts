import { loadGeneralHealth } from "../../general-health/loader";
import type { IndicatorDataset } from "../../../types/indicator";
import type { DatasetDefinition } from "../types";
export const generalHealthDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"generalHealth">
> = {
	type: "generalHealth",
	precompiledFile: "general-health",
	boundaryType: "lsoa",
	coverageCountries: ["GB-ENG", "GB-WLS"],
	source: {
		name: "General health",
		source: "Office for National Statistics",
		sourceUrl: "https://www.ons.gov.uk/datasets/ts037",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Census 2021 general health counts for LSOAs in England and Wales.",
	},
	ingestion: {
		minimumDataRecords: 35000,
		expectedBoundaryYears: [2021],
		requiredDataFields: ["value", "metrics"],
	},
	precompile: ({ csvRows }) => loadGeneralHealth(csvRows),
};
