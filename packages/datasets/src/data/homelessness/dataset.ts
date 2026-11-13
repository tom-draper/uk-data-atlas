import type { HomelessnessDataset } from "../../types/homelessness.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { aggregateHomelessness } from "./aggregate.ts";
import { loadHomelessness } from "./loader.ts";

export const homelessness = defineDataset<HomelessnessDataset>({
	id: "homelessness",
	topic: "homelessness",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Temporary Accommodation",
		publisher: "Ministry of Housing, Communities and Local Government",
		sourceUrl:
			"https://www.gov.uk/government/statistical-data-sets/live-tables-on-homelessness",
		year: "January-March 2026",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Ministry of Housing, Communities and Local Government. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Households in temporary accommodation by English local authority, including households with children.",
		cadence: "quarterly",
		notes: [],
	},
	load: ({ odsTableRows }) => loadHomelessness(odsTableRows),
	statistics: {
		payload: {
			parts: () => [
				{
					key: "2026",
					header: {
						id: "homelessness2026q1",
						type: "homelessness",
						year: 2026,
						quarter: "Jan-Mar 2026",
						boundaryType: "localAuthority",
						boundaryYear: 2025,
						coverageCountries: ["GB-ENG"],
					},
				},
			],
			code: "ladCode",
		},
		name: "ladName",
		period: () => periods.quarter(2026, 1),
		measures: [
			measure(
				"households-in-temporary-accommodation",
				"Households in temporary accommodation",
				"households",
				"count",
				"sum",
				"Households in temporary accommodation arranged by the local authority at the end of the quarter.",
			),
			measure(
				"households-in-temporary-accommodation-rate",
				"Households in temporary accommodation per 1,000",
				"per 1,000 households",
				"rate",
				"none",
				"Households in temporary accommodation per 1,000 households, as published.",
			),
			measure(
				"children-in-temporary-accommodation",
				"Children in temporary accommodation",
				"children",
				"count",
				"sum",
				"Children in households in temporary accommodation at the end of the quarter.",
			),
		],
		dimensions: [
			{
				slug: "household-type",
				label: "Household type",
				members: [
					{ key: "all", label: "All households" },
					{
						key: "with-children",
						label: "Households with children",
						parent: "all",
					},
				],
			},
		],
		fields: [
			{
				path: "householdsInTemporaryAccommodation",
				measure: "households-in-temporary-accommodation",
				members: { "household-type": "all" },
			},
			{
				path: "householdsWithChildren",
				measure: "households-in-temporary-accommodation",
				members: { "household-type": "with-children" },
			},
			{
				path: "householdsPerThousand",
				measure: "households-in-temporary-accommodation-rate",
			},
			{
				path: "childrenInTemporaryAccommodation",
				measure: "children-in-temporary-accommodation",
			},
		],
	},
	display: {
		group: "Economics",
		label: "Homelessness [2026]",
		defaultVisible: true,
		year: 2026,
		component: "@/components/economics/homelessness/HomelessnessChart",
		measures: [
			{
				id: "rate",
				label: "Rate",
				field: "householdsPerThousand",
				colorRange: { min: 1, max: 12 },
				legend: {
					min: 0,
					max: 20,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: " per 1k households",
					},
				},
			},
			{
				id: "count",
				label: "Count",
				field: "householdsInTemporaryAccommodation",
				colorRange: { min: 10, max: 2500 },
				legend: {
					min: 0,
					max: 8000,
					format: { kind: "count", suffix: " households in TA" },
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateHomelessness,
		},
	},
});
