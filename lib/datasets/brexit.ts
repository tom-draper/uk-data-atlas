import { brexitDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { BrexitLADDataset } from "@/lib/types/referendum";
import type { ChartDatasetDefinition } from "./types";

export const brexitDefinition: ChartDatasetDefinition<BrexitLADDataset> = {
	...brexitDatasetDefinition,
	chart: { group: "Brexit", key: "brexit-electoral", label: "Electoral Commission [2016]", defaultVisible: true, componentPath: "@/components/elections/referendum/BrexitElectoralChart", boundaryType: "localAuthority", calculateStats: (mm, g, d, l, id) => mm.calculateBrexitStats(g, d, l, id), year: 2016 },
};
