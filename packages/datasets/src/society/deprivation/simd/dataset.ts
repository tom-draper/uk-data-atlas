import type { SIMDDataset } from "../../../types/simd.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { sourceDir } from "../../../declaration/sources.ts";
import { summariseSIMD } from "../../../helpers/datasetAggregation/deprivation.ts";
import {
	deprivationStatistics,
	rankDisplay,
} from "../../../data/deprivation/declaration.ts";
import { parseCsv } from "../../../helpers/parseCsv.ts";
import type { DirectRecord } from "../../../declaration/statistics.ts";
import { publishedSIMDRanks } from "../../../data/simd/source.ts";

export const simd = defineDataset<SIMDDataset>({
	id: "simd",
	topic: "deprivation",
	boundary: { type: "dataZone", year: 2011 },
	guide: {
		title: "Scottish Index of Multiple Deprivation",
		about: "Scotland's index of deprivation, ranking each of its small areas, called data zones, from most to least deprived. It's widely used to target funding and services in Scotland.",
		summary:
			"The Scottish Index of Multiple Deprivation, ranking small neighbourhoods from most to least deprived. Each nation measures deprivation its own way, so ranks can't be compared across borders.",
	},
	mapName: "Deprivation (SIMD)",
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
	placeHeadline: {
		places: ["localAuthority"],
		order: 42,
		label: "Deprivation",
		about: "Share of its data zones in Scotland's most deprived 10%",
	},
	statistics: {
		...deprivationStatistics({
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
		direct: {
			only: true,
			read: async ({ text, xlsxSheet }) => {
				const lookup = await xlsxSheet(
					sourceDir(
						"simd",
						"SIMD+2020v2+-+datazone+lookup+-+updated+2025.xlsx",
					),
					"SIMD 2020v2 DZ lookup data",
				);
				const { data } = await parseCsv<Record<string, string>>(
					await text(
						sourceDir("simd", "SIMD+2020v2+-+indicators.csv"),
					),
					{ header: true },
				);
				const published = await publishedSIMDRanks(lookup);
				const records = new Map<string, DirectRecord>();
				for (const row of data) {
					const code = row.Data_Zone?.trim();
					if (!code || !code.startsWith("S")) continue;
					const ranks = published.get(code);
					if (!ranks)
						throw new Error(
							`SIMD lookup: no published rank for ${code}`,
						);
					records.set(code, {
						code,
						name: row.Intermediate_Zone?.trim() || "",
						parents: {
							councilAreaCode: {
								code: ranks.councilAreaCode,
								name:
									row.Council_area?.trim() ||
									row.Council_Area?.trim() ||
									"",
							},
						},
						values: [
							{ measure: "simd-rank", value: ranks.rank },
							{ measure: "simd-quintile", value: ranks.quintile },
							{ measure: "simd-decile", value: ranks.decile },
						],
					});
				}
				return [{ key: "2020", records: [...records.values()] }];
			},
		},
	},
	ranking: {
		label: "Data zones in Scotland's most deprived 10%",
		format: { kind: "decimal", digits: 1, suffix: "%" },
	},
	catalogue: {
		kind: "indicators",
		yearly: true,
		partial: true,
		checks: ["manifest-areas"],
		coverageNote:
			"Scotland only. The other three nations publish their own indices, which are not comparable with this one.",
		indicators: [
			{
				id: "simd-rank",
				label: "Scottish Index of Multiple Deprivation rank",
				field: "simdRank",
				valueKind: "ordinal",
				unit: "rank of {areas} data zones, where 1 is the most deprived",
				aggregation: {
					kind: "non-aggregatable",
					statistic: "rank",
					note: "A rank records an order, not a distance: the gap between ranks 1 and 2 need not equal the gap between 100 and 101. Averaging ranks over areas produces a number with no meaning.",
				},
				notes: [
					"A position within Scotland alone. The English, Welsh and Northern Irish indices use different methods, domains and dates, so a rank or decile cannot be compared across nations.",
					"SIMD 2020v2, taken from the Scottish Government's published data zone lookup, whose ranks agree with its separately published ranks workbook.",
				],
				measure: "simd-rank",
			},
			{
				id: "simd-decile",
				label: "Scottish Index of Multiple Deprivation decile",
				field: "simdDecile",
				valueKind: "ordinal",
				unit: "decile, where 1 is the most deprived tenth of data zones",
				aggregation: {
					kind: "non-aggregatable",
					statistic: "decile",
					note: "A decile is a band of ranks. Averaging deciles over areas produces a number with no meaning, and the share of a place's data zones in each decile is the defensible summary instead.",
				},
				notes: [
					"A position within Scotland alone. The English, Welsh and Northern Irish indices use different methods, domains and dates, so a rank or decile cannot be compared across nations.",
					"Taken from the Scottish Government's published data zone lookup. Quintiles are also published there but are not offered as a measure.",
				],
				measure: "simd-decile",
			},
		],
	},
	display: rankDisplay({
		prefix: "simd",
		label: "Deprivation (SIMD) [2020]",
		year: 2020,
		areaCount: 6976,
		deprivation: {
			label: "SIMD",
			region: "Scotland",
			attribution:
				"Scottish Government. Scottish Index of Multiple Deprivation 2020v2. gov.scot",
			metric: "rank",
			metricMaximum: 6976,
			areaNoun: "data zones",
			areaType: "dataZone",
			summaryField: "councilStats",
			metricField: "simdRank",
			decileField: "simdDecile",
		},
		aggregation: {
			scope: "dataZone",
			distinct: true,
			aggregate: summariseSIMD,
		},
	}),
});
