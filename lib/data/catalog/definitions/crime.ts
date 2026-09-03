import { loadCrime } from "../../crime/loader";
import type { CrimeDataset } from "@/lib/types/crime";
import type { DatasetDefinition } from "../types";

export const crimeDatasetDefinition: DatasetDefinition<CrimeDataset> = {
	type: "crime",
	precompiledFile: "crime",
	boundaryType: "localAuthority",
	source: {
		name: "Crime",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/datasets/policeforceareadatatables",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Police recorded crime by local authority district for England and Wales.",
	},
	precompile: ({ text }) => loadCrime(text),
};
