import type { LifeExpectancySeriesDataset } from "../../types/lifeExpectancySeries.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { LIFE_EXPECTANCY, SEX } from "../../declaration/measures.ts";
import { periods, type DeclaredHeader } from "../../declaration/statistics.ts";
import { loadLifeExpectancySeriesRows } from "../life-expectancy/seriesLoader.ts";

export const lifeExpectancySeries = defineDataset<LifeExpectancySeriesDataset>({
	id: "life-expectancy-series",
	topic: "life-expectancy",
	source: {
		name: "Life Expectancy Series",
		publisher: "Office for National Statistics",
		sourceUrl:
			"https://www.ons.gov.uk/peoplepopulationandcommunity/healthandsocialcare/healthandlifeexpectancies/bulletins/lifeexpectancyforlocalareasoftheuk/between2001to2003and2022to2024",
		year: "2001-2003 to 2022-2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Life expectancy at birth for UK local areas, by sex, for every three-year period from 2001 to 2003 onwards, with 95% confidence intervals.",
		cadence: "annual",
		notes: [],
	},
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"],
	chartPending: true,
	ingestion: {
		minimumDatasets: 20,
		minimumDataRecords: 340,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["male", "female"],
	},
	load: ({ xlsxSheetSelectedRows }) =>
		loadLifeExpectancySeriesRows(xlsxSheetSelectedRows),
	statistics: {
		payload: {
			parts: (labels) =>
				labels.flatMap((label) => {
					const years = /^(\d{4})-(\d{4})$/.exec(label);
					return years
						? [
								{
									key: years[2],
									header: {
										id: `life-expectancy-series${years[2]}`,
										type: "life-expectancy-series",
										year: Number(years[2]),
										period: label,
										boundaryType: "localAuthority",
										boundaryYear: 2025,
										coverageCountries: [
											"GB-ENG",
											"GB-SCT",
											"GB-WLS",
											"GB-NIR",
										],
									},
								},
							]
						: [];
				}),
			code: "ladCode",
		},
		name: "ladName",
		period: (_key, header: DeclaredHeader) => range(header.period),
		measures: [LIFE_EXPECTANCY],
		dimensions: [SEX],
		fields: [
			{
				path: "{sex}.value",
				lower: "{sex}.lower",
				upper: "{sex}.upper",
				measure: "life-expectancy",
			},
		],
	},
});

const range = (text: unknown) => {
	const match = /^(\d{4})[-–](\d{4})$/.exec(String(text));
	if (!match) throw new Error(`Unknown year range ${String(text)}`);
	return periods.years(Number(match[1]), Number(match[2]));
};
