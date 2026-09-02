import { loadWIMD } from "@/lib/data/wimd/loader";
import type { WIMDDataset } from "@/lib/types/wimd";
import type { ChartDatasetDefinition } from "./types";

export const wimdDefinition: ChartDatasetDefinition<WIMDDataset> = {
	type: "wimd", precompiledFile: "wimd",
	chart: { group: "Deprivation", key: "deprivation-wimd", label: "Deprivation (WIMD) [2019]", defaultVisible: false, componentPath: "@/components/deprivation/wimd/WIMDChart", boundaryType: "lsoa", calculateStats: (mm, g, d, l, id) => mm.calculateWIMDStats(g, d, l, id), year: 2019 },
	source: { name: "Welsh Index of Multiple Deprivation", source: "Welsh Government", sourceUrl: "https://www.gov.wales/welsh-index-multiple-deprivation", year: "2019", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Deprivation scores, ranks and deciles by lower super output area for Wales." },
	map: { valueKey: "wimdRank", colorRange: { min: 1, max: 1909 }, legend: { min: 1, max: 1909, format: String }, invertColor: false },
	precompile: async ({ text }) => loadWIMD(text),
};
