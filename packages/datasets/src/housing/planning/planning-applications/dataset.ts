import { mapAuthorityCode } from "../../../data/new-datasets/authorityCode.ts";
import { parseNullableNum } from "../../../helpers/parseNumber.ts";
import { sourceDir } from "../../../declaration/sources.ts";
import type {
	DirectRecord,
	DirectValue,
} from "../../../declaration/statistics.ts";
import type { IndicatorDataset } from "../../../types/indicator.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { periods } from "../../../declaration/statistics.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { sumPlanningRecords } from "../../../data/planning-applications/aggregate.ts";

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
		notes: [
			"Planning applications received during 2026 Q1; the publisher labels the areas local planning authorities but supplies local-authority district codes.",
		],
	},
	ingestion: {
		minimumDataRecords: 100,
		expectedBoundaryYears: [2025],
	},
	load: noCompiledPayload<IndicatorDataset<"planning-applications">>(),
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
		direct: {
			only: true,
			read: async ({ csvRows }) => {
				const records = new Map<string, DirectRecord>();
				await csvRows(
					sourceDir("planning-applications", "ps1-full-2026-03.csv"),
					{ skipLines: 3 },
					(row) => {
						const code = row.LPACD?.trim() ?? "";
						const value = parseNullableNum(
							row["Applications received"],
						);
						if (
							row.Quarter !== "2026 Q1" ||
							!mapAuthorityCode(code) ||
							value === null
						)
							return;
						const values: DirectValue[] = [
							{
								measure: "planning-applications",
								members: { "application-stage": "received" },
								value,
							},
						];
						for (const [stage, column] of [
							["decided", "Applications decided"],
							["withdrawn", "Applications withdrawn"],
						] as const) {
							const number = parseNullableNum(row[column]);
							if (number !== null)
								values.push({
									measure: "planning-applications",
									members: { "application-stage": stage },
									value: number,
								});
						}
						records.set(code, {
							code,
							name: row.LPANM?.trim() || code,
							values,
						});
					},
				);
				return [{ key: "2026", records: [...records.values()] }];
			},
		},
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
	catalogue: {
		kind: "indicators",
		period: "2026-Q1",
		coverageNote:
			"Values are source-reported for the authorities included in the publisher's release.",
		indicators: [
			{
				id: "planning-applications",
				label: "Planning applications received",
				field: "value",
				valueKind: "count",
				unit: "applications",
				aggregation: "sum",
				notes: [],
				measure: "planning-applications",
				members: { "application-stage": "received" },
			},
		],
	},
	display: {
		label: "Planning Applications [2026 Q1]",
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
