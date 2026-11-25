import {
	COUNT_DENOMINATORS,
	MEASURE_UNITS,
	NOT_APPLICABLE_REASONS,
	REBUILT_RATES,
	measureSemantics,
} from "@uk-data-atlas/datasets";
import type { StatisticsMeasure } from "@uk-data-atlas/measures";

/**
 * The source publishes a weighted mean but conversion has no weight it can
 * use, so it refuses the measure, see conversion/rules.ts. Conversion reads a
 * weight from the same dataset and on the same area vintage as the measure,
 * so a weight held elsewhere cannot be linked. Each reason says what is
 * missing, and an entry goes as soon as a usable weight is linked.
 */
export const MISSING_WEIGHT_EXCEPTIONS: Readonly<Record<string, string>> = {
	"band-d-council-tax":
		"Weighted by each authority's Band D equivalent dwellings, the council tax base. The dataset publishes the charge but not the base, so no weight is held.",
	"mobile-area-coverage":
		"Weighted by the area's land. The land area is held only in the land-area dataset, on another period and area structure, and conversion reads a weight from the dataset of the measure.",
	"pm25-population-weighted":
		"Weighted by where people live within the area. The gridded population is not held, and the population measure is in another dataset and release.",
	"pm25-population-weighted-anthropogenic":
		"Weighted by where people live within the area. The gridded population is not held, and the population measure is in another dataset and release.",
	"progress-8":
		"Weighted by the pupils with a key stage 2 result who are in the Progress 8 count. The dataset holds key stage 4 pupils, which is a different and larger count, and does not publish the Progress 8 pupil count.",
};

const UNKNOWN_UNIVERSE = 1;
const NOT_APPLICABLE_UNIVERSE = 2;

/** Fail rather than publish metadata that suggests an invalid calculation. */
export function validateMeasureSemantics(measure: StatisticsMeasure): void {
	const fail = (reason: string): never => {
		throw new Error(`Measure ${measure.slug}: ${reason}`);
	};
	const unit = MEASURE_UNITS.find((item) => item.label === measure.unit);
	if (!unit) return fail(`unknown unit ${JSON.stringify(measure.unit)}`);
	const { statistic, universeId } = measureSemantics(measure);
	const ratio = measure.aggregation === "ratio";
	if (ratio && (!measure.numerator || !measure.denominator))
		fail("ratio requires a numerator and denominator");
	if (!ratio && (measure.numerator || measure.denominator))
		fail("only a ratio may name a numerator or denominator");
	if (
		measure.aggregation === "weighted_mean" &&
		!measure.weight &&
		!MISSING_WEIGHT_EXCEPTIONS[measure.slug]
	)
		fail("weighted_mean requires a weight");
	if (measure.weight && measure.aggregation !== "weighted_mean")
		fail("only weighted_mean may name a weight");
	if (
		statistic === "share" &&
		unit.kind !== "percent" &&
		unit.kind !== "ratio"
	)
		fail("share requires a percent or ratio unit");
	if (
		unit.kind === "percent" &&
		!["share", "rate", "by-dimension"].includes(statistic)
	)
		fail(`percent unit is incompatible with statistic ${statistic}`);
	if (
		measure.aggregation === "sum" &&
		statistic !== "count" &&
		statistic !== "total"
	)
		fail(`sum is incompatible with statistic ${statistic}`);
	if (universeId === UNKNOWN_UNIVERSE)
		fail(
			"no universe. Name the population or entity it is a statistic over, or list it as not applicable with a reason",
		);
	if (
		universeId === NOT_APPLICABLE_UNIVERSE &&
		!NOT_APPLICABLE_REASONS[measure.slug]
	)
		fail("not applicable needs a reason in NOT_APPLICABLE_REASONS");
	if (
		measure.aggregation === "sum" &&
		(statistic === "count" || statistic === "total") &&
		!COUNT_DENOMINATORS[measure.slug]
	)
		fail(
			"a count must name its denominator, or say why it has none, in COUNT_DENOMINATORS (packages/datasets/src/declaration/countDenominators.ts)",
		);
	const rebuilt = REBUILT_RATES.get(measure.slug);
	if (rebuilt) {
		if (unit.kind !== "percent" && unit.kind !== "per_n")
			fail("a rebuilt rate needs a percent or per_n unit");
		if (unit.scale !== rebuilt.per)
			fail(
				`a rebuilt rate per ${rebuilt.per} needs a unit of that scale, not ${unit.label}`,
			);
	}
}
