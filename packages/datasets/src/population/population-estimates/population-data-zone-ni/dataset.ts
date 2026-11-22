import type { IndicatorDataset } from "../../../types/indicator.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { POPULATION, SEX } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import {
	DATA_ZONE_NI_2021_COUNT,
	populationDataZoneNiStatisticsParts,
} from "../../../data/population-small-area/source.ts";

export const populationDataZoneNi = defineDataset<
	IndicatorDataset<"population-data-zone-ni">
>({
	id: "population-data-zone-ni",
	topic: "population-estimates",
	guide: {
		title: "Population (Northern Ireland data zones)",
		about: "How many people live in each data zone of Northern Ireland, the small areas built for the 2021 census, every year from 2021. The base the atlas adds up to put population on Northern Ireland's councils.",
		summary:
			"Official mid-year population estimates for Northern Ireland's 2021 data zones, 2021 to 2024.",
	},
	source: {
		name: "Population (Northern Ireland data zones)",
		publisher: "Northern Ireland Statistics and Research Agency",
		sourceUrl:
			"https://www.nisra.gov.uk/publications/2024-mid-year-population-estimates-small-geographical-areas-within-northern-ireland",
		year: "2021-2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Northern Ireland Statistics and Research Agency © Crown copyright. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Mid-year population of each of Northern Ireland's 2021 data zones, mid-2021 to mid-2024. NISRA publishes the total only at this level.",
		cadence: "annual",
		notes: [
			"Rounded to the nearest person, so data zones may not add to the published council totals. NISRA advises that precision to the person should not be assumed.",
		],
	},
	boundary: { type: "dataZone", year: 2021 },
	coverageCountries: ["GB-NIR"],
	chartPending: true,
	ingestion: {
		minimumDatasets: 4,
		minimumDataRecords: DATA_ZONE_NI_2021_COUNT,
		expectedBoundaryYears: [2021],
		requiredDataFields: ["value"],
	},
	statistics: {
		direct: {
			only: true,
			read: ({ xlsxSheetSelectedRows }) =>
				populationDataZoneNiStatisticsParts(xlsxSheetSelectedRows),
		},
		payload: {
			parts: yearParts("population-data-zone-ni", "dataZone", 2021, {
				coverageCountries: ["GB-NIR"],
			}),
			code: "code",
		},
		period: (key) => periods.year(Number(key)),
		measures: [POPULATION],
		dimensions: [SEX],
		fields: [
			{ path: "value", measure: "population", members: { sex: "all" } },
		],
	},
});
