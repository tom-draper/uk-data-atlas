import { loadUnemployment } from "../../unemployment/loader";
import type { UnemploymentDataset } from "@/lib/types/unemployment";
import type { DatasetDefinition } from "../types";

export const unemploymentDatasetDefinition: DatasetDefinition<UnemploymentDataset> = {
	type: "unemployment", precompiledFile: "unemployment", boundaryType: "localAuthority",
	source: { name: "Unemployment", source: "Office for National Statistics", sourceUrl: "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/modelledunemploymentforlocalandunitaryauthoritiesm01/current", year: "2021", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Model-based unemployment rate estimates by local authority for Great Britain." },
	precompile: async ({ text }) => loadUnemployment(text),
};
