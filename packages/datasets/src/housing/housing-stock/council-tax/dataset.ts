import type { IndicatorDataset } from "../../../types/indicator.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { averageIndicator } from "../../../data/new-datasets/aggregate.ts";
import { mapAuthorityCode } from "../../../data/new-datasets/authorityCode.ts";
import { odsTableRows } from "../../../data/spreadsheet/ods.ts";
import { sourceDir } from "../../../declaration/sources.ts";
import { parseNullableNum } from "../../../helpers/parseNumber.ts";
import type { DirectRecord } from "../../../declaration/statistics.ts";

export const councilTax = defineDataset<IndicatorDataset<"council-tax">>({
	id: "council-tax",
	topic: "housing-stock",
	boundary: { type: "localAuthority", year: 2026 },
	coverageCountries: ["GB-ENG"],
	publishMapValues: true,
	related: ["public-finance"],
	guide: {
		title: "Council Tax levels in England",
		about: "The average Band D council tax bill in each English council area, including precepts for police, fire and parish councils. Band D is the standard band used to compare council tax between areas.",
		summary:
			"The council tax levels billing authorities in England set for 2026-27.",
	},
	mapName: "Council Tax",
	source: {
		name: "Council Tax levels in England",
		publisher: "Ministry of Housing, Communities and Local Government",
		sourceUrl:
			"https://www.gov.uk/government/statistics/council-tax-levels-set-by-local-authorities-in-england-2026-to-2027",
		year: "2026-27",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Ministry of Housing, Communities and Local Government. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Average area Band D council tax in England, including relevant precepts.",
		cadence: "annual",
		notes: [
			"The published average area Band D charge from MHCLG Table 9, including relevant major precepts; it must not be summed or averaged flat.",
		],
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2026],
	},
	load: noCompiledPayload<IndicatorDataset<"council-tax">>(),
	placeHeadline: {
		places: ["localAuthority"],
		order: 70,
		label: "Council tax",
		about: "Average Band D bill for the year",
	},
	statistics: {
		payload: {
			parts: yearParts(
				"council-tax",
				"localAuthority",
				2026,
				{ coverageCountries: ["GB-ENG"] },
				["2026"],
			),
			code: "code",
		},
		name: "name",
		period: () => periods.financialYear(2026),
		measures: [
			measure(
				"band-d-council-tax",
				"Average Band D council tax",
				"gbp",
				"amount",
				"weighted_mean",
				"Average area Band D council tax, including major precepts.",
			),
		],
		fields: [{ path: "value", measure: "band-d-council-tax" }],
		direct: {
			only: true,
			read: async ({ odsContent }) => {
				const rows = odsTableRows(
					await odsContent(
						sourceDir("council-tax", "Tables_1-9_2026-27.ods"),
					),
					{ table: "Table_9", label: "Table_9", maxColumns: 16 },
				);
				const column = (rows[2] ?? []).indexOf("Band D");
				if (column < 0)
					throw new Error(
						"Could not find the Band D column in council-tax Table 9",
					);
				const records = new Map<string, DirectRecord>();
				for (const row of rows.slice(3)) {
					const code = row[1]?.trim() ?? "";
					const value = parseNullableNum(row[column]);
					if (!mapAuthorityCode(code) || value === null) continue;
					records.set(code, {
						code,
						name: row[2]?.trim() || code,
						values: [{ measure: "band-d-council-tax", value }],
					});
				}
				return [{ key: "2026", records: [...records.values()] }];
			},
		},
	},
	catalogue: {
		kind: "indicators",
		period: "2026-27",
		coverageNote:
			"Values are source-reported for the authorities included in the publisher's release.",
		indicators: [
			{
				id: "council-tax",
				label: "Average area Band D council tax",
				field: "value",
				valueKind: "currency",
				unit: "£",
				aggregation: {
					kind: "weighted-mean",
					weight: {
						description:
							"The billing authority's council-tax base.",
						datasetField: "tax base",
					},
				},
				notes: [],
				measure: "band-d-council-tax",
			},
		],
	},
	ranking: {
		label: "Average Band D council tax",
		format: { kind: "count", locale: "en-GB", digits: 2, prefix: "£" },
	},
	display: {
		label: "Council Tax [2026]",
		year: 2026,
		card: {
			heading: "Council Tax",
			source: "Source and methodology are available in the data catalogue.",
			secondaryText: "Avg Band D",
			hoverRecord: true,
		},
		measures: [
			{
				id: "value",
				label: "Council tax",
				field: "value",
				colorRange: { min: 1000, max: 3000 },
				legend: {
					min: 0,
					max: 4000,
					format: { kind: "decimal", digits: 0, prefix: "£" },
				},
				card: { prefix: "£", maximum: 4000 },
			},
		],
		aggregation: { scope: "any", aggregate: averageIndicator },
	},
});
