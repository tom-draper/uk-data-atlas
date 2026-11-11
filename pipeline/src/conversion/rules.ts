import type { DatabaseSync } from "node:sqlite";
import type { ConversionBasis } from "./crosswalkSteps.ts";

/**
 * How a measure may be moved from the areas it was published for onto other
 * areas, decided from what the measure table says about it and nothing else.
 *
 * - `sum`: an additive quantity. The parts of a target are added up.
 * - `rebuild`: a ratio, or a mean whose weight is named. The two parts are each
 *   converted and the ratio is taken again. For a mean the parts are the value
 *   times its weight, and the weight. Neither is ever averaged unweighted.
 * - `refuse`: nothing defensible can be done with what is held. The reason is
 *   stored beside the measure.
 */

export type MeasureRow = {
	id: number;
	slug: string;
	unit: string;
	valueKind: string;
	aggregation: string;
	numerator: string | null;
	denominator: string | null;
	/** The count a weighted mean was taken over. */
	weight: string | null;
};

export type ConversionRule =
	| {
			rule: "sum";
			/**
			 * The one weight basis an estimated split of the measure has been
			 * backtested on, or null where a split of it is refused and only an
			 * exact regrouping is allowed.
			 */
			splitBasis: ConversionBasis | null;
			reason: string;
	  }
	| {
			rule: "rebuild";
			numerator: string;
			denominator: string;
			/** What the ratio is multiplied by to give the measure's unit. */
			scale: number;
			reason: string;
	  }
	| {
			rule: "rebuild";
			/** The count the mean is weighted by, area by area. */
			weight: string;
			reason: string;
	  }
	| { rule: "refuse"; reason: string };

/**
 * The measures whose split has been checked against a published truth, and the
 * basis it was checked on. See `fits` in `backtestCases.ts`.
 */
const BACKTESTED_SPLITS: Readonly<Record<string, ConversionBasis>> = {
	population: "population",
};

/** The units a ratio can be rebuilt in, and what each multiplies the ratio by. */
const RATIO_SCALES: Readonly<Record<string, number>> = { percent: 100 };

const REFUSALS: Readonly<Record<string, string>> = {
	median: "A median of a whole is not a function of the medians of its parts. It needs the distribution underneath, which is not held.",
	rank: "A rank orders the areas of one release against each other. It has no meaning for any other set of areas.",
	index: "A score, decile or ratio computed by its publisher for the areas it was published on. Its inputs are not held, so it cannot be computed again for other areas.",
	category:
		"A category cannot be added or averaged, and the largest part of an area need not decide the whole.",
};

/**
 * Why a particular measure cannot be rebuilt, where the general reason for its
 * kind would not say what is missing. Each names the part that is not held, so
 * that holding it is the way to lift the refusal.
 */
const MEASURE_REFUSALS: Readonly<Record<string, string>> = {
	"claimant-rate":
		"A ratio of claimants to residents aged 16 to 64. The claimants are held, but the 16 to 64 population is not held as a measure, so the rate cannot be rebuilt.",
	"children-in-relative-low-income-rate":
		"A ratio of children in low income families to children under 16. The numerator is held, but the count of children under 16 is not held as a measure.",
	"households-in-temporary-accommodation-rate":
		"Per 1,000 households on the publisher's own household estimate, which is not held. Another household count would give a different rate.",
	"unemployment-rate":
		"A model-based rate over the economically active aged 16 and over. The economically active count is not held, and a rate from a model is not the ratio of two held counts.",
	"unemployment-rate-interval":
		"The half-width of a model-based confidence interval. Intervals do not add or average across areas.",
	"unemployed-people-interval":
		"The half-width of a confidence interval around a count. Intervals do not add across areas.",
	"reception-excess-weight":
		"A percentage of the children measured. The number measured is not held.",
	"year-6-excess-weight":
		"A percentage of the children measured. The number measured is not held.",
	"adult-excess-weight":
		"A survey estimate for adults. The sample or population it was taken over is not held.",
	"physically-active-adults":
		"A survey estimate for adults. The sample or population it was taken over is not held.",
	"smoking-prevalence":
		"A survey estimate for adults. The sample or population it was taken over is not held.",
	"preventable-mortality":
		"An age-standardised rate. Combining areas needs deaths and population by age, which are not held.",
	"gcse-english-maths-grade-4-gap":
		"A difference between two pupil groups' rates. The size of each group is not held.",
	"progress-8":
		"Averaged over the pupils with a key stage 2 result. That count is not published here.",
	"gross-annual-pay-change":
		"A change between two years of a published pay figure. Both years' underlying figures and their weights are not held.",
	"gross-hourly-pay-change":
		"A change between two years of a published pay figure. Both years' underlying figures and their weights are not held.",
	"band-d-council-tax":
		"An average of the Band D charge in the area. The number of properties it was averaged over is not held.",
	"house-price-mean":
		"A mean over the sales in the year. The number of sales is not held.",
	"mobile-area-coverage":
		"A percentage of the area's land. The area it is a percentage of is not held beside it.",
	"pm25-population-weighted":
		"Weighted by where people live within the area. The gridded population it was weighted by is not held.",
	"pm25-population-weighted-anthropogenic":
		"Weighted by where people live within the area. The gridded population it was weighted by is not held.",
	"life-expectancy":
		"Computed from each area's mortality by age. Those rates are not held, so areas cannot be combined.",
	"healthy-life-expectancy":
		"Computed from each area's mortality and health by age. Those are not held, so areas cannot be combined.",
	majority:
		"The lead of the winning candidate over the runner-up in one contest. It has no meaning for other areas.",
};

const summable = (measure: Pick<MeasureRow, "valueKind" | "aggregation">) =>
	measure.aggregation === "sum" &&
	(measure.valueKind === "count" || measure.valueKind === "amount");

export const conversionRule = (
	measure: MeasureRow,
	bySlug: ReadonlyMap<string, MeasureRow>,
): ConversionRule => {
	if (summable(measure)) {
		const splitBasis = BACKTESTED_SPLITS[measure.slug] ?? null;
		return {
			rule: "sum",
			splitBasis,
			reason: splitBasis
				? `Additive. Summed where areas regroup exactly. A split is estimated on ${splitBasis} weights for the measure's total alone, within the bounds the backtest measured. A breakdown of it is not split.`
				: "Additive. Summed where areas regroup exactly. No published truth has been found to measure a split of it against, so a split is refused.",
		};
	}
	if (measure.aggregation === "ratio") {
		const numerator = measure.numerator && bySlug.get(measure.numerator);
		const denominator =
			measure.denominator && bySlug.get(measure.denominator);
		if (!numerator || !denominator)
			return {
				rule: "refuse",
				reason: "A ratio must be rebuilt from its numerator and denominator, and the measure does not name both.",
			};
		if (!summable(numerator) || !summable(denominator))
			return {
				rule: "refuse",
				reason: `A ratio must be rebuilt from an additive numerator and denominator, and ${summable(numerator) ? denominator.slug : numerator.slug} is not additive.`,
			};
		const scale = RATIO_SCALES[measure.unit];
		if (scale === undefined)
			return {
				rule: "refuse",
				reason: `No scale is known for a ratio in the unit "${measure.unit}".`,
			};
		return {
			rule: "rebuild",
			numerator: numerator.slug,
			denominator: denominator.slug,
			scale,
			reason: `Rebuilt as ${numerator.slug} over ${denominator.slug}, each converted first. Never averaged.`,
		};
	}
	if (measure.aggregation === "weighted_mean") {
		const weight = measure.weight && bySlug.get(measure.weight);
		if (!weight)
			return {
				rule: "refuse",
				reason: `A weighted mean can only be recombined with the weights it was taken over, and no weight series is linked to the measure. ${MEASURE_REFUSALS[measure.slug] ?? ""}`.trim(),
			};
		if (!summable(weight))
			return {
				rule: "refuse",
				reason: `A weighted mean must be recombined with an additive weight, and ${weight.slug} is not additive.`,
			};
		return {
			rule: "rebuild",
			weight: weight.slug,
			reason: `Rebuilt as the mean over ${weight.slug}: each area's value is weighted by its ${weight.slug}, and both are converted first. Never averaged unweighted.`,
		};
	}
	const specific = MEASURE_REFUSALS[measure.slug];
	if (specific) return { rule: "refuse", reason: specific };
	const byKind = REFUSALS[measure.valueKind];
	if (byKind) return { rule: "refuse", reason: byKind };
	if (measure.valueKind === "rate" || measure.valueKind === "share")
		return {
			rule: "refuse",
			reason: "A rate or share must be rebuilt from its numerator and denominator, and the measure names neither. Averaging it would weight a small area the same as a large one.",
		};
	if (measure.valueKind === "mean")
		return {
			rule: "refuse",
			reason: "A mean can only be recombined with the counts it was taken over, and none is linked to the measure.",
		};
	return {
		rule: "refuse",
		reason: `The measure is declared as not additive (${measure.valueKind}, aggregation ${measure.aggregation}), and no other method is held for it.`,
	};
};

export const readMeasures = (database: DatabaseSync): MeasureRow[] =>
	database
		.prepare(
			`SELECT m.id, m.slug, m.unit, m.value_kind AS valueKind, m.aggregation,
				n.slug AS numerator, d.slug AS denominator, w.slug AS weight
			FROM measure m
			LEFT JOIN measure n ON n.id = m.numerator_id
			LEFT JOIN measure d ON d.id = m.denominator_id
			LEFT JOIN measure w ON w.id = m.weight_id
			ORDER BY m.id`,
		)
		.all() as MeasureRow[];

/** The rule of every measure, in id order. */
export const conversionRules = (measures: readonly MeasureRow[]) => {
	const bySlug = new Map(measures.map((measure) => [measure.slug, measure]));
	return measures.map((measure) => ({
		measure,
		rule: conversionRule(measure, bySlug),
	}));
};
