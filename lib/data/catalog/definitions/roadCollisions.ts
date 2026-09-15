import { loadRoadCollisionsByAuthority } from "../../road-safety/authorityLoader";
import type { RoadCollisionsDataset } from "@/lib/types/roadCollisions";
import type { DatasetDefinition } from "../types";

export const roadCollisionsDatasetDefinition: DatasetDefinition<RoadCollisionsDataset> =
	{
		type: "roadCollisions",
		precompiledFile: "road-collisions",
		boundaryType: "localAuthority",
		// The map shows the collisions themselves; these are the counts the API
		// publishes, so there is nothing new here to chart.
		chartPending: true,
		coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
		source: {
			name: "Road Collisions by Local Authority",
			source: "Department for Transport",
			sourceUrl:
				"https://www.gov.uk/government/statistical-data-sets/road-accidents-and-safety-statistics",
			year: "January-June 2025 (provisional)",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Provisional reported road collisions in Great Britain, January to June 2025, counted by the local authority DfT assigns each collision to and by the most severe injury the police recorded.",
		},
		ingestion: {
			minimumDataRecords: 340,
			expectedBoundaryYears: [2024],
			requiredDataFields: ["collisions", "fatal", "serious", "slight"],
		},
		precompile: ({ text }) => loadRoadCollisionsByAuthority(text),
	};
