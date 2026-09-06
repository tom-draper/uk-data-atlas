import { loadIncome } from "../../income/loader";
import type { IncomeDataset } from "@/lib/types/income";
import type { DatasetDefinition } from "../types";

export const incomeDatasetDefinition: DatasetDefinition<IncomeDataset> = {
	type: "income",
	precompiledFile: "income",
	boundaryType: "localAuthority",
	source: {
		name: "Income",
		source: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/placeofresidencebylocalauthorityashetable8",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Earnings estimates by local authority of residence for England and Wales.",
	},
	// Each workbook holds the same table split by sex and hours; "All" is the
	// sheet covering every employee job.
	precompile: ({ xlsxSheet }) => loadIncome((path) => xlsxSheet(path, "All")),
};
