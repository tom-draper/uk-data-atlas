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
				"https://www.ons.gov.uk/peoplepopulationandcommunity/healthandsocialcare/healthandlifeexpectancies/bulletins/lifeexpectancyforlocalareasonenglandandwales/2020to2022",
			year: "2020-2022",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Life expectancy and healthy life expectancy estimates by local area for England and Wales.",
		},
		precompile: async ({ text }) => loadLE(text, true),
	};
