import { loadNetAdditionalDwellings } from "../../new-datasets/loader";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { DatasetDefinition } from "../types";

export const netAdditionalDwellingsDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"netAdditionalDwellings">
> = {
	type: "netAdditionalDwellings",
	precompiledFile: "net-additional-dwellings",
	boundaryType: "localAuthority",
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Housing supply: net additional dwellings",
		source: "Ministry of Housing, Communities and Local Government",
		sourceUrl:
			"https://www.gov.uk/government/collections/net-supply-of-housing",
		year: "2024-25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Net additional dwellings by English local authority district.",
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	precompile: ({ odsContent }) => loadNetAdditionalDwellings(odsContent),
};
