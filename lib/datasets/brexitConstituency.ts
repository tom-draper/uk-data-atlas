import { loadBrexitConstituency } from "@/lib/data/brexit-constituency/loader";
import type { BrexitConstituencyDataset } from "@/lib/types/referendum";
import type { ChartDatasetDefinition } from "./types";

export const brexitConstituencyDefinition: ChartDatasetDefinition<BrexitConstituencyDataset> = {
	type: "brexitConstituency", precompiledFile: "brexit-constituency",
	chart: { group: "Brexit", key: "brexit-hanretty", label: "Hanretty Estimates [2016]", defaultVisible: false, componentPath: "@/components/elections/referendum/BrexitHanrettyEstimatesChart", boundaryType: "constituency", calculateStats: (mm, g, d, l, id) => mm.calculateBrexitConstituencyStats(g, d, l, id), year: 2016 },
	source: { name: "EU Referendum Results (Constituency Estimates)", source: "Hanretty, C. (2017). Areal interpolation and the UK's referendum on EU membership. Journal of Elections, Public Opinion and Parties, 27(4), 466-483.", sourceUrl: "https://commonslibrary.parliament.uk/", year: "2016", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "EU referendum result estimates by Westminster parliamentary constituency." },
	precompile: async ({ text }) => loadBrexitConstituency(text),
};
