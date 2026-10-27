import type {
	Aggregation,
	StatisticsMeasure,
	ValueKind,
} from "../atlasStatistics";
import type { DeclaredDimension } from "../declaredStatistics";

/**
 * Measures shared by several datasets. A slug means one thing everywhere, and
 * the build refuses two different declarations of it, so shared ones live
 * here.
 */

export const measure = (
	slug: string,
	label: string,
	unit: string,
	valueKind: ValueKind,
	aggregation: Aggregation,
	description: string,
	ratio?: { numerator: string; denominator: string },
): StatisticsMeasure => ({
	slug,
	label,
	description,
	unit,
	valueKind,
	aggregation,
	...ratio,
});

export const HOUSEHOLDS = measure(
	"households",
	"Households",
	"households",
	"count",
	"sum",
	"Number of households.",
);

export const USUAL_RESIDENTS = measure(
	"usual-residents",
	"Usual residents",
	"people",
	"count",
	"sum",
	"Usual residents counted by the census.",
);

export const POPULATION = measure(
	"population",
	"Population",
	"people",
	"count",
	"sum",
	"Mid-year population estimate.",
);

export const LIFE_EXPECTANCY = measure(
	"life-expectancy",
	"Life expectancy at birth",
	"years",
	"mean",
	"none",
	"Average years a newborn would live at the period's mortality rates.",
);

/** Per-100,000-residents figures the compilers add from the population estimate. */
export const PER_100K = {
	"metrics.per100kPopulation":
		"Computed by the compiler from the mid-year population estimate.",
};

export const PREMISES = measure(
	"premises",
	"Premises",
	"premises",
	"count",
	"sum",
	"Residential and business premises.",
);

export const SEX: DeclaredDimension = {
	slug: "sex",
	label: "Sex",
	members: [
		{ key: "all", label: "All people" },
		{ key: "male", label: "Male", parent: "all" },
		{ key: "female", label: "Female", parent: "all" },
	],
};
