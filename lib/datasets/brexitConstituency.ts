import { brexitConstituencyDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { BrexitConstituencyDataset } from "@/lib/types/referendum";
import type { ChartDatasetDefinition } from "./types";

export const brexitConstituencyDefinition: ChartDatasetDefinition<BrexitConstituencyDataset> = {
	...brexitConstituencyDatasetDefinition,
	chart: { group: "Brexit", key: "brexit-hanretty", label: "Hanretty Estimates [2016]", defaultVisible: false, componentPath: "@/components/elections/referendum/BrexitHanrettyEstimatesChart", calculateStats: (mm, g, d, l, id) => mm.calculateBrexitConstituencyStats(g, d, l, id), year: 2016 },
};
