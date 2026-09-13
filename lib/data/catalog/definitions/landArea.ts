import { loadLandArea } from "../../land-area/loader";
import type { LandAreaDataset } from "@/lib/types/landArea";
import type { DatasetDefinition } from "../types";

export const landAreaDatasetDefinition: DatasetDefinition<LandAreaDataset> = {
	type: "landArea",
	precompiledFile: "land-area",
	boundaryType: "localAuthority",
	// Reference geometry, not a story: there is nothing here to chart.
	chartPending: true,
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	source: {
		name: "Land Area",
		source: "Office for National Statistics",
		sourceUrl:
			"https://geoportal.statistics.gov.uk/datasets/standard-area-measurements-for-the-local-authority-districts-december-2024-in-the-uk",
		year: "2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Standard Area Measurements by local authority district across the UK: land area excluding inland water, alongside the extent of the realm and inland water, in hectares.",
	},
	ingestion: {
		minimumDataRecords: 361,
		expectedBoundaryYears: [2024],
		requiredDataFields: ["landHectares", "landSquareKm"],
	},
	precompile: ({ text }) => loadLandArea(text),
};
