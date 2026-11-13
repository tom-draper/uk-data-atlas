import type { RoadCollisionsDataset } from "../../../types/roadCollisions.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { loadRoadCollisionsByAuthority } from "../../../data/road-safety/authorityLoader.ts";

export const roadCollisions = defineDataset<RoadCollisionsDataset>({
	id: "road-collisions",
	topic: "road-safety",
	boundary: { type: "localAuthority", year: 2025 },
	chartPending: true,
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
	source: {
		name: "Road Collisions by Local Authority",
		publisher: "Department for Transport",
		sourceUrl:
			"https://www.gov.uk/government/statistical-data-sets/road-accidents-and-safety-statistics",
		year: "2024-2025 (final annual editions)",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Department for Transport. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Final annual reported road collisions in Great Britain for 2024 and 2025, counted by the local authority DfT assigns each collision to and by the most severe injury the police recorded.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDatasets: 2,
		minimumDataRecords: 340,
		expectedBoundaryYears: [2024, 2025],
		requiredDataFields: ["collisions", "fatal", "serious", "slight"],
	},
	load: ({ text }) => loadRoadCollisionsByAuthority(text),
	statistics: {
		payload: {
			parts: (labels) =>
				labels
					.filter((label) => /^\d{4}$/.test(label))
					.sort()
					.map((key) => ({
						key,
						header: {
							id: `road-collisions${key}`,
							type: "road-collisions",
							year: Number(key),
							period: `January to December ${key}`,
							boundaryType: "localAuthority",
							boundaryYear: Number(key),
							lsoaBoundaryYear: 2021,
							coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
						},
					})),
			code: { data: "ladCode", lsoas: "lsoaCode" },
			/** Collisions with no area to sit on: the excluded Heathrow code and those with no LSOA. */
			dropped: ["excluded", "withoutLsoa"],
		},
		measures: [
			measure(
				"road-collisions",
				"Reported road collisions",
				"collisions",
				"count",
				"sum",
				"Road collisions involving personal injury reported to the police.",
			),
		],
		dimensions: [
			{
				slug: "collision-severity",
				label: "Collision severity",
				members: [
					{ key: "collisions", code: "all", label: "All severities" },
					{ key: "fatal", label: "Fatal", parent: "collisions" },
					{ key: "serious", label: "Serious", parent: "collisions" },
					{ key: "slight", label: "Slight", parent: "collisions" },
				],
			},
		],
		records: [
			{ from: "data" },
			{
				from: "lsoas",
				release: (header) => ({
					geography: "lsoa",
					year: Number(header.lsoaBoundaryYear),
				}),
			},
		],
		fields: [{ path: "{collision-severity}", measure: "road-collisions" }],
	},
});
