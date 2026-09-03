import { claimantCountDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { ClaimantCountDataset } from "@/lib/types/claimantCount";
import type { ChartDatasetDefinition } from "./types";

export const claimantCountDefinition: ChartDatasetDefinition<ClaimantCountDataset> = {
	...claimantCountDatasetDefinition,
	chart: { group: "Economics", key: "economics-claimantCount", label: "Claimant Count [2026]", defaultVisible: true, componentPath: "@/components/economics/claimant-count/ClaimantCountChart", calculateStats: (m, g, d, l, id) => m.calculateClaimantCountStats(g, d, l, id), year: 2026 },
	map: { valueKey: "totalRate", colorRange: { min: 1, max: 8 }, legend: { min: 0, max: 20, format: (v) => `${v.toFixed(1)}% rate` } },
};
