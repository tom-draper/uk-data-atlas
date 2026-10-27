import type { StatisticsMeasure } from "../atlasStatistics";
import {
	type DeclaredDataset,
	type DeclaredDimension,
	type DeclaredField,
	periods,
} from "../declaredStatistics";
import { measure } from "./measures";

/** Crime, safety, housing need, care, planning, health and schools. */

const offence = (
	key: string,
	code: string,
	label: string,
	parent?: string,
) => ({ key, code, label, ...(parent ? { parent } : {}) });

export const CRIME: DeclaredDataset = {
	type: "crime",
	name: "ladName",
	period: () => periods.yearEnding(2026, 3),
	alsoIn: [{ geography: "localAuthority", year: 2022 }],
	measures: [
		measure(
			"recorded-crimes",
			"Police recorded crime",
			"offences",
			"count",
			"sum",
			"Offences recorded by the police.",
		),
	],
	dimensions: [
		{
			slug: "offence",
			label: "Offence group",
			members: [
				offence("totalRecordedCrime", "total", "All recorded crime"),
				offence(
					"violenceAgainstPerson",
					"violence-against-the-person",
					"Violence against the person",
					"totalRecordedCrime",
				),
				offence(
					"homicide",
					"homicide",
					"Homicide",
					"violenceAgainstPerson",
				),
				offence(
					"deathSeriesInjuryUnlawfulDriving",
					"death-or-serious-injury-by-unlawful-driving",
					"Death or serious injury caused by unlawful driving",
					"violenceAgainstPerson",
				),
				offence(
					"violenceWithInjury",
					"violence-with-injury",
					"Violence with injury",
					"violenceAgainstPerson",
				),
				offence(
					"violenceWithoutInjury",
					"violence-without-injury",
					"Violence without injury",
					"violenceAgainstPerson",
				),
				offence(
					"stalkingHarassment",
					"stalking-and-harassment",
					"Stalking and harassment",
					"violenceAgainstPerson",
				),
				offence(
					"sexualOffences",
					"sexual-offences",
					"Sexual offences",
					"totalRecordedCrime",
				),
				offence("robbery", "robbery", "Robbery", "totalRecordedCrime"),
				offence(
					"theftOffences",
					"theft",
					"Theft offences",
					"totalRecordedCrime",
				),
				offence("burglary", "burglary", "Burglary", "theftOffences"),
				offence(
					"residentialBurglary",
					"residential-burglary",
					"Residential burglary",
					"burglary",
				),
				offence(
					"nonResidentialBurglary",
					"non-residential-burglary",
					"Non-residential burglary",
					"burglary",
				),
				offence(
					"vehicleOffences",
					"vehicle-offences",
					"Vehicle offences",
					"theftOffences",
				),
				offence(
					"theftFromPerson",
					"theft-from-the-person",
					"Theft from the person",
					"theftOffences",
				),
				offence(
					"bicycleTheft",
					"bicycle-theft",
					"Bicycle theft",
					"theftOffences",
				),
				offence(
					"shoplifting",
					"shoplifting",
					"Shoplifting",
					"theftOffences",
				),
				offence(
					"otherTheftOffences",
					"other-theft",
					"All other theft offences",
					"theftOffences",
				),
				offence(
					"criminalDamageArson",
					"criminal-damage-and-arson",
					"Criminal damage and arson",
					"totalRecordedCrime",
				),
				offence(
					"drugOffences",
					"drug-offences",
					"Drug offences",
					"totalRecordedCrime",
				),
				offence(
					"possessionWeapons",
					"possession-of-weapons",
					"Possession of weapons offences",
					"totalRecordedCrime",
				),
				offence(
					"publicOrderOffences",
					"public-order-offences",
					"Public order offences",
					"totalRecordedCrime",
				),
				offence(
					"miscellaneousCrimes",
					"miscellaneous-crimes-against-society",
					"Miscellaneous crimes against society",
					"totalRecordedCrime",
				),
			],
		},
	],
	fields: [{ path: "{offence}", measure: "recorded-crimes" }],
};

export const ROAD_COLLISIONS: DeclaredDataset = {
	type: "roadCollisions",
	measures: [
		measure(
			"road-collisions",
			"Reported road collisions",
			"collisions",
			"count",
			"sum",
			"Road collisions involving personal injury reported to the police.",
		),
	],
	dimensions: [
		{
			slug: "collision-severity",
			label: "Collision severity",
			members: [
				{ key: "collisions", code: "all", label: "All severities" },
				{ key: "fatal", label: "Fatal", parent: "collisions" },
				{ key: "serious", label: "Serious", parent: "collisions" },
				{ key: "slight", label: "Slight", parent: "collisions" },
			],
		},
	],
	records: [
		{ from: "data" },
		{
			from: "lsoas",
			release: (header) => ({
				geography: "lsoa",
				year: Number(header.lsoaBoundaryYear),
			}),
		},
	],
	fields: [{ path: "{collision-severity}", measure: "road-collisions" }],
};

export const HOMELESSNESS: DeclaredDataset = {
	type: "homelessness",
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
	period: ReturnType<typeof periods.year>,
	declared: StatisticsMeasure,
): DeclaredDataset => ({
	type,
	name: "name",
	period: () => period,
	measures: [declared],
	fields: [{ path: "value", measure: declared.slug }],
});

export const ADULT_SOCIAL_CARE_ACTIVITY = single(
	"adultSocialCareActivity",
	periods.financialYear(2024),
	measure(
		"long-term-support-clients",
		"Clients receiving long-term support",
		"clients",
		"count",
		"sum",
		"Adult social care clients receiving long-term support during the year.",
	),
);

export const ADULT_SOCIAL_CARE_OUTCOMES = single(
	"adultSocialCareOutcomes",
	periods.financialYear(2024),
	measure(
		"social-care-quality-of-life",
		"Social care-related quality of life",
		"score out of 24",
		"index",
		"none",
		"Average social care-related quality of life score of service users (ASCOF 1A).",
	),
);

export const NET_ADDITIONAL_DWELLINGS = single(
	"netAdditionalDwellings",
	periods.financialYear(2024),
	measure(
		"net-additional-dwellings",
		"Net additional dwellings",
		"dwellings",
		"count",
		"sum",
		"New dwellings and conversions less demolitions over the year.",
	),
);

export const PLANNING_APPLICATIONS: DeclaredDataset = {
	type: "planningApplications",
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
};

const SCHOOL_MEASURES = [
	measure(
		"gcse-english-maths-grade-4",
		"English and maths at grade 4 or above",
		"percent of pupils",
		"share",
		"weighted_mean",
		"Key stage 4 pupils achieving grade 4 or above in English and maths.",
	),
	measure(
		"gcse-english-maths-grade-5",
		"English and maths at grade 5 or above",
		"percent of pupils",
		"share",
		"weighted_mean",
		"Key stage 4 pupils achieving grade 5 or above in English and maths.",
	),
	measure(
		"attainment-8",
		"Average Attainment 8 score",
		"score",
		"mean",
		"weighted_mean",
		"Average Attainment 8 score of key stage 4 pupils.",
	),
	measure(
		"progress-8",
		"Average Progress 8 score",
		"score",
		"mean",
		"weighted_mean",
		"Average Progress 8 score of key stage 4 pupils.",
	),
	measure(
		"key-stage-4-pupils",
		"Key stage 4 pupils",
		"pupils",
		"count",
		"sum",
		"Pupils at the end of key stage 4.",
	),
];

/** Series keys are the year an academic year ends. */
const schoolYear = (key: string) => periods.academicYear(Number(key) - 1);

const schoolFields = (prefix: string): DeclaredField[] =>
	[
		["ptL2basics94", "gcse-english-maths-grade-4"],
		["ptL2basics95", "gcse-english-maths-grade-5"],
		["avgAtt8", "attainment-8"],
		["avgP8score", "progress-8"],
		["pupils", "key-stage-4-pupils"],
	].map(([field, measure]) => ({
		path: `${prefix}${field}`,
		measure,
		period: schoolYear,
	}));

const latestCopies = (fields: string[]) =>
	Object.fromEntries(
		fields.map((field) => [field, "Copy of the latest year in series."]),
	);

const schools = {
	period: schoolYear,
	alsoIn: [
		{ geography: "localAuthority", year: 2022 },
		{ geography: "localAuthority", year: 2018 },
	],
	exclude: [
		{
			codes: / \/ /,
			reason: "The publisher reports two districts as one.",
		},
	],
};

export const SCHOOL_PERFORMANCE: DeclaredDataset = {
	type: "schoolPerformance",
	name: "ladName",
	...schools,
	measures: SCHOOL_MEASURES,
	fields: schoolFields("series.{period}."),
	derived: latestCopies([
		"ptL2basics94",
		"ptL2basics95",
		"avgAtt8",
		"avgP8score",
		"pupils",
	]),
};

export const SCHOOL_PERFORMANCE_CONSTITUENCY: DeclaredDataset = {
	type: "schoolPerformanceConstituency",
	name: "pconName",
	period: schoolYear,
	measures: SCHOOL_MEASURES,
	fields: schoolFields("series.{period}."),
	derived: latestCopies([
		"ptL2basics94",
		"ptL2basics95",
		"avgAtt8",
		"avgP8score",
		"pupils",
	]),
};

const DISADVANTAGE: DeclaredDimension = {
	slug: "disadvantage",
	label: "Disadvantage",
	members: [
		{ key: "disadvantaged", label: "Disadvantaged pupils" },
		{ key: "not-disadvantaged", label: "Other pupils" },
	],
};

const gapFields = (prefix: string): DeclaredField[] => [
	...(
		[
			["att8Disadvantaged", "attainment-8", "disadvantaged"],
			["att8NotDisadvantaged", "attainment-8", "not-disadvantaged"],
			["disadvantagedPupils", "key-stage-4-pupils", "disadvantaged"],
			[
				"notDisadvantagedPupils",
				"key-stage-4-pupils",
				"not-disadvantaged",
			],
		] as const
	).map(([field, measure, group]) => ({
		path: `${prefix}${field}`,
		measure,
		members: { disadvantage: group },
		period: schoolYear,
	})),
	{
		path: `${prefix}engmath94Gap`,
		measure: "gcse-english-maths-grade-4-gap",
		period: schoolYear,
	},
];

export const SCHOOL_PERFORMANCE_DISADVANTAGE: DeclaredDataset = {
	type: "schoolPerformanceGap",
	name: "ladName",
	...schools,
	measures: [
		...SCHOOL_MEASURES,
		measure(
			"gcse-english-maths-grade-4-gap",
			"Disadvantage gap in English and maths at grade 4 or above",
			"percentage points",
			"rate",
			"none",
			"Other pupils' rate of grade 4 or above in English and maths less disadvantaged pupils' rate.",
		),
	],
	dimensions: [DISADVANTAGE],
	fields: gapFields("series.{period}."),
	derived: {
		...latestCopies([
			"att8Disadvantaged",
			"att8NotDisadvantaged",
			"att8Gap",
			"engmath94Gap",
			"disadvantagedPupils",
			"notDisadvantagedPupils",
		]),
		"series.{period}.att8Gap":
			"Other pupils' Attainment 8 less disadvantaged pupils'.",
	},
};
