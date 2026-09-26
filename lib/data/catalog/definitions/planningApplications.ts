import { loadPlanningApplications } from "../../new-datasets/loader";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { DatasetDefinition } from "../types";

export const planningApplicationsDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"planningApplications">
> = {
	type: "planningApplications",
	precompiledFile: "planning-applications",
	boundaryType: "localAuthority",
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Planning applications in England",
		source: "Ministry of Housing, Communities and Local Government",
		sourceUrl:
			"https://www.gov.uk/government/statistical-data-sets/live-tables-on-planning-application-statistics",
		year: "2026 Q1",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Planning applications received by English local planning authority during 2026 Q1.",
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	precompile: ({ text }) => loadPlanningApplications(text),
};
