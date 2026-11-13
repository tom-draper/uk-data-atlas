import type { SIMDDataset } from "../../types/simd.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { summariseSIMD } from "../../helpers/datasetAggregation/deprivation.ts";
import {
	deprivationStatistics,
	rankDisplay,
} from "../deprivation/declaration.ts";
import { loadSIMD } from "./loader.ts";

export const simd = defineDataset<SIMDDataset>({
	id: "simd",
	topic: "deprivation",
	boundary: { type: "dataZone", year: 2011 },
	source: {
		name: "Scottish Index of Multiple Deprivation",
		publisher: "Scottish Government",
		sourceUrl:
			"https://www.gov.scot/collections/scottish-index-of-multiple-deprivation-2020/",
		year: "2020",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Scottish Government. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Published deprivation ranks, deciles and quintiles by data zone for Scotland.",
		cadence: "irregular",
		notes: [],
	},
	load: async ({ text, xlsxSheet }) =>
		loadSIMD(
			text,
			await xlsxSheet(
				sourceDir(
					"simd",
					"SIMD+2020v2+-+datazone+lookup+-+updated+2025.xlsx",
				),
				"SIMD 2020v2 DZ lookup data",
			),
		),
	statistics: deprivationStatistics({
		id: "simd",
		prefix: "simd",
		index: "Scottish Index of Multiple Deprivation",
		area: "data zones in Scotland",
		fields: { quintile: true, decile: true },
		boundary: { type: "dataZone", year: 2011 },
		edition: "2020",
		metadata: {
			source: "Scottish Government. Scottish Index of Multiple Deprivation 2020v2.",
			notes: [
				"Scotland only. Quintile 1 = most deprived 20% of data zones.",
			],
		},
		code: "dzCode",
		name: "dzName",
		parent: { code: "councilAreaCode", name: "councilAreaName" },
		summaryField: "councilStats",
		mostDeprived: (record) => record.simdDecile === 1,
	}),
	display: rankDisplay({
		prefix: "simd",
		label: "Deprivation (SIMD) [2020]",
		year: 2020,
		areaCount: 6976,
		aggregation: {
			scope: "dataZone",
			distinct: true,
			aggregate: summariseSIMD,
		},
	}),
});
