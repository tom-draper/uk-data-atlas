import { loadHomelessness } from "../../homelessness/loader";
import type { HomelessnessDataset } from "@/lib/types/homelessness";
import type { DatasetDefinition } from "../types";

export const homelessnessDatasetDefinition: DatasetDefinition<HomelessnessDataset> = {
	type: "homelessness", precompiledFile: "homelessness", boundaryType: "localAuthority",
	source: { name: "Temporary Accommodation", source: "Ministry of Housing, Communities and Local Government", sourceUrl: "https://www.gov.uk/government/statistical-data-sets/live-tables-on-homelessness", year: "January-March 2026", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Households in temporary accommodation by English local authority, including households with children." },
	precompile: async (reader) => loadHomelessness(await reader.odsContent("economics/homelessness/homelessness-2026-q1.ods")),
};
