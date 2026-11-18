import type { SIMDDataset } from "../../../types/simd.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
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
	load: noCompiledPayload<SIMDDataset>(),
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
