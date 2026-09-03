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
			"https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/placeofworkbylocalauthorityashetable7",
		year: "2025",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description:
			"Earnings estimates by local authority for England and Wales.",
	},
	precompile: ({ text }) => loadIncome(text),
};
