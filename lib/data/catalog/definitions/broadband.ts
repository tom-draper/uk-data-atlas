import { loadBroadband } from "../../broadband/loader";
import type { BroadbandDataset } from "@/lib/types/broadband";
import type { DatasetDefinition } from "../types";

export const broadbandDatasetDefinition: DatasetDefinition<BroadbandDataset> = {
	type: "broadband",
	precompiledFile: "broadband",
	boundaryType: "localAuthority",
	source: {
		name: "Broadband Coverage",
		source: "Ofcom",
		sourceUrl:
			"https://www.ofcom.org.uk/research-and-data/telecoms-research/connected-nations",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Fixed broadband coverage by local authority district across the UK.",
	},
	precompile: ({ text }) => loadBroadband(text),
};
