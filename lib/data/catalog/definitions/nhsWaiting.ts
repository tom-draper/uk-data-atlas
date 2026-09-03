import { loadNHSWaiting } from "../../nhs-waiting/loader";
import type { NHSWaitingDataset } from "@/lib/types/nhsWaiting";
import type { DatasetDefinition } from "../types";

export const nhsWaitingDatasetDefinition: DatasetDefinition<NHSWaitingDataset> = {
	type: "nhsWaiting", precompiledFile: "nhs-waiting", boundaryType: "localAuthority",
	source: { name: "NHS Waiting Times", source: "NHS England", sourceUrl: "https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/", year: "2026", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Referral to treatment waiting times by Integrated Care Board for England." },
	precompile: ({ zipCsv }) => loadNHSWaiting(zipCsv),
};
