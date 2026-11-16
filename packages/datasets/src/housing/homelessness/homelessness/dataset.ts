import type { HomelessnessDataset } from "../../../types/homelessness.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { aggregateHomelessness } from "../../../data/homelessness/aggregate.ts";
import { homelessnessStatisticsParts } from "../../../data/homelessness/source.ts";

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
	load: noCompiledPayload<HomelessnessDataset>(),
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
		direct: {
			only: true,
			read: ({ odsTableRows }) =>
				homelessnessStatisticsParts(odsTableRows),
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
	ranking: {
		label: "Households in temporary accommodation per 1,000",
	},
	display: {
		label: "Homelessness [2026]",
		year: 2026,
		card: {
			heading: "Homelessness",
			source: "Ministry of Housing, Communities and Local Government. Statutory homelessness statistics. gov.uk",
			secondary: {
				field: "childrenInTemporaryAccommodation",
				format: { kind: "compact", suffix: " children in TA" },
			},
		},
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
				card: { unit: "per 1k households", digits: 1, maximum: 15 },
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
				card: {
					unit: "households in TA",
					format: { kind: "count", locale: "en-GB" },
					maximum: 2500,
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateHomelessness,
		},
	},
});

export const homelessnessSeries = () =>
	(
		homelessness.statistics!
			.fields as import("../../../declaration/statistics.ts").DeclaredField[]
	)
		.filter((field) =>
			[
				"households-in-temporary-accommodation",
				"children-in-temporary-accommodation",
			].includes(field.measure),
		)
		.map((field) => ({
			id:
				field.measure === "children-in-temporary-accommodation"
					? "temporary-accommodation-children"
					: `temporary-accommodation-households${field.members?.["household-type"] === "all" ? "" : `-${field.members?.["household-type"]}`}`,
			measure: field.measure,
			...(field.members ? { dimensions: field.members } : {}),
		}));
