import {
	SCHOOL_MEASURES,
	SCHOOL_COPIES,
	schoolYear,
	schoolFields,
	schoolYears,
	latestCopies,
	latestCopyRules,
} from "@uk-data-atlas/datasets";
import type { DatasetModule } from "@uk-data-atlas/datasets";
import type { StatisticsMeasure } from "../atlasStatistics.ts";
import {
	type DeclaredDataset,
	type DeclaredHeader,
	type DeclaredDimension,
	type DeclaredField,
	type DerivedRule,
	periods,
} from "../declaredStatistics.ts";
import { yearParts } from "../declaredPayload.ts";
import type { DeclaredPayload } from "../declaredStatistics.ts";
import { measure } from "./measures.ts";

/** Crime, safety, housing need, care, planning, health and schools. */

export const HOMELESSNESS: DeclaredDataset = {
	type: "homelessness",
	module: "housing",
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
};

const single = (
	type: string,
	module: DatasetModule,
	period: ReturnType<typeof periods.year>,
	declared: StatisticsMeasure,
	payload: DeclaredPayload,
): DeclaredDataset => ({
	type,
	module,
	payload,
	name: "name",
	period: () => period,
	measures: [declared],
	fields: [{ path: "value", measure: declared.slug }],
});

export const PLANNING_APPLICATIONS: DeclaredDataset = {
	type: "planningApplications",
	module: "housing",
	payload: {
		parts: yearParts("planningApplications", "localAuthority", 2025, {
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
};

/** County and unitary tables that still use two pre-2023 metropolitan codes. */
const countiesAndUnitaries = {
	alsoIn: [{ geography: "localAuthority", year: 2022 }],
};

export const PUBLIC_HEALTH: DeclaredDataset = {
	type: "publicHealth",
	module: "health",
	payload: {
		parts: () => [
			{
				key: "2025",
				header: {
					id: "publicHealth2025",
					type: "publicHealth",
					year: 2025,
					boundaryType: "countyAndUnitaryAuthority",
					boundaryYear: 2025,
					periods: {
						receptionExcessWeight: "2024/25",
						year6ExcessWeight: "2024/25",
						adultExcessWeight: "2024/25",
						activity: "2024/25",
						smoking: "2024",
						preventableMortality: "2024",
					},
					coverageCountries: ["GB-ENG"],
				},
			},
		],
		code: "code",
		omitMissing: ["metrics."],
	},
	name: "name",
	...countiesAndUnitaries,
	period: () => periods.financialYear(2024),
	measures: [
		measure(
			"reception-excess-weight",
			"Reception children overweight or obese",
			"percent",
			"share",
			"none",
			"Children in reception year who are overweight or obese, as a percentage of those measured.",
		),
		measure(
			"year-6-excess-weight",
			"Year 6 children overweight or obese",
			"percent",
			"share",
			"none",
			"Children in year 6 who are overweight or obese, as a percentage of those measured.",
		),
		measure(
			"adult-excess-weight",
			"Adults overweight or obese",
			"percent",
			"share",
			"none",
			"Adults aged 18 and over classified as overweight or obese.",
		),
		measure(
			"physically-active-adults",
			"Physically active adults",
			"percent",
			"share",
			"none",
			"Adults aged 19 and over doing at least 150 moderate intensity equivalent minutes of activity a week.",
		),
		measure(
			"smoking-prevalence",
			"Smoking prevalence in adults",
			"percent",
			"share",
			"none",
			"Adults aged 18 and over who currently smoke.",
		),
		measure(
			"preventable-mortality",
			"Mortality from preventable causes",
			"per 100,000",
			"rate",
			"none",
			"Age-standardised deaths from causes considered preventable, per 100,000 people.",
		),
	],
	fields: (_key, header) => {
		const published = header.periods as Record<string, string>;
		/** NCMP years are school years; the survey years are financial years. */
		const at = (metric: string, school: boolean) => {
			const label = published[metric];
			const year = /^(\d{4})\/\d{2}$/.exec(label);
			if (year)
				return school
					? periods.academicYear(Number(year[1]))
					: periods.financialYear(Number(year[1]));
			if (/^\d{4}$/.test(label)) return periods.year(Number(label));
			throw new Error(`Unknown public health period ${label}`);
		};
		return [
			["receptionExcessWeight", "reception-excess-weight", true],
			["year6ExcessWeight", "year-6-excess-weight", true],
			["adultExcessWeight", "adult-excess-weight", false],
			["activity", "physically-active-adults", false],
			["smoking", "smoking-prevalence", false],
			["preventableMortality", "preventable-mortality", false],
		].map(([metric, slug, school]) => ({
			path: `metrics.${metric}`,
			measure: slug as string,
			at: at(metric as string, school as boolean),
		}));
	},
};

export const PUPIL_ABSENCE: DeclaredDataset = {
	type: "pupilAbsence",
	module: "education",
	payload: {
		parts: yearParts(
			"pupilAbsence",
			"countyAndUnitaryAuthority",
			2025,
			{ coverageCountries: ["GB-ENG"] },
			["2025"],
		),
		code: "code",
	},
	name: "name",
	...countiesAndUnitaries,
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
	derived: { value: "Sessions missed as a percentage of possible sessions." },
	computed: {
		value: (record) => {
			const metrics = record.metrics as Record<string, number>;
			return (metrics.overall / metrics.sessions) * 100;
		},
	},
};

const schools = {
	period: schoolYear,
	alsoIn: [
		{ geography: "localAuthority", year: 2022 },
		{ geography: "localAuthority", year: 2018 },
	],
};

export const SCHOOL_PERFORMANCE: DeclaredDataset = {
	type: "schoolPerformance",
	module: "education",
	payload: {
		parts: yearParts(
			"schoolPerformance",
			"localAuthority",
			2024,
			{
				coverageCountries: ["GB-ENG"],
			},
			["2025"],
		),
		code: "ladCode",
		periodKeys: schoolYears,
		sparsePeriods: true,
		nullPaths: [
			"avgP8score",
			"series.2020.avgP8score",
			"series.2021.avgP8score",
			"series.2025.avgP8score",
		],
	},
	name: "ladName",
	...schools,
	measures: SCHOOL_MEASURES,
	fields: schoolFields("series.{period}."),
	derived: latestCopies(SCHOOL_COPIES),
	computed: latestCopyRules(SCHOOL_COPIES),
};
