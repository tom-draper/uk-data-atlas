import type { NIMDMDataset } from "../../../types/nimdm.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { summariseNIMDM } from "../../../helpers/datasetAggregation/deprivation.ts";
import {
	deprivationStatistics,
	rankDisplay,
} from "../../../data/deprivation/declaration.ts";
import {
	LGD_CODES,
	pick,
	pickBySubstring,
} from "../../../data/nimdm/source.ts";
import { parseCsv } from "../../../helpers/parseCsv.ts";
import { parseNumInt } from "../../../helpers/parseNumber.ts";
import { sourceDir } from "../../../declaration/sources.ts";
import type { DirectRecord } from "../../../declaration/statistics.ts";

export const nimdm = defineDataset<NIMDMDataset>({
	id: "nimdm",
	topic: "deprivation",
	boundary: { type: "superOutputArea", year: 2011 },
	guide: {
		title: "Northern Ireland Multiple Deprivation Measure",
		about: "Northern Ireland's measure of deprivation, ranking each of its small areas from most to least deprived across income, employment, health, education, access to services, living environment and crime.",
		summary:
			"The Northern Ireland Multiple Deprivation Measure, ranking small neighbourhoods from most to least deprived. Each nation measures deprivation its own way, so ranks can't be compared across borders.",
	},
	mapName: "Deprivation (NIMDM)",
	source: {
		name: "Northern Ireland Multiple Deprivation Measure",
		publisher: "Northern Ireland Statistics and Research Agency",
		sourceUrl:
			"https://www.nisra.gov.uk/statistics/deprivation/northern-ireland-multiple-deprivation-measure-2017-nimdm2017",
		year: "2017",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Northern Ireland Statistics and Research Agency. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Deprivation scores, ranks and deciles by super output area for Northern Ireland.",
		cadence: "irregular",
		notes: [
			"A position within Northern Ireland alone. The English, Welsh and Scottish indices use different methods, domains and dates, so a rank cannot be compared across nations.",
			"The publisher labels these areas SOA2001. Super output areas were drawn for the 2001 census and reused unchanged for 2011, and every code matches the 2011 release.",
			"NISRA publishes ranks, not deciles, for super output areas, so no decile measure is offered.",
		],
	},
	placeHeadline: {
		places: ["localAuthority"],
		order: 43,
		label: "Deprivation",
		about: "Share of its neighbourhoods in Northern Ireland's most deprived 10%",
	},
	statistics: {
		...deprivationStatistics({
			id: "nimdm",
			prefix: "nimdm",
			index: "Northern Ireland Multiple Deprivation Measure",
			area: "super output areas in Northern Ireland",
			fields: {},
			boundary: { type: "superOutputArea", year: 2011 },
			edition: "2017",
			metadata: {
				source: "Northern Ireland Statistics and Research Agency. Northern Ireland Multiple Deprivation Measure 2017.",
				notes: [
					"Northern Ireland only. NISRA publishes ranks, not deciles, for Super Output Areas; rank 1 is the most deprived.",
				],
			},
			code: "soaCode",
			name: "soaName",
			parent: { code: "lgdCode", name: "lgdName" },
			summaryField: "lgdStats",
			// The most deprived tenth of the 890 areas.
			mostDeprived: (record) => (record.nimdmRank as number) <= 89,
		}),
		direct: {
			only: true,
			read: async ({ text }) => {
				const { data } = await parseCsv<Record<string, string>>(
					await text(sourceDir("nimdm", "NIMDM17_SOAresults.csv")),
					{ header: true },
				);
				const records = new Map<string, DirectRecord>();
				for (const row of data) {
					const code = pick(
						row,
						"SOA2001",
						"SOA2011",
						"SOA_Code",
						"SOA",
					);
					if (!code) continue;
					const parentName = pick(
						row,
						"LGD2014NAME",
						"LGD2014",
						"LGD",
						"Council",
					);
					const parentCode = LGD_CODES[parentName] ?? "";
					const rank = parseNumInt(
						pickBySubstring(
							row,
							"Multiple Deprivation Measure Rank",
						),
					);
					if (!rank) continue;
					records.set(code, {
						code,
						name: pick(
							row,
							"SOA2001_name",
							"SOA2011_name",
							"SOA Name",
						),
						parents: {
							lgdCode: { code: parentCode, name: parentName },
						},
						values: [{ measure: "nimdm-rank", value: rank }],
					});
				}
				return [{ key: "2017", records: [...records.values()] }];
			},
		},
	},
	ranking: {
		label: "Neighbourhoods in Northern Ireland's most deprived 10%",
		format: { kind: "decimal", digits: 1, suffix: "%" },
	},
	catalogue: {
		kind: "indicators",
		yearly: true,
		partial: true,
		coverageNote:
			"Northern Ireland only. The other three nations publish their own indices, which are not comparable with this one.",
		indicators: [
			{
				id: "nimdm-rank",
				label: "Northern Ireland Multiple Deprivation Measure rank",
				field: "nimdmRank",
				valueKind: "ordinal",
				unit: "rank of 890 super output areas, where 1 is the most deprived",
				aggregation: {
					kind: "non-aggregatable",
					statistic: "rank",
					note: "A rank records an order, not a distance. Averaging ranks over areas produces a number with no meaning.",
				},
				notes: [],
				measure: "nimdm-rank",
			},
		],
	},
	display: rankDisplay({
		prefix: "nimdm",
		label: "Deprivation (NIMDM) [2017]",
		year: 2017,
		areaCount: 890,
		deprivation: {
			label: "NIMDM",
			region: "Northern Ireland",
			attribution:
				"NISRA. Northern Ireland Multiple Deprivation Measure 2017. nisra.gov.uk",
			metric: "rank",
			metricMaximum: 890,
			areaNoun: "super output areas",
			areaType: "superOutputArea",
			summaryField: "lgdStats",
			// NISRA publishes no decile for these areas, so none is shown.
			metricField: "nimdmRank",
		},
		aggregation: {
			scope: "superOutputArea",
			distinct: true,
			aggregate: summariseNIMDM,
		},
	}),
});
