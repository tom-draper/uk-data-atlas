import type { ConversionBasis } from "./crosswalkSteps.ts";
import type { SeriesSelector } from "./seriesValues.ts";

/**
 * The conversions whose answer is published somewhere else, so the converted
 * figure can be compared with the truth. Each case pins its route, so a change
 * to the crosswalk graph cannot quietly change what is being measured.
 *
 * Releases and crosswalks are named by slug, which is what the registries in
 * `pipeline/ids/` keep stable.
 */

/** One hop of a pinned route: crosswalk slugs, walked backwards where `reversed`. */
export type CaseHop = { crosswalks: string[]; reversed?: boolean };

export type CaseSeries = Omit<SeriesSelector, "release"> & {
	/** `geography:release`. */
	release: string;
};

/**
 * What the case measures.
 * - `noise`: an exact regrouping of perturbed census counts, so any difference
 *   is the publisher's disclosure control and not the conversion.
 * - `regroup`: a route with no split, expected to be exact.
 * - `split`: one estimated hop.
 * - `chain`: more than one estimated hop.
 */
export type CaseKind = "noise" | "regroup" | "split" | "chain";

export type BacktestCase = {
	id: string;
	title: string;
	kind: CaseKind;
	source: CaseSeries;
	truth: CaseSeries;
	route: CaseHop[];
	/**
	 * Where the truth is published on an older release than the route ends
	 * on, the exact hops that bring it forward. A truth published on the
	 * route's last release is always used first.
	 */
	truthRoute?: CaseHop[];
	bases: ConversionBasis[];
	/** Only series whose members match, where the truth holds fewer breakdowns. */
	members?: RegExp;
	/**
	 * Compare one total in place of each series: the sum of the source series
	 * whose members match, against the sum of the truth series that match.
	 */
	total?: { label: string; source: RegExp; truth: RegExp };
	/** Only these periods, where the truth for others is a different vintage. */
	periods?: string[];
	/** What kind of figure the source is, which sets how exact a regrouping can be. */
	family: "census" | "population" | "administrative" | "modelled";
	/**
	 * Set where the case's one split measures the error of a splitting method
	 * for a class of measure. See `errorModel.ts`.
	 */
	fits?: { method: string; measureClass: string };
	/** Set where the case checks the bounds fitted for a method on another case. */
	checks?: { method: string };
	note?: string;
};

const LSOA = "lsoa:2021-12-ew-bgc-v5";
const MSOA = "msoa:2021-12-ew-bgc-v3";
const LA = (release: string) => `localAuthority:${release}`;
const WARD_2023 = "ward:2023-12-uk-bgc";
const CON_2024 = "constituency:2024-07-uk-bgc";

const hop = (...crosswalks: string[]): CaseHop => ({ crosswalks });
const back = (...crosswalks: string[]): CaseHop => ({
	crosswalks,
	reversed: true,
});

export type CaseSlugs = {
	lsoaToMsoa: string;
	lsoaToLa2023: string;
	msoaToLa2023: string;
	lsoaToLa2026: string;
	la: Record<
		| "2019-12>2020-12"
		| "2020-12>2021-12"
		| "2021-12>2022-12"
		| "2022-12>2023-05"
		| "2023-05>2023-12"
		| "2023-12>2024-05"
		| "2024-05>2024-12"
		| "2024-12>2025-05"
		| "2025-05>2025-12"
		| "2025-12>2026-05"
		| "2018-12>2019-04"
		| "2019-04>2019-12",
		string
	>;
	/**
	 * Carries the three authorities whose extent moved between the two
	 * releases, which the extent continuity crosswalk leaves without an edge.
	 */
	la2025MayToDecPostcodes: string;
	ward2023MayToDec: string;
	ward2023MayToLa2023Dec: string;
	ward2023ToLa2026: string;
	ward2023ToCon2024Overlap: string;
	ward2023ToCon2024BestFit: string;
	ward2023ToCon2022Overlap: string;
	con2024ToLa2024: string[];
	con: Record<
		"2019-12>2020-12" | "2020-12>2021-12" | "2021-12>2022-12",
		string
	>;
	con2019To2024: string;
};

/** The one class of measure a split has been measured for. */
export const TOTAL_POPULATION = "total population";

const ALL_BASES: ConversionBasis[] = [
	"population",
	"households",
	"dwellings",
	"postcodes",
];

const CENSUS_TABLES: Array<[string, string]> = [
	["census-2021-ts001", "usual-residents"],
	["census-2021-ts003", "households"],
	["census-2021-ts007a", "usual-residents"],
	["census-2021-ts021", "usual-residents"],
	["census-2021-ts037", "usual-residents"],
	["census-2021-ts054", "households"],
	["census-2021-ts066", "usual-residents-16-plus"],
];

/** The cases, given the slugs of the crosswalks they pin. */
export const backtestCases = (x: CaseSlugs): BacktestCase[] => {
	const la2021To2023 = [
		hop(x.la["2021-12>2022-12"]),
		hop(x.la["2022-12>2023-05"]),
		hop(x.la["2023-05>2023-12"]),
	];
	const la2023To2026 = [
		hop(x.la["2023-12>2024-05"]),
		hop(x.la["2024-05>2024-12"]),
		hop(x.la["2024-12>2025-05"]),
		hop(x.la["2025-05>2025-12"], x.la2025MayToDecPostcodes),
		hop(x.la["2025-12>2026-05"]),
	];
	const population = { dataset: "population", measure: "population" };
	const populationLa = {
		dataset: "population-uk",
		measure: "population",
		release: LA("2023-12-uk-bgc"),
	};
	// The population series are single years of age, so a total is their sum.
	const allAges = /\/sex=all$/;
	return [
		...CENSUS_TABLES.map(([dataset, measure]): BacktestCase => ({
			id: `noise-${dataset}`,
			title: `${dataset} LSOA to MSOA`,
			kind: "noise",
			source: { dataset, measure, release: LSOA },
			truth: { dataset, measure, release: MSOA },
			route: [hop(x.lsoaToMsoa)],
			bases: ["population"],
			family: "census",
		})),
		{
			id: "regroup-census-lsoa-la-2023",
			title: "Census ethnic group, LSOA to local authority 2023",
			kind: "noise",
			source: {
				dataset: "census-2021-ts021",
				measure: "usual-residents",
				release: LSOA,
			},
			truth: {
				dataset: "ethnicity",
				measure: "usual-residents",
				release: LA("2021-12-uk-bgc"),
			},
			route: [hop(x.lsoaToLa2023), hop(x.la["2023-05>2023-12"])],
			truthRoute: la2021To2023,
			bases: ["population"],
			family: "census",
		},
		{
			id: "regroup-census-lsoa-msoa-la-2023",
			title: "Census ethnic group, LSOA to MSOA to local authority 2023",
			kind: "noise",
			source: {
				dataset: "census-2021-ts021",
				measure: "usual-residents",
				release: LSOA,
			},
			truth: {
				dataset: "ethnicity",
				measure: "usual-residents",
				release: LA("2021-12-uk-bgc"),
			},
			route: [
				hop(x.lsoaToMsoa),
				hop(x.msoaToLa2023),
				hop(x.la["2023-05>2023-12"]),
			],
			truthRoute: la2021To2023,
			bases: ["population"],
			family: "census",
		},
		{
			id: "regroup-census-lsoa-la-2026",
			title: "Census ethnic group, LSOA to local authority 2026 by best fit",
			kind: "noise",
			source: {
				dataset: "census-2021-ts021",
				measure: "usual-residents",
				release: LSOA,
			},
			truth: {
				dataset: "ethnicity",
				measure: "usual-residents",
				release: LA("2021-12-uk-bgc"),
			},
			route: [hop(x.lsoaToLa2026)],
			truthRoute: [...la2021To2023, ...la2023To2026],
			bases: ["population"],
			family: "census",
		},
		{
			id: "regroup-ward-la-2023",
			title: "Ward population by age and sex to local authority 2023",
			kind: "regroup",
			source: { ...population, release: WARD_2023 },
			truth: populationLa,
			route: [back(x.ward2023MayToDec), hop(x.ward2023MayToLa2023Dec)],
			bases: ["population"],
			family: "population",
		},
		{
			id: "regroup-ward-la-2026",
			title: "Ward population by age and sex to local authority 2026 by best fit",
			kind: "regroup",
			source: { ...population, release: WARD_2023 },
			truth: populationLa,
			route: [hop(x.ward2023ToLa2026)],
			truthRoute: la2023To2026,
			bases: ["population"],
			family: "population",
		},
		...(
			[
				["ethnicity", "usual-residents"],
				["car-availability", "households"],
				["qualification", "usual-residents-16-plus"],
				["travel-to-work", "people-in-employment"],
			] as const
		).map(([dataset, measure]): BacktestCase => ({
			id: `regroup-la-2021-2023-${dataset}`,
			title: `${dataset}, local authority 2021 to 2023 mergers`,
			kind: "noise",
			source: { dataset, measure, release: LA("2021-12-uk-bgc") },
			truth: { dataset, measure, release: LA("2023-12-uk-bgc") },
			route: la2021To2023,
			bases: ["population"],
			family: "census",
		})),
		{
			id: "regroup-la-2022-2024-claimants",
			title: "Claimant count, local authority 2022 to 2024 mergers",
			kind: "regroup",
			source: {
				dataset: "claimant-count",
				measure: "claimants",
				release: LA("2022-12-uk-bgc-v2"),
			},
			truth: {
				dataset: "claimant-count",
				measure: "claimants",
				release: LA("2024-05-uk-bgc"),
			},
			route: [
				hop(x.la["2022-12>2023-05"]),
				hop(x.la["2023-05>2023-12"]),
				hop(x.la["2023-12>2024-05"]),
			],
			bases: ["population"],
			family: "administrative",
		},
		{
			id: "regroup-la-2019-2024-unemployment",
			title: "Unemployed people, local authority 2019 to 2024 mergers",
			kind: "regroup",
			source: {
				dataset: "unemployment",
				measure: "unemployed-people",
				release: LA("2019-12-uk-bgc"),
			},
			truth: {
				dataset: "unemployment",
				measure: "unemployed-people",
				release: LA("2024-05-uk-bgc"),
			},
			route: [
				hop(x.la["2019-12>2020-12"]),
				hop(x.la["2020-12>2021-12"]),
				...la2021To2023,
				hop(x.la["2023-12>2024-05"]),
			],
			bases: ["population"],
			family: "modelled",
			note: "The source is a model-based estimate, rounded, and is not additive across districts.",
		},
		{
			id: "regroup-lsoa-la-2024-collisions",
			title: "Road collisions, LSOA to local authority 2024",
			kind: "regroup",
			source: {
				dataset: "road-collisions",
				measure: "road-collisions",
				release: LSOA,
			},
			truth: {
				dataset: "road-collisions",
				measure: "road-collisions",
				release: LA("2024-05-uk-bgc"),
			},
			route: [
				hop(x.lsoaToLa2023),
				hop(x.la["2023-05>2023-12"]),
				hop(x.la["2023-12>2024-05"]),
			],
			bases: ["population"],
			family: "administrative",
			note: "An LSOA with no collisions has no row, which the conversion cannot tell from a missing value.",
		},
		{
			id: "split-ward-constituency-overlap",
			title: "Ward population to constituency 2024, postcode overlap",
			kind: "split",
			source: { ...population, release: WARD_2023 },
			truth: {
				dataset: "population-constituency",
				measure: "population",
				release: CON_2024,
			},
			route: [hop(x.ward2023ToCon2024Overlap)],
			bases: ALL_BASES,
			total: { label: "all ages", source: allAges, truth: /^$/ },
			family: "population",
			fits: {
				method: "postcode-overlap",
				measureClass: TOTAL_POPULATION,
			},
		},
		{
			id: "split-ward-constituency-best-fit",
			title: "Ward population to constituency 2024, best fit",
			kind: "split",
			source: { ...population, release: WARD_2023 },
			truth: {
				dataset: "population-constituency",
				measure: "population",
				release: CON_2024,
			},
			route: [hop(x.ward2023ToCon2024BestFit)],
			bases: ["population"],
			total: { label: "all ages", source: allAges, truth: /^$/ },
			family: "population",
			note: "Best fit gives each ward to one constituency, so a ward that straddles two is refused, not split.",
		},
		{
			id: "split-constituency-la",
			title: "Constituency population to local authority 2024, population overlap",
			kind: "split",
			source: {
				dataset: "population-constituency",
				measure: "population",
				release: CON_2024,
			},
			truth: populationLa,
			route: [hop(...x.con2024ToLa2024)],
			truthRoute: [hop(x.la["2023-12>2024-05"])],
			bases: ALL_BASES,
			total: { label: "all ages", source: /^$/, truth: allAges },
			// The mid-2022 local authority figures held are a later vintage than
			// the constituency ones, so only mid-2021 is a like-for-like truth.
			periods: ["2021"],
			family: "population",
			fits: {
				method: "population-overlap",
				measureClass: TOTAL_POPULATION,
			},
		},
		{
			id: "split-constituency-la-2022",
			title: "Constituency population to local authority 2024, mid-2022, a period the factor was not fitted on",
			kind: "split",
			source: {
				dataset: "population-constituency",
				measure: "population",
				release: CON_2024,
			},
			truth: populationLa,
			route: [hop(...x.con2024ToLa2024)],
			truthRoute: [hop(x.la["2023-12>2024-05"])],
			bases: ["population"],
			total: { label: "all ages", source: /^$/, truth: allAges },
			periods: ["2022"],
			family: "population",
			checks: { method: "population-overlap" },
			note: "The local authority truth is a later vintage of the mid-2022 estimates, so no value is exact, split or not.",
		},
		{
			id: "chain-ward-constituency-la",
			title: "Ward population by age and sex to constituency 2024 to local authority 2024",
			kind: "chain",
			source: { ...population, release: WARD_2023 },
			truth: populationLa,
			route: [hop(x.ward2023ToCon2024Overlap), hop(...x.con2024ToLa2024)],
			truthRoute: [hop(x.la["2023-12>2024-05"])],
			bases: ["population"],
			family: "population",
			note: "The ward figures are a different vintage of the mid-2022 estimates from the local authority ones, so part of the error is the publisher's revision. Each age and sex group is split on total population weights.",
		},
		{
			id: "chain-ward-constituency-2019-2024",
			title: "Ward population to constituency 2022, back to 2019, to constituency 2024",
			kind: "chain",
			source: { ...population, release: WARD_2023 },
			truth: {
				dataset: "population-constituency",
				measure: "population",
				release: CON_2024,
			},
			route: [
				hop(x.ward2023ToCon2022Overlap),
				back(x.con["2021-12>2022-12"]),
				back(x.con["2020-12>2021-12"]),
				back(x.con["2019-12>2020-12"]),
				hop(x.con2019To2024),
			],
			bases: ["population"],
			total: { label: "all ages", source: allAges, truth: /^$/ },
			family: "population",
			checks: { method: "postcode-overlap" },
			note: "Two estimated hops: the postcode overlap, then the publisher's 2010 to 2024 lookup, whose splits have no single-hop truth to be measured against.",
		},
	];
};

const la = (from: string, to: string) =>
	`local-authority-${from}-to-${to}-extent-continuity`;
const constituency = (from: string, to: string) =>
	`constituency-${from}-uk-bgc-to-${to}-uk-bgc-extent-continuity`;
const CON_TO_LA_2024 =
	"constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-population-overlap";

/** The crosswalks the cases pin, by slug. */
export const CASE_SLUGS: CaseSlugs = {
	lsoaToMsoa:
		"lsoa-2021-12-ew-bgc-v5-to-msoa-2021-12-ew-bgc-v3-official-lookup",
	lsoaToLa2023:
		"lsoa-2021-12-ew-bgc-v5-to-local-authority-2023-05-uk-bgc-v2-official-lookup",
	msoaToLa2023:
		"msoa-2021-12-ew-bgc-v3-to-local-authority-2023-05-uk-bgc-v2-official-lookup",
	lsoaToLa2026:
		"lsoa-2021-12-ew-bgc-v5-to-local-authority-2026-05-uk-bgc-best-fit",
	la: {
		"2018-12>2019-04": la("2018-12-uk-bgc", "2019-04-uk-bgc"),
		"2019-04>2019-12": la("2019-04-uk-bgc", "2019-12-uk-bgc"),
		"2019-12>2020-12": la("2019-12-uk-bgc", "2020-12-uk-bgc"),
		"2020-12>2021-12": la("2020-12-uk-bgc", "2021-12-uk-bgc"),
		"2021-12>2022-12": la("2021-12-uk-bgc", "2022-12-uk-bgc-v2"),
		"2022-12>2023-05":
			"local-authority-2022-12-uk-bgc-v2-to-2023-05-uk-bgc-v2-official-lookup",
		"2023-05>2023-12": la("2023-05-uk-bgc-v2", "2023-12-uk-bgc"),
		"2023-12>2024-05": la("2023-12-uk-bgc", "2024-05-uk-bgc"),
		"2024-05>2024-12": la("2024-05-uk-bgc", "2024-12-uk-bgc"),
		"2024-12>2025-05":
			"local-authority-2024-12-uk-bgc-to-2025-05-uk-bgc-v2-official-lookup",
		"2025-05>2025-12": la("2025-05-uk-bgc-v2", "2025-12-uk-bgc"),
		"2025-12>2026-05": la("2025-12-uk-bgc", "2026-05-uk-bgc"),
	},
	la2025MayToDecPostcodes:
		"local-authority-2025-05-uk-bgc-v2-to-2025-12-uk-bgc-postcode-overlap",
	ward2023MayToDec: "ward-2023-05-uk-bgc-to-2023-12-uk-bgc-extent-continuity",
	ward2023MayToLa2023Dec:
		"ward-2023-05-uk-bgc-to-local-authority-2023-12-uk-bgc-clean-containment",
	ward2023ToLa2026:
		"ward-2023-12-uk-bgc-to-local-authority-2026-05-uk-bgc-best-fit",
	ward2023ToCon2024Overlap:
		"ward-2023-12-uk-bgc-to-constituency-2024-07-uk-bgc-postcode-overlap",
	ward2023ToCon2024BestFit:
		"ward-2023-12-uk-bgc-to-constituency-2024-07-uk-bgc-best-fit",
	ward2023ToCon2022Overlap:
		"ward-2023-12-uk-bgc-to-constituency-2022-12-uk-bgc-postcode-overlap",
	con2024ToLa2024: [
		CON_TO_LA_2024,
		`${CON_TO_LA_2024}-scotland`,
		`${CON_TO_LA_2024}-northern-ireland`,
	],
	con: {
		"2019-12>2020-12": constituency("2019-12", "2020-12"),
		"2020-12>2021-12": constituency("2020-12", "2021-12"),
		"2021-12>2022-12": constituency("2021-12", "2022-12"),
	},
	con2019To2024: "constituency-2010-to-2024-official-lookup-v2",
};

export const BACKTEST_CASES = backtestCases(CASE_SLUGS);
