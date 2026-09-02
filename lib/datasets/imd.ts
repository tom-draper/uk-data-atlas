import { loadIMD } from "@/lib/data/imd/loader";
import type { IMDDataset } from "@/lib/types/imd";
import type { ChartDatasetDefinition } from "./types";

export const imdDefinition: ChartDatasetDefinition<IMDDataset> = {
	type: "imd", precompiledFile: "imd",
	chart: { group: "Deprivation", key: "deprivation-imd", label: "Deprivation (IMD) [2019]", defaultVisible: true, componentPath: "@/components/deprivation/imd/IMDChart", boundaryType: "lsoa", calculateStats: (mm, g, d, l, id) => mm.calculateIMDStats(g, d, l, id), year: 2019 },
	source: { name: "Indices of Multiple Deprivation", source: "Ministry of Housing, Communities & Local Government", sourceUrl: "https://www.gov.uk/government/statistics/english-indices-of-deprivation-2019", year: "2019", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Deprivation scores, ranks and deciles by small area (LSOA) for England." },
	map: { valueFor: () => null, colorRange: { min: 1, max: 70 }, legend: { min: 1, max: 70, format: String } },
	precompile: async ({ text }) => loadIMD(text),
};
