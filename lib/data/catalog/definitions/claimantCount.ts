import { loadClaimantCount } from "../../claimant-count/loader";
import type { ClaimantCountDataset } from "@/lib/types/claimantCount";
import type { DatasetDefinition } from "../types";

export const claimantCountDatasetDefinition: DatasetDefinition<ClaimantCountDataset> =
	{
		type: "claimantCount",
		precompiledFile: "claimant-count",
		boundaryType: "localAuthority",
		source: {
			name: "Claimant Count",
			source: "Office for National Statistics",
			sourceUrl: "https://www.nomisweb.co.uk/datasets/ucjsa",
			year: "2026",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Claimants of Universal Credit and Jobseeker's Allowance by local authority district for Great Britain.",
		},
		precompile: ({ text }) => loadClaimantCount(text),
	};
