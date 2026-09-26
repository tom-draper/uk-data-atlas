import { loadAdultSocialCareActivity } from "../../new-datasets/loader";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { DatasetDefinition } from "../types";

export const adultSocialCareActivityDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"adultSocialCareActivity">
> = {
	type: "adultSocialCareActivity",
	precompiledFile: "adult-social-care-activity",
	boundaryType: "localAuthority",
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Adult social care activity in England",
		source: "Department of Health and Social Care",
		sourceUrl:
			"https://www.gov.uk/government/statistics/adult-social-care-activity-report-england-2024-to-2025",
		year: "2024-25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Clients receiving long-term support during the year, across ages 18 to 64 and 65 and over.",
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	precompile: ({ odsContent }) => loadAdultSocialCareActivity(odsContent),
};
