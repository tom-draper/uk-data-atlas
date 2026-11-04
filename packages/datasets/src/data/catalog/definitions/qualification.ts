import { loadQualification } from "../../qualification/loader.ts";
import type { QualificationDataset } from "../../../types/qualification.ts";
import type { DatasetDefinition } from "../types.ts";

export const qualificationDatasetDefinition: DatasetDefinition<QualificationDataset> =
	{
		type: "qualification",
		precompiledFile: "qualification",
		boundaryType: "localAuthority",
		coverageCountries: ["GB-ENG", "GB-WLS"],
		source: {
			name: "Qualifications",
			source: "Office for National Statistics",
			sourceUrl:
				"https://www.ons.gov.uk/datasets/TS067/editions/2021/versions/3",
			year: "2021",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Highest level of qualification breakdown by local authority district for England and Wales (Census 2021).",
		},
		precompile: async ({ text }) => loadQualification(text),
	};
