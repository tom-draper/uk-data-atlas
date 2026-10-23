import {
	loadPublicHealth,
	type PublicHealthDataset,
} from "../../public-health/loader";
import type { DatasetDefinition } from "../types";
export const publicHealthDatasetDefinition: DatasetDefinition<PublicHealthDataset> =
	{
		type: "publicHealth",
		precompiledFile: "public-health",
		boundaryType: "countyAndUnitaryAuthority",
		coverageCountries: ["GB-ENG"],
		source: {
			name: "Public health indicators",
			source: "Office for Health Improvement and Disparities",
			sourceUrl:
				"https://fingertips.phe.org.uk/profile/public-health-outcomes-framework",
			year: "2024 to 2024/25",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Selected Public Health Outcomes Framework indicators for English counties and unitary authorities, persons, at the latest collected period for each indicator.",
		},
		ingestion: {
			minimumDataRecords: 140,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["metrics"],
		},
		precompile: ({ csvRows }) => loadPublicHealth(csvRows),
	};
