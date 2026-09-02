import { loadChildPoverty } from "@/lib/data/child-poverty/loader";
import type { ChildPovertyDataset } from "@/lib/types/childPoverty";
import type { ScalarDatasetDefinition } from "./types";

export const childPovertyDefinition: ScalarDatasetDefinition<ChildPovertyDataset> = {
	type: "childPoverty",
	precompiledFile: "child-poverty",
	sourcePath: "economics/child-poverty/children-in-low-income-families-2022-2025.ods",
	chart: {
		group: "Economics",
		key: "economics-childPoverty",
		label: "Child Poverty [2025]",
		defaultVisible: true,
	},
	source: {
		name: "Child Poverty",
		source: "Department for Work and Pensions",
		sourceUrl: "https://www.gov.uk/government/statistics/children-in-low-income-families-local-area-statistics-2022-to-2025",
		year: "2022 to 2025",
		licence: "Open Government Licence v3.0",
		licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Children aged under 16 living in relative low-income families, before housing costs, by local authority across the United Kingdom.",
	},
	map: {
		valueKey: "childPovertyRate",
		colorRange: { min: 10, max: 35 },
		legend: { min: 0, max: 60, format: (value) => `${value.toFixed(0)}% children` },
	},
	load: loadChildPoverty,
	map: {
		codeLevel: "localAuthority",
		valueKey: "childPovertyRate",
		mapOptionsKey: "childPoverty",
	},
};
