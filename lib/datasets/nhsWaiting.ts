import { loadNHSWaiting } from "@/lib/data/nhs-waiting/loader";
import type { NHSWaitingDataset } from "@/lib/types/nhsWaiting";
import type { ScalarDatasetDefinition } from "./types";

export const nhsWaitingDefinition: ScalarDatasetDefinition<NHSWaitingDataset> = {
	type: "nhsWaiting", precompiledFile: "nhs-waiting",
	chart: { group: "Health", key: "health-nhsWaiting", label: "NHS Waiting Times [Mar 2026]", defaultVisible: true, componentPath: "@/components/health/NHSWaitingChart", boundaryType: "localAuthority", calculateStats: (m, g, _d, l, id, dataset) => dataset ? m.calculateNHSWaitingStats(g, dataset, l, id) : null, year: 2026 },
	source: { name: "NHS Waiting Times", source: "NHS England", sourceUrl: "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/", year: "2026", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Referral to treatment waiting times by Integrated Care Board for England." },
	map: { valueFor: (dataset, code) => { const icbCode = dataset.ladToIcb[code]; return icbCode ? dataset.data[icbCode]?.pctOver18Weeks ?? null : null; }, colorRange: { min: 25, max: 40 }, legend: { min: 0, max: 100, format: (v) => `${v.toFixed(0)}% >18wks` } },
	precompile: ({ zipCsv }) => loadNHSWaiting(zipCsv),
};
