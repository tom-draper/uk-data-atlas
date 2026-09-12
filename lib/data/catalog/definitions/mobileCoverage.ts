import { loadMobileCoverage } from "../../mobile-coverage/loader";
import type { MobileCoverageDataset } from "@/lib/types/mobileCoverage";
import type { DatasetDefinition } from "../types";

export const mobileCoverageDatasetDefinition: DatasetDefinition<MobileCoverageDataset> =
	{
		type: "mobileCoverage",
		precompiledFile: "mobile-coverage",
		boundaryType: "localAuthority",
		coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
		source: {
			name: "Mobile Coverage",
			source: "Ofcom",
			sourceUrl:
				"https://www.ofcom.org.uk/phones-and-broadband/coverage-and-speeds/connected-nations-20252/data-downloads-2025",
			year: "2025",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"4G and 5G coverage by local authority district across the UK, reported as the share of premises and landmass reached by all four mobile operators and by at least one.",
		},
		ingestion: {
			minimumDataRecords: 361,
			expectedBoundaryYears: [2024],
			requiredDataFields: ["pct4GIndoorAll", "pct5GOutdoorAll"],
		},
		precompile: ({ text }) => loadMobileCoverage(text),
	};
