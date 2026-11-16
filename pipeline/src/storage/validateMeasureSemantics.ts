import { MEASURE_UNITS, measureSemantics } from "@uk-data-atlas/datasets";
import type { StatisticsMeasure } from "@uk-data-atlas/measures";

/** The source publishes a weighted mean but not the weight needed to combine
 * areas. Conversion refuses these measures, see conversion/rules.ts. */
export const MISSING_WEIGHT_EXCEPTIONS: Readonly<Record<string, string>> = {
	"band-d-council-tax":
		"The council tax base used for the published average is not held as a measure.",
	"mobile-area-coverage":
		"The land area used as the published weight is not linked as a measure.",
	"pm25-population-weighted":
		"The gridded population used for the published mean is not held.",
	"pm25-population-weighted-anthropogenic":
		"The gridded population used for the published mean is not held.",
	"progress-8":
		"The eligible pupil count used for the published mean is not held.",
};

/** Fail rather than publish metadata that suggests an invalid calculation. */
export function validateMeasureSemantics(measure: StatisticsMeasure): void {
	const fail = (reason: string): never => {
		throw new Error(`Measure ${measure.slug}: ${reason}`);
	};
	const unit = MEASURE_UNITS.find((item) => item.label === measure.unit);
	if (!unit) return fail(`unknown unit ${JSON.stringify(measure.unit)}`);
	const { statistic } = measureSemantics(measure);
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
}
