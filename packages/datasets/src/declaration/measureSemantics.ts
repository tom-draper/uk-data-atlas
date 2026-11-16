import type { StatisticsMeasure } from "./vocabulary.ts";

/** Population or entity base of a measure. Unknown is used where the source
 * declaration does not specify a common base. Not applicable covers totals
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
] as const;

/** Grouping is deliberately explicit. Slugs absent here have an unknown base. */
const UNIVERSE_MEASURES: Readonly<Record<string, readonly string[]>> = {
	"not-applicable": [
		"area",
		"collected-waste",
		"electricity-consumption",
		"gas-consumption",
		"gdp",
		"gva",
		"ghg-emissions",
		"education-services-budget",
		"household-waste-recycled",
	],
	residents: [
		"population",
		"ghg-population",
		"preventable-mortality",
		"pm25-population-weighted",
		"pm25-population-weighted-anthropogenic",
		"life-expectancy",
		"healthy-life-expectancy",
	],
	"usual-residents": ["usual-residents"],
	"usual-residents-16-plus": [
		"usual-residents-16-plus",
		"people-in-employment",
	],
	households: [
		"households",
		"fuel-poor-households",
		"fuel-poverty-rate",
		"households-in-temporary-accommodation",
		"households-in-temporary-accommodation-rate",
	],
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
		"party-votes",
		"party-vote-share",
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

export type MeasureStatistic =
	| "count"
	| "total"
	| "mean"
	| "median"
	| "quantile"
	| "rate"
	| "share"
	| "index"
	| "rank"
	| "category"
	| "ratio"
	| "difference"
	| "interval"
	| "by-dimension";

/** Exceptions to the legacy value_kind mapping, which conflated statistic and unit. */
const STATISTIC_OVERRIDES: Readonly<Record<string, MeasureStatistic>> = {
	"band-d-council-tax": "mean",
	"social-care-quality-of-life": "mean",
	"house-price-to-earnings-ratio": "ratio",
	majority: "difference",
	"gcse-english-maths-grade-4-gap": "difference",
	"unemployed-people-interval": "interval",
	"unemployment-rate-interval": "interval",
	"gross-annual-pay": "by-dimension",
	"gross-hourly-pay": "by-dimension",
	"gross-annual-pay-change": "by-dimension",
	"gross-hourly-pay-change": "by-dimension",
};

export function measureSemantics(measure: StatisticsMeasure) {
	const statistic: MeasureStatistic =
		STATISTIC_OVERRIDES[measure.slug] ??
		(measure.valueKind === "amount" ? "total" : measure.valueKind);
	return {
		statistic,
		statisticDimension:
			statistic === "by-dimension" ? "pay-statistic" : null,
		universeId: universeByMeasure.get(measure.slug) ?? 1,
	};
}
