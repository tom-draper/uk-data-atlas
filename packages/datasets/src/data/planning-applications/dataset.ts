import type { IndicatorDataset } from "../../types/indicator.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { loadPlanningApplications } from "../new-datasets/loader.ts";
import { sumPlanningRecords } from "./aggregate.ts";

export const planningApplications = defineDataset<
	IndicatorDataset<"planning-applications">
>({
	id: "planning-applications",
	topic: "planning",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Planning applications in England",
		publisher: "Ministry of Housing, Communities and Local Government",
		sourceUrl:
			"https://www.gov.uk/government/statistical-data-sets/live-tables-on-planning-application-statistics",
		year: "2026 Q1",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Ministry of Housing, Communities and Local Government. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Planning applications received, decided and withdrawn by English local planning authority during 2026 Q1.",
		cadence: "quarterly",
		notes: [],
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value"],
	},
	load: ({ csvRows }) => loadPlanningApplications(csvRows),
	statistics: {
		payload: {
			parts: yearParts("planning-applications", "localAuthority", 2025, {
				coverageCountries: ["GB-ENG"],
			}),
			code: "code",
		},
		name: "name",
		period: () => periods.quarter(2026, 1),
		measures: [
			measure(
				"planning-applications",
				"Planning applications",
				"applications",
				"count",
				"sum",
				"Planning applications handled by the local planning authority in the quarter.",
			),
		],
		dimensions: [
			{
				slug: "application-stage",
				label: "Application stage",
				members: [
					{ key: "received", label: "Received" },
					{ key: "decided", label: "Decided" },
					{ key: "withdrawn", label: "Withdrawn" },
				],
			},
		],
		fields: [
			{
				path: "value",
				measure: "planning-applications",
				members: { "application-stage": "received" },
				wins: true,
			},
			{
				path: "metrics.{application-stage}",
				measure: "planning-applications",
			},
		],
	},
	display: {
		group: "Economics",
		label: "Planning Applications [2026 Q1]",
		defaultVisible: true,
		year: 2026,
		card: {
			heading: "Planning applications",
			coverage: "England",
			source: "MHCLG. Planning applications in England, 2026 Q1.",
			hoverRecord: true,
		},
		measures: [
			{
				id: "received",
				label: "Applications received",
				field: "value",
				colorRange: { min: 0, max: 1_500 },
				legend: {
					min: 0,
					max: 3_000,
					format: { kind: "count", locale: "en-GB" },
				},
				card: { unit: "Applications received", maximum: 3_000 },
			},
			{
				id: "decided",
				label: "Applications decided",
				field: "metrics.decided",
				colorRange: { min: 0, max: 1_500 },
				legend: {
					min: 0,
					max: 3_000,
					format: { kind: "count", locale: "en-GB" },
				},
				card: { unit: "Applications decided", maximum: 3_000 },
			},
			{
				id: "withdrawn",
				label: "Applications withdrawn",
				field: "metrics.withdrawn",
				colorRange: { min: 0, max: 1_500 },
				legend: {
					min: 0,
					max: 3_000,
					format: { kind: "count", locale: "en-GB" },
				},
				card: { unit: "Applications withdrawn", maximum: 3_000 },
			},
		],
		aggregation: { scope: "any", aggregate: sumPlanningRecords },
	},
});
