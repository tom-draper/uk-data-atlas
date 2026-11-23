/**
 * The reviewed choices behind the default view of the statistics tables
 * (`v_observation_default`), and behind the members the API picks when a
 * request names none. This module is the one place they are written: the
 * pipeline reads it to fill `measure_dimension` and `series_preference`, and
 * the API reads it for its default members.
 *
 * Three kinds of declaration:
 * - how a measure's dimension is read, where the rule does not decide;
 * - which dataset to prefer when several publish the same quantity;
 * - the members the API chooses for a measure whose series are broken down
 *   several ways.
 */

/**
 * A measure's dimension plays one of two roles.
 * - `breakdown`: its members split a total. The default series is the one at
 *   the total member, or, when the measure has a series with no member of the
 *   dimension, that series (`default` left out).
 * - `qualifier`: each member is a different quantity, such as male and female
 *   life expectancy, so none is a total and every member is in the default
 *   view.
 */
export type DimensionRoleDeclaration =
	| {
			role: "breakdown";
			/** The total's code. Left out when the total is the series with no member. */
			default?: string;
			reason: string;
	  }
	| { role: "qualifier"; reason: string };

/** The root member of a dimension that is a total, when it has one. */
export const TOTAL_MEMBER_CODES = ["total", "all"] as const;

/** Where several datasets publish one quantity, the order they are preferred in. */
export type DatasetPreference = {
	/** Dataset slugs, most preferred first. */
	order: readonly string[];
	reason: string;
};

export type MeasurePreference = {
	/** Dimension roles that the rule (a root member coded total or all) does not give. */
	dimensions?: Readonly<Record<string, DimensionRoleDeclaration>>;
	datasets?: DatasetPreference;
	/**
	 * The members the API chooses when a request names none and the measure's
	 * series are broken down in different ways (households by tenure and by
	 * car availability). They match the series of the preferred dataset.
	 */
	apiDefaultMembers?: Readonly<Record<string, string>>;
};

const qualifier = (reason: string): DimensionRoleDeclaration => ({
	role: "qualifier",
	reason,
});
const breakdown = (
	reason: string,
	defaultMember?: string,
): DimensionRoleDeclaration => ({
	role: "breakdown",
	reason,
	...(defaultMember === undefined ? {} : { default: defaultMember }),
});

const SEX_QUALIFIER = qualifier(
	"Male and female are two figures, not parts of a total: no series holds both.",
);
const PAY_STATISTIC = qualifier(
	"Mean, median and each percentile are different statistics of one pay distribution.",
);
const EARNINGS_PLACE = qualifier(
	"Pay by where people live and by where they work are two quantities.",
);
const NO_TOTAL_COHORT = (what: string) =>
	breakdown(
		`The ${what} are parts of the whole cohort, which is the series with no member of this dimension.`,
	);

const ELECTION_ORDER: DatasetPreference = {
	order: [
		"general-election",
		"historical-general-election",
		"local-election",
	],
	reason: "general-election is the primary results dataset. historical-general-election repeats 2017 and 2019 (seven electorate figures differ, by up to 2,226, so the choice matters). local-election holds other contests, so it never competes on a period.",
};

const CENSUS_DISCLOSURE =
	"Census tables are each disclosure controlled on their own, so the same total differs between them by up to about 111.";

const MOBILE_COVERAGE = {
	"coverage-location": qualifier(
		"Indoor and outdoor coverage are different figures.",
	),
	"mobile-operators": qualifier(
		"'all' (every operator) and 'any' (at least one) are two coverage figures, not a total and its parts.",
	),
	"mobile-technology": qualifier("4G and 5G coverage are different figures."),
} as const;

/** Every measure that needs a reviewed declaration, by measure slug. */
export const MEASURE_PREFERENCES: Readonly<Record<string, MeasurePreference>> =
	{
		area: {
			dimensions: {
				surface: qualifier(
					"Extent, land and inland water are three measured areas. Land and water add up to extent, but each is its own quantity.",
				),
			},
		},
		"ashe-jobs": {
			dimensions: {
				"earnings-place": EARNINGS_PLACE,
				"pay-period": qualifier(
					"Annual and hourly pay are different measurements of the same jobs.",
				),
			},
		},
		"attainment-8": {
			dimensions: {
				disadvantage: NO_TOTAL_COHORT(
					"disadvantaged and not disadvantaged pupils",
				),
			},
		},
		"background-concentration": {
			dimensions: {
				pollutant: qualifier(
					"Each pollutant is a different concentration in its own units.",
				),
			},
		},
		"broadband-availability": {
			dimensions: {
				"broadband-speed": qualifier(
					"Superfast, ultrafast, full fibre and gigabit are nested availability tiers, each a share of premises with its own meaning.",
				),
			},
		},
		claimants: {
			datasets: {
				order: ["claimant-count", "claimant-count-history"],
				reason: "claimant-count is the month the website and API already serve, as the Department for Work and Pensions published it for that release. claimant-count-history restates every month on the April 2023 authorities, so its April 2026 figures can differ slightly. It fills the months claimant-count does not hold.",
			},
			dimensions: {
				"age-group": breakdown(
					"16-plus is the root of the dimension: 16-to-24 sits within it.",
					"16-plus",
				),
			},
		},
		"gross-annual-pay": {
			dimensions: {
				"earnings-place": EARNINGS_PLACE,
				"pay-statistic": PAY_STATISTIC,
			},
		},
		"gross-annual-pay-change": {
			dimensions: {
				"earnings-place": EARNINGS_PLACE,
				"pay-statistic": PAY_STATISTIC,
			},
		},
		"gross-hourly-pay": {
			dimensions: {
				"earnings-place": EARNINGS_PLACE,
				"pay-statistic": PAY_STATISTIC,
			},
		},
		"gross-hourly-pay-change": {
			dimensions: {
				"earnings-place": EARNINGS_PLACE,
				"pay-statistic": PAY_STATISTIC,
			},
		},
		"healthy-life-expectancy": { dimensions: { sex: SEX_QUALIFIER } },
		"imd-domain-score": {
			dimensions: {
				"deprivation-domain": qualifier(
					"Each domain is scored on its own scale. No domain is a total of the others.",
				),
			},
		},
		"key-stage-4-pupils": {
			dimensions: {
				disadvantage: NO_TOTAL_COHORT(
					"disadvantaged and not disadvantaged pupils",
				),
			},
		},
		"life-expectancy": { dimensions: { sex: SEX_QUALIFIER } },
		"mobile-area-coverage": { dimensions: MOBILE_COVERAGE },
		"mobile-premises-coverage": { dimensions: MOBILE_COVERAGE },
		"party-vote-share": {
			dimensions: {
				"party-group": qualifier(
					"Each party group's share is its own quantity. The shares add to 100 but no group is the total.",
				),
			},
		},
		"party-vote-share-change": {
			dimensions: {
				party: qualifier(
					"Each party's change in share is its own quantity.",
				),
			},
		},
		"party-votes": {
			datasets: ELECTION_ORDER,
			dimensions: {
				party: qualifier(
					"Each party's votes are their own quantity. Sum them for the valid votes, or read valid-votes.",
				),
				"party-group": qualifier(
					"A coarser grouping of the same votes as party, so do not sum party and party-group together.",
				),
			},
		},
		"planning-applications": {
			dimensions: {
				"application-stage": qualifier(
					"Received, decided and withdrawn applications are three counts of different events.",
				),
			},
		},
		"referendum-vote-share": {
			dimensions: {
				"referendum-answer": qualifier(
					"Remain and leave are each their own share.",
				),
			},
		},
		"referendum-votes": {
			dimensions: {
				"referendum-answer": qualifier(
					"Remain and leave are each their own count.",
				),
			},
		},
		"school-sessions": {
			dimensions: {
				"session-type": qualifier(
					"Possible, absent, authorised and unauthorised sessions are four counts. The root, possible, is the base the others are counted against, not their total.",
				),
			},
		},
		"usual-residents": {
			datasets: {
				order: [
					"census-2021-ts001",
					"census-2022-scotland-uv101b",
					"census-2021-ni-a01",
					"census-2021-ts037",
					"census-2022-scotland-uv302",
					"general-health",
				],
				reason: `census-2021-ts001 is the census's own count of usual residents. ${CENSUS_DISCLOSURE}`,
			},
			apiDefaultMembers: { "residence-type": "total" },
			dimensions: {
				"age-band": breakdown(
					"Age bands split the residents, which are the series with no age band.",
				),
				"ethnic-group": breakdown(
					"Ethnic groups split the residents, which are the series with no ethnic group.",
				),
			},
		},
		"usual-residents-16-plus": {
			datasets: {
				order: ["qualification", "census-2021-ts066"],
				reason: "qualification is the dataset the API already serves for this measure. Both are census tables for the same residents.",
			},
			apiDefaultMembers: { "highest-qualification": "total" },
		},
		households: {
			datasets: {
				order: [
					"census-2021-ts054",
					"census-2022-scotland-uv404",
					"housing-tenure",
					"census-2021-ts003",
					"census-2022-scotland-uv113",
					"census-2021-ni-e01",
					"fuel-poverty",
					"car-availability",
				],
				reason: `census-2021-ts054 (tenure) is the households series the API already serves, and housing-tenure repeats its figures. ${CENSUS_DISCLOSURE}`,
			},
			apiDefaultMembers: { tenure: "total" },
		},
		premises: {
			datasets: {
				order: ["broadband", "mobile-coverage"],
				reason: "broadband counts every premises Ofcom lists. mobile-coverage counts the same premises for a different survey.",
			},
		},
		electorate: { datasets: ELECTION_ORDER },
		"valid-votes": { datasets: ELECTION_ORDER },
		"rejected-ballots": { datasets: ELECTION_ORDER },
		turnout: { datasets: ELECTION_ORDER },
		seats: { datasets: ELECTION_ORDER },
		majority: { datasets: ELECTION_ORDER },
		population: {
			datasets: {
				order: [
					"population-lsoa",
					"population-data-zone-scotland",
					"population-data-zone-ni",
					"imd",
					"population",
					"population-council-scotland",
					"population-district-ni",
					"population-uk",
					"population-constituency",
				],
				reason: "The finest areas first, so a value converted onto another release is built from the most areas. population-lsoa, population-data-zone-scotland and population-data-zone-ni are the official small-area estimates of each nation (2011 to 2024, and 2021 to 2024 for Northern Ireland), so their sums are preferred on every release they reach. imd is published on LSOAs and holds the denominators of its two editions, counted at mid-2012 for 2015 and mid-2022 for 2025 and held under the edition year, so it comes after the mid-year estimates: it fills the 2025 period they do not reach and never replaces a mid-year estimate for 2015. population holds wards for 2022, which population-uk also converts onto councils from the 2023 authorities: the ward sum is preferred there. population-council-scotland and population-district-ni are the single-year estimates of National Records of Scotland and NISRA for their own councils and districts, which hold every year from 1981 and 2001 and Scotland's revised mid-2023 and mid-2024, so they come before population-uk, which repackages the same two nations through the ONS. population-constituency holds 2021 and 2022 only. A value published on the release itself is native and wins over any of these.",
			},
			dimensions: {
				age: breakdown(
					"Single years of age split the whole population, which is the series with no age.",
				),
			},
		},
	};

/** The members the API chooses for a measure whose series are broken down in different ways. */
export const MEASURE_DEFAULT_MEMBERS: Readonly<
	Record<string, Readonly<Record<string, string>>>
> = Object.fromEntries(
	Object.entries(MEASURE_PREFERENCES).flatMap(([measure, preference]) =>
		preference.apiDefaultMembers
			? [[measure, preference.apiDefaultMembers]]
			: [],
	),
);
