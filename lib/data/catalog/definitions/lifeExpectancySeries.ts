import { loadLifeExpectancySeriesRows } from "../../life-expectancy/seriesLoader";
import type { LifeExpectancySeriesDataset } from "@/lib/types/lifeExpectancySeries";
import type { DatasetDefinition } from "../types";

export const lifeExpectancySeriesDatasetDefinition: DatasetDefinition<LifeExpectancySeriesDataset> =
	{
		type: "lifeExpectancySeries",
		precompiledFile: "life-expectancy-series",
		boundaryType: "localAuthority",
		// Every published period with its confidence interval, for the API. The
		// website charts only the latest period, from the life-expectancy dataset.
		chartPending: true,
		coverageCountries: ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"],
		source: {
			name: "Life Expectancy Series",
			source: "Office for National Statistics",
			sourceUrl:
				"https://www.ons.gov.uk/peoplepopulationandcommunity/healthandsocialcare/healthandlifeexpectancies/bulletins/lifeexpectancyforlocalareasoftheuk/between2001to2003and2022to2024",
			year: "2001-2003 to 2022-2024",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Life expectancy at birth for UK local areas, by sex, for every three-year period from 2001 to 2003 onwards, with 95% confidence intervals.",
		},
		ingestion: {
			minimumDatasets: 20,
			minimumDataRecords: 340,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["male", "female"],
		},
		precompile: ({ xlsxSheetSelectedRows }) =>
			loadLifeExpectancySeriesRows(xlsxSheetSelectedRows),
	};
