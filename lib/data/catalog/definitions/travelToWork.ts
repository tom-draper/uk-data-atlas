import { loadTravelToWork } from "../../travel-to-work/loader";
import type { TravelToWorkDataset } from "@/lib/types/travelToWork";
import type { DatasetDefinition } from "../types";

export const travelToWorkDatasetDefinition: DatasetDefinition<TravelToWorkDataset> =
	{
		type: "travelToWork",
		precompiledFile: "travel-to-work",
		boundaryType: "localAuthority",
		coverageCountries: ["GB-ENG", "GB-WLS"],
		source: {
			name: "Travel to Work",
			source: "Office for National Statistics",
			sourceUrl:
				"https://www.ons.gov.uk/datasets/TS061/editions/2021/versions/6",
			year: "2021",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"How people in employment travel to their place of work, by local authority district for England and Wales (Census 2021). Shares are of people in employment.",
		},
		ingestion: {
			minimumDataRecords: 331,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["ladCode", "breakdown"],
		},
		precompile: ({ text }) => loadTravelToWork(text),
	};
