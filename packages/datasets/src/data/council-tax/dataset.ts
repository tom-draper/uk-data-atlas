import type {
	IndicatorDataset,
	IndicatorRecord,
} from "../../types/indicator.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { loadCouncilTax } from "../new-datasets/loader.ts";

export const councilTax = defineDataset<IndicatorDataset<"council-tax">>({
	id: "council-tax",
	module: "housing",
	boundary: { type: "localAuthority", year: 2026 },
	coverageCountries: ["GB-ENG"],
	publishMapValues: true,
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
		requiredDataFields: ["value"],
	},
	load: ({ odsContent }) => loadCouncilTax(odsContent),
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
	display: {
		group: "Economics",
		label: "Council Tax [2026]",
		defaultVisible: true,
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
		aggregation: {
			scope: "any",
			aggregate: (records: IndicatorRecord[]) =>
				records.length === 0
					? null
					: {
							value:
								records.reduce(
									(sum, record) => sum + record.value,
									0,
								) / records.length,
						},
		},
	},
});
