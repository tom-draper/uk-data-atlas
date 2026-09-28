import { loadWorkplaceIncome } from "../../income/loader";
import type { WorkplaceIncomeDataset } from "@/lib/types/income";
import type { DatasetDefinition } from "../types";

export const workplaceIncomeDatasetDefinition: DatasetDefinition<WorkplaceIncomeDataset> =
	{
		type: "workplaceIncome",
		precompiledFile: "workplace-income",
		boundaryType: "localAuthority",
		coverageCountries: ["GB-ENG"],
		chartPending: true,
		source: {
			name: "Workplace income",
			source: "Office for National Statistics",
			sourceUrl:
				"https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/workplacebylocalauthorityashetable7",
			year: "2025",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Earnings estimates by local authority of workplace for England.",
		},
		precompile: ({ xlsxSheet }) =>
			loadWorkplaceIncome((path) => xlsxSheet(path, "All")),
	};
