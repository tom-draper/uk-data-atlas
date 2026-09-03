import { nhsWaitingDatasetDefinition } from "@/lib/data/catalog/definitions";
import type { NHSWaitingDataset } from "@/lib/types/nhsWaiting";
import type { ChartDatasetDefinition } from "./types";

export const nhsWaitingDefinition: ChartDatasetDefinition<NHSWaitingDataset> = {
	...nhsWaitingDatasetDefinition,
	chart: { group: "Health", key: "health-nhsWaiting", label: "NHS Waiting Times [Mar 2026]", defaultVisible: true, componentPath: "@/components/health/NHSWaitingChart", boundaryType: "localAuthority", calculateStats: (m, g, _d, l, id, dataset) => dataset ? m.calculateNHSWaitingStats(g, dataset, l, id) : null, year: 2026 },
	map: { valueFor: (dataset, code) => { const icbCode = dataset.ladToIcb[code]; return icbCode ? dataset.data[icbCode]?.pctOver18Weeks ?? null : null; }, colorRange: { min: 25, max: 40 }, legend: { min: 0, max: 100, format: (v) => `${v.toFixed(0)}% >18wks` } },
};
