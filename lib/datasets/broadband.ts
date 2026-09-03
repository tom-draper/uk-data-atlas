import { broadbandDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { BroadbandDataset } from "@/lib/types/broadband";
import type { ChartDatasetDefinition } from "./types";

export const broadbandDefinition: ChartDatasetDefinition<BroadbandDataset> = {
	...broadbandDatasetDefinition,
	chart: { group: "Telecoms", key: "telecoms-broadband", label: "Fixed Broadband Coverage [2025]", defaultVisible: true, componentPath: "@/components/telecoms/broadband/BroadbandChart", boundaryType: "localAuthority", calculateStats: (m, g, d, l, id) => m.calculateBroadbandStats(g, d, l, id), year: 2025 },
	map: { valueKey: "pctFullFibre", colorRange: { min: 50, max: 100 }, legend: { min: 0, max: 100, format: (v) => `${v.toFixed(0)}% full fibre` } },
};
