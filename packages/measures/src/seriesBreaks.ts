/**
 * Where a measure's series stops being comparable with itself over time, and
 * which measures are not compared over time at all. The pipeline writes these
 * into `measure_break` and reads them when it pairs periods for
 * `area_period_change` (docs/database-roadmap.md, task 44). They are the one
 * place a method break is declared; the views only join them.
 *
 * A break is a flag and a note. Its effect on a change is not estimated.
 */

/**
 * - `classification`: the publisher recoded something every estimate is built
 *   from (ASHE's move to SOC 2020).
 * - `sample`: the survey ran on an unusual sample for the period.
 * - `census`: estimates are based on a different census from the period on.
 */
export type SeriesBreakKind = "classification" | "sample" | "census";

export type SeriesBreak = {
	/** The stored period label the break is at. */
	period: string;
	kind: SeriesBreakKind;
	/**
	 * `spans`: a change between a period before this one and this one or a
	 * later one crosses the break. `touches`: a change with this period at
	 * either end is affected.
	 */
	effect: "spans" | "touches";
	/** The datasets whose series the break applies to; every one when left out. */
	datasets?: readonly string[];
	/** The publisher's caveat, as the source notes give it. */
	note: string;
};

const ASHE_DATASETS = ["income", "workplace-income"] as const;

const ASHE_BREAKS: readonly SeriesBreak[] = [
	{
		period: "2021",
		kind: "classification",
		effect: "spans",
		datasets: ASHE_DATASETS,
		note: "From 2021 the survey codes occupations to SOC 2020 instead of SOC 2010, which changes the weights every estimate is built from, so 2021 onward is not directly comparable with 2012 to 2020.",
	},
	{
		period: "2020",
		kind: "sample",
		effect: "touches",
		datasets: ASHE_DATASETS,
		note: "Estimates for 2020 come from a smaller sample, include furloughed employees and carry more uncertainty than usual.",
	},
	{
		period: "2021",
		kind: "sample",
		effect: "touches",
		datasets: ASHE_DATASETS,
		note: "Estimates for 2021 come from a smaller sample, include furloughed employees and carry more uncertainty than usual.",
	},
];

/** Declared breaks, by measure slug. */
export const SERIES_BREAKS: Readonly<Record<string, readonly SeriesBreak[]>> =
	{
		"gross-annual-pay": ASHE_BREAKS,
		"gross-hourly-pay": ASHE_BREAKS,
		"ashe-jobs": ASHE_BREAKS,
		population: [
			{
				period: "2022",
				kind: "census",
				effect: "spans",
				datasets: [
					"population-council-scotland",
					"population-data-zone-scotland",
				],
				note: "Scotland's census was held in 2022, a year after the census in England, Wales and Northern Ireland, and Scottish population estimates from mid-2022 are based on it. A change across mid-2022 can include what the census corrected as well as change in the population.",
			},
		],
	};

/**
 * Measures whose values are not compared between periods, with the reason.
 * Ranks, deciles, categories, indices and interval half-widths are left out
 * by their statistic; these are the rest.
 */
export const NOT_COMPARED_OVER_TIME: Readonly<Record<string, string>> = {
	"gross-annual-pay-change":
		"It is already the change on the year before, as the publisher states it.",
	"gross-hourly-pay-change":
		"It is already the change on the year before, as the publisher states it.",
	"party-vote-share-change":
		"It is already the change on the previous election.",
};

/** Statistics whose values mean something only within one period or edition. */
export const NOT_COMPARED_STATISTICS = [
	"rank",
	"category",
	"index",
	"interval",
] as const;
