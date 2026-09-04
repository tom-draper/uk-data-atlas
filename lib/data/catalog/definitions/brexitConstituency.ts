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
			sourceUrl:
				"https://commonslibrary.parliament.uk/brexit-votes-by-constituency/",
			year: "2016",
			licence: "Open Parliament Licence",
			licenceUrl:
				"https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/",
			description:
				"EU referendum result estimates by Westminster parliamentary constituency.",
		},
		precompile: async ({ xlsxSheet }) =>
			loadBrexitConstituency((path) => xlsxSheet(path, "DATA")),
	};
