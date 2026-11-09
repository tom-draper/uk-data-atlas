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
import { ICB_ODS_TO_GSS } from "@uk-data-atlas/datasets";
import { measure } from "./measures.ts";

/** Crime, safety, housing need, care, planning, health and schools. */

const offence = (
	key: string,
	code: string,
	label: string,
	parent?: string,
) => ({ key, code, label, ...(parent ? { parent } : {}) });

export const crimeSeries = () =>
	CRIME.dimensions!.find(
		(dimension) => dimension.slug === "offence",
	)!.members!.map(({ code, key }) => {
		const member = code ?? key;
		const suffix =
			member === "theft"
				? "theft-offences"
				: member === "death-or-serious-injury-by-unlawful-driving"
					? "death-or-serious-injury-by-illegal-driving"
					: member;
		return {
			id: `crime-${suffix}`,
			measure: "recorded-crimes",
			dimensions: { offence: member },
		};
	});

export const CRIME: DeclaredDataset = {
	type: "crime",
	module: "crime",
	name: {
		data: "ladName",
		partnerships: "communitySafetyPartnershipName",
	},
	/** The local authorities, then the community safety partnerships they sit in. */
	records: [
		{ from: "data", alsoIn: [{ geography: "localAuthority", year: 2022 }] },
		{
			from: "partnerships",
			release: () => ({
				geography: "communitySafetyPartnership",
				year: 2023,
			}),
		},
	],
	parents: [
		{
			sets: ["data", "partnerships"],
			code: "policeForceAreaCode",
			name: "policeForceAreaName",
			release: { geography: "policeForceArea", year: 2023 },
		},
		{
			code: "communitySafetyPartnershipCode",
			name: "communitySafetyPartnershipName",
			release: { geography: "communitySafetyPartnership", year: 2023 },
		},
		/** A partnership that is one authority names it; one of several names none. */
		{
			sets: ["partnerships"],
			relation: "coterminous",
			nullable: true,
			code: "localAuthorityCode",
			release: { geography: "localAuthority", year: 2026 },
			alsoIn: [{ geography: "localAuthority", year: 2022 }],
		},
	],
	payload: {
		parts: () => [
			{
				key: "2026",
				header: {
					id: "crime2026",
					year: 2026,
					type: "crime",
					boundaryType: "localAuthority",
					boundaryYear: 2026,
					dataDate: "year ending March 2026",
					jurisdiction: "England and Wales",
					metadata: {
						source: "Police recorded crime from the Home Office",
						notes: [
							"Police recorded crime statistics are published as official statistics, not accredited official statistics",
							"Published by community safety partnership. An authority split between several partnerships is their sum; an authority inside a partnership covering several authorities has no value of its own.",
							"No figures for Dartford and Gravesham, Maidstone, Medway, Tonbridge and Malling, Tunbridge Wells: the police recorded their crime under the force's unassigned total, so the published counts are only a remnant.",
						],
					},
					coverageCountries: ["GB-ENG", "GB-WLS"],
				},
			},
		],
		code: {
			data: "ladCode",
			partnerships: "communitySafetyPartnershipCode",
		},
		/** A partnership that is one authority takes that authority's name, where it has one. */
		fill: (record, _code, earlier) => {
			if (!("localAuthorityCode" in record)) return;
			const authority = record.localAuthorityCode
				? (earlier.data as Record<string, { ladName?: string }>)[
						String(record.localAuthorityCode)
					]?.ladName
				: undefined;
			record.localAuthorityName = record.localAuthorityCode
				? authority || record.communitySafetyPartnershipName
				: null;
		},
	},
	period: () => periods.yearEnding(2026, 3),
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

export const roadCollisionSeries = () =>
	ROAD_COLLISIONS.dimensions!.find(
		(dimension) => dimension.slug === "collision-severity",
	)!.members!.map(({ code, key }) => {
		const member = code ?? key;
		return {
			id: `road-collisions${member === "all" ? "" : `-${member}`}`,
			measure: "road-collisions",
			dimensions: { "collision-severity": member },
		};
	});

export const ROAD_COLLISIONS: DeclaredDataset = {
	type: "roadCollisions",
	module: "transport",
	payload: {
		parts: (labels) =>
			labels
				.filter((label) => /^\d{4}$/.test(label))
				.sort()
				.map((key) => ({
					key,
					header: {
						id: `roadCollisions${key}`,
						type: "roadCollisions",
						year: Number(key),
						period: `January to December ${key}`,
						boundaryType: "localAuthority",
						boundaryYear: Number(key),
						lsoaBoundaryYear: 2021,
						coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
					},
				})),
		code: { data: "ladCode", lsoas: "lsoaCode" },
		/** Collisions with no area to sit on: the excluded Heathrow code and those with no LSOA. */
		dropped: ["excluded", "withoutLsoa"],
	},
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

export const ADULT_SOCIAL_CARE_ACTIVITY = single(
	"adultSocialCareActivity",
	"health",
	periods.financialYear(2024),
	measure(
		"long-term-support-clients",
		"Clients receiving long-term support",
		"clients",
		"count",
		"sum",
		"Adult social care clients receiving long-term support during the year.",
	),
	{
		parts: yearParts(
			"adultSocialCareActivity",
			"localAuthority",
			2025,
			{ coverageCountries: ["GB-ENG"] },
			["2025"],
		),
		code: "code",
	},
);

export const ADULT_SOCIAL_CARE_OUTCOMES = single(
	"adultSocialCareOutcomes",
	"health",
	periods.financialYear(2024),
	measure(
		"social-care-quality-of-life",
		"Social care-related quality of life",
		"score out of 24",
		"index",
		"none",
		"Average social care-related quality of life score of service users (ASCOF 1A).",
	),
	{
		parts: yearParts(
			"adultSocialCareOutcomes",
			"localAuthority",
			2025,
			{ coverageCountries: ["GB-ENG"] },
			["2025"],
		),
		code: "code",
	},
);

export const NET_ADDITIONAL_DWELLINGS = single(
	"netAdditionalDwellings",
	"housing",
	periods.financialYear(2024),
	measure(
		"net-additional-dwellings",
		"Net additional dwellings",
		"dwellings",
		"count",
		"sum",
		"New dwellings and conversions less demolitions over the year.",
	),
	{
		parts: yearParts(
			"netAdditionalDwellings",
			"localAuthority",
			2025,
			{ coverageCountries: ["GB-ENG"] },
			["2025"],
		),
		code: "code",
	},
);

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

/** Each top-level field read back from the latest year in `series`. */
const latestCopyRules = (fields: string[]): Record<string, DerivedRule> =>
	Object.fromEntries(
		fields.map((field) => [
			field,
			(record) => {
				const series = record.series as Record<
					string,
					Record<string, number | null>
				>;
				// Integer keys iterate in ascending order.
				return series[Object.keys(series).at(-1)!][field];
			},
		]),
	);

const SCHOOL_COPIES = [
	"ptL2basics94",
	"ptL2basics95",
	"avgAtt8",
	"avgP8score",
	"pupils",
];

const schools = {
	period: schoolYear,
	alsoIn: [
		{ geography: "localAuthority", year: 2022 },
		{ geography: "localAuthority", year: 2018 },
	],
};

/** Keys of a school year's results: the year it ends. */
const schoolYears = Array.from({ length: 12 }, (_, index) =>
	String(2015 + index),
);

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

export const SCHOOL_PERFORMANCE_CONSTITUENCY: DeclaredDataset = {
	type: "schoolPerformanceConstituency",
	module: "education",
	payload: {
		parts: yearParts(
			"schoolPerformanceConstituency",
			"constituency",
			2024,
			{
				coverageCountries: ["GB-ENG"],
			},
			["2025"],
		),
		code: "pconCode",
		periodKeys: schoolYears,
		sparsePeriods: true,
		nullPaths: ["avgP8score", "series.2025.avgP8score"],
	},
	name: "pconName",
	period: schoolYear,
	measures: SCHOOL_MEASURES,
	fields: schoolFields("series.{period}."),
	derived: latestCopies(SCHOOL_COPIES),
	computed: latestCopyRules(SCHOOL_COPIES),
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

const GAP_COPIES = [
	"att8Disadvantaged",
	"att8NotDisadvantaged",
	"att8Gap",
	"engmath94Gap",
	"disadvantagedPupils",
	"notDisadvantagedPupils",
];

/** The compiler leaves a gap null where either side has fewer pupils. */
const GAP_MINIMUM_PUPILS = 6;

export const SCHOOL_PERFORMANCE_DISADVANTAGE: DeclaredDataset = {
	type: "schoolPerformanceGap",
	module: "education",
	payload: {
		parts: yearParts(
			"schoolPerformanceGap",
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
	},
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
		...latestCopies(GAP_COPIES),
		"series.{period}.att8Gap":
			"Other pupils' Attainment 8 less disadvantaged pupils'.",
	},
	computed: {
		// The yearly gaps first, so the copies read them.
		"series.{period}.att8Gap": (record, path) => {
			const series = record.series as Record<
				string,
				Record<string, number | null>
			>;
			const year = series[path[1]];
			const ahead = year.att8NotDisadvantaged;
			const behind = year.att8Disadvantaged;
			const aheadPupils = year.notDisadvantagedPupils;
			const behindPupils = year.disadvantagedPupils;
			if (ahead === null || behind === null) return null;
			if (aheadPupils === null || behindPupils === null) return null;
			if (
				aheadPupils < GAP_MINIMUM_PUPILS ||
				behindPupils < GAP_MINIMUM_PUPILS
			)
				return null;
			return Number((ahead - behind).toFixed(1));
		},
		...latestCopyRules(GAP_COPIES),
	},
};

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

export const NHS_WAITING: DeclaredDataset = {
	type: "nhsWaiting",
	module: "health",
	payload: {
		parts: () => [
			{
				key: "2026",
				header: {
					id: "nhsWaiting2026",
					type: "nhsWaiting",
					year: 2026,
					month: "March 2026",
					boundaryType: "localAuthority",
					boundaryYear: 2024,
					coverageCountries: ["GB-ENG"],
				},
			},
		],
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
			((record.over18Weeks as number) / (record.total as number)) * 100,
	},
};
