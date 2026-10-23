import { loadHousingTenure } from "../../housing-tenure/loader";
import type { IndicatorDataset } from "../../../types/indicator";
import type { DatasetDefinition } from "../types";
export const housingTenureDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"housingTenure">
> = {
	type: "housingTenure",
	precompiledFile: "housing-tenure",
	boundaryType: "lsoa",
	coverageCountries: ["GB-ENG", "GB-WLS"],
	source: {
		name: "Housing tenure",
		source: "Office for National Statistics",
		sourceUrl: "https://www.ons.gov.uk/datasets/ts054",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Census 2021 housing tenure counts for LSOAs in England and Wales.",
	},
	ingestion: {
		minimumDataRecords: 35000,
		expectedBoundaryYears: [2021],
		requiredDataFields: ["value", "metrics"],
	},
	precompile: ({ csvRows }) => loadHousingTenure(csvRows),
};
