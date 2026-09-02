import { loadNIMDM } from "@/lib/data/nimdm/loader";
import type { NIMDMDataset } from "@/lib/types/nimdm";
import type { ChartDatasetDefinition } from "./types";

export const nimdmDefinition: ChartDatasetDefinition<NIMDMDataset> = {
	type: "nimdm", precompiledFile: "nimdm",
	chart: { group: "Deprivation", key: "deprivation-nimdm", label: "Deprivation (NIMDM) [2017]", defaultVisible: false, componentPath: "@/components/deprivation/nimdm/NIMDMChart", boundaryType: "superOutputArea", calculateStats: (mm, g, d, l, id) => mm.calculateNIMDMStats(g, d, l, id), year: 2017 },
	source: { name: "Northern Ireland Multiple Deprivation Measure", source: "Northern Ireland Statistics and Research Agency", sourceUrl: "https://www.nisra.gov.uk/statistics/deprivation/northern-ireland-multiple-deprivation-measure-2017-nimdm2017", year: "2017", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Deprivation scores, ranks and deciles by super output area for Northern Ireland." },
	map: { valueKey: "nimdmRank", colorRange: { min: 1, max: 890 }, legend: { min: 1, max: 890, format: String }, invertColor: false },
	precompile: async ({ text }) => loadNIMDM(text),
};
