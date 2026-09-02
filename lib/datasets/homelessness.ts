import { loadHomelessness } from "@/lib/data/homelessness/loader";
import type { HomelessnessDataset } from "@/lib/types/homelessness";
import type { ScalarDatasetDefinition } from "./types";

export const homelessnessDefinition: ScalarDatasetDefinition<HomelessnessDataset> = {
	type: "homelessness",
	precompiledFile: "homelessness",
	sourcePath: "economics/homelessness/homelessness-2026-q1.ods",
	chart: {
		group: "Economics",
		key: "economics-homelessness",
		label: "Homelessness [2026]",
		defaultVisible: true,
	},
	source: {
		name: "Temporary Accommodation",
		source: "Ministry of Housing, Communities and Local Government",
		sourceUrl: "https://www.gov.uk/government/statistical-data-sets/live-tables-on-homelessness",
		year: "January-March 2026",
		licence: "Open Government Licence v3.0",
		licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Households in temporary accommodation by English local authority, including households with children.",
	},
	load: loadHomelessness,
	map: {
		codeLevel: "localAuthority",
		valueKey: "householdsPerThousand",
		mapOptionsKey: "homelessness",
	},
};
