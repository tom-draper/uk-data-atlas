import { loadHousingAffordability } from "../../new-datasets/loader";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { DatasetDefinition } from "../types";

export const housingAffordabilityDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"housingAffordability">
> = {
	type: "housingAffordability",
	precompiledFile: "housing-affordability",
	boundaryType: "localAuthority",
	coverageCountries: ["GB-ENG", "GB-WLS"],
	source: {
		name: "House price to residence-based earnings ratio",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/ratioofhousepricetoresidencebasedearningslowerquartileandmedian",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Ratio of the median price paid for existing dwellings to median gross annual residence-based earnings, by local authority district.",
	},
	ingestion: {
		minimumDataRecords: 300,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	precompile: ({ xlsxSheet }) => loadHousingAffordability(xlsxSheet),
};
