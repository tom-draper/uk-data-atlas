import type { IndicatorDataset } from "../../types/indicator.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import { measure } from "../../declaration/measures.ts";
import { periods } from "../../declaration/statistics.ts";
import { yearParts } from "../../declaration/yearParts.ts";
import { sumMetrics } from "../../helpers/sumMetrics.ts";
import { loadPupilAbsence } from "./loader.ts";

export const pupilAbsence = defineDataset<IndicatorDataset<"pupil-absence">>({
	id: "pupil-absence",
	topic: "schools",
	boundary: { type: "countyAndUnitaryAuthority", year: 2025 },
	coverageCountries: ["GB-ENG"],
	source: {
		name: "Pupil absence",
		publisher: "Department for Education",
		sourceUrl:
			"https://explore-education-statistics.service.gov.uk/find-statistics/pupil-absence-in-schools-in-england",
		year: "2024/25",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Department for Education. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Full-year pupil absence for state-funded primary, secondary and special schools in England, by county and unitary authority.",
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDataRecords: 140,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["value", "metrics"],
	},
	load: ({ zipCsvRows }) => loadPupilAbsence(zipCsvRows),
	statistics: {
		payload: {
			parts: yearParts(
				"pupil-absence",
				"countyAndUnitaryAuthority",
				2025,
				{ coverageCountries: ["GB-ENG"] },
				["2025"],
			),
			code: "code",
		},
		name: "name",
		alsoIn: [{ geography: "localAuthority", year: 2022 }],
		period: () => periods.academicYear(2024),
		measures: [
			measure(
				"school-sessions",
				"School sessions",
				"sessions",
				"count",
				"sum",
				"Half-day school sessions in state-funded schools.",
			),
			measure(
				"pupil-enrolments",
				"Pupil enrolments",
				"enrolments",
				"count",
				"sum",
				"Pupil enrolments in state-funded schools.",
			),
		],
		dimensions: [
			{
				slug: "session-type",
				label: "Session type",
				members: [
					{
						key: "sessions",
						code: "possible",
						label: "Possible sessions",
					},
					{
						key: "overall",
						code: "absent",
						label: "Sessions missed",
						parent: "sessions",
					},
					{
						key: "authorised",
						label: "Authorised absence",
						parent: "overall",
					},
					{
						key: "unauthorised",
						label: "Unauthorised absence",
						parent: "overall",
					},
				],
			},
			{
				slug: "absence-level",
				label: "Absence level",
				members: [
					{ key: "enrolments", code: "all", label: "All enrolments" },
					{
						key: "persistent",
						label: "Persistently absent (10% or more of sessions)",
						parent: "enrolments",
					},
					{
						key: "severe",
						label: "Severely absent (50% or more of sessions)",
						parent: "enrolments",
					},
				],
			},
		],
		fields: [
			{ path: "metrics.{session-type}", measure: "school-sessions" },
			{ path: "metrics.{absence-level}", measure: "pupil-enrolments" },
		],
		derived: {
			value: "Sessions missed as a percentage of possible sessions.",
		},
		computed: {
			value: (record) => {
				const metrics = record.metrics as Record<string, number>;
				return (metrics.overall / metrics.sessions) * 100;
			},
		},
	},
	display: {
		label: "Pupil Absence [2024/25]",
		year: 2025,
		card: {
			heading: "Pupil absence",
			period: "2024/25",
			coverage: "England",
			source: "DfE. Pupil absence in schools, full academic year 2024/25. County and unitary authorities.",
			hoverRecord: true,
		},
		measures: [
			{
				id: "overall",
				label: "Overall absence",
				field: {
					share: { of: "metrics.overall", over: "metrics.sessions" },
				},
				colorRange: { min: 0, max: 30 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% sessions",
					},
				},
				card: {
					unit: "% sessions",
					digits: 1,
					maximum: 100,
					note: "Overall absence",
				},
			},
			{
				id: "authorised",
				label: "Authorised absence",
				field: {
					share: {
						of: "metrics.authorised",
						over: "metrics.sessions",
					},
				},
				colorRange: { min: 0, max: 30 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% sessions",
					},
				},
				card: {
					unit: "% sessions",
					digits: 1,
					maximum: 100,
					note: "Authorised absence",
				},
			},
			{
				id: "unauthorised",
				label: "Unauthorised absence",
				field: {
					share: {
						of: "metrics.unauthorised",
						over: "metrics.sessions",
					},
				},
				colorRange: { min: 0, max: 30 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% sessions",
					},
				},
				card: {
					unit: "% sessions",
					digits: 1,
					maximum: 100,
					note: "Unauthorised absence",
				},
			},
			{
				id: "persistent",
				label: "Persistent absence (10%+)",
				field: {
					share: {
						of: "metrics.persistent",
						over: "metrics.enrolments",
					},
				},
				colorRange: { min: 0, max: 30 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% enrolments",
					},
				},
				card: {
					unit: "% enrolments",
					digits: 1,
					maximum: 100,
					note: "Persistent absence (10%+)",
				},
			},
			{
				id: "severe",
				label: "Severe absence (50%+)",
				field: {
					share: { of: "metrics.severe", over: "metrics.enrolments" },
				},
				colorRange: { min: 0, max: 30 },
				legend: {
					min: 0,
					max: 100,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: "% enrolments",
					},
				},
				card: {
					unit: "% enrolments",
					digits: 1,
					maximum: 100,
					note: "Severe absence (50%+)",
				},
			},
		],
		aggregation: {
			scope: "any",
			// The overall rate is sessions missed over possible sessions.
			aggregate: (records) => sumMetrics(records, "overall", "sessions"),
		},
	},
});
