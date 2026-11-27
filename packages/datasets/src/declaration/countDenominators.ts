import { measure } from "./measures.ts";
import { STANDALONE_NATION_CENSUS } from "./nationCensus.ts";

/**
 * What each count is a count of, out of. Every additive count the atlas holds
 * is listed here, and the build fails on one that is missing, so a new count
 * has to say what a rate of it divides by or why it has no such rate.
 *
 * - `rebuilt`: the atlas computes the rate itself on every boundary release
 *   that holds both counts, as the sum of the numerator over the sum of the
 *   denominator, never as an average of rates. See
 *   `pipeline/src/storage/countRates.ts`.
 * - `named`: the denominator is named, but the rate is not built yet. The
 *   reason says what is missing or why it waits.
 * - `none`: no rate of the count is meaningful. The reason says why.
 */

/** Single years of age, inclusive. No `to` runs to the open top age. */
export type AgeRange = { from: number; to?: number };

/**
 * A count to divide by: a measure, and the members of it the rate is over.
 * Dimensions the filter leaves out are taken at their total.
 */
export type DenominatorReference = {
	measure: string;
	filter: { age?: AgeRange };
	/** Who the denominator counts, in words. */
	label: string;
};

export type CountDenominator =
	| {
			kind: "rebuilt";
			denominator: DenominatorReference;
			/** The rate measure the atlas writes. */
			rate: string;
			/** What numerator over denominator is multiplied by. */
			per: number;
	  }
	| { kind: "named"; denominator: DenominatorReference; reason: string }
	| { kind: "none"; reason: string };

export const RECORDED_CRIMES_PER_1000_RESIDENTS = measure(
	"recorded-crimes-per-1000-residents",
	"Recorded crime per 1,000 residents",
	"per 1,000 residents",
	"rate",
	"none",
	"Offences recorded by the police per 1,000 residents of all ages. Computed by the atlas as the offences of the area over its mid-year population, each summed on the area, never as an average of rates.",
);

export const PUBLIC_EV_CHARGERS_PER_10000_RESIDENTS = measure(
	"public-ev-chargers-per-10000-residents",
	"Public EV chargers per 10,000 residents",
	"per 10,000 residents",
	"rate",
	"none",
	"Publicly available electric vehicle charging devices per 10,000 residents of all ages. Computed by the atlas as the devices in the area over its mid-year population. The Department for Transport publishes devices per 100,000 people on its own population figures.",
);

const residents = (age?: AgeRange): DenominatorReference => ({
	measure: "population",
	filter: age ? { age } : {},
	label: age
		? age.to === undefined
			? `residents aged ${age.from} and over`
			: `residents aged ${age.from} to ${age.to}`
		: "residents of all ages",
});

const of = (measure: string, label: string): DenominatorReference => ({
	measure,
	filter: {},
	label,
});

const ITSELF =
	"It is itself a denominator: the rates of other counts are taken over it.";

const LATER =
	"Not built yet. The numerator and denominator are both held, and building it is listed as remaining work under task 27 in docs/database-roadmap.md.";

export const COUNT_DENOMINATORS: Readonly<Record<string, CountDenominator>> = {
	...Object.fromEntries(
		STANDALONE_NATION_CENSUS.map(({ dataset, universe }) => [
			dataset,
			{
				kind: "named",
				denominator: of(dataset, universe),
				reason: "The matching denominator is the publisher's universe total. Select it from the table's categories before dividing.",
			},
		]),
	),
	claimants: {
		kind: "rebuilt",
		denominator: residents({ from: 16, to: 64 }),
		rate: "claimant-rate",
		per: 100,
	},
	"recorded-crimes": {
		kind: "rebuilt",
		denominator: residents(),
		rate: RECORDED_CRIMES_PER_1000_RESIDENTS.slug,
		per: 1000,
	},
	"public-ev-chargers": {
		kind: "rebuilt",
		denominator: residents(),
		rate: PUBLIC_EV_CHARGERS_PER_10000_RESIDENTS.slug,
		per: 10000,
	},
	"children-in-relative-low-income": {
		kind: "named",
		denominator: residents({ from: 0, to: 15 }),
		reason: `The Department for Work and Pensions publishes the rate on its own count of children, held as children-in-relative-low-income-rate. ${LATER}`,
	},
	"children-in-temporary-accommodation": {
		kind: "named",
		denominator: residents({ from: 0, to: 17 }),
		reason: LATER,
	},
	"households-in-temporary-accommodation": {
		kind: "named",
		denominator: of("households", "households"),
		reason: "The published rate, households-in-temporary-accommodation-rate, is per 1,000 households on the publisher's own household estimate, which is not held. The households measure held is the census count of one year, so a rebuilt rate would differ from the published one by the household estimate alone.",
	},
	"fuel-poor-households": {
		kind: "named",
		denominator: of("households", "households"),
		reason: "The published fuel-poverty-rate is already rebuilt from fuel-poor households over the publisher's household count in the same table, which is the right denominator. The census households measure would be a different base.",
	},
	"road-collisions": {
		kind: "named",
		denominator: residents(),
		reason: LATER,
	},
	enterprises: {
		kind: "named",
		denominator: residents({ from: 16, to: 64 }),
		reason: `Business density is usually given per 10,000 residents aged 16 to 64. ${LATER}`,
	},
	"total-jobs": {
		kind: "named",
		denominator: residents({ from: 16, to: 64 }),
		reason: `Jobs density is published by the Office for National Statistics as jobs per resident aged 16 to 64. ${LATER}`,
	},
	electorate: {
		kind: "named",
		denominator: residents({ from: 18 }),
		reason: "A registration rate needs the population eligible to register, which differs by nation and by election (16 and 17 year olds in Scotland and Wales, and citizenship). Residents aged 18 and over is only an approximation, so it is not built.",
	},
	"long-term-support-clients": {
		kind: "named",
		denominator: residents({ from: 18 }),
		reason: `Adult social care is usually given per 100,000 adults aged 18 and over. ${LATER}`,
	},
	"people-in-employment": {
		kind: "named",
		denominator: of(
			"usual-residents-16-plus",
			"usual residents aged 16 and over",
		),
		reason: "Both are census counts of the same day. The census publishes the employment rate itself, and it is not rebuilt here.",
	},
	"net-additional-dwellings": {
		kind: "named",
		denominator: of("households", "households"),
		reason: "A rate of new dwellings is over the dwelling stock, which is not held. The census households measure is the nearest held count.",
	},
	gdp: {
		kind: "named",
		denominator: residents(),
		reason: `Per head figures are published by the Office for National Statistics on its own population. ${LATER}`,
	},
	gva: {
		kind: "named",
		denominator: residents(),
		reason: `Per head figures are published by the Office for National Statistics on its own population. ${LATER}`,
	},
	"ghg-emissions": {
		kind: "named",
		denominator: of(
			"ghg-population",
			"the publisher's mid-year population",
		),
		reason: "The publisher divides emissions by the population held as ghg-population, in the same table. Per capita emissions are not rebuilt here.",
	},
	"education-services-budget": {
		kind: "named",
		denominator: of("pupil-enrolments", "pupil enrolments"),
		reason: "Spending per pupil needs the pupils the budget funds, which are counted on a different year and include pupils outside state-funded schools. Not built.",
	},
	"electricity-consumption": {
		kind: "named",
		denominator: of("electricity-meters", "electricity meters"),
		reason: "Consumption per meter is the publisher's mean, taken over the meters in the same table. Not rebuilt here.",
	},
	"gas-consumption": {
		kind: "named",
		denominator: of("gas-meters", "gas meters"),
		reason: "Consumption per meter is the publisher's mean, taken over the meters in the same table. Not rebuilt here.",
	},
	"party-votes": {
		kind: "named",
		denominator: of("valid-votes", "valid votes"),
		reason: "The share is published as party-vote-share, over the valid votes of the same contest.",
	},
	"referendum-votes": {
		kind: "named",
		denominator: of("valid-votes", "valid votes"),
		reason: "The share is published as referendum-vote-share, over the valid votes of the same count.",
	},
	"valid-votes": {
		kind: "named",
		denominator: of("electorate", "electors"),
		reason: "Turnout is published as turnout, over the electorate of the same contest.",
	},
	"rtt-incomplete-pathways-over-18-weeks": {
		kind: "named",
		denominator: of("rtt-incomplete-pathways", "incomplete pathways"),
		reason: "A share of the waiting list, over the incomplete pathways of the same month and area. Not built yet.",
	},
	population: { kind: "none", reason: ITSELF },
	"usual-residents": { kind: "none", reason: ITSELF },
	"usual-residents-16-plus": { kind: "none", reason: ITSELF },
	households: { kind: "none", reason: ITSELF },
	"ghg-population": { kind: "none", reason: ITSELF },
	premises: { kind: "none", reason: ITSELF },
	"electricity-meters": { kind: "none", reason: ITSELF },
	"gas-meters": { kind: "none", reason: ITSELF },
	"key-stage-4-pupils": { kind: "none", reason: ITSELF },
	"pupil-enrolments": { kind: "none", reason: ITSELF },
	"school-sessions": { kind: "none", reason: ITSELF },
	"rtt-incomplete-pathways": {
		kind: "none",
		reason: "A waiting list is counted by the commissioner or provider of the care, not by where patients live, so no resident population is its base. It is the denominator of the longer waits.",
	},
	area: {
		kind: "none",
		reason: "The land area itself. A density would divide by it, not the other way round.",
	},
	"air-quality-grid-cells": {
		kind: "none",
		reason: "The grid cells a concentration was averaged over. It is the weight of a mean, not a count of anything in the population.",
	},
	"ashe-jobs": {
		kind: "none",
		reason: "The survey's estimate of the employee jobs its pay figures cover, in thousands. It is the weight of the pay figures, not a count to put over residents.",
	},
	"unemployed-people": {
		kind: "none",
		reason: "Its denominator is the economically active population aged 16 and over, which is not held. The model-based rate is published beside it as unemployment-rate.",
	},
	"planning-applications": {
		kind: "none",
		reason: "Applications are made for land and buildings, often by businesses and from outside the area, so residents are not their base.",
	},
	"collected-waste": {
		kind: "none",
		reason: "Waste collected by the authority includes waste from businesses and other sources, so neither residents nor households are its base.",
	},
	"household-waste-recycled": {
		kind: "none",
		reason: "The recycling rate is over the household waste collected, which is not held: collected-waste also counts waste from other sources.",
	},
	"rejected-ballots": {
		kind: "none",
		reason: "The rejection rate is over the ballots counted, valid and rejected, which is not held as one measure for the same contests.",
	},
	seats: {
		kind: "none",
		reason: "The members a constituency returns. It is not a count over any population.",
	},
};

/** The rebuilt rates, keyed by the rate measure they write. */
export const REBUILT_RATES: ReadonlyMap<
	string,
	{ numerator: string; denominator: DenominatorReference; per: number }
> = new Map(
	Object.entries(COUNT_DENOMINATORS).flatMap(([numerator, entry]) =>
		entry.kind === "rebuilt"
			? [
					[
						entry.rate,
						{
							numerator,
							denominator: entry.denominator,
							per: entry.per,
						},
					] as const,
				]
			: [],
	),
);
