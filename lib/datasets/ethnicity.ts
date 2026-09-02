import { loadEthnicity } from "@/lib/data/ethnicity/loader";
import type { EthnicityDataset } from "@/lib/types/ethnicity";
import type { ChartDatasetDefinition } from "./types";

export const ethnicityDefinition: ChartDatasetDefinition<EthnicityDataset> = {
	type: "ethnicity", precompiledFile: "ethnicity",
	chart: { group: "Demographics", key: "demographics-ethnicity", label: "Ethnicity [2021]", defaultVisible: true, componentPath: "@/components/demographics/ethnicity-registry", boundaryType: "localAuthority", calculateStats: (mm, g, d, l, id) => mm.calculateEthnicityStats(g, d, l, id), year: 2021 },
	source: { name: "Ethnicity", source: "Office for National Statistics", sourceUrl: "https://www.ons.gov.uk/", year: "2021", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Census ethnicity estimates by local authority." },
	precompile: async ({ text }) => loadEthnicity(text),
};
