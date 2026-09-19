import { loadLocalGovernmentFinance } from "../../new-datasets/loader";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { DatasetDefinition } from "../types";

export const localGovernmentFinanceDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"localGovernmentFinance">
> = {
	type: "localGovernmentFinance",
	precompiledFile: "local-government-finance",
	boundaryType: "localAuthority",
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Local authority revenue expenditure and financing",
		source: "Ministry of Housing, Communities and Local Government",
		sourceUrl:
			"https://www.gov.uk/government/statistics/local-authority-revenue-expenditure-and-financing-england-2026-to-2027-budget",
		year: "2026-27",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"English local-authority revenue budget estimates; the Atlas map shows total education-services expenditure.",
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2026],
		requiredDataFields: ["value"],
	},
	precompile: ({ odsContent }) => loadLocalGovernmentFinance(odsContent),
};
