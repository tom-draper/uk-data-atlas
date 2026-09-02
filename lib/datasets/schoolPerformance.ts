import { loadSchoolPerformance } from "@/lib/data/school-performance/loader";
import type { SchoolPerformanceDataset } from "@/lib/types/schoolPerformance";
import type { ChartDatasetDefinition } from "./types";

export const schoolPerformanceDefinition: ChartDatasetDefinition<SchoolPerformanceDataset> = {
	type: "schoolPerformance", precompiledFile: "school-performance",
	chart: { group: "Education", key: "education-schoolPerformance", label: "School Performance [2024]", defaultVisible: true, componentPath: "@/components/education/SchoolPerformanceChart", boundaryType: "localAuthority", calculateStats: (m, g, d, l, id) => m.calculateSchoolPerformanceStats(g, d, l, id), year: 2024 },
	source: { name: "School Performance (KS4)", source: "Department for Education", sourceUrl: "https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance", year: "2024", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Key Stage 4 performance measures (GCSE results) by local authority district for England." },
	map: { valueKey: "ptL2basics94", colorRange: { min: 50, max: 80 }, legend: { min: 0, max: 100, format: (v) => `${v.toFixed(0)}% grade 4+` } },
	precompile: ({ text }) => loadSchoolPerformance(text),
};
