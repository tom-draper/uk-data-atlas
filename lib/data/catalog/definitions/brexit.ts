import { loadBrexit } from "../../brexit/loader";
import type { BrexitLADDataset } from "@/lib/types/referendum";
import type { DatasetDefinition } from "../types";

export const brexitDatasetDefinition: DatasetDefinition<BrexitLADDataset> = {
	type: "brexit", precompiledFile: "brexit", boundaryType: "localAuthority",
	source: { name: "EU Referendum Results", source: "Electoral Commission", sourceUrl: "https://www.electoralcommission.org.uk/research-reports-and-data/our-reports-and-data-past-elections-and-referendums/results-and-turnout-eu-referendum", year: "2016", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "EU referendum results by local authority counting area." },
	precompile: async ({ text }) => loadBrexit(text),
};
