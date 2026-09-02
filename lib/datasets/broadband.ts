import { loadBroadband } from "@/lib/data/broadband/loader";
import type { BroadbandDataset } from "@/lib/types/broadband";
import type { ChartDatasetDefinition } from "./types";

export const broadbandDefinition: ChartDatasetDefinition<BroadbandDataset> = {
	type: "broadband", precompiledFile: "broadband",
	chart: { group: "Telecoms", key: "telecoms-broadband", label: "Fixed Broadband Coverage [2025]", defaultVisible: true, componentPath: "@/components/telecoms/broadband/BroadbandChart", boundaryType: "localAuthority", calculateStats: (m, g, d, l, id) => m.calculateBroadbandStats(g, d, l, id), year: 2025 },
	source: { name: "Broadband Coverage", source: "Ofcom", sourceUrl: "https://www.ofcom.org.uk/research-and-data/telecoms-research/connected-nations", year: "2025", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Fixed broadband coverage by local authority district across the UK." },
	map: { valueKey: "pctFullFibre", colorRange: { min: 50, max: 100 }, legend: { min: 0, max: 100, format: (v) => `${v.toFixed(0)}% full fibre` } },
	precompile: ({ text }) => loadBroadband(text),
};
