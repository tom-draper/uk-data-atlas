import { loadAdultSocialCareOutcomes } from "../../new-datasets/loader";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { DatasetDefinition } from "../types";

export const adultSocialCareOutcomesDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"adultSocialCareOutcomes">
> = {
	type: "adultSocialCareOutcomes",
	precompiledFile: "adult-social-care-outcomes",
	boundaryType: "localAuthority",
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Adult Social Care Outcomes Framework, England",
		source: "Department of Health and Social Care",
		sourceUrl:
			"https://www.gov.uk/government/statistics/measures-from-the-adult-social-care-outcomes-framework-england-2024-to-2025",
		year: "2024-25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Social care-related quality-of-life score for local authorities, out of 24.",
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	precompile: ({ odsContent }) => loadAdultSocialCareOutcomes(odsContent),
};
