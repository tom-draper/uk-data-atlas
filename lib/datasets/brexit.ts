import { loadBrexit } from "@/lib/data/brexit/loader";
import type { BrexitLADDataset } from "@/lib/types/referendum";
import type { ChartDatasetDefinition } from "./types";

export const brexitDefinition: ChartDatasetDefinition<BrexitLADDataset> = {
	type: "brexit", precompiledFile: "brexit",
	chart: { group: "Brexit", key: "brexit-electoral", label: "Electoral Commission [2016]", defaultVisible: true, componentPath: "@/components/elections/referendum/BrexitElectoralChart", boundaryType: "localAuthority", calculateStats: (mm, g, d, l, id) => mm.calculateBrexitStats(g, d, l, id), year: 2016 },
	source: { name: "EU Referendum Results", source: "Electoral Commission", sourceUrl: "https://www.electoralcommission.org.uk/research-reports-and-data/our-reports-and-data-past-elections-and-referendums/results-and-turnout-eu-referendum", year: "2016", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "EU referendum results by local authority counting area." },
	precompile: async ({ text }) => loadBrexit(text),
};
