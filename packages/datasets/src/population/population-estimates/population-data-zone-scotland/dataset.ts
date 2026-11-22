import type { IndicatorDataset } from "../../../types/indicator.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { POPULATION, SEX } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import {
	DATA_ZONE_2022_COUNT,
	populationDataZoneScotlandStatisticsParts,
} from "../../../data/population-small-area/source.ts";

export const populationDataZoneScotland = defineDataset<
	IndicatorDataset<"population-data-zone-scotland">
>({
	id: "population-data-zone-scotland",
	topic: "population-estimates",
	guide: {
		title: "Population (Scottish data zones)",
		about: "How many people live in each data zone of Scotland, the small neighbourhoods Scotland's statistics are built from, every year from 2011. The base the atlas adds up to put every year of population on Scottish wards, councils and constituencies.",
		summary:
			"Official mid-year population estimates for Scotland's 2022 data zones, 2011 to 2024.",
	},
	source: {
		name: "Population (Scottish data zones)",
		publisher: "National Records of Scotland",
		sourceUrl:
			"https://www.nrscotland.gov.uk/publications/small-area-population-estimates-for-mid-2011-to-mid-2024-2022-data-zones/",
		year: "2011-2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"National Records of Scotland © Crown copyright. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Mid-year population of each of Scotland's 2022 data zones, mid-2011 to mid-2024, rebased on the 2022 census. The total of persons of all ages is held; the workbooks also give single years of age by sex.",
		cadence: "annual",
		notes: [
			"Published 1 September 2026, replacing earlier estimates on the 2011 data zones.",
		],
	},
	boundary: { type: "dataZone", year: 2022 },
	coverageCountries: ["GB-SCT"],
	chartPending: true,
	ingestion: {
		minimumDatasets: 14,
		minimumDataRecords: DATA_ZONE_2022_COUNT,
		expectedBoundaryYears: [2022],
		requiredDataFields: ["value"],
	},
	statistics: {
		direct: {
			only: true,
			read: ({ xlsxSheetSelectedRows }) =>
				populationDataZoneScotlandStatisticsParts(
					xlsxSheetSelectedRows,
				),
		},
		payload: {
			parts: yearParts(
				"population-data-zone-scotland",
				"dataZone",
				2022,
				{
					coverageCountries: ["GB-SCT"],
				},
			),
			code: "code",
		},
		name: "name",
		period: (key) => periods.year(Number(key)),
		measures: [POPULATION],
		dimensions: [SEX],
		fields: [
			{ path: "value", measure: "population", members: { sex: "all" } },
		],
	},
});
