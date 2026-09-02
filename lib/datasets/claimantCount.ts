import { loadClaimantCount } from "@/lib/data/claimant-count/loader";
import type { ClaimantCountDataset } from "@/lib/types/claimantCount";
import type { ChartDatasetDefinition } from "./types";

export const claimantCountDefinition: ChartDatasetDefinition<ClaimantCountDataset> = {
	type: "claimantCount", precompiledFile: "claimant-count",
	chart: { group: "Economics", key: "economics-claimantCount", label: "Claimant Count [2026]", defaultVisible: true, componentPath: "@/components/economics/claimant-count/ClaimantCountChart", boundaryType: "localAuthority", calculateStats: (m, g, d, l, id) => m.calculateClaimantCountStats(g, d, l, id), year: 2026 },
	source: { name: "Claimant Count", source: "Office for National Statistics", sourceUrl: "https://www.nomisweb.co.uk/datasets/ucjsa", year: "2026", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Claimants of Universal Credit and Jobseeker's Allowance by local authority district for Great Britain." },
	map: { valueKey: "totalRate", colorRange: { min: 1, max: 8 }, legend: { min: 0, max: 20, format: (v) => `${v.toFixed(1)}% rate` } },
	precompile: ({ text }) => loadClaimantCount(text),
};
