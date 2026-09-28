import { loadCouncilTax } from "../../new-datasets/loader";
import type { IndicatorDataset } from "@/lib/types/indicator";
import type { DatasetDefinition } from "../types";

export const councilTaxDatasetDefinition: DatasetDefinition<
	IndicatorDataset<"councilTax">
> = {
	type: "councilTax",
	precompiledFile: "council-tax",
	boundaryType: "localAuthority",
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Council Tax levels in England",
		source: "Ministry of Housing, Communities and Local Government",
		sourceUrl:
			"https://www.gov.uk/government/statistics/council-tax-levels-set-by-local-authorities-in-england-2026-to-2027",
		year: "2026-27",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Average Band D council tax set by English billing authorities.",
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2026],
		requiredDataFields: ["value"],
	},
	precompile: ({ odsContent }) => loadCouncilTax(odsContent),
};
