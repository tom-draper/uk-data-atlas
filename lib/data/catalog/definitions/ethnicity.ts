import { loadEthnicity } from "../../ethnicity/loader";
import type { EthnicityDataset } from "@/lib/types/ethnicity";
import type { DatasetDefinition } from "../types";

export const ethnicityDatasetDefinition: DatasetDefinition<EthnicityDataset> = {
	type: "ethnicity",
	precompiledFile: "ethnicity",
	boundaryType: "localAuthority",
	source: {
		name: "Ethnicity",
		source: "Office for National Statistics",
		sourceUrl: "https://www.ons.gov.uk/",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Census ethnicity estimates by local authority.",
	},
	precompile: async ({ text }) => loadEthnicity(text),
};
