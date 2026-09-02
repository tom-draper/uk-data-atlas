import { loadIncome } from "@/lib/data/income/loader";
import type { IncomeDataset } from "@/lib/types/income";
import type { ScalarDatasetDefinition } from "./types";

export const incomeDefinition: ScalarDatasetDefinition<IncomeDataset> = {
	type: "income", precompiledFile: "income",
	chart: { group: "Economics", key: "economics-income", label: "Income [2025]", defaultVisible: true, componentPath: "@/components/economics/income/IncomeChart", boundaryType: "localAuthority", calculateStats: (m, g, d, l, id) => m.calculateIncomeStats(g, d, l, id), year: 2025 },
	source: { name: "Income", source: "Office for National Statistics", sourceUrl: "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/placeofworkbylocalauthorityashetable7", year: "2025", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Earnings estimates by local authority for England and Wales." },
	map: { valueFor: (dataset, code) => dataset.data[code]?.annual?.median ?? null, colorRange: { min: 25000, max: 45000 }, legend: { min: 0, max: 80000, format: (v) => `£${v.toFixed(0)}` } },
	precompile: ({ text }) => loadIncome(text),
};
