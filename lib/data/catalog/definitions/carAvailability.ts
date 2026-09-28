import { loadCarAvailability } from "../../car-availability/loader";
import type { CarAvailabilityDataset } from "@/lib/types/carAvailability";
import type { DatasetDefinition } from "../types";

export const carAvailabilityDatasetDefinition: DatasetDefinition<CarAvailabilityDataset> =
	{
		type: "carAvailability",
		precompiledFile: "car-availability",
		boundaryType: "localAuthority",
		coverageCountries: ["GB-ENG", "GB-WLS"],
		source: {
			name: "Car Availability",
			source: "Office for National Statistics",
			sourceUrl:
				"https://www.ons.gov.uk/datasets/TS045/editions/2021/versions/4",
			year: "2021",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Cars or vans available to each household, by local authority district for England and Wales (Census 2021). Shares are of households.",
		},
		ingestion: {
			minimumDataRecords: 331,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["ladCode", "breakdown"],
		},
		precompile: ({ text }) => loadCarAvailability(text),
	};
