import { loadBrexitConstituency } from "../../brexit-constituency/loader";
import type { BrexitConstituencyDataset } from "@/lib/types/referendum";
import type { DatasetDefinition } from "../types";

export const brexitConstituencyDatasetDefinition: DatasetDefinition<BrexitConstituencyDataset> =
	{
		type: "brexitConstituency",
		precompiledFile: "brexit-constituency",
		boundaryType: "constituency",
		source: {
			name: "EU Referendum Results (Constituency Estimates)",
			source: "Hanretty, C. (2017). Areal interpolation and the UK's referendum on EU membership. Journal of Elections, Public Opinion and Parties, 27(4), 466-483.",
			sourceUrl: "https://commonslibrary.parliament.uk/",
			year: "2016",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"EU referendum result estimates by Westminster parliamentary constituency.",
		},
		precompile: async ({ text }) => loadBrexitConstituency(text),
	};
