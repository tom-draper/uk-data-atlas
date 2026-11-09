import { loadChildPoverty } from "../../child-poverty/loader.ts";
import type { ChildPovertyDataset } from "../../../types/childPoverty.ts";
import type { DatasetDefinition } from "../types.ts";

export const childPovertyDatasetDefinition: DatasetDefinition<ChildPovertyDataset> =
	{
		type: "childPoverty",
		precompiledFile: "child-poverty",
		boundaryType: "localAuthority",
		mapValueField: "childPovertyRate",
		source: {
			name: "Child Poverty",
			source: "Department for Work and Pensions",
			sourceUrl:
				"https://www.gov.uk/government/statistics/children-in-low-income-families-local-area-statistics-2022-to-2025",
			year: "2022 to 2025",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Children aged under 16 living in relative low-income families, before housing costs, by local authority across the United Kingdom.",
		},
		precompile: ({ odsTableRows }) => loadChildPoverty(odsTableRows),
	};
