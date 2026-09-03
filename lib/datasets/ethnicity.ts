import { ethnicityDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { EthnicityDataset } from "@/lib/types/ethnicity";
import type { ChartDatasetDefinition } from "./types";

export const ethnicityDefinition: ChartDatasetDefinition<EthnicityDataset> = {
	...ethnicityDatasetDefinition,
	chart: { group: "Demographics", key: "demographics-ethnicity", label: "Ethnicity [2021]", defaultVisible: true, componentPath: "@/components/demographics/ethnicity-registry", boundaryType: "localAuthority", calculateStats: (mm, g, d, l, id) => mm.calculateEthnicityStats(g, d, l, id), year: 2021 },
};
