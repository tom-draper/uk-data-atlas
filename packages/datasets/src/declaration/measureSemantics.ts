import type { MeasureUnit } from "./measureUnits.ts";
import { nationCensusUnit, STANDALONE_NATION_CENSUS } from "./nationCensus.ts";
import type { MeasureStatistic, StatisticsMeasure } from "./vocabulary.ts";

/** Population or entity base of a measure. Unknown is kept for compatibility only: the
 * build refuses a measure that resolves to it. Not applicable covers totals
 * whose values are not statistics over a population. IDs are permanent. */
export const MEASURE_UNIVERSES = [
	[1, "unknown", "Unknown"],
	[2, "not-applicable", "Not applicable"],
	[3, "residents", "Residents"],
	[4, "usual-residents", "Usual residents"],
	[5, "usual-residents-16-plus", "Usual residents aged 16 and over"],
	[6, "households", "Households"],
	[7, "dwellings", "Dwellings"],
	[8, "pupils", "Pupils"],
	[9, "jobs", "Jobs"],
	[10, "electors", "Electors"],
	[11, "area", "Land area"],
	[12, "premises", "Premises"],
	[13, "valid-votes", "Valid votes"],
	[14, "adults", "Adults"],
	[15, "children-under-16", "Children under 16"],
	[16, "residents-16-64", "Residents aged 16 to 64"],
	[
		17,
		"economically-active",
		"Economically active residents aged 16 and over",
	],
	[18, "property-sales", "Residential property sales"],
	[19, "employees", "Employee jobs"],
	[20, "grid-cells", "Air quality grid cells"],
	[21, "social-care-clients", "Adult social care clients"],
	[22, "reception-children", "Measured reception year children"],
	[23, "year-6-children", "Measured year 6 children"],
	[24, "residents-16-plus", "Residents aged 16 and over"],
	[
		25,
		"children-in-temporary-accommodation",
		"Children in temporary accommodation",
	],
	[26, "claimants", "Claimants of unemployment-related benefits"],
	[27, "energy-meters", "Energy meters"],
	[28, "enterprises", "VAT or PAYE registered enterprises"],
	[29, "small-areas", "Small areas"],
	[30, "planning-applications", "Planning applications"],
	[31, "chargers", "Public electric vehicle charging devices"],
	[32, "offences", "Police recorded offences"],
	[33, "ballots", "Ballots"],
	[34, "collisions", "Reported road collisions involving personal injury"],
	[35, "pathways", "Incomplete referral to treatment pathways"],
	[36, "seats", "Parliamentary seats"],
	[37, "contests", "Election contests"],
	[38, "band-d-equivalent-dwellings", "Band D equivalent dwellings"],
	[39, "household-spaces", "Household spaces"],
] as const;

/**
 * Why a measure has no population or entity base. Every not-applicable
 * measure needs one, so the base is a decision and never a gap.
 */
export const NOT_APPLICABLE_REASONS: Readonly<Record<string, string>> = {
	area: "The measure is the land area itself, not a statistic over entities.",
	"collected-waste":
		"Tonnes of material collected. No population or entity count is the base of a tonnage.",
	"household-waste-recycled":
		"Tonnes of material recycled. No population or entity count is the base of a tonnage.",
	gdp: "A monetary output total. It is a sum of values in pounds, not a count over entities.",
	gva: "A monetary output total. It is a sum of values in pounds, not a count over entities.",
	"ghg-emissions":
		"Tonnes of gas emitted. Emissions are attributed to the area, not to a population or entity count.",
	"education-services-budget":
		"A monetary budget total. It is a sum of values in pounds, not a count over entities.",
	"house-price-to-earnings-ratio":
		"The publisher's ratio of the median price of existing dwellings to median gross annual residence-based earnings. It has no population or entity count of its own.",
};

/**
 * Grouping is deliberately explicit. A measure listed nowhere here fails the
 * build, so a new measure must state its base or why it has none.
 */
const UNIVERSE_MEASURES: Readonly<Record<string, readonly string[]>> = {
	"not-applicable": Object.keys(NOT_APPLICABLE_REASONS),
	residents: [
		"population",
		"ghg-population",
		"preventable-mortality",
		"pm25-population-weighted",
		"pm25-population-weighted-anthropogenic",
		"life-expectancy",
		"healthy-life-expectancy",
		"recorded-crimes-per-1000-residents",
		"public-ev-chargers-per-10000-residents",
	],
	"usual-residents": [
		"usual-residents",
		...STANDALONE_NATION_CENSUS.filter(
			({ universe }) => nationCensusUnit(universe) === "usual residents",
		).map(({ dataset }) => dataset),
	],
	"usual-residents-16-plus": [
		"usual-residents-16-plus",
		"people-in-employment",
	],
	households: [
		"households",
		...STANDALONE_NATION_CENSUS.filter(
			({ universe }) => nationCensusUnit(universe) === "households",
		).map(({ dataset }) => dataset),
		"fuel-poor-households",
		"fuel-poverty-rate",
		"households-in-temporary-accommodation",
		"households-in-temporary-accommodation-rate",
	],
	"household-spaces": STANDALONE_NATION_CENSUS.filter(
		({ universe }) => nationCensusUnit(universe) === "household spaces",
	).map(({ dataset }) => dataset),
	dwellings: ["net-additional-dwellings"],
	pupils: [
		"attainment-8",
		"key-stage-4-pupils",
		"progress-8",
		"gcse-english-maths-grade-4",
		"gcse-english-maths-grade-4-gap",
		"gcse-english-maths-grade-5",
		"pupil-enrolments",
		"school-sessions",
	],
	jobs: ["total-jobs"],
	electors: ["electorate", "turnout"],
	area: ["mobile-area-coverage"],
	premises: [
		"premises",
		"mobile-premises-coverage",
		"broadband-availability",
	],
	"valid-votes": [
		"valid-votes",
		"majority",
		"party-votes",
		"party-vote-share",
		"party-vote-share-change",
		"referendum-votes",
		"referendum-vote-share",
	],
	adults: [
		"adult-excess-weight",
		"physically-active-adults",
		"smoking-prevalence",
	],
	"children-under-16": [
		"children-in-relative-low-income",
		"children-in-relative-low-income-rate",
	],
	"residents-16-64": ["claimant-rate"],
	"residents-16-plus": ["unemployed-people", "unemployed-people-interval"],
	"economically-active": ["unemployment-rate", "unemployment-rate-interval"],
	"property-sales": ["house-price-mean", "house-price-median"],
	employees: [
		"ashe-jobs",
		"gross-annual-pay",
		"gross-hourly-pay",
		"gross-annual-pay-change",
		"gross-hourly-pay-change",
	],
	"grid-cells": ["air-quality-grid-cells", "background-concentration"],
	"social-care-clients": [
		"long-term-support-clients",
		"social-care-quality-of-life",
	],
	"children-in-temporary-accommodation": [
		"children-in-temporary-accommodation",
	],
	claimants: ["claimants"],
	"energy-meters": [
		"electricity-meters",
		"gas-meters",
		"electricity-consumption",
		"gas-consumption",
	],
	"band-d-equivalent-dwellings": ["band-d-council-tax"],
	enterprises: ["enterprises"],
	"small-areas": [
		"imd-decile",
		"imd-domain-score",
		"imd-rank",
		"imd-score",
		"nimdm-rank",
		"simd-decile",
		"simd-quintile",
		"simd-rank",
		"wimd-decile",
		"wimd-rank",
		"wimd-score",
	],
	"planning-applications": ["planning-applications"],
	chargers: ["public-ev-chargers"],
	offences: ["recorded-crimes"],
	ballots: ["rejected-ballots"],
	collisions: ["road-collisions"],
	pathways: [
		"rtt-incomplete-pathways",
		"rtt-incomplete-pathways-over-18-weeks",
	],
	seats: ["seats"],
	contests: ["source-winning-party"],
	"reception-children": ["reception-excess-weight"],
	"year-6-children": ["year-6-excess-weight"],
};

const universeByMeasure = new Map<string, number>();
for (const [slug, measures] of Object.entries(UNIVERSE_MEASURES)) {
	const universe = MEASURE_UNIVERSES.find((item) => item[1] === slug);
	if (!universe) throw new Error(`Unknown universe ${slug}`);
	for (const measure of measures) {
		if (universeByMeasure.has(measure))
			throw new Error(`Duplicate universe for ${measure}`);
		universeByMeasure.set(measure, universe[0]);
	}
}

/**
 * The valueKind the public API and the published vocabulary file still carry.
 * It is derived here, in one place, from the statistic, the unit kind and a
 * short list of measures whose old kind said something else. Nothing stores
 * it: replacing it in the v1 surface is a separate change.
 */
export type LegacyValueKind =
	| "count"
	| "rate"
	| "share"
	| "median"
	| "mean"
	| "index"
	| "rank"
	| "amount"
	| "category";

const LEGACY_KIND_OVERRIDES: Readonly<Record<string, LegacyValueKind>> = {
	"band-d-council-tax": "amount",
	"social-care-quality-of-life": "index",
};

export function legacyValueKind(
	slug: string,
	statistic: MeasureStatistic,
	unitKind: MeasureUnit["kind"],
): LegacyValueKind {
	const override = LEGACY_KIND_OVERRIDES[slug];
	if (override) return override;
	switch (statistic) {
		case "total":
			return "amount";
		case "ratio":
			return "index";
		case "quantile":
			return "median";
		case "difference":
		case "interval":
			return unitKind === "count" ? "count" : "rate";
		case "by-dimension":
			return unitKind === "percent" ? "rate" : "amount";
		default:
			return statistic;
	}
}

export function measureSemantics(measure: StatisticsMeasure) {
	return {
		statistic: measure.statistic,
		statisticDimension:
			measure.statistic === "by-dimension" ? "pay-statistic" : null,
		universeId: universeByMeasure.get(measure.slug) ?? 1,
	};
}
