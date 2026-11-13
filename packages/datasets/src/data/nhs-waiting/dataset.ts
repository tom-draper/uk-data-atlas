import type { NHSWaitingDataset } from "../../types/nhsWaiting.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods, type DeclaredHeader } from "../../declaration/statistics.ts";
import { aggregateNHSWaiting } from "./aggregate.ts";
import { ICB_ODS_TO_GSS } from "./icbToGss.ts";
import { loadNHSWaiting } from "./loader.ts";

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/** The header's `month`, such as "March 2026". */
const headerMonth = (_key: string, header: DeclaredHeader) => {
	const [name, year] = String(header.month).split(" ");
	const month = MONTHS.indexOf(name) + 1;
	if (!month || !Number(year))
		throw new Error(`nhsWaiting: unreadable month ${header.month}`);
	return periods.month(Number(year), month);
};

export const nhsWaiting = defineDataset<NHSWaitingDataset>({
	id: "nhs-waiting",
	topic: "nhs-services",
	boundary: { type: "localAuthority", year: 2024 },
	coverageCountries: ["GB-ENG"],
	layout: { locationScope: { kind: "mapped", mappingField: "ladToIcb" } },
	source: {
		name: "NHS Waiting Times",
		publisher: "NHS England",
		sourceUrl:
			"https://www.england.nhs.uk/statistics/statistical-work-areas/rtt-waiting-times/",
		year: "2026",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"NHS England. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Referral to treatment waiting times by Integrated Care Board for England.",
		cadence: "monthly",
		notes: [],
	},
	load: ({ zipCsvRows }) => loadNHSWaiting(zipCsvRows),
	statistics: {
		payload: {
			header: { month: "March 2026", coverageCountries: ["GB-ENG"] },
			code: "icbCode",
		},
		/** The board each local authority belongs to, by its NHS organisation code. */
		headerRelationships: [
			{
				field: "ladToIcb",
				child: { geography: "localAuthority", year: 2024 },
				parent: { geography: "integratedCareBoard", year: 2023 },
			},
		],
		name: "icbName",
		/** Keyed by NHS organisation code, on the boards in force to March 2026. */
		keys: ICB_ODS_TO_GSS,
		release: () => ({ geography: "integratedCareBoard", year: 2023 }),
		period: headerMonth,
		measures: [
			measure(
				"rtt-incomplete-pathways",
				"Patients waiting to start treatment",
				"pathways",
				"count",
				"sum",
				"Incomplete referral to treatment pathways at the end of the month.",
			),
			measure(
				"rtt-incomplete-pathways-over-18-weeks",
				"Patients waiting over 18 weeks",
				"pathways",
				"count",
				"sum",
				"Incomplete referral to treatment pathways waiting more than 18 weeks at the end of the month.",
			),
		],
		fields: [
			{ path: "total", measure: "rtt-incomplete-pathways" },
			{
				path: "over18Weeks",
				measure: "rtt-incomplete-pathways-over-18-weeks",
			},
		],
		derived: {
			pctOver18Weeks: "The share of pathways waiting over 18 weeks.",
		},
		computed: {
			pctOver18Weeks: (record) =>
				((record.over18Weeks as number) / (record.total as number)) *
				100,
		},
	},
	display: {
		group: "Health",
		label: "NHS Waiting Times [2026]",
		defaultVisible: true,
		year: 2026,
		// Waiting times are published by integrated care board.
		recordsVia: "ladToIcb",
		card: {
			heading: "NHS Waiting Times",
			coverage: "England",
			source: "NHS England. Referral to Treatment waiting times. england.nhs.uk",
			// The 18-week standard: 92% treated within 18 weeks, so at most 8% over.
			secondaryText: "target <8%",
		},
		measures: [
			{
				id: "over-18-weeks",
				label: "Over 18 weeks",
				field: "pctOver18Weeks",
				colorRange: { min: 25, max: 40 },
				legend: {
					min: 0,
					max: 100,
					format: { kind: "decimal", digits: 0, suffix: "% >18wks" },
				},
				// Capped at 50% for visual scale.
				card: { unit: "% over 18 wks", digits: 1, maximum: 50 },
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateNHSWaiting,
		},
	},
});
