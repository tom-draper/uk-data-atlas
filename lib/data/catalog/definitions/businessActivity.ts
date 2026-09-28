import { loadBusinessActivity } from "../../new-datasets/loader";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { DatasetDefinition } from "../types";

export const businessActivityDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"businessActivity">
> = {
	type: "businessActivity",
	precompiledFile: "business-activity",
	boundaryType: "localAuthority",
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	source: {
		name: "UK business: activity, size and location",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/businessindustryandtrade/business/activitysizeandlocation/datasets/ukbusinessactivitysizeandlocation",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"VAT and/or PAYE based enterprises by local authority district, summed across published broad industries.",
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	precompile: ({ xlsxSheet }) => loadBusinessActivity(xlsxSheet),
};
