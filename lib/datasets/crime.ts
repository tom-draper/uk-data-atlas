import { loadCrime } from "@/lib/data/crime/loader";
import type { CrimeDataset } from "@/lib/types/crime";
import type { ChartDatasetDefinition } from "./types";

export const crimeDefinition: ChartDatasetDefinition<CrimeDataset> = {
	type: "crime", precompiledFile: "crime",
	chart: { group: "Economics", key: "economics-crime", label: "Crime Rate [2025]", defaultVisible: true, componentPath: "@/components/economics/crime/CrimeRateChart", boundaryType: "localAuthority", calculateStats: (m, g, d, l, id) => m.calculateCrimeStats(g, d, l, id), year: 2025 },
	source: { name: "Crime", source: "Office for National Statistics", sourceUrl: "https://www.ons.gov.uk/peoplepopulationandcommunity/crimeandjustice/datasets/policeforceareadatatables", year: "2025", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Police recorded crime by local authority district for England and Wales." },
	map: { valueKey: "totalRecordedCrime", colorRange: { min: 10000, max: 100000 }, legend: { min: 0, max: 150000, format: (v) => v.toFixed(0) } },
	precompile: ({ text }) => loadCrime(text),
};
