import type { WIMDDataset } from "../../../types/wimd.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { sourceDir } from "../../../declaration/sources.ts";
import { summariseWIMD } from "../../../helpers/datasetAggregation/deprivation.ts";
import {
	deprivationStatistics,
	rankDisplay,
} from "../../../data/deprivation/declaration.ts";
import {
	publishedWIMDRanks,
	welshLSOAPopulations,
	LOCAL_AUTHORITY_CODES,
	pick,
} from "../../../data/wimd/source.ts";
import { findHeaderLine, parseCsv } from "../../../helpers/parseCsv.ts";
import { parseNum } from "../../../helpers/parseNumber.ts";
import type { DirectRecord } from "../../../declaration/statistics.ts";

export const wimd = defineDataset<WIMDDataset>({
	id: "wimd",
	topic: "deprivation",
	boundary: { type: "lsoa", year: 2011 },
	guide: {
		title: "Welsh Index of Multiple Deprivation",
		about: "Wales's own index of deprivation, ranking every small neighbourhood in Wales across income, employment, health, education, access to services, housing, community safety and environment. Its ranks can't be compared directly with England's.",
		summary:
			"The Welsh Index of Multiple Deprivation, ranking small neighbourhoods from most to least deprived. Each nation measures deprivation its own way, so ranks can't be compared across borders.",
	},
	mapName: "Deprivation (WIMD)",
	source: {
		name: "Welsh Index of Multiple Deprivation",
		publisher: "Welsh Government",
		sourceUrl: "https://www.gov.wales/welsh-index-multiple-deprivation",
		year: "2019",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Welsh Government. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Deprivation scores, ranks and deciles by lower super output area for Wales.",
		cadence: "irregular",
		notes: [],
	},
	placeHeadline: {
		places: ["localAuthority"],
		order: 41,
		label: "Deprivation",
		about: "Share of its neighbourhoods in Wales's most deprived 10%",
	},
	statistics: {
		...deprivationStatistics({
			id: "wimd",
			prefix: "wimd",
			index: "Welsh Index of Multiple Deprivation",
			area: "LSOAs in Wales",
			fields: { score: true, decile: true, population: true },
			boundary: { type: "lsoa", year: 2011 },
			edition: "2019",
			metadata: {
				source: "Welsh Government. Welsh Index of Multiple Deprivation 2019.",
				notes: ["Wales only. Decile 1 = most deprived 10% of LSOAs."],
			},
			code: "lsoaCode",
			name: "lsoaName",
			parent: { code: "ladCode", name: "ladName" },
			summaryField: "ladStats",
			mostDeprived: (record) => record.wimdDecile === 1,
			weighted: { score: "wimdScore" },
		}),
		direct: {
			only: true,
			read: async ({ text, odsContent }) => {
				const published = publishedWIMDRanks(
					await odsContent(
						sourceDir(
							"wimd",
							"welsh-index-multiple-deprivation-2019-index-and-domain-ranks-by-small-area.ods",
						),
					),
				);
				const populations = welshLSOAPopulations(
					await text(
						sourceDir("wimd", "wales-lsoa-population-mid-2017.csv"),
					),
				);
				const csv = await text(sourceDir("wimd", "wimd2019.csv"));
				const { data } = await parseCsv<Record<string, string>>(csv, {
					header: true,
					skipLines: findHeaderLine(csv, "LSOA code"),
				});
				const records = new Map<string, DirectRecord>();
				for (const raw of data) {
					const row = Object.fromEntries(
						Object.entries(raw).map(([key, value]) => [
							key.trim(),
							value,
						]),
					);
					const code = pick(
						row,
						"LSOA code",
						"LSOA Code",
						"lsoa_code",
						"LSOA_Code",
						"lsoaCode",
					);
					if (!code || !code.startsWith("W")) continue;
					const name = pick(
						row,
						"LSOA name",
						"LSOA Name",
						"lsoa_name",
						"LSOA_Name",
						"lsoaName",
					);
					const parentName = pick(
						row,
						"Local Authority name",
						"Local Authority Name",
						"Local Authority",
						"la_name",
						"LA_Name",
					);
					const rank = published.get(code);
					if (!rank)
						throw new Error(
							`WIMD ranks: no published rank for ${code}`,
						);
					const population = populations.get(code);
					if (population === undefined)
						throw new Error(
							`WIMD population: no estimate for ${code}`,
						);
					records.set(code, {
						code,
						name,
						parents: {
							ladCode: {
								code: LOCAL_AUTHORITY_CODES[parentName] || "",
								name: parentName,
							},
						},
						values: [
							{
								measure: "wimd-score",
								value: parseNum(
									pick(
										row,
										"WIMD 2019",
										"WIMD 2019 Score",
										"WIMD Score",
										"wimd_score",
										"Score",
									),
								),
							},
							{ measure: "wimd-rank", value: rank.rank },
							{ measure: "wimd-decile", value: rank.decile },
							{ measure: "population", value: population },
						],
					});
				}
				return [{ key: "2019", records: [...records.values()] }];
			},
		},
	},
	ranking: {
		label: "Neighbourhoods in Wales' most deprived 10%",
		format: { kind: "decimal", digits: 1, suffix: "%" },
	},
	catalogue: {
		kind: "indicators",
		yearly: true,
		partial: true,
		checks: ["manifest-areas"],
		coverageNote:
			"Wales only. The other three nations publish their own indices, which are not comparable with this one.",
		indicators: [
			{
				id: "wimd-rank",
				label: "Welsh Index of Multiple Deprivation rank",
				field: "wimdRank",
				valueKind: "ordinal",
				unit: "rank of {areas} LSOAs, where 1 is the most deprived",
				aggregation: {
					kind: "non-aggregatable",
					statistic: "rank",
					note: "A rank records an order, not a distance: the gap between ranks 1 and 2 need not equal the gap between 100 and 101. Averaging ranks over areas produces a number with no meaning.",
				},
				notes: [
					"A position within Wales alone. The English, Scottish and Northern Irish indices use different methods, domains and dates, so a rank or decile cannot be compared across nations.",
					"Taken from the Welsh Government's published ranks. The separately published scores are rounded to one decimal place, so ranking them does not reproduce these ranks.",
				],
				measure: "wimd-rank",
			},
			{
				id: "wimd-decile",
				label: "Welsh Index of Multiple Deprivation decile",
				field: "wimdDecile",
				valueKind: "ordinal",
				unit: "decile, where 1 is the most deprived tenth of LSOAs",
				aggregation: {
					kind: "non-aggregatable",
					statistic: "decile",
					note: "A decile is a band of ranks. Averaging deciles over areas produces a number with no meaning, and the share of a place's LSOAs in each decile is the defensible summary instead.",
				},
				notes: [
					"A position within Wales alone. The English, Scottish and Northern Irish indices use different methods, domains and dates, so a rank or decile cannot be compared across nations.",
					"Taken from the Welsh Government's published deciles.",
				],
				measure: "wimd-decile",
			},
		],
	},
	display: rankDisplay({
		prefix: "wimd",
		label: "Deprivation (WIMD) [2019]",
		year: 2019,
		areaCount: 1909,
		deprivation: {
			label: "WIMD",
			region: "Wales",
			attribution:
				"Welsh Government. Welsh Index of Multiple Deprivation 2019. gov.wales",
			metric: "score",
			metricMaximum: 86.6,
			areaNoun: "LSOAs",
			areaType: "lsoa",
			summaryField: "ladStats",
			metricField: "wimdScore",
			decileField: "wimdDecile",
		},
		aggregation: {
			scope: "lsoa",
			distinct: true,
			aggregate: summariseWIMD,
		},
	}),
});
