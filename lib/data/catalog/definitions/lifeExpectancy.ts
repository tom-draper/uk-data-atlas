import { loadLE } from "../../life-expectancy/loader";
import type { LifeExpectancyDataset } from "@/lib/types/lifeExpectancy";
import type { DatasetDefinition } from "../types";

export const lifeExpectancyDatasetDefinition: DatasetDefinition<LifeExpectancyDataset> =
	{
		type: "lifeExpectancy",
		precompiledFile: "life-expectancy",
		boundaryType: "localAuthority",
		source: {
			name: "Life Expectancy",
			source: "Office for National Statistics",
			sourceUrl:
				"https://www.ons.gov.uk/peoplepopulationandcommunity/healthandsocialcare/healthandlifeexpectancies/bulletins/lifeexpectancyforlocalareasoftheuk/between2001to2003and2022to2024",
			year: "2022-2024",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Life expectancy and healthy life expectancy estimates by local area across the UK.",
		},
		// Both source workbooks carry their local-area data on sheet 1.
		precompile: async ({ text, xlsxSheet }) =>
			loadLE((path) =>
				path.endsWith(".xlsx") ? xlsxSheet(path, "1") : text(path),
			),
	};
